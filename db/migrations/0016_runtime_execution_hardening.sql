
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='medical_os_runtime') THEN CREATE ROLE medical_os_runtime LOGIN NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='medical_os_worker') THEN CREATE ROLE medical_os_worker LOGIN NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='medical_os_readonly') THEN CREATE ROLE medical_os_readonly LOGIN NOBYPASSRLS; END IF;
END $$;
CREATE OR REPLACE FUNCTION app.current_actor() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.actor_id', true),'')::uuid
$$;
CREATE OR REPLACE FUNCTION app.current_purpose() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.purpose', true),'')
$$;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public,app TO medical_os_runtime,medical_os_worker,medical_os_readonly;
ALTER TABLE clinical_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_events FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE command_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_idempotency FORCE ROW LEVEL SECURITY;
COMMIT;
