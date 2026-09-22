BEGIN;
-- Auditoría 2026-09-19 — D-04, D-01, D-05.
--
-- D-04 · Seis tablas tenían RLS ENABLE + FORCE y NINGUNA política: denegación total para todo rol sin BYPASSRLS, incluida la
-- evidencia de accesos de emergencia (break_glass_events) y las decisiones de acceso. No era una fuga: era inutilización.
-- Misma política de aislamiento por tenant que el resto del esquema (0012, tenant_isolation_v16).
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['access_decisions','aggregate_snapshots','ai_execution_receipts','break_glass_events','clinical_amendments','patient_state_projection'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_v20 ON %I',t);
  EXECUTE format('CREATE POLICY tenant_isolation_v20 ON %I USING (tenant_id=app.current_tenant()) WITH CHECK (tenant_id=app.current_tenant())',t);
 END LOOP;
END $$;
-- D-01 · `audit_ledger` (0001) e `idempotency_keys` (0005) son restos del andamio: ningún código de la aplicación las lee ni
-- las escribe (la cadena de auditoría real es audit_chain_v3 y la idempotencia real es command_idempotency). Tenían columna
-- tenant_id y NINGÚN aislamiento. Se aíslan por tenant como todo lo demás y se cierran al rol de la aplicación, que nunca
-- las necesitó. Se conservan (no se borran datos en una migración); su eliminación es una decisión de limpieza aparte.
ALTER TABLE audit_ledger     ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_ledger     FORCE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY; ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_v20 ON audit_ledger;
CREATE POLICY tenant_isolation_v20 ON audit_ledger     USING (tenant_id=app.current_tenant()) WITH CHECK (tenant_id=app.current_tenant());
DROP POLICY IF EXISTS tenant_isolation_v20 ON idempotency_keys;
CREATE POLICY tenant_isolation_v20 ON idempotency_keys USING (tenant_id=app.current_tenant()) WITH CHECK (tenant_id=app.current_tenant());
REVOKE ALL ON audit_ledger, idempotency_keys FROM medical_os_runtime;
COMMENT ON TABLE audit_ledger     IS 'LEGADO (auditoría D-01, 2026-09): sin lectores ni escritores en la aplicación. La cadena de auditoría vigente es audit_chain_v3.';
COMMENT ON TABLE idempotency_keys IS 'LEGADO (auditoría D-01, 2026-09): sin lectores ni escritores en la aplicación. La idempotencia vigente es command_idempotency.';
-- D-05 · Dos `CREATE TABLE IF NOT EXISTS` incompatibles bajo el mismo nombre: la SEGUNDA definición nunca se aplicó.
--   release_evidence:       vale la forma de 0005 (capability_id/state/artifact_hash…); la de 0010 (release_id/kind/sha256…) es letra muerta.
--   projection_checkpoints: vale la forma de 0007 (por proyección); la de 0011 (por agregado) es letra muerta y su intención
--                           la cubre projection_aggregate_checkpoints (0012).
-- Las migraciones aplicadas no se editan (D-07); queda documentado en el propio esquema y vigilado por
-- tests/v22/migrations-integrity.test.ts, que prohíbe nuevas colisiones de nombre.
COMMENT ON TABLE release_evidence       IS 'Forma vigente: 0005_production_engineering.sql. La definición de 0010_atomic_runtime.sql nunca se aplicó (auditoría D-05).';
COMMENT ON TABLE projection_checkpoints IS 'Forma vigente: 0007_golden_vertical_slice.sql (por proyección). La definición de 0011 nunca se aplicó; los checkpoints por agregado están en projection_aggregate_checkpoints (auditoría D-05).';
COMMIT;
