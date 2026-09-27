// Lote 11 (ADR-0300) — read models de signos vitales. Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import{type HttpTenantContext}from"../../../../../packages/http-principal/src";
import{withTenantTx}from"../db";
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
 }) as Promise<Record<string,string>>;
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
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   at:o.at?new Date(String(o.at)).toISOString():"",vitalType:String(o.vital_type??""),value:String(o.value??""),unit:String(o.unit??"")};});
 }) as Promise<VitalPoint[]>;
}
