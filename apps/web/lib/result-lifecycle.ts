import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldResult,assertResultTransition,type FoldedResult}from"../../../packages/result-fold/src";
import{type ResultState}from"../../../packages/order-result-domain/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC G — Ciclo de vida del resultado diagnóstico (closed-loop de seguimiento) sobre el kernel.
// RECEIVED -> VERIFIED -> ACTIONED (obligación) -> CLOSED. Un resultado CRÍTICO en ACTIONED sin
// cerrar bloquea la firma del encuentro del paciente (Zero Lost Follow-Up, ver encounter-lifecycle).
const AGG="DiagnosticResult";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,role:"PHYSICIAN",scope:"result:write",purpose:"TREATMENT"});
}

const ReceiveBody=z.object({resultId:z.string().uuid(),patientId:z.string().uuid(),orderId:z.string().uuid(),critical:z.boolean(),occurredAt:z.string().datetime()});
// RECEIVE = creación del agregado (expectedVersion 0). Idempotencia la maneja el kernel.
export async function handleResultReceived(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ReceiveBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.resultId,expectedVersion:0,eventType:"RESULT_RECEIVED",payload:{kind:"RECEIVED",patientId:b.patientId,orderId:b.orderId,critical:b.critical},occurredAt:b.occurredAt,topic:"result.received"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({resultId:b.resultId,state:"RECEIVED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,resultId:string){
 const{claims,ctx}=resolveVerified(req);
 authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldResult(await readAggregateEvents(ctx,resultId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Result not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commitTransition(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,resultId:string,folded:FoldedResult,to:ResultState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:resultId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertResultTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({resultId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const VerifyBody=z.object({occurredAt:z.string().datetime()});
export async function handleResultVerification(req:Request,resultId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,resultId);
  const b=await parseJson(req,VerifyBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,resultId,folded,"VERIFIED","RESULT_VERIFIED",{kind:"VERIFIED"},b.occurredAt,"result.verified");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// ACTION = requerir acción (crea la obligación). Un resultado crítico exige owner + due date.
const ActionBody=z.object({ownerId:z.string().uuid(),dueAt:z.string().datetime(),occurredAt:z.string().datetime()});
export async function handleResultAction(req:Request,resultId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,resultId);
  const b=await parseJson(req,ActionBody);
  // payload lleva patientId + critical para que el gate de firma pueda contar sin proyección.
  return await commitTransition(ctx,idempotencyKey,expectedVersion,resultId,folded,"ACTIONED","RESULT_ACTION_REQUIRED",{kind:"ACTIONED",patientId:folded.patientId,critical:folded.critical,ownerId:b.ownerId,dueAt:b.dueAt},b.occurredAt,"result.action_required");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// CLOSURE = cierre con evidencia (resuelve la obligación -> desbloquea la firma).
const CloseBody=z.object({evidence:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleResultClosure(req:Request,resultId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,resultId);
  const b=await parseJson(req,CloseBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,resultId,folded,"CLOSED","RESULT_CLOSED",{kind:"CLOSED",evidence:b.evidence},b.occurredAt,"result.closed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
