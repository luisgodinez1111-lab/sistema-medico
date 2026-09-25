// Lectores de RESULTADOS DE LABORATORIO de un paciente: el valor previo para el delta check, la lectura completa que
// usan las calculadoras y la serie temporal. Auditoría R01-001 (un módulo por dominio) + R03-10 (toda lectura de
// laboratorio pasa por aquí, y un resultado corregido o ANULADO no existe para ninguna de las tres).
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{normalizeLabValue}from"../../../../packages/lab-reference/src";
import{withTenantTx}from"./connection";

// Auditoría 2026-09-19, anexo R03 (R03-10 y vector F09) — `latestResultValueForAnalyte` SE RETIRÓ.
// Devolvía el último valor como número desnudo (sin unidad, sin fecha, sin estado) y era la fuente de eGFR, MELD, FIB-4,
// ácido-base, paneles, tendencias y contexto de referencia. Su último consumidor era el delta check de la recepción de
// resultados, que en el lote 11h pasó a `latestAnalyteReading` porque necesitaba la FECHA del previo para respetar la
// ventana temporal del delta (comparar con un resultado de hace tres años y llamarlo «cambio agudo» es ruido).
// Con cero consumidores, dejarla viva solo servía para que alguien volviera a calcular sin unidad ni vigencia.
// Auditoría 2026-09-19 (C-01/C-11/C-12) — Lectura COMPLETA del último resultado de un analito para CÁLCULOS:
// valor en unidad canónica + unidad declarada + si la unidad fue asumida + fecha + muestra + id del resultado.
// `latestResultValueForAnalyte` devuelve solo el número y por eso ninguna calculadora podía verificar nada.
export type AnalyteReading=Readonly<{analyte:string;rawValue:string;value:number;unit:string|null;canonicalUnit:string|null;unitAssumed:boolean;occurredAt:string;resultId:string;specimenId:string|null}>;
export async function latestAnalyteReading(ctx:HttpTenantContext,patientId:string,analyte:string,excludeResultId?:string):Promise<AnalyteReading|undefined>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.aggregate_id as result_id, r.occurred_at as at, r.payload->>'value' as raw, r.payload->>'canonicalValue' as canonical,
          r.payload->>'unit' as unit, r.payload->>'canonicalUnit' as canonical_unit, r.payload->>'unitAssumed' as unit_assumed, r.payload->>'specimenId' as specimen_id
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult' and r.payload->>'kind'='RECEIVED'
     and r.payload->>'patientId'=${patientId} and upper(r.payload->>'analyte')=upper(${analyte})
     and r.aggregate_id::text<>${excludeResultId??""}
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
/**
 * Auditoría 2026-09-19, anexo R04 (R04-008, lote 21) — LA SERIE ESTÁ ACOTADA, y el recorte se dice.
 *
 * Esta consulta no tenía `LIMIT`: leía TODOS los resultados de ese analito de ese paciente. Para un diabético con veinte años
 * de glucosas mensuales son cientos de filas que la gráfica no puede mostrar y que viajan igual. La cota va con dos cuidados
 * que no son evidentes: se toman los MÁS RECIENTES (`order by desc`, y luego se invierte para devolver la serie en orden
 * ascendente, que es lo que espera la tendencia), porque limitar sobre un orden ascendente devolvería los más ANTIGUOS —una
 * tendencia de hace quince años presentada como la actual—; y el recorte se REPORTA, en vez de que la gráfica dibuje una
 * historia incompleta como si fuera toda.
 */
export const ANALYTE_SERIES_MAX_POINTS=400;
export async function analyteSeries(ctx:HttpTenantContext,patientId:string,analyte:string,limit=ANALYTE_SERIES_MAX_POINTS):Promise<{value:number;at:string}[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select coalesce(r.payload->>'canonicalValue',r.payload->>'value') as value, r.occurred_at as at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult' and r.payload->>'kind'='RECEIVED'
     and r.payload->>'patientId'=${patientId} and upper(r.payload->>'analyte')=upper(${analyte})
     and not exists(select 1 from clinical_events s where s.tenant_id=${ctx.tenantId} and s.aggregate_type='DiagnosticResult' and s.payload->>'kind'='RECEIVED' and s.payload->>'supersedes'=r.aggregate_id::text) -- C-02: corregido -> se lee el nuevo
     and not exists(select 1 from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=r.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR') -- R03-10: anulado -> no existe para ningún lector
   order by r.occurred_at desc, r.sequence desc
   limit ${Math.max(1,Math.min(limit,ANALYTE_SERIES_MAX_POINTS))}`;
  // Los puntos implausibles se EXCLUYEN de la serie: un solo valor en otra escala deforma la tendencia y su pendiente.
  // Se invierte para devolver la serie ASCENDENTE, que es el contrato que esperan los consumidores de tendencia.
  return rows.map(r=>{const o=r as Record<string,unknown>;return{value:Number(o.value),at:String(o.at)};})
   .filter(p=>Number.isFinite(p.value)&&normalizeLabValue(analyte,p.value).ok).reverse();
 });
}
