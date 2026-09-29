// Read-models de IDENTIDAD del paciente (listado, ficha, duplicados, alta verificada).
// Auditoría R01-001: extraído del god-module `clinical-runtime.ts`.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{ClinicalError}from"../../../../packages/runtime-errors/src";
import{logPhiAccess,patientAccessLog,type PhiAccessEntry,type PhiAccessAction,type PhiResourceType}from"../phi-access-log";
import{withTenantTx}from"./connection";
import{demografiaVigente,lifecycleEventOnly,pacientesConValor}from"./read-model-joins";
import{PAGE_LIMIT_MAX,Page,decodeCursor,encodeCursor}from"./pagination";

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
     d.demo->>'name' as name, d.demo->>'birthDate' as birth_date, d.demo->>'sexAtBirth' as sex_at_birth, d.demo->>'curp' as curp,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and ${lifecycleEventOnly(tx)} order by sequence desc limit 1) as latest_kind,
     (select count(*)::int from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=r.aggregate_id) as version
   from clinical_events r
   ${demografiaVigente(tx)}
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
// EPIC BK/BL — Demografía VIGENTE del paciente (alta + enmiendas, campo a campo). RLS-scoped.
// Auditoría L-06: `guardian` (tutor o representante legal) para menores de edad; lo fija el alta o una enmienda.
export type PatientGuardian=Readonly<{name:string;relationship:string;phone?:string}>;
export type PatientDemographics=Readonly<{birthDate?:string;sexAtBirth?:string;curp?:string;phone?:string;email?:string;address?:string;occupation?:string;maritalStatus?:string;name?:string;guardian?:PatientGuardian}>;
export async function patientDemographics(ctx:HttpTenantContext,patientId:string):Promise<PatientDemographics|undefined>{
 return withTenantTx(ctx,async tx=>{
  // Hallazgo D2: demografía VIGENTE campo a campo (`demografiaVigente`, la regla de `patientDemographicsOf`), no el alta
  // combinada con la última enmienda: una enmienda que solo trae el teléfono ya no revierte nombre, nacimiento ni tutor.
  const rows=await tx`select
     d.demo->>'birthDate' as bd, d.demo->>'sexAtBirth' as sx, d.demo->>'name' as nm, d.demo->>'curp' as curp,
     d.demo->>'phone' as phone, d.demo->>'email' as email, d.demo->>'address' as address,
     d.demo->>'occupation' as occupation, d.demo->>'maritalStatus' as marital, d.demo->'guardian' as guardian
   from clinical_events r
   ${demografiaVigente(tx)}
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
// Hallazgo D2: se compara contra la demografía VIGENTE (una CURP o un nombre corregidos por enmienda también cuentan), con
// el prefiltro `pacientesConValor` (SQL-1) para no proyectar la demografía de todo el padrón.
export type PatientDuplicate=Readonly<{patientId:string;by:"CURP"|"NAME_BIRTHDATE"}>;
export async function findPatientDuplicate(ctx:HttpTenantContext,q:{curp?:string|undefined;normalizedName?:string|undefined;birthDate?:string|undefined}):Promise<PatientDuplicate|undefined>{
 return withTenantTx(ctx,async tx=>{
  if(q.curp){
   const byCurp=await tx`select r.aggregate_id from clinical_events r ${demografiaVigente(tx)} where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Patient' and r.payload->>'kind'='REGISTERED'
    and ${pacientesConValor(tx,ctx.tenantId,"curp",q.curp,true)} and upper(d.demo->>'curp')=${q.curp} limit 1`;
   const row=byCurp[0] as{aggregate_id:string}|undefined;if(row)return{patientId:String(row.aggregate_id),by:"CURP"};
  }
  if(!q.normalizedName||!q.birthDate)return undefined;
  // Nombre: se compara sin acentos ni mayúsculas (unaccent no está garantizado en Neon: se normaliza en SQL con translate).
  const byName=await tx`select r.aggregate_id from clinical_events r ${demografiaVigente(tx)} where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Patient' and r.payload->>'kind'='REGISTERED'
    and ${pacientesConValor(tx,ctx.tenantId,"birthDate",q.birthDate)} and d.demo->>'birthDate'=${q.birthDate}
    and btrim(regexp_replace(lower(translate(d.demo->>'name','ÁÉÍÓÚÜáéíóúü','AEIOUUaeiouu')),'\\s+',' ','g'))=${q.normalizedName} limit 1`;
  const row=byName[0] as{aggregate_id:string}|undefined;return row?{patientId:String(row.aggregate_id),by:"NAME_BIRTHDATE"}:undefined;
 });
}
// EPIC BK — Fecha de nacimiento VIGENTE del paciente (de `patientDemographics`). RLS-scoped. Para el pronóstico de vacunación.
export async function patientBirthDate(ctx:HttpTenantContext,patientId:string):Promise<string|undefined>{
 const d=await patientDemographics(ctx,patientId);return d?.birthDate;
}
