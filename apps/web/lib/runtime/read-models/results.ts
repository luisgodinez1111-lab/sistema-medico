// Lote 11 (ADR-0300) — read models de resultados de laboratorio (última lectura, series, registro). Extraído de
// apps/web/lib/clinical-runtime.ts en 11.1; el registro expone valor canónico y supersesión desde el hallazgo D10.
import{type HttpTenantContext}from"../../../../../packages/http-principal/src";
import{normalizeLabValue}from"../../../../../packages/lab-reference/src";
import{withTenantTx}from"../db";
import{currentPatientName,resultSuperseded}from"../sql";
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
     and not ${resultSuperseded(tx,ctx.tenantId,tx`r.aggregate_id`)} -- C-02: corregido -> se lee el nuevo
   order by r.occurred_at desc, r.sequence desc limit 1`;
  const v=rows[0]?.value;if(v==null)return undefined;
  // Auditoría C-01: un valor físicamente IMPLAUSIBLE en la unidad canónica (evento antiguo capturado sin unidad en otra
  // escala) no se entrega como "el último valor" a ningún consumidor (paneles, contexto de referencia, delta-check).
  const n=normalizeLabValue(analyte,String(v));
  return !n.ok&&n.reason==="IMPLAUSIBLE"?undefined:String(v);
 }) as Promise<string|undefined>;
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
     and not ${resultSuperseded(tx,ctx.tenantId,tx`r.aggregate_id`)} -- C-02: corregido -> se lee el nuevo
   order by r.occurred_at desc, r.sequence desc limit 1`;
  const o=rows[0] as Record<string,unknown>|undefined;if(!o)return undefined;
  const raw=String(o["raw"]??"");const canonical=o["canonical"]==null?Number(raw.trim().replace(",",".")):Number(o["canonical"]);
  // Eventos anteriores a esta corrección no traen unidad: se declara `unitAssumed` (la plausibilidad se valida al usarlo).
  const legacy=o["canonical"]==null;
  return{analyte:analyte.toUpperCase(),rawValue:raw,value:canonical,unit:o["unit"]==null?null:String(o["unit"]),canonicalUnit:o["canonical_unit"]==null?null:String(o["canonical_unit"]),
   unitAssumed:legacy?true:String(o["unit_assumed"])==="true",occurredAt:new Date(String(o["at"])).toISOString(),resultId:String(o["result_id"]),specimenId:o["specimen_id"]==null?null:String(o["specimen_id"])};
 }) as Promise<AnalyteReading|undefined>;
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
     and not ${resultSuperseded(tx,ctx.tenantId,tx`r.aggregate_id`)} -- C-02: corregido -> se lee el nuevo
   order by r.occurred_at asc, r.sequence asc`;
  // Los puntos implausibles se EXCLUYEN de la serie: un solo valor en otra escala deforma la tendencia y su pendiente.
  return rows.map(r=>{const o=r as Record<string,unknown>;return{value:Number(o.value),at:String(o.at)};}).filter(p=>Number.isFinite(p.value)&&normalizeLabValue(analyte,p.value).ok);
 }) as Promise<{value:number;at:string}[]>;
}
// EPIC AQ/UI — Registro de resultados diagnósticos de TODA la clínica (vista Resultados). Por cada agregado
// DiagnosticResult toma el evento base RESULT_RECEIVED (analito/valor/critical/status/interpretación derivados)
// y su ESTADO por la última transición de ciclo de vida (RECEIVED/VERIFIED/ACTIONED/CLOSED). Une el nombre del
// paciente. El estado-UI (Hallazgos/Normal/En seguimiento/En revisión) se deriva. RLS-scoped.
// Hallazgo D10: `canonicalValue` es el valor en la unidad canónica del analito (el que usan las calculadoras; null si no es
// normalizable) y `superseded` marca el resultado reemplazado por una corrección. `value` sigue siendo el texto recibido.
export type ResultRow=Readonly<{resultId:string;patientId:string;patientName:string;analyte:string;value:string;canonicalValue:number|null;superseded:boolean;critical:boolean;status:string;interpretation:string;lifecycle:"RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED";receivedAt:string}>;
// Valor canónico: el normalizado al recibir; un evento anterior a C-01 (sin unidad) se normaliza aquí con la misma función.
const canonicalOf=(analyte:string,canonical:unknown,raw:unknown):number|null=>{
 if(canonical!=null&&Number.isFinite(Number(canonical)))return Number(canonical);
 const n=normalizeLabValue(analyte,String(raw??""));return n.ok?n.canonicalValue:null;
};
const RES_LIFECYCLE:Record<string,"RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED">={RECEIVED:"RECEIVED",VERIFIED:"VERIFIED",ACTIONED:"ACTIONED",CLOSED:"CLOSED"};
export async function resultsRegistry(ctx:HttpTenantContext):Promise<ResultRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'analyte' as analyte, a.payload->>'value' as value,
     a.payload->>'critical' as critical, a.payload->>'status' as status, a.payload->>'interpretation' as interpretation, a.occurred_at as received_at,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind,
     ${currentPatientName(tx,ctx.tenantId)} as patient_name,
     a.payload->>'canonicalValue' as canonical_value, ${resultSuperseded(tx,ctx.tenantId,tx`a.aggregate_id`)} as superseded
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='DiagnosticResult' and a.payload->>'kind'='RECEIVED'
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   resultId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   analyte:String(o.analyte??""),value:String(o.value??""),canonicalValue:canonicalOf(String(o.analyte??""),o.canonical_value,o.value),superseded:o.superseded===true,critical:String(o.critical)==="true",
   status:String(o.status??"NORMAL"),interpretation:String(o.interpretation??""),
   lifecycle:RES_LIFECYCLE[String(o.last_kind??"RECEIVED")]??"RECEIVED",
   receivedAt:o.received_at?new Date(String(o.received_at)).toISOString():""};});
 }) as Promise<ResultRow[]>;
}
