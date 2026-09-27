import{z}from"zod";
import{foldDialysis,assertDialysisTransition}from"../../../packages/dialysis-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC AL — Ciclo de vida de una sesión de diálisis: SCHEDULED -> IN_SESSION -> {COMPLETED, INTERRUPTED};
// INTERRUPTED -> reanudar/completar. Cuidado renal crónico; agendar/iniciar/... exige scope dialysis:write.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const DIALYSIS={aggregateType:"Dialysis",idField:"dialysisId",fold:foldDialysis,assertTransition:assertDialysisTransition,notFound:"Dialysis session not found"} as const;
const WRITE={scope:"dialysis:write",purpose:"TREATMENT"} as const;

export const ScheduleBody=z.object({dialysisId:z.string().uuid(),patientId:z.string().uuid(),modality:z.enum(["HEMODIALYSIS","PERITONEAL","HEMOFILTRATION"]),accessType:z.enum(["FISTULA","GRAFT","CATHETER","PERITONEAL_CATHETER"]),occurredAt:z.string().datetime()});
export async function handleDialysisSchedule(req:Request):Promise<Response>{
 return createCommand(req,WRITE,DIALYSIS,async({ctx})=>{
  const b=await parseJson(req,ScheduleBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.dialysisId,state:"SCHEDULED",eventType:"DIALYSIS_SCHEDULED",payload:{kind:"SCHEDULED",patientId:b.patientId,modality:b.modality,accessType:b.accessType},occurredAt:b.occurredAt,topic:"dialysis.scheduled"};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleDialysisStart(req:Request,dialysisId:string):Promise<Response>{
 return transitionCommand(req,WRITE,DIALYSIS,dialysisId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"IN_SESSION",eventType:"DIALYSIS_STARTED",payload:{kind:"STARTED"},occurredAt:b.occurredAt,topic:"dialysis.started"};});
}
export async function handleDialysisResumption(req:Request,dialysisId:string):Promise<Response>{
 return transitionCommand(req,WRITE,DIALYSIS,dialysisId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"IN_SESSION",eventType:"DIALYSIS_RESUMED",payload:{kind:"RESUMED"},occurredAt:b.occurredAt,topic:"dialysis.resumed"};});
}
export async function handleDialysisCompletion(req:Request,dialysisId:string):Promise<Response>{
 return transitionCommand(req,WRITE,DIALYSIS,dialysisId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"COMPLETED",eventType:"DIALYSIS_COMPLETED",payload:{kind:"COMPLETED"},occurredAt:b.occurredAt,topic:"dialysis.completed"};});
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleDialysisInterruption(req:Request,dialysisId:string):Promise<Response>{
 return transitionCommand(req,WRITE,DIALYSIS,dialysisId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"INTERRUPTED",eventType:"DIALYSIS_INTERRUPTED",payload:{kind:"INTERRUPTED",reason:b.reason},occurredAt:b.occurredAt,topic:"dialysis.interrupted"};});
}
export async function handleDialysisCancellation(req:Request,dialysisId:string):Promise<Response>{
 return transitionCommand(req,WRITE,DIALYSIS,dialysisId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"CANCELLED",eventType:"DIALYSIS_CANCELLED",payload:{kind:"CANCELLED",reason:b.reason},occurredAt:b.occurredAt,topic:"dialysis.cancelled"};});
}
export async function handleDialysisNoShow(req:Request,dialysisId:string):Promise<Response>{
 return transitionCommand(req,WRITE,DIALYSIS,dialysisId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"NO_SHOW",eventType:"DIALYSIS_NO_SHOW",payload:{kind:"NO_SHOW"},occurredAt:b.occurredAt,topic:"dialysis.no_show"};});
}
