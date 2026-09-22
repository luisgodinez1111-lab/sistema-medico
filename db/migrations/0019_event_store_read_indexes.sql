-- Auditoría 2026-09-19 (S-08) — índices de LECTURA del event store.
-- Hasta aquí clinical_events solo tenía (tenant_id, aggregate_id, sequence): toda lectura "por paciente" (timeline,
-- gate de firma, últimos analitos, obligaciones, medicaciones activas) y todo registro "por tipo/kind" recorrían los
-- eventos del tenant completos. Son índices sobre expresiones del payload, exactamente las que usan las consultas.
-- Idempotente; sin CONCURRENTLY porque las migraciones corren dentro de una transacción en el bootstrap.
-- Sin predicado parcial: el planificador no puede deducir `payload ? 'patientId'` de `payload->>'patientId' = $1`, así que
-- un índice parcial no se usaría. Las filas sin patientId indexan NULL (coste despreciable).
CREATE INDEX IF NOT EXISTS clinical_events_tenant_patient_idx
  ON clinical_events (tenant_id, (payload->>'patientId'), aggregate_type);
CREATE INDEX IF NOT EXISTS clinical_events_tenant_type_kind_idx
  ON clinical_events (tenant_id, aggregate_type, (payload->>'kind'));
-- Timeline y worklist parten del PRIMER evento de cada agregado.
CREATE INDEX IF NOT EXISTS clinical_events_tenant_first_event_idx
  ON clinical_events (tenant_id, occurred_at DESC, aggregate_id)
  WHERE sequence = 1;
