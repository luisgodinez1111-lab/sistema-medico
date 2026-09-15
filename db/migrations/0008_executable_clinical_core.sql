
BEGIN;
CREATE SCHEMA IF NOT EXISTS app;
CREATE OR REPLACE FUNCTION app.current_tenant() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('app.tenant_id',true),'')::uuid
$$;
CREATE OR REPLACE FUNCTION app.current_actor() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('app.actor_id',true),'')::uuid
$$;

ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS response_status integer;
CREATE UNIQUE INDEX IF NOT EXISTS idempotency_actor_key_uq ON idempotency_keys(tenant_id,actor_id,key);

ALTER TABLE outbox ADD COLUMN IF NOT EXISTS locked_by text;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 8;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS dead_letter_at timestamptz;
CREATE INDEX IF NOT EXISTS outbox_claim_idx ON outbox(state,available_at,locked_until);

ALTER TABLE obligations ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS due_at timestamptz;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS priority text DEFAULT 'ROUTINE';
ALTER TABLE obligations ADD CONSTRAINT obligations_owner_due_ck CHECK (
 state <> 'OPEN' OR (owner_id IS NOT NULL AND due_at IS NOT NULL)
) NOT VALID;

CREATE TABLE IF NOT EXISTS result_corrections(
 tenant_id uuid NOT NULL,original_result_id uuid NOT NULL,corrected_result_id uuid NOT NULL,
 reason text NOT NULL,author_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,corrected_result_id),
 CHECK(original_result_id<>corrected_result_id)
);
CREATE INDEX IF NOT EXISTS result_corrections_original_idx ON result_corrections(tenant_id,original_result_id);

CREATE TABLE IF NOT EXISTS consumer_receipts(
 tenant_id uuid NOT NULL,consumer text NOT NULL,message_id uuid NOT NULL,processed_at timestamptz NOT NULL DEFAULT now(),
 result_hash text,PRIMARY KEY(tenant_id,consumer,message_id)
);

ALTER TABLE result_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_corrections FORCE ROW LEVEL SECURITY;
ALTER TABLE consumer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY result_corrections_tenant ON result_corrections
 USING (tenant_id=app.current_tenant()) WITH CHECK (tenant_id=app.current_tenant());
CREATE POLICY consumer_receipts_tenant ON consumer_receipts
 USING (tenant_id=app.current_tenant()) WITH CHECK (tenant_id=app.current_tenant());

CREATE OR REPLACE FUNCTION app.prevent_signed_encounter_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='SIGNED' AND NEW IS DISTINCT FROM OLD THEN
  RAISE EXCEPTION 'SIGNED_ENCOUNTER_IMMUTABLE';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS encounters_signed_immutable ON encounters;
CREATE TRIGGER encounters_signed_immutable BEFORE UPDATE OR DELETE ON encounters
 FOR EACH ROW EXECUTE FUNCTION app.prevent_signed_encounter_mutation();

COMMIT;
