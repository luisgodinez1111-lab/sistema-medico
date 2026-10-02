// Conexión a Postgres y transacciones con contexto de RLS. Auditoría R01-001: extraído del god-module
// `clinical-runtime.ts`, que mezclaba esto con 60+ read-models de todos los dominios.
//
// El rol NOBYPASSRLS se fija en el STARTUP de cada conexión (`-c role=medical_os_runtime`): así toda transacción —incluida
// la que abre el kernel atómico— corre bajo RLS forzada. `withTenantTx` es la ÚNICA forma de abrir una transacción de
// lectura: fija tenant/actor/propósito/correlación y comprueba que la sesión no esté revocada (R01-002, R01-014).
import postgres,{type Sql,type TransactionSql}from"postgres";
import{executeAtomicClinicalCommand,type ClinicalCommand}from"../../../../packages/atomic-clinical-transaction-v3/src";
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{directEndpoint}from"../../../../packages/pg-endpoint/src";
import{ClinicalError}from"../../../../packages/runtime-errors/src";
import{sliSpan,flowForTopic,type SliFlow}from"../../../../packages/observability/src";
import{CircuitBreaker}from"../../../../packages/resilience/src";
import{runWithDbResilience}from"./db-resilience";
import{assertSessionNotRevoked,revokeSession}from"../session-revocation";
import{logPhiAccess,patientAccessLog,type PhiAccessEntry,type PhiAccessAction,type PhiResourceType}from"../phi-access-log";


// EPIC B — Runtime clínico de la capa app: conexión a Postgres y ejecución del kernel
// atómico ya probado, SIEMPRE bajo el rol NOBYPASSRLS `medical_os_runtime`.
// Lección de runtime (sesión 15-sep): el owner de Neon tiene BYPASSRLS -> si el pool
// corriera como owner, RLS no aplicaría. Por eso el rol se fija en el *startup* de cada
// conexión (`-c role=medical_os_runtime`): todo el pool asume el rol NOBYPASSRLS, así el
// `sql.begin` que abre executeAtomicClinicalCommand ya corre bajo RLS forzado.
const RUNTIME_ROLE="medical_os_runtime";
let _sql:Sql|undefined;
export function getSql():Sql{
 if(_sql)return _sql;
 const raw=process.env.DATABASE_URL;
 if(!raw)throw new ClinicalError("DEPENDENCY_UNAVAILABLE","DATABASE_URL not configured");
 // Serverless: se usa el endpoint DIRECTO (sin pooler) porque el rol RLS se fija con el parámetro
 // de startup `-c role=...`, que el pooler PgBouncer (transaction mode) no soporta. Para no saturar
 // el límite de conexiones del endpoint directo, `max` bajo por instancia (Fluid Compute reutiliza
 // instancias, así que pocas conexiones concurrentes por lambda bastan); prepared statements ON.
 // Trade-off documentado: a mayor escala convendría un modelo de conexión RLS-aware pooled.
 _sql=postgres(directEndpoint(raw),{max:5,idle_timeout:20,connect_timeout:10,prepare:true,connection:{options:`-c role=${RUNTIME_ROLE}`}});
 return _sql;
}
export function sessionSecret():string{
 const s=process.env.SESSION_SIGNING_SECRET;
 if(!s)throw new ClinicalError("SAFETY_BLOCKED","SESSION_SIGNING_SECRET not configured");
 return s;
}
// Auditoría 2026-09-19, anexo R01 (R01-006): el pool corre con `max` bajo por instancia y no había ninguna respuesta al
// agotamiento de conexiones del endpoint directo de Neon: la petición moría con un 500 opaco. Ahora un fallo de NIVEL DE
// CONEXIÓN (no de la consulta) se reintenta con espera creciente y, si aun así no hay conexión, se traduce a
// DEPENDENCY_UNAVAILABLE (503 fail-closed, nunca un «guardado» falso) y deja un SLI de saturación sin PHI.
const POOL_EXHAUSTED=new Set(["53300","53400","08006","08001","08004","57P03","XX000"]);
const isPoolExhausted=(e:unknown):boolean=>{
 const err=e as{code?:string;message?:string};
 if(err?.code&&POOL_EXHAUSTED.has(err.code))return /too many|connection|slot|starting up|shutdown/i.test(err.message??"")||err.code!=="XX000";
 return /too many clients|too many connections|connection terminated|connection ended|ECONNRESET|ETIMEDOUT/i.test(err?.message??"");
};
// SRE: un circuit breaker por instancia alrededor de la dependencia de conexión. Tras 5 fallos de CONEXIÓN
// seguidos (no de dominio: ver db-resilience) abre 30 s y responde rápido DEPENDENCY_UNAVAILABLE en vez de
// seguir reintentando contra una base caída — fail-fast que libera las pocas conexiones del endpoint directo.
const dbBreaker=new CircuitBreaker(5,30_000);
// Reintenta SOLO fallos de conexión (la transacción no llegó a abrirse o se cortó el socket): ni un comando a medias ni
// un error de dominio se reintentan nunca aquí. La lógica (reintento + breaker, PHI-free) vive aislada y probada en
// db-resilience.ts; aquí solo se le pasan la clasificación de fallo y la telemetría SLI de este runtime.
async function withConnectionRetry<T>(flow:SliFlow,correlationId:string,run:()=>Promise<T>):Promise<T>{
 return runWithDbResilience(dbBreaker,run,{
  isConnectionFailure:isPoolExhausted,
  // El SLI solo lleva el código del error y el número de intento: nada de PHI (allowlist de packages/observability).
  onConnRetry:(attempt,code)=>sliSpan(flow,`db_pool_retry_${attempt}`,correlationId).end("error",{code}),
  onCircuitOpen:()=>sliSpan(flow,"db_circuit_open",correlationId).end("error",{code:"CIRCUIT_OPEN"}),
 });
}
// Auditoría R01-002: los 41 read-models repetían la misma línea de `set_config` tras abrir la transacción. Un solo helper
// fija el contexto de RLS (tenant, actor, propósito, correlación) y ejecuta el cuerpo; si alguien añade un read-model
// nuevo, no puede olvidarse de fijar el tenant porque el helper es la única forma de abrir transacción de lectura.
export async function withTenantTx<T>(ctx:HttpTenantContext,run:(tx:TransactionSql)=>Promise<T>):Promise<T>{
 return withTenantTxRaw(ctx,async tx=>{
  // R01-014: una sesión revocada no lee PHI ni escribe, aunque su token siga dentro del TTL.
  await assertSessionNotRevoked(tx,ctx.sessionId);
  return run(tx);
 });
}
// Variante sin comprobación de revocación: SOLO para la propia operación de revocar (logout).
async function withTenantTxRaw<T>(ctx:HttpTenantContext,run:(tx:TransactionSql)=>Promise<T>):Promise<T>{
 return withConnectionRetry("workflow",ctx.requestId,()=>getSql().begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  return run(tx);
 }) as Promise<T>);
}
// R01-014: revoca la sesión en curso (logout) dentro de una transacción con el contexto de RLS del propio tenant.
export async function revokeCurrentSession(ctx:HttpTenantContext,expiresAt:Date,reason="LOGOUT"):Promise<boolean>{
 if(!ctx.sessionId)return false;
 const sessionId=ctx.sessionId;
 // Se abre con el contexto de RLS del propio tenant, pero SIN la comprobación de revocación (se está revocando justo
 // esta sesión: exigir que no lo esté impediría el segundo logout).
 return withTenantTxRaw(ctx,tx=>revokeSession(tx,{sessionId,tenantId:ctx.tenantId,actorId:ctx.actorId,reason,expiresAt}));
}
// R01-026: constancia explícita de un acceso con SEMÁNTICA propia (exportar el expediente, imprimir una receta), que no
// coincide con la de la consulta que lo alimenta. Abre su propia transacción con el contexto de RLS del tenant.
export async function recordPhiAccess(ctx:HttpTenantContext,a:Readonly<{resourceType:PhiResourceType;resourceId:string;patientId?:string|undefined;action?:PhiAccessAction}>):Promise<void>{
 await withTenantTx(ctx,tx=>logPhiAccess(tx,ctx,a));
}
// R01-026: «¿quién ha visto el expediente de este paciente?» — para el panel de auditoría y para responder a un ARCO.
export async function readPatientAccessLog(ctx:HttpTenantContext,patientId:string,limit=100):Promise<PhiAccessEntry[]>{
 return withTenantTx(ctx,tx=>patientAccessLog(tx,ctx,patientId,limit));
}
