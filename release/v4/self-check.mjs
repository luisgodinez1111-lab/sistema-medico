
import fs from "node:fs";import crypto from "node:crypto";const load=p=>JSON.parse(fs.readFileSync(p)),errors=[];
const manifest=load("release/test-evidence-manifest.json"),caps=load("capabilities/catalog.json");
for(const x of manifest){if(!fs.existsSync(x.test)){errors.push(`MISSING:${x.test}`);continue;}const h=crypto.createHash("sha256").update(fs.readFileSync(x.test)).digest("hex");if(h!==x.sha256)errors.push(`HASH:${x.test}`);if(!x.authority?.length)errors.push(`AUTH:${x.test}`);}
const ids=new Set(caps.map(x=>x.id));if(ids.size!==caps.length)errors.push("DUPLICATE_CAPABILITY");
const required=["db/migrations/0001_core.sql","packages/patient-domain/src/index.ts","packages/encounter-domain/src/index.ts","packages/order-result-domain/src/index.ts","packages/medication-domain/src/index.ts","packages/obligation-domain/src/index.ts","packages/fhir-boundary/src/index.ts","packages/calculation-engine/src/index.ts","packages/workflow-engine/src/index.ts"];
for(const p of required)if(!fs.existsSync(p))errors.push(`MISSING_CORE:${p}`);
console.log(JSON.stringify({status:errors.length?"FAIL":"PASS",counts:{capabilities:caps.length,testSources:manifest.length,requiredCore:required.length},errors},null,2));if(errors.length)process.exit(1);
