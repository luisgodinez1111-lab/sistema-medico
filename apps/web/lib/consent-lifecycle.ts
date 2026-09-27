import{z}from"zod";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldConsent,assertConsentTransition}from"../../../packages/consent-fold/src";
import{patientDemographics,requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
import{isMinor}from"../../../packages/mx-identity/src";
// EPIC Z — Ciclo de vida de un consentimiento informado: DRAFTED -> PRESENTED -> {GRANTED, DECLINED}; GRANTED -> REVOKED.
// Registro clínico-legal (NOM-004 / aviso de privacidad). Redactar/presentar/registrar respuesta exige scope consent:write.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const CONSENT={aggregateType:"Consent",idField:"consentId",fold:foldConsent,assertTransition:assertConsentTransition,notFound:"Consent not found"} as const;
const WRITE={scope:"consent:write",purpose:"TREATMENT"} as const;

export const DraftBody=z.object({consentId:z.string().uuid(),patientId:z.string().uuid(),scopeType:z.enum(["TREATMENT","PROCEDURE","DATA_SHARING","RESEARCH","ANESTHESIA"]),documentRef:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleConsentDraft(req:Request):Promise<Response>{
 return createCommand(req,WRITE,CONSENT,async({ctx})=>{
  const b=await parseJson(req,DraftBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.consentId,state:"DRAFTED",eventType:"CONSENT_DRAFTED",payload:{kind:"DRAFTED",patientId:b.patientId,scopeType:b.scopeType,documentRef:b.documentRef},occurredAt:b.occurredAt,topic:"consent.drafted"};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleConsentPresentation(req:Request,consentId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CONSENT,consentId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"PRESENTED",eventType:"CONSENT_PRESENTED",payload:{kind:"PRESENTED"},occurredAt:b.occurredAt,topic:"consent.presented"};});
}
// Auditoría 2026-09-19 (L-06): un MENOR de edad no otorga por sí mismo el consentimiento informado (LGS art. 81, RLGSMPSAM
// art. 81; NOM-004 numeral 10.1.1): firma el tutor o representante legal REGISTRADO en el expediente (`signerRole:
// "GUARDIAN"`, con el nombre del tutor). Sin tutor registrado -> 428 GUARDIAN_REQUIRED. Con edad desconocida (paciente sin
// alta demográfica) no se afirma la mayoría de edad: se registra con `ageUnverified:true` en el evento.
export const GrantBody=z.object({signerName:z.string().min(1),signerRole:z.enum(["PATIENT","GUARDIAN"]).default("PATIENT"),occurredAt:z.string().datetime()});
export async function handleConsentGrant(req:Request,consentId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CONSENT,consentId,async({ctx,folded})=>{const b=await parseJson(req,GrantBody);
  const demo=folded.patientId?await patientDemographics(ctx,folded.patientId):undefined;
  const minor=demo?.birthDate?isMinor(demo.birthDate,b.occurredAt):undefined;
  const payload:Record<string,unknown>={kind:"GRANTED",signerName:b.signerName,signerRole:b.signerRole};
  if(minor===true){
   if(!demo?.guardian)throw new ClinicalError("PRECONDITION_REQUIRED","El paciente es menor de edad y no tiene tutor o representante legal registrado: regístrelo antes de recabar el consentimiento",{reason:"GUARDIAN_REQUIRED"});
   if(b.signerRole!=="GUARDIAN")throw new ClinicalError("VALIDATION_ERROR","El consentimiento de un menor lo firma su tutor o representante legal (signerRole GUARDIAN)");
   payload["guardian"]={name:demo.guardian.name,relationship:demo.guardian.relationship};
  }else if(minor===undefined)payload["ageUnverified"]=true;
  return{to:"GRANTED",eventType:"CONSENT_GRANTED",payload,occurredAt:b.occurredAt,topic:"consent.granted"};});
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleConsentDecline(req:Request,consentId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CONSENT,consentId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"DECLINED",eventType:"CONSENT_DECLINED",payload:{kind:"DECLINED",reason:b.reason},occurredAt:b.occurredAt,topic:"consent.declined"};});
}
export async function handleConsentRevocation(req:Request,consentId:string):Promise<Response>{
 return transitionCommand(req,WRITE,CONSENT,consentId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"REVOKED",eventType:"CONSENT_REVOKED",payload:{kind:"REVOKED",reason:b.reason},occurredAt:b.occurredAt,topic:"consent.revoked"};});
}
