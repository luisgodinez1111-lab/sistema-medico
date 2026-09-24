import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldReferral,assertReferralTransition,type FoldedReferral,type ReferralState}from"../../../packages/referral-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC T — Ciclo de vida de la interconsulta: REQUESTED -> ACCEPTED -> COMPLETED (o DECLINED/CANCELLED).
// Physician Control: solicitar/aceptar/declinar/completar/cancelar exige médico (scope referral:write).
const AGG="Referral";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{role:"PHYSICIAN",scope:"referral:write",purpose:"TREATMENT"});
}

export const CreateBody=z.object({referralId:z.string().uuid(),patientId:z.string().uuid(),specialty:z.string().min(1),reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleReferralRequest(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.referralId,expectedVersion:0,eventType:"REFERRAL_REQUESTED",payload:{kind:"REQUESTED",patientId:b.patientId,specialty:b.specialty,reason:b.reason},occurredAt:b.occurredAt,topic:"referral.requested"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({referralId:b.referralId,state:"REQUESTED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedReferral,ReferralState>({aggregateType:AGG,idKey:"referralId",notFound:"Referral not found",fold:foldReferral,assertTransition:assertReferralTransition,authz});
const loadForTransition=(req:Request,referralId:string)=>LIFECYCLE.loadForTransition(req,referralId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,referralId:string,folded:FoldedReferral,to:ReferralState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,referralId,folded,to,eventType,payload,occurredAt,topic);

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleReferralAcceptance(req:Request,referralId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,referralId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,referralId,folded,"ACCEPTED","REFERRAL_ACCEPTED",{kind:"ACCEPTED"},b.occurredAt,"referral.accepted");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleReferralCompletion(req:Request,referralId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,referralId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,referralId,folded,"COMPLETED","REFERRAL_COMPLETED",{kind:"COMPLETED"},b.occurredAt,"referral.completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleReferralDecline(req:Request,referralId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,referralId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,referralId,folded,"DECLINED","REFERRAL_DECLINED",{kind:"DECLINED",reason:b.reason},b.occurredAt,"referral.declined");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleReferralCancellation(req:Request,referralId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,referralId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,referralId,folded,"CANCELLED","REFERRAL_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"referral.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
