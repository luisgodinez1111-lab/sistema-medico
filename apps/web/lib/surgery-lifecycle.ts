import{z}from"zod";
import{foldSurgery,assertSurgeryTransition}from"../../../packages/surgery-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC AK — Ciclo de vida del caso quirúrgico: SCHEDULED -> TIMED_OUT -> IN_PROGRESS -> COMPLETED (o CANCELLED).
// Cirugía segura; agendar/time-out/iniciar/completar/cancelar exige scope surgery:write (physician control).
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const SURGERY={aggregateType:"Surgery",idField:"surgeryId",fold:foldSurgery,assertTransition:assertSurgeryTransition,notFound:"Surgery not found"} as const;
const WRITE={role:"PHYSICIAN",scope:"surgery:write",purpose:"TREATMENT"} as const;

export const ScheduleBody=z.object({surgeryId:z.string().uuid(),patientId:z.string().uuid(),procedure:z.string().min(1),laterality:z.enum(["LEFT","RIGHT","BILATERAL","NA"]),surgeon:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleSurgerySchedule(req:Request):Promise<Response>{
 return createCommand(req,WRITE,SURGERY,async({ctx})=>{
  const b=await parseJson(req,ScheduleBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.surgeryId,state:"SCHEDULED",eventType:"SURGERY_SCHEDULED",payload:{kind:"SCHEDULED",patientId:b.patientId,procedure:b.procedure,laterality:b.laterality,surgeon:b.surgeon},occurredAt:b.occurredAt,topic:"surgery.scheduled"};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleSurgeryTimeout(req:Request,surgeryId:string):Promise<Response>{
 return transitionCommand(req,WRITE,SURGERY,surgeryId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"TIMED_OUT",eventType:"SURGERY_TIMEOUT_COMPLETED",payload:{kind:"TIMEOUT_COMPLETED"},occurredAt:b.occurredAt,topic:"surgery.timeout_completed"};});
}
export async function handleSurgeryStart(req:Request,surgeryId:string):Promise<Response>{
 return transitionCommand(req,WRITE,SURGERY,surgeryId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"IN_PROGRESS",eventType:"SURGERY_STARTED",payload:{kind:"STARTED"},occurredAt:b.occurredAt,topic:"surgery.started"};});
}
export const CompleteBody=z.object({outcome:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleSurgeryCompletion(req:Request,surgeryId:string):Promise<Response>{
 return transitionCommand(req,WRITE,SURGERY,surgeryId,async()=>{const b=await parseJson(req,CompleteBody);
  return{to:"COMPLETED",eventType:"SURGERY_COMPLETED",payload:{kind:"COMPLETED",outcome:b.outcome},occurredAt:b.occurredAt,topic:"surgery.completed"};});
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleSurgeryCancellation(req:Request,surgeryId:string):Promise<Response>{
 return transitionCommand(req,WRITE,SURGERY,surgeryId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"CANCELLED",eventType:"SURGERY_CANCELLED",payload:{kind:"CANCELLED",reason:b.reason},occurredAt:b.occurredAt,topic:"surgery.cancelled"};});
}
