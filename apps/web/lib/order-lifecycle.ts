import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldOrder,assertOrderTransition,type FoldedOrder}from"../../../packages/order-fold/src";
import{type OrderState}from"../../../packages/order-result-domain/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC M — Ciclo de vida de la orden clínica: DRAFT -> ORDERED -> FULFILLED (o CANCELLED).
// Physician Control: colocar/cumplir/cancelar una orden exige médico (scope order:write).
const AGG="ClinicalOrder";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{role:"PHYSICIAN",scope:"order:write",purpose:"TREATMENT"});
}

export const CreateBody=z.object({orderId:z.string().uuid(),patientId:z.string().uuid(),orderType:z.enum(["LAB","IMAGING","PATHOLOGY","PROCEDURE","REFERRAL"]),detail:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleOrderCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.orderId,expectedVersion:0,eventType:"ORDER_CREATED",payload:{kind:"CREATED",patientId:b.patientId,orderType:b.orderType,detail:b.detail},occurredAt:b.occurredAt,topic:"order.created"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({orderId:b.orderId,state:"DRAFT",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,orderId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldOrder(await readAggregateEvents(ctx,orderId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Order not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,orderId:string,folded:FoldedOrder,to:OrderState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:orderId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertOrderTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({orderId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleOrderPlacement(req:Request,orderId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"ORDERED","ORDER_PLACED",{kind:"PLACED"},b.occurredAt,"order.placed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleOrderFulfillment(req:Request,orderId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"FULFILLED","ORDER_FULFILLED",{kind:"FULFILLED"},b.occurredAt,"order.fulfilled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleOrderCancellation(req:Request,orderId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId);const b=await parseJson(req,CancelBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"CANCELLED","ORDER_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"order.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
