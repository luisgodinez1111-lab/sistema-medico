import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldConsent,assertConsentTransition,type FoldedConsent,type ConsentState}from"../../../packages/consent-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,patientDemographics}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{isMinor}from"../../../packages/mx-identity/src";
// EPIC Z — Ciclo de vida de un consentimiento informado: DRAFTED -> PRESENTED -> {GRANTED, DECLINED}; GRANTED -> REVOKED.
// Registro clínico-legal (NOM-004 / aviso de privacidad). Redactar/presentar/registrar respuesta exige scope consent:write.
const AGG="Consent";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"consent:write",purpose:"TREATMENT"});
}

const DraftBody=z.object({consentId:z.string().uuid(),patientId:z.string().uuid(),scopeType:z.enum(["TREATMENT","PROCEDURE","DATA_SHARING","RESEARCH","ANESTHESIA"]),documentRef:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleConsentDraft(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,DraftBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.consentId,expectedVersion:0,eventType:"CONSENT_DRAFTED",payload:{kind:"DRAFTED",patientId:b.patientId,scopeType:b.scopeType,documentRef:b.documentRef},occurredAt:b.occurredAt,topic:"consent.drafted"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({consentId:b.consentId,state:"DRAFTED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,consentId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldConsent(await readAggregateEvents(ctx,consentId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Consent not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,consentId:string,folded:FoldedConsent,to:ConsentState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:consentId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertConsentTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({consentId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleConsentPresentation(req:Request,consentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,consentId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,consentId,folded,"PRESENTED","CONSENT_PRESENTED",{kind:"PRESENTED"},b.occurredAt,"consent.presented");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// Auditoría 2026-09-19 (L-06): un MENOR de edad no otorga por sí mismo el consentimiento informado (LGS art. 81, RLGSMPSAM
// art. 81; NOM-004 numeral 10.1.1): firma el tutor o representante legal REGISTRADO en el expediente (`signerRole:
// "GUARDIAN"`, con el nombre del tutor). Sin tutor registrado -> 428 GUARDIAN_REQUIRED. Con edad desconocida (paciente sin
// alta demográfica) no se afirma la mayoría de edad: se registra con `ageUnverified:true` en el evento.
const GrantBody=z.object({signerName:z.string().min(1),signerRole:z.enum(["PATIENT","GUARDIAN"]).default("PATIENT"),occurredAt:z.string().datetime()});
export async function handleConsentGrant(req:Request,consentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,consentId);const b=await parseJson(req,GrantBody);
  const demo=folded.patientId?await patientDemographics(ctx,folded.patientId):undefined;
  const minor=demo?.birthDate?isMinor(demo.birthDate,b.occurredAt):undefined;
  const payload:Record<string,unknown>={kind:"GRANTED",signerName:b.signerName,signerRole:b.signerRole};
  if(minor===true){
   if(!demo?.guardian)throw new ClinicalError("PRECONDITION_REQUIRED","El paciente es menor de edad y no tiene tutor o representante legal registrado: regístrelo antes de recabar el consentimiento",{reason:"GUARDIAN_REQUIRED"});
   if(b.signerRole!=="GUARDIAN")throw new ClinicalError("VALIDATION_ERROR","El consentimiento de un menor lo firma su tutor o representante legal (signerRole GUARDIAN)");
   payload["guardian"]={name:demo.guardian.name,relationship:demo.guardian.relationship};
  }else if(minor===undefined)payload["ageUnverified"]=true;
  return await commit(ctx,idempotencyKey,expectedVersion,consentId,folded,"GRANTED","CONSENT_GRANTED",payload,b.occurredAt,"consent.granted");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleConsentDecline(req:Request,consentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,consentId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,consentId,folded,"DECLINED","CONSENT_DECLINED",{kind:"DECLINED",reason:b.reason},b.occurredAt,"consent.declined");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleConsentRevocation(req:Request,consentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,consentId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,consentId,folded,"REVOKED","CONSENT_REVOKED",{kind:"REVOKED",reason:b.reason},b.occurredAt,"consent.revoked");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
