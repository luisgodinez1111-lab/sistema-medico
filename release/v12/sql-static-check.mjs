
import fs from"node:fs";const p="db/migrations/0008_executable_clinical_core.sql",s=fs.readFileSync(p,"utf8"),checks={
safeTenantHelper:s.includes("NULLIF(current_setting('app.tenant_id',true),'')::uuid"),
forceRls:s.includes("FORCE ROW LEVEL SECURITY"),
idempotencyActorKey:s.includes("idempotency_actor_key_uq"),
outboxLease:s.includes("locked_until")&&s.includes("max_attempts"),
consumerReceipt:s.includes("consumer_receipts"),
signedImmutable:s.includes("SIGNED_ENCOUNTER_IMMUTABLE"),
correctionSelfCycle:s.includes("CHECK(original_result_id<>corrected_result_id)")
};const bad=Object.entries(checks).filter(([,v])=>!v);console.log(JSON.stringify({status:bad.length?"FAIL":"PASS",checks},null,2));if(bad.length)process.exit(1);
