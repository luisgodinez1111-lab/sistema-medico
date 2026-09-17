import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldDialysis,assertDialysisTransition,type FoldedDialysis,type DialysisState}from"../../../packages/dialysis-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC AL — Ciclo de vida de una sesión de diálisis: SCHEDULED -> IN_SESSION -> {COMPLETED, INTERRUPTED};
// INTERRUPTED -> reanudar/completar. Cuidado renal crónico; agendar/iniciar/... exige scope dialysis:write.
const AGG="Dialysis";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"dialysis:write",purpose:"TREATMENT"});
}

const ScheduleBody=z.object({dialysisId:z.string().uuid(),patientId:z.string().uuid(),modality:z.enum(["HEMODIALYSIS","PERITONEAL","HEMOFILTRATION"]),accessType:z.enum(["FISTULA","GRAFT","CATHETER","PERITONEAL_CATHETER"]),occurredAt:z.string().datetime()});
export async function handleDialysisSchedule(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ScheduleBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.dialysisId,expectedVersion:0,eventType:"DIALYSIS_SCHEDULED",payload:{kind:"SCHEDULED",patientId:b.patientId,modality:b.modality,accessType:b.accessType},occurredAt:b.occurredAt,topic:"dialysis.scheduled"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({dialysisId:b.dialysisId,state:"SCHEDULED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,dialysisId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldDialysis(await readAggregateEvents(ctx,dialysisId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Dialysis session not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,dialysisId:string,folded:FoldedDialysis,to:DialysisState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:dialysisId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertDialysisTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({dialysisId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleDialysisStart(req:Request,dialysisId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,dialysisId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,"IN_SESSION","DIALYSIS_STARTED",{kind:"STARTED"},b.occurredAt,"dialysis.started");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleDialysisResumption(req:Request,dialysisId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,dialysisId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,"IN_SESSION","DIALYSIS_RESUMED",{kind:"RESUMED"},b.occurredAt,"dialysis.resumed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleDialysisCompletion(req:Request,dialysisId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,dialysisId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,"COMPLETED","DIALYSIS_COMPLETED",{kind:"COMPLETED"},b.occurredAt,"dialysis.completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleDialysisInterruption(req:Request,dialysisId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,dialysisId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,"INTERRUPTED","DIALYSIS_INTERRUPTED",{kind:"INTERRUPTED",reason:b.reason},b.occurredAt,"dialysis.interrupted");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleDialysisCancellation(req:Request,dialysisId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,dialysisId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,"CANCELLED","DIALYSIS_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"dialysis.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleDialysisNoShow(req:Request,dialysisId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,dialysisId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,"NO_SHOW","DIALYSIS_NO_SHOW",{kind:"NO_SHOW"},b.occurredAt,"dialysis.no_show");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
