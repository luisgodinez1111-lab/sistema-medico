import{z}from"zod";
import{foldAllergy,assertAllergyTransition}from"../../../packages/allergy-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC R — Ciclo de vida de la alergia: RECORDED(ACTIVE) -> REFUTED / INACTIVE; INACTIVE -> ACTIVE.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const ALLERGY={aggregateType:"Allergy",idField:"allergyId",fold:foldAllergy,assertTransition:assertAllergyTransition,notFound:"Allergy not found"} as const;
const WRITE={scope:"allergy:write",purpose:"TREATMENT"} as const;
export const CreateBody=z.object({allergyId:z.string().uuid(),patientId:z.string().uuid(),substance:z.string().min(1),severity:z.enum(["MILD","MODERATE","SEVERE"]),reaction:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleAllergyCreate(req:Request):Promise<Response>{
 return createCommand(req,WRITE,ALLERGY,async({ctx})=>{
  const b=await parseJson(req,CreateBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.allergyId,state:"ACTIVE",eventType:"ALLERGY_RECORDED",payload:{kind:"RECORDED",patientId:b.patientId,substance:b.substance,severity:b.severity,reaction:b.reaction},occurredAt:b.occurredAt,topic:"allergy.recorded"};
 });
}
export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleAllergyRefutation(req:Request,allergyId:string):Promise<Response>{
 return transitionCommand(req,WRITE,ALLERGY,allergyId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"REFUTED",eventType:"ALLERGY_REFUTED",payload:{kind:"REFUTED"},occurredAt:b.occurredAt,topic:"allergy.refuted"};});
}
export async function handleAllergyInactivation(req:Request,allergyId:string):Promise<Response>{
 return transitionCommand(req,WRITE,ALLERGY,allergyId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"INACTIVE",eventType:"ALLERGY_INACTIVATED",payload:{kind:"INACTIVATED"},occurredAt:b.occurredAt,topic:"allergy.inactivated"};});
}
export async function handleAllergyReactivation(req:Request,allergyId:string):Promise<Response>{
 return transitionCommand(req,WRITE,ALLERGY,allergyId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"ACTIVE",eventType:"ALLERGY_REACTIVATED",payload:{kind:"REACTIVATED"},occurredAt:b.occurredAt,topic:"allergy.reactivated"};});
}
