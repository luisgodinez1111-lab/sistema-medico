import{z}from"zod";
import{foldCarePlan,assertCarePlanTransition}from"../../../packages/careplan-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC X — Ciclo de vida de una meta de plan de cuidados: PROPOSED -> ACTIVE -> ACHIEVED;
// ACTIVE <-> ON_HOLD; cancelable desde no-terminal. Gestión de crónicos (scope careplan:write).
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const CAREPLAN={aggregateType:"CarePlan",idField:"carePlanId",fold:foldCarePlan,assertTransition:assertCarePlanTransition,notFound:"Care plan not found"} as const;
const WRITE={scope:"careplan:write",purpose:"TREATMENT"} as const;

export const ProposeBody=z.object({carePlanId:z.string().uuid(),patientId:z.string().uuid(),category:z.enum(["DIABETES","HYPERTENSION","OBESITY","CARDIOVASCULAR","MENTAL_HEALTH","PRENATAL","OTHER"]),goal:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleCarePlanPropose(req:Request):Promise<Response>{
 return createCommand(req,WRITE,CAREPLAN,async({ctx})=>{
  const b=await parseJson(req,ProposeBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.carePlanId,state:"PROPOSED",eventType:"CAREPLAN_PROPOSED",payload:{kind:"PROPOSED",patientId:b.patientId,category:b.category,goal:b.goal},occurredAt:b.occurredAt,topic:"careplan.proposed"};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleCarePlanActivation(req:Request,carePlanId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CAREPLAN,carePlanId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"ACTIVE",eventType:"CAREPLAN_ACTIVATED",payload:{kind:"ACTIVATED"},occurredAt:b.occurredAt,topic:"careplan.activated"};});
}
export async function handleCarePlanHold(req:Request,carePlanId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CAREPLAN,carePlanId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"ON_HOLD",eventType:"CAREPLAN_HELD",payload:{kind:"HELD"},occurredAt:b.occurredAt,topic:"careplan.held"};});
}
export async function handleCarePlanResume(req:Request,carePlanId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CAREPLAN,carePlanId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"ACTIVE",eventType:"CAREPLAN_RESUMED",payload:{kind:"RESUMED"},occurredAt:b.occurredAt,topic:"careplan.resumed"};});
}
export async function handleCarePlanAchievement(req:Request,carePlanId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CAREPLAN,carePlanId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"ACHIEVED",eventType:"CAREPLAN_ACHIEVED",payload:{kind:"ACHIEVED"},occurredAt:b.occurredAt,topic:"careplan.achieved"};});
}
export const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleCarePlanCancellation(req:Request,carePlanId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CAREPLAN,carePlanId,async()=>{const b=await parseJson(req,CancelBody);
  return{to:"CANCELLED",eventType:"CAREPLAN_CANCELLED",payload:{kind:"CANCELLED",reason:b.reason},occurredAt:b.occurredAt,topic:"careplan.cancelled"};});
}
