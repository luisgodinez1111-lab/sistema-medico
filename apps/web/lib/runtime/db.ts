// Lote 11 (ADR-0300) — pool de PostgreSQL perezoso contra el endpoint DIRECTO y bajo el rol NOBYPASSRLS (ADR-0250). Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import postgres,{type Sql,type TransactionSql}from"postgres";
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{ClinicalError}from"../../../../packages/runtime-errors/src";
// EPIC B — Runtime clínico de la capa app: conexión a Postgres y ejecución del kernel
// atómico ya probado, SIEMPRE bajo el rol NOBYPASSRLS `medical_os_runtime`.
// Lección de runtime (sesión 15-sep): el owner de Neon tiene BYPASSRLS -> si el pool
// corriera como owner, RLS no aplicaría. Por eso el rol se fija en el *startup* de cada
// conexión (`-c role=medical_os_runtime`): todo el pool asume el rol NOBYPASSRLS, así el
// `sql.begin` que abre executeAtomicClinicalCommand ya corre bajo RLS forzado.
const RUNTIME_ROLE="medical_os_runtime";
// Neon: para transacciones/startup-options usamos el endpoint directo (sin -pooler, sin
// channel_binding); el pooler PgBouncer no admite parámetros de startup personalizados.
function directEndpoint(raw:string):string{
 return raw.replace("-pooler","").replace(/([?&])channel_binding=require/,"$1").replace(/[?&]$/,"");
}
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
// Lote 11 (ADR-0300) — Transacción bajo el contexto RLS del tenant. Es la ÚNICA copia del preámbulo que exigen las políticas
// (app.current_tenant() y compañía): los cuatro set_config son transaction-local (`true`), así que no se filtran a otra
// petición que reutilice la conexión del pool. Toda lectura de la persistencia pasa por aquí (antes: 41 copias literales).
export async function withTenantTx<T>(ctx:HttpTenantContext,fn:(tx:TransactionSql)=>Promise<T>):Promise<T>{
 return getSql().begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  return fn(tx);
 }) as Promise<T>;
}
