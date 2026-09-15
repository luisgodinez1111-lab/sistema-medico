export type ColumnContract=Readonly<{table:string;required:readonly string[]}>;
export const runtimeSchemaContracts:readonly ColumnContract[]=[
 {table:"clinical_events",required:["id","tenant_id","aggregate_id","aggregate_type","sequence","actor_id","actor_type","authority","correlation_id","payload","schema_version","occurred_at"]},
 {table:"outbox",required:["id","tenant_id","topic","aggregate_id","payload","attempts","state","available_at","locked_until","max_attempts"]},
 {table:"audit_chain_v3",required:["tenant_id","sequence","id","previous_hash","entry_hash","actor_id","action","resource","payload","created_at"]},
 {table:"projection_aggregate_checkpoints",required:["tenant_id","projection_name","aggregate_id","last_sequence","state_hash","updated_at"]},
 {table:"command_idempotency",required:["tenant_id","actor_id","key","request_hash","status","response_json","expires_at"]}
];
