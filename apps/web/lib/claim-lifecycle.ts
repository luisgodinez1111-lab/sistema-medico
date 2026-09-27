import{z}from"zod";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldClaim,assertClaimTransition}from"../../../packages/claim-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
import{lookupIcd10,normalizeIcd10}from"../../../packages/terminology/src";
// EPIC AR (profundidad): los códigos de la reclamación se validan contra CIE-10 y se codifican con descripción canónica.
// EPIC Y — Ciclo de vida de una reclamación de facturación: DRAFT -> CODED -> SUBMITTED -> {PAID, REJECTED};
// REJECTED -> SUBMITTED (reenvío); anulable desde no-terminal. Seguimiento de estado, NO mueve dinero.
// Ciclo de ingresos: codificar/enviar/conciliar exige scope billing:write.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const CLAIM={aggregateType:"Claim",idField:"claimId",fold:foldClaim,assertTransition:assertClaimTransition,notFound:"Claim not found"} as const;
const WRITE={scope:"billing:write",purpose:"TREATMENT"} as const;

export const DraftBody=z.object({claimId:z.string().uuid(),patientId:z.string().uuid(),amount:z.string().min(1),currency:z.enum(["MXN","USD"]),occurredAt:z.string().datetime()});
export async function handleClaimDraft(req:Request):Promise<Response>{
 return createCommand(req,WRITE,CLAIM,async({ctx})=>{
  const b=await parseJson(req,DraftBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.claimId,state:"DRAFT",eventType:"CLAIM_DRAFTED",payload:{kind:"DRAFTED",patientId:b.patientId,amount:b.amount,currency:b.currency},occurredAt:b.occurredAt,topic:"claim.drafted"};
 });
}

export const CodeBody=z.object({codes:z.array(z.string().min(1)).min(1),occurredAt:z.string().datetime()});
export async function handleClaimCoding(req:Request,claimId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CLAIM,claimId,async()=>{const b=await parseJson(req,CodeBody);
  // Profundidad clínica: cada código debe existir en CIE-10; se codifica con su descripción canónica.
  const coded=b.codes.map(c=>{const e=lookupIcd10(c);if(!e)throw new ClinicalError("VALIDATION_ERROR","Código CIE-10 no válido o no reconocido",{code:c});return{code:normalizeIcd10(c),description:e.description};});
  return{to:"CODED",eventType:"CLAIM_CODED",payload:{kind:"CODED",codes:coded.map(x=>x.code),codeSystem:"ICD-10",coded},occurredAt:b.occurredAt,topic:"claim.coded"};});
}
export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleClaimSubmission(req:Request,claimId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CLAIM,claimId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"SUBMITTED",eventType:"CLAIM_SUBMITTED",payload:{kind:"SUBMITTED"},occurredAt:b.occurredAt,topic:"claim.submitted"};});
}
export const RefBody=z.object({reference:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleClaimPayment(req:Request,claimId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CLAIM,claimId,async()=>{const b=await parseJson(req,RefBody);
  return{to:"PAID",eventType:"CLAIM_PAID",payload:{kind:"PAID",reference:b.reference},occurredAt:b.occurredAt,topic:"claim.paid"};});
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleClaimRejection(req:Request,claimId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CLAIM,claimId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"REJECTED",eventType:"CLAIM_REJECTED",payload:{kind:"REJECTED",reason:b.reason},occurredAt:b.occurredAt,topic:"claim.rejected"};});
}
export async function handleClaimVoid(req:Request,claimId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CLAIM,claimId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"VOIDED",eventType:"CLAIM_VOIDED",payload:{kind:"VOIDED",reason:b.reason},occurredAt:b.occurredAt,topic:"claim.voided"};});
}
