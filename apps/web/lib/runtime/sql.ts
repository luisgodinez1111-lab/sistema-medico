// Lote 11 (ADR-0300) — fragmentos SQL compartidos por los read models. Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import postgres from"postgres";
// Auditoría L-04/K-05 — Eventos de ANOTACIÓN por tipo de agregado: enriquecen el agregado sin cambiar su estado. Toda
// consulta genérica que derive el estado del "último evento" debe ignorarlos; si no, corregir el teléfono de un paciente
// fallecido lo mostraba ACTIVO, y modificar una dosis habría sacado la medicación de la lista de activas.
// Alias fijo `c` (el de las subconsultas latest_kind). AMENDED es anotación SOLO en Patient (en VitalSign/Document es estado).
export const lifecycleEventOnly=(tx:postgres.TransactionSql)=>tx`not (
  (c.aggregate_type='Medication' and c.payload->>'kind' in ('MODIFIED','RECONCILED'))
  or (c.aggregate_type='ClinicalProblem' and c.payload->>'kind' in ('EPISTEMIC_CHANGED','EVIDENCE_UPDATED'))
  or (c.aggregate_type='Patient' and c.payload->>'kind'='AMENDED'))`;
