import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldTransfusion,assertTransfusionTransition,type FoldedTransfusion,type TransfusionState}from"../../../packages/transfusion-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC AJ — Ciclo de vida de una transfusión: ORDERED -> CROSSMATCHED -> TRANSFUSING -> {COMPLETED, REACTION}.
// Medicina transfusional; ordenar/cruzar/iniciar/completar/reacción/cancelar exige scope transfusion:write.
const AGG="Transfusion";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"transfusion:write",purpose:"TREATMENT"});
}

const OrderBody=z.object({transfusionId:z.string().uuid(),patientId:z.string().uuid(),bloodProduct:z.enum(["PRBC","PLATELETS","FFP","CRYO","WHOLE_BLOOD"]),units:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTransfusionOrder(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,OrderBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.transfusionId,expectedVersion:0,eventType:"TRANSFUSION_ORDERED",payload:{kind:"ORDERED",patientId:b.patientId,bloodProduct:b.bloodProduct,units:b.units},occurredAt:b.occurredAt,topic:"transfusion.ordered"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({transfusionId:b.transfusionId,state:"ORDERED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,transfusionId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldTransfusion(await readAggregateEvents(ctx,transfusionId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Transfusion not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,transfusionId:string,folded:FoldedTransfusion,to:TransfusionState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:transfusionId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertTransfusionTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({transfusionId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleTransfusionCrossmatch(req:Request,transfusionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,transfusionId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,transfusionId,folded,"CROSSMATCHED","TRANSFUSION_CROSSMATCHED",{kind:"CROSSMATCHED"},b.occurredAt,"transfusion.crossmatched");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleTransfusionStart(req:Request,transfusionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,transfusionId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,transfusionId,folded,"TRANSFUSING","TRANSFUSION_STARTED",{kind:"STARTED"},b.occurredAt,"transfusion.started");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleTransfusionCompletion(req:Request,transfusionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,transfusionId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,transfusionId,folded,"COMPLETED","TRANSFUSION_COMPLETED",{kind:"COMPLETED"},b.occurredAt,"transfusion.completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const ReactionBody=z.object({reaction:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTransfusionReaction(req:Request,transfusionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,transfusionId);const b=await parseJson(req,ReactionBody);
  return await commit(ctx,idempotencyKey,expectedVersion,transfusionId,folded,"REACTION","TRANSFUSION_REACTION",{kind:"REACTION",reaction:b.reaction},b.occurredAt,"transfusion.reaction");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTransfusionCancellation(req:Request,transfusionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,transfusionId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,transfusionId,folded,"CANCELLED","TRANSFUSION_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"transfusion.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
