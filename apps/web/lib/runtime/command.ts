// Lote 11 (ADR-0300) — ejecución de comandos clínicos en el kernel atómico (límite de tasa compartido, SLI) y replay idempotente. Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import crypto from"node:crypto";
import{executeAtomicClinicalCommand,type ClinicalCommand}from"../../../../packages/atomic-clinical-transaction-v3/src";
import{canonicalize}from"../../../../packages/canonical-json/src";
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{sliSpan,flowForTopic}from"../../../../packages/observability/src";
import{sharedAllow,rateLimitedError}from"../rate-limit-shared";
import{getSql,withTenantTx}from"./db";
export type ClinicalCommandResult=Readonly<{replayed:boolean;response:unknown}>;
// Ejecuta un comando clínico atómico bajo RLS real: la conexión ya asumió el rol runtime
// en el startup, así que la transacción del kernel corre como `medical_os_runtime`.
// ENG-054: emite un SLI del commit (flujo, outcome, latencia, correlación) — SIN PHI.
export async function runClinicalCommand(ctx:HttpTenantContext,command:ClinicalCommand):Promise<ClinicalCommandResult>{
 // Auditoría S-03: límite de ESCRITURAS por actor con almacén compartido entre instancias (el middleware conserva el límite
 // en memoria por sesión como primera línea). Se decide antes de abrir la transacción; 429 RATE_LIMITED con retryAfterSeconds.
 const limit=await sharedAllow("write",`${ctx.tenantId}:${ctx.actorId}`);
 if(!limit.allowed)throw rateLimitedError(limit);
 const span=sliSpan(flowForTopic(command.topic),"commit",command.correlationId);
 try{
  const r=await executeAtomicClinicalCommand(getSql(),ctx,command) as ClinicalCommandResult;
  span.end("success",{tenantId:ctx.tenantId});
  return r;
 }catch(e){
  span.end("error",{code:(e as{code?:string}).code??"ERROR",tenantId:ctx.tenantId});
  throw e;
 }
}
// EPIC D — Replay idempotente previo a la validación de state-machine: si este Idempotency-Key
// ya produjo ESTE comando exacto (mismo hash) y quedó COMPLETED, devuelve la respuesta guardada.
// Así un reintento de una transición ya aplicada no choca con la SM (el estado ya avanzó).
export async function lookupReplay(ctx:HttpTenantContext,command:ClinicalCommand):Promise<ClinicalCommandResult|null>{
 const hash=crypto.createHash("sha256").update(canonicalize(command)).digest("hex");
 return withTenantTx(ctx,async tx=>{
  const r=await tx`select status,request_hash,response_json from command_idempotency where tenant_id=${ctx.tenantId} and actor_id=${ctx.actorId} and key=${command.idempotencyKey}`;
  const row=r[0];
  if(row&&row.status==="COMPLETED"&&row.request_hash===hash)return{replayed:true,response:row.response_json};
  return null;
 }) as Promise<ClinicalCommandResult|null>;
}
