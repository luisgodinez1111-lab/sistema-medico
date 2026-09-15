
BEGIN;
CREATE TABLE IF NOT EXISTS idempotency_keys(
 tenant_id uuid NOT NULL,key text NOT NULL,request_hash text NOT NULL,status text NOT NULL CHECK(status IN('IN_PROGRESS','COMPLETED','FAILED')),
 response jsonb,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,key)
);
CREATE TABLE IF NOT EXISTS release_evidence(
 id uuid PRIMARY KEY,capability_id text NOT NULL,state text NOT NULL CHECK(state IN('MISSING','GENERATED','EXECUTED_PASS','EXECUTED_FAIL','HUMAN_REVIEW_PENDING','HUMAN_APPROVED')),
 artifact_hash text NOT NULL,authority jsonb NOT NULL,runner text,commit_sha text,reviewer text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_execution_receipts(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,patient_id uuid,task_id text NOT NULL,model text NOT NULL,model_version text NOT NULL,
 prompt_template_version text NOT NULL,input_hash text NOT NULL,evidence_ids jsonb NOT NULL,output_hash text NOT NULL,
 decision text NOT NULL CHECK(decision IN('ACCEPTED','REJECTED','ABSTAINED')),reviewer_id uuid,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idempotency_expiry_idx ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS ai_receipt_patient_idx ON ai_execution_receipts(tenant_id,patient_id,created_at DESC);
ALTER TABLE ai_execution_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_execution_receipts FORCE ROW LEVEL SECURITY;
COMMIT;
