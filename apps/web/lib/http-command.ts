import crypto from"node:crypto";
import{type z}from"zod";
import{resolvePrincipal}from"../../../packages/http-principal/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{type ClinicalCommand}from"../../../packages/atomic-clinical-transaction-v3/src";
import{sessionSecret}from"./clinical-runtime";
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
export const SESSION_COOKIE="medos_session";
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
export async function parseJson<T>(req:Request,schema:z.ZodType<T>):Promise<T>{
 let raw:unknown;
 try{raw=await req.json();}catch{throw new ClinicalError("VALIDATION_ERROR","Body must be valid JSON");}
 const parsed=schema.safeParse(raw);
 if(!parsed.success)throw new ClinicalError("VALIDATION_ERROR","Invalid payload",{issues:parsed.error.issues.length});
 return parsed.data;
}
