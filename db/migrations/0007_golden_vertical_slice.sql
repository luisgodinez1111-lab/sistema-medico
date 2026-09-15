
BEGIN;
CREATE TABLE IF NOT EXISTS encounter_signatures(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,encounter_id uuid NOT NULL,encounter_version bigint NOT NULL,
 patient_id uuid NOT NULL,author_id uuid NOT NULL,content_hash text NOT NULL,signature_digest text NOT NULL UNIQUE,
 signed_at timestamptz NOT NULL,UNIQUE(tenant_id,encounter_id,encounter_version)
);
CREATE TABLE IF NOT EXISTS result_obligation_links(
 tenant_id uuid NOT NULL,result_id uuid NOT NULL,obligation_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,result_id,obligation_id)
);
CREATE TABLE IF NOT EXISTS projection_checkpoints(
 tenant_id uuid NOT NULL,projection_name text NOT NULL,last_sequence bigint NOT NULL,checkpoint_hash text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,projection_name)
);
CREATE TABLE IF NOT EXISTS clinical_inbox(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,patient_id uuid NOT NULL,kind text NOT NULL,
 priority text NOT NULL CHECK(priority IN('ROUTINE','HIGH','URGENT')),owner_id uuid NOT NULL,due_at timestamptz,
 source_id uuid,created_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz
);
ALTER TABLE encounter_signatures ENABLE ROW LEVEL SECURITY; ALTER TABLE encounter_signatures FORCE ROW LEVEL SECURITY;
ALTER TABLE result_obligation_links ENABLE ROW LEVEL SECURITY; ALTER TABLE result_obligation_links FORCE ROW LEVEL SECURITY;
ALTER TABLE projection_checkpoints ENABLE ROW LEVEL SECURITY; ALTER TABLE projection_checkpoints FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical_inbox ENABLE ROW LEVEL SECURITY; ALTER TABLE clinical_inbox FORCE ROW LEVEL SECURITY;
CREATE POLICY encounter_signature_tenant ON encounter_signatures USING (tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY result_obligation_tenant ON result_obligation_links USING (tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY checkpoint_tenant ON projection_checkpoints USING (tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE POLICY inbox_tenant ON clinical_inbox USING (tenant_id=current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);
CREATE INDEX IF NOT EXISTS clinical_inbox_owner_priority_idx ON clinical_inbox(tenant_id,owner_id,priority,due_at) WHERE resolved_at IS NULL;
COMMIT;
