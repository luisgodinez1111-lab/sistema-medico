
BEGIN;
CREATE TABLE IF NOT EXISTS aggregate_snapshots(
 tenant_id uuid NOT NULL,aggregate_id uuid NOT NULL,aggregate_type text NOT NULL,version bigint NOT NULL,state jsonb NOT NULL,hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,aggregate_id,version)
);
CREATE TABLE IF NOT EXISTS access_decisions(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,actor_id uuid NOT NULL,patient_id uuid,allowed boolean NOT NULL,reason text NOT NULL,policy_version text NOT NULL,at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS break_glass_events(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,actor_id uuid NOT NULL,patient_id uuid NOT NULL,reason text NOT NULL,expires_at timestamptz NOT NULL,reviewed_by uuid,reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS policy_versions(
 id text NOT NULL,version text NOT NULL,authority jsonb NOT NULL,effective_from timestamptz NOT NULL,effective_to timestamptz,hash text NOT NULL,body jsonb NOT NULL,PRIMARY KEY(id,version)
);
CREATE INDEX IF NOT EXISTS access_decision_actor_idx ON access_decisions(tenant_id,actor_id,at DESC);
CREATE INDEX IF NOT EXISTS break_glass_review_idx ON break_glass_events(tenant_id,created_at) WHERE reviewed_at IS NULL;
ALTER TABLE aggregate_snapshots ENABLE ROW LEVEL SECURITY; ALTER TABLE aggregate_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE access_decisions ENABLE ROW LEVEL SECURITY; ALTER TABLE access_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE break_glass_events ENABLE ROW LEVEL SECURITY; ALTER TABLE break_glass_events FORCE ROW LEVEL SECURITY;
COMMIT;
