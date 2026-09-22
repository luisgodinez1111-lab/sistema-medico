
import fs from "node:fs";import crypto from "node:crypto";const load=p=>JSON.parse(fs.readFileSync(p)),errors=[];
const m=load("release/test-evidence-manifest.json"),caps=load("capabilities/catalog.json");
for(const x of m){if(!fs.existsSync(x.test)){errors.push(`MISSING_TEST:${x.test}`);continue;}const h=crypto.createHash("sha256").update(fs.readFileSync(x.test)).digest("hex");if(h!==x.sha256)errors.push(`HASH:${x.test}`);}
const req=["apps/web/app/page.tsx","apps/web/app/api/health/route.ts","apps/worker/src/index.ts","db/migrations/0001_core.sql","db/migrations/0002_clinical_domains.sql","packages/clinical-api/src/patient-service.ts","packages/authz/src/index.ts","packages/repository/src/index.ts"];
for(const p of req)if(!fs.existsSync(p))errors.push(`MISSING:${p}`);
const ids=new Set(caps.map(x=>x.id));if(ids.size!==caps.length)errors.push("DUP_CAP");
console.log(JSON.stringify({status:errors.length?"FAIL":"PASS",counts:{capabilities:caps.length,testSources:m.length,applicationArtifacts:req.length},errors},null,2));if(errors.length)process.exit(1);
