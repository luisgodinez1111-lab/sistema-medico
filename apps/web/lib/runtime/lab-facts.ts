// Lectores de RESULTADOS DE LABORATORIO de un paciente: el valor previo para el delta check, la lectura completa que
// usan las calculadoras y la serie temporal. Auditoría R01-001 (un módulo por dominio) + R03-10 (toda lectura de
// laboratorio pasa por aquí, y un resultado corregido o ANULADO no existe para ninguna de las tres).
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{normalizeLabValue}from"../../../../packages/lab-reference/src";
import{withTenantTx}from"./connection";

// EPIC BB — Valor PREVIO del mismo analito del paciente (resultado más reciente ya recibido). RLS-scoped.
// Para el delta check de laboratorio en la recepción de un resultado nuevo. Devuelve el value textual o undefined.
//
// Auditoría 2026-09-19, anexo R03 (R03-10): este lector devuelve un NÚMERO DESNUDO (sin unidad, sin fecha, sin estado) y
// por eso alimentaba eGFR, MELD, FIB-4, ácido-base, paneles y el contexto de referencia. Todos esos consumidores se
// migraron a `latestAnalyteReading` (valor canónico + unidad + fecha + muestra) o a la guarda `analyte-inputs`. Queda
// UN solo uso legítimo: el delta check compara el valor nuevo con el anterior EN LA MISMA UNIDAD CANÓNICA dentro de la
// misma transacción de recepción, así que no necesita la unidad ni la vigencia. Un guardián lo vigila para que no
// vuelva a extenderse (tests/v22/result-void-and-readings.test.ts).
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
     and not exists(select 1 from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=r.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR') -- R03-10: anulado -> no existe para ningún lector
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
     and not exists(select 1 from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=r.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR') -- R03-10: anulado -> no existe para ningún lector
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
     and not exists(select 1 from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=r.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR') -- R03-10: anulado -> no existe para ningún lector
   order by r.occurred_at asc, r.sequence asc`;
  // Los puntos implausibles se EXCLUYEN de la serie: un solo valor en otra escala deforma la tendencia y su pendiente.
  return rows.map(r=>{const o=r as Record<string,unknown>;return{value:Number(o.value),at:String(o.at)};}).filter(p=>Number.isFinite(p.value)&&normalizeLabValue(analyte,p.value).ok);
 });
}
