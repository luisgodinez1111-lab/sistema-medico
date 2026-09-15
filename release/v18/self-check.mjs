
import fs from"node:fs";import crypto from"node:crypto";const j=p=>JSON.parse(fs.readFileSync(p)),E=[],m=j("release/test-evidence-manifest.json"),c=j("capabilities/catalog.json");
for(const x of m){if(!fs.existsSync(x.test)){E.push("MISSING:"+x.test);continue;}if(crypto.createHash("sha256").update(fs.readFileSync(x.test)).digest("hex")!==x.sha256)E.push("HASH:"+x.test);}
for(const p of["packages/state-machine-model/src/index.ts","packages/property-invariants/src/index.ts","packages/api-fuzz-boundary/src/index.ts","packages/concurrency-model/src/index.ts","packages/mutation-sentinel/src/index.ts","packages/clinical-numeric/src/index.ts","db/migrations/0014_adversarial_verification.sql"])if(!fs.existsSync(p))E.push("CORE:"+p);
console.log(JSON.stringify({status:E.length?"FAIL":"PASS",capabilities:c.length,testSources:m.length,errors:E},null,2));if(E.length)process.exit(1);
