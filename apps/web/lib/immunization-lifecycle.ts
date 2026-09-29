import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldImmunization,assertImmunizationTransition,type FoldedImmunization,type ImmunizationState}from"../../../packages/immunization-fold/src";
import{runClinicalCommand,lookupReplay,requireRegisteredPatient,activeAllergies}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{isVaccineCode,VACCINE_CODES,vaccineComponents}from"../../../packages/immunization-schedule/src";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC V — Ciclo de vida de una vacuna: DUE -> {ADMINISTERED, REFUSED}; ADMINISTERED -> ADVERSE_EVENT.
// Enfermería/médico registran la cartilla (scope immunization:write).
const AGG="Immunization";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"immunization:write",purpose:"TREATMENT"});
}

// Auditoría R02a-IMM-01: `vaccineCode` era texto libre: "BCG", "bcg" y "XYZ" entraban igual y el esquema de vacunación
// no podía cruzar nada con ellos. Ahora se exige un código del ESQUEMA (packages/immunization-schedule), normalizado a
// mayúsculas. Si hace falta registrar una vacuna fuera del esquema nacional, primero se añade al esquema: así el
// pronóstico de dosis y el cruce de alergias siguen siendo ciertos.
export const DueBody=z.object({immunizationId:z.string().uuid(),patientId:z.string().uuid(),
 vaccineCode:z.string().trim().transform(v=>v.toUpperCase()).refine(isVaccineCode,`vaccineCode debe ser uno del esquema: ${VACCINE_CODES.join(", ")}`),
 dose:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleImmunizationDue(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,DueBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.immunizationId,expectedVersion:0,eventType:"IMMUNIZATION_DUE",payload:{kind:"DUE",patientId:b.patientId,vaccineCode:b.vaccineCode,dose:b.dose},occurredAt:b.occurredAt,topic:"immunization.due"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({immunizationId:b.immunizationId,state:"DUE",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedImmunization,ImmunizationState>({aggregateType:AGG,idKey:"immunizationId",notFound:"Immunization not found",fold:foldImmunization,assertTransition:assertImmunizationTransition,authz});
const loadForTransition=(req:Request,immunizationId:string)=>LIFECYCLE.loadForTransition(req,immunizationId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,immunizationId:string,folded:FoldedImmunization,to:ImmunizationState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,immunizationId,folded,to,eventType,payload,occurredAt,topic);

// R02a-IMM-01: antes de ADMINISTRAR se cruzan las alergias ACTIVAS del paciente con los componentes de la vacuna.
// Criterio (conservador y explícito, porque es una decisión clínica y no puede quedar implícita en el código):
//  · alergia GRAVE a un componente -> se BLOQUEA (403). Ninguna confirmación la levanta desde esta ruta: el riesgo de
//    una reacción anafiláctica a un componente conocido no es algo que se resuelva con una casilla.
//  · alergia leve/moderada o de gravedad desconocida -> se exige CONFIRMACIÓN expresa (428) con justificación, y la
//    confirmación queda en el evento con el nombre del componente implicado.
// La lista de componentes no sustituye la ficha técnica del lote: eso se dice en el propio mensaje.
export const AdminBody=z.object({lot:z.string().min(1),site:z.string().min(1),occurredAt:z.string().datetime(),
 acknowledgeAllergy:z.boolean().optional(),allergyJustification:z.string().trim().max(500).optional()});
export async function handleImmunizationAdministration(req:Request,immunizationId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,immunizationId);const b=await parseJson(req,AdminBody);
  const componentes=vaccineComponents(folded.vaccineCode);
  const alergias=componentes.length?await activeAllergies(ctx,folded.patientId):[];
  const coincidencias=alergias.filter(a=>componentes.some(c=>a.substance.toLowerCase().includes(c)||c.includes(a.substance.toLowerCase())));
  const graves=coincidencias.filter(a=>a.severity==="SEVERE");
  if(graves.length>0)throw new ClinicalError("SAFETY_BLOCKED",
   `Alergia GRAVE registrada a un componente de esta vacuna (${graves.map(a=>a.substance).join(", ")}). No se administra por esta vía: valore el caso y, si procede, documente la decisión en el expediente.`,
   {barriers:["vaccineAllergy"],hard:["vaccineAllergy"]});
  if(coincidencias.length>0&&b.acknowledgeAllergy!==true)throw new ClinicalError("SAFETY_ACK_REQUIRED",
   `Alergia registrada a un componente de esta vacuna (${coincidencias.map(a=>`${a.substance}${a.severity?` · ${a.severity}`:" · gravedad no registrada"}`).join("; ")}). Verifique la ficha técnica del lote y confirme expresamente que procede (acknowledgeAllergy + allergyJustification).`,
   {notEvaluated:["vaccineAllergy"]});
  if(coincidencias.length>0&&(b.allergyJustification??"").trim().length<10)
   throw new ClinicalError("VALIDATION_ERROR","allergyJustification (≥10 caracteres) es obligatoria cuando hay una alergia registrada a un componente");
  const payload:Record<string,unknown>={kind:"ADMINISTERED",lot:b.lot,site:b.site};
  if(coincidencias.length>0)payload["allergyAcknowledged"]={components:componentes,substances:coincidencias.map(a=>a.substance),justification:(b.allergyJustification??"").trim()};
  return await commit(ctx,idempotencyKey,expectedVersion,immunizationId,folded,"ADMINISTERED","IMMUNIZATION_ADMINISTERED",payload,b.occurredAt,"immunization.administered");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleImmunizationRefusal(req:Request,immunizationId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,immunizationId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,immunizationId,folded,"REFUSED","IMMUNIZATION_REFUSED",{kind:"REFUSED",reason:b.reason},b.occurredAt,"immunization.refused");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const AdverseBody=z.object({reaction:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleImmunizationAdverseEvent(req:Request,immunizationId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,immunizationId);const b=await parseJson(req,AdverseBody);
  return await commit(ctx,idempotencyKey,expectedVersion,immunizationId,folded,"ADVERSE_EVENT","IMMUNIZATION_ADVERSE_EVENT",{kind:"ADVERSE_EVENT",reaction:b.reaction},b.occurredAt,"immunization.adverse_event");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
