
BEGIN;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS obligation_source_unique ON obligations(tenant_id,source_id) WHERE source_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS patient_state_projection(
 tenant_id uuid NOT NULL,patient_id uuid NOT NULL,version bigint NOT NULL DEFAULT 0,
 open_obligations integer NOT NULL DEFAULT 0 CHECK(open_obligations>=0),
 overdue_obligations integer NOT NULL DEFAULT 0 CHECK(overdue_obligations>=0),
 active_medications integer NOT NULL DEFAULT 0 CHECK(active_medications>=0),
 open_results integer NOT NULL DEFAULT 0 CHECK(open_results>=0),
 last_encounter_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,patient_id)
);
CREATE INDEX IF NOT EXISTS outbox_claim_idx ON outbox(state,next_attempt_at,created_at) WHERE state IN('PENDING','RETRY');
ALTER TABLE obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_state_projection ENABLE ROW LEVEL SECURITY;
COMMIT;
