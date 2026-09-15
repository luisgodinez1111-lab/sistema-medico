
import fs from"node:fs";import crypto from"node:crypto";const j=p=>JSON.parse(fs.readFileSync(p)),E=[],m=j("release/test-evidence-manifest.json"),c=j("capabilities/catalog.json");
for(const x of m){if(!fs.existsSync(x.test)){E.push("MISSING:"+x.test);continue;}if(crypto.createHash("sha256").update(fs.readFileSync(x.test)).digest("hex")!==x.sha256)E.push("HASH:"+x.test);}
const req=["packages/etag/src/index.ts","packages/fhir-r5/src/index.ts","packages/calculation-receipt/src/index.ts","packages/degradation/src/index.ts","packages/clinical-lock/src/index.ts","packages/consent-enforcement/src/index.ts","packages/export-control/src/index.ts","packages/read-model/src/index.ts"];
for(const p of req)if(!fs.existsSync(p))E.push("CORE:"+p);console.log(JSON.stringify({status:E.length?"FAIL":"PASS",counts:{capabilities:c.length,testSources:m.length,required:req.length},errors:E},null,2));if(E.length)process.exit(1);
