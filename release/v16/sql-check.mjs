
import fs from"node:fs";const s=fs.readFileSync("db/migrations/0012_schema_integrity_and_runtime_hardening.sql","utf8");
const C={canonicalProjection:s.includes("projection_aggregate_checkpoints"),auditV3:s.includes("audit_chain_v3"),
outboxLease:s.includes("locked_until")&&s.includes("LEASED"),triggerRepair:s.includes("OLD.state"),
forceRls:(s.match(/FORCE ROW LEVEL SECURITY/g)||[]).length>=9,tenantPolicy:s.includes("tenant_isolation_v16"),
appendOnlyAudit:s.includes("AUDIT_CHAIN_APPEND_ONLY")};
const bad=Object.entries(C).filter(([,v])=>!v);console.log(JSON.stringify({status:bad.length?"FAIL":"PASS",checks:C},null,2));if(bad.length)process.exit(1);
