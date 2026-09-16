import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldProblem,assertProblemTransition,type FoldedProblem,type ProblemState}from"../../../packages/problem-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC Q — Lista de problemas: ADDED(ACTIVE) -> RESOLVED / CHRONIC / ENTERED_IN_ERROR; RESOLVED -> ACTIVE.
const AGG="ClinicalProblem";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"problem:write",purpose:"TREATMENT"});
}
const CreateBody=z.object({problemId:z.string().uuid(),patientId:z.string().uuid(),code:z.string().min(1),description:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleProblemCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.problemId,expectedVersion:0,eventType:"PROBLEM_ADDED",payload:{kind:"ADDED",patientId:b.patientId,code:b.code,description:b.description},occurredAt:b.occurredAt,topic:"problem.added"});
  const result=await runClinicalCommand(ctx,cmd);const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({problemId:b.problemId,state:"ACTIVE",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
async function loadForTransition(req:Request,problemId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldProblem(await readAggregateEvents(ctx,problemId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Problem not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,problemId:string,folded:FoldedProblem,to:ProblemState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:problemId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertProblemTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({problemId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}
const WhenBody=z.object({occurredAt:z.string().datetime()});
const ResolveBody=z.object({note:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleProblemResolution(req:Request,problemId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,problemId);const b=await parseJson(req,ResolveBody);
  return await commit(ctx,idempotencyKey,expectedVersion,problemId,folded,"RESOLVED","PROBLEM_RESOLVED",{kind:"RESOLVED",note:b.note},b.occurredAt,"problem.resolved");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleProblemReactivation(req:Request,problemId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,problemId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,problemId,folded,"ACTIVE","PROBLEM_REACTIVATED",{kind:"REACTIVATED"},b.occurredAt,"problem.reactivated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleProblemChronicity(req:Request,problemId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,problemId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,problemId,folded,"CHRONIC","PROBLEM_MARKED_CHRONIC",{kind:"MARKED_CHRONIC"},b.occurredAt,"problem.chronic");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
