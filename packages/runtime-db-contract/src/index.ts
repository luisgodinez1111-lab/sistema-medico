export const REQUIRED_RUNTIME_TABLES={
 aggregate_versions:["tenant_id","aggregate_id","version"],
 clinical_events:["tenant_id","aggregate_id","sequence","event_type","payload"],
 outbox:["tenant_id","id","aggregate_id","state","fencing_token"],
 command_idempotency:["tenant_id","actor_id","idempotency_key","request_hash","status"],
 audit_chain_v3:["tenant_id","sequence","entry_hash","previous_hash"]
} as const;
export function compareSchema(actual:Record<string,readonly string[]>){const missing:string[]=[];for(const[t,cols]of Object.entries(REQUIRED_RUNTIME_TABLES)){if(!actual[t]){missing.push(`TABLE:${t}`);continue}for(const c of cols)if(!actual[t].includes(c))missing.push(`COLUMN:${t}.${c}`)}return missing}
