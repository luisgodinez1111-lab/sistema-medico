// Ejecución de comandos clínicos y detección de reintentos. Auditoría R01-001: extraído de `clinical-runtime.ts`.
import crypto from"node:crypto";
import{executeAtomicClinicalCommand,type ClinicalCommand}from"../../../../packages/atomic-clinical-transaction-v3/src";
import{canonicalize}from"../../../../packages/canonical-json/src";
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{assertPayloadSchema}from"../payload-schemas";
import{sliSpan,flowForTopic,type SliFlow}from"../../../../packages/observability/src";
import{sharedAllow,rateLimitedError}from"../rate-limit-shared";
import{assertSessionNotRevoked,revokeSession}from"../session-revocation";
import{getSql,withTenantTx}from"./connection";
import{logEvent,ensureObservabilitySink}from"./log";

// Conecta el consumidor estructurado de SLIs una sola vez (al cargar el pipeline de comandos).
ensureObservabilitySink();

export type ClinicalCommandResult=Readonly<{replayed:boolean;response:unknown}>;
// Ejecuta un comando clínico atómico bajo RLS real: la conexión ya asumió el rol runtime
// en el startup, así que la transacción del kernel corre como `medical_os_runtime`.
// ENG-054: emite un SLI del commit (flujo, outcome, latencia, correlación) — SIN PHI.
export async function runClinicalCommand(ctx:HttpTenantContext,command:ClinicalCommand):Promise<ClinicalCommandResult>{
 // Auditoría S-03: límite de ESCRITURAS por actor con almacén compartido entre instancias (el middleware conserva el límite
 // en memoria por sesión como primera línea). Se decide antes de abrir la transacción; 429 RATE_LIMITED con retryAfterSeconds.
 // R06-19: el payload se valida contra el esquema de su (aggregateType, kind) ANTES de abrir la transacción. El kernel
 // exige lo estructural; esto exige la forma del dominio. Un evento mal formado en una tabla append-only no se corrige.
 assertPayloadSchema(command);
 const limit=await sharedAllow("write",`${ctx.tenantId}:${ctx.actorId}`);
 if(!limit.allowed)throw rateLimitedError(limit);
 const span=sliSpan(flowForTopic(command.topic),"commit",command.correlationId);
 try{
  // R01-014: la sesión revocada se rechaza DENTRO de la transacción del comando (preflight del kernel): ni ventana entre
  // comprobar y escribir, ni transacción extra.
  const r=await executeAtomicClinicalCommand(getSql(),ctx,command,tx=>assertSessionNotRevoked(tx,ctx.sessionId)) as ClinicalCommandResult;
  span.end("success",{tenantId:ctx.tenantId});
  return r;
 }catch(e){
  const code=(e as{code?:string}).code??"ERROR";
  span.end("error",{code,tenantId:ctx.tenantId});
  // Un comando fallido deja ahora un log de error CORRELACIONADO (sin PHI: solo topic y código del fallo),
  // que antes no existía — solo se emitía el SLI. Permite atar el reporte del médico a la traza del servidor.
  logEvent("error","command_failed",command.correlationId,{topic:command.topic,code});
  throw e;
 }
}
export async function lookupReplay(ctx:HttpTenantContext,command:ClinicalCommand):Promise<ClinicalCommandResult|null>{
 const hash=crypto.createHash("sha256").update(canonicalize(command)).digest("hex");
 return withTenantTx(ctx,async tx=>{
  const r=await tx`select status,request_hash,response_json from command_idempotency where tenant_id=${ctx.tenantId} and actor_id=${ctx.actorId} and key=${command.idempotencyKey}`;
  const row=r[0];
  if(row&&row.status==="COMPLETED"&&row.request_hash===hash)return{replayed:true,response:row.response_json};
  return null;
 });
}
