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
 return commitCommand(ctx,command);
}
// Porte D5 — COMANDO DERIVADO (obligaciones de monitoreo de un fármaco, obligación URGENTE de un resultado crítico, cierre de
// esa obligación): consecuencia obligatoria de un comando principal que YA se cobró al límite de tasa. Es idempotente por su
// llave derivada (replay si ya se aplicó) y NO se cobra otra vez: antes, con el cubo del actor agotado entre ambos, el
// principal quedaba confirmado y la obligación nunca se creaba (warfarina sin control de INR). Conserva la validación del
// esquema (R06-19) y el preflight de sesión revocada (R01-014): un derivado de una sesión revocada sigue fallando. Los casos
// de uso lo ejecutan también en el camino de replay del principal, así que un reintento IDÉNTICO reconcilia lo que un fallo
// tras el commit principal dejó pendiente (no hay reconciliador del lado del servidor: eso sigue abierto).
// Superficie: un actor puede disparar N derivados por cada comando principal cobrado, acotado por el número de reglas.
export async function runDerivedCommand(ctx:HttpTenantContext,command:ClinicalCommand):Promise<ClinicalCommandResult>{
 const replay=await lookupReplay(ctx,command);if(replay)return replay;
 assertPayloadSchema(command);
 return commitCommand(ctx,command);
}
// Cuerpo común del commit (sin límite de tasa): SLI del flujo + kernel atómico con el preflight de sesión revocada.
async function commitCommand(ctx:HttpTenantContext,command:ClinicalCommand):Promise<ClinicalCommandResult>{
 const span=sliSpan(flowForTopic(command.topic),"commit",command.correlationId);
 try{
  // R01-014: la sesión revocada se rechaza DENTRO de la transacción del comando (preflight del kernel): ni ventana entre
  // comprobar y escribir, ni transacción extra.
  const r=await executeAtomicClinicalCommand(getSql(),ctx,command,tx=>assertSessionNotRevoked(tx,ctx.sessionId)) as ClinicalCommandResult;
  span.end("success",{tenantId:ctx.tenantId});
  return r;
 }catch(e){
  span.end("error",{code:(e as{code?:string}).code??"ERROR",tenantId:ctx.tenantId});
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
