
import fs from"node:fs";import crypto from"node:crypto";const j=p=>JSON.parse(fs.readFileSync(p)),E=[],m=j("release/test-evidence-manifest.json"),c=j("capabilities/catalog.json");
for(const x of m){if(!fs.existsSync(x.test)){E.push("MISSING:"+x.test);continue;}if(crypto.createHash("sha256").update(fs.readFileSync(x.test)).digest("hex")!==x.sha256)E.push("HASH:"+x.test);}
const req=["packages/golden-slice/src/index.ts","packages/clinical-unit-of-work/src/index.ts","packages/encounter-signing/src/index.ts","packages/result-obligation-link/src/index.ts","packages/medication-ordering/src/index.ts","packages/timeline-projection/src/index.ts","packages/clinical-inbox/src/index.ts","packages/route-contracts/src/index.ts","db/migrations/0007_golden_vertical_slice.sql"];
for(const p of req)if(!fs.existsSync(p))E.push("CORE:"+p);
console.log(JSON.stringify({status:E.length?"FAIL":"PASS",counts:{capabilities:c.length,testSources:m.length,required:req.length},errors:E},null,2));if(E.length)process.exit(1);
