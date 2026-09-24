-- Auditoría 2026-09-19, anexo R01 (R01-014) — REVOCACIÓN DE SESIÓN. La sesión es un token HMAC autocontenido: hasta ahora
-- el logout solo borraba la cookie, así que un token exfiltrado (XSS, portapapeles, log de un proxy) seguía siendo válido
-- hasta cumplir su TTL de 15 minutos, y no existía ninguna forma de cortar una sesión en curso. Esta tabla es la lista de
-- denegación consultada por toda operación que toque la base: si el sessionId está aquí, la petición se rechaza.
--
-- Sin PHI: solo el identificador opaco de la sesión, el tenant, el actor (UUID derivado del sujeto OIDC), el motivo y las
-- marcas de tiempo. `expires_at` permite purgar filas que ya no pueden importar (el token caducó por sí solo).
BEGIN;
CREATE TABLE IF NOT EXISTS session_revocations(
 session_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 reason text NOT NULL DEFAULT 'LOGOUT',
 revoked_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
COMMENT ON TABLE session_revocations IS 'Lista de denegación de sesiones (auditoría R01-014). Sin PHI. Se consulta en cada transacción con contexto de tenant; las filas caducadas se purgan con session_revocations_gc().';
-- Purga por caducidad: una sesión cuyo token ya expiró no necesita seguir en la lista.
CREATE INDEX IF NOT EXISTS session_revocations_expires_idx ON session_revocations(expires_at);
-- Aislamiento por tenant, igual que el resto de tablas con tenant_id (ADR-0250): RLS forzada + política de tenant.
ALTER TABLE session_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_revocations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_session_revocations ON session_revocations;
CREATE POLICY tenant_isolation_session_revocations ON session_revocations
 USING (tenant_id = app.current_tenant()) WITH CHECK (tenant_id = app.current_tenant());
GRANT SELECT, INSERT ON session_revocations TO medical_os_runtime;
-- Revoca una sesión (idempotente: revocar dos veces no es un error) y devuelve si ya estaba revocada.
CREATE OR REPLACE FUNCTION revoke_session(p_session_id uuid, p_tenant_id uuid, p_actor_id uuid, p_reason text, p_expires_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_existed boolean;
BEGIN
 SELECT true INTO v_existed FROM session_revocations WHERE session_id = p_session_id;
 INSERT INTO session_revocations(session_id, tenant_id, actor_id, reason, expires_at)
  VALUES (p_session_id, p_tenant_id, p_actor_id, COALESCE(p_reason,'LOGOUT'), p_expires_at)
  ON CONFLICT (session_id) DO NOTHING;
 RETURN COALESCE(v_existed, false);
END $$;
-- Purga de filas cuyo token ya caducó (operación de mantenimiento, sin efecto en la decisión de seguridad).
CREATE OR REPLACE FUNCTION session_revocations_gc()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_deleted integer;
BEGIN
 DELETE FROM session_revocations WHERE expires_at < now() - interval '1 hour';
 GET DIAGNOSTICS v_deleted = ROW_COUNT;
 RETURN v_deleted;
END $$;
COMMIT;
