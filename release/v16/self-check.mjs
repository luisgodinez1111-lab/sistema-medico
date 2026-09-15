
import fs from"node:fs";import crypto from"node:crypto";const j=p=>JSON.parse(fs.readFileSync(p)),E=[],m=j("release/test-evidence-manifest.json"),c=j("capabilities/catalog.json");
for(const x of m){if(!fs.existsSync(x.test)){E.push("MISSING:"+x.test);continue;}if(crypto.createHash("sha256").update(fs.readFileSync(x.test)).digest("hex")!==x.sha256)E.push("HASH:"+x.test);}
for(const p of["packages/atomic-clinical-transaction-v2/src/index.ts","packages/audit-chain-v3/src/index.ts","packages/outbox-claim-v2/src/index.ts","packages/secure-logger/src/index.ts","db/migrations/0012_schema_integrity_and_runtime_hardening.sql","db/roles_v16.sql"])if(!fs.existsSync(p))E.push("CORE:"+p);
console.log(JSON.stringify({status:E.length?"FAIL":"PASS",capabilities:c.length,testSources:m.length,errors:E},null,2));if(E.length)process.exit(1);
