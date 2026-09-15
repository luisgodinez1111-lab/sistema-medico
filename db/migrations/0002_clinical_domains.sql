
BEGIN;
CREATE TABLE IF NOT EXISTS encounters(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,patient_id uuid NOT NULL,version bigint NOT NULL CHECK(version>0),
 state text NOT NULL CHECK(state IN('PLANNED','OPEN','READY_TO_SIGN','SIGNED','AMENDED','CANCELLED')),
 signed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS encounters_patient_idx ON encounters(tenant_id,patient_id,created_at DESC);
CREATE TABLE IF NOT EXISTS diagnostic_results(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,patient_id uuid NOT NULL,order_id uuid NOT NULL,version bigint NOT NULL CHECK(version>0),
 state text NOT NULL CHECK(state IN('EXPECTED','RECEIVED','VERIFIED','REVIEWED','ACTIONED','PATIENT_INFORMED','CLOSED','CORRECTED')),
 supersedes uuid,closure_evidence text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS results_open_idx ON diagnostic_results(tenant_id,state,created_at) WHERE state NOT IN('CLOSED','CORRECTED');
CREATE TABLE IF NOT EXISTS medications(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,patient_id uuid NOT NULL,version bigint NOT NULL CHECK(version>0),
 state text NOT NULL CHECK(state IN('PROPOSED','PRESCRIBED','STARTED','ACTIVE','HELD','STOPPED','CANCELLED')),
 author_id uuid,reason text,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
COMMIT;
