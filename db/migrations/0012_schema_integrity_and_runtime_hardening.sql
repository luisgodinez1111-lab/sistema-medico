
BEGIN;
-- Canonical per-aggregate projection table. v0007 already created projection_checkpoints with a different shape;
-- never reuse that name for a second incompatible contract.
CREATE TABLE IF NOT EXISTS projection_aggregate_checkpoints(
 tenant_id uuid NOT NULL,projection_name text NOT NULL,aggregate_id uuid NOT NULL,last_sequence bigint NOT NULL CHECK(last_sequence>=0),
 state_hash text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,projection_name,aggregate_id)
);

-- Canonical append-only audit chain with tenant-local serialization.
CREATE TABLE IF NOT EXISTS audit_chain_v3(
 tenant_id uuid NOT NULL,sequence bigint GENERATED ALWAYS AS IDENTITY,id uuid NOT NULL,previous_hash text,
 entry_hash text NOT NULL,actor_id uuid NOT NULL,action text NOT NULL,resource text NOT NULL,payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,sequence),UNIQUE(tenant_id,id),UNIQUE(tenant_id,entry_hash)
);

-- Make the historical outbox schema compatible with leased workers.
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS available_at timestamptz;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS locked_by text;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 8 CHECK(max_attempts BETWEEN 1 AND 100);
ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_state_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_state_check CHECK(state IN('PENDING','LEASED','DELIVERED','RETRY','DEAD_LETTER'));
UPDATE outbox SET available_at=COALESCE(available_at,next_attempt_at,created_at) WHERE available_at IS NULL;
ALTER TABLE outbox ALTER COLUMN available_at SET NOT NULL;

-- Repair latent signed-encounter trigger bug: encounter column is state, not status.
CREATE OR REPLACE FUNCTION app.prevent_signed_encounter_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND OLD.state='SIGNED' THEN RAISE EXCEPTION 'SIGNED_ENCOUNTER_IMMUTABLE'; END IF;
 IF TG_OP='UPDATE' AND OLD.state='SIGNED' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'SIGNED_ENCOUNTER_IMMUTABLE'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

-- Fail-closed tenant isolation for runtime clinical tables.
ALTER TABLE patients ENABLE ROW LEVEL SECURITY; ALTER TABLE patients FORCE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY; ALTER TABLE encounters FORCE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_results ENABLE ROW LEVEL SECURITY; ALTER TABLE diagnostic_results FORCE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY; ALTER TABLE medications FORCE ROW LEVEL SECURITY;
ALTER TABLE obligations ENABLE ROW LEVEL SECURITY; ALTER TABLE obligations FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical_events ENABLE ROW LEVEL SECURITY; ALTER TABLE clinical_events FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY; ALTER TABLE outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE projection_aggregate_checkpoints ENABLE ROW LEVEL SECURITY; ALTER TABLE projection_aggregate_checkpoints FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_chain_v3 ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_chain_v3 FORCE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['patients','encounters','diagnostic_results','medications','obligations','clinical_events','outbox','projection_aggregate_checkpoints','audit_chain_v3']
 LOOP
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_v16 ON %I',t);
  EXECUTE format('CREATE POLICY tenant_isolation_v16 ON %I USING (tenant_id=app.current_tenant()) WITH CHECK (tenant_id=app.current_tenant())',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION app.prevent_audit_chain_v3_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'AUDIT_CHAIN_APPEND_ONLY'; END $$;
DROP TRIGGER IF EXISTS audit_chain_v3_append_only ON audit_chain_v3;
CREATE TRIGGER audit_chain_v3_append_only BEFORE UPDATE OR DELETE ON audit_chain_v3 FOR EACH ROW EXECUTE FUNCTION app.prevent_audit_chain_v3_mutation();

CREATE INDEX IF NOT EXISTS outbox_claim_v16_idx ON outbox(state,available_at,locked_until,id) WHERE state IN('PENDING','RETRY','LEASED');
CREATE INDEX IF NOT EXISTS projection_aggregate_checkpoint_idx ON projection_aggregate_checkpoints(tenant_id,aggregate_id,projection_name);
COMMIT;
