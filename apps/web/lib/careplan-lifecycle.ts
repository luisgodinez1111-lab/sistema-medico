import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldCarePlan,assertCarePlanTransition,type FoldedCarePlan,type CarePlanState}from"../../../packages/careplan-fold/src";
import{runClinicalCommand,lookupReplay,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC X — Ciclo de vida de una meta de plan de cuidados: PROPOSED -> ACTIVE -> ACHIEVED;
// ACTIVE <-> ON_HOLD; cancelable desde no-terminal. Gestión de crónicos (scope careplan:write).
const AGG="CarePlan";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"careplan:write",purpose:"TREATMENT"});
}

export const ProposeBody=z.object({carePlanId:z.string().uuid(),patientId:z.string().uuid(),category:z.enum(["DIABETES","HYPERTENSION","OBESITY","CARDIOVASCULAR","MENTAL_HEALTH","PRENATAL","OTHER"]),goal:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleCarePlanPropose(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ProposeBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.carePlanId,expectedVersion:0,eventType:"CAREPLAN_PROPOSED",payload:{kind:"PROPOSED",patientId:b.patientId,category:b.category,goal:b.goal},occurredAt:b.occurredAt,topic:"careplan.proposed"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({carePlanId:b.carePlanId,state:"PROPOSED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedCarePlan,CarePlanState>({aggregateType:AGG,idKey:"carePlanId",notFound:"Care plan not found",fold:foldCarePlan,assertTransition:assertCarePlanTransition,authz});
const loadForTransition=(req:Request,carePlanId:string)=>LIFECYCLE.loadForTransition(req,carePlanId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,carePlanId:string,folded:FoldedCarePlan,to:CarePlanState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,carePlanId,folded,to,eventType,payload,occurredAt,topic);

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleCarePlanActivation(req:Request,carePlanId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,carePlanId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,carePlanId,folded,"ACTIVE","CAREPLAN_ACTIVATED",{kind:"ACTIVATED"},b.occurredAt,"careplan.activated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleCarePlanHold(req:Request,carePlanId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,carePlanId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,carePlanId,folded,"ON_HOLD","CAREPLAN_HELD",{kind:"HELD"},b.occurredAt,"careplan.held");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleCarePlanResume(req:Request,carePlanId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,carePlanId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,carePlanId,folded,"ACTIVE","CAREPLAN_RESUMED",{kind:"RESUMED"},b.occurredAt,"careplan.resumed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleCarePlanAchievement(req:Request,carePlanId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,carePlanId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,carePlanId,folded,"ACHIEVED","CAREPLAN_ACHIEVED",{kind:"ACHIEVED"},b.occurredAt,"careplan.achieved");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleCarePlanCancellation(req:Request,carePlanId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,carePlanId);const b=await parseJson(req,CancelBody);
  return await commit(ctx,idempotencyKey,expectedVersion,carePlanId,folded,"CANCELLED","CAREPLAN_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"careplan.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
