import{z}from"zod";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldMedication,assertMedicationTransition,assertMedicationAnnotation,type FoldedMedication}from"../../../packages/medication-fold/src";
import{runClinicalCommand,runDerivedCommand}from"./runtime/command";
import{activeAllergies,activeMedicationDrugCodes,activeProblemCodes}from"./runtime/read-models/safety-inputs";
import{latestVitalsByType}from"./runtime/read-models/vitals";
import{patientEgfr}from"./runtime/read-models/renal";
import{patientDemographics,requireRegisteredPatient}from"./runtime/read-models/patient";
import{buildCommand,parseJson,derivedUuid,replayStablePayload}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
import{resolveDrug,monitoringFor}from"../../../packages/drug-catalog/src";
import{validateMedicationOrder,normalizeRoute,checkDoseCeiling,checkPediatricDose}from"../../../packages/medication-validation/src";
import{physicianCredentials,requirePhysicianCredentials}from"./physician-profile-lifecycle";
import{evaluatePrescriptionSafety,summarizeForEvent,ageInYears,decideOverride,OVERRIDABLE_BARRIERS,OVERRIDE_MIN_JUSTIFICATION,type OverrideRequest,type SafetyOverride}from"../../../packages/prescription-safety/src";
// EPIC H — Ciclo de vida de medicación sobre el kernel. Physician Control:
// PROPOSE lo puede hacer cualquier clínico (o IA), PRESCRIBE exige médico (IA nunca prescribe).
// EXEC-0014: Lifecycle PROPOSED->PRESCRIBED->STARTED->ACTIVE->HELD->STOPPED->CANCELLED
// Track: indication, dose/route/freq, duration, start/stop, response, adverse effects,
// monitoring obligations, reconciliation status, calculated vs prescribed dose, override reason.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, versión, máquina de estados, kernel) vive en el
// pipeline; la guarda es POR OPERACIÓN (proponer no exige médico) y las barreras y los derivados van en `guard` / `afterRun`.
const MED={aggregateType:"Medication",idField:"medicationId",fold:foldMedication,assertTransition:assertMedicationTransition,notFound:"Medication not found",changed:"Medication changed since last read"} as const;
const PROPOSE={scope:"medication:propose",purpose:"TREATMENT"} as const;
// Physician Control: prescribir/activar/suspender exige médico; scope medication:write.
const WRITE={role:"PHYSICIAN",scope:"medication:write",purpose:"TREATMENT"} as const;
// EPIC BD — Último peso (kg) del paciente para el ceiling pediátrico. undefined si no hay peso registrado
// o no es numérico. Asume el vital WEIGHT en kg (unidad del catálogo de vitales).
async function patientWeightKg(ctx:Parameters<typeof runClinicalCommand>[0],patientId:string):Promise<number|undefined>{
 const v=await latestVitalsByType(ctx,patientId);const raw=v["WEIGHT"];
 if(raw===undefined)return undefined;const n=Number(String(raw).trim());return Number.isFinite(n)?n:undefined;
}

export const ProposeBody=z.object({medicationId:z.string().uuid(),patientId:z.string().uuid(),drugCode:z.string().min(1),indication:z.string().optional(),dose:z.string().min(1),route:z.string().min(1),frequency:z.string().min(1),duration:z.string().optional(),calculatedDose:z.string().optional(),occurredAt:z.string().datetime()});
// PROPOSE = creación. Cualquier clínico/IA con scope medication:propose (no exige médico).
export async function handleMedicationProposal(req:Request):Promise<Response>{
 return createCommand(req,PROPOSE,MED,async({ctx})=>{
  const b=await parseJson(req,ProposeBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  // EPIC AV (profundidad/seguridad): validación estructurada de dosis/vía/frecuencia (vocabulario controlado).
  const v=validateMedicationOrder({dose:b.dose,route:b.route,frequency:b.frequency});
  if(!v.ok)throw new ClinicalError("VALIDATION_ERROR",`Orden de medicación no válida: ${v.errors.join("; ")}`,{errors:v.errors});
  // EPIC AZ (profundidad/seguridad): tope de dosis máxima diaria — atrapa sobredosis (dose ceiling).
  const ing=resolveDrug(b.drugCode)?.ingredient;
  if(ing){const dc=checkDoseCeiling(ing,b.dose,b.frequency,b.drugCode); // C-15: "2 tab" se acota con la concentración del código
   if(dc.checked&&dc.exceeded)throw new ClinicalError("SAFETY_BLOCKED",`Dosis diaria excede el máximo de ${ing}: ${dc.computedMgPerDay}mg/día > ${dc.maxMgPerDay}mg/día. Reduzca la dosis o la frecuencia (o modifique con justificación clínica).`,{computedMgPerDay:dc.computedMgPerDay,maxMgPerDay:dc.maxMgPerDay});
   // EPIC BD (profundidad/seguridad pediátrica): en peso pediátrico, valida mg/kg/día (el ceiling absoluto no protege a un niño).
   const w=await patientWeightKg(ctx,b.patientId);
   const pd=checkPediatricDose(ing,b.dose,b.frequency,w);
   if(pd.checked&&pd.exceeded)throw new ClinicalError("SAFETY_BLOCKED",`Dosis pediátrica excede el máximo de ${ing}: ${pd.computedMgPerKgPerDay}mg/kg/día > ${pd.maxMgPerKgPerDay}mg/kg/día (peso ${pd.weightKg}kg). Recalcule por peso.`,{computedMgPerKgPerDay:pd.computedMgPerKgPerDay,maxMgPerKgPerDay:pd.maxMgPerKgPerDay,weightKg:pd.weightKg});}
  return{aggregateId:b.medicationId,state:"PROPOSED",eventType:"MEDICATION_PROPOSED",payload:{kind:"PROPOSED",patientId:b.patientId,drugCode:b.drugCode,indication:b.indication,dose:b.dose,route:normalizeRoute(b.route),frequency:b.frequency,duration:b.duration,calculatedDose:b.calculatedDose},occurredAt:b.occurredAt,topic:"medication.proposed"};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
// PRESCRIBE admite la confirmación explícita del médico cuando alguna barrera no pudo evaluarse (queda en el evento).
// Auditoría U-19: anulación justificada de un bloqueo. El médico NOMBRA cada barrera que anula (`overrideBarriers`) y da la
// justificación (`overrideJustification`, ≥ OVERRIDE_MIN_JUSTIFICATION). Solo las barreras anulables se admiten en el esquema;
// techo de dosis, dosis pediátrica y orden mal formada no tienen anulación posible. Compartido por PRESCRIBE, RESUME y MODIFY.
const OverrideFields={
 overrideBarriers:z.array(z.enum(OVERRIDABLE_BARRIERS)).min(1).max(OVERRIDABLE_BARRIERS.length).optional(),
 overrideJustification:z.string().max(1000).optional(),
};
const overrideRequestOf=(b:{overrideBarriers?:readonly(typeof OVERRIDABLE_BARRIERS)[number][]|undefined;overrideJustification?:string|undefined}):OverrideRequest|undefined=>{
 if(b.overrideBarriers===undefined){
  if(b.overrideJustification!==undefined)throw new ClinicalError("VALIDATION_ERROR","overrideJustification requiere overrideBarriers: nombre cada barrera que anula");
  return undefined;
 }
 return{barriers:b.overrideBarriers,justification:b.overrideJustification??""};
};
export const PrescribeBody=z.object({occurredAt:z.string().datetime(),acknowledgeUnverified:z.boolean().optional(),unverifiedJustification:z.string().max(500).optional(),...OverrideFields});
const DAY_MS=86_400_000;
// EPIC BA — Crea automáticamente las obligaciones de monitoreo del fármaco al prescribir (Zero-Lost-Follow-Up).
// Idempotente: ids/keys derivados de la key de la prescripción + slot; un reintento reconstruye lo mismo.
// Cada obligación es su propia transacción (no atómica con la prescripción); un reintento IDÉNTICO la reconcilia: el pipeline
// ejecuta este derivado también en el replay de la prescripción y runDerivedCommand no vuelve a cobrar el límite (hallazgo D5).
// Sin ese reintento no se reconcilia todavía (pendiente: reconciliador del servidor, ver runtime/command.ts).
async function createMonitoringObligations(ctx:Parameters<typeof runClinicalCommand>[0],baseIdemKey:string,patientId:string,ownerId:string,drugCode:string,occurredAt:string):Promise<void>{
 const rules=monitoringFor(drugCode);
 for(let i=0;i<rules.length;i++){
  const rule=rules[i]!;
  const idem=derivedUuid(baseIdemKey,`monitor-idem-${i}`);
  const obligationId=derivedUuid(baseIdemKey,`monitor-agg-${i}`);
  const dueAt=new Date(new Date(occurredAt).getTime()+rule.dueInDays*DAY_MS).toISOString();
  const cmd=buildCommand({idempotencyKey:idem,aggregateType:"ClinicalObligation",aggregateId:obligationId,expectedVersion:0,eventType:"OBLIGATION_CREATED",payload:{kind:"CREATED",patientId,ownerId,dueAt,obligationKind:rule.kind,test:rule.test,note:rule.note,sourceMedicationDrug:drugCode},occurredAt,topic:"obligation.created"});
  await runDerivedCommand(ctx,cmd);
 }
}
// Evaluación de barreras COMPARTIDA por PRESCRIBE y MODIFY: mismos datos del paciente, mismo evaluador puro. La propia
// medicación se EXCLUYE de la lista de activos (al modificarla está ACTIVE y se marcaría duplicada consigo misma).
type OrderFields=Readonly<{dose:string;route:string;frequency:string}>;
async function evaluateSafetyFor(ctx:Parameters<typeof runClinicalCommand>[0],medicationId:string,folded:FoldedMedication,order:OrderFields,asOf:string){
 const[substances,activeDrugs,conditions,egfr,weightKg,demo]=await Promise.all([
  activeAllergies(ctx,folded.patientId),activeMedicationDrugCodes(ctx,folded.patientId,medicationId),activeProblemCodes(ctx,folded.patientId),
  patientEgfr(ctx,folded.patientId),patientWeightKg(ctx,folded.patientId),patientDemographics(ctx,folded.patientId)]);
 return evaluatePrescriptionSafety({drugCode:folded.drugCode,dose:order.dose,route:order.route,frequency:order.frequency,
  allergies:substances,activeDrugCodes:activeDrugs,activeConditionCodes:conditions,egfr,weightKg,
  ageYears:demo?.birthDate?ageInYears(demo.birthDate,asOf):undefined});
}
// Anulación (U-19) que irá al evento: null si no había bloqueo anulable; undefined si la petición NO es válida (enforceSafety
// la rechazará antes de escribir, así que nunca llega a persistirse una anulación inválida).
function overrideForEvent(safety:ReturnType<typeof evaluatePrescriptionSafety>,req:OverrideRequest|undefined,by:string):{override:SafetyOverride|null;by:string}|undefined{
 const d=decideOverride(safety,req);return d.ok?{override:d.override,by}:undefined;
}
// Aplica el veredicto del evaluador: BLOQUEO -> 403 (no anulable, o anulable sin la anulación completa); anulación mal
// formada -> 400; no verificable sin confirmación -> 428; confirmación sin justificación -> 400.
function enforceSafety(safety:ReturnType<typeof evaluatePrescriptionSafety>,verb:string,acknowledged:boolean,justification:string|undefined,override:OverrideRequest|undefined){
 const d=decideOverride(safety,override);
 if(!d.ok){
  const detail=(ids:readonly string[])=>safety.barriers.filter(x=>ids.includes(x.id)).map(x=>x.detail).join(" · ");
  const info={barriers:d.blocked,hard:d.hard,overridable:d.overridable};
  if(d.code==="HARD_BLOCK")throw new ClinicalError("SAFETY_BLOCKED",`Cannot ${verb}: ${detail(d.blocked)} — bloqueo NO anulable: corrija la orden`,info);
  if(d.code==="OVERRIDE_REQUIRED")throw new ClinicalError("SAFETY_BLOCKED",`Cannot ${verb}: ${detail(d.blocked)} — anulable solo bajo responsabilidad del médico: nombre cada barrera en overrideBarriers (${d.unmatched.join(", ")}) con overrideJustification (≥${OVERRIDE_MIN_JUSTIFICATION} caracteres)`,{...info,missing:d.unmatched});
  if(d.code==="OVERRIDE_NOT_BLOCKED")throw new ClinicalError("VALIDATION_ERROR",`overrideBarriers nombra barreras que no bloquean (${d.unmatched.join(", ")}): una anulación solo se registra sobre un bloqueo real`,{...info,unmatched:d.unmatched});
  throw new ClinicalError("VALIDATION_ERROR",`overrideJustification (≥${OVERRIDE_MIN_JUSTIFICATION} caracteres) es obligatoria para anular un bloqueo`,info);
 }
 if(safety.requiresAcknowledgement&&!acknowledged)throw new ClinicalError("SAFETY_ACK_REQUIRED",
  `Verificación automática incompleta (${safety.notEvaluated.join(", ")}): ${safety.catalogResolved?"faltan datos del paciente para evaluar":"el fármaco no está en el catálogo"}. Confirme expresamente que procede bajo su criterio clínico (acknowledgeUnverified) e indique la justificación.`,
  {notEvaluated:safety.notEvaluated});
 if(safety.requiresAcknowledgement&&(justification??"").trim().length<10)throw new ClinicalError("VALIDATION_ERROR","unverifiedJustification (≥10 caracteres) es obligatoria cuando la verificación automática es incompleta");
}
// PRESCRIBE = PROPOSED -> PRESCRIBED. EXIGE médico (Physician Control): la IA nunca prescribe.
export async function handleMedicationPrescription(req:Request,medicationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,MED,medicationId,async({ctx,idempotencyKey,folded,claims})=>{
  const b=await parseJson(req,PrescribeBody);
  // Auditoría 2026-09-19 (C-03/C-04): evaluador ÚNICO de barreras (el mismo del dry-run /prescription-check).
  // Antes, un fármaco fuera del catálogo omitía TODAS las barreras en silencio. Ahora cada barrera queda en un
  // estado explícito y, si alguna NO pudo evaluarse, el médico debe confirmarlo expresamente (queda en el evento).
  const safety=await evaluateSafetyFor(ctx,medicationId,folded,{dose:folded.dose,route:folded.route,frequency:folded.frequency},b.occurredAt);
  const acknowledged=b.acknowledgeUnverified===true;const override=overrideRequestOf(b);
  // Auditoría L-05: la identidad legal del prescriptor (nombre y cédula) queda en el evento tal como estaba al prescribir.
  const cred=await physicianCredentials(ctx,claims);
  // El resumen de barreras lo calcula el servidor y depende del estado del paciente: estable ante reintentos (ver replayStablePayload).
  const payload=await replayStablePayload(ctx,idempotencyKey,medicationId,b,()=>({kind:"PRESCRIBED",prescriberId:claims.sub,
   prescriber:cred?{fullName:cred.fullName,cedulaProfesional:cred.cedulaProfesional}:undefined,
   safety:summarizeForEvent(safety,{acknowledged,justification:b.unverifiedJustification},overrideForEvent(safety,override,claims.sub))}));
  // Orden de precondiciones: PRIMERO la versión (la comprueba el pipeline en toda transición, D7). No se le pide al médico que confirme y justifique una
  // prescripción sobre una vista obsoleta del expediente: con If-Match desfasado responde 409 y el cliente debe releer.
  return{to:"PRESCRIBED",eventType:"MEDICATION_PRESCRIBED",payload,occurredAt:b.occurredAt,topic:"medication.prescribed",
   guard:async()=>{
    await requirePhysicianCredentials(ctx,claims); // L-05: sin cédula registrada no hay prescripción (428)
    enforceSafety(safety,"prescribe",acknowledged,b.unverifiedJustification,override);},
   // EXEC-0014 / EPIC BA: al prescribir, crear las obligaciones de monitoreo del fármaco (INR, creatinina/TFG, potasio...).
   afterRun:()=>createMonitoringObligations(ctx,idempotencyKey,folded.patientId,claims.sub,folded.drugCode,b.occurredAt)};
 });
}
// ACTIVATE = PRESCRIBED -> ACTIVE (inicio de administración/primera dosis).
export async function handleMedicationActivation(req:Request,medicationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,MED,medicationId,async()=>{
  const b=await parseJson(req,WhenBody);
  return{to:"ACTIVE",eventType:"MEDICATION_ACTIVATED",payload:{kind:"ACTIVATED",startedAt:b.occurredAt},occurredAt:b.occurredAt,topic:"medication.activated"};
 });
}
// HOLD = ACTIVE -> HELD. Suspensión temporal con razón.
export const HoldBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleMedicationHold(req:Request,medicationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,MED,medicationId,async()=>{
  const b=await parseJson(req,HoldBody);
  return{to:"HELD",eventType:"MEDICATION_HELD",payload:{kind:"HELD",reason:b.reason},occurredAt:b.occurredAt,topic:"medication.held"};
 });
}
// RESUME = HELD -> ACTIVE. Reanudación tras suspensión. Durante la suspensión el paciente pudo iniciar otro fármaco, sumar
// un diagnóstico o deteriorar su función renal: reanudar vuelve a poner el fármaco EN CURSO, así que pasa por el MISMO
// evaluador que PRESCRIBE (bloqueo -> 403; no verificable -> 428 con confirmación y justificación).
export const ResumeBody=z.object({occurredAt:z.string().datetime(),acknowledgeUnverified:z.boolean().optional(),unverifiedJustification:z.string().max(500).optional(),...OverrideFields});
export async function handleMedicationResume(req:Request,medicationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,MED,medicationId,async({ctx,idempotencyKey,folded,claims})=>{
  const b=await parseJson(req,ResumeBody);
  const safety=await evaluateSafetyFor(ctx,medicationId,folded,{dose:folded.dose,route:folded.route,frequency:folded.frequency},b.occurredAt);
  const acknowledged=b.acknowledgeUnverified===true;const override=overrideRequestOf(b);
  const payload=await replayStablePayload(ctx,idempotencyKey,medicationId,b,()=>({kind:"RESUMED",safety:summarizeForEvent(safety,{acknowledged,justification:b.unverifiedJustification},overrideForEvent(safety,override,claims.sub))}));
  return{to:"ACTIVE",eventType:"MEDICATION_RESUMED",payload,occurredAt:b.occurredAt,topic:"medication.resumed",
   guard:()=>{
    if(folded.state!=="HELD")throw new ClinicalError("CONFLICT",`Illegal medication transition ${folded.state} -> ACTIVE (resume requires HELD)`,{from:folded.state});
    enforceSafety(safety,"resume",acknowledged,b.unverifiedJustification,override);}};
 });
}
// MODIFY = cambio de dosis/vía/frecuencia de una medicación EN CURSO (ACTIVE/HELD). Es una ANOTACIÓN: no cambia el estado.
// Auditoría L-04: antes pedía la transición X->X y respondía 409 siempre. Además, al hacerla funcionar, NO puede ser un atajo
// para saltarse las barreras: la orden resultante pasa por la MISMA validación de orden y el MISMO evaluador que PRESCRIBE
// (un `overrideWarning` afirmado por el cliente no es una verificación). Exige razón clínica del cambio.
// Anotaciones (MODIFY y RECONCILE): la respuesta devuelve el estado vigente. Misma disciplina que una transición: replay
// idempotente primero, versión (If-Match) antes que cualquier otra precondición, y guardas de dominio al final
// (versión del pipeline, `check` con assertMedicationAnnotation y `guard`).
export const ModifyBody=z.object({dose:z.string().min(1).optional(),route:z.string().min(1).optional(),frequency:z.string().min(1).optional(),calculatedDose:z.string().optional(),reason:z.string().min(3).max(500),
 acknowledgeUnverified:z.boolean().optional(),unverifiedJustification:z.string().max(500).optional(),...OverrideFields,occurredAt:z.string().datetime()});
export async function handleMedicationModification(req:Request,medicationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,MED,medicationId,async({ctx,idempotencyKey,folded,claims})=>{
  const b=await parseJson(req,ModifyBody);
  if(b.dose===undefined&&b.route===undefined&&b.frequency===undefined)throw new ClinicalError("VALIDATION_ERROR","Indique al menos un cambio: dose, route o frequency");
  const next:OrderFields={dose:b.dose??folded.dose,route:b.route!==undefined?normalizeRoute(b.route):folded.route,frequency:b.frequency??folded.frequency};
  const v=validateMedicationOrder(next);
  if(!v.ok)throw new ClinicalError("VALIDATION_ERROR",`Orden de medicación no válida: ${v.errors.join("; ")}`,{errors:v.errors});
  const safety=await evaluateSafetyFor(ctx,medicationId,folded,next,b.occurredAt);
  const acknowledged=b.acknowledgeUnverified===true;const override=overrideRequestOf(b);
  // `previous` y `safety` dependen del estado del agregado/paciente: estables ante reintentos (ver replayStablePayload).
  const payload=await replayStablePayload(ctx,idempotencyKey,medicationId,b,()=>({kind:"MODIFIED",reason:b.reason,
   dose:b.dose!==undefined?next.dose:undefined,route:b.route!==undefined?next.route:undefined,frequency:b.frequency!==undefined?next.frequency:undefined,calculatedDose:b.calculatedDose,
   previous:{dose:folded.dose,route:folded.route,frequency:folded.frequency},safety:summarizeForEvent(safety,{acknowledged,justification:b.unverifiedJustification},overrideForEvent(safety,override,claims.sub))}));
  return{to:folded.state,check:()=>assertMedicationAnnotation(folded.state,"MODIFIED"),eventType:"MEDICATION_MODIFIED",payload,occurredAt:b.occurredAt,topic:"medication.modified",
   guard:()=>enforceSafety(safety,"modify",acknowledged,b.unverifiedJustification,override),extra:{annotation:"MODIFIED"},tail:{order:next}};
 });
}
// DISCONTINUE = {ACTIVE,HELD} -> STOPPED. Exige razón (trazabilidad clínica).
export const StopBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleMedicationDiscontinuation(req:Request,medicationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,MED,medicationId,async()=>{
  const b=await parseJson(req,StopBody);
  return{to:"STOPPED",eventType:"MEDICATION_STOPPED",payload:{kind:"STOPPED",reason:b.reason,stoppedAt:b.occurredAt},occurredAt:b.occurredAt,topic:"medication.stopped"};
 });
}
// RECONCILE = Marcar estado de reconciliación (ADMITTED/DISCHARGED/TRANSFER).
const ReconcileBody=z.object({status:z.enum(["ADMITTED","DISCHARGED","TRANSFERRED","UNCHANGED"]),note:z.string().optional(),occurredAt:z.string().datetime()});
export async function handleMedicationReconciliation(req:Request,medicationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,MED,medicationId,async({folded})=>{
  const b=await parseJson(req,ReconcileBody);
  const payload:Record<string,unknown>={kind:"RECONCILED",reconciliationStatus:b.status};if(b.note!==undefined)payload["note"]=b.note;
  return{to:folded.state,check:()=>assertMedicationAnnotation(folded.state,"RECONCILED"),eventType:"MEDICATION_RECONCILED",payload,occurredAt:b.occurredAt,topic:"medication.reconciled",extra:{annotation:"RECONCILED"}};
 });
}
