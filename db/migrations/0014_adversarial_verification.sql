
BEGIN;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS fencing_token bigint NOT NULL DEFAULT 0 CHECK(fencing_token>=0);
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
CREATE TABLE IF NOT EXISTS mutation_test_runs(
 id uuid PRIMARY KEY,release_id text NOT NULL,total integer NOT NULL CHECK(total>=0),killed integer NOT NULL CHECK(killed>=0 AND killed<=total),
 critical_survivors integer NOT NULL CHECK(critical_survivors>=0),report_hash text NOT NULL,executed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS restore_drills_v2(
 id uuid PRIMARY KEY,release_id text NOT NULL,schema_hash_match boolean NOT NULL,audit_chain_valid boolean NOT NULL,
 tenant_isolation_pass boolean NOT NULL,projection_replay_match boolean NOT NULL,open_obligations_match boolean NOT NULL,
 evidence_hash text NOT NULL,executed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS performance_evidence(
 id uuid PRIMARY KEY,release_id text NOT NULL,scenario text NOT NULL,p50_ms numeric NOT NULL,p95_ms numeric NOT NULL,p99_ms numeric NOT NULL,
 error_rate numeric NOT NULL,throughput_rps numeric NOT NULL,runner_hash text NOT NULL,executed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_fencing_claim_idx ON outbox(state,available_at,locked_until,fencing_token,id) WHERE state IN('PENDING','RETRY','LEASED');
COMMIT;
