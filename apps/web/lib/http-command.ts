import crypto from"node:crypto";
import{isUuid}from"../../../packages/tenant-context/src";
import{type z}from"zod";
import{resolvePrincipal}from"../../../packages/http-principal/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{type ClinicalCommand}from"../../../packages/atomic-clinical-transaction-v3/src";
import{canonicalize,deterministicUuid}from"../../../packages/canonical-json/src";
import{type HttpTenantContext}from"../../../packages/http-principal/src";
import{sessionSecret,readEventPayloadById,readEventById,lookupReplay}from"./clinical-runtime";
import{isKernelRejection}from"./http-errors";
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
// Hallazgo D7 — CONCURRENCIA OPTIMISTA ESTRICTA, escrita una sola vez. La máquina de estados y las reglas de dominio se evalúan
// sobre la versión que el servidor leyó; el kernel exige If-Match. Si difieren, las reglas se habrían evaluado sobre un estado
// que no es el que el cliente vio: un If-Match desfasado respondía un CONFLICT de máquina de estados engañoso y, con un If-Match
// ADELANTADO y un escritor concurrente, se persistía una transición ilegal (alergia INACTIVE -> REFUTED). Se llama SOLO en el
// camino sin replay (tras `lookupReplay`: un reintento ya aplicado no se re-evalúa) y ANTES de cualquier regla.
export function assertReadVersion(changed:string,expected:number,actual:number):void{
 if(expected!==actual)throw new ClinicalError("CONCURRENCY_CONFLICT",changed,{expected,actual});
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
  // `isUuid` recorta espacios (el esquema de payload los tolera); un id de RUTA con espacios alrededor no se normaliza en
  // silencio: llegaría tal cual a la columna uuid (22P02 -> 500). Se rechaza (hallazgo D8).
  if(typeof valor!=="string"||valor!==valor.trim()||!isUuid(valor))
   throw new ClinicalError("VALIDATION_ERROR",`El identificador «${clave}» de la ruta no es un UUID válido.`,{pathParam:clave});
 }
 return p;
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
// Porte del hallazgo D6 — REINTENTO de un comando con efectos externos (Blob), reconocido ANTES de tocarlos. Si esta llave ya
// produjo su evento, se reconstruye el comando exacto que se ejecutó (versión = secuencia − 1, mismo payload y la misma hora,
// que el payload guarda en `at`) y se devuelve la respuesta que el kernel guardó; si la llave se usó para otro comando,
// IDEMPOTENCY_CONFLICT. Antes el reintento volvía a subir el archivo, el kernel lo rechazaba (la hora del servidor entra en el
// hash) y la limpieza borraba el blob que el evento ya confirmado seguía citando; una retirada ya aplicada respondía 404.
// Requisito: el payload no lleva claves `undefined` (JSONB no las guarda) y `occurredAt` es exactamente `payload[at]`.
export type PriorCommand=Readonly<{payload:Record<string,unknown>;version:number;auditHash?:string}>;
export async function priorCommand(ctx:HttpTenantContext,a:Readonly<{idempotencyKey:string;aggregateType:string;aggregateId:string;eventType:string;topic:string;at:string}>):Promise<PriorCommand|undefined>{
 const prior=await readEventById(ctx,derivedUuid(a.idempotencyKey,"event"),a.aggregateId);
 if(!prior)return undefined;
 const cmd=buildCommand({idempotencyKey:a.idempotencyKey,aggregateType:a.aggregateType,aggregateId:a.aggregateId,expectedVersion:prior.sequence-1,eventType:a.eventType,payload:prior.payload,occurredAt:String(prior.payload[a.at]??""),topic:a.topic});
 const replay=await lookupReplay(ctx,cmd);
 if(!replay)throw new ClinicalError("IDEMPOTENCY_CONFLICT","Idempotency-Key reused with a different request");
 const r=replay.response as{version:number;auditHash?:string};
 return{payload:prior.payload,version:r.version,...(r.auditHash!==undefined?{auditHash:r.auditHash}:{})};
}
// ¿Algún evento confirmado cita este blob? Solo el evento de ESTA llave podría (las rutas son únicas por intento). Si no se
// puede comprobar, se responde que sí: un blob huérfano es preferible a un evento que cite un binario borrado.
async function blobReferenced(ctx:HttpTenantContext,idempotencyKey:string,aggregateId:string,pathname:string):Promise<boolean>{
 return readEventById(ctx,derivedUuid(idempotencyKey,"event"),aggregateId).then(e=>e?.payload["pathname"]===pathname,()=>true);
}
// Porte del hallazgo D6 — SUBIDA AL BLOB + EVENTO que la cita, en un solo sitio (adjuntos y perfil del médico). No depende de
// @vercel/blob: subir y descartar los pasa el caso de uso.
//  1) replay primero, antes de subir nada; 2) subida a una ruta ÚNICA por intento; 3) commit del evento;
//  4) si el commit falla por un rechazo DEFINITIVO (ClinicalError que no sea DEPENDENCY_UNAVAILABLE, o un rechazo del kernel
//     —`isKernelRejection`, las claves de KERNEL—) y ningún evento cita la ruta, se borra el binario de este intento; ante un
//     error ambiguo (p. ej. la conexión cae durante el COMMIT) se conserva. PENDIENTE declarado: no existe aún un barrido que
//     retire los binarios que ningún evento cita (commit ambiguo o proceso muerto entre la subida y el commit);
//  5) si el rechazo se debe a que otro intento IDÉNTICO con la misma llave confirmó antes, se responde su replay (no un 409).
const definiteRejection=(e:unknown)=>e instanceof ClinicalError?e.code!=="DEPENDENCY_UNAVAILABLE":isKernelRejection(e);
const idempotencyRace=(e:unknown)=>e instanceof Error&&!(e instanceof ClinicalError)&&(e.message==="IDEMPOTENCY_CONFLICT"||e.message==="IDEMPOTENCY_IN_PROGRESS");
export async function uploadThenCommit(ctx:HttpTenantContext,a:Readonly<{idempotencyKey:string;aggregateId:string;pathname:string;
 replay:()=>Promise<Response|null>;upload:()=>Promise<unknown>;commit:()=>Promise<Response>;discard:()=>Promise<unknown>}>):Promise<Response>{
 const first=await a.replay();if(first)return first;
 await a.upload();
 try{return await a.commit();}
 catch(e){
  if(definiteRejection(e)&&!(await blobReferenced(ctx,a.idempotencyKey,a.aggregateId,a.pathname)))await a.discard().catch(()=>{/* mejor esfuerzo */});
  if(idempotencyRace(e)){const again=await a.replay();if(again)return again;}
  throw e;
 }
}
export async function parseJson<T>(req:Request,schema:z.ZodType<T>):Promise<T>{
 let raw:unknown;
 try{raw=await req.json();}catch{throw new ClinicalError("VALIDATION_ERROR","Body must be valid JSON");}
 const parsed=schema.safeParse(raw);
 if(!parsed.success)throw new ClinicalError("VALIDATION_ERROR","Invalid payload",{issues:parsed.error.issues.length});
 return parsed.data;
}
