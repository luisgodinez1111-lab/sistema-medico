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
type Tx=postgres.TransactionSql;

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

/** Nombre del paciente del evento base. LATERAL: una búsqueda por FILA DEVUELTA, no por fila del tenant. */
export const nombreDePaciente=(tx:Tx,tenantId:string)=>tx`left join lateral (
  select payload->>'name' as name from clinical_events pt
  where pt.tenant_id=${tenantId} and pt.aggregate_type='Patient' and pt.payload->>'kind'='REGISTERED'
    and pt.aggregate_id=(a.payload->>'patientId')::uuid
  limit 1) pn on true`;

/**
 * Última transición de ciclo de vida del agregado. `kinds` restringe a las transiciones que de verdad cambian el estado:
 * un evento de ANOTACIÓN no puede convertirse en el estado del agregado (ADR-0240 §2). Sin `kinds`, la última de todas.
 */
export const ultimaTransicion=(tx:Tx,tenantId:string,kinds?:readonly string[])=>tx`left join lateral (
  select payload->>'kind' as kind, c.occurred_at as at from clinical_events c
  where c.tenant_id=${tenantId} and c.aggregate_id=a.aggregate_id
    ${kinds?tx`and c.payload->>'kind' = any(${kinds})`:tx``}
  order by c.sequence desc limit 1) lk on true`;

/**
 * Número de eventos del agregado: la «versión» que publican los registros (concurrencia optimista de la UI), y la fecha en
 * que el agregado NACIÓ.
 *
 * Auditoría clínica multiespecialidad (06-oct-2026) — `created_at` se añade aquí, no en una consulta nueva. Las filas del
 * expediente imprimían `v{version}` en el lugar donde iba la fecha, y ocho especialistas coincidieron en que un dato
 * clínico sin fecha no es un dato clínico: «alergia a penicilina» sin el año no se puede valorar. Este LATERAL ya recorre
 * todos los eventos del agregado para contarlos, así que el `min(occurred_at)` sale del mismo escaneo: coste cero y una
 * sola fuente de verdad para las dos cosas. `lk.at` (en `ultimaTransicion`) da la otra fecha que importa: cuándo cambió
 * por última vez. Son distintas y las dos se usan — cuándo se registró una alergia y cuándo se suspendió un fármaco no
 * son la misma pregunta.
 */
export const versionDelAgregado=(tx:Tx,tenantId:string)=>tx`left join lateral (
  select count(*)::int as version, min(v.occurred_at) as created_at from clinical_events v
  where v.tenant_id=${tenantId} and v.aggregate_id=a.aggregate_id) vr on true`;

/**
 * Anti-uniones para resultados RETRACTADOS. Un resultado anulado (ENTERED_IN_ERROR) o corregido (superado por un RECEIVED
 * nuevo con `supersedes`) NO es vigente y no debe reaparecer en registros/KPI/worklist. Se resuelven como LATERAL (igual que
 * el resto de atributos por fila; ADR R06-20: en `registries.ts` no puede haber subconsulta correlacionada en el SELECT).
 * Vigente = `anul.anulado is null and sup.superseded is null`. Alias `a` = evento base (RECEIVED). Criterio de anulado:
 * «alguna vez», no «última transición» — una anotación posterior no resucita un resultado retractado.
 */
export const anuladoLat=(tx:Tx,tenantId:string)=>tx`left join lateral (
  select 1 as anulado from clinical_events v
  where v.tenant_id=${tenantId} and v.aggregate_id=a.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR'
  limit 1) anul on true`;
export const supersedidoLat=(tx:Tx,tenantId:string)=>tx`left join lateral (
  select 1 as superseded from clinical_events s
  where s.tenant_id=${tenantId} and s.aggregate_type='DiagnosticResult' and s.payload->>'kind'='RECEIVED' and s.payload->>'supersedes'=a.aggregate_id::text
  limit 1) sup on true`;

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
