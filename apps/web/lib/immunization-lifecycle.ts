import{z}from"zod";
import{foldImmunization,assertImmunizationTransition}from"../../../packages/immunization-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC V — Ciclo de vida de una vacuna: DUE -> {ADMINISTERED, REFUSED}; ADMINISTERED -> ADVERSE_EVENT.
// Enfermería/médico registran la cartilla (scope immunization:write).
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const IMMUNIZATION={aggregateType:"Immunization",idField:"immunizationId",fold:foldImmunization,assertTransition:assertImmunizationTransition,notFound:"Immunization not found"} as const;
const WRITE={scope:"immunization:write",purpose:"TREATMENT"} as const;

export const DueBody=z.object({immunizationId:z.string().uuid(),patientId:z.string().uuid(),vaccineCode:z.string().min(1),dose:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleImmunizationDue(req:Request):Promise<Response>{
 return createCommand(req,WRITE,IMMUNIZATION,async({ctx})=>{
  const b=await parseJson(req,DueBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.immunizationId,state:"DUE",eventType:"IMMUNIZATION_DUE",payload:{kind:"DUE",patientId:b.patientId,vaccineCode:b.vaccineCode,dose:b.dose},occurredAt:b.occurredAt,topic:"immunization.due"};
 });
}

export const AdminBody=z.object({lot:z.string().min(1),site:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleImmunizationAdministration(req:Request,immunizationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,IMMUNIZATION,immunizationId,async()=>{const b=await parseJson(req,AdminBody);
  return{to:"ADMINISTERED",eventType:"IMMUNIZATION_ADMINISTERED",payload:{kind:"ADMINISTERED",lot:b.lot,site:b.site},occurredAt:b.occurredAt,topic:"immunization.administered"};});
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleImmunizationRefusal(req:Request,immunizationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,IMMUNIZATION,immunizationId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"REFUSED",eventType:"IMMUNIZATION_REFUSED",payload:{kind:"REFUSED",reason:b.reason},occurredAt:b.occurredAt,topic:"immunization.refused"};});
}
export const AdverseBody=z.object({reaction:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleImmunizationAdverseEvent(req:Request,immunizationId:string):Promise<Response>{
 return transitionCommand(req,WRITE,IMMUNIZATION,immunizationId,async()=>{const b=await parseJson(req,AdverseBody);
  return{to:"ADVERSE_EVENT",eventType:"IMMUNIZATION_ADVERSE_EVENT",payload:{kind:"ADVERSE_EVENT",reaction:b.reaction},occurredAt:b.occurredAt,topic:"immunization.adverse_event"};});
}
