
import fs from"node:fs";import crypto from"node:crypto";const j=p=>JSON.parse(fs.readFileSync(p)),E=[],m=j("release/test-evidence-manifest.json"),c=j("capabilities/catalog.json");
for(const x of m){if(!fs.existsSync(x.test)){E.push("MISSING:"+x.test);continue;}if(crypto.createHash("sha256").update(fs.readFileSync(x.test)).digest("hex")!==x.sha256)E.push("HASH:"+x.test);}
const req=["packages/postgres-adapter/src/index.ts","packages/runtime-auth/src/index.ts","packages/idempotent-command/src/index.ts","packages/encounter-runtime/src/index.ts","packages/obligation-runtime/src/index.ts","packages/medication-runtime/src/index.ts","packages/result-correction-runtime/src/index.ts","packages/patient-impact-runtime/src/index.ts","packages/projection-runtime/src/index.ts","packages/outbox-worker/src/index.ts","db/migrations/0008_executable_clinical_core.sql"];
for(const p of req)if(!fs.existsSync(p))E.push("CORE:"+p);
console.log(JSON.stringify({status:E.length?"FAIL":"PASS",counts:{capabilities:c.length,testSources:m.length,required:req.length},errors:E},null,2));if(E.length)process.exit(1);
