-- EPIC B — GRANTs least-privilege para el rol runtime NOBYPASSRLS `medical_os_runtime`.
-- Sin estos privilegios de tabla el wiring del golden slice (endpoint autenticado) falla con
-- "permission denied": el modelo de roles existía, pero faltaba el least-privilege por tabla.
-- El aislamiento sigue garantizado por RLS (FORCE ROW LEVEL SECURITY + políticas por tenant);
-- estos GRANTs solo abren la superficie mínima que el kernel atómico necesita.
BEGIN;
-- Comando clínico atómico (executeAtomicClinicalCommand):
GRANT SELECT, INSERT, UPDATE ON command_idempotency TO medical_os_runtime;
GRANT SELECT, INSERT, UPDATE ON aggregate_versions  TO medical_os_runtime;
GRANT SELECT, INSERT           ON clinical_events    TO medical_os_runtime;
GRANT SELECT, INSERT           ON outbox             TO medical_os_runtime;
-- Cadena de auditoría a prueba de manipulación (app.append_audit_v17, SECURITY INVOKER):
GRANT SELECT, INSERT, UPDATE ON audit_chain_heads TO medical_os_runtime;
GRANT SELECT, INSERT         ON audit_chain_v3    TO medical_os_runtime;
GRANT EXECUTE ON FUNCTION app.append_audit_v17(uuid,uuid,uuid,text,text,jsonb) TO medical_os_runtime;
COMMIT;
