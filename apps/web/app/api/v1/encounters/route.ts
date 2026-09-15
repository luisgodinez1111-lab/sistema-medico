import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{z}from"zod";
import{resolvePrincipal}from"../../../../../../packages/http-principal/src";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../packages/runtime-errors/src";
import{type ClinicalCommand}from"../../../../../../packages/atomic-clinical-transaction-v3/src";
import{runClinicalCommand,readEncounter,sessionSecret}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
// EPIC B — Vertical clínico autenticado: abrir/leer un encuentro sobre el kernel probado.
// Autoridad: PROD (encuentro) -> ENG (kernel atómico + RLS) -> EXEC-0003 (authz server-side,
// no orphan, no PHI en telemetría). Fail-closed: sin sesión verificada no hay acceso.
export const runtime="nodejs";
export const dynamic="force-dynamic";

const OpenEncounter=z.object({
 encounterId:z.string().uuid(),
 patientId:z.string().uuid(),
 encounterClass:z.enum(["AMBULATORY","EMERGENCY","INPATIENT","VIRTUAL"]).optional(),
 // El cliente acuña la marca temporal lógica del evento; en un reintento reenvía el mismo
 // cuerpo + Idempotency-Key, de modo que el comando es idéntico byte-a-byte y el kernel lo
 // detecta como replay (no como divergencia).
 occurredAt:z.string().datetime(),
});
// UUID determinista derivado del Idempotency-Key: garantiza que un reintento reconstruya el
// mismo envelope de comando (mismo commandId/eventId/outboxId/auditId) => hash idéntico.
function derivedUuid(idempotencyKey:string,slot:string):string{
 const h=crypto.createHash("sha256").update(`${idempotencyKey}:${slot}`).digest("hex");
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

function principalFrom(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 return{tenantId:claims.tenantId,actorId:claims.sub,roles:claims.roles,scopes:claims.scopes,purpose:claims.purpose,sessionId:claims.sessionId};
}

export async function POST(req:Request){
 try{
  const requestId=req.headers.get("x-request-id")??crypto.randomUUID();
  const{claims,ctx}=resolvePrincipal(n=>req.headers.get(n),sessionSecret(),requestId);
  // Authz server-side: solo un médico con propósito de tratamiento abre encuentros.
  authorize(principalFrom(claims),{tenantId:claims.tenantId,role:"PHYSICIAN",scope:"encounter:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  let raw:unknown;
  try{raw=await req.json();}catch{throw new ClinicalError("VALIDATION_ERROR","Body must be valid JSON");}
  const parsed=OpenEncounter.safeParse(raw);
  if(!parsed.success)throw new ClinicalError("VALIDATION_ERROR","Invalid encounter payload",{issues:parsed.error.issues.length});
  const b=parsed.data;
  // Envelope determinista: todo se deriva del Idempotency-Key (o del cuerpo del cliente),
  // nada de aleatorio por-request, para que el reintento sea idempotente de verdad.
  const command:ClinicalCommand={
   commandId:derivedUuid(idempotencyKey,"command"),
   idempotencyKey,
   aggregateId:b.encounterId,
   aggregateType:"Encounter",
   expectedVersion:0,
   eventId:derivedUuid(idempotencyKey,"event"),
   eventType:"ENCOUNTER_OPENED",
   payload:{patientId:b.patientId,...(b.encounterClass?{encounterClass:b.encounterClass}:{})},
   outboxId:derivedUuid(idempotencyKey,"outbox"),
   topic:"encounter.opened",
   auditId:derivedUuid(idempotencyKey,"audit"),
   correlationId:derivedUuid(idempotencyKey,"correlation"),
   occurredAt:b.occurredAt,
  };
  const result=await runClinicalCommand(ctx,command);
  const r=result.response as{version:number;eventId:string;auditHash?:string};
  return NextResponse.json(
   {encounterId:b.encounterId,version:r.version,eventId:r.eventId,auditHash:r.auditHash,replayed:result.replayed},
   {status:result.replayed?200:201},
  );
 }catch(e){
  const h=toHttpError(e);
  return NextResponse.json(h.body,{status:h.status});
 }
}

export async function GET(req:Request){
 try{
  const requestId=req.headers.get("x-request-id")??crypto.randomUUID();
  const{claims,ctx}=resolvePrincipal(n=>req.headers.get(n),sessionSecret(),requestId);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"encounter:read",purpose:"TREATMENT"});
  const encounterId=new URL(req.url).searchParams.get("encounterId");
  if(!encounterId)throw new ClinicalError("VALIDATION_ERROR","encounterId query parameter required");
  const view=await readEncounter(ctx,encounterId);
  if(!view)throw new ClinicalError("NOT_FOUND","Encounter not found");
  return NextResponse.json(view,{status:200});
 }catch(e){
  const h=toHttpError(e);
  return NextResponse.json(h.body,{status:h.status});
 }
}
