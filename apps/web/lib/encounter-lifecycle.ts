import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{z}from"zod";
import{type HttpTenantContext}from"../../../packages/http-principal/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldEncounter,assertTransition}from"../../../packages/encounter-fold/src";
import{runClinicalCommand,lookupReplay}from"./runtime/command";
import{readEncounterEvents}from"./runtime/event-store";
import{blockingObligations,countOpenCriticalResults,countOpenCriticalVitals}from"./runtime/read-models/follow-up";
import{buildCommand,requireMutationHeaders,replayStablePayload}from"./http-command";
import{endpoint}from"./http/endpoint";
import{physicianCredentials,assertPhysicianCredentials}from"./physician-profile-lifecycle";
// EPIC D — Ciclo de vida del encuentro sobre el kernel probado: assess (OPEN->READY_TO_SIGN)
// y sign (READY_TO_SIGN->SIGNED). Concurrencia optimista real (If-Match=version) e invariantes
// V2: Physician Control (solo un médico humano firma) y Zero Lost Follow-Up (no firmar con
// obligaciones críticas abiertas). Envelope determinista (idempotencia estilo Stripe).
// Lote 11 (ADR-0300): sesión, autorización y traducción de errores viven en `endpoint`; el envelope es `buildCommand`. El
// cuerpo de cada transición queda escrito a mano (parseo en línea con sus mensajes, respuesta con claves propias).
const AGG="Encounter";
// Physician Control: solo un médico con propósito de tratamiento escribe en el encuentro.
const WRITE={role:"PHYSICIAN",scope:"encounter:write",purpose:"TREATMENT"} as const;

const AssessBody=z.object({assessment:z.string().min(1),plan:z.string().min(1),occurredAt:z.string().datetime()});
// Auditoría L-03 — `contentHash`: huella (sha256 hex de `${assessment}\n${plan}`) del texto QUE EL MÉDICO TIENE EN PANTALLA al
// firmar. El servidor la compara con la del contenido persistido: si difieren, lo que se firmaría no es lo que el médico ve.
const SignBody=z.object({occurredAt:z.string().datetime(),contentHash:z.string().regex(/^[0-9a-f]{64}$/,"contentHash must be a sha256 hex digest")});
export function encounterContentHash(assessment:string,plan:string):string{return crypto.createHash("sha256").update(`${assessment}\n${plan}`).digest("hex");}

// Tras `endpoint`: cabeceras de mutación (428/400) y encuentro plegado (404). Lee con `readEncounterEvents` (el mismo SQL que
// `loadAggregate`, pero es la llamada que registra el oráculo del contrato HTTP).
async function load(req:Request,ctx:HttpTenantContext,encounterId:string){
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const events=await readEncounterEvents(ctx,encounterId);
 const folded=foldEncounter(events);
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Encounter not found");
 // La concurrencia optimista la impone el kernel (expectedVersion en aggregate_versions);
 // no se valida la versión aquí para no bloquear el replay idempotente de una transición.
 return{idempotencyKey,expectedVersion,folded};
}

export async function handleAssessment(req:Request,encounterId:string):Promise<Response>{
 return endpoint(req,WRITE,async({ctx})=>{
  const{idempotencyKey,expectedVersion,folded}=await load(req,ctx,encounterId);
  const parsed=AssessBody.safeParse(await req.json().catch(()=>{throw new ClinicalError("VALIDATION_ERROR","Body must be valid JSON");}));
  if(!parsed.success)throw new ClinicalError("VALIDATION_ERROR","Invalid assessment payload",{issues:parsed.error.issues.length});
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:encounterId,expectedVersion,eventType:"ENCOUNTER_ASSESSED",payload:{kind:"ASSESSED",assessment:parsed.data.assessment,plan:parsed.data.plan},occurredAt:parsed.data.occurredAt,topic:"encounter.assessed"});
  let result=await lookupReplay(ctx,cmd);
  if(!result){
   // Auditoría L-03: mientras la nota NO esté firmada el médico puede CORREGIRLA (nuevo evento ASSESSED, nueva versión). Antes
   // la re-valoración era ilegal, así que un cambio hecho tras "guardar" no tenía forma de llegar a lo que se firmaba.
   if(folded.status!=="READY_TO_SIGN")assertTransition(folded.status,"READY_TO_SIGN");
   result=await runClinicalCommand(ctx,cmd);
  }
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({encounterId,status:"READY_TO_SIGN",version:r.version,contentHash:encounterContentHash(parsed.data.assessment,parsed.data.plan),auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 });
}

export async function handleSignature(req:Request,encounterId:string):Promise<Response>{
 return endpoint(req,WRITE,async({claims,ctx})=>{
  const{idempotencyKey,expectedVersion,folded}=await load(req,ctx,encounterId);
  const parsed=SignBody.safeParse(await req.json().catch(()=>{throw new ClinicalError("VALIDATION_ERROR","Body must be valid JSON");}));
  if(!parsed.success)throw new ClinicalError("VALIDATION_ERROR","Invalid signature payload",{issues:parsed.error.issues.length});
  if(folded.assessment===undefined||folded.plan===undefined)throw new ClinicalError("SAFETY_BLOCKED","Encounter has no assessment to sign");
  const contentHash=encounterContentHash(folded.assessment,folded.plan);
  // Auditoría L-05: identidad legal del firmante (nombre y cédula) leída ANTES de construir el sello; sin ella no se firma.
  const cred=await physicianCredentials(ctx,claims);
  // Auditoría L-02 — la HORA DE FIRMA la pone el SERVIDOR. Antes era `occurredAt` del cliente: un reloj desajustado (o un
  // cliente manipulado) fechaba una nota médico-legal en el pasado o en el futuro, y esa hora entraba en el sello. La hora
  // del cliente se conserva solo como dato forense. Estable ante reintentos (ver replayStablePayload).
  // Physician Control: la firma la produce el médico humano autenticado (claims.sub), nunca IA.
  const payload=await replayStablePayload(ctx,idempotencyKey,encounterId,parsed.data,()=>{
   const signedAt=new Date().toISOString();
   return{kind:"SIGNED",authorId:claims.sub,signer:cred?{fullName:cred.fullName,cedulaProfesional:cred.cedulaProfesional}:undefined,contentHash,signedAt,signedAtSource:"SERVER",clientOccurredAt:parsed.data.occurredAt,signedVersion:expectedVersion,
    signatureDigest:crypto.createHash("sha256").update(`${encounterId}:${expectedVersion}:${contentHash}:${claims.sub}:${signedAt}`).digest("hex")};});
  const signedAt=String(payload["signedAt"]);const signatureDigest=String(payload["signatureDigest"]);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:encounterId,expectedVersion,eventType:"ENCOUNTER_SIGNED",payload,occurredAt:signedAt,topic:"encounter.signed"});
  let result=await lookupReplay(ctx,cmd);
  if(!result){
   // Orden de precondiciones: versión -> transición -> contenido -> lazo cerrado.
   if(expectedVersion!==folded.version)throw new ClinicalError("CONCURRENCY_CONFLICT","Encounter changed since last read",{expected:expectedVersion,actual:folded.version});
   assertTransition(folded.status,"SIGNED");
   if(parsed.data.contentHash!==contentHash)throw new ClinicalError("CONFLICT","El contenido en pantalla no coincide con la valoración guardada (SIGNED_CONTENT_MISMATCH). Guarde la valoración de nuevo y revise el texto antes de firmar.");
   assertPhysicianCredentials(cred); // L-05: sin cédula registrada no hay firma (428)
   // Zero Lost Follow-Up (auditoría L-01): no se firma con seguimientos URGENTES o VENCIDOS sin resolver, ni con resultados
   // críticos sin cerrar, ni con signos vitales críticos sin atender. Todo se deriva del stream de eventos.
   const[obligations,criticalResults,criticalVitals]=await Promise.all([blockingObligations(ctx,folded.patientId,signedAt),countOpenCriticalResults(ctx,folded.patientId),countOpenCriticalVitals(ctx,folded.patientId)]);
   const urgent=obligations.filter(o=>o.reason==="URGENT").length;const overdue=obligations.length-urgent;
   const totalCritical=obligations.length+criticalResults+criticalVitals;
   if(totalCritical>0){
    const parts=[urgent?`${urgent} seguimiento(s) URGENTE(S) sin resolver`:"",overdue?`${overdue} seguimiento(s) VENCIDO(S) sin resolver`:"",criticalResults?`${criticalResults} resultado(s) crítico(s) sin cerrar`:"",criticalVitals?`${criticalVitals} signo(s) vital(es) crítico(s) sin atender`:""].filter(Boolean);
    throw new ClinicalError("SAFETY_BLOCKED",`No se puede firmar: el paciente tiene ${totalCritical} pendiente(s) crítico(s) — ${parts.join(" · ")}. Resuélvalos (completar con evidencia o cancelar con motivo) y vuelva a firmar.`,
     {obligations:obligations.map(o=>({id:o.obligationId,reason:o.reason})),criticalResults,criticalVitals});
   }
   result=await runClinicalCommand(ctx,cmd);
  }
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({encounterId,status:"SIGNED",version:r.version,signatureDigest,contentHash,signedAt,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 });
}
