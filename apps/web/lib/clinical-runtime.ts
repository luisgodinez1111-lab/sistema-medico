import postgres,{type Sql}from"postgres";
import{executeAtomicClinicalCommand,type ClinicalCommand}from"../../../packages/atomic-clinical-transaction-v3/src";
import{type HttpTenantContext}from"../../../packages/http-principal/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
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
function getSql():Sql{
 if(_sql)return _sql;
 const raw=process.env.DATABASE_URL;
 if(!raw)throw new ClinicalError("DEPENDENCY_UNAVAILABLE","DATABASE_URL not configured");
 _sql=postgres(directEndpoint(raw),{max:10,idle_timeout:20,connect_timeout:10,prepare:false,connection:{options:`-c role=${RUNTIME_ROLE}`}});
 return _sql;
}
export function sessionSecret():string{
 const s=process.env.SESSION_SIGNING_SECRET;
 if(!s)throw new ClinicalError("SAFETY_BLOCKED","SESSION_SIGNING_SECRET not configured");
 return s;
}

export type ClinicalCommandResult=Readonly<{replayed:boolean;response:unknown}>;
// Ejecuta un comando clínico atómico bajo RLS real: la conexión ya asumió el rol runtime
// en el startup, así que la transacción del kernel corre como `medical_os_runtime`.
export async function runClinicalCommand(ctx:HttpTenantContext,command:ClinicalCommand):Promise<ClinicalCommandResult>{
 return executeAtomicClinicalCommand(getSql(),ctx,command) as Promise<ClinicalCommandResult>;
}

export type EncounterView=Readonly<{encounterId:string;version:number;events:ReadonlyArray<{sequence:number;type:string;occurredAt:string}>}>;
// Lectura RLS-scoped del agregado (sin payload clínico: solo metadatos no-PHI).
export async function readEncounter(ctx:HttpTenantContext,encounterId:string):Promise<EncounterView|null>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const agg=await tx`select version from aggregate_versions where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId}`;
  const head=agg[0];
  if(!head)return null;
  const events=await tx`select sequence,aggregate_type,occurred_at from clinical_events where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId} order by sequence`;
  return{
   encounterId,
   version:Number(head.version),
   events:events.map(e=>({sequence:Number(e.sequence),type:String(e.aggregate_type),occurredAt:String(e.occurred_at)})),
  };
 }) as Promise<EncounterView|null>;
}
