BEGIN;
CREATE TABLE IF NOT EXISTS worker_leases(
 tenant_id uuid NOT NULL,resource text NOT NULL,owner text NOT NULL,fencing_token bigint NOT NULL,
 expires_at timestamptz NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,resource),UNIQUE(tenant_id,resource,fencing_token)
);
CREATE TABLE IF NOT EXISTS replay_verifications(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,aggregate_id uuid NOT NULL,live_hash text NOT NULL,
 replay_hash text NOT NULL,consistent boolean NOT NULL,verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS failure_drills(
 id uuid PRIMARY KEY,release_id text NOT NULL,fault text NOT NULL,status text NOT NULL,
 evidence_hash text NOT NULL,executed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE worker_leases ENABLE ROW LEVEL SECURITY;ALTER TABLE worker_leases FORCE ROW LEVEL SECURITY;
ALTER TABLE replay_verifications ENABLE ROW LEVEL SECURITY;ALTER TABLE replay_verifications FORCE ROW LEVEL SECURITY;
CREATE POLICY worker_leases_tenant ON worker_leases USING(tenant_id=app.current_tenant()) WITH CHECK(tenant_id=app.current_tenant());
CREATE POLICY replay_verifications_tenant ON replay_verifications USING(tenant_id=app.current_tenant()) WITH CHECK(tenant_id=app.current_tenant());
COMMIT;