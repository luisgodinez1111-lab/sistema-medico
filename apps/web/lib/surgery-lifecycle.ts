import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldSurgery,assertSurgeryTransition,type FoldedSurgery,type SurgeryState}from"../../../packages/surgery-fold/src";
import{verifyTimeOut,verifySignOut}from"../../../packages/surgical-checklist/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC AK — Ciclo de vida del caso quirúrgico: SCHEDULED -> TIMED_OUT -> IN_PROGRESS -> COMPLETED (o CANCELLED).
// Cirugía segura; agendar/time-out/iniciar/completar/cancelar exige scope surgery:write (physician control).
const AGG="Surgery";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{role:"PHYSICIAN",scope:"surgery:write",purpose:"TREATMENT"});
}

export const ScheduleBody=z.object({surgeryId:z.string().uuid(),patientId:z.string().uuid(),procedure:z.string().min(1),laterality:z.enum(["LEFT","RIGHT","BILATERAL","NA"]),surgeon:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleSurgerySchedule(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ScheduleBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.surgeryId,expectedVersion:0,eventType:"SURGERY_SCHEDULED",payload:{kind:"SCHEDULED",patientId:b.patientId,procedure:b.procedure,laterality:b.laterality,surgeon:b.surgeon},occurredAt:b.occurredAt,topic:"surgery.scheduled"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({surgeryId:b.surgeryId,state:"SCHEDULED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedSurgery,SurgeryState>({aggregateType:AGG,idKey:"surgeryId",notFound:"Surgery not found",fold:foldSurgery,assertTransition:assertSurgeryTransition,authz});
const loadForTransition=(req:Request,surgeryId:string)=>LIFECYCLE.loadForTransition(req,surgeryId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,surgeryId:string,folded:FoldedSurgery,to:SurgeryState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,surgeryId,folded,to,eventType,payload,occurredAt,topic);

export const WhenBody=z.object({occurredAt:z.string().datetime()});
// Auditoría 2026-09-19, anexo R02b (R2B-018) — EL TIME-OUT OMS, CON SUS ÍTEMS, no con una fecha.
//
// Esta transición emitía `{kind:"TIMEOUT_COMPLETED"}` y nada más, mientras el fold declaraba «barrera de seguridad
// obligatoria para iniciar» y el dossier la aprobaba como «cirugía segura con time-out OMS». Cualquiera con rol PHYSICIAN
// podía completarla sin declarar un solo ítem, y la `laterality` capturada al agendar no se volvía a mirar. Ahora el cuerpo
// trae los ítems del Time Out de la lista de la OMS (2009) y lo confirmado en quirófano se compara contra lo AGENDADO: un
// desacuerdo de procedimiento o de lateralidad es el mecanismo exacto de la cirugía en el sitio equivocado, así que
// responde 400 VALIDATION_ERROR con el desacuerdo y NO registra la transición.
export const TimeoutBody=z.object({
 teamIntroduced:z.boolean(),
 patientConfirmed:z.boolean(),
 procedureConfirmed:z.string().trim().min(1),
 lateralityConfirmed:z.enum(["LEFT","RIGHT","BILATERAL","NA"]),
 siteMarked:z.boolean(),
 antibioticProphylaxis:z.enum(["GIVEN_WITHIN_60_MIN","NOT_INDICATED","NOT_GIVEN"]),
 criticalEventsReviewed:z.boolean(),
 imagingAvailable:z.boolean(),
 ledBy:z.string().trim().min(3,"Quién dirigió el time-out queda registrado: la OMS recomienda un coordinador único"),
 occurredAt:z.string().datetime(),
});
export async function handleSurgeryTimeout(req:Request,surgeryId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,surgeryId);const b=await parseJson(req,TimeoutBody);
  // Lo agendado viene del FOLD, no del cuerpo: si viniera del cuerpo, quien confirma podría «confirmar» contra sí mismo.
  const check=verifyTimeOut(b,{procedure:folded.procedure,laterality:folded.laterality});
  if(!check.ok)throw new ClinicalError("VALIDATION_ERROR",`Time-out quirúrgico NO superado: ${check.blockers.join(" · ")}`,{blockers:check.blockers});
  return await commit(ctx,idempotencyKey,expectedVersion,surgeryId,folded,"TIMED_OUT","SURGERY_TIMEOUT_COMPLETED",
   {kind:"TIMEOUT_COMPLETED",teamIntroduced:b.teamIntroduced,patientConfirmed:b.patientConfirmed,
    procedureConfirmed:b.procedureConfirmed,lateralityConfirmed:b.lateralityConfirmed,siteMarked:b.siteMarked,
    antibioticProphylaxis:b.antibioticProphylaxis,criticalEventsReviewed:b.criticalEventsReviewed,
    imagingAvailable:b.imagingAvailable,ledBy:b.ledBy,checklist:"WHO_SURGICAL_SAFETY_2009_TIME_OUT"},
   b.occurredAt,"surgery.timeout_completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleSurgeryStart(req:Request,surgeryId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,surgeryId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,surgeryId,folded,"IN_PROGRESS","SURGERY_STARTED",{kind:"STARTED"},b.occurredAt,"surgery.started");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// R2B-018 (segunda mitad): el SIGN OUT. Cerrar un caso registraba solo un `outcome` de texto libre, así que el conteo de
// instrumental y gasas —la razón por la que la lista de la OMS existe en gran parte, el cuerpo extraño retenido es un evento
// centinela— no se registraba en ninguna parte. Ahora completar exige los ítems del Sign Out y un conteo incorrecto bloquea.
export const CompleteBody=z.object({
 outcome:z.string().min(1),
 procedurePerformed:z.string().trim().min(1),
 instrumentCount:z.enum(["CORRECT","INCORRECT","NOT_APPLICABLE"]),
 spongeCount:z.enum(["CORRECT","INCORRECT","NOT_APPLICABLE"]),
 needleCount:z.enum(["CORRECT","INCORRECT","NOT_APPLICABLE"]),
 specimensLabelled:z.boolean(),
 equipmentIssues:z.string().max(500).default(""),
 recoveryConcernsReviewed:z.boolean(),
 occurredAt:z.string().datetime(),
});
export async function handleSurgeryCompletion(req:Request,surgeryId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,surgeryId);const b=await parseJson(req,CompleteBody);
  const check=verifySignOut(b);
  if(!check.ok)throw new ClinicalError("VALIDATION_ERROR",`Sign out quirúrgico NO superado: ${check.blockers.join(" · ")}`,{blockers:check.blockers});
  return await commit(ctx,idempotencyKey,expectedVersion,surgeryId,folded,"COMPLETED","SURGERY_COMPLETED",
   {kind:"COMPLETED",outcome:b.outcome,procedurePerformed:b.procedurePerformed,instrumentCount:b.instrumentCount,
    spongeCount:b.spongeCount,needleCount:b.needleCount,specimensLabelled:b.specimensLabelled,
    equipmentIssues:b.equipmentIssues,recoveryConcernsReviewed:b.recoveryConcernsReviewed,
    checklist:"WHO_SURGICAL_SAFETY_2009_SIGN_OUT"},
   b.occurredAt,"surgery.completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleSurgeryCancellation(req:Request,surgeryId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,surgeryId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,surgeryId,folded,"CANCELLED","SURGERY_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"surgery.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
