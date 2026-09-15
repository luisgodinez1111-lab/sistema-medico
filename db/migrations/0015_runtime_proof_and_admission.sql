
BEGIN;
CREATE TABLE IF NOT EXISTS runtime_proof_ledger(
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id uuid NOT NULL UNIQUE,release_id text NOT NULL,claim_id text NOT NULL,
 proof_state text NOT NULL CHECK(proof_state IN('SOURCE','EXECUTED_MODEL','EXECUTED_RUNTIME','HUMAN_APPROVED')),
 environment text NOT NULL,artifact_hashes jsonb NOT NULL,previous_hash text NOT NULL,proof_hash text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS runtime_verification_runs(
 id uuid PRIMARY KEY,release_id text NOT NULL,kind text NOT NULL,status text NOT NULL CHECK(status IN('PASS','FAIL','NOT_RUN')),
 cases bigint NOT NULL DEFAULT 0 CHECK(cases>=0),environment jsonb NOT NULL,evidence_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS release_admission_v6(
 release_id text PRIMARY KEY,state text NOT NULL CHECK(state IN('BLOCKED','ADMISSIBLE')),blockers jsonb NOT NULL,evidence_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION app.prevent_proof_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PROOF_LEDGER_APPEND_ONLY'; END $$;
DROP TRIGGER IF EXISTS runtime_proof_append_only ON runtime_proof_ledger;
CREATE TRIGGER runtime_proof_append_only BEFORE UPDATE OR DELETE ON runtime_proof_ledger FOR EACH ROW EXECUTE FUNCTION app.prevent_proof_mutation();
COMMIT;
