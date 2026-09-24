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
