BEGIN;
CREATE TABLE IF NOT EXISTS patients (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, version bigint NOT NULL CHECK(version>0),
 status text NOT NULL CHECK(status IN ('ACTIVE','INACTIVE','DECEASED')),
 birth_date date, sex_at_birth text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS clinical_events (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, aggregate_id uuid NOT NULL, aggregate_type text NOT NULL,
 sequence bigint NOT NULL CHECK(sequence>0), actor_id uuid NOT NULL, actor_type text NOT NULL,
 authority jsonb NOT NULL, correlation_id uuid NOT NULL, causation_id uuid, payload jsonb NOT NULL,
 schema_version integer NOT NULL CHECK(schema_version>0), occurred_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,aggregate_id,sequence)
);
CREATE INDEX IF NOT EXISTS clinical_events_aggregate_idx ON clinical_events(tenant_id,aggregate_id,sequence);
CREATE TABLE IF NOT EXISTS outbox (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, topic text NOT NULL, aggregate_id uuid NOT NULL, payload jsonb NOT NULL,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), state text NOT NULL CHECK(state IN ('PENDING','DELIVERED','RETRY','DEAD_LETTER')),
 next_attempt_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_delivery_idx ON outbox(state,next_attempt_at) WHERE state IN ('PENDING','RETRY');
CREATE TABLE IF NOT EXISTS obligations (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, patient_id uuid NOT NULL, owner_id uuid NOT NULL,
 due_at timestamptz NOT NULL, state text NOT NULL, version bigint NOT NULL CHECK(version>0), completion_evidence text
);
CREATE INDEX IF NOT EXISTS obligations_due_idx ON obligations(tenant_id,state,due_at) WHERE state NOT IN ('COMPLETED','CANCELLED');
CREATE TABLE IF NOT EXISTS audit_ledger (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, actor_id uuid NOT NULL, action text NOT NULL, resource text NOT NULL,
 prev_hash text NOT NULL, hash text NOT NULL UNIQUE, at timestamptz NOT NULL
);
COMMIT;
