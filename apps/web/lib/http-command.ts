import crypto from"node:crypto";
import{type z}from"zod";
import{resolvePrincipal}from"../../../packages/http-principal/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{type ClinicalCommand}from"../../../packages/atomic-clinical-transaction-v3/src";
import{canonicalize}from"../../../packages/canonical-json/src";
import{type HttpTenantContext}from"../../../packages/http-principal/src";
import{sessionSecret}from"./runtime/secrets";
import{readEventPayloadById}from"./runtime/event-store";
// EPIC D/G — Helpers compartidos por los verticales que escriben comandos clínicos vía HTTP.
// Envelope determinista (idempotencia estilo Stripe) + concurrencia optimista vía If-Match.

// UUID determinista derivado del Idempotency-Key: un reintento reconstruye el mismo envelope.
export function derivedUuid(idempotencyKey:string,slot:string):string{
 const h=crypto.createHash("sha256").update(`${idempotencyKey}:${slot}`).digest("hex");
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}
export function principalFrom(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 return{tenantId:claims.tenantId,actorId:claims.sub,roles:claims.roles,scopes:claims.scopes,purpose:claims.purpose,sessionId:claims.sessionId};
}
export function requireMutationHeaders(req:Request){
 const idempotencyKey=req.headers.get("idempotency-key");
 if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
 const ifMatch=req.headers.get("if-match");
 if(!ifMatch)throw new ClinicalError("PRECONDITION_REQUIRED","If-Match header (expected version) required");
 const expectedVersion=Number(ifMatch);
 if(!Number.isInteger(expectedVersion)||expectedVersion<0)throw new ClinicalError("VALIDATION_ERROR","If-Match must be a non-negative integer version");
 return{idempotencyKey,expectedVersion};
}
// EPIC L (hardening) — la sesión viaja en una cookie httpOnly; el header Authorization: Bearer
// se mantiene como fallback (scripts/API). El nombre del cookie es único.
import{SESSION_COOKIE}from"./session-cookie-name";
export{SESSION_COOKIE};
function cookieValue(cookieHeader:string|null,name:string):string|undefined{
 if(!cookieHeader)return undefined;
 for(const part of cookieHeader.split(";")){const i=part.indexOf("=");if(i<0)continue;const k=part.slice(0,i).trim();if(k===name)return decodeURIComponent(part.slice(i+1).trim());}
 return undefined;
}
// Lector de headers que resuelve `authorization` desde el header o, si falta, desde el cookie.
export function readerFor(req:Request):(name:string)=>string|null|undefined{
 const cookieTok=cookieValue(req.headers.get("cookie"),SESSION_COOKIE);
 return(name:string)=>{
  if(name.toLowerCase()==="authorization"){const h=req.headers.get("authorization");if(h)return h;if(cookieTok)return `Bearer ${cookieTok}`;return null;}
  return req.headers.get(name);
 };
}
export function resolveVerified(req:Request){
 const requestId=req.headers.get("x-request-id")??crypto.randomUUID();
 return resolvePrincipal(readerFor(req),sessionSecret(),requestId);
}
// Construye un ClinicalCommand determinista para un agregado dado.
export function buildCommand(a:{idempotencyKey:string;aggregateType:string;aggregateId:string;expectedVersion:number;eventType:string;payload:unknown;occurredAt:string;topic:string}):ClinicalCommand{
 return{
  commandId:derivedUuid(a.idempotencyKey,"command"),idempotencyKey:a.idempotencyKey,aggregateId:a.aggregateId,aggregateType:a.aggregateType,
  expectedVersion:a.expectedVersion,eventId:derivedUuid(a.idempotencyKey,"event"),eventType:a.eventType,payload:a.payload,
  outboxId:derivedUuid(a.idempotencyKey,"outbox"),topic:a.topic,auditId:derivedUuid(a.idempotencyKey,"audit"),
  correlationId:derivedUuid(a.idempotencyKey,"correlation"),occurredAt:a.occurredAt,
 };
}
// PAYLOAD ESTABLE ANTE REINTENTOS (auditoría L-02/L-04). El kernel decide el replay comparando el hash del comando COMPLETO.
// Cuando el payload lleva valores que pone el SERVIDOR (hora de firma, resumen de barreras, valores previos), un reintento
// los recalcula distintos, el hash no coincide y un reintento legítimo acaba en conflicto en vez de devolver la respuesta
// original. Como el id del evento es determinista respecto de la llave, si esa llave YA produjo su evento se reutiliza
// exactamente su payload. `requestDigest` (huella del cuerpo del cliente) conserva la regla "misma llave + petición distinta
// = conflicto": sin ella, un segundo cuerpo distinto recibiría en silencio la respuesta del primero.
export async function replayStablePayload(ctx:HttpTenantContext,idempotencyKey:string,aggregateId:string,clientBody:unknown,build:()=>Record<string,unknown>):Promise<Record<string,unknown>>{
 const requestDigest=crypto.createHash("sha256").update(canonicalize(clientBody)).digest("hex");
 const prior=await readEventPayloadById(ctx,derivedUuid(idempotencyKey,"event"),aggregateId);
 if(prior){
  if(prior["requestDigest"]!==requestDigest)throw new ClinicalError("IDEMPOTENCY_CONFLICT","Idempotency-Key reused with a different request");
  return prior;
 }
 return{...stripUndefined(build()),requestDigest};
}
// JSONB no guarda claves `undefined`: si el primer intento las llevara, el payload leído en el reintento ya no sería idéntico.
function stripUndefined<T>(v:T):T{
 if(Array.isArray(v))return v.map(stripUndefined) as unknown as T;
 if(v!==null&&typeof v==="object")return Object.fromEntries(Object.entries(v as Record<string,unknown>).filter(([,x])=>x!==undefined).map(([k,x])=>[k,stripUndefined(x)])) as T;
 return v;
}
export async function parseJson<T>(req:Request,schema:z.ZodType<T>):Promise<T>{
 let raw:unknown;
 try{raw=await req.json();}catch{throw new ClinicalError("VALIDATION_ERROR","Body must be valid JSON");}
 const parsed=schema.safeParse(raw);
 if(!parsed.success)throw new ClinicalError("VALIDATION_ERROR","Invalid payload",{issues:parsed.error.issues.length});
 return parsed.data;
}
