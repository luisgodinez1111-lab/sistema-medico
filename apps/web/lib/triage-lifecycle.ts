import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldTriage,assertTriageTransition,type FoldedTriage,type TriageState}from"../../../packages/triage-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC AH — Ciclo de vida del triage: WAITING -> IN_TRIAGE -> TRIAGED (re-evaluable) -> CLOSED; o LWBS.
// Front-of-house de urgencias; arribar/iniciar/clasificar/cerrar/LWBS exige scope triage:write.
const AGG="Triage";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"triage:write",purpose:"TREATMENT"});
}

const ArriveBody=z.object({triageId:z.string().uuid(),patientId:z.string().uuid(),chiefComplaint:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTriageArrive(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ArriveBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.triageId,expectedVersion:0,eventType:"TRIAGE_ARRIVED",payload:{kind:"ARRIVED",patientId:b.patientId,chiefComplaint:b.chiefComplaint},occurredAt:b.occurredAt,topic:"triage.arrived"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({triageId:b.triageId,state:"WAITING",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,triageId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldTriage(await readAggregateEvents(ctx,triageId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Triage not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,triageId:string,folded:FoldedTriage,to:TriageState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:triageId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertTriageTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({triageId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleTriageStart(req:Request,triageId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,triageId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,triageId,folded,"IN_TRIAGE","TRIAGE_STARTED",{kind:"TRIAGE_STARTED"},b.occurredAt,"triage.started");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const AssessBody=z.object({acuity:z.number().int().min(1).max(5),occurredAt:z.string().datetime()});
export async function handleTriageAssessment(req:Request,triageId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,triageId);const b=await parseJson(req,AssessBody);
  return await commit(ctx,idempotencyKey,expectedVersion,triageId,folded,"TRIAGED","TRIAGE_TRIAGED",{kind:"TRIAGED",acuity:b.acuity},b.occurredAt,"triage.triaged");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleTriageClosure(req:Request,triageId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,triageId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,triageId,folded,"CLOSED","TRIAGE_CLOSED",{kind:"CLOSED"},b.occurredAt,"triage.closed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTriageLwbs(req:Request,triageId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,triageId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,triageId,folded,"LWBS","TRIAGE_LWBS",{kind:"LWBS",reason:b.reason},b.occurredAt,"triage.lwbs");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
