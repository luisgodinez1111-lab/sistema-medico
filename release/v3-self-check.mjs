
import fs from "node:fs";import crypto from "node:crypto";import path from "node:path";
const load=p=>JSON.parse(fs.readFileSync(p)),errors=[];
const caps=load("capabilities/catalog.json"),manifest=load("release/test-evidence-manifest.json");
const ids=new Set(caps.map(x=>x.id));for(const c of caps){for(const d of c.dependsOn??[])if(!ids.has(d))errors.push(`UNKNOWN_DEP:${c.id}:${d}`);}
const map=new Map(caps.map(x=>[x.id,x.dependsOn??[]])),vis=new Set(),done=new Set();
const walk=x=>{if(vis.has(x))errors.push(`CAP_CYCLE:${x}`);if(done.has(x))return;vis.add(x);for(const d of map.get(x)??[])walk(d);vis.delete(x);done.add(x)};for(const c of caps)walk(c.id);
for(const x of manifest){if(!fs.existsSync(x.test)){errors.push(`MISSING_TEST:${x.test}`);continue;}const h=crypto.createHash("sha256").update(fs.readFileSync(x.test)).digest("hex");if(h!==x.sha256)errors.push(`HASH:${x.test}`);if(!x.authority?.length)errors.push(`NO_AUTH:${x.test}`);}
const required=["packages/event-kernel/src/index.ts","packages/tenant-security/src/index.ts","packages/audit-ledger/src/index.ts","packages/outbox/src/index.ts","packages/feature-gates/src/index.ts","packages/policy-engine/src/index.ts","packages/observability/src/index.ts"];
for(const p of required)if(!fs.existsSync(p))errors.push(`MISSING_PLATFORM:${p}`);
console.log(JSON.stringify({status:errors.length?"FAIL":"PASS",counts:{capabilities:caps.length,testSources:manifest.length,platformPrimitives:required.length},errors},null,2));if(errors.length)process.exit(1);
