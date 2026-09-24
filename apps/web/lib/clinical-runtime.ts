import postgres,{type Sql,type TransactionSql}from"postgres";
import crypto from"node:crypto";
import{executeAtomicClinicalCommand,type ClinicalCommand}from"../../../packages/atomic-clinical-transaction-v3/src";
import{canonicalize}from"../../../packages/canonical-json/src";
import{type HttpTenantContext}from"../../../packages/http-principal/src";
import{normalizeLabValue}from"../../../packages/lab-reference/src";
// Endpoint directo (sin pooler, sin channel_binding): única fuente de verdad, compartida con los scripts (R01-004).
import{directEndpoint}from"../../../packages/pg-endpoint/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{sliSpan,flowForTopic,type SliFlow}from"../../../packages/observability/src";
import{computeEGFR,type Sex}from"../../../packages/renal-function/src";
import{signatureBlockReason,type SignatureBlockReason}from"../../../packages/obligation-fold/src";
import{sharedAllow,rateLimitedError}from"./rate-limit-shared";
import{assertSessionNotRevoked,revokeSession}from"./session-revocation";
import{logPhiAccess,patientAccessLog,type PhiAccessEntry,type PhiAccessAction,type PhiResourceType}from"./phi-access-log";
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
const wait=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
// Reintenta SOLO fallos de conexión (la transacción no llegó a abrirse o se cortó el socket): ni un comando a medias ni
// un error de dominio se reintentan nunca aquí.
async function withConnectionRetry<T>(flow:SliFlow,correlationId:string,run:()=>Promise<T>):Promise<T>{
 const backoffMs=[120,360];
 for(let attempt=0;;attempt++){
  try{return await run();}
  catch(e){
   if(!isPoolExhausted(e))throw e;
   const code=(e as{code?:string}).code??"POOL_EXHAUSTED";
   // El SLI solo lleva el código del error y el número de intento: nada de PHI (allowlist de packages/observability).
   sliSpan(flow,`db_pool_retry_${attempt}`,correlationId).end("error",{code});
   if(attempt>=backoffMs.length)throw new ClinicalError("DEPENDENCY_UNAVAILABLE","La base de datos no aceptó la conexión (límite de conexiones alcanzado)");
   await wait(backoffMs[attempt]!);
  }
 }
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
// EPIC D — Replay idempotente previo a la validación de state-machine: si este Idempotency-Key
// ya produjo ESTE comando exacto (mismo hash) y quedó COMPLETED, devuelve la respuesta guardada.
// Así un reintento de una transición ya aplicada no choca con la SM (el estado ya avanzó).
// Auditoría L-04/K-05 — Eventos de ANOTACIÓN por tipo de agregado: enriquecen el agregado sin cambiar su estado. Toda
// consulta genérica que derive el estado del "último evento" debe ignorarlos; si no, corregir el teléfono de un paciente
// fallecido lo mostraba ACTIVO, y modificar una dosis habría sacado la medicación de la lista de activas.
// Alias fijo `c` (el de las subconsultas latest_kind). AMENDED es anotación SOLO en Patient (en VitalSign/Document es estado).
const lifecycleEventOnly=(tx:postgres.TransactionSql)=>tx`not (
  (c.aggregate_type='Medication' and c.payload->>'kind' in ('MODIFIED','RECONCILED'))
  or (c.aggregate_type='ClinicalProblem' and c.payload->>'kind' in ('EPISTEMIC_CHANGED','EVIDENCE_UPDATED'))
  or (c.aggregate_type='Patient' and c.payload->>'kind'='AMENDED'))`;
export async function lookupReplay(ctx:HttpTenantContext,command:ClinicalCommand):Promise<ClinicalCommandResult|null>{
 const hash=crypto.createHash("sha256").update(canonicalize(command)).digest("hex");
 return withTenantTx(ctx,async tx=>{
  const r=await tx`select status,request_hash,response_json from command_idempotency where tenant_id=${ctx.tenantId} and actor_id=${ctx.actorId} and key=${command.idempotencyKey}`;
  const row=r[0];
  if(row&&row.status==="COMPLETED"&&row.request_hash===hash)return{replayed:true,response:row.response_json};
  return null;
 });
}

// Auditoría 2026-09-19 (S-08) — PAGINACIÓN por cursor (keyset). El cursor es opaco (base64url de la clave de orden); un
// cursor ilegible se ignora y se empieza desde el principio (nunca 500). `limit` lo acota el handler (1..MAX).
export type Page<T>=Readonly<{items:readonly T[];nextCursor:string|null}>;
export function encodeCursor(v:readonly unknown[]):string{return Buffer.from(JSON.stringify(v),"utf8").toString("base64url");}
export function decodeCursor(c:string|null|undefined,arity:number):unknown[]|null{
 if(!c)return null;
 try{const v:unknown=JSON.parse(Buffer.from(c,"base64url").toString("utf8"));return Array.isArray(v)&&v.length===arity?v:null;}catch{return null;}
}
export const PAGE_LIMIT_DEFAULT=100,PAGE_LIMIT_MAX=500;
export function clampLimit(raw:string|null|undefined,def=PAGE_LIMIT_DEFAULT,max=PAGE_LIMIT_MAX):number{const n=Number(raw);return Number.isInteger(n)&&n>=1?Math.min(n,max):def;}
// EPIC S — Registro de pacientes del tenant (RLS-scoped). Devuelve id + nombre (PHI) + estado.
export type PatientRow=Readonly<{patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string;version:number}>;
export type PatientListQuery=Readonly<{limit:number;cursor?:string|null;q?:string|null}>;
export async function listPatients(ctx:HttpTenantContext,query:PatientListQuery={limit:PAGE_LIMIT_MAX}):Promise<Page<PatientRow>&{total:number}>{
 // Orden estable (nombre, id); el cursor es el último (nombre, id) de la página anterior. `q` filtra por prefijo de nombre
 // (cualquier palabra) o de CURP, sin distinguir mayúsculas/acentos básicos.
 const after=decodeCursor(query.cursor,2);const afterName=after?String(after[0]):null,afterId=after?String(after[1]):null;
 const q=(query.q??"").trim().toLowerCase();
 return withTenantTx(ctx,async tx=>{
  const total=await tx`select count(*)::int as n from clinical_events where tenant_id=${ctx.tenantId} and aggregate_type='Patient' and payload->>'kind'='REGISTERED'`;
  const rows=await tx`
   select * from (
   select r.aggregate_id,
     coalesce(a.payload->>'name', r.payload->>'name') as name,
     coalesce(a.payload->>'birthDate', r.payload->>'birthDate') as birth_date,
     coalesce(a.payload->>'sexAtBirth', r.payload->>'sexAtBirth') as sex_at_birth,
     coalesce(a.payload->>'curp', r.payload->>'curp') as curp,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and ${lifecycleEventOnly(tx)} order by sequence desc limit 1) as latest_kind,
     (select count(*)::int from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=r.aggregate_id) as version
   from clinical_events r
   left join lateral (select payload from clinical_events am where am.tenant_id=${ctx.tenantId} and am.aggregate_id=r.aggregate_id and am.payload->>'kind'='AMENDED' order by am.sequence desc limit 1) a on true
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Patient' and r.payload->>'kind'='REGISTERED'
   ) p
   where (${q}='' or lower(p.name) like ${q+'%'} or lower(p.name) like ${'% '+q+'%'} or lower(coalesce(p.curp,'')) like ${q+'%'})
     and (${afterName}::text is null or (p.name, p.aggregate_id::text) > (${afterName}::text, ${afterId}::text))
   order by p.name, p.aggregate_id
   limit ${query.limit+1}`;
  const STATUS:Record<string,string>={REGISTERED:"ACTIVE",REACTIVATED:"ACTIVE",DEACTIVATED:"INACTIVE",DECEASED:"DECEASED"};
  const items=rows.slice(0,query.limit).map(x=>{const o=x as Record<string,unknown>;return{patientId:String(o.aggregate_id),name:String(o.name??""),status:STATUS[String(o.latest_kind??"REGISTERED")]??"ACTIVE",version:Number(o.version??1),...(o.birth_date?{birthDate:String(o.birth_date)}:{}),...(o.sex_at_birth?{sexAtBirth:String(o.sex_at_birth)}:{}),...(o.curp?{curp:String(o.curp)}:{})};});
  const last=items[items.length-1];
  return{items,nextCursor:rows.length>query.limit&&last?encodeCursor([last.name,last.patientId]):null,total:Number(total[0]?.n??0)};
 });
}
// EPIC R — Gate de seguridad de medicación: sustancias con alergia ACTIVA del paciente (RLS-scoped).
// Una alergia está activa si su último evento es RECORDED o REACTIVATED (no REFUTED/INACTIVATED).
// Auditoría C-06: la barrera necesita GRAVEDAD y REACCIÓN, no solo la sustancia (una intolerancia leve no es una anafilaxia).
export type ActiveAllergy=Readonly<{substance:string;severity:"MILD"|"MODERATE"|"SEVERE"|null;reaction:string|null}>;
// La gravedad viaja como texto en el payload jsonb: se estrecha aquí (lo que no es una de las tres es «desconocida»,
// nunca «leve»). Antes esto lo tapaba un `as Promise<ActiveAllergy[]>` sobre el resultado de la transacción.
const asSeverity=(v:unknown):"MILD"|"MODERATE"|"SEVERE"|null=>{const s=String(v??"");return s==="MILD"||s==="MODERATE"||s==="SEVERE"?s:null;};
export async function activeAllergies(ctx:HttpTenantContext,patientId:string):Promise<ActiveAllergy[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'substance' as substance, r.payload->>'severity' as severity, r.payload->>'reaction' as reaction
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Allergy' and r.payload->>'kind'='RECORDED' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) in ('RECORDED','REACTIVATED')`;
  return rows.map(x=>({substance:String(x.substance??""),severity:asSeverity(x.severity),reaction:x.reaction==null?null:String(x.reaction)})).filter(a=>a.substance);
 });
}
export async function activeAllergySubstances(ctx:HttpTenantContext,patientId:string):Promise<string[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'substance' as substance
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Allergy' and r.payload->>'kind'='RECORDED' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) in ('RECORDED','REACTIVATED')`;
  return rows.map(x=>String(x.substance??"")).filter(Boolean);
 });
}
// EPIC AW — Medicaciones ACTIVAS del paciente (último kind ACTIVATED). RLS-scoped. Para el check de
// duplicación terapéutica en la prescripción. Devuelve drugCode.
// Auditoría L-04/K-05: el estado se deriva del último evento DE CICLO DE VIDA. Antes era "último evento = ACTIVATED": una
// medicación reanudada (RESUMED) dejaba de contar como activa, y cualquier anotación (MODIFIED/RECONCILED) la habría hecho
// desaparecer de las barreras de interacción y duplicidad. `excludeMedicationId`: al MODIFICAR una medicación activa no
// debe compararse consigo misma.
export async function activeMedicationDrugCodes(ctx:HttpTenantContext,patientId:string,excludeMedicationId?:string):Promise<string[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'drugCode' as drug_code
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Medication' and r.payload->>'kind'='PROPOSED' and r.payload->>'patientId'=${patientId}
     and r.aggregate_id::text<>${excludeMedicationId??""}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id
           and c.payload->>'kind' not in ('MODIFIED','RECONCILED') order by sequence desc limit 1) in ('ACTIVATED','RESUMED')`;
  return rows.map(x=>String(x.drug_code??"")).filter(Boolean);
 });
}
// EPIC BK/BL — Demografía del paciente (nacimiento + sexo, del evento REGISTERED). RLS-scoped.
// Auditoría L-06: `guardian` (tutor o representante legal) para menores de edad; lo fija el alta o una enmienda.
export type PatientGuardian=Readonly<{name:string;relationship:string;phone?:string}>;
export type PatientDemographics=Readonly<{birthDate?:string;sexAtBirth?:string;curp?:string;phone?:string;email?:string;address?:string;occupation?:string;maritalStatus?:string;name?:string;guardian?:PatientGuardian}>;
export async function patientDemographics(ctx:HttpTenantContext,patientId:string):Promise<PatientDemographics|undefined>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`select
     coalesce(a.payload->>'birthDate', r.payload->>'birthDate') as bd,
     coalesce(a.payload->>'sexAtBirth', r.payload->>'sexAtBirth') as sx,
     coalesce(a.payload->>'name', r.payload->>'name') as nm,
     coalesce(a.payload->>'curp', r.payload->>'curp') as curp,
     coalesce(a.payload->>'phone', r.payload->>'phone') as phone,
     coalesce(a.payload->>'email', r.payload->>'email') as email,
     coalesce(a.payload->>'address', r.payload->>'address') as address,
     coalesce(a.payload->>'occupation', r.payload->>'occupation') as occupation,
     coalesce(a.payload->>'maritalStatus', r.payload->>'maritalStatus') as marital,
     coalesce(a.payload->'guardian', r.payload->'guardian') as guardian
   from clinical_events r
   left join lateral (select payload from clinical_events am where am.tenant_id=${ctx.tenantId} and am.aggregate_id=r.aggregate_id and am.payload->>'kind'='AMENDED' order by am.sequence desc limit 1) a on true
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Patient' and r.payload->>'kind'='REGISTERED' and r.aggregate_id=${patientId} limit 1`;
  const row=rows[0] as Record<string,unknown>|undefined;
  if(!row)return undefined;
  // R01-026: constancia de acceso de lectura a PHI (en la misma transacción que la consulta).
  await logPhiAccess(tx,ctx,{resourceType:"PATIENT_DEMOGRAPHICS",resourceId:patientId,patientId});
  const d:{-readonly[K in keyof PatientDemographics]:PatientDemographics[K]}={};
  const set=(k:Exclude<keyof PatientDemographics,"guardian">,v:unknown)=>{if(v!=null)d[k]=String(v);};
  set("birthDate",row.bd);set("sexAtBirth",row.sx);set("name",row.nm);set("curp",row.curp);set("phone",row.phone);set("email",row.email);set("address",row.address);set("occupation",row.occupation);set("maritalStatus",row.marital);
  const g=row.guardian as{name?:unknown;relationship?:unknown;phone?:unknown}|null|undefined;
  if(g&&typeof g==="object"&&typeof g.name==="string"&&g.name.trim()!==""){d.guardian={name:g.name,relationship:typeof g.relationship==="string"?g.relationship:"",...(typeof g.phone==="string"&&g.phone?{phone:g.phone}:{})};}
  return d;
 });
}
// Auditoría 2026-09-19 (L-07) — el `patientId` de un comando de creación debe ser un paciente REGISTRADO del tenant y no
// fallecido: antes cualquier UUID válido creaba signos vitales, alergias, medicaciones o ingresos "huérfanos" (un error de
// cliente o un identificador de otro tenant). NOT_FOUND si no existe; CONFLICT si está fallecido (los datos de un paciente
// fallecido se corrigen con enmiendas, no con altas nuevas). Un paciente INACTIVO sigue admitiendo registros (p. ej. un
// resultado que llega tras la baja).
export async function requireRegisteredPatient(ctx:HttpTenantContext,patientId:string):Promise<void>{
 const status=await withTenantTx(ctx,async tx=>{
  const rows=await tx`select payload->>'kind' as kind from clinical_events where tenant_id=${ctx.tenantId} and aggregate_type='Patient' and aggregate_id=${patientId} and payload->>'kind' in ('REGISTERED','DEACTIVATED','REACTIVATED','DECEASED') order by sequence desc limit 1`;
  const row=rows[0] as{kind:string}|undefined;return row?.kind??null;
 });
 if(status===null)throw new ClinicalError("NOT_FOUND","Patient not registered in this tenant",{patientId});
 if(status==="DECEASED")throw new ClinicalError("CONFLICT","El paciente está registrado como fallecido: no se admiten registros clínicos nuevos",{patientId});
}
// Auditoría L-06 — detección de duplicados al dar de alta: misma CURP en el tenant (identidad legal única) o mismo nombre
// normalizado + misma fecha de nacimiento (sospecha fuerte que el usuario puede confirmar como no duplicado).
export type PatientDuplicate=Readonly<{patientId:string;by:"CURP"|"NAME_BIRTHDATE"}>;
export async function findPatientDuplicate(ctx:HttpTenantContext,q:{curp?:string|undefined;normalizedName?:string|undefined;birthDate?:string|undefined}):Promise<PatientDuplicate|undefined>{
 return withTenantTx(ctx,async tx=>{
  if(q.curp){
   const byCurp=await tx`select r.aggregate_id from clinical_events r where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Patient' and r.payload->>'kind'='REGISTERED' and upper(r.payload->>'curp')=${q.curp} limit 1`;
   const row=byCurp[0] as{aggregate_id:string}|undefined;if(row)return{patientId:String(row.aggregate_id),by:"CURP"};
  }
  if(!q.normalizedName||!q.birthDate)return undefined;
  // Nombre: se compara sin acentos ni mayúsculas (unaccent no está garantizado en Neon: se normaliza en SQL con translate).
  const byName=await tx`select r.aggregate_id from clinical_events r where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Patient' and r.payload->>'kind'='REGISTERED'
    and r.payload->>'birthDate'=${q.birthDate}
    and btrim(regexp_replace(lower(translate(r.payload->>'name','ÁÉÍÓÚÜáéíóúü','AEIOUUaeiouu')),'\\s+',' ','g'))=${q.normalizedName} limit 1`;
  const row=byName[0] as{aggregate_id:string}|undefined;return row?{patientId:String(row.aggregate_id),by:"NAME_BIRTHDATE"}:undefined;
 });
}
// EPIC BK — Fecha de nacimiento del paciente (del evento REGISTERED). RLS-scoped. Para el pronóstico de vacunación.
export async function patientBirthDate(ctx:HttpTenantContext,patientId:string):Promise<string|undefined>{
 const d=await patientDemographics(ctx,patientId);return d?.birthDate;
}
// EPIC BM — eGFR del paciente (CKD-EPI) desde demografía + última creatinina. undefined si no computable
// (sin datos, pediátrico, sexo no binario). Para el gate renal de la prescripción.
// Antigüedad máxima de la creatinina para decidir dosis (criterio de ingeniería, pendiente de validación clínica).
const EGFR_MAX_CREATININE_AGE_DAYS=365;
export async function patientEgfr(ctx:HttpTenantContext,patientId:string):Promise<number|undefined>{
 const demo=await patientDemographics(ctx,patientId);
 if(!demo?.birthDate)return undefined;
 const sex=demo.sexAtBirth;if(sex!=="FEMALE"&&sex!=="MALE")return undefined;
 const b=new Date(demo.birthDate),a=new Date();
 if(Number.isNaN(b.getTime()))return undefined;
 let age=a.getUTCFullYear()-b.getUTCFullYear();
 if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))age-=1;
 if(age<18)return undefined; // CKD-EPI adulto; en pediatría se usa Schwartz
 // Auditoría C-01/C-12: la barrera renal de prescripción NO debe decidir con una creatinina en otra unidad, implausible
 // u obsoleta. Si el dato no es utilizable, el eGFR es "desconocido" (=> la barrera queda NOT_EVALUATED, nunca "OK").
 const r=await latestAnalyteReading(ctx,patientId,"CREATININE");
 if(!r)return undefined;
 const n=normalizeLabValue("CREATININE",r.value);
 if(!n.ok)return undefined;
 if((Date.now()-new Date(r.occurredAt).getTime())/86_400_000>EGFR_MAX_CREATININE_AGE_DAYS)return undefined;
 return computeEGFR(n.canonicalValue,age,sex as Sex)?.egfr;
}
// EPIC BK — Códigos de vacunas ADMINISTRADAS del paciente (último kind ADMINISTERED). RLS-scoped.
// Auditoría C-10: las dosis periódicas (influenza anual, Td decenal) se deciden por la FECHA de la última aplicación.
export type AdministeredVaccine=Readonly<{code:string;occurredAt:string|null}>;
export async function administeredVaccines(ctx:HttpTenantContext,patientId:string):Promise<AdministeredVaccine[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'vaccineCode' as code,
     (select occurred_at from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and c.payload->>'kind'='ADMINISTERED' order by sequence desc limit 1) as administered_at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Immunization' and r.payload->>'kind'='DUE' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1)='ADMINISTERED'`;
  return rows.map(x=>({code:String(x.code??""),occurredAt:x.administered_at?new Date(String(x.administered_at)).toISOString():null})).filter(v=>v.code);
 });
}
export async function administeredVaccineCodes(ctx:HttpTenantContext,patientId:string):Promise<string[]>{return(await administeredVaccines(ctx,patientId)).map(v=>v.code);}
// EPIC BC — Último valor registrado por tipo de signo vital del paciente (para computar NEWS2). RLS-scoped.
// Toma el evento RECORDED más reciente por vitalType. Devuelve un mapa {vitalType -> value textual}.
export async function latestVitalsByType(ctx:HttpTenantContext,patientId:string):Promise<Record<string,string>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select distinct on (r.payload->>'vitalType') r.payload->>'vitalType' as vital_type, r.payload->>'value' as value
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='VitalSign' and r.payload->>'kind'='RECORDED'
     and r.payload->>'patientId'=${patientId}
   order by r.payload->>'vitalType', r.occurred_at desc, r.sequence desc`;
  const out:Record<string,string>={};for(const x of rows){const k=String(x.vital_type??"");if(k)out[k]=String(x.value??"");}
  return out;
 });
}
// EPIC BB — Valor PREVIO del mismo analito del paciente (resultado más reciente ya recibido). RLS-scoped.
// Para el delta check de laboratorio en la recepción de un resultado nuevo. Devuelve el value textual o undefined.
// `excludeResultId`: al RECIBIR un resultado, el "previo" jamás debe ser el propio resultado. Sin esto, el REINTENTO
// idempotente de un resultado con Δ crítico se comparaba contra sí mismo, producía otro payload y el kernel lo rechazaba
// por "misma llave, distinto contenido" en vez de devolver la respuesta original.
export async function latestResultValueForAnalyte(ctx:HttpTenantContext,patientId:string,analyte:string,excludeResultId?:string):Promise<string|undefined>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select coalesce(r.payload->>'canonicalValue',r.payload->>'value') as value
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult' and r.payload->>'kind'='RECEIVED'
     and r.payload->>'patientId'=${patientId} and upper(r.payload->>'analyte')=upper(${analyte})
     and r.aggregate_id::text<>${excludeResultId??""}
     and not exists(select 1 from clinical_events s where s.tenant_id=${ctx.tenantId} and s.aggregate_type='DiagnosticResult' and s.payload->>'kind'='RECEIVED' and s.payload->>'supersedes'=r.aggregate_id::text) -- C-02: corregido -> se lee el nuevo
   order by r.occurred_at desc, r.sequence desc limit 1`;
  const v=rows[0]?.value;if(v==null)return undefined;
  // Auditoría C-01: un valor físicamente IMPLAUSIBLE en la unidad canónica (evento antiguo capturado sin unidad en otra
  // escala) no se entrega como "el último valor" a ningún consumidor (paneles, contexto de referencia, delta-check).
  const n=normalizeLabValue(analyte,String(v));
  return !n.ok&&n.reason==="IMPLAUSIBLE"?undefined:String(v);
 });
}

// Auditoría 2026-09-19 (C-01/C-11/C-12) — Lectura COMPLETA del último resultado de un analito para CÁLCULOS:
// valor en unidad canónica + unidad declarada + si la unidad fue asumida + fecha + muestra + id del resultado.
// `latestResultValueForAnalyte` devuelve solo el número y por eso ninguna calculadora podía verificar nada.
export type AnalyteReading=Readonly<{analyte:string;rawValue:string;value:number;unit:string|null;canonicalUnit:string|null;unitAssumed:boolean;occurredAt:string;resultId:string;specimenId:string|null}>;
export async function latestAnalyteReading(ctx:HttpTenantContext,patientId:string,analyte:string):Promise<AnalyteReading|undefined>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.aggregate_id as result_id, r.occurred_at as at, r.payload->>'value' as raw, r.payload->>'canonicalValue' as canonical,
          r.payload->>'unit' as unit, r.payload->>'canonicalUnit' as canonical_unit, r.payload->>'unitAssumed' as unit_assumed, r.payload->>'specimenId' as specimen_id
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult' and r.payload->>'kind'='RECEIVED'
     and r.payload->>'patientId'=${patientId} and upper(r.payload->>'analyte')=upper(${analyte})
     and not exists(select 1 from clinical_events s where s.tenant_id=${ctx.tenantId} and s.aggregate_type='DiagnosticResult' and s.payload->>'kind'='RECEIVED' and s.payload->>'supersedes'=r.aggregate_id::text) -- C-02: corregido -> se lee el nuevo
   order by r.occurred_at desc, r.sequence desc limit 1`;
  const o=rows[0] as Record<string,unknown>|undefined;if(!o)return undefined;
  const raw=String(o["raw"]??"");const canonical=o["canonical"]==null?Number(raw.trim().replace(",",".")):Number(o["canonical"]);
  // Eventos anteriores a esta corrección no traen unidad: se declara `unitAssumed` (la plausibilidad se valida al usarlo).
  const legacy=o["canonical"]==null;
  return{analyte:analyte.toUpperCase(),rawValue:raw,value:canonical,unit:o["unit"]==null?null:String(o["unit"]),canonicalUnit:o["canonical_unit"]==null?null:String(o["canonical_unit"]),
   unitAssumed:legacy?true:String(o["unit_assumed"])==="true",occurredAt:new Date(String(o["at"])).toISOString(),resultId:String(o["result_id"]),specimenId:o["specimen_id"]==null?null:String(o["specimen_id"])};
 });
}

// EPIC CH — Serie temporal de un analito (evolución longitudinal, panel 4). Todos los resultados
// RECEIVED de ese analito, orden ascendente por fecha. RLS-scoped; valores numéricos.
export async function analyteSeries(ctx:HttpTenantContext,patientId:string,analyte:string):Promise<{value:number;at:string}[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select coalesce(r.payload->>'canonicalValue',r.payload->>'value') as value, r.occurred_at as at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult' and r.payload->>'kind'='RECEIVED'
     and r.payload->>'patientId'=${patientId} and upper(r.payload->>'analyte')=upper(${analyte})
     and not exists(select 1 from clinical_events s where s.tenant_id=${ctx.tenantId} and s.aggregate_type='DiagnosticResult' and s.payload->>'kind'='RECEIVED' and s.payload->>'supersedes'=r.aggregate_id::text) -- C-02: corregido -> se lee el nuevo
   order by r.occurred_at asc, r.sequence asc`;
  // Los puntos implausibles se EXCLUYEN de la serie: un solo valor en otra escala deforma la tendencia y su pendiente.
  return rows.map(r=>{const o=r as Record<string,unknown>;return{value:Number(o.value),at:String(o.at)};}).filter(p=>Number.isFinite(p.value)&&normalizeLabValue(analyte,p.value).ok);
 });
}

// EPIC CM — Agenda del día: citas cuyo startAt cae en [fromIso, toIso), con estado (última transición)
// y nombre del paciente. RLS-scoped. Comparación por string ISO (orden lexicográfico correcto).
export type AgendaAppt=Readonly<{appointmentId:string;patientId:string;patientName:string;startAt:string;endAt:string|null;reason:string;consultorio:string|null;apptType:string|null;status:string;version:number}>;
export async function agendaForDate(ctx:HttpTenantContext,fromIso:string,toIso:string):Promise<AgendaAppt[]>{
 return withTenantTx(ctx,async tx=>{
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
 });
}
// EPIC R/UI — Registro de alergias de TODA la clínica (vista Alergias). Por cada agregado Allergy toma el
// evento base ALLERGY_RECORDED (sustancia/gravedad/reacción/paciente/fecha/actor) y su ESTADO por la última
// transición (RECORDED/REACTIVATED->ACTIVE, REFUTED->REFUTED, INACTIVATED->INACTIVE). Une el nombre del
// paciente. RLS-scoped. El tipo del alérgeno y las gráficas se derivan en la capa de API/UI (classifyAllergen).
export type AllergyRow=Readonly<{allergyId:string;patientId:string;patientName:string;substance:string;reaction:string;severity:"MILD"|"MODERATE"|"SEVERE";status:"ACTIVE"|"REFUTED"|"INACTIVE";recordedAt:string;registeredBy:string}>;
const ALLERGY_STATUS:Record<string,"ACTIVE"|"REFUTED"|"INACTIVE">={RECORDED:"ACTIVE",REACTIVATED:"ACTIVE",REFUTED:"REFUTED",INACTIVATED:"INACTIVE"};
export async function allergyRegistry(ctx:HttpTenantContext):Promise<AllergyRow[]>{
 return withTenantTx(ctx,async tx=>{
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
 });
}
// EPIC Q/UI — Registro de problemas de TODA la clínica (vista Problemas). Por cada agregado ClinicalProblem
// toma el evento base PROBLEM_ADDED (código CIE-10/descripción/categoría/paciente/fecha) y su ESTADO por la
// última transición de CICLO DE VIDA (ADDED/REACTIVATED->ACTIVE, MARKED_CHRONIC->CHRONIC, RESOLVED->RESOLVED,
// ENTERED_IN_ERROR->INACTIVE; ignora EPISTEMIC/EVIDENCE que no cambian el estado). Une el nombre del paciente.
export type ProblemRow=Readonly<{problemId:string;patientId:string;patientName:string;code:string;description:string;category:string;status:"ACTIVE"|"CHRONIC"|"RESOLVED"|"INACTIVE";recordedAt:string;registeredBy:string}>;
const PROBLEM_STATUS:Record<string,"ACTIVE"|"CHRONIC"|"RESOLVED"|"INACTIVE">={ADDED:"ACTIVE",REACTIVATED:"ACTIVE",MARKED_CHRONIC:"CHRONIC",RESOLVED:"RESOLVED",ENTERED_IN_ERROR:"INACTIVE"};
export async function problemRegistry(ctx:HttpTenantContext):Promise<ProblemRow[]>{
 return withTenantTx(ctx,async tx=>{
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
 });
}
// EPIC V/UI — Registro de vacunas de TODA la clínica (vista Vacunas). Por cada agregado Immunization toma el
// evento base IMMUNIZATION_DUE (vacuna/dosis/paciente) y su ESTADO por la última transición (DUE->PENDING,
// ADMINISTERED->COMPLETE, REFUSED, ADVERSE_EVENT). Une el lote/sitio/fecha del evento ADMINISTERED (si existe)
// y el nombre del paciente. RLS-scoped.
export type ImmunizationRow=Readonly<{immunizationId:string;patientId:string;patientName:string;vaccine:string;dose:string;lot:string;site:string;status:"COMPLETE"|"PENDING"|"REFUSED"|"ADVERSE";appliedAt:string;registeredBy:string}>;
const IMM_STATUS:Record<string,"COMPLETE"|"PENDING"|"REFUSED"|"ADVERSE">={ADMINISTERED:"COMPLETE",DUE:"PENDING",REFUSED:"REFUSED",ADVERSE_EVENT:"ADVERSE"};
export async function immunizationRegistry(ctx:HttpTenantContext):Promise<ImmunizationRow[]>{
 return withTenantTx(ctx,async tx=>{
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
 });
}
// EPIC W/UI — Historial de signos vitales de UN paciente (vista Signos vitales). Devuelve los puntos
// VITAL_RECORDED (tipo/valor/unidad/fecha) ordenados por fecha desc. La agrupación por timestamp en filas
// (una toma = varios tipos con el mismo occurredAt) y las series de tendencia se derivan en la capa de API. RLS-scoped.
export type VitalPoint=Readonly<{at:string;vitalType:string;value:string;unit:string}>;
export async function patientVitals(ctx:HttpTenantContext,patientId:string,limit=400):Promise<VitalPoint[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select v.occurred_at as at, v.payload->>'vitalType' as vital_type, v.payload->>'value' as value, v.payload->>'unit' as unit
   from clinical_events v
   where v.tenant_id=${ctx.tenantId} and v.aggregate_type='VitalSign' and v.payload->>'kind'='RECORDED' and v.payload->>'patientId'=${patientId}
   order by v.occurred_at desc
   limit ${limit}`;
  // R01-026: constancia de acceso de lectura a PHI (en la misma transacción que la consulta).
  await logPhiAccess(tx,ctx,{resourceType:"PATIENT_VITALS",resourceId:patientId,patientId});
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   at:o.at?new Date(String(o.at)).toISOString():"",vitalType:String(o.vital_type??""),value:String(o.value??""),unit:String(o.unit??"")};});
 });
}
// EPIC X/UI — Metas del plan de cuidados de UN paciente (vista Plan de cuidado). Por cada agregado CarePlan
// toma el evento base CAREPLAN_PROPOSED (categoría/meta) y su ESTADO por la última transición
// (PROPOSED/ACTIVATED/RESUMED->ACTIVE, ON_HOLD, ACHIEVED, CANCELLED). RLS-scoped.
export type CarePlanGoal=Readonly<{carePlanId:string;category:string;goal:string;status:"PROPOSED"|"ACTIVE"|"ON_HOLD"|"ACHIEVED"|"CANCELLED";recordedAt:string}>;
const CAREPLAN_STATUS:Record<string,"PROPOSED"|"ACTIVE"|"ON_HOLD"|"ACHIEVED"|"CANCELLED">={PROPOSED:"PROPOSED",ACTIVATED:"ACTIVE",RESUMED:"ACTIVE",HELD:"ON_HOLD",ACHIEVED:"ACHIEVED",CANCELLED:"CANCELLED"};
export async function carePlanGoals(ctx:HttpTenantContext,patientId:string):Promise<CarePlanGoal[]>{
 return withTenantTx(ctx,async tx=>{
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
 });
}
// EPIC BA/UI — Obligaciones de seguimiento de UN paciente (vista Seguimiento › Tareas de seguimiento). Por cada
// agregado ClinicalObligation toma el evento base OBLIGATION_CREATED (tarea/fecha límite) y su ESTADO por la
// última transición (CREATED->OPEN, STARTED->IN_PROGRESS, COMPLETED, CANCELLED). RLS-scoped.
export type FollowUpTask=Readonly<{obligationId:string;task:string;dueAt:string;status:"OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";priority:string;blocksSignature:SignatureBlockReason|null}>;
const OBLIGATION_STATUS:Record<string,"OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED">={CREATED:"OPEN",STARTED:"IN_PROGRESS",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED"};
export async function patientObligations(ctx:HttpTenantContext,patientId:string):Promise<FollowUpTask[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'obligationKind' as task, a.payload->>'dueAt' as due_at, a.payload->>'priority' as priority,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalObligation' and a.payload->>'kind'='CREATED' and a.payload->>'patientId'=${patientId}
   order by a.payload->>'dueAt' asc`;
  const asOf=new Date().toISOString();
  return rows.map(r=>{const o=r as Record<string,unknown>;
   const status=OBLIGATION_STATUS[String(o.last_kind??"CREATED")]??"OPEN";const dueAt=o.due_at?String(o.due_at):"";const priority=o.priority==null?"ROUTINE":String(o.priority);
   return{obligationId:String(o.aggregate_id),task:String(o.task??""),dueAt,status,priority,blocksSignature:signatureBlockReason({state:status,priority,dueAt},asOf)??null};});
 });
}
// EPIC Y/UI — Registro de facturación de TODA la clínica (vista Facturación). Por cada agregado Claim toma el
// evento base CLAIM_DRAFTED (monto/moneda/paciente/fecha) y su ESTADO por la última transición
// (DRAFTED/CODED/SUBMITTED->PENDING, PAID->PAID, REJECTED->REJECTED, VOIDED->VOID). Une el nombre del paciente. RLS-scoped.
// Auditoría L-09: `paidAt` (fecha del evento PAID) permite calcular los ingresos DEL PERIODO; antes se sumaba toda la historia.
export type ClaimRow=Readonly<{claimId:string;patientId:string;patientName:string;amount:string;currency:string;status:"PENDING"|"PAID"|"REJECTED"|"VOID";recordedAt:string;paidAt:string|null}>;
const CLAIM_STATUS:Record<string,"PENDING"|"PAID"|"REJECTED"|"VOID">={DRAFTED:"PENDING",CODED:"PENDING",SUBMITTED:"PENDING",PAID:"PAID",REJECTED:"REJECTED",VOIDED:"VOID"};
export async function claimsRegistry(ctx:HttpTenantContext):Promise<ClaimRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'amount' as amount, a.payload->>'currency' as currency, a.occurred_at as recorded_at,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind,
     (select c.occurred_at from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id and c.payload->>'kind'='PAID' order by sequence desc limit 1) as paid_at,
     (select p.payload->>'name' from clinical_events p where p.tenant_id=${ctx.tenantId} and p.aggregate_type='Patient' and p.payload->>'kind'='REGISTERED' and p.aggregate_id=(a.payload->>'patientId')::uuid limit 1) as patient_name
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Claim' and a.payload->>'kind'='DRAFTED'
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   claimId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   amount:String(o.amount??"0"),currency:String(o.currency??"MXN"),
   status:CLAIM_STATUS[String(o.last_kind??"DRAFTED")]??"PENDING",
   recordedAt:o.recorded_at?new Date(String(o.recorded_at)).toISOString():"",
   paidAt:o.paid_at?new Date(String(o.paid_at)).toISOString():null};});
 });
}
// EPIC Z/UI — Documentos clínicos de UN paciente (vista Documentos). Por cada agregado ClinicalDocument toma el
// evento base DOCUMENT_CREATED (tipo/título/fecha) y su ESTADO por la última transición
// (CREATED->DRAFT, FINALIZED, SIGNED, AMENDED). RLS-scoped.
export type DocRow=Readonly<{documentId:string;title:string;docType:string;status:"DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED";createdAt:string;actorId:string}>;
const DOC_STATUS:Record<string,"DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED">={CREATED:"DRAFT",FINALIZED:"FINALIZED",SIGNED:"SIGNED",AMENDED:"AMENDED"};
export async function patientDocuments(ctx:HttpTenantContext,patientId:string):Promise<DocRow[]>{
 return withTenantTx(ctx,async tx=>{
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
 });
}
// EPIC AQ/UI — Registro de resultados diagnósticos de TODA la clínica (vista Resultados). Por cada agregado
// DiagnosticResult toma el evento base RESULT_RECEIVED (analito/valor/critical/status/interpretación derivados)
// y su ESTADO por la última transición de ciclo de vida (RECEIVED/VERIFIED/ACTIONED/CLOSED). Une el nombre del
// paciente. El estado-UI (Hallazgos/Normal/En seguimiento/En revisión) se deriva. RLS-scoped.
export type ResultRow=Readonly<{resultId:string;patientId:string;patientName:string;analyte:string;value:string;critical:boolean;status:string;interpretation:string;lifecycle:"RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED";receivedAt:string}>;
const RES_LIFECYCLE:Record<string,"RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED">={RECEIVED:"RECEIVED",VERIFIED:"VERIFIED",ACTIONED:"ACTIONED",CLOSED:"CLOSED"};
export async function resultsRegistry(ctx:HttpTenantContext):Promise<ResultRow[]>{
 return withTenantTx(ctx,async tx=>{
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
 });
}
// EPIC E/UI — Registro de órdenes/solicitudes de estudio de TODA la clínica (Resultados › Solicitudes). Por cada
// agregado ClinicalOrder toma el evento base ORDER_CREATED (tipo/detalle/paciente) y su ESTADO por la última
// transición (CREATED->Solicitada, PLACED->Enviada, FULFILLED->Completada, CANCELLED->Cancelada). Une paciente. RLS-scoped.
export type OrderRow=Readonly<{orderId:string;patientId:string;patientName:string;orderType:string;detail:string;status:"Solicitada"|"Enviada"|"Completada"|"Cancelada";createdAt:string;version:number}>;
const ORDER_STATUS:Record<string,"Solicitada"|"Enviada"|"Completada"|"Cancelada">={CREATED:"Solicitada",PLACED:"Enviada",FULFILLED:"Completada",CANCELLED:"Cancelada"};
export async function ordersRegistry(ctx:HttpTenantContext):Promise<OrderRow[]>{
 return withTenantTx(ctx,async tx=>{
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
 });
}
// EPIC AC/UI — Obligaciones REGULATORIAS del consultorio (vista Obligaciones). Lista los agregados
// RegulatoryObligation (evento CREATED con nombre/categoría/periodicidad/fecha límite). El ESTADO se COMPUTA
// de la fecha límite vs hoy (Vigente si no tiene fecha; Vencida si pasó; Próxima si <=30 días; Al día si no). RLS-scoped.
export type RegulatoryObligationRow=Readonly<{obligationId:string;name:string;category:string;periodicity:string;dueDate:string|null;createdAt:string}>;
export async function regulatoryObligations(ctx:HttpTenantContext):Promise<RegulatoryObligationRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'name' as name, a.payload->>'category' as category, a.payload->>'periodicity' as periodicity, a.payload->>'dueDate' as due_date, a.occurred_at as created_at
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='RegulatoryObligation' and a.payload->>'kind'='CREATED'
   order by a.payload->>'dueDate' asc nulls last`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   obligationId:String(o.aggregate_id),name:String(o.name??""),category:String(o.category??"Otros"),
   periodicity:String(o.periodicity??""),dueDate:o.due_date?String(o.due_date):null,
   createdAt:o.created_at?new Date(String(o.created_at)).toISOString():""};});
 });
}
// EPIC S-CONFIG — Ajustes del consultorio (singleton por tenant, no PHI). Mismo kernel event-sourced:
// el estado actual = payload.settings del último evento OFFICE_SETTINGS_UPDATED. version = nº de eventos del
// agregado (concurrencia optimista If-Match). Si no hay eventos, settings vacío y version 0. RLS-scoped.
export type OfficeSettingsRead=Readonly<{settings:Record<string,unknown>;version:number}>;
export async function officeSettings(ctx:HttpTenantContext):Promise<OfficeSettingsRead>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.payload->'settings' as settings,
     (select count(*)::int from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=a.aggregate_id) as version
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='OfficeSettings' and a.payload->>'kind'='UPDATED'
   order by a.sequence desc limit 1`;
  const row=rows[0] as Record<string,unknown>|undefined;
  if(!row)return{settings:{},version:0};
  return{settings:(row.settings as Record<string,unknown>)??{},version:Number(row.version??0)};
 });
}
// EPIC S-REPORTES — Tendencia de consultas por día del tablero. Cuenta encuentros por el evento base
// ENCOUNTER_OPENED (kind OPENED) agrupados por la FECHA (día) en que ocurrieron, y el total de consultas
// firmadas (ENCOUNTER_SIGNED) para el indicador de expedientes cerrados. Determinista, RLS-scoped, sin PHI.
export type EncounterAnalytics=Readonly<{total:number;signed:number;byDay:ReadonlyArray<{date:string;count:number}>}>;
export async function encounterAnalytics(ctx:HttpTenantContext):Promise<EncounterAnalytics>{
 return withTenantTx(ctx,async tx=>{
  const dayRows=await tx`
   select to_char(a.occurred_at,'YYYY-MM-DD') as day, count(*)::int as n
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Encounter' and a.payload->>'kind'='OPENED'
   group by day order by day asc`;
  const signedRows=await tx`
   select count(*)::int as n from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Encounter' and a.payload->>'kind'='SIGNED'`;
  const byDay=dayRows.map(r=>{const o=r as Record<string,unknown>;return{date:String(o.day??""),count:Number(o.n??0)};});
  const total=byDay.reduce((s,d)=>s+d.count,0);
  const signed=Number((signedRows[0] as Record<string,unknown>|undefined)?.n??0);
  return{total,signed,byDay};
 });
}
// EPIC S-REPORTES — Medicamentos más prescritos del tablero. Toma cada agregado Medication cuyo ciclo llegó a
// MEDICATION_PRESCRIBED (una receta real, no solo propuesta), y agrupa por el drugCode del evento base
// MEDICATION_PROPOSED. Devuelve el top por frecuencia. Determinista, RLS-scoped, sin PHI (solo el fármaco).
export type PrescribedDrugRow=Readonly<{drugCode:string;count:number}>;
export async function medicationsPrescribed(ctx:HttpTenantContext):Promise<ReadonlyArray<PrescribedDrugRow>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select base.payload->>'drugCode' as drug, count(*)::int as n
   from clinical_events base
   where base.tenant_id=${ctx.tenantId} and base.aggregate_type='Medication' and base.payload->>'kind'='PROPOSED'
     and exists (select 1 from clinical_events pr where pr.tenant_id=${ctx.tenantId} and pr.aggregate_id=base.aggregate_id and pr.payload->>'kind'='PRESCRIBED')
   group by drug order by n desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{drugCode:String(o.drug??""),count:Number(o.n??0)};}).filter(x=>x.drugCode);
 });
}
// EPIC S-REPORTES — Tipos de consulta del tablero (desde la agenda). Cuenta las citas por el evento base
// APPOINTMENT_SCHEDULED agrupadas por su apptType (CONSULTA_GENERAL/CONTROL/PRIMERA_VEZ/PROCEDIMIENTO/
// VACUNACION/RESULTADOS/URGENCIA); las citas sin tipo caen en 'SIN_TIPO'. Determinista, RLS-scoped, sin PHI.
export type AppointmentTypeRow=Readonly<{apptType:string;count:number}>;
export async function appointmentsByType(ctx:HttpTenantContext):Promise<ReadonlyArray<AppointmentTypeRow>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select coalesce(a.payload->>'apptType','SIN_TIPO') as appt_type, count(*)::int as n
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Appointment' and a.payload->>'kind'='SCHEDULED'
   group by appt_type order by n desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{apptType:String(o.appt_type??"SIN_TIPO"),count:Number(o.n??0)};});
 });
}
// EPIC S-REPORTES — Desenlaces de la agenda para indicadores de calidad. Por cada cita (agregado Appointment)
// toma su ESTADO final = último kind (SCHEDULED/CHECKED_IN/COMPLETED/CANCELLED/NO_SHOW) y agrega los conteos.
// Base de la tasa de asistencia efectiva y de inasistencia. Determinista, RLS-scoped, sin PHI.
export type AppointmentOutcomes=Readonly<{total:number;completed:number;noShow:number;cancelled:number;checkedIn:number;scheduled:number}>;
export async function appointmentOutcomes(ctx:HttpTenantContext):Promise<AppointmentOutcomes>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select coalesce((select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1),'SCHEDULED') as last_kind, count(*)::int as n
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Appointment' and a.payload->>'kind'='SCHEDULED'
   group by last_kind`;
  const by:Record<string,number>={};let total=0;
  for(const r of rows){const o=r as Record<string,unknown>;const k=String(o.last_kind??"SCHEDULED");const n=Number(o.n??0);by[k]=(by[k]??0)+n;total+=n;}
  return{total,completed:by.COMPLETED??0,noShow:by.NO_SHOW??0,cancelled:by.CANCELLED??0,checkedIn:by.CHECKED_IN??0,scheduled:by.SCHEDULED??0};
 });
}
// EPIC AY — Condiciones ACTIVAS del paciente (lista de problemas, CIE-10). RLS-scoped. Para el gate de
// contraindicación fármaco–condición en la prescripción. Activa = último kind ADDED/REACTIVATED/MARKED_CHRONIC
// (no RESOLVED ni MARKED_ERROR). Devuelve el código CIE-10 normalizado.
export async function activeProblemCodes(ctx:HttpTenantContext,patientId:string):Promise<string[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'code' as code
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='ClinicalProblem' and r.payload->>'kind'='ADDED' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id
           and c.payload->>'kind' not in ('EPISTEMIC_CHANGED','EVIDENCE_UPDATED') order by sequence desc limit 1) in ('ADDED','REACTIVATED','MARKED_CHRONIC')`;
  return rows.map(x=>String(x.code??"")).filter(Boolean);
 });
}
// EPIC N — Timeline del paciente: un item por agregado clínico del paciente, con tipo, último kind
// (estado), versión y fechas. RLS-scoped. SIN PHI: solo metadatos, nunca el contenido clínico.
export type TimelineItem=Readonly<{aggregateType:string;aggregateId:string;latestKind:string;status:string;version:number;openedAt:string;lastAt:string}>;
export async function readPatientTimeline(ctx:HttpTenantContext,patientId:string,page:{limit:number;cursor?:string|null}={limit:PAGE_LIMIT_MAX}):Promise<Page<TimelineItem>>{
 const after=decodeCursor(page.cursor,2);const afterAt=after?String(after[0]):null,afterId=after?String(after[1]):null;
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.aggregate_id, r.aggregate_type,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and ${lifecycleEventOnly(tx)} order by sequence desc limit 1) as latest_kind,
     (select payload->>'status' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and ${lifecycleEventOnly(tx)} order by sequence desc limit 1) as latest_status,
     max(r.sequence) as version, min(r.occurred_at) as opened_at, max(r.occurred_at) as last_at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_id in (
     select aggregate_id from clinical_events where tenant_id=${ctx.tenantId} and sequence=1 and payload->>'patientId'=${patientId})
   group by r.aggregate_id, r.aggregate_type
   having (${afterAt}::timestamptz is null or (min(r.occurred_at), r.aggregate_id::text) < (${afterAt}::timestamptz, ${afterId}::text))
   order by min(r.occurred_at) desc, r.aggregate_id desc
   limit ${page.limit+1}`;
  const items=rows.slice(0,page.limit).map(x=>({aggregateType:String(x.aggregate_type),aggregateId:String(x.aggregate_id),latestKind:String(x.latest_kind??""),status:String(x.latest_status??""),version:Number(x.version),openedAt:new Date(String(x.opened_at)).toISOString(),lastAt:new Date(String(x.last_at)).toISOString()}));
  const last=items[items.length-1];
  // R01-026: constancia de acceso de lectura a PHI (misma transacción que la consulta).
  await logPhiAccess(tx,ctx,{resourceType:"PATIENT_TIMELINE",resourceId:patientId,patientId});
  return{items,nextCursor:rows.length>page.limit&&last?encodeCursor([last.openedAt,last.aggregateId]):null};
 });
}
// EPIC AC — Worklist poblacional: un renglón por agregado clínico del tenant (todos los pacientes),
// con su patientId y su último kind (estado). RLS-scoped al tenant. SIN PHI: solo tipo/estado/ids.
export type PanelRowData=Readonly<{aggregateType:string;aggregateId:string;patientId:string;latestKind:string;status:string}>;
export async function readTenantOpenAggregates(ctx:HttpTenantContext):Promise<ReadonlyArray<PanelRowData>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.aggregate_id, r.aggregate_type, r.payload->>'patientId' as patient_id,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and ${lifecycleEventOnly(tx)} order by sequence desc limit 1) as latest_kind,
     (select payload->>'status' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) as latest_status
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.sequence=1 and r.payload->>'patientId' is not null`;
  return rows.map(x=>({aggregateType:String(x.aggregate_type),aggregateId:String(x.aggregate_id),patientId:String(x.patient_id),latestKind:String(x.latest_kind??""),status:String(x.latest_status??"")}));
 });
}
// EPIC AB — Manifiesto del expediente: filas estructurales (agregado/secuencia/kind/fecha) de TODOS
// los agregados del paciente. RLS-scoped. SIN volcar payloads PHI: solo el kind (estado) y la fecha.
export type RecordRow=Readonly<{aggregateType:string;aggregateId:string;sequence:number;kind:string;occurredAt:string}>;
export async function readPatientRecordRows(ctx:HttpTenantContext,patientId:string):Promise<ReadonlyArray<RecordRow>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.aggregate_id, r.aggregate_type, r.sequence, r.payload->>'kind' as kind, r.occurred_at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_id in (
     select aggregate_id from clinical_events where tenant_id=${ctx.tenantId} and sequence=1 and payload->>'patientId'=${patientId})
   order by r.aggregate_id, r.sequence`;
  // R01-026: constancia de acceso de lectura a PHI (misma transacción que la consulta).
  await logPhiAccess(tx,ctx,{resourceType:"PATIENT_RECORD",resourceId:patientId,patientId});
  return rows.map(x=>({aggregateType:String(x.aggregate_type),aggregateId:String(x.aggregate_id),sequence:Number(x.sequence),kind:String(x.kind??""),occurredAt:String(x.occurred_at)}));
 });
}
// EPIC D — Lectura RLS-scoped del stream de eventos CON payload (para reconstruir estado).
// El payload es contenido clínico (fuente de verdad, RLS-aislado); nunca se loguea.
export async function readEncounterEvents(ctx:HttpTenantContext,encounterId:string):Promise<ReadonlyArray<{sequence:number;payload:Record<string,unknown>}>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`select sequence,payload from clinical_events where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId} order by sequence`;
  return rows.map(r=>({sequence:Number(r.sequence),payload:(r.payload??{}) as Record<string,unknown>}));
 });
}
// EPIC G — Lector genérico de eventos de un agregado (RLS-scoped, con payload).
// Payload de UN evento por su id, acotado al agregado esperado (RLS-scoped). El id del evento es determinista respecto de
// la llave de idempotencia (derivedUuid(key,"event")), así que esto responde: "¿esta llave ya produjo su evento, y con qué?".
export async function readEventPayloadById(ctx:HttpTenantContext,eventId:string,aggregateId:string):Promise<Record<string,unknown>|undefined>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`select payload from clinical_events where tenant_id=${ctx.tenantId} and id=${eventId} and aggregate_id=${aggregateId} limit 1`;
  const p=rows[0]?.payload;return p&&typeof p==="object"?p as Record<string,unknown>:undefined;
 });
}
export async function readAggregateEvents(ctx:HttpTenantContext,aggregateId:string):Promise<ReadonlyArray<{sequence:number;payload:Record<string,unknown>}>>{
 return readEncounterEvents(ctx,aggregateId);
}
// EPIC Z/UI — Repositorio de documentos: UN documento clínico con su CONTENIDO real, adenda (append-only) y
// firma, plegando todos sus eventos (CREATED/FINALIZED/SIGNED/AMENDED) en orden. RLS-scoped. Nunca borra: cada
// enmienda suma. version = nº de eventos del agregado.
export type DocAddendum=Readonly<{addendum:string;authorId:string;at:string}>;
export type DocSignature=Readonly<{authorId:string;contentHash:string;signatureDigest:string;signedAt:string}>;
// Un archivo binario adjunto (PHI) guardado en Vercel Blob privado. En el event stream SOLO va la referencia
// (pathname del blob + hash + metadatos), nunca el binario. attachmentId = id determinista del evento adjunto.
export type DocAttachment=Readonly<{attachmentId:string;filename:string;mime:string;size:number;pathname:string;contentHash:string;authorId:string;attachedAt:string}>;
export type DocumentDetail=Readonly<{exists:boolean;documentId:string;patientId:string;title:string;docType:string;content:string;state:"DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED";version:number;createdAt:string;addenda:DocAddendum[];signature:DocSignature|null;attachments:DocAttachment[]}>;
export async function documentDetail(ctx:HttpTenantContext,documentId:string):Promise<DocumentDetail>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.payload as payload, a.occurred_at as occurred_at
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalDocument' and a.aggregate_id=${documentId}
   order by a.sequence asc`;
  if(rows.length===0)return{exists:false,documentId,patientId:"",title:"",docType:"",content:"",state:"DRAFT",version:0,createdAt:"",addenda:[],signature:null,attachments:[]};
  let patientId="",title="",docType="",content="",createdAt="",state:DocumentDetail["state"]="DRAFT",signature:DocSignature|null=null;const addenda:DocAddendum[]=[];const attachments:DocAttachment[]=[];
  for(const r of rows){const o=r as Record<string,unknown>;const p=(o.payload??{}) as Record<string,unknown>;const at=o.occurred_at?new Date(String(o.occurred_at)).toISOString():"";
   switch(String(p.kind)){
    case"CREATED":patientId=String(p.patientId??"");docType=String(p.docType??"OTHER");title=String(p.title??"");content=String(p.content??"");createdAt=at;state="DRAFT";break;
    case"FINALIZED":state="FINALIZED";break;
    case"SIGNED":state="SIGNED";signature={authorId:String(p.authorId??""),contentHash:String(p.contentHash??""),signatureDigest:String(p.signatureDigest??""),signedAt:String(p.signedAt??at)};break;
    case"AMENDED":state="AMENDED";addenda.push({addendum:String(p.addendum??""),authorId:String(p.authorId??""),at:String(p.amendedAt??at)});break;
    case"ATTACHED":attachments.push({attachmentId:String(p.attachmentId??""),filename:String(p.filename??"archivo"),mime:String(p.mime??"application/octet-stream"),size:Number(p.size??0),pathname:String(p.pathname??""),contentHash:String(p.contentHash??""),authorId:String(p.authorId??""),attachedAt:String(p.attachedAt??at)});break;
    case"ATTACHMENT_REMOVED":{const rid=String(p.attachmentId??"");const idx=attachments.findIndex(a=>a.attachmentId===rid);if(idx>=0)attachments.splice(idx,1);break;}
   }
  }
  // R01-026: el detalle de un documento clínico ES el contenido; su lectura queda registrada con el paciente al que pertenece.
  await logPhiAccess(tx,ctx,{resourceType:"CLINICAL_DOCUMENT",resourceId:documentId,patientId:patientId||undefined});
  return{exists:true,documentId,patientId,title,docType,content,state,version:rows.length,createdAt,addenda,signature,attachments};
 });
}
// EPIC D — Gate Zero Lost Follow-Up: obligaciones críticas (URGENT) del paciente sin resolver.
// Auditoría 2026-09-19 (L-01) — GATE REAL de obligaciones. Antes contaba filas de `clinical_inbox`, tabla en la que ningún
// código inserta (el rol de la app solo tiene SELECT): devolvía SIEMPRE 0 y el médico podía firmar con cualquier seguimiento
// crítico abierto. Ahora se deriva de la ÚNICA fuente de verdad, el stream de eventos de ClinicalObligation, y el criterio es
// la función pura `signatureBlockReason` (URGENTE o VENCIDA, sin resolver). La hora de referencia es la del SERVIDOR.
export type BlockingObligation=Readonly<{obligationId:string;reason:SignatureBlockReason;priority:string;dueAt:string}>;
export async function blockingObligations(ctx:HttpTenantContext,patientId:string,asOfIso:string=new Date().toISOString()):Promise<BlockingObligation[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'dueAt' as due_at, a.payload->>'priority' as priority,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalObligation' and a.payload->>'kind'='CREATED' and a.payload->>'patientId'=${patientId}`;
  const out:BlockingObligation[]=[];
  for(const r of rows){const o=r as Record<string,unknown>;
   const state=OBLIGATION_STATUS[String(o.last_kind??"CREATED")]??"OPEN"; // kind desconocido => OPEN (fail-closed: sigue contando)
   const dueAt=o.due_at==null?"":String(o.due_at);const priority=o.priority==null?"ROUTINE":String(o.priority);
   const reason=signatureBlockReason({state,priority,dueAt},asOfIso);
   if(reason)out.push({obligationId:String(o.aggregate_id),reason,priority,dueAt});}
  return out;
 });
}
export async function countUnresolvedCriticalObligations(ctx:HttpTenantContext,patientId:string):Promise<number>{
 return(await blockingObligations(ctx,patientId)).length;
}
// EPIC G — Cierre del loop Zero Lost Follow-Up: resultados diagnósticos CRÍTICOS del paciente que no se han CERRADO.
// Auditoría 2026-09-19 (L-01/C-20): antes solo contaban los que ya estaban en ACTIONED, de modo que el caso MÁS peligroso
// —un crítico recién RECIBIDO o solo VERIFICADO, que nadie ha atendido— no bloqueaba la firma, aunque la propia UI promete
// "bloquea la firma hasta cerrarse". Ahora cuenta todo crítico (por valor o por Δ) sin evento CLOSED.
export async function countOpenCriticalResults(ctx:HttpTenantContext,patientId:string):Promise<number>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select count(distinct r.aggregate_id)::int n
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult'
     and r.payload->>'kind'='RECEIVED' and r.payload->>'patientId'=${patientId} and r.payload->>'critical'='true'
     and not exists(
      select 1 from clinical_events c
      where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and c.payload->>'kind' in ('CLOSED','CORRECTED'))`; // C-02: un crítico corregido deja de bloquear; si la corrección sigue siendo crítica, bloquea el nuevo
  return Number(rows[0]?.n??0);
 });
}

// EPIC AN + Zero Lost Follow-Up: cuenta signos vitales CRÍTICOS del paciente
// que están en estado RECORDED o AMENDED (no corregidos) y no han sido abordados
// (no existe obligación creada para ese vital). Bloquea firma del encuentro.
export async function countOpenCriticalVitals(ctx:HttpTenantContext,patientId:string):Promise<number>{
 return withTenantTx(ctx,async tx=>{
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
 });
}

export type EncounterView=Readonly<{encounterId:string;version:number;events:ReadonlyArray<{sequence:number;type:string;occurredAt:string}>}>;
// Lectura RLS-scoped del agregado (sin payload clínico: solo metadatos no-PHI).
export async function readEncounter(ctx:HttpTenantContext,encounterId:string):Promise<EncounterView|null>{
 return withTenantTx(ctx,async tx=>{
  const agg=await tx`select version from aggregate_versions where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId}`;
  const head=agg[0];
  if(!head)return null;
  const events=await tx`select sequence,aggregate_type,occurred_at from clinical_events where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId} order by sequence`;
  return{
   encounterId,
   version:Number(head.version),
   events:events.map(e=>({sequence:Number(e.sequence),type:String(e.aggregate_type),occurredAt:String(e.occurred_at)})),
  };
 });
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
