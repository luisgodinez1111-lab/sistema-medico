import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldMedication,assertMedicationTransition,assertMedicationAnnotation,type FoldedMedication,type MedAnnotationKind}from"../../../packages/medication-fold/src";
import{type MedicationState}from"../../../packages/medication-domain/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,activeAllergies,activeMedicationDrugCodes,activeProblemCodes,latestVitalsByType,patientEgfr,patientDemographics,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{derivePatientFactors}from"./patient-factors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson,derivedUuid,replayStablePayload}from"./http-command";
import{checkDrugAllergy,checkDuplicateTherapy,checkInteractions,checkContraindications,resolveDrug,monitoringFor,checkRenalDosing}from"../../../packages/drug-catalog/src";
import{validateMedicationOrder,normalizeRoute,checkDoseCeiling,checkPediatricDose,checkDurationLimit,durationToDays}from"../../../packages/medication-validation/src";
import{physicianCredentials,requirePhysicianCredentials}from"./physician-profile-lifecycle";
import{evaluatePrescriptionSafety,summarizeForEvent,ageInYears,decideOverride,OVERRIDABLE_BARRIERS,OVERRIDE_MIN_JUSTIFICATION,type OverrideRequest,type SafetyOverride}from"../../../packages/prescription-safety/src";
// EPIC H — Ciclo de vida de medicación sobre el kernel. Physician Control:
// PROPOSE lo puede hacer cualquier clínico (o IA), PRESCRIBE exige médico (IA nunca prescribe).
// EXEC-0014: Lifecycle PROPOSED->PRESCRIBED->STARTED->ACTIVE->HELD->STOPPED->CANCELLED
// Track: indication, dose/route/freq, duration, start/stop, response, adverse effects,
// monitoring obligations, reconciliation status, calculated vs prescribed dose, override reason.
const AGG="Medication";
type Claims={sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string};
// EPIC BD — Último peso (kg) del paciente para el ceiling pediátrico. undefined si no hay peso registrado
// o no es numérico. Asume el vital WEIGHT en kg (unidad del catálogo de vitales).
async function patientWeightKg(ctx:Parameters<typeof runClinicalCommand>[0],patientId:string):Promise<number|undefined>{
 const v=await latestVitalsByType(ctx,patientId);const raw=v["WEIGHT"];
 if(raw===undefined)return undefined;const n=Number(String(raw).trim());return Number.isFinite(n)?n:undefined;
}

export const ProposeBody=z.object({medicationId:z.string().uuid(),patientId:z.string().uuid(),drugCode:z.string().min(1),indication:z.string().optional(),dose:z.string().min(1),route:z.string().min(1),frequency:z.string().min(1),duration:z.string().optional(),calculatedDose:z.string().optional(),occurredAt:z.string().datetime()});
// PROPOSE = creación. Cualquier clínico/IA con scope medication:propose (no exige médico).
export async function handleMedicationProposal(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"medication:propose",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ProposeBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  // EPIC AV (profundidad/seguridad): validación estructurada de dosis/vía/frecuencia (vocabulario controlado).
  const v=validateMedicationOrder({dose:b.dose,route:b.route,frequency:b.frequency});
  if(!v.ok)throw new ClinicalError("VALIDATION_ERROR",`Orden de medicación no válida: ${v.errors.join("; ")}`,{errors:v.errors});
  // EPIC AZ (profundidad/seguridad): tope de dosis máxima diaria — atrapa sobredosis (dose ceiling).
  // R02a-MED-01: `if(ing)` hacía que un fármaco fuera del catálogo se saltara el techo de dosis y el máximo pediátrico
  // EN SILENCIO. PROPOSE es una propuesta (la barrera completa con 428 vive en PRESCRIBE), pero el silencio era el
  // defecto: ahora la propuesta deja constancia EN EL EVENTO de qué no se pudo verificar y lo devuelve como aviso, de
  // modo que ni el expediente ni la UI pueden presentar «sin hallazgos» como si se hubiera comprobado algo.
  const ing=resolveDrug(b.drugCode)?.ingredient;
  const demoMed=await patientDemographics(ctx,b.patientId);
  const edadPaciente=demoMed?.birthDate?ageInYears(demoMed.birthDate,b.occurredAt):undefined;
  const noVerificado:string[]=ing?[]:["doseCeiling","pediatricDose"];
  // R03-26: el techo depende de la VÍA y de la EDAD, y la DURACIÓN es una barrera propia.
  const dur=ing?checkDurationLimit(ing,durationToDays(b.duration)):undefined;
  if(dur?.evaluable&&dur.exceeded)throw new ClinicalError("SAFETY_BLOCKED",`Duración de ${dur.days} días excede el máximo de ${dur.maxDays} para ${ing}: ${dur.reason}`,{ingredient:ing,maxDays:dur.maxDays});
  if(ing){const dc=checkDoseCeiling(ing,b.dose,b.frequency,b.drugCode,{route:b.route,...(edadPaciente!==undefined?{ageYears:edadPaciente}:{})}); // C-15: "2 tab" se acota con la concentración del código
   if(dc.checked&&dc.exceeded)throw new ClinicalError("SAFETY_BLOCKED",`Dosis diaria excede el máximo de ${ing}: ${dc.computedMgPerDay}mg/día > ${dc.maxMgPerDay}mg/día. Reduzca la dosis o la frecuencia (o modifique con justificación clínica).`,{computedMgPerDay:dc.computedMgPerDay,maxMgPerDay:dc.maxMgPerDay});
   // EPIC BD (profundidad/seguridad pediátrica): en peso pediátrico, valida mg/kg/día (el ceiling absoluto no protege a un niño).
   const w=await patientWeightKg(ctx,b.patientId);
   const pd=checkPediatricDose(ing,b.dose,b.frequency,w,edadPaciente);
   // R03-27: un paciente pediátrico sin peso vigente no puede RECIBIR un fármaco que se dosifica por kg. El bloqueo duro
   // vive en PRESCRIBE (que es donde la orden sale al paciente); aquí, en la propuesta, se deja CONSTANCIA en el evento
   // de que la dosis por kg no se verificó —el defecto R02a-MED-01 era precisamente el silencio—, para no bloquear el
   // borrador de una consulta en la que el peso se toma un minuto después.
   if(pd.weightRequired)noVerificado.push("pediatricDose:WEIGHT_REQUIRED");
   if(pd.checked&&pd.exceeded)throw new ClinicalError("SAFETY_BLOCKED",`Dosis pediátrica excede el máximo de ${ing}: ${pd.computedMgPerKgPerDay}mg/kg/día > ${pd.maxMgPerKgPerDay}mg/kg/día (peso ${pd.weightKg}kg). Recalcule por peso.`,{computedMgPerKgPerDay:pd.computedMgPerKgPerDay,maxMgPerKgPerDay:pd.maxMgPerKgPerDay,weightKg:pd.weightKg});}
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.medicationId,expectedVersion:0,eventType:"MEDICATION_PROPOSED",payload:{kind:"PROPOSED",patientId:b.patientId,drugCode:b.drugCode,indication:b.indication,dose:b.dose,route:normalizeRoute(b.route),frequency:b.frequency,duration:b.duration,calculatedDose:b.calculatedDose,
   // R02a-MED-01: constancia explícita de lo que NO se verificó en la propuesta (fármaco fuera del catálogo).
   ...(noVerificado.length?{safety:{catalogResolved:false,notEvaluated:noVerificado}}:{})},occurredAt:b.occurredAt,topic:"medication.proposed"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({medicationId:b.medicationId,state:"PROPOSED",version:r.version,auditHash:r.auditHash,replayed:result.replayed,
   // El aviso viaja en la respuesta para que la UI no pueda presentar la propuesta como verificada (R02a-MED-01).
   ...(noVerificado.length?{warnings:[{code:"DRUG_NOT_IN_CATALOG",notEvaluated:noVerificado,
    message:"Fármaco fuera del catálogo: el techo de dosis y el máximo pediátrico NO se verificaron en la propuesta. Al prescribir se exigirá su confirmación expresa."}]}:{})},
   {status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,medicationId:string,requirePhysician:boolean){
 const{claims,ctx}=resolveVerified(req);
 const c=claims as Claims;
 // Physician Control: prescribir/activar/suspender exige médico; scope medication:write.
 authorize(principalFrom(c),requirePhysician?{role:"PHYSICIAN",scope:"medication:write",purpose:"TREATMENT"}:{scope:"medication:write",purpose:"TREATMENT"});
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldMedication(await readAggregateEvents(ctx,medicationId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Medication not found");
 return{claims:c,ctx,idempotencyKey,expectedVersion,folded};
}
async function commitTransition(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,medicationId:string,folded:FoldedMedication,to:MedicationState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:medicationId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertMedicationTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({medicationId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}
// Anotación: el estado NO cambia (la respuesta devuelve el estado vigente). Misma disciplina que una transición: replay
// idempotente primero, versión (If-Match) antes que cualquier otra precondición, y guardas de dominio al final.
async function commitAnnotation(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,medicationId:string,folded:FoldedMedication,kind:MedAnnotationKind,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string,guard?:()=>void,extra:Record<string,unknown>={}){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:medicationId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){
  if(expectedVersion!==folded.version)throw new ClinicalError("CONCURRENCY_CONFLICT","Medication changed since last read",{expected:expectedVersion,actual:folded.version});
  assertMedicationAnnotation(folded.state,kind);guard?.();
  result=await runClinicalCommand(ctx,cmd);
 }
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({medicationId,state:folded.state,annotation:kind,version:r.version,auditHash:r.auditHash,replayed:result.replayed,...extra},{status:result.replayed?200:201});
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
// Cada obligación es su propia transacción (no atómica con la prescripción); un reintento la reconcilia.
async function createMonitoringObligations(ctx:Parameters<typeof runClinicalCommand>[0],baseIdemKey:string,patientId:string,ownerId:string,drugCode:string,occurredAt:string):Promise<void>{
 // Auditoría R02a-MED-01: `monitoringFor` devuelve [] para un fármaco FUERA del catálogo, así que prescribirlo creaba
 // CERO obligaciones de monitoreo… en silencio. Para el médico, «ninguna obligación» se lee como «este fármaco no
 // necesita seguimiento», que es lo contrario de la verdad: no se sabe. Zero-Lost-Follow-Up exige lo opuesto: cuando el
 // sistema no puede decidir el monitoreo, la obligación es DEFINIRLO, y recae en quien prescribió.
 const rules=monitoringFor(drugCode);
 if(rules.length===0&&!resolveDrug(drugCode)){
  const idem=derivedUuid(baseIdemKey,"monitor-idem-undefined");
  const obligationId=derivedUuid(baseIdemKey,"monitor-agg-undefined");
  const cmd=buildCommand({idempotencyKey:idem,aggregateType:"ClinicalObligation",aggregateId:obligationId,expectedVersion:0,
   eventType:"OBLIGATION_CREATED",payload:{kind:"CREATED",patientId,ownerId,
    dueAt:new Date(new Date(occurredAt).getTime()+7*DAY_MS).toISOString(),
    obligationKind:"MONITORING_UNDEFINED",test:`Definir el monitoreo de ${drugCode}`,priority:"HIGH",
    note:`El fármaco «${drugCode}» no está en el catálogo: el sistema no pudo derivar ninguna obligación de monitoreo. Defina qué vigilar y con qué periodicidad.`,
    sourceDrugCode:drugCode},
   occurredAt,topic:"obligation.created"});
  let r=await lookupReplay(ctx,cmd);
  if(!r)r=await runClinicalCommand(ctx,cmd);
  return;
 }
 for(let i=0;i<rules.length;i++){
  const rule=rules[i]!;
  const idem=derivedUuid(baseIdemKey,`monitor-idem-${i}`);
  const obligationId=derivedUuid(baseIdemKey,`monitor-agg-${i}`);
  const dueAt=new Date(new Date(occurredAt).getTime()+rule.dueInDays*DAY_MS).toISOString();
  const cmd=buildCommand({idempotencyKey:idem,aggregateType:"ClinicalObligation",aggregateId:obligationId,expectedVersion:0,eventType:"OBLIGATION_CREATED",payload:{kind:"CREATED",patientId,ownerId,dueAt,obligationKind:rule.kind,test:rule.test,note:rule.note,sourceMedicationDrug:drugCode},occurredAt,topic:"obligation.created"});
  let r=await lookupReplay(ctx,cmd);
  if(!r)r=await runClinicalCommand(ctx,cmd);
 }
}
// Evaluación de barreras COMPARTIDA por PRESCRIBE y MODIFY: mismos datos del paciente, mismo evaluador puro. La propia
// medicación se EXCLUYE de la lista de activos (al modificarla está ACTIVE y se marcaría duplicada consigo misma).
// R03-26: la DURACIÓN forma parte de la orden a efectos de seguridad (ketorolaco máximo 5 días).
type OrderFields=Readonly<{dose:string;route:string;frequency:string;duration?:string|undefined}>;
async function evaluateSafetyFor(ctx:Parameters<typeof runClinicalCommand>[0],medicationId:string,folded:FoldedMedication,order:OrderFields,asOf:string){
 const[substances,activeDrugs,conditions,egfr,weightKg,demo]=await Promise.all([
  activeAllergies(ctx,folded.patientId),activeMedicationDrugCodes(ctx,folded.patientId,medicationId),activeProblemCodes(ctx,folded.patientId),
  patientEgfr(ctx,folded.patientId),patientWeightKg(ctx,folded.patientId),patientDemographics(ctx,folded.patientId)]);
 return evaluatePrescriptionSafety({drugCode:folded.drugCode,dose:order.dose,route:order.route,frequency:order.frequency,
  allergies:substances,activeDrugCodes:activeDrugs,activeConditionCodes:conditions,egfr,weightKg,
  ageYears:demo?.birthDate?ageInYears(demo.birthDate,asOf):undefined,
  // R03-26/R03-29: la duración de la orden y los factores del paciente (embarazo, lactancia, insuficiencia renal o
  // hepática, alcohol) DERIVADOS del expediente. Antes las reglas del embarazo no se activaban nunca en esta barrera.
  durationDays:durationToDays(order.duration),
  patientFactors:derivePatientFactors(conditions,demo?.birthDate)});
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
 if(safety.requiresAcknowledgement&&!acknowledged){
  // R02a-MED-03: el mensaje distingue «no se pudo evaluar» de «el catálogo no tiene regla». Son dos cosas distintas para
  // el médico: la primera puede resolverse completando datos (peso, TFG); la segunda significa que no existe valor de
  // referencia para ese fármaco y su criterio es el único control que queda.
  const sinEvaluar=[...safety.notEvaluated];
  const sinRegla=[...safety.notCovered];
  const motivo=[
   sinEvaluar.length?`NO evaluadas (${sinEvaluar.join(", ")}): ${safety.catalogResolved?"faltan datos del paciente":"el fármaco no está en el catálogo"}`:"",
   sinRegla.length?`SIN regla en el catálogo (${sinRegla.join(", ")}): no existe valor de referencia para verificar`:"",
  ].filter(Boolean).join(" · ");
  throw new ClinicalError("SAFETY_ACK_REQUIRED",
   `Verificación automática incompleta — ${motivo}. Confirme expresamente que procede bajo su criterio clínico (acknowledgeUnverified) e indique la justificación.`,
   {notEvaluated:sinEvaluar,notCovered:sinRegla});
 }
 if(safety.requiresAcknowledgement&&(justification??"").trim().length<10)throw new ClinicalError("VALIDATION_ERROR","unverifiedJustification (≥10 caracteres) es obligatoria cuando la verificación automática es incompleta");
}
// PRESCRIBE = PROPOSED -> PRESCRIBED. EXIGE médico (Physician Control): la IA nunca prescribe.
export async function handleMedicationPrescription(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded,claims}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,PrescribeBody);
  // Auditoría 2026-09-19 (C-03/C-04): evaluador ÚNICO de barreras (el mismo del dry-run /prescription-check).
  // Antes, un fármaco fuera del catálogo omitía TODAS las barreras en silencio. Ahora cada barrera queda en un
  // estado explícito y, si alguna NO pudo evaluarse, el médico debe confirmarlo expresamente (queda en el evento).
  const safety=await evaluateSafetyFor(ctx,medicationId,folded,{dose:folded.dose,route:folded.route,frequency:folded.frequency,duration:folded.duration},b.occurredAt);
  const acknowledged=b.acknowledgeUnverified===true;const override=overrideRequestOf(b);
  // Auditoría L-05: la identidad legal del prescriptor (nombre y cédula) queda en el evento tal como estaba al prescribir.
  const cred=await physicianCredentials(ctx,claims);
  // El resumen de barreras lo calcula el servidor y depende del estado del paciente: estable ante reintentos (ver replayStablePayload).
  const payload=await replayStablePayload(ctx,idempotencyKey,medicationId,b,()=>({kind:"PRESCRIBED",prescriberId:claims.sub,
   prescriber:cred?{fullName:cred.fullName,cedulaProfesional:cred.cedulaProfesional}:undefined,
   safety:summarizeForEvent(safety,{acknowledged,justification:b.unverifiedJustification},overrideForEvent(safety,override,claims.sub))}));
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:medicationId,expectedVersion,eventType:"MEDICATION_PRESCRIBED",payload,occurredAt:b.occurredAt,topic:"medication.prescribed"});
  let result=await lookupReplay(ctx,cmd);
  if(!result){
   // Orden de precondiciones: PRIMERO la versión. No se le pide al médico que confirme y justifique una prescripción
   // sobre una vista obsoleta del expediente: con If-Match desfasado responde 409 y el cliente debe releer.
   if(expectedVersion!==folded.version)throw new ClinicalError("CONCURRENCY_CONFLICT","Medication changed since last read",{expected:expectedVersion,actual:folded.version});
   assertMedicationTransition(folded.state,"PRESCRIBED");
   await requirePhysicianCredentials(ctx,claims); // L-05: sin cédula registrada no hay prescripción (428)
   enforceSafety(safety,"prescribe",acknowledged,b.unverifiedJustification,override);
   // EXEC-0014 / EPIC BA: al prescribir, crear las obligaciones de monitoreo del fármaco (INR, creatinina/TFG, potasio...).
   result=await runClinicalCommand(ctx,cmd);
   await createMonitoringObligations(ctx,idempotencyKey,folded.patientId,claims.sub,folded.drugCode,b.occurredAt);
  }
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({medicationId,state:"PRESCRIBED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// ACTIVATE = PRESCRIBED -> ACTIVE (inicio de administración/primera dosis).
export async function handleMedicationActivation(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,WhenBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,medicationId,folded,"ACTIVE","MEDICATION_ACTIVATED",{kind:"ACTIVATED",startedAt:b.occurredAt},b.occurredAt,"medication.activated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// HOLD = ACTIVE -> HELD. Suspensión temporal con razón.
export const HoldBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleMedicationHold(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,HoldBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,medicationId,folded,"HELD","MEDICATION_HELD",{kind:"HELD",reason:b.reason},b.occurredAt,"medication.held");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// RESUME = HELD -> ACTIVE. Reanudación tras suspensión. Durante la suspensión el paciente pudo iniciar otro fármaco, sumar
// un diagnóstico o deteriorar su función renal: reanudar vuelve a poner el fármaco EN CURSO, así que pasa por el MISMO
// evaluador que PRESCRIBE (bloqueo -> 403; no verificable -> 428 con confirmación y justificación).
export const ResumeBody=z.object({occurredAt:z.string().datetime(),acknowledgeUnverified:z.boolean().optional(),unverifiedJustification:z.string().max(500).optional(),...OverrideFields});
export async function handleMedicationResume(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded,claims}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,ResumeBody);
  const safety=await evaluateSafetyFor(ctx,medicationId,folded,{dose:folded.dose,route:folded.route,frequency:folded.frequency,duration:folded.duration},b.occurredAt);
  const acknowledged=b.acknowledgeUnverified===true;const override=overrideRequestOf(b);
  const payload=await replayStablePayload(ctx,idempotencyKey,medicationId,b,()=>({kind:"RESUMED",safety:summarizeForEvent(safety,{acknowledged,justification:b.unverifiedJustification},overrideForEvent(safety,override,claims.sub))}));
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:medicationId,expectedVersion,eventType:"MEDICATION_RESUMED",payload,occurredAt:b.occurredAt,topic:"medication.resumed"});
  let result=await lookupReplay(ctx,cmd);
  if(!result){
   if(expectedVersion!==folded.version)throw new ClinicalError("CONCURRENCY_CONFLICT","Medication changed since last read",{expected:expectedVersion,actual:folded.version});
   assertMedicationTransition(folded.state,"ACTIVE");
   if(folded.state!=="HELD")throw new ClinicalError("CONFLICT",`Illegal medication transition ${folded.state} -> ACTIVE (resume requires HELD)`,{from:folded.state});
   enforceSafety(safety,"resume",acknowledged,b.unverifiedJustification,override);
   result=await runClinicalCommand(ctx,cmd);
  }
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({medicationId,state:"ACTIVE",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// MODIFY = cambio de dosis/vía/frecuencia de una medicación EN CURSO (ACTIVE/HELD). Es una ANOTACIÓN: no cambia el estado.
// Auditoría L-04: antes pedía la transición X->X y respondía 409 siempre. Además, al hacerla funcionar, NO puede ser un atajo
// para saltarse las barreras: la orden resultante pasa por la MISMA validación de orden y el MISMO evaluador que PRESCRIBE
// (un `overrideWarning` afirmado por el cliente no es una verificación). Exige razón clínica del cambio.
export const ModifyBody=z.object({dose:z.string().min(1).optional(),route:z.string().min(1).optional(),frequency:z.string().min(1).optional(),calculatedDose:z.string().optional(),reason:z.string().min(3).max(500),
 acknowledgeUnverified:z.boolean().optional(),unverifiedJustification:z.string().max(500).optional(),...OverrideFields,occurredAt:z.string().datetime()});
export async function handleMedicationModification(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded,claims}=await loadForTransition(req,medicationId,true);
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
   previous:{dose:folded.dose,route:folded.route,frequency:folded.frequency,duration:folded.duration},safety:summarizeForEvent(safety,{acknowledged,justification:b.unverifiedJustification},overrideForEvent(safety,override,claims.sub))}));
  return await commitAnnotation(ctx,idempotencyKey,expectedVersion,medicationId,folded,"MODIFIED","MEDICATION_MODIFIED",payload,b.occurredAt,"medication.modified",
   ()=>enforceSafety(safety,"modify",acknowledged,b.unverifiedJustification,override),{order:next});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// DISCONTINUE = {ACTIVE,HELD} -> STOPPED. Exige razón (trazabilidad clínica).
export const StopBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleMedicationDiscontinuation(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,StopBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,medicationId,folded,"STOPPED","MEDICATION_STOPPED",{kind:"STOPPED",reason:b.reason,stoppedAt:b.occurredAt},b.occurredAt,"medication.stopped");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// RECONCILE = Marcar estado de reconciliación (ADMITTED/DISCHARGED/TRANSFER).
const ReconcileBody=z.object({status:z.enum(["ADMITTED","DISCHARGED","TRANSFERRED","UNCHANGED"]),note:z.string().optional(),occurredAt:z.string().datetime()});
export async function handleMedicationReconciliation(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,ReconcileBody);
  const payload:Record<string,unknown>={kind:"RECONCILED",reconciliationStatus:b.status};if(b.note!==undefined)payload["note"]=b.note;
  return await commitAnnotation(ctx,idempotencyKey,expectedVersion,medicationId,folded,"RECONCILED","MEDICATION_RECONCILED",payload,b.occurredAt,"medication.reconciled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
