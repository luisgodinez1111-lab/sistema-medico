
import fs from"node:fs";
const read=p=>fs.readFileSync(p,"utf8"), findings=[];
const atomic=read("packages/atomic-clinical-transaction-v2/src/index.ts");
if(atomic.includes("sql.unsafe"))findings.push(["S1","DYNAMIC_SQL","Atomic transaction uses unsafe dynamic SQL"]);
for(const required of["aggregate_type","actor_type","authority","correlation_id","schema_version","occurred_at"])if(!atomic.includes(required))findings.push(["S1","EVENT_SCHEMA",`Atomic event missing ${required}`]);
const m8=read("db/migrations/0008_executable_clinical_core.sql");
if(m8.includes("OLD.status"))findings.push(["S2","HISTORICAL_TRIGGER_DEFECT","v0008 contains OLD.status; repaired by v0012"]);
const m7=read("db/migrations/0007_golden_vertical_slice.sql"),m11=read("db/migrations/0011_reproducible_clinical_runtime.sql");
if(m7.includes("CREATE TABLE IF NOT EXISTS projection_checkpoints")&&m11.includes("CREATE TABLE IF NOT EXISTS projection_checkpoints"))
 findings.push(["S2","HISTORICAL_SCHEMA_DRIFT","projection_checkpoints was re-declared incompatibly; v0012 introduces projection_aggregate_checkpoints"]);
const m12=read("db/migrations/0012_schema_integrity_and_runtime_hardening.sql");
for(const token of["projection_aggregate_checkpoints","audit_chain_v3","SIGNED_ENCOUNTER_IMMUTABLE","FORCE ROW LEVEL SECURITY","outbox_state_check"])
 if(!m12.includes(token))findings.push(["S1","REPAIR_MISSING",token]);
const unresolved=findings.filter(x=>x[0]==="S1");
console.log(JSON.stringify({status:unresolved.length?"FAIL":"PASS",findings,unresolvedCritical:unresolved.length},null,2));
if(unresolved.length)process.exit(1);
