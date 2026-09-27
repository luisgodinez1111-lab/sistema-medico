import{z}from"zod";
import{parseJson}from"./http-command";
import{createCommand}from"./command/aggregate-command";
// EPIC AC — Obligaciones REGULATORIAS del consultorio (fiscales SAT, salud COFEPRIS, laborales, protección civil,
// administrativas). Dominio administrativo a nivel TENANT (no PHI, sin paciente), sobre el mismo kernel event-sourced.
// El estado (Al día / Próxima / Vencida / Vigente) NO se almacena: se COMPUTA de la fecha límite (determinista).
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, Idempotency-Key, kernel) vive en el pipeline.
const REGULATORY_OBLIGATION={aggregateType:"RegulatoryObligation",idField:"obligationId"} as const;
const CATEGORIES=["Fiscal (SAT)","Salud (COFEPRIS)","Laboral","Protección civil","Administrativa","Otros"] as const;
export const CreateBody=z.object({obligationId:z.string().uuid(),name:z.string().min(1),category:z.enum(CATEGORIES),periodicity:z.string().min(1),dueDate:z.string().optional(),occurredAt:z.string().datetime()});
export async function handleRegulatoryObligationCreate(req:Request):Promise<Response>{
 return createCommand(req,{scope:"obligation:write",purpose:"TREATMENT"},REGULATORY_OBLIGATION,async()=>{
  const b=await parseJson(req,CreateBody);
  return{aggregateId:b.obligationId,state:"CREATED",eventType:"REGULATORY_OBLIGATION_CREATED",payload:{kind:"CREATED",name:b.name,category:b.category,periodicity:b.periodicity,...(b.dueDate?{dueDate:b.dueDate}:{})},occurredAt:b.occurredAt,topic:"regulatory_obligation.created"};
 });
}
