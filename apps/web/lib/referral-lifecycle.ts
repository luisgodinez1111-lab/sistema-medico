import{z}from"zod";
import{foldReferral,assertReferralTransition}from"../../../packages/referral-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC T — Ciclo de vida de la interconsulta: REQUESTED -> ACCEPTED -> COMPLETED (o DECLINED/CANCELLED).
// Physician Control: solicitar/aceptar/declinar/completar/cancelar exige médico (scope referral:write).
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const REFERRAL={aggregateType:"Referral",idField:"referralId",fold:foldReferral,assertTransition:assertReferralTransition,notFound:"Referral not found"} as const;
const WRITE={role:"PHYSICIAN",scope:"referral:write",purpose:"TREATMENT"} as const;

export const CreateBody=z.object({referralId:z.string().uuid(),patientId:z.string().uuid(),specialty:z.string().min(1),reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleReferralRequest(req:Request):Promise<Response>{
 return createCommand(req,WRITE,REFERRAL,async({ctx})=>{
  const b=await parseJson(req,CreateBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.referralId,state:"REQUESTED",eventType:"REFERRAL_REQUESTED",payload:{kind:"REQUESTED",patientId:b.patientId,specialty:b.specialty,reason:b.reason},occurredAt:b.occurredAt,topic:"referral.requested"};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleReferralAcceptance(req:Request,referralId:string):Promise<Response>{
 return transitionCommand(req,WRITE,REFERRAL,referralId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"ACCEPTED",eventType:"REFERRAL_ACCEPTED",payload:{kind:"ACCEPTED"},occurredAt:b.occurredAt,topic:"referral.accepted"};});
}
export async function handleReferralCompletion(req:Request,referralId:string):Promise<Response>{
 return transitionCommand(req,WRITE,REFERRAL,referralId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"COMPLETED",eventType:"REFERRAL_COMPLETED",payload:{kind:"COMPLETED"},occurredAt:b.occurredAt,topic:"referral.completed"};});
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleReferralDecline(req:Request,referralId:string):Promise<Response>{
 return transitionCommand(req,WRITE,REFERRAL,referralId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"DECLINED",eventType:"REFERRAL_DECLINED",payload:{kind:"DECLINED",reason:b.reason},occurredAt:b.occurredAt,topic:"referral.declined"};});
}
export async function handleReferralCancellation(req:Request,referralId:string):Promise<Response>{
 return transitionCommand(req,WRITE,REFERRAL,referralId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"CANCELLED",eventType:"REFERRAL_CANCELLED",payload:{kind:"CANCELLED",reason:b.reason},occurredAt:b.occurredAt,topic:"referral.cancelled"};});
}
