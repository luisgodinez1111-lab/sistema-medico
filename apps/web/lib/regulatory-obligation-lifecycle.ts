import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{runClinicalCommand}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,resolveVerified,parseJson}from"./http-command";
// EPIC AC — Obligaciones REGULATORIAS del consultorio (fiscales SAT, salud COFEPRIS, laborales, protección civil,
// administrativas). Dominio administrativo a nivel TENANT (no PHI, sin paciente), sobre el mismo kernel event-sourced.
// El estado (Al día / Próxima / Vencida / Vigente) NO se almacena: se COMPUTA de la fecha límite (determinista).
const AGG="RegulatoryObligation";
const CATEGORIES=["Fiscal (SAT)","Salud (COFEPRIS)","Laboral","Protección civil","Administrativa","Otros"] as const;
const CreateBody=z.object({obligationId:z.string().uuid(),name:z.string().min(1),category:z.enum(CATEGORIES),periodicity:z.string().min(1),dueDate:z.string().optional(),occurredAt:z.string().datetime()});
export async function handleRegulatoryObligationCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"obligation:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.obligationId,expectedVersion:0,eventType:"REGULATORY_OBLIGATION_CREATED",payload:{kind:"CREATED",name:b.name,category:b.category,periodicity:b.periodicity,...(b.dueDate?{dueDate:b.dueDate}:{})},occurredAt:b.occurredAt,topic:"regulatory_obligation.created"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({obligationId:b.obligationId,state:"CREATED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
