import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldObligation,assertObligationTransition,type FoldedObligation,type ObligationSt}from"../../../packages/obligation-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC O — Ciclo de vida de la obligación (seguimiento): OPEN -> IN_PROGRESS -> COMPLETED / CANCELLED.
// Completar exige EVIDENCIA (Zero Lost Follow-Up: nada se cierra sin constancia). Scope obligation:write.
const AGG="ClinicalObligation";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"obligation:write",purpose:"TREATMENT"});
}

const CreateBody=z.object({obligationId:z.string().uuid(),patientId:z.string().uuid(),ownerId:z.string().uuid(),dueAt:z.string().datetime(),kind:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleObligationCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.obligationId,expectedVersion:0,eventType:"OBLIGATION_CREATED",payload:{kind:"CREATED",patientId:b.patientId,ownerId:b.ownerId,dueAt:b.dueAt,obligationKind:b.kind},occurredAt:b.occurredAt,topic:"obligation.created"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({obligationId:b.obligationId,state:"OPEN",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,obligationId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldObligation(await readAggregateEvents(ctx,obligationId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Obligation not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,obligationId:string,folded:FoldedObligation,to:ObligationSt,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:obligationId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertObligationTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({obligationId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleObligationProgress(req:Request,obligationId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,obligationId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,obligationId,folded,"IN_PROGRESS","OBLIGATION_STARTED",{kind:"STARTED"},b.occurredAt,"obligation.started");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// Completar EXIGE evidencia (constancia del seguimiento realizado).
const CompleteBody=z.object({evidence:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleObligationCompletion(req:Request,obligationId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,obligationId);const b=await parseJson(req,CompleteBody);
  return await commit(ctx,idempotencyKey,expectedVersion,obligationId,folded,"COMPLETED","OBLIGATION_COMPLETED",{kind:"COMPLETED",evidence:b.evidence},b.occurredAt,"obligation.completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleObligationCancellation(req:Request,obligationId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,obligationId);const b=await parseJson(req,CancelBody);
  return await commit(ctx,idempotencyKey,expectedVersion,obligationId,folded,"CANCELLED","OBLIGATION_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"obligation.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
