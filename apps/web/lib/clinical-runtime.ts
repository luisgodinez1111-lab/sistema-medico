import postgres,{type Sql}from"postgres";
import crypto from"node:crypto";
import{executeAtomicClinicalCommand,type ClinicalCommand}from"../../../packages/atomic-clinical-transaction-v3/src";
import{canonicalize}from"../../../packages/canonical-json/src";
import{type HttpTenantContext}from"../../../packages/http-principal/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{sliSpan,flowForTopic}from"../../../packages/observability/src";
import{computeEGFR,type Sex}from"../../../packages/renal-function/src";
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

export type ClinicalCommandResult=Readonly<{replayed:boolean;response:unknown}>;
// Ejecuta un comando clínico atómico bajo RLS real: la conexión ya asumió el rol runtime
// en el startup, así que la transacción del kernel corre como `medical_os_runtime`.
// ENG-054: emite un SLI del commit (flujo, outcome, latencia, correlación) — SIN PHI.
export async function runClinicalCommand(ctx:HttpTenantContext,command:ClinicalCommand):Promise<ClinicalCommandResult>{
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
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const r=await tx`select status,request_hash,response_json from command_idempotency where tenant_id=${ctx.tenantId} and actor_id=${ctx.actorId} and key=${command.idempotencyKey}`;
  const row=r[0];
  if(row&&row.status==="COMPLETED"&&row.request_hash===hash)return{replayed:true,response:row.response_json};
  return null;
 }) as Promise<ClinicalCommandResult|null>;
}

// EPIC S — Registro de pacientes del tenant (RLS-scoped). Devuelve id + nombre (PHI) + estado.
export type PatientRow=Readonly<{patientId:string;name:string;status:string}>;
export async function listPatients(ctx:HttpTenantContext):Promise<ReadonlyArray<PatientRow>>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select r.aggregate_id, r.payload->>'name' as name,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) as latest_kind
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Patient' and r.payload->>'kind'='REGISTERED'
   order by r.payload->>'name'`;
  const STATUS:Record<string,string>={REGISTERED:"ACTIVE",REACTIVATED:"ACTIVE",DEACTIVATED:"INACTIVE",DECEASED:"DECEASED"};
  return rows.map(x=>({patientId:String(x.aggregate_id),name:String(x.name??""),status:STATUS[String(x.latest_kind??"REGISTERED")]??"ACTIVE"}));
 }) as Promise<ReadonlyArray<PatientRow>>;
}
// EPIC R — Gate de seguridad de medicación: sustancias con alergia ACTIVA del paciente (RLS-scoped).
// Una alergia está activa si su último evento es RECORDED o REACTIVATED (no REFUTED/INACTIVATED).
export async function activeAllergySubstances(ctx:HttpTenantContext,patientId:string):Promise<string[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select r.payload->>'substance' as substance
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Allergy' and r.payload->>'kind'='RECORDED' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) in ('RECORDED','REACTIVATED')`;
  return rows.map(x=>String(x.substance??"")).filter(Boolean);
 }) as Promise<string[]>;
}
// EPIC AW — Medicaciones ACTIVAS del paciente (último kind ACTIVATED). RLS-scoped. Para el check de
// duplicación terapéutica en la prescripción. Devuelve drugCode.
export async function activeMedicationDrugCodes(ctx:HttpTenantContext,patientId:string):Promise<string[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select r.payload->>'drugCode' as drug_code
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Medication' and r.payload->>'kind'='PROPOSED' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1)='ACTIVATED'`;
  return rows.map(x=>String(x.drug_code??"")).filter(Boolean);
 }) as Promise<string[]>;
}
// EPIC BK/BL — Demografía del paciente (nacimiento + sexo, del evento REGISTERED). RLS-scoped.
export type PatientDemographics=Readonly<{birthDate?:string;sexAtBirth?:string}>;
export async function patientDemographics(ctx:HttpTenantContext,patientId:string):Promise<PatientDemographics|undefined>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`select r.payload->>'birthDate' as bd, r.payload->>'sexAtBirth' as sx from clinical_events r where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Patient' and r.payload->>'kind'='REGISTERED' and r.aggregate_id=${patientId} limit 1`;
  if(!rows[0])return undefined;
  const d:{birthDate?:string;sexAtBirth?:string}={};
  if(rows[0].bd!=null)d.birthDate=String(rows[0].bd);
  if(rows[0].sx!=null)d.sexAtBirth=String(rows[0].sx);
  return d;
 }) as Promise<PatientDemographics|undefined>;
}
// EPIC BK — Fecha de nacimiento del paciente (del evento REGISTERED). RLS-scoped. Para el pronóstico de vacunación.
export async function patientBirthDate(ctx:HttpTenantContext,patientId:string):Promise<string|undefined>{
 const d=await patientDemographics(ctx,patientId);return d?.birthDate;
}
// EPIC BM — eGFR del paciente (CKD-EPI) desde demografía + última creatinina. undefined si no computable
// (sin datos, pediátrico, sexo no binario). Para el gate renal de la prescripción.
export async function patientEgfr(ctx:HttpTenantContext,patientId:string):Promise<number|undefined>{
 const demo=await patientDemographics(ctx,patientId);
 if(!demo?.birthDate)return undefined;
 const sex=demo.sexAtBirth;if(sex!=="FEMALE"&&sex!=="MALE")return undefined;
 const b=new Date(demo.birthDate),a=new Date();
 if(Number.isNaN(b.getTime()))return undefined;
 let age=a.getUTCFullYear()-b.getUTCFullYear();
 if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))age-=1;
 if(age<18)return undefined; // CKD-EPI adulto; en pediatría se usa Schwartz
 const scr=await latestResultValueForAnalyte(ctx,patientId,"CREATININE");
 if(scr===undefined)return undefined;
 return computeEGFR(Number(scr),age,sex as Sex)?.egfr;
}
// EPIC BK — Códigos de vacunas ADMINISTRADAS del paciente (último kind ADMINISTERED). RLS-scoped.
export async function administeredVaccineCodes(ctx:HttpTenantContext,patientId:string):Promise<string[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select r.payload->>'vaccineCode' as code
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Immunization' and r.payload->>'kind'='DUE' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1)='ADMINISTERED'`;
  return rows.map(x=>String(x.code??"")).filter(Boolean);
 }) as Promise<string[]>;
}
// EPIC BC — Último valor registrado por tipo de signo vital del paciente (para computar NEWS2). RLS-scoped.
// Toma el evento RECORDED más reciente por vitalType. Devuelve un mapa {vitalType -> value textual}.
export async function latestVitalsByType(ctx:HttpTenantContext,patientId:string):Promise<Record<string,string>>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select distinct on (r.payload->>'vitalType') r.payload->>'vitalType' as vital_type, r.payload->>'value' as value
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='VitalSign' and r.payload->>'kind'='RECORDED'
     and r.payload->>'patientId'=${patientId}
   order by r.payload->>'vitalType', r.occurred_at desc, r.sequence desc`;
  const out:Record<string,string>={};for(const x of rows){const k=String(x.vital_type??"");if(k)out[k]=String(x.value??"");}
  return out;
 }) as Promise<Record<string,string>>;
}
// EPIC BB — Valor PREVIO del mismo analito del paciente (resultado más reciente ya recibido). RLS-scoped.
// Para el delta check de laboratorio en la recepción de un resultado nuevo. Devuelve el value textual o undefined.
export async function latestResultValueForAnalyte(ctx:HttpTenantContext,patientId:string,analyte:string):Promise<string|undefined>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select r.payload->>'value' as value
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult' and r.payload->>'kind'='RECEIVED'
     and r.payload->>'patientId'=${patientId} and upper(r.payload->>'analyte')=upper(${analyte})
   order by r.occurred_at desc, r.sequence desc limit 1`;
  const v=rows[0]?.value;return v==null?undefined:String(v);
 }) as Promise<string|undefined>;
}
// EPIC AY — Condiciones ACTIVAS del paciente (lista de problemas, CIE-10). RLS-scoped. Para el gate de
// contraindicación fármaco–condición en la prescripción. Activa = último kind ADDED/REACTIVATED/MARKED_CHRONIC
// (no RESOLVED ni MARKED_ERROR). Devuelve el código CIE-10 normalizado.
export async function activeProblemCodes(ctx:HttpTenantContext,patientId:string):Promise<string[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select r.payload->>'code' as code
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='ClinicalProblem' and r.payload->>'kind'='ADDED' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) in ('ADDED','REACTIVATED','MARKED_CHRONIC')`;
  return rows.map(x=>String(x.code??"")).filter(Boolean);
 }) as Promise<string[]>;
}
// EPIC N — Timeline del paciente: un item por agregado clínico del paciente, con tipo, último kind
// (estado), versión y fechas. RLS-scoped. SIN PHI: solo metadatos, nunca el contenido clínico.
export type TimelineItem=Readonly<{aggregateType:string;aggregateId:string;latestKind:string;status:string;version:number;openedAt:string;lastAt:string}>;
export async function readPatientTimeline(ctx:HttpTenantContext,patientId:string):Promise<ReadonlyArray<TimelineItem>>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select r.aggregate_id, r.aggregate_type,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) as latest_kind,
     (select payload->>'status' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) as latest_status,
     max(r.sequence) as version, min(r.occurred_at) as opened_at, max(r.occurred_at) as last_at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_id in (
     select aggregate_id from clinical_events where tenant_id=${ctx.tenantId} and sequence=1 and payload->>'patientId'=${patientId})
   group by r.aggregate_id, r.aggregate_type
   order by min(r.occurred_at) desc`;
  return rows.map(x=>({aggregateType:String(x.aggregate_type),aggregateId:String(x.aggregate_id),latestKind:String(x.latest_kind??""),status:String(x.latest_status??""),version:Number(x.version),openedAt:String(x.opened_at),lastAt:String(x.last_at)}));
 }) as Promise<ReadonlyArray<TimelineItem>>;
}
// EPIC AC — Worklist poblacional: un renglón por agregado clínico del tenant (todos los pacientes),
// con su patientId y su último kind (estado). RLS-scoped al tenant. SIN PHI: solo tipo/estado/ids.
export type PanelRowData=Readonly<{aggregateType:string;aggregateId:string;patientId:string;latestKind:string;status:string}>;
export async function readTenantOpenAggregates(ctx:HttpTenantContext):Promise<ReadonlyArray<PanelRowData>>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select r.aggregate_id, r.aggregate_type, r.payload->>'patientId' as patient_id,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) as latest_kind,
     (select payload->>'status' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) as latest_status
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.sequence=1 and r.payload->>'patientId' is not null`;
  return rows.map(x=>({aggregateType:String(x.aggregate_type),aggregateId:String(x.aggregate_id),patientId:String(x.patient_id),latestKind:String(x.latest_kind??""),status:String(x.latest_status??"")}));
 }) as Promise<ReadonlyArray<PanelRowData>>;
}
// EPIC AB — Manifiesto del expediente: filas estructurales (agregado/secuencia/kind/fecha) de TODOS
// los agregados del paciente. RLS-scoped. SIN volcar payloads PHI: solo el kind (estado) y la fecha.
export type RecordRow=Readonly<{aggregateType:string;aggregateId:string;sequence:number;kind:string;occurredAt:string}>;
export async function readPatientRecordRows(ctx:HttpTenantContext,patientId:string):Promise<ReadonlyArray<RecordRow>>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select r.aggregate_id, r.aggregate_type, r.sequence, r.payload->>'kind' as kind, r.occurred_at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_id in (
     select aggregate_id from clinical_events where tenant_id=${ctx.tenantId} and sequence=1 and payload->>'patientId'=${patientId})
   order by r.aggregate_id, r.sequence`;
  return rows.map(x=>({aggregateType:String(x.aggregate_type),aggregateId:String(x.aggregate_id),sequence:Number(x.sequence),kind:String(x.kind??""),occurredAt:String(x.occurred_at)}));
 }) as Promise<ReadonlyArray<RecordRow>>;
}
// EPIC D — Lectura RLS-scoped del stream de eventos CON payload (para reconstruir estado).
// El payload es contenido clínico (fuente de verdad, RLS-aislado); nunca se loguea.
export async function readEncounterEvents(ctx:HttpTenantContext,encounterId:string):Promise<ReadonlyArray<{sequence:number;payload:Record<string,unknown>}>>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`select sequence,payload from clinical_events where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId} order by sequence`;
  return rows.map(r=>({sequence:Number(r.sequence),payload:(r.payload??{}) as Record<string,unknown>}));
 }) as Promise<ReadonlyArray<{sequence:number;payload:Record<string,unknown>}>>;
}
// EPIC G — Lector genérico de eventos de un agregado (RLS-scoped, con payload).
export async function readAggregateEvents(ctx:HttpTenantContext,aggregateId:string):Promise<ReadonlyArray<{sequence:number;payload:Record<string,unknown>}>>{
 return readEncounterEvents(ctx,aggregateId);
}
// EPIC D — Gate Zero Lost Follow-Up: obligaciones críticas (URGENT) del paciente sin resolver.
export async function countUnresolvedCriticalObligations(ctx:HttpTenantContext,patientId:string):Promise<number>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`select count(*)::int n from clinical_inbox where tenant_id=${ctx.tenantId} and patient_id=${patientId} and priority='URGENT' and resolved_at is null`;
  return Number(rows[0]?.n??0);
 }) as Promise<number>;
}
// EPIC G — Cierre del loop Zero Lost Follow-Up: resultados diagnósticos CRÍTICOS del paciente que
// requirieron acción (ACTIONED) y no se han cerrado (sin evento CLOSED). Consulta el event stream
// directamente (sin proyección), plegando por aggregate_id vía NOT EXISTS.
export async function countOpenCriticalResults(ctx:HttpTenantContext,patientId:string):Promise<number>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select count(distinct r.aggregate_id)::int n
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult'
     and r.payload->>'kind'='ACTIONED' and r.payload->>'patientId'=${patientId} and r.payload->>'critical'='true'
     and not exists(
      select 1 from clinical_events c
      where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and c.payload->>'kind'='CLOSED')`;
  return Number(rows[0]?.n??0);
 }) as Promise<number>;
}

// EPIC AN + Zero Lost Follow-Up: cuenta signos vitales CRÍTICOS del paciente
// que están en estado RECORDED o AMENDED (no corregidos) y no han sido abordados
// (no existe obligación creada para ese vital). Bloquea firma del encuentro.
export async function countOpenCriticalVitals(ctx:HttpTenantContext,patientId:string):Promise<number>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select count(distinct r.aggregate_id)::int n
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='VitalSign'
     and r.payload->>'kind' in ('RECORDED','AMENDED')
     and r.payload->>'patientId'=${patientId} and r.payload->>'critical'='true'
     and not exists(
      select 1 from clinical_events c
      where c.tenant_id=${ctx.tenantId} and c.aggregate_type='ClinicalObligation'
        and c.payload->>'sourceVitalId'=r.aggregate_id::text and c.payload->>'kind'='CREATED')`;
  return Number(rows[0]?.n??0);
 }) as Promise<number>;
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
