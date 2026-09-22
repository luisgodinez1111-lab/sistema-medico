import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldClaim,assertClaimTransition,type FoldedClaim,type ClaimState}from"../../../packages/claim-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{lookupIcd10,normalizeIcd10}from"../../../packages/terminology/src";
// EPIC AR (profundidad): los códigos de la reclamación se validan contra CIE-10 y se codifican con descripción canónica.
// EPIC Y — Ciclo de vida de una reclamación de facturación: DRAFT -> CODED -> SUBMITTED -> {PAID, REJECTED};
// REJECTED -> SUBMITTED (reenvío); anulable desde no-terminal. Seguimiento de estado, NO mueve dinero.
// Ciclo de ingresos: codificar/enviar/conciliar exige scope billing:write.
const AGG="Claim";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"billing:write",purpose:"TREATMENT"});
}

const DraftBody=z.object({claimId:z.string().uuid(),patientId:z.string().uuid(),amount:z.string().min(1),currency:z.enum(["MXN","USD"]),occurredAt:z.string().datetime()});
export async function handleClaimDraft(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,DraftBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.claimId,expectedVersion:0,eventType:"CLAIM_DRAFTED",payload:{kind:"DRAFTED",patientId:b.patientId,amount:b.amount,currency:b.currency},occurredAt:b.occurredAt,topic:"claim.drafted"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({claimId:b.claimId,state:"DRAFT",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,claimId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldClaim(await readAggregateEvents(ctx,claimId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Claim not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,claimId:string,folded:FoldedClaim,to:ClaimState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:claimId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertClaimTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({claimId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const CodeBody=z.object({codes:z.array(z.string().min(1)).min(1),occurredAt:z.string().datetime()});
export async function handleClaimCoding(req:Request,claimId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,claimId);const b=await parseJson(req,CodeBody);
  // Profundidad clínica: cada código debe existir en CIE-10; se codifica con su descripción canónica.
  const coded=b.codes.map(c=>{const e=lookupIcd10(c);if(!e)throw new ClinicalError("VALIDATION_ERROR","Código CIE-10 no válido o no reconocido",{code:c});return{code:normalizeIcd10(c),description:e.description};});
  return await commit(ctx,idempotencyKey,expectedVersion,claimId,folded,"CODED","CLAIM_CODED",{kind:"CODED",codes:coded.map(x=>x.code),codeSystem:"ICD-10",coded},b.occurredAt,"claim.coded");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleClaimSubmission(req:Request,claimId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,claimId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,claimId,folded,"SUBMITTED","CLAIM_SUBMITTED",{kind:"SUBMITTED"},b.occurredAt,"claim.submitted");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const RefBody=z.object({reference:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleClaimPayment(req:Request,claimId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,claimId);const b=await parseJson(req,RefBody);
  return await commit(ctx,idempotencyKey,expectedVersion,claimId,folded,"PAID","CLAIM_PAID",{kind:"PAID",reference:b.reference},b.occurredAt,"claim.paid");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleClaimRejection(req:Request,claimId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,claimId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,claimId,folded,"REJECTED","CLAIM_REJECTED",{kind:"REJECTED",reason:b.reason},b.occurredAt,"claim.rejected");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleClaimVoid(req:Request,claimId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,claimId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,claimId,folded,"VOIDED","CLAIM_VOIDED",{kind:"VOIDED",reason:b.reason},b.occurredAt,"claim.voided");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
