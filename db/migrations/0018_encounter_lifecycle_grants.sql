-- EPIC D — GRANT least-privilege adicional para el ciclo de vida del encuentro.
-- El gate de firma (Zero Lost Follow-Up) consulta obligaciones críticas del paciente en
-- clinical_inbox; el rol runtime necesita SELECT (solo lectura, RLS sigue forzando el tenant).
BEGIN;
GRANT SELECT ON clinical_inbox TO medical_os_runtime;
COMMIT;
