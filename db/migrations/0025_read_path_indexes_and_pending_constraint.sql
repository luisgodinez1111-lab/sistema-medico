-- Auditoría 2026-09-19, anexo R06 — R06-21, R06-22 y R06-13.
--
-- El lote 0019 (S-08) puso los tres índices generales del event store: (tenant, patientId, aggregate_type),
-- (tenant, aggregate_type, kind) y el del primer evento. Faltaban las expresiones de TRES caminos calientes que el anexo
-- R06 midió y que siguen resolviéndose con escaneo del tenant completo:
--
--  · R06-21 — lectura de laboratorio por ANALITO (`latestAnalyteReading`, `analyteSeries`): el predicado es
--    `upper(payload->>'analyte') = upper($1)`, una expresión sobre texto extraído de jsonb envuelta en upper() en los dos
--    lados. Ningún índice la cubre, y de aquí cuelgan eGFR, MELD, FIB-4, ácido-base, gradiente A-a, panel metabólico,
--    HbA1c, INR, CURB-65 y las tendencias: doce rutas clínicas sobre el mismo escaneo.
--
--  · R06-22 (CRÍTICA) — el GATE DE FIRMA del encuentro (`countOpenCriticalResults`, `countOpenCriticalVitals`), que es lo
--    que impide firmar con un resultado o un signo vital crítico sin resolver. El segundo lleva dentro un `NOT EXISTS`
--    correlacionado sobre `payload->>'sourceVitalId'`, es decir un escaneo por cada vital crítico del paciente. Es el hot
--    path de la firma: si se degrada, la consulta que protege al paciente es la primera que se vuelve lenta, y la presión
--    para «quitar el gate porque tarda» aparece justo donde no debe.
--
--  · R06-13 — `obligations_owner_due_ck` se agregó `NOT VALID` en 0008 y nunca se validó. Postgres no la usa para
--    optimizar y las filas anteriores nunca se revisaron: la constraint existe y no garantiza nada del pasado.
--
-- Idempotente; sin CONCURRENTLY porque las migraciones corren dentro de una transacción en el bootstrap.
BEGIN;

-- R06-21: lectura del último resultado de un analito y su serie. La expresión indexada es EXACTAMENTE la del predicado
-- (`upper(payload->>'analyte')`), porque un índice sobre `payload->>'analyte'` no cubre la consulta envuelta en upper().
-- Parcial por aggregate_type: el planificador sí puede deducirlo de la igualdad literal del WHERE.
CREATE INDEX IF NOT EXISTS clinical_events_result_by_analyte_idx
  ON clinical_events (tenant_id, (payload->>'patientId'), (upper(payload->>'analyte')), occurred_at DESC, sequence DESC)
  WHERE aggregate_type = 'DiagnosticResult';

-- R06-22: el `NOT EXISTS` del gate de firma busca la obligación creada a partir de un vital crítico concreto. Sin este
-- índice, cada vital crítico del paciente provoca un escaneo de las obligaciones del tenant.
CREATE INDEX IF NOT EXISTS clinical_events_obligation_source_vital_idx
  ON clinical_events (tenant_id, (payload->>'sourceVitalId'))
  WHERE aggregate_type = 'ClinicalObligation';

-- R06-22: la otra mitad del gate cuenta resultados y vitales CRÍTICOS del paciente. El filtro es
-- (tenant, patientId, critical='true') dentro de un aggregate_type, y el de 0019 no llega al flag `critical`.
CREATE INDEX IF NOT EXISTS clinical_events_critical_by_patient_idx
  ON clinical_events (tenant_id, aggregate_type, (payload->>'patientId'), (payload->>'critical'))
  WHERE payload->>'critical' = 'true';

-- R06-20: los registros clínica-wide (resultados, problemas, órdenes, citas…) ordenan por occurred_at desc dentro del
-- tenant y del tipo. El índice de 0019 tiene (tenant, aggregate_type, kind) pero no la fecha, así que el orden se resolvía
-- con un sort del conjunto completo.
CREATE INDEX IF NOT EXISTS clinical_events_registry_recent_idx
  ON clinical_events (tenant_id, aggregate_type, occurred_at DESC);

-- R06-13: la constraint pasa a VALIDADA. `VALIDATE CONSTRAINT` toma un lock que NO bloquea lecturas ni escrituras
-- concurrentes (solo otros DDL), a diferencia de haberla creado validada desde el principio.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'obligations' AND c.conname = 'obligations_owner_due_ck' AND NOT c.convalidated
  ) THEN
    ALTER TABLE obligations VALIDATE CONSTRAINT obligations_owner_due_ck;
  END IF;
END $$;

COMMIT;
