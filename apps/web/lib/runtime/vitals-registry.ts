// EPIC E/UI (Lote E) — Registro POBLACIONAL de signos vitales de TODA la clínica (vista Signos vitales › «Toda la
// clínica»). Una fila por lectura (agregado VitalSign). El VALOR VIGENTE es append-only: si la lectura fue enmendada,
// se muestra el último valor (RECORDED→AMENDED, por secuencia), no el original. Una lectura marcada «capturada por
// error» (ENTERED_IN_ERROR alguna vez) NO aparece en el registro. Une el nombre del paciente. RLS-scoped.
//
// Vive en su propio módulo por el mismo criterio que separó lab-facts / read-model-joins: `registries.ts` pasaba de
// 300 líneas (R01-001). Auditoría R02a-ENC-01: la «fecha de registro» sale de `recorded_at` (reloj del servidor), no
// del `occurred_at` que declara el cliente.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{withTenantTx}from"./connection";
import{type RegistryQuery,porPaciente,nombreDePaciente,despuesDelCursor,paginaOrdenada}from"./read-model-joins";
import{type Page,armarPagina,limiteDe,decodeCursor}from"./pagination";
export type VitalRow=Readonly<{vitalId:string;patientId:string;patientName:string;vitalType:string;value:string;unit:string;status:"NORMAL"|"ABNORMAL"|"CRITICAL"|"UNKNOWN";critical:boolean;interpretation:string;recordedAt:string}>;
const VITAL_STATUS=new Set(["NORMAL","ABNORMAL","CRITICAL","UNKNOWN"]);
export async function vitalsRegistry(ctx:HttpTenantContext,q?:RegistryQuery):Promise<Page<VitalRow>&{total:number;criticalCount:number;abnormalCount:number;patientsCount:number}>{
 const limit=limiteDe(q),after=decodeCursor(q?.cursor,2);
 return withTenantTx(ctx,async tx=>{
  // Los indicadores (críticos/anormales/pacientes) se calculan EN LA BASE sobre el valor VIGENTE, no sobre la página.
  const sum=await tx`
   select count(*)::int as total,
     count(*) filter (where cur.critical='true')::int as critical,
     count(*) filter (where cur.status='ABNORMAL' and cur.critical is distinct from 'true')::int as abnormal,
     count(distinct a.payload->>'patientId')::int as patients
   from clinical_events a
   left join lateral (
     select e.payload->>'status' as status, e.payload->>'critical' as critical
     from clinical_events e
     where e.tenant_id=${ctx.tenantId} and e.aggregate_id=a.aggregate_id and e.payload->>'kind' in ('RECORDED','AMENDED')
     order by e.sequence desc limit 1) cur on true
   left join lateral (
     select 1 as eie from clinical_events v
     where v.tenant_id=${ctx.tenantId} and v.aggregate_id=a.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR'
     limit 1) er on true
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='VitalSign' and a.payload->>'kind'='RECORDED' and er.eie is null ${porPaciente(tx,q)}`;
  const s=(sum as Array<Record<string,unknown>>)[0]??{};
  const rows=await tx`
   select a.occurred_at as cursor_at, a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'vitalType' as vital_type,
     coalesce(cur.value,a.payload->>'value') as value, coalesce(cur.unit,a.payload->>'unit') as unit,
     coalesce(cur.status,a.payload->>'status') as status, coalesce(cur.critical,a.payload->>'critical') as critical,
     coalesce(cur.interpretation,a.payload->>'interpretation') as interpretation, a.recorded_at as recorded_at, pn.name as patient_name
   from clinical_events a
   left join lateral (
     select e.payload->>'value' as value, e.payload->>'unit' as unit, e.payload->>'status' as status,
       e.payload->>'critical' as critical, e.payload->>'interpretation' as interpretation
     from clinical_events e
     where e.tenant_id=${ctx.tenantId} and e.aggregate_id=a.aggregate_id and e.payload->>'kind' in ('RECORDED','AMENDED')
     order by e.sequence desc limit 1) cur on true
   left join lateral (
     select 1 as eie from clinical_events v
     where v.tenant_id=${ctx.tenantId} and v.aggregate_id=a.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR'
     limit 1) er on true
   ${nombreDePaciente(tx,ctx.tenantId)}
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='VitalSign' and a.payload->>'kind'='RECORDED'
     and er.eie is null
     ${porPaciente(tx,q)}
     ${despuesDelCursor(tx,after)}
   ${paginaOrdenada(tx,limit)}`;
  const page=armarPagina(rows,limit,r=>{const o=r as Record<string,unknown>;const st=String(o.status??"");return{
   vitalId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   vitalType:String(o.vital_type??""),value:String(o.value??""),unit:String(o.unit??""),
   status:(VITAL_STATUS.has(st)?st:"UNKNOWN") as VitalRow["status"],critical:String(o.critical)==="true",
   interpretation:String(o.interpretation??""),recordedAt:o.recorded_at?new Date(String(o.recorded_at)).toISOString():""};});
  return{...page,total:Number(s.total??0),criticalCount:Number(s.critical??0),abnormalCount:Number(s.abnormal??0),patientsCount:Number(s.patients??0)};
 });
}
