import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldConsent,assertConsentTransition,type FoldedConsent,type ConsentState}from"../../../packages/consent-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,patientDemographics,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{isMinor}from"../../../packages/mx-identity/src";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC Z — Ciclo de vida de un consentimiento informado: DRAFTED -> PRESENTED -> {GRANTED, DECLINED}; GRANTED -> REVOKED.
// Registro clínico-legal (NOM-004 / aviso de privacidad). Redactar/presentar/registrar respuesta exige scope consent:write.
const AGG="Consent";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"consent:write",purpose:"TREATMENT"});
}

export const DraftBody=z.object({consentId:z.string().uuid(),patientId:z.string().uuid(),scopeType:z.enum(["TREATMENT","PROCEDURE","DATA_SHARING","RESEARCH","ANESTHESIA"]),documentRef:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleConsentDraft(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,DraftBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.consentId,expectedVersion:0,eventType:"CONSENT_DRAFTED",payload:{kind:"DRAFTED",patientId:b.patientId,scopeType:b.scopeType,documentRef:b.documentRef},occurredAt:b.occurredAt,topic:"consent.drafted"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({consentId:b.consentId,state:"DRAFTED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedConsent,ConsentState>({aggregateType:AGG,idKey:"consentId",notFound:"Consent not found",fold:foldConsent,assertTransition:assertConsentTransition,authz});
const loadForTransition=(req:Request,consentId:string)=>LIFECYCLE.loadForTransition(req,consentId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,consentId:string,folded:FoldedConsent,to:ConsentState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,consentId,folded,to,eventType,payload,occurredAt,topic);

// CON-01: al PRESENTAR se puede declarar la huella del documento mostrado; el otorgamiento la exige y la compara.
export const WhenBody=z.object({occurredAt:z.string().datetime(),documentHash:z.string().regex(/^[0-9a-f]{64}$/).optional()});
export async function handleConsentPresentation(req:Request,consentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,consentId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,consentId,folded,"PRESENTED","CONSENT_PRESENTED",
   {kind:"PRESENTED",...(b.documentHash?{documentHash:b.documentHash}:{})},b.occurredAt,"consent.presented");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// Auditoría 2026-09-19 (L-06): un MENOR de edad no otorga por sí mismo el consentimiento informado (LGS art. 81, RLGSMPSAM
// art. 81; NOM-004 numeral 10.1.1): firma el tutor o representante legal REGISTRADO en el expediente (`signerRole:
// "GUARDIAN"`, con el nombre del tutor). Sin tutor registrado -> 428 GUARDIAN_REQUIRED. Con edad desconocida (paciente sin
// alta demográfica) no se afirma la mayoría de edad: se registra con `ageUnverified:true` en el evento.
// Auditoría 2026-09-19, anexo R02a (CON-01) — QUÉ ES «FIRMAR» UN CONSENTIMIENTO AQUÍ.
//
// El defecto: la «firma» era `signerName`, un texto libre. Cualquiera con el scope podía escribir un nombre y el
// expediente quedaba con un consentimiento «otorgado» sin nada que lo respalde: ni el documento que se presentó, ni
// constancia de cómo se recabó, ni quién lo atestiguó. Para un consentimiento informado —que es la pieza médico-legal
// que autoriza un procedimiento (LGS art. 81; NOM-004 numeral 10.1)— eso no es una firma, es una afirmación.
//
// Lo que se exige ahora, y el porqué de cada campo:
//  · `documentHash`: huella SHA-256 del texto EXACTO que se le presentó al paciente. Sin ella no se puede demostrar
//    después QUÉ consintió; con ella, cualquier cambio posterior del documento es detectable. Se comprueba contra la
//    huella registrada al presentar el consentimiento: si no coincide, no se otorga (409).
//  · `method`: cómo se recabó — firma autógrafa en papel escaneado (`WET_SIGNATURE`), firma en pantalla
//    (`ELECTRONIC_SIGNATURE`), verbal con testigo (`VERBAL_WITNESSED`). Cada modalidad tiene exigencias distintas y la
//    diferencia importa: un consentimiento verbal SIN testigo no es admisible y aquí se rechaza.
//  · `signatureArtifactRef`: referencia al artefacto (imagen de la firma o PDF escaneado) en almacenamiento privado.
//    Obligatorio en las dos modalidades firmadas; en la verbal se exige `witnessName` en su lugar.
//  · La identidad del firmante NO se verifica contra ningún registro oficial: eso exige integración con RENAPO/INE y es
//    una decisión del dueño. Queda declarado en el evento (`signerIdentityVerified:false`) para no fingir lo contrario.
export const CONSENT_METHODS=["WET_SIGNATURE","ELECTRONIC_SIGNATURE","VERBAL_WITNESSED"] as const;
export const GrantBody=z.object({
 signerName:z.string().trim().min(1).max(160),
 signerRole:z.enum(["PATIENT","GUARDIAN"]).default("PATIENT"),
 documentHash:z.string().regex(/^[0-9a-f]{64}$/,"documentHash debe ser la huella sha256 del documento presentado"),
 method:z.enum(CONSENT_METHODS),
 signatureArtifactRef:z.string().trim().min(1).max(500).optional(),
 witnessName:z.string().trim().min(1).max(160).optional(),
 occurredAt:z.string().datetime(),
});
export async function handleConsentGrant(req:Request,consentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,consentId);const b=await parseJson(req,GrantBody);
  const demo=folded.patientId?await patientDemographics(ctx,folded.patientId):undefined;
  const minor=demo?.birthDate?isMinor(demo.birthDate,b.occurredAt):undefined;
  // CON-01: el documento otorgado debe ser el MISMO que se presentó.
  if(folded.documentHash&&folded.documentHash!==b.documentHash)
   throw new ClinicalError("CONFLICT","El documento que se firma no coincide con el que se presentó al paciente: preséntelo de nuevo y revíselo antes de otorgar",{conflictReason:"CONSENT_DOCUMENT_MISMATCH"});
  // CON-01: cada modalidad tiene su exigencia mínima. Un consentimiento verbal sin testigo no es admisible.
  if(b.method!=="VERBAL_WITNESSED"&&!b.signatureArtifactRef)
   throw new ClinicalError("VALIDATION_ERROR","Una firma autógrafa o electrónica exige el artefacto firmado (signatureArtifactRef)",{conflictReason:"SIGNATURE_ARTIFACT_REQUIRED"});
  if(b.method==="VERBAL_WITNESSED"&&!b.witnessName)
   throw new ClinicalError("VALIDATION_ERROR","Un consentimiento verbal exige el nombre de quien lo atestigua (witnessName)",{conflictReason:"WITNESS_REQUIRED"});
  const payload:Record<string,unknown>={kind:"GRANTED",signerName:b.signerName,signerRole:b.signerRole,
   documentHash:b.documentHash,method:b.method,
   ...(b.signatureArtifactRef?{signatureArtifactRef:b.signatureArtifactRef}:{}),
   ...(b.witnessName?{witnessName:b.witnessName}:{}),
   // Honestidad: la identidad del firmante no se verifica contra ningún registro oficial (decisión del dueño pendiente).
   signerIdentityVerified:false};
  if(minor===true){
   if(!demo?.guardian)throw new ClinicalError("PRECONDITION_REQUIRED","El paciente es menor de edad y no tiene tutor o representante legal registrado: regístrelo antes de recabar el consentimiento",{reason:"GUARDIAN_REQUIRED"});
   if(b.signerRole!=="GUARDIAN")throw new ClinicalError("VALIDATION_ERROR","El consentimiento de un menor lo firma su tutor o representante legal (signerRole GUARDIAN)");
   payload["guardian"]={name:demo.guardian.name,relationship:demo.guardian.relationship};
  }else if(minor===undefined)payload["ageUnverified"]=true;
  return await commit(ctx,idempotencyKey,expectedVersion,consentId,folded,"GRANTED","CONSENT_GRANTED",payload,b.occurredAt,"consent.granted");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
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
