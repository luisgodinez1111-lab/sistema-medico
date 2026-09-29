// Piezas de SQL compartidas por los read-models de clínica (`registries.ts`).
//
// Auditoría 2026-09-19, anexo R06 (R06-20) — «N subconsultas correlacionadas por fila; sin paginación».
//
// EL HALLAZGO, medido. Cada registro resolvía, POR CADA FILA, dos o más subconsultas: la última transición del agregado y
// el nombre del paciente. El de vacunas buscaba CUATRO veces el MISMO evento ADMINISTERED —lote, sitio, fecha y otra vez
// la fecha dentro del ORDER BY— más la transición y el nombre: seis por fila. Medido en una base desechable con un tenant
// de 900 pacientes y 9 000 problemas: 72 389 buffers para 9 000 filas, con dos escaneos de índice por fila
// (`loops=9000` dos veces).
//
// LA LECCIÓN DE LA MEDICIÓN, que decidió el diseño. La primera versión resolvía esos atributos con tablas derivadas
// (ventana por agregado, calculadas una vez): 1 116 buffers para las mismas 9 000 filas con los mismos valores, 65 veces
// menos E/S. Pero al medir el caso ACOTADO A UN PACIENTE —10 filas— esas mismas tablas derivadas escaneaban el tenant
// completo: 1 088 buffers para devolver diez filas, diez veces peor que las subconsultas que venía a sustituir. El plan
// óptimo depende de cuántas filas se esperan, y de ahí sale la regla que sigue este módulo:
//
//   · el conjunto de filas SIEMPRE va acotado (por paciente, por ventana de fechas o por página), y
//   · los atributos por fila se resuelven con LATERAL, cuyo coste es proporcional a las filas devueltas, no al tenant.
//
// Un LATERAL puede además devolver VARIAS columnas del mismo evento en una sola búsqueda: ahí está la mejora real de las
// vacunas (seis búsquedas por fila -> dos) y de facturación y órdenes.
// LA OTRA MITAD DE R06-20: «sin paginación». Los seis tableros de clínica completa devolvían el tenant entero y cada ruta
// calculaba sus KPI en Node sobre ese conjunto (`items.length`, `items.filter(...)`). Acotar la página sin más habría
// falseado todos los indicadores —contarían solo la página—, así que las dos cosas van juntas y por eso este módulo tiene
// dos familias de piezas, con una regla que sale de la medición:
//
//   · PÁGINA (conjunto acotado): los atributos por fila se resuelven con LATERAL, cuyo coste es proporcional a las filas
//     devueltas. Ver `ultimaTransicion`, `nombreDePaciente`, `versionDelAgregado`.
//   · RESUMEN (todo el conjunto, salida de tamaño fijo): se resuelve con una TABLA DERIVADA por ventana, que se calcula una
//     vez. Aquí sí gana: 1 116 buffers frente a 72 389 en el tenant de la medición. Ver `transicionesPorAgregado`.
import type postgres from"postgres";
import{VITAL_VOID_KIND}from"../../../../packages/vital-fold/src";
import{PATIENT_DEMOGRAPHIC_FIELDS,PATIENT_DEMOGRAPHIC_KINDS,PATIENT_ANNOTATION_KINDS,type PatientDemographicField}from"../../../../packages/patient-fold/src";
import{MED_ANNOTATION_KINDS}from"../../../../packages/medication-fold/src";
import{PROBLEM_ANNOTATION_KINDS}from"../../../../packages/problem-fold/src";
import{DOCUMENT_ANNOTATION_KINDS}from"../../../../packages/document-fold/src";
type Tx=postgres.TransactionSql;

/**
 * Auditoría L-04/K-05 — eventos de ANOTACIÓN por tipo de agregado: enriquecen el agregado sin cambiar su estado. Toda
 * consulta genérica que derive el estado del «último evento» debe ignorarlos; si no, corregir el teléfono de un paciente
 * fallecido lo mostraba ACTIVO y modificar una dosis habría sacado la medicación de la lista de activas. Alias fijo `c`
 * (el de las subconsultas latest_kind). Hallazgo D3 (porte): las listas son las que declara cada fold, como parámetros;
 * antes eran literales copiados a mano y faltaban los adjuntos del documento, así que un documento firmado con un adjunto
 * se listaba como borrador. Vive aquí (y no en records.ts) para que patient-facts lo use sin un ciclo de importación.
 * DiagnosticResult NO está a propósito: la cronología y el gate de críticos leen CORRECTED/ENTERED_IN_ERROR como último
 * evento; el registro de resultados filtra con RESULT_LIFECYCLE_KINDS (ver results-registry.ts).
 */
export const lifecycleEventOnly=(tx:Tx)=>tx`not (
  (c.aggregate_type='Medication' and c.payload->>'kind' = any(${[...MED_ANNOTATION_KINDS]}::text[]))
  or (c.aggregate_type='ClinicalProblem' and c.payload->>'kind' = any(${[...PROBLEM_ANNOTATION_KINDS]}::text[]))
  or (c.aggregate_type='Patient' and c.payload->>'kind' = any(${[...PATIENT_ANNOTATION_KINDS]}::text[]))
  or (c.aggregate_type='ClinicalDocument' and c.payload->>'kind' = any(${[...DOCUMENT_ANNOTATION_KINDS]}::text[])))`;

/**
 * Auditoría C-02 / hallazgo D10 (porte) — un resultado está REEMPLAZADO cuando otro resultado RECIBIDO lo declara en
 * `supersedes` (la corrección del laboratorio), aunque la anotación CORRECTED del original hubiera fallado. Es la regla
 * que leen calculadoras, series, registro y tablero, escrita una vez (antes, copias a mano en cada lector). `id` es la
 * expresión del id del resultado (p. ej. tx`a.aggregate_id`). La subconsulta NO está correlacionada: Postgres la resuelve
 * una vez por consulta (hashed SubPlan), así que su coste no crece con las filas devueltas; `is not null` hace que el
 * `in` nunca dé NULL (un `not` sobre NULL descartaría la fila en silencio).
 */
export const resultSuperseded=(tx:Tx,tenantId:string,id:postgres.Fragment)=>tx`((${id})::text in (
  select s.payload->>'supersedes' from clinical_events s
  where s.tenant_id=${tenantId} and s.aggregate_type='DiagnosticResult' and s.payload->>'kind'='RECEIVED'
    and s.payload->>'supersedes' is not null))`;

/** Opciones comunes de los registros de clínica. `patientId` acota EN SQL; sin él, el registro es de toda la clínica. */
export type RegistryQuery=Readonly<{patientId?:string;limit?:number;cursor?:string|null}>;

/**
 * Filtro por paciente sobre el evento base (alias `a`), o fragmento vacío cuando el registro es de toda la clínica.
 * Se compara TEXTO CONTRA TEXTO, como el resto del runtime, y no es un detalle de estilo: el índice de la migración 0019
 * es `(tenant_id, (payload->>'patientId'), aggregate_type)`, una expresión de TEXTO. Al escribir este filtro casteando a
 * uuid, la expresión dejaba de coincidir con la indexada y el plan volvía a escanear el tenant entero filtrando después:
 * 386 buffers para devolver diez filas. Medido, no supuesto.
 */
export const porPaciente=(tx:Tx,q:RegistryQuery|undefined)=>
 q?.patientId?tx`and a.payload->>'patientId'=${q.patientId}`:tx``;

/**
 * Nombre VIGENTE del paciente (hallazgo D2): el del último alta o enmienda que TRAE `name`, la regla de `patientDemographicsOf`
 * (packages/patient-fold). Antes era el del alta, así que una corrección de nombre no llegaba a ningún registro. LATERAL: una
 * búsqueda por FILA DEVUELTA, no por fila del tenant. `pid` es la expresión del paciente; por omisión, la del evento base `a`
 * (un resumen agrupado pasa la suya, p. ej. tx`g.pid`, porque dentro del `group by` no puede correlacionar con `a`).
 */
export const nombreDePaciente=(tx:Tx,tenantId:string,pid:postgres.Fragment=tx`a.payload->>'patientId'`)=>tx`left join lateral (
  select pt.payload->>'name' as name from clinical_events pt
  where pt.tenant_id=${tenantId} and pt.aggregate_type='Patient' and pt.aggregate_id=(${pid})::uuid
    and pt.payload->>'kind'=any(${[...PATIENT_DEMOGRAPHIC_KINDS]}::text[]) and pt.payload ? 'name'
  order by pt.sequence desc limit 1) pn on true`;

/**
 * DEMOGRAFÍA VIGENTE del paciente (hallazgo D2), campo a campo con la regla de `patientDemographicsOf`: por cada campo de
 * PATIENT_DEMOGRAPHIC_FIELDS, el valor del último evento de PATIENT_DEMOGRAPHIC_KINDS que lo trae. Antes se combinaba el
 * alta con la ÚLTIMA enmienda: corregir solo el teléfono devolvía el nombre y la fecha de nacimiento del alta (edad, TFG,
 * tutor, receta). Alias fijo `r` = el evento REGISTERED del paciente; `d.demo` = jsonb con los campos vigentes presentes.
 */
export const demografiaVigente=(tx:Tx)=>tx`left join lateral (
  select jsonb_object_agg(f.key,f.value) as demo from (
   select distinct on (kv.key) kv.key, kv.value from clinical_events e cross join lateral jsonb_each(e.payload) kv
   where e.tenant_id=r.tenant_id and e.aggregate_type='Patient' and e.aggregate_id=r.aggregate_id
     and e.payload->>'kind'=any(${[...PATIENT_DEMOGRAPHIC_KINDS]}::text[]) and kv.key=any(${[...PATIENT_DEMOGRAPHIC_FIELDS]}::text[])
   order by kv.key, e.sequence desc) f) d on true`;

/**
 * Prefiltro de una búsqueda por un campo demográfico (SQL-1): pacientes en los que ALGÚN alta o enmienda aportó ese valor.
 * Es exacto como prefiltro porque el valor vigente sale necesariamente de uno de esos eventos, y evita calcular
 * `demografiaVigente` para todo el padrón en la detección de duplicados del alta. Alias fijo `r` = el evento REGISTERED.
 */
export const pacientesConValor=(tx:Tx,tenantId:string,field:PatientDemographicField,value:string,upper=false)=>tx`r.aggregate_id in (
  select c.aggregate_id from clinical_events c
  where c.tenant_id=${tenantId} and c.aggregate_type='Patient' and c.payload->>'kind'=any(${[...PATIENT_DEMOGRAPHIC_KINDS]}::text[])
    and ${upper?tx`upper(c.payload->>${field})`:tx`c.payload->>${field}`}=${value})`;

/**
 * OBSERVACIÓN VIGENTE de un signo vital (hallazgo D1), con la semántica de `foldVital` (packages/vital-fold): valor,
 * unidad, estado y bandera crítica son los del ÚLTIMO evento que aporta `value` (RECORDED o AMENDED), y una toma cuyo
 * último evento es VITAL_VOID_KIND no existe clínicamente. Alias fijo `r` = el evento RECORDED (paciente, tipo y momento de
 * la toma: los eventos posteriores no los repiten); `l` = último evento del agregado; `cur` = payload de la observación
 * vigente. Se usa SIEMPRE junto con `vitalNoAnulada`.
 */
export const vitalVigente=(tx:Tx)=>tx`join lateral (
  select c.payload from clinical_events c
  where c.tenant_id=r.tenant_id and c.aggregate_id=r.aggregate_id order by c.sequence desc limit 1) l on true
 join lateral (
  select v.payload from clinical_events v
  where v.tenant_id=r.tenant_id and v.aggregate_id=r.aggregate_id and v.payload ? 'value' order by v.sequence desc limit 1) cur on true`;
/** La toma no está anulada: su último evento no es VITAL_VOID_KIND (parámetro, no un literal duplicado). */
export const vitalNoAnulada=(tx:Tx)=>tx`l.payload->>'kind'<>${VITAL_VOID_KIND}`;

/**
 * Última transición de ciclo de vida del agregado. `kinds` restringe a las transiciones que de verdad cambian el estado:
 * un evento de ANOTACIÓN no puede convertirse en el estado del agregado (ADR-0240 §2). Sin `kinds`, la última de todas.
 */
export const ultimaTransicion=(tx:Tx,tenantId:string,kinds?:readonly string[])=>tx`left join lateral (
  select payload->>'kind' as kind from clinical_events c
  where c.tenant_id=${tenantId} and c.aggregate_id=a.aggregate_id
    ${kinds?tx`and c.payload->>'kind' = any(${kinds})`:tx``}
  order by c.sequence desc limit 1) lk on true`;

/** Número de eventos del agregado: la «versión» que publican los registros (concurrencia optimista de la UI). */
export const versionDelAgregado=(tx:Tx,tenantId:string)=>tx`left join lateral (
  select count(*)::int as version from clinical_events v
  where v.tenant_id=${tenantId} and v.aggregate_id=a.aggregate_id) vr on true`;

// Los tres LATERAL que traen VARIAS columnas de un mismo evento (ADMINISTERED de la vacuna, PAID de la factura, los
// atributos de la orden) se escriben explícitos en su registro. Se consideró un helper genérico con la lista de columnas
// como texto, y se descartó: habría exigido interpolar SQL crudo con `unsafe`, y en este repositorio no se abre esa puerta
// por ahorrar tres líneas.

// ---------------------------------------------------------------------------------------------------------------------
// PAGINACIÓN por cursor (keyset), con la misma caja de herramientas que ya usaban pacientes y timeline: `pagination.ts`.
// El orden es (occurred_at desc, aggregate_id desc) —estable y total, para que el cursor no repita ni se salte filas
// cuando dos eventos comparten fecha— y se piden `limit+1` filas para saber si hay página siguiente sin contar de nuevo.
// ---------------------------------------------------------------------------------------------------------------------
/** Condición del cursor: «estrictamente después» del último (fecha, id) entregado, en el orden descendente del listado. */
export const despuesDelCursor=(tx:Tx,after:readonly unknown[]|null)=>
 after?tx`and (a.occurred_at, a.aggregate_id) < (${String(after[0])}::timestamptz, ${String(after[1])}::uuid)`:tx``;
/** Orden estable del listado + una fila extra para detectar si hay siguiente página. */
export const paginaOrdenada=(tx:Tx,limit:number)=>tx`order by a.occurred_at desc, a.aggregate_id desc limit ${limit+1}`;

/**
 * Última transición POR AGREGADO de un tipo, como tabla derivada: para los RESÚMENES, que recorren todo el conjunto.
 * Se une por `aggregate_id` con `rn=1`. (En un listado acotado se usa `ultimaTransicion`, que es un LATERAL.)
 */
export const transicionesPorAgregado=(tx:Tx,tenantId:string,aggregateType:string,kinds?:readonly string[])=>tx`(
  select aggregate_id, payload->>'kind' as kind,
         row_number() over (partition by aggregate_id order by sequence desc) as rn
  from clinical_events
  where tenant_id=${tenantId} and aggregate_type=${aggregateType}
    ${kinds?tx`and payload->>'kind' = any(${kinds})`:tx``})`;

// Auditoría 2026-09-19, anexo R04 (R04-010): «reports no soporta rango de fechas». El tablero devolvía SIEMPRE la
// historia completa (salvo los ingresos, que ya acotaban al mes por L-09), así que no se podía responder «¿cuántas
// consultas hubo en marzo?» sin exportar todo y contar a mano.
//
// La ventana se aplica sobre `occurred_at`, la fecha del HECHO clínico, nunca sobre `recorded_at`: un resultado de ayer
// capturado hoy pertenece a ayer para cualquier indicador clínico, y mezclar las dos fechas produce números que no
// cuadran con el expediente. Sin ventana, el comportamiento es el de antes: toda la historia.
export type ReportWindow=Readonly<{fromIso?:string;toIso?:string}>;
export const enVentana=(tx:postgres.TransactionSql,w:ReportWindow|undefined)=>{
 if(!w?.fromIso&&!w?.toIso)return tx``;
 if(w.fromIso&&w.toIso)return tx`and a.occurred_at >= ${w.fromIso}::timestamptz and a.occurred_at < ${w.toIso}::timestamptz`;
 if(w.fromIso)return tx`and a.occurred_at >= ${w.fromIso}::timestamptz`;
 return tx`and a.occurred_at < ${w.toIso!}::timestamptz`;
};
