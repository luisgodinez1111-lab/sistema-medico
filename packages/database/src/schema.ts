export const schema = {
 patients:["id","tenant_id","version","status","birth_date","sex_at_birth","created_at","updated_at"],
 encounters:["id","tenant_id","patient_id","version","state","signed_at","created_at","updated_at"],
 clinical_events:["id","tenant_id","aggregate_id","aggregate_type","sequence","actor_id","actor_type","authority","correlation_id","causation_id","payload","schema_version","occurred_at","recorded_at"],
 outbox:["id","tenant_id","topic","aggregate_id","payload","attempts","state","next_attempt_at","created_at"],
 obligations:["id","tenant_id","patient_id","owner_id","due_at","state","version","completion_evidence"],
 audit_ledger:["id","tenant_id","actor_id","action","resource","prev_hash","hash","at"]
} as const;
