import{z}from"zod";
import{foldOrder,assertOrderTransition}from"../../../packages/order-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC M — Ciclo de vida de la orden clínica: DRAFT -> ORDERED -> FULFILLED (o CANCELLED).
// Physician Control: colocar/cumplir/cancelar una orden exige médico (scope order:write).
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const ORDER={aggregateType:"ClinicalOrder",idField:"orderId",fold:foldOrder,assertTransition:assertOrderTransition,notFound:"Order not found"} as const;
const WRITE={role:"PHYSICIAN",scope:"order:write",purpose:"TREATMENT"} as const;

export const CreateBody=z.object({orderId:z.string().uuid(),patientId:z.string().uuid(),orderType:z.enum(["LAB","IMAGING","PATHOLOGY","PROCEDURE","REFERRAL"]),detail:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleOrderCreate(req:Request):Promise<Response>{
 return createCommand(req,WRITE,ORDER,async({ctx})=>{
  const b=await parseJson(req,CreateBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.orderId,state:"DRAFT",eventType:"ORDER_CREATED",payload:{kind:"CREATED",patientId:b.patientId,orderType:b.orderType,detail:b.detail},occurredAt:b.occurredAt,topic:"order.created"};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleOrderPlacement(req:Request,orderId:string):Promise<Response>{
 return transitionCommand(req,WRITE,ORDER,orderId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"ORDERED",eventType:"ORDER_PLACED",payload:{kind:"PLACED"},occurredAt:b.occurredAt,topic:"order.placed"};});
}
export async function handleOrderFulfillment(req:Request,orderId:string):Promise<Response>{
 return transitionCommand(req,WRITE,ORDER,orderId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"FULFILLED",eventType:"ORDER_FULFILLED",payload:{kind:"FULFILLED"},occurredAt:b.occurredAt,topic:"order.fulfilled"};});
}
export const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleOrderCancellation(req:Request,orderId:string):Promise<Response>{
 return transitionCommand(req,WRITE,ORDER,orderId,async()=>{const b=await parseJson(req,CancelBody);
  return{to:"CANCELLED",eventType:"ORDER_CANCELLED",payload:{kind:"CANCELLED",reason:b.reason},occurredAt:b.occurredAt,topic:"order.cancelled"};});
}
