
import fs from"node:fs";import crypto from"node:crypto";const j=p=>JSON.parse(fs.readFileSync(p)),E=[],m=j("release/test-evidence-manifest.json"),c=j("capabilities/catalog.json"),ai=j("release/v9/ai-candidate-reconciliation.json");
for(const x of m){if(!fs.existsSync(x.test)){E.push("MISSING:"+x.test);continue;}if(crypto.createHash("sha256").update(fs.readFileSync(x.test)).digest("hex")!==x.sha256)E.push("HASH:"+x.test);}
if(ai.status!=="HUMAN_REVIEW_PENDING")E.push("AI_RECONCILIATION_FALSE_CLOSED");
const req=["packages/clinical-transaction/src/index.ts","packages/aggregate-store/src/index.ts","packages/projection-rebuild/src/index.ts","packages/access-decision/src/index.ts","packages/break-glass/src/index.ts","packages/policy-provenance/src/index.ts","packages/ai-task-registry/src/index.ts","packages/backup-restore/src/index.ts","packages/safety-case/src/index.ts","db/migrations/0006_operable_system.sql"];
for(const p of req)if(!fs.existsSync(p))E.push("CORE:"+p);console.log(JSON.stringify({status:E.length?"FAIL":"PASS",counts:{capabilities:c.length,testSources:m.length,required:req.length},aiReconciliation:ai.status,errors:E},null,2));if(E.length)process.exit(1);
