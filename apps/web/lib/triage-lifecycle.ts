import{z}from"zod";
import{foldTriage,assertTriageTransition}from"../../../packages/triage-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC AH — Ciclo de vida del triage: WAITING -> IN_TRIAGE -> TRIAGED (re-evaluable) -> CLOSED; o LWBS.
// Front-of-house de urgencias; arribar/iniciar/clasificar/cerrar/LWBS exige scope triage:write.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const TRIAGE={aggregateType:"Triage",idField:"triageId",fold:foldTriage,assertTransition:assertTriageTransition,notFound:"Triage not found"} as const;
const WRITE={scope:"triage:write",purpose:"TREATMENT"} as const;

export const ArriveBody=z.object({triageId:z.string().uuid(),patientId:z.string().uuid(),chiefComplaint:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTriageArrive(req:Request):Promise<Response>{
 return createCommand(req,WRITE,TRIAGE,async({ctx})=>{
  const b=await parseJson(req,ArriveBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.triageId,state:"WAITING",eventType:"TRIAGE_ARRIVED",payload:{kind:"ARRIVED",patientId:b.patientId,chiefComplaint:b.chiefComplaint},occurredAt:b.occurredAt,topic:"triage.arrived"};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleTriageStart(req:Request,triageId:string):Promise<Response>{
 return transitionCommand(req,WRITE,TRIAGE,triageId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"IN_TRIAGE",eventType:"TRIAGE_STARTED",payload:{kind:"TRIAGE_STARTED"},occurredAt:b.occurredAt,topic:"triage.started"};});
}
export const AssessBody=z.object({acuity:z.number().int().min(1).max(5),occurredAt:z.string().datetime()});
export async function handleTriageAssessment(req:Request,triageId:string):Promise<Response>{
 return transitionCommand(req,WRITE,TRIAGE,triageId,async()=>{const b=await parseJson(req,AssessBody);
  return{to:"TRIAGED",eventType:"TRIAGE_TRIAGED",payload:{kind:"TRIAGED",acuity:b.acuity},occurredAt:b.occurredAt,topic:"triage.triaged"};});
}
export async function handleTriageClosure(req:Request,triageId:string):Promise<Response>{
 return transitionCommand(req,WRITE,TRIAGE,triageId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"CLOSED",eventType:"TRIAGE_CLOSED",payload:{kind:"CLOSED"},occurredAt:b.occurredAt,topic:"triage.closed"};});
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTriageLwbs(req:Request,triageId:string):Promise<Response>{
 return transitionCommand(req,WRITE,TRIAGE,triageId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"LWBS",eventType:"TRIAGE_LWBS",payload:{kind:"LWBS",reason:b.reason},occurredAt:b.occurredAt,topic:"triage.lwbs"};});
}
