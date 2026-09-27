// Lote 11 (ADR-0300) — read models de signos vitales. Extraído de apps/web/lib/clinical-runtime.ts en 11.1; desde el hallazgo D1
// proyectan las reglas de `foldVital` (valor vigente, anulación) con `currentVitalJoins`/`vitalNotVoided` de ../sql.
import{type HttpTenantContext}from"../../../../../packages/http-principal/src";
import{withTenantTx}from"../db";
import{currentVitalJoins,vitalNotVoided}from"../sql";
// EPIC BC — Último valor VIGENTE por tipo de signo vital del paciente (NEWS2, IMC, peso y edad de las barreras de prescripción).
// RLS-scoped. Por tipo, la toma más reciente que no esté anulada, con el valor de su última corrección (hallazgo D1 del lote
// 11: antes se tomaba el RECORDED original aunque se hubiera corregido o marcado como erróneo). Mapa {vitalType -> valor}.
export async function latestVitalsByType(ctx:HttpTenantContext,patientId:string):Promise<Record<string,string>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select distinct on (r.payload->>'vitalType') r.payload->>'vitalType' as vital_type, cur.payload->>'value' as value
   from clinical_events r
   ${currentVitalJoins(tx)}
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='VitalSign' and r.payload->>'kind'='RECORDED'
     and r.payload->>'patientId'=${patientId} and ${vitalNotVoided(tx)}
   order by r.payload->>'vitalType', r.occurred_at desc, r.sequence desc`;
  const out:Record<string,string>={};for(const x of rows){const k=String(x.vital_type??"");if(k)out[k]=String(x.value??"");}
  return out;
 }) as Promise<Record<string,string>>;
}
// EPIC W/UI — Historial de signos vitales de UN paciente (vista Signos vitales): una fila por toma no anulada, con el valor y la
// unidad VIGENTES (última corrección) y la fecha de la toma, ordenadas por fecha desc. La agrupación por timestamp en filas
// (una toma = varios tipos con el mismo occurredAt) y las series de tendencia se derivan en la capa de API. RLS-scoped.
export type VitalPoint=Readonly<{at:string;vitalType:string;value:string;unit:string}>;
export async function patientVitals(ctx:HttpTenantContext,patientId:string,limit=400):Promise<VitalPoint[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.occurred_at as at, r.payload->>'vitalType' as vital_type, cur.payload->>'value' as value, cur.payload->>'unit' as unit
   from clinical_events r
   ${currentVitalJoins(tx)}
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='VitalSign' and r.payload->>'kind'='RECORDED' and r.payload->>'patientId'=${patientId}
     and ${vitalNotVoided(tx)}
   order by r.occurred_at desc
   limit ${limit}`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   at:o.at?new Date(String(o.at)).toISOString():"",vitalType:String(o.vital_type??""),value:String(o.value??""),unit:String(o.unit??"")};});
 }) as Promise<VitalPoint[]>;
}
