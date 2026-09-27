import{z}from"zod";
import{foldObligation,assertObligationTransition}from"../../../packages/obligation-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC O — Ciclo de vida de la obligación (seguimiento): OPEN -> IN_PROGRESS -> COMPLETED / CANCELLED.
// Completar exige EVIDENCIA (Zero Lost Follow-Up: nada se cierra sin constancia). Scope obligation:write.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const OBLIGATION={aggregateType:"ClinicalObligation",idField:"obligationId",fold:foldObligation,assertTransition:assertObligationTransition,notFound:"Obligation not found"} as const;
const WRITE={scope:"obligation:write",purpose:"TREATMENT"} as const;

// EPIC AS (profundidad): `sourceVitalId` opcional liga la obligación a un signo vital CRÍTICO. Al existir
// una obligación con este sourceVitalId, countOpenCriticalVitals deja de contar ese vital como "sin atender"
// (se cierra el lazo Zero Lost Follow-Up de vitales críticos y se desbloquea la firma del encuentro).
// Auditoría L-01: `priority` viaja en el evento (por defecto ROUTINE). URGENT sin resolver bloquea la firma; también cualquier
// obligación VENCIDA. `sourceResultId` liga la obligación al resultado crítico que la originó (trazabilidad del lazo).
export const CreateBody=z.object({obligationId:z.string().uuid(),patientId:z.string().uuid(),ownerId:z.string().uuid(),dueAt:z.string().datetime(),kind:z.string().min(1).max(200),
 priority:z.enum(["URGENT","HIGH","ROUTINE"]).default("ROUTINE"),sourceVitalId:z.string().uuid().optional(),sourceResultId:z.string().uuid().optional(),occurredAt:z.string().datetime()});
export async function handleObligationCreate(req:Request):Promise<Response>{
 return createCommand(req,WRITE,OBLIGATION,async({ctx})=>{
  const b=await parseJson(req,CreateBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const payload:Record<string,unknown>={kind:"CREATED",patientId:b.patientId,ownerId:b.ownerId,dueAt:b.dueAt,obligationKind:b.kind,priority:b.priority};
  if(b.sourceVitalId)payload["sourceVitalId"]=b.sourceVitalId;if(b.sourceResultId)payload["sourceResultId"]=b.sourceResultId;
  return{aggregateId:b.obligationId,state:"OPEN",eventType:"OBLIGATION_CREATED",payload,occurredAt:b.occurredAt,topic:"obligation.created",extra:{priority:b.priority}};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleObligationProgress(req:Request,obligationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,OBLIGATION,obligationId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"IN_PROGRESS",eventType:"OBLIGATION_STARTED",payload:{kind:"STARTED"},occurredAt:b.occurredAt,topic:"obligation.started"};});
}
// Completar EXIGE evidencia (constancia del seguimiento realizado).
export const CompleteBody=z.object({evidence:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleObligationCompletion(req:Request,obligationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,OBLIGATION,obligationId,async()=>{const b=await parseJson(req,CompleteBody);
  return{to:"COMPLETED",eventType:"OBLIGATION_COMPLETED",payload:{kind:"COMPLETED",evidence:b.evidence},occurredAt:b.occurredAt,topic:"obligation.completed"};});
}
export const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleObligationCancellation(req:Request,obligationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,OBLIGATION,obligationId,async()=>{const b=await parseJson(req,CancelBody);
  return{to:"CANCELLED",eventType:"OBLIGATION_CANCELLED",payload:{kind:"CANCELLED",reason:b.reason},occurredAt:b.occurredAt,topic:"obligation.cancelled"};});
}
