import fs from"node:fs";const s=fs.readFileSync("db/migrations/0010_atomic_runtime.sql","utf8");const C={
idempotency:s.includes("command_idempotency")&&s.includes("PRIMARY KEY(tenant_id,actor_id,key)"),
reconciliation:s.includes("reconciliation_findings")&&s.includes("owner_id uuid NOT NULL"),
signedAppendOnly:s.includes("SIGNED_RECORD_APPEND_ONLY"),
forceRls:(s.match(/FORCE ROW LEVEL SECURITY/g)||[]).length>=3,
safeTenant:s.includes("app.current_tenant()"),
releaseEvidence:s.includes("release_evidence")
};const bad=Object.entries(C).filter(([,v])=>!v);console.log(JSON.stringify({status:bad.length?"FAIL":"PASS",checks:C},null,2));if(bad.length)process.exit(1);