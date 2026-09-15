BEGIN;
CREATE TABLE IF NOT EXISTS command_idempotency(
 tenant_id uuid NOT NULL,actor_id uuid NOT NULL,key text NOT NULL,request_hash text NOT NULL,
 status text NOT NULL CHECK(status IN('IN_PROGRESS','COMPLETED','FAILED')),response_json jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,actor_id,key)
);
CREATE TABLE IF NOT EXISTS reconciliation_findings(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,patient_id uuid,kind text NOT NULL,severity text NOT NULL,
 owner_id uuid NOT NULL,recovery text NOT NULL,status text NOT NULL DEFAULT 'OPEN',
 created_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz
);
CREATE TABLE IF NOT EXISTS signed_record_versions(
 tenant_id uuid NOT NULL,document_id uuid NOT NULL,version bigint NOT NULL,content_hash text NOT NULL,
 signature text NOT NULL,signed_by uuid NOT NULL,signed_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,document_id,version)
);
CREATE TABLE IF NOT EXISTS release_evidence(
 release_id text NOT NULL,kind text NOT NULL,state text NOT NULL,artifact text NOT NULL,sha256 text NOT NULL,
 runner text NOT NULL,toolchain jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(release_id,kind,sha256)
);
ALTER TABLE command_idempotency ENABLE ROW LEVEL SECURITY;ALTER TABLE command_idempotency FORCE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_findings ENABLE ROW LEVEL SECURITY;ALTER TABLE reconciliation_findings FORCE ROW LEVEL SECURITY;
ALTER TABLE signed_record_versions ENABLE ROW LEVEL SECURITY;ALTER TABLE signed_record_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY command_idempotency_tenant ON command_idempotency USING(tenant_id=app.current_tenant()) WITH CHECK(tenant_id=app.current_tenant());
CREATE POLICY reconciliation_findings_tenant ON reconciliation_findings USING(tenant_id=app.current_tenant()) WITH CHECK(tenant_id=app.current_tenant());
CREATE POLICY signed_record_versions_tenant ON signed_record_versions USING(tenant_id=app.current_tenant()) WITH CHECK(tenant_id=app.current_tenant());

CREATE OR REPLACE FUNCTION app.prevent_signed_record_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'SIGNED_RECORD_APPEND_ONLY'; END $$;
DROP TRIGGER IF EXISTS signed_record_no_update_delete ON signed_record_versions;
CREATE TRIGGER signed_record_no_update_delete BEFORE UPDATE OR DELETE ON signed_record_versions
FOR EACH ROW EXECUTE FUNCTION app.prevent_signed_record_mutation();

CREATE INDEX IF NOT EXISTS reconciliation_open_idx ON reconciliation_findings(tenant_id,severity,owner_id,created_at) WHERE status<>'RESOLVED';
CREATE INDEX IF NOT EXISTS command_idempotency_expiry_idx ON command_idempotency(expires_at);
COMMIT;