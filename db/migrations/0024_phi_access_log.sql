-- Auditoría 2026-09-19, anexo R01 (R01-026) y deuda D-09 — AUDITORÍA DE LECTURAS de PHI.
--
-- El problema: `app.append_audit_v17` solo se invoca al ESCRIBIR un comando, así que la cadena de auditoría contaba quién
-- cambió el expediente pero no quién lo MIRÓ. En un expediente clínico eso es media historia: el acceso indebido de un
-- profesional a la ficha de un paciente que no atiende es el incidente más común y no dejaba ninguna huella. Peor aún,
-- `docs/adr/ADR-0230` afirmaba que «cada acceso queda en la cadena de auditoría», lo que era falso para las lecturas.
--
-- Qué registra: quién (actor y sesión), qué recurso (tipo e identificador), de qué paciente, con qué propósito declarado,
-- desde qué petición y cuándo. NO registra el CONTENIDO leído: guardar el valor sería duplicar PHI en una segunda tabla.
-- Es append-only para la aplicación (sin UPDATE ni DELETE), igual que la cadena de auditoría.
BEGIN;
CREATE TABLE IF NOT EXISTS phi_access_log(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 session_id uuid,
 purpose text NOT NULL,
 request_id text NOT NULL,
 resource_type text NOT NULL,
 resource_id uuid NOT NULL,
 patient_id uuid,
 action text NOT NULL DEFAULT 'READ',
 at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT phi_access_log_action_chk CHECK (action IN ('READ','EXPORT','PRINT'))
);
COMMENT ON TABLE phi_access_log IS 'Auditoría de LECTURAS de PHI (auditoría R01-026 / D-09): quién accedió a qué expediente, cuándo y con qué propósito. Nunca guarda el contenido leído. Append-only para la aplicación.';
-- Consultas previstas: «todo lo que se leyó de este paciente» y «todo lo que leyó este actor», ambas por fecha.
CREATE INDEX IF NOT EXISTS phi_access_log_patient_idx ON phi_access_log(tenant_id, patient_id, at DESC);
CREATE INDEX IF NOT EXISTS phi_access_log_actor_idx ON phi_access_log(tenant_id, actor_id, at DESC);
-- Aislamiento por tenant (ADR-0250): RLS forzada + política de tenant.
ALTER TABLE phi_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE phi_access_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_phi_access_log ON phi_access_log;
CREATE POLICY tenant_isolation_phi_access_log ON phi_access_log
 USING (tenant_id = app.current_tenant()) WITH CHECK (tenant_id = app.current_tenant());
-- La aplicación añade y consulta; NUNCA modifica ni borra (el borrado por retención lo hace el propietario del esquema).
GRANT SELECT, INSERT ON phi_access_log TO medical_os_runtime;
COMMIT;
