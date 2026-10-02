// EPIC AQ/UI — Registro de resultados diagnósticos de TODA la clínica (vista Resultados) y la regla de su estado-UI.
//
// Vive en su propio módulo por el mismo criterio que separó vitals-registry / lab-facts / read-model-joins: `registries.ts`
// estaba en 290 líneas y el porte de D10 y SQL-2 le añadía el valor canónico, el reemplazo y el estado-UI (R01-001).
// `registries.ts` lo reexporta, así que la fachada `clinical-runtime` no cambia.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{RESULT_LIFECYCLE_KINDS}from"../../../../packages/result-fold/src";
import{withTenantTx}from"./connection";
import{type RegistryQuery,porPaciente,nombreDePaciente,ultimaTransicion,resultSuperseded,despuesDelCursor,paginaOrdenada}from"./read-model-joins";
import{type Page,armarPagina,cuentaDe,limiteDe,decodeCursor}from"./pagination";

// Por cada agregado DiagnosticResult toma el evento base RESULT_RECEIVED (analito/valor/critical/status/interpretación
// derivados) y su ESTADO por la última transición de CICLO DE VIDA (RESULT_LIFECYCLE_KINDS de packages/result-fold). Une el
// nombre del paciente. RLS-scoped.
//
// SQL-2 (porte): antes la transición era el último evento de CUALQUIER tipo, así que un resultado CERRADO y luego corregido
// leía CORRECTED, caía a «RECEIVED» y volvía a mostrarse «En revisión». Las anotaciones (RESULT_ANNOTATION_KINDS) no son
// estado. No se usa `lifecycleEventOnly`: la cronología expone CORRECTED como último evento a propósito.
// Hallazgo D10 (porte): `superseded` marca el resultado reemplazado por una corrección. `value` es el texto recibido.
// Revisión del porte (d424bdc): la fila ya no lleva `canonicalValue`. Ninguna ruta lo publicaba ni nadie lo leía, y su
// normalización de respaldo ignoraba la unidad (un calcio en mmol/L sin canónico guardado se habría leído como mg/dL). Quien
// necesite el valor canónico lo lee de donde ya se calcula con la unidad: lab-facts y los indicadores de analytics.ts.
export type ResultRow=Readonly<{resultId:string;patientId:string;patientName:string;analyte:string;value:string;superseded:boolean;critical:boolean;status:string;interpretation:string;lifecycle:"RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED";receivedAt:string;orderType:string|null}>;
const RES_LIFECYCLE:Record<string,"RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED">={RECEIVED:"RECEIVED",VERIFIED:"VERIFIED",ACTIONED:"ACTIONED",CLOSED:"CLOSED"};
export async function resultsRegistry(ctx:HttpTenantContext,q?:RegistryQuery):Promise<Page<ResultRow>&{total:number}>{
 const limit=limiteDe(q),after=decodeCursor(q?.cursor,2);
 return withTenantTx(ctx,async tx=>{
  const cuenta=await tx`select count(*)::int as n from clinical_events a where a.tenant_id=${ctx.tenantId} and a.aggregate_type='DiagnosticResult' and a.payload->>'kind'='RECEIVED' ${porPaciente(tx,q)}`;
  const rows=await tx`
   select a.occurred_at as cursor_at, a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'analyte' as analyte, a.payload->>'value' as value,
     a.payload->>'critical' as critical, a.payload->>'status' as status, a.payload->>'interpretation' as interpretation, a.occurred_at as received_at,
     ${resultSuperseded(tx,ctx.tenantId,tx`a.aggregate_id`)} as superseded,
     lk.kind as last_kind, pn.name as patient_name, ord.order_type as order_type
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId,RESULT_LIFECYCLE_KINDS)}
   ${nombreDePaciente(tx,ctx.tenantId)}
   -- Auditoría R04-F04: el TIPO de estudio (laboratorio, imagenología, patología…) lo declara la ORDEN que lo originó, y
   -- el resultado lleva su orderId. Antes se adivinaba con una expresión regular sobre el NOMBRE del analito, que
   -- clasificaba «Radioinmunoensayo de TSH» y «Placas de Petri (cultivo)» como imagenología —los dos son de laboratorio—
   -- y no distinguía patología, procedimiento ni interconsulta de un análisis. Aquí se lee el hecho, no el nombre.
   left join lateral (
     select o.payload->>'orderType' as order_type from clinical_events o
     where o.tenant_id=${ctx.tenantId} and o.aggregate_type='ClinicalOrder'
       and o.aggregate_id=(a.payload->>'orderId')::uuid and o.payload->>'kind'='CREATED'
     limit 1) ord on true
   -- R03-10: un resultado ANULADO (paciente equivocado, muestra mal identificada) no aparece en el registro clínico.
   -- El criterio es «anulado ALGUNA VEZ», no «su última transición es ENTERED_IN_ERROR»: una anotación posterior no
   -- resucita un resultado anulado. Antes era un NOT EXISTS correlacionado por fila; ahora es una anti-unión que se
   -- resuelve una vez, con la misma semántica.
   left join lateral (select 1 as anulado from clinical_events v
              where v.tenant_id=${ctx.tenantId} and v.aggregate_id=a.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR'
              limit 1) anul on true
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='DiagnosticResult' and a.payload->>'kind'='RECEIVED'
     ${porPaciente(tx,q)}
     and anul.anulado is null
     ${despuesDelCursor(tx,after)}
   ${paginaOrdenada(tx,limit)}`;
  return{...armarPagina(rows,limit,r=>{const o=r as Record<string,unknown>;return{
   resultId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   analyte:String(o.analyte??""),value:String(o.value??""),superseded:o.superseded===true,
   critical:String(o.critical)==="true",status:String(o.status??"NORMAL"),interpretation:String(o.interpretation??""),
   lifecycle:RES_LIFECYCLE[String(o.last_kind??"RECEIVED")]??"RECEIVED",
   receivedAt:o.received_at?new Date(String(o.received_at)).toISOString():"",
   orderType:o.order_type?String(o.order_type):null};}),total:cuentaDe(cuenta)};
 });
}

/**
 * Estados de un resultado que cuentan como HALLAZGO junto con el flag `critical`. Una sola lista para la regla de la
 * interfaz (`resultEstado`) y para el recuento del tablero en SQL (`resultsSummary`); antes había tres copias.
 */
export const RESULT_ABNORMAL_STATUSES=["HIGH","LOW","CRITICAL","ABNORMAL","PANIC"] as const;
const ABNORMAL:ReadonlySet<string>=new Set(RESULT_ABNORMAL_STATUSES);
/**
 * Estado-UI de un resultado del registro: la ÚNICA regla que usan la vista Resultados y la pestaña de la consulta (SQL-2,
 * porte; antes cada ruta tenía su copia). Un resultado reemplazado por una corrección se declara «Corregido»: sus
 * hallazgos y su revisión pendiente ya no son los vigentes, y contarlos como tales duplicaba alertas y pendientes con los
 * de la corrección, que también está en la lista.
 */
export type ResultEstado="Corregido"|"Hallazgos"|"En seguimiento"|"En revisión"|"Normal";
export function resultEstado(r:Pick<ResultRow,"superseded"|"critical"|"status"|"lifecycle">):ResultEstado{
 if(r.superseded)return"Corregido";
 if(r.critical||ABNORMAL.has(r.status.toUpperCase()))return"Hallazgos";
 if(r.lifecycle==="ACTIONED")return"En seguimiento";
 if(r.lifecycle==="RECEIVED")return"En revisión";
 return"Normal";
}
