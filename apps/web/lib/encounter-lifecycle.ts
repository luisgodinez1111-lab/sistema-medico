import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{z}from"zod";
import{resolvePrincipal}from"../../../packages/http-principal/src";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{type ClinicalCommand}from"../../../packages/atomic-clinical-transaction-v3/src";
import{foldEncounter,assertTransition}from"../../../packages/encounter-fold/src";
import{runClinicalCommand,lookupReplay,readEncounterEvents,countUnresolvedCriticalObligations,sessionSecret}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
// EPIC D — Ciclo de vida del encuentro sobre el kernel probado: assess (OPEN->READY_TO_SIGN)
// y sign (READY_TO_SIGN->SIGNED). Concurrencia optimista real (If-Match=version) e invariantes
// V2: Physician Control (solo un médico humano firma) y Zero Lost Follow-Up (no firmar con
// obligaciones críticas abiertas). Envelope determinista (idempotencia estilo Stripe).

function derivedUuid(idempotencyKey:string,slot:string):string{
 const h=crypto.createHash("sha256").update(`${idempotencyKey}:${slot}`).digest("hex");
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}
function principalFrom(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 return{tenantId:claims.tenantId,actorId:claims.sub,roles:claims.roles,scopes:claims.scopes,purpose:claims.purpose,sessionId:claims.sessionId};
}
function requireHeaders(req:Request){
 const idempotencyKey=req.headers.get("idempotency-key");
 if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
 const ifMatch=req.headers.get("if-match");
 if(!ifMatch)throw new ClinicalError("PRECONDITION_REQUIRED","If-Match header (expected version) required");
 const expectedVersion=Number(ifMatch);
 if(!Number.isInteger(expectedVersion)||expectedVersion<0)throw new ClinicalError("VALIDATION_ERROR","If-Match must be a non-negative integer version");
 return{idempotencyKey,expectedVersion};
}

const AssessBody=z.object({assessment:z.string().min(1),plan:z.string().min(1),occurredAt:z.string().datetime()});
const SignBody=z.object({occurredAt:z.string().datetime()});

async function build(req:Request,encounterId:string){
 const requestId=req.headers.get("x-request-id")??crypto.randomUUID();
 const{claims,ctx}=resolvePrincipal(n=>req.headers.get(n),sessionSecret(),requestId);
 // Physician Control: solo un médico con propósito de tratamiento escribe en el encuentro.
 authorize(principalFrom(claims),{tenantId:claims.tenantId,role:"PHYSICIAN",scope:"encounter:write",purpose:"TREATMENT"});
 const{idempotencyKey,expectedVersion}=requireHeaders(req);
 const events=await readEncounterEvents(ctx,encounterId);
 const folded=foldEncounter(events);
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Encounter not found");
 // La concurrencia optimista la impone el kernel (expectedVersion en aggregate_versions);
 // no se valida la versión aquí para no bloquear el replay idempotente de una transición.
 return{requestId,claims,ctx,idempotencyKey,expectedVersion,folded};
}
function baseCommand(idempotencyKey:string,encounterId:string,expectedVersion:number,eventType:string,payload:unknown,occurredAt:string,topic:string):ClinicalCommand{
 return{
  commandId:derivedUuid(idempotencyKey,"command"),idempotencyKey,aggregateId:encounterId,aggregateType:"Encounter",
  expectedVersion,eventId:derivedUuid(idempotencyKey,"event"),eventType,payload,
  outboxId:derivedUuid(idempotencyKey,"outbox"),topic,auditId:derivedUuid(idempotencyKey,"audit"),
  correlationId:derivedUuid(idempotencyKey,"correlation"),occurredAt,
 };
}

export async function handleAssessment(req:Request,encounterId:string):Promise<Response>{
 try{
  const{idempotencyKey,expectedVersion,ctx,folded}=await build(req,encounterId);
  const parsed=AssessBody.safeParse(await req.json().catch(()=>{throw new ClinicalError("VALIDATION_ERROR","Body must be valid JSON");}));
  if(!parsed.success)throw new ClinicalError("VALIDATION_ERROR","Invalid assessment payload",{issues:parsed.error.issues.length});
  const cmd=baseCommand(idempotencyKey,encounterId,expectedVersion,"ENCOUNTER_ASSESSED",{kind:"ASSESSED",assessment:parsed.data.assessment,plan:parsed.data.plan},parsed.data.occurredAt,"encounter.assessed");
  let result=await lookupReplay(ctx,cmd);
  if(!result){assertTransition(folded.status,"READY_TO_SIGN");result=await runClinicalCommand(ctx,cmd);}
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({encounterId,status:"READY_TO_SIGN",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

export async function handleSignature(req:Request,encounterId:string):Promise<Response>{
 try{
  const{idempotencyKey,expectedVersion,ctx,claims,folded}=await build(req,encounterId);
  const parsed=SignBody.safeParse(await req.json().catch(()=>{throw new ClinicalError("VALIDATION_ERROR","Body must be valid JSON");}));
  if(!parsed.success)throw new ClinicalError("VALIDATION_ERROR","Invalid signature payload",{issues:parsed.error.issues.length});
  if(folded.assessment===undefined||folded.plan===undefined)throw new ClinicalError("SAFETY_BLOCKED","Encounter has no assessment to sign");
  const signedAt=parsed.data.occurredAt;
  const contentHash=crypto.createHash("sha256").update(`${folded.assessment}\n${folded.plan}`).digest("hex");
  // Physician Control: la firma la produce el médico humano autenticado (claims.sub), nunca IA.
  const signatureDigest=crypto.createHash("sha256").update(`${encounterId}:${expectedVersion}:${contentHash}:${claims.sub}:${signedAt}`).digest("hex");
  const cmd=baseCommand(idempotencyKey,encounterId,expectedVersion,"ENCOUNTER_SIGNED",{kind:"SIGNED",authorId:claims.sub,contentHash,signatureDigest,signedAt},signedAt,"encounter.signed");
  let result=await lookupReplay(ctx,cmd);
  if(!result){
   assertTransition(folded.status,"SIGNED");
   // Zero Lost Follow-Up: no se firma con obligaciones críticas del paciente sin resolver.
   const critical=await countUnresolvedCriticalObligations(ctx,folded.patientId);
   if(critical>0)throw new ClinicalError("SAFETY_BLOCKED",`Cannot sign: ${critical} unresolved critical obligation(s)`);
   result=await runClinicalCommand(ctx,cmd);
  }
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({encounterId,status:"SIGNED",version:r.version,signatureDigest,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
