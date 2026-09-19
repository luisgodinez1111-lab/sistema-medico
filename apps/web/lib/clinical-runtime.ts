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
export type PatientRow=Readonly<{patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string;version:number}>;
export async function listPatients(ctx:HttpTenantContext):Promise<ReadonlyArray<PatientRow>>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select r.aggregate_id,
     coalesce(a.payload->>'name', r.payload->>'name') as name,
     coalesce(a.payload->>'birthDate', r.payload->>'birthDate') as birth_date,
     coalesce(a.payload->>'sexAtBirth', r.payload->>'sexAtBirth') as sex_at_birth,
     coalesce(a.payload->>'curp', r.payload->>'curp') as curp,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) as latest_kind,
     (select count(*)::int from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=r.aggregate_id) as version
   from clinical_events r
   left join lateral (select payload from clinical_events am where am.tenant_id=${ctx.tenantId} and am.aggregate_id=r.aggregate_id and am.payload->>'kind'='AMENDED' order by am.sequence desc limit 1) a on true
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Patient' and r.payload->>'kind'='REGISTERED'
   order by coalesce(a.payload->>'name', r.payload->>'name')`;
  const STATUS:Record<string,string>={REGISTERED:"ACTIVE",REACTIVATED:"ACTIVE",DEACTIVATED:"INACTIVE",DECEASED:"DECEASED"};
  return rows.map(x=>{const o=x as Record<string,unknown>;return{patientId:String(o.aggregate_id),name:String(o.name??""),status:STATUS[String(o.latest_kind??"REGISTERED")]??"ACTIVE",version:Number(o.version??1),...(o.birth_date?{birthDate:String(o.birth_date)}:{}),...(o.sex_at_birth?{sexAtBirth:String(o.sex_at_birth)}:{}),...(o.curp?{curp:String(o.curp)}:{})};});
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
export type PatientDemographics=Readonly<{birthDate?:string;sexAtBirth?:string;curp?:string;phone?:string;email?:string;address?:string;occupation?:string;maritalStatus?:string;name?:string}>;
export async function patientDemographics(ctx:HttpTenantContext,patientId:string):Promise<PatientDemographics|undefined>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`select
     coalesce(a.payload->>'birthDate', r.payload->>'birthDate') as bd,
     coalesce(a.payload->>'sexAtBirth', r.payload->>'sexAtBirth') as sx,
     coalesce(a.payload->>'name', r.payload->>'name') as nm,
     coalesce(a.payload->>'curp', r.payload->>'curp') as curp,
     coalesce(a.payload->>'phone', r.payload->>'phone') as phone,
     coalesce(a.payload->>'email', r.payload->>'email') as email,
     coalesce(a.payload->>'address', r.payload->>'address') as address,
     coalesce(a.payload->>'occupation', r.payload->>'occupation') as occupation,
     coalesce(a.payload->>'maritalStatus', r.payload->>'maritalStatus') as marital
   from clinical_events r
   left join lateral (select payload from clinical_events am where am.tenant_id=${ctx.tenantId} and am.aggregate_id=r.aggregate_id and am.payload->>'kind'='AMENDED' order by am.sequence desc limit 1) a on true
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Patient' and r.payload->>'kind'='REGISTERED' and r.aggregate_id=${patientId} limit 1`;
  const row=rows[0] as Record<string,unknown>|undefined;
  if(!row)return undefined;
  const d:{-readonly[K in keyof PatientDemographics]:PatientDemographics[K]}={};
  const set=(k:keyof PatientDemographics,v:unknown)=>{if(v!=null)d[k]=String(v);};
  set("birthDate",row.bd);set("sexAtBirth",row.sx);set("name",row.nm);set("curp",row.curp);set("phone",row.phone);set("email",row.email);set("address",row.address);set("occupation",row.occupation);set("maritalStatus",row.marital);
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

// EPIC CH — Serie temporal de un analito (evolución longitudinal, panel 4). Todos los resultados
// RECEIVED de ese analito, orden ascendente por fecha. RLS-scoped; valores numéricos.
export async function analyteSeries(ctx:HttpTenantContext,patientId:string,analyte:string):Promise<{value:number;at:string}[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select r.payload->>'value' as value, r.occurred_at as at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult' and r.payload->>'kind'='RECEIVED'
     and r.payload->>'patientId'=${patientId} and upper(r.payload->>'analyte')=upper(${analyte})
   order by r.occurred_at asc, r.sequence asc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{value:Number(o.value),at:String(o.at)};}).filter(p=>Number.isFinite(p.value));
 }) as Promise<{value:number;at:string}[]>;
}

// EPIC CM — Agenda del día: citas cuyo startAt cae en [fromIso, toIso), con estado (última transición)
// y nombre del paciente. RLS-scoped. Comparación por string ISO (orden lexicográfico correcto).
export type AgendaAppt=Readonly<{appointmentId:string;patientId:string;patientName:string;startAt:string;endAt:string|null;reason:string;consultorio:string|null;apptType:string|null;status:string;version:number}>;
export async function agendaForDate(ctx:HttpTenantContext,fromIso:string,toIso:string):Promise<AgendaAppt[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'startAt' as start_at, a.payload->>'endAt' as end_at,
     a.payload->>'reason' as reason, a.payload->>'consultorio' as consultorio, a.payload->>'apptType' as appt_type,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as status,
     (select count(*)::int from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=a.aggregate_id) as version,
     (select p.payload->>'name' from clinical_events p where p.tenant_id=${ctx.tenantId} and p.aggregate_type='Patient' and p.payload->>'kind'='REGISTERED' and p.aggregate_id=(a.payload->>'patientId')::uuid limit 1) as patient_name
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Appointment' and a.payload->>'kind'='SCHEDULED'
     and a.payload->>'startAt' >= ${fromIso} and a.payload->>'startAt' < ${toIso}
   order by a.payload->>'startAt' asc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   appointmentId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   startAt:String(o.start_at??""),endAt:o.end_at?String(o.end_at):null,reason:String(o.reason??""),
   consultorio:o.consultorio?String(o.consultorio):null,apptType:o.appt_type?String(o.appt_type):null,status:String(o.status??"SCHEDULED"),version:Number(o.version??1)};});
 }) as Promise<AgendaAppt[]>;
}
// EPIC R/UI — Registro de alergias de TODA la clínica (vista Alergias). Por cada agregado Allergy toma el
// evento base ALLERGY_RECORDED (sustancia/gravedad/reacción/paciente/fecha/actor) y su ESTADO por la última
// transición (RECORDED/REACTIVATED->ACTIVE, REFUTED->REFUTED, INACTIVATED->INACTIVE). Une el nombre del
// paciente. RLS-scoped. El tipo del alérgeno y las gráficas se derivan en la capa de API/UI (classifyAllergen).
export type AllergyRow=Readonly<{allergyId:string;patientId:string;patientName:string;substance:string;reaction:string;severity:"MILD"|"MODERATE"|"SEVERE";status:"ACTIVE"|"REFUTED"|"INACTIVE";recordedAt:string;registeredBy:string}>;
const ALLERGY_STATUS:Record<string,"ACTIVE"|"REFUTED"|"INACTIVE">={RECORDED:"ACTIVE",REACTIVATED:"ACTIVE",REFUTED:"REFUTED",INACTIVATED:"INACTIVE"};
export async function allergyRegistry(ctx:HttpTenantContext):Promise<AllergyRow[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'substance' as substance,
     a.payload->>'reaction' as reaction, a.payload->>'severity' as severity, a.occurred_at as recorded_at, a.actor_id as actor_id,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind,
     (select p.payload->>'name' from clinical_events p where p.tenant_id=${ctx.tenantId} and p.aggregate_type='Patient' and p.payload->>'kind'='REGISTERED' and p.aggregate_id=(a.payload->>'patientId')::uuid limit 1) as patient_name
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Allergy' and a.payload->>'kind'='RECORDED'
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;const sev=String(o.severity??"MILD");
   return{
    allergyId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
    substance:String(o.substance??""),reaction:String(o.reaction??""),
    severity:(sev==="SEVERE"||sev==="MODERATE"?sev:"MILD") as "MILD"|"MODERATE"|"SEVERE",
    status:ALLERGY_STATUS[String(o.last_kind??"RECORDED")]??"ACTIVE",
    recordedAt:o.recorded_at?new Date(String(o.recorded_at)).toISOString():"",registeredBy:String(o.actor_id??"")};});
 }) as Promise<AllergyRow[]>;
}
// EPIC Q/UI — Registro de problemas de TODA la clínica (vista Problemas). Por cada agregado ClinicalProblem
// toma el evento base PROBLEM_ADDED (código CIE-10/descripción/categoría/paciente/fecha) y su ESTADO por la
// última transición de CICLO DE VIDA (ADDED/REACTIVATED->ACTIVE, MARKED_CHRONIC->CHRONIC, RESOLVED->RESOLVED,
// ENTERED_IN_ERROR->INACTIVE; ignora EPISTEMIC/EVIDENCE que no cambian el estado). Une el nombre del paciente.
export type ProblemRow=Readonly<{problemId:string;patientId:string;patientName:string;code:string;description:string;category:string;status:"ACTIVE"|"CHRONIC"|"RESOLVED"|"INACTIVE";recordedAt:string;registeredBy:string}>;
const PROBLEM_STATUS:Record<string,"ACTIVE"|"CHRONIC"|"RESOLVED"|"INACTIVE">={ADDED:"ACTIVE",REACTIVATED:"ACTIVE",MARKED_CHRONIC:"CHRONIC",RESOLVED:"RESOLVED",ENTERED_IN_ERROR:"INACTIVE"};
export async function problemRegistry(ctx:HttpTenantContext):Promise<ProblemRow[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'code' as code,
     a.payload->>'description' as description, a.payload->>'category' as category, a.occurred_at as recorded_at, a.actor_id as actor_id,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id and c.payload->>'kind' in ('ADDED','REACTIVATED','MARKED_CHRONIC','RESOLVED','ENTERED_IN_ERROR') order by sequence desc limit 1) as last_kind,
     (select p.payload->>'name' from clinical_events p where p.tenant_id=${ctx.tenantId} and p.aggregate_type='Patient' and p.payload->>'kind'='REGISTERED' and p.aggregate_id=(a.payload->>'patientId')::uuid limit 1) as patient_name
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalProblem' and a.payload->>'kind'='ADDED'
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   problemId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   code:String(o.code??""),description:String(o.description??""),category:String(o.category??"Otros"),
   status:PROBLEM_STATUS[String(o.last_kind??"ADDED")]??"ACTIVE",
   recordedAt:o.recorded_at?new Date(String(o.recorded_at)).toISOString():"",registeredBy:String(o.actor_id??"")};});
 }) as Promise<ProblemRow[]>;
}
// EPIC V/UI — Registro de vacunas de TODA la clínica (vista Vacunas). Por cada agregado Immunization toma el
// evento base IMMUNIZATION_DUE (vacuna/dosis/paciente) y su ESTADO por la última transición (DUE->PENDING,
// ADMINISTERED->COMPLETE, REFUSED, ADVERSE_EVENT). Une el lote/sitio/fecha del evento ADMINISTERED (si existe)
// y el nombre del paciente. RLS-scoped.
export type ImmunizationRow=Readonly<{immunizationId:string;patientId:string;patientName:string;vaccine:string;dose:string;lot:string;site:string;status:"COMPLETE"|"PENDING"|"REFUSED"|"ADVERSE";appliedAt:string;registeredBy:string}>;
const IMM_STATUS:Record<string,"COMPLETE"|"PENDING"|"REFUSED"|"ADVERSE">={ADMINISTERED:"COMPLETE",DUE:"PENDING",REFUSED:"REFUSED",ADVERSE_EVENT:"ADVERSE"};
export async function immunizationRegistry(ctx:HttpTenantContext):Promise<ImmunizationRow[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'vaccineCode' as vaccine,
     a.payload->>'dose' as dose, a.occurred_at as due_at, a.actor_id as actor_id,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind,
     (select payload->>'lot' from clinical_events ad where ad.tenant_id=${ctx.tenantId} and ad.aggregate_id=a.aggregate_id and ad.payload->>'kind'='ADMINISTERED' order by sequence desc limit 1) as lot,
     (select payload->>'site' from clinical_events ad where ad.tenant_id=${ctx.tenantId} and ad.aggregate_id=a.aggregate_id and ad.payload->>'kind'='ADMINISTERED' order by sequence desc limit 1) as site,
     (select occurred_at from clinical_events ad where ad.tenant_id=${ctx.tenantId} and ad.aggregate_id=a.aggregate_id and ad.payload->>'kind'='ADMINISTERED' order by sequence desc limit 1) as applied_at,
     (select p.payload->>'name' from clinical_events p where p.tenant_id=${ctx.tenantId} and p.aggregate_type='Patient' and p.payload->>'kind'='REGISTERED' and p.aggregate_id=(a.payload->>'patientId')::uuid limit 1) as patient_name
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Immunization' and a.payload->>'kind'='DUE'
   order by coalesce((select occurred_at from clinical_events ad where ad.tenant_id=${ctx.tenantId} and ad.aggregate_id=a.aggregate_id and ad.payload->>'kind'='ADMINISTERED' order by sequence desc limit 1), a.occurred_at) desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;const applied=o.applied_at??o.due_at;return{
   immunizationId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   vaccine:String(o.vaccine??""),dose:String(o.dose??""),lot:String(o.lot??""),site:String(o.site??""),
   status:IMM_STATUS[String(o.last_kind??"DUE")]??"PENDING",
   appliedAt:applied?new Date(String(applied)).toISOString():"",registeredBy:String(o.actor_id??"")};});
 }) as Promise<ImmunizationRow[]>;
}
// EPIC W/UI — Historial de signos vitales de UN paciente (vista Signos vitales). Devuelve los puntos
// VITAL_RECORDED (tipo/valor/unidad/fecha) ordenados por fecha desc. La agrupación por timestamp en filas
// (una toma = varios tipos con el mismo occurredAt) y las series de tendencia se derivan en la capa de API. RLS-scoped.
export type VitalPoint=Readonly<{at:string;vitalType:string;value:string;unit:string}>;
export async function patientVitals(ctx:HttpTenantContext,patientId:string,limit=400):Promise<VitalPoint[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select v.occurred_at as at, v.payload->>'vitalType' as vital_type, v.payload->>'value' as value, v.payload->>'unit' as unit
   from clinical_events v
   where v.tenant_id=${ctx.tenantId} and v.aggregate_type='VitalSign' and v.payload->>'kind'='RECORDED' and v.payload->>'patientId'=${patientId}
   order by v.occurred_at desc
   limit ${limit}`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   at:o.at?new Date(String(o.at)).toISOString():"",vitalType:String(o.vital_type??""),value:String(o.value??""),unit:String(o.unit??"")};});
 }) as Promise<VitalPoint[]>;
}
// EPIC X/UI — Metas del plan de cuidados de UN paciente (vista Plan de cuidado). Por cada agregado CarePlan
// toma el evento base CAREPLAN_PROPOSED (categoría/meta) y su ESTADO por la última transición
// (PROPOSED/ACTIVATED/RESUMED->ACTIVE, ON_HOLD, ACHIEVED, CANCELLED). RLS-scoped.
export type CarePlanGoal=Readonly<{carePlanId:string;category:string;goal:string;status:"PROPOSED"|"ACTIVE"|"ON_HOLD"|"ACHIEVED"|"CANCELLED";recordedAt:string}>;
const CAREPLAN_STATUS:Record<string,"PROPOSED"|"ACTIVE"|"ON_HOLD"|"ACHIEVED"|"CANCELLED">={PROPOSED:"PROPOSED",ACTIVATED:"ACTIVE",RESUMED:"ACTIVE",HELD:"ON_HOLD",ACHIEVED:"ACHIEVED",CANCELLED:"CANCELLED"};
export async function carePlanGoals(ctx:HttpTenantContext,patientId:string):Promise<CarePlanGoal[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select a.aggregate_id, a.payload->>'category' as category, a.payload->>'goal' as goal, a.occurred_at as recorded_at,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='CarePlan' and a.payload->>'kind'='PROPOSED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at asc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   carePlanId:String(o.aggregate_id),category:String(o.category??"OTHER"),goal:String(o.goal??""),
   status:CAREPLAN_STATUS[String(o.last_kind??"PROPOSED")]??"PROPOSED",
   recordedAt:o.recorded_at?new Date(String(o.recorded_at)).toISOString():""};});
 }) as Promise<CarePlanGoal[]>;
}
// EPIC BA/UI — Obligaciones de seguimiento de UN paciente (vista Seguimiento › Tareas de seguimiento). Por cada
// agregado ClinicalObligation toma el evento base OBLIGATION_CREATED (tarea/fecha límite) y su ESTADO por la
// última transición (CREATED->OPEN, STARTED->IN_PROGRESS, COMPLETED, CANCELLED). RLS-scoped.
export type FollowUpTask=Readonly<{obligationId:string;task:string;dueAt:string;status:"OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED"}>;
const OBLIGATION_STATUS:Record<string,"OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED">={CREATED:"OPEN",STARTED:"IN_PROGRESS",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED"};
export async function patientObligations(ctx:HttpTenantContext,patientId:string):Promise<FollowUpTask[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select a.aggregate_id, a.payload->>'obligationKind' as task, a.payload->>'dueAt' as due_at,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalObligation' and a.payload->>'kind'='CREATED' and a.payload->>'patientId'=${patientId}
   order by a.payload->>'dueAt' asc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   obligationId:String(o.aggregate_id),task:String(o.task??""),dueAt:o.due_at?String(o.due_at):"",
   status:OBLIGATION_STATUS[String(o.last_kind??"CREATED")]??"OPEN"};});
 }) as Promise<FollowUpTask[]>;
}
// EPIC Y/UI — Registro de facturación de TODA la clínica (vista Facturación). Por cada agregado Claim toma el
// evento base CLAIM_DRAFTED (monto/moneda/paciente/fecha) y su ESTADO por la última transición
// (DRAFTED/CODED/SUBMITTED->PENDING, PAID->PAID, REJECTED->REJECTED, VOIDED->VOID). Une el nombre del paciente. RLS-scoped.
export type ClaimRow=Readonly<{claimId:string;patientId:string;patientName:string;amount:string;currency:string;status:"PENDING"|"PAID"|"REJECTED"|"VOID";recordedAt:string}>;
const CLAIM_STATUS:Record<string,"PENDING"|"PAID"|"REJECTED"|"VOID">={DRAFTED:"PENDING",CODED:"PENDING",SUBMITTED:"PENDING",PAID:"PAID",REJECTED:"REJECTED",VOIDED:"VOID"};
export async function claimsRegistry(ctx:HttpTenantContext):Promise<ClaimRow[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'amount' as amount, a.payload->>'currency' as currency, a.occurred_at as recorded_at,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind,
     (select p.payload->>'name' from clinical_events p where p.tenant_id=${ctx.tenantId} and p.aggregate_type='Patient' and p.payload->>'kind'='REGISTERED' and p.aggregate_id=(a.payload->>'patientId')::uuid limit 1) as patient_name
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Claim' and a.payload->>'kind'='DRAFTED'
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   claimId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   amount:String(o.amount??"0"),currency:String(o.currency??"MXN"),
   status:CLAIM_STATUS[String(o.last_kind??"DRAFTED")]??"PENDING",
   recordedAt:o.recorded_at?new Date(String(o.recorded_at)).toISOString():""};});
 }) as Promise<ClaimRow[]>;
}
// EPIC Z/UI — Documentos clínicos de UN paciente (vista Documentos). Por cada agregado ClinicalDocument toma el
// evento base DOCUMENT_CREATED (tipo/título/fecha) y su ESTADO por la última transición
// (CREATED->DRAFT, FINALIZED, SIGNED, AMENDED). RLS-scoped.
export type DocRow=Readonly<{documentId:string;title:string;docType:string;status:"DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED";createdAt:string;actorId:string}>;
const DOC_STATUS:Record<string,"DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED">={CREATED:"DRAFT",FINALIZED:"FINALIZED",SIGNED:"SIGNED",AMENDED:"AMENDED"};
export async function patientDocuments(ctx:HttpTenantContext,patientId:string):Promise<DocRow[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select a.aggregate_id, a.payload->>'title' as title, a.payload->>'docType' as doc_type, a.occurred_at as created_at, a.actor_id as actor_id,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalDocument' and a.payload->>'kind'='CREATED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   documentId:String(o.aggregate_id),title:String(o.title??""),docType:String(o.doc_type??"OTHER"),
   status:DOC_STATUS[String(o.last_kind??"CREATED")]??"DRAFT",
   createdAt:o.created_at?new Date(String(o.created_at)).toISOString():"",actorId:String(o.actor_id??"")};});
 }) as Promise<DocRow[]>;
}
// EPIC AQ/UI — Registro de resultados diagnósticos de TODA la clínica (vista Resultados). Por cada agregado
// DiagnosticResult toma el evento base RESULT_RECEIVED (analito/valor/critical/status/interpretación derivados)
// y su ESTADO por la última transición de ciclo de vida (RECEIVED/VERIFIED/ACTIONED/CLOSED). Une el nombre del
// paciente. El estado-UI (Hallazgos/Normal/En seguimiento/En revisión) se deriva. RLS-scoped.
export type ResultRow=Readonly<{resultId:string;patientId:string;patientName:string;analyte:string;value:string;critical:boolean;status:string;interpretation:string;lifecycle:"RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED";receivedAt:string}>;
const RES_LIFECYCLE:Record<string,"RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED">={RECEIVED:"RECEIVED",VERIFIED:"VERIFIED",ACTIONED:"ACTIONED",CLOSED:"CLOSED"};
export async function resultsRegistry(ctx:HttpTenantContext):Promise<ResultRow[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'analyte' as analyte, a.payload->>'value' as value,
     a.payload->>'critical' as critical, a.payload->>'status' as status, a.payload->>'interpretation' as interpretation, a.occurred_at as received_at,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind,
     (select p.payload->>'name' from clinical_events p where p.tenant_id=${ctx.tenantId} and p.aggregate_type='Patient' and p.payload->>'kind'='REGISTERED' and p.aggregate_id=(a.payload->>'patientId')::uuid limit 1) as patient_name
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='DiagnosticResult' and a.payload->>'kind'='RECEIVED'
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   resultId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   analyte:String(o.analyte??""),value:String(o.value??""),critical:String(o.critical)==="true",
   status:String(o.status??"NORMAL"),interpretation:String(o.interpretation??""),
   lifecycle:RES_LIFECYCLE[String(o.last_kind??"RECEIVED")]??"RECEIVED",
   receivedAt:o.received_at?new Date(String(o.received_at)).toISOString():""};});
 }) as Promise<ResultRow[]>;
}
// EPIC E/UI — Registro de órdenes/solicitudes de estudio de TODA la clínica (Resultados › Solicitudes). Por cada
// agregado ClinicalOrder toma el evento base ORDER_CREATED (tipo/detalle/paciente) y su ESTADO por la última
// transición (CREATED->Solicitada, PLACED->Enviada, FULFILLED->Completada, CANCELLED->Cancelada). Une paciente. RLS-scoped.
export type OrderRow=Readonly<{orderId:string;patientId:string;patientName:string;orderType:string;detail:string;status:"Solicitada"|"Enviada"|"Completada"|"Cancelada";createdAt:string;version:number}>;
const ORDER_STATUS:Record<string,"Solicitada"|"Enviada"|"Completada"|"Cancelada">={CREATED:"Solicitada",PLACED:"Enviada",FULFILLED:"Completada",CANCELLED:"Cancelada"};
export async function ordersRegistry(ctx:HttpTenantContext):Promise<OrderRow[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'orderType' as order_type, a.payload->>'detail' as detail, a.occurred_at as created_at,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind,
     (select count(*)::int from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=a.aggregate_id) as version,
     (select p.payload->>'name' from clinical_events p where p.tenant_id=${ctx.tenantId} and p.aggregate_type='Patient' and p.payload->>'kind'='REGISTERED' and p.aggregate_id=(a.payload->>'patientId')::uuid limit 1) as patient_name
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalOrder' and a.payload->>'kind'='CREATED'
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   orderId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   orderType:String(o.order_type??"LAB"),detail:String(o.detail??""),
   status:ORDER_STATUS[String(o.last_kind??"CREATED")]??"Solicitada",
   createdAt:o.created_at?new Date(String(o.created_at)).toISOString():"",version:Number(o.version??1)};});
 }) as Promise<OrderRow[]>;
}
// EPIC AC/UI — Obligaciones REGULATORIAS del consultorio (vista Obligaciones). Lista los agregados
// RegulatoryObligation (evento CREATED con nombre/categoría/periodicidad/fecha límite). El ESTADO se COMPUTA
// de la fecha límite vs hoy (Vigente si no tiene fecha; Vencida si pasó; Próxima si <=30 días; Al día si no). RLS-scoped.
export type RegulatoryObligationRow=Readonly<{obligationId:string;name:string;category:string;periodicity:string;dueDate:string|null;createdAt:string}>;
export async function regulatoryObligations(ctx:HttpTenantContext):Promise<RegulatoryObligationRow[]>{
 const sql=getSql();
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  const rows=await tx`
   select a.aggregate_id, a.payload->>'name' as name, a.payload->>'category' as category, a.payload->>'periodicity' as periodicity, a.payload->>'dueDate' as due_date, a.occurred_at as created_at
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='RegulatoryObligation' and a.payload->>'kind'='CREATED'
   order by a.payload->>'dueDate' asc nulls last`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   obligationId:String(o.aggregate_id),name:String(o.name??""),category:String(o.category??"Otros"),
   periodicity:String(o.periodicity??""),dueDate:o.due_date?String(o.due_date):null,
   createdAt:o.created_at?new Date(String(o.created_at)).toISOString():""};});
 }) as Promise<RegulatoryObligationRow[]>;
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
