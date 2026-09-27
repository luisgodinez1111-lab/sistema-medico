import{z}from"zod";
import{foldWound,assertWoundTransition}from"../../../packages/wound-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC AI — Ciclo de vida de una herida/UPP: OPEN -> {OPEN (re-valoración), HEALED, ESCALATED}.
// Cuidado de heridas; documentar/re-valorar/cerrar/escalar exige scope wound:write.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const WOUND={aggregateType:"Wound",idField:"woundId",fold:foldWound,assertTransition:assertWoundTransition,notFound:"Wound not found"} as const;
const STAGES=["STAGE_1","STAGE_2","STAGE_3","STAGE_4","UNSTAGEABLE","DTI"] as const;
const WRITE={scope:"wound:write",purpose:"TREATMENT"} as const;

export const DocumentBody=z.object({woundId:z.string().uuid(),patientId:z.string().uuid(),location:z.enum(["SACRUM","HEEL","ISCHIUM","TROCHANTER","OCCIPUT","ELBOW","OTHER"]),stage:z.enum(STAGES),occurredAt:z.string().datetime()});
export async function handleWoundDocument(req:Request):Promise<Response>{
 return createCommand(req,WRITE,WOUND,async({ctx})=>{
  const b=await parseJson(req,DocumentBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.woundId,state:"OPEN",eventType:"WOUND_DOCUMENTED",payload:{kind:"DOCUMENTED",patientId:b.patientId,location:b.location,stage:b.stage},occurredAt:b.occurredAt,topic:"wound.documented",extra:{stage:b.stage}};
 });
}

export const ReassessBody=z.object({stage:z.enum(STAGES),occurredAt:z.string().datetime()});
export async function handleWoundReassessment(req:Request,woundId:string):Promise<Response>{
 return transitionCommand(req,WRITE,WOUND,woundId,async()=>{const b=await parseJson(req,ReassessBody);
  return{to:"OPEN",eventType:"WOUND_REASSESSED",payload:{kind:"REASSESSED",stage:b.stage},occurredAt:b.occurredAt,topic:"wound.reassessed"};});
}
export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleWoundHealing(req:Request,woundId:string):Promise<Response>{
 return transitionCommand(req,WRITE,WOUND,woundId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"HEALED",eventType:"WOUND_HEALED",payload:{kind:"HEALED"},occurredAt:b.occurredAt,topic:"wound.healed"};});
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleWoundEscalation(req:Request,woundId:string):Promise<Response>{
 return transitionCommand(req,WRITE,WOUND,woundId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"ESCALATED",eventType:"WOUND_ESCALATED",payload:{kind:"ESCALATED",reason:b.reason},occurredAt:b.occurredAt,topic:"wound.escalated"};});
}
