// Lote 11 (ADR-0300) — fragmentos SQL compartidos por los read models. Extraído de apps/web/lib/clinical-runtime.ts en 11.1; los
// hallazgos D1 y D2 añaden las proyecciones que replican la regla de su fold (vitales vigentes, demografía vigente).
import postgres from"postgres";
import{VITAL_VOID_KIND}from"../../../../packages/vital-fold/src";
import{PATIENT_DEMOGRAPHIC_FIELDS,PATIENT_DEMOGRAPHIC_KINDS}from"../../../../packages/patient-fold/src";
// Auditoría L-04/K-05 — Eventos de ANOTACIÓN por tipo de agregado: enriquecen el agregado sin cambiar su estado. Toda
// consulta genérica que derive el estado del "último evento" debe ignorarlos; si no, corregir el teléfono de un paciente
// fallecido lo mostraba ACTIVO, y modificar una dosis habría sacado la medicación de la lista de activas.
// Alias fijo `c` (el de las subconsultas latest_kind). AMENDED es anotación SOLO en Patient (en VitalSign/Document es estado).
export const lifecycleEventOnly=(tx:postgres.TransactionSql)=>tx`not (
  (c.aggregate_type='Medication' and c.payload->>'kind' in ('MODIFIED','RECONCILED'))
  or (c.aggregate_type='ClinicalProblem' and c.payload->>'kind' in ('EPISTEMIC_CHANGED','EVIDENCE_UPDATED'))
  or (c.aggregate_type='Patient' and c.payload->>'kind'='AMENDED'))`;
// Hallazgo D1 del lote 11 — OBSERVACIÓN VIGENTE de un signo vital, con la semántica de packages/vital-fold: valor, unidad,
// estado y bandera crítica son los del ÚLTIMO evento que aporta valor (RECORDED o AMENDED) y un signo vital cuyo último
// evento es VITAL_VOID_KIND (ENTERED_IN_ERROR) no existe clínicamente. Antes los read models leían solo el RECORDED original:
// un peso corregido de 70 a 7 kg seguía pesando 70 kg en las barreras de prescripción, y un valor anulado seguía en NEWS2.
// Alias: `r` = el evento RECORDED (paciente, tipo y momento de la toma: los eventos posteriores no los repiten),
// `cur` = payload de la observación vigente, `last` = último evento del agregado.
export const currentVitalJoins=(tx:postgres.TransactionSql)=>tx`join lateral (select l.payload->>'kind' as kind from clinical_events l where l.tenant_id=r.tenant_id and l.aggregate_id=r.aggregate_id order by l.sequence desc limit 1) last on true
   join lateral (select v.payload from clinical_events v where v.tenant_id=r.tenant_id and v.aggregate_id=r.aggregate_id and v.payload ? 'value' order by v.sequence desc limit 1) cur on true`;
export const vitalNotVoided=(tx:postgres.TransactionSql)=>tx`last.kind<>${VITAL_VOID_KIND}`;
// Hallazgo D2 del lote 11 — DEMOGRAFÍA VIGENTE del paciente, con la regla de packages/patient-fold (`patientDemographicsOf`):
// por campo, el valor del último evento de PATIENT_DEMOGRAPHIC_KINDS que lo trae. Antes se combinaba el alta con la ÚLTIMA
// enmienda: corregir solo el teléfono devolvía el nombre y la fecha de nacimiento del alta (edad, TFG, tutor, receta).
// Alias: `r` = el evento REGISTERED del paciente; `d.demo` = jsonb con los campos vigentes presentes.
export const patientDemographicsJoin=(tx:postgres.TransactionSql)=>tx`left join lateral (
   select jsonb_object_agg(f.key,f.value) as demo from (
    select distinct on (kv.key) kv.key, kv.value from clinical_events e cross join lateral jsonb_each(e.payload) kv
    where e.tenant_id=r.tenant_id and e.aggregate_id=r.aggregate_id and e.payload->>'kind'=any(${[...PATIENT_DEMOGRAPHIC_KINDS]}::text[])
      and kv.key=any(${[...PATIENT_DEMOGRAPHIC_FIELDS]}::text[])
    order by kv.key, e.sequence desc) f) d on true`;
// Nombre VIGENTE del paciente de un agregado clínico (listas de agenda, órdenes, resultados, vacunas…), misma regla.
// Alias fijo `a` = el evento del agregado que lleva `payload.patientId`.
export const currentPatientName=(tx:postgres.TransactionSql,tenantId:string)=>tx`(select p.payload->>'name' from clinical_events p
      where p.tenant_id=${tenantId} and p.aggregate_type='Patient' and p.aggregate_id=(a.payload->>'patientId')::uuid
        and p.payload->>'kind'=any(${[...PATIENT_DEMOGRAPHIC_KINDS]}::text[]) and p.payload ? 'name' order by p.sequence desc limit 1)`;
