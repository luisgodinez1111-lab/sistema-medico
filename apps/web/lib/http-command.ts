import crypto from"node:crypto";
import{isUuid}from"../../../packages/tenant-context/src";
import{type z}from"zod";
import{resolvePrincipal}from"../../../packages/http-principal/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{type ClinicalCommand,type ClinicalMultiCommand,type ClinicalLeg}from"../../../packages/atomic-clinical-transaction-v3/src";
export type{ClinicalMultiCommand,ClinicalLeg};
import{canonicalize,deterministicUuid}from"../../../packages/canonical-json/src";
import{type HttpTenantContext}from"../../../packages/http-principal/src";
import{sessionSecret,readEventPayloadById}from"./clinical-runtime";
// EPIC D/G — Helpers compartidos por los verticales que escriben comandos clínicos vía HTTP.
// Envelope determinista (idempotencia estilo Stripe) + concurrencia optimista vía If-Match.

// UUID determinista derivado del Idempotency-Key: un reintento reconstruye el mismo envelope.
// R01-015: el identificador se emite como UUID válido (versión 8 = derivado, variante RFC 9562), no como un corte crudo
// del hash; así cualquier validador (`z.string().uuid()`, la columna `uuid` de Postgres, un cliente externo) lo acepta.
export function derivedUuid(idempotencyKey:string,slot:string):string{
 return deterministicUuid(`${idempotencyKey}:${slot}`);
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
// Auditoría 2026-09-19, anexo R04 (R04-007) — VALIDACIÓN DEL FORMATO DE LOS IDS DE RUTA.
//
// El anexo: «IDs de ruta ([xxxId]) sin validar formato UUID antes de tocar el kernel: input mal formado produce un error
// del motor, no un 400». Medido: **0 de 126 rutas con parámetro lo validaban**. Un `patientId` con la forma
// `../../etc` o `1 OR 1=1` no es una fuga —el SQL va parametrizado y la RLS sigue puesta— pero llega al kernel y provoca
// un error de casteo de Postgres que sale como 500. Un 500 en un sistema clínico es una pantalla en blanco a media
// consulta, y además esconde el problema real: el cliente no sabe que mandó basura.
//
// Se valida en el BORDE, donde el dato entra, y con el mismo `isUuid` que usa el esquema de payload: una sola definición
// de qué es un UUID en todo el repositorio.
export async function pathIds<T extends Record<string,string>>(params:Promise<T>):Promise<T>{
 const p=await params;
 for(const[clave,valor]of Object.entries(p)){
  // Solo los parámetros que son identificadores de agregado. Un parámetro como `date` o `slug` no es un UUID.
  if(!/Id$/.test(clave))continue;
  if(typeof valor!=="string"||!isUuid(valor))
   throw new ClinicalError("VALIDATION_ERROR",`El identificador «${clave}» de la ruta no es un UUID válido.`,{pathParam:clave});
 }
 return p;
}
// Construye un ClinicalMultiCommand determinista (auditoría M4): varios eventos en UNA transacción bajo UNA llave. Los ids
// del envelope (commandId, auditId, correlationId) derivan de la llave; los de CADA leg (eventId, outboxId) derivan además
// del agregado del leg, así son distintos entre legs y estables ante reintentos. El orden de los legs es el de escritura.
// `eventId`/`outboxId` por leg: si no se dan, se derivan de (llave, agregado) —distintos entre legs, estables ante
// reintentos—. Se permiten EXPLÍCITOS cuando el payload del leg se estabilizó con `replayStablePayload`, que lee el evento
// persistido por un `eventId` concreto: el leg DEBE escribir con ese mismo id para que el reintento reencuentre su payload.
export function buildMultiCommand(a:{idempotencyKey:string;occurredAt:string;legs:ReadonlyArray<{aggregateType:string;aggregateId:string;expectedVersion:number;eventType:string;payload:unknown;topic:string;eventId?:string;outboxId?:string}>}):ClinicalMultiCommand{
 return{
  commandId:derivedUuid(a.idempotencyKey,"command"),idempotencyKey:a.idempotencyKey,
  auditId:derivedUuid(a.idempotencyKey,"audit"),correlationId:derivedUuid(a.idempotencyKey,"correlation"),occurredAt:a.occurredAt,
  legs:a.legs.map((l):ClinicalLeg=>({
   aggregateId:l.aggregateId,aggregateType:l.aggregateType,expectedVersion:l.expectedVersion,eventType:l.eventType,payload:l.payload,
   eventId:l.eventId??derivedUuid(a.idempotencyKey,`event:${l.aggregateId}`),outboxId:l.outboxId??derivedUuid(a.idempotencyKey,`outbox:${l.aggregateId}`),topic:l.topic,
  })),
 };
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
