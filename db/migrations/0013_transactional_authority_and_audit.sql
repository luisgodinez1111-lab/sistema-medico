BEGIN;
CREATE TABLE IF NOT EXISTS audit_chain_heads(tenant_id uuid PRIMARY KEY,last_sequence bigint NOT NULL DEFAULT 0,last_hash text NOT NULL DEFAULT 'GENESIS');
ALTER TABLE audit_chain_heads ENABLE ROW LEVEL SECURITY;ALTER TABLE audit_chain_heads FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_v17 ON audit_chain_heads;CREATE POLICY tenant_isolation_v17 ON audit_chain_heads USING(tenant_id=app.current_tenant()) WITH CHECK(tenant_id=app.current_tenant());
CREATE OR REPLACE FUNCTION app.append_audit_v17(p_tenant uuid,p_id uuid,p_actor uuid,p_action text,p_resource text,p_payload jsonb) RETURNS text LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE h audit_chain_heads%ROWTYPE; seq bigint; digest text;
BEGIN
 IF app.current_tenant() IS NULL OR app.current_tenant()<>p_tenant THEN RAISE EXCEPTION 'TENANT_CONTEXT_MISMATCH'; END IF;
 INSERT INTO audit_chain_heads(tenant_id) VALUES(p_tenant) ON CONFLICT DO NOTHING;
 SELECT * INTO h FROM audit_chain_heads WHERE tenant_id=p_tenant FOR UPDATE;
 seq:=h.last_sequence+1;
 digest:=encode(digest(convert_to(jsonb_build_object('tenant',p_tenant,'sequence',seq,'id',p_id,'previousHash',h.last_hash,'actor',p_actor,'action',p_action,'resource',p_resource,'payload',p_payload)::text,'UTF8'),'sha256'),'hex');
 INSERT INTO audit_chain_v3(tenant_id,sequence,id,previous_hash,entry_hash,actor_id,action,resource,payload) OVERRIDING SYSTEM VALUE VALUES(p_tenant,seq,p_id,h.last_hash,digest,p_actor,p_action,p_resource,p_payload);
 UPDATE audit_chain_heads SET last_sequence=seq,last_hash=digest WHERE tenant_id=p_tenant;RETURN digest;
END $$;
ALTER TABLE audit_chain_v3 ALTER COLUMN previous_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS audit_chain_v3_tenant_sequence ON audit_chain_v3(tenant_id,sequence);
-- Strengthen correction lineage persistence.
CREATE TABLE IF NOT EXISTS result_correction_edges(tenant_id uuid NOT NULL,id uuid PRIMARY KEY,patient_id uuid NOT NULL,original_result_id uuid NOT NULL,corrected_result_id uuid NOT NULL,reason text NOT NULL,author_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),CHECK(original_result_id<>corrected_result_id),UNIQUE(tenant_id,corrected_result_id));
ALTER TABLE result_correction_edges ENABLE ROW LEVEL SECURITY;ALTER TABLE result_correction_edges FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_v17 ON result_correction_edges USING(tenant_id=app.current_tenant()) WITH CHECK(tenant_id=app.current_tenant());
CREATE OR REPLACE FUNCTION app.prevent_result_correction_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'RESULT_CORRECTION_APPEND_ONLY'; END $$;
CREATE TRIGGER result_correction_append_only BEFORE UPDATE OR DELETE ON result_correction_edges FOR EACH ROW EXECUTE FUNCTION app.prevent_result_correction_mutation();
-- Durable worker receipts cannot be rewritten.
CREATE OR REPLACE FUNCTION app.prevent_consumer_receipt_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'CONSUMER_RECEIPT_APPEND_ONLY'; END $$;
DROP TRIGGER IF EXISTS consumer_receipt_append_only ON outbox_consumer_receipts;CREATE TRIGGER consumer_receipt_append_only BEFORE UPDATE OR DELETE ON outbox_consumer_receipts FOR EACH ROW EXECUTE FUNCTION app.prevent_consumer_receipt_mutation();
COMMIT;