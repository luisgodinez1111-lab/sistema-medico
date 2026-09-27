import{z}from"zod";
import{foldTransfusion,assertTransfusionTransition}from"../../../packages/transfusion-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC AJ — Ciclo de vida de una transfusión: ORDERED -> CROSSMATCHED -> TRANSFUSING -> {COMPLETED, REACTION}.
// Medicina transfusional; ordenar/cruzar/iniciar/completar/reacción/cancelar exige scope transfusion:write.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const TRANSFUSION={aggregateType:"Transfusion",idField:"transfusionId",fold:foldTransfusion,assertTransition:assertTransfusionTransition,notFound:"Transfusion not found"} as const;
const WRITE={scope:"transfusion:write",purpose:"TREATMENT"} as const;

export const OrderBody=z.object({transfusionId:z.string().uuid(),patientId:z.string().uuid(),bloodProduct:z.enum(["PRBC","PLATELETS","FFP","CRYO","WHOLE_BLOOD"]),units:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTransfusionOrder(req:Request):Promise<Response>{
 return createCommand(req,WRITE,TRANSFUSION,async({ctx})=>{
  const b=await parseJson(req,OrderBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.transfusionId,state:"ORDERED",eventType:"TRANSFUSION_ORDERED",payload:{kind:"ORDERED",patientId:b.patientId,bloodProduct:b.bloodProduct,units:b.units},occurredAt:b.occurredAt,topic:"transfusion.ordered"};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleTransfusionCrossmatch(req:Request,transfusionId:string):Promise<Response>{
 return transitionCommand(req,WRITE,TRANSFUSION,transfusionId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"CROSSMATCHED",eventType:"TRANSFUSION_CROSSMATCHED",payload:{kind:"CROSSMATCHED"},occurredAt:b.occurredAt,topic:"transfusion.crossmatched"};});
}
export async function handleTransfusionStart(req:Request,transfusionId:string):Promise<Response>{
 return transitionCommand(req,WRITE,TRANSFUSION,transfusionId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"TRANSFUSING",eventType:"TRANSFUSION_STARTED",payload:{kind:"STARTED"},occurredAt:b.occurredAt,topic:"transfusion.started"};});
}
export async function handleTransfusionCompletion(req:Request,transfusionId:string):Promise<Response>{
 return transitionCommand(req,WRITE,TRANSFUSION,transfusionId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"COMPLETED",eventType:"TRANSFUSION_COMPLETED",payload:{kind:"COMPLETED"},occurredAt:b.occurredAt,topic:"transfusion.completed"};});
}
export const ReactionBody=z.object({reaction:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTransfusionReaction(req:Request,transfusionId:string):Promise<Response>{
 return transitionCommand(req,WRITE,TRANSFUSION,transfusionId,async()=>{const b=await parseJson(req,ReactionBody);
  return{to:"REACTION",eventType:"TRANSFUSION_REACTION",payload:{kind:"REACTION",reaction:b.reaction},occurredAt:b.occurredAt,topic:"transfusion.reaction"};});
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTransfusionCancellation(req:Request,transfusionId:string):Promise<Response>{
 return transitionCommand(req,WRITE,TRANSFUSION,transfusionId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"CANCELLED",eventType:"TRANSFUSION_CANCELLED",payload:{kind:"CANCELLED",reason:b.reason},occurredAt:b.occurredAt,topic:"transfusion.cancelled"};});
}
