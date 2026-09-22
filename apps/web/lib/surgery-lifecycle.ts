import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldSurgery,assertSurgeryTransition,type FoldedSurgery,type SurgeryState}from"../../../packages/surgery-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC AK — Ciclo de vida del caso quirúrgico: SCHEDULED -> TIMED_OUT -> IN_PROGRESS -> COMPLETED (o CANCELLED).
// Cirugía segura; agendar/time-out/iniciar/completar/cancelar exige scope surgery:write (physician control).
const AGG="Surgery";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,role:"PHYSICIAN",scope:"surgery:write",purpose:"TREATMENT"});
}

const ScheduleBody=z.object({surgeryId:z.string().uuid(),patientId:z.string().uuid(),procedure:z.string().min(1),laterality:z.enum(["LEFT","RIGHT","BILATERAL","NA"]),surgeon:z.string().min(1),occurredAt:z.string().datetime()});
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

async function loadForTransition(req:Request,surgeryId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldSurgery(await readAggregateEvents(ctx,surgeryId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Surgery not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,surgeryId:string,folded:FoldedSurgery,to:SurgeryState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:surgeryId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertSurgeryTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({surgeryId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleSurgeryTimeout(req:Request,surgeryId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,surgeryId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,surgeryId,folded,"TIMED_OUT","SURGERY_TIMEOUT_COMPLETED",{kind:"TIMEOUT_COMPLETED"},b.occurredAt,"surgery.timeout_completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleSurgeryStart(req:Request,surgeryId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,surgeryId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,surgeryId,folded,"IN_PROGRESS","SURGERY_STARTED",{kind:"STARTED"},b.occurredAt,"surgery.started");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const CompleteBody=z.object({outcome:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleSurgeryCompletion(req:Request,surgeryId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,surgeryId);const b=await parseJson(req,CompleteBody);
  return await commit(ctx,idempotencyKey,expectedVersion,surgeryId,folded,"COMPLETED","SURGERY_COMPLETED",{kind:"COMPLETED",outcome:b.outcome},b.occurredAt,"surgery.completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleSurgeryCancellation(req:Request,surgeryId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,surgeryId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,surgeryId,folded,"CANCELLED","SURGERY_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"surgery.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
