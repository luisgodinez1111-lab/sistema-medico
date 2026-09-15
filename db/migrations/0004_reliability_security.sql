
BEGIN;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
ALTER TABLE encounters FORCE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_results FORCE ROW LEVEL SECURITY;
ALTER TABLE medications FORCE ROW LEVEL SECURITY;
ALTER TABLE obligations FORCE ROW LEVEL SECURITY;
ALTER TABLE patient_state_projection FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS locked_by text;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS last_error text;
CREATE TABLE IF NOT EXISTS clinical_amendments(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,document_id uuid NOT NULL,previous_hash text NOT NULL,
 content_hash text NOT NULL,reason text NOT NULL,author_id uuid NOT NULL,at timestamptz NOT NULL,hash text NOT NULL UNIQUE
);
ALTER TABLE clinical_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_amendments FORCE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS amendments_document_idx ON clinical_amendments(tenant_id,document_id,at);
COMMIT;
