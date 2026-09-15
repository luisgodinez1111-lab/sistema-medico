
import fs from"node:fs";import crypto from"node:crypto";const j=p=>JSON.parse(fs.readFileSync(p)),e=[],m=j("release/test-evidence-manifest.json"),c=j("capabilities/catalog.json");
for(const x of m){if(!fs.existsSync(x.test)){e.push("MISSING:"+x.test);continue;}if(crypto.createHash("sha256").update(fs.readFileSync(x.test)).digest("hex")!==x.sha256)e.push("HASH:"+x.test);}
const req=["packages/session/src/index.ts","packages/sql-repositories/src/index.ts","packages/reconciliation-engine/src/index.ts","packages/encounter-completeness/src/index.ts","packages/amendment-ledger/src/index.ts","packages/result-impact/src/index.ts","packages/ai-runtime/src/index.ts","db/migrations/0004_reliability_security.sql"];
for(const p of req)if(!fs.existsSync(p))e.push("CORE:"+p);console.log(JSON.stringify({status:e.length?"FAIL":"PASS",counts:{capabilities:c.length,testSources:m.length,required:req.length},errors:e},null,2));if(e.length)process.exit(1);
