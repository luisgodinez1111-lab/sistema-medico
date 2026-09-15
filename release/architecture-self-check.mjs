
import fs from "node:fs"; import crypto from "node:crypto";
const load=p=>JSON.parse(fs.readFileSync(p));
const errors=[];
const inv=load("safety/core-invariants.json"), haz=load("safety/core-hazards.json"), ctl=load("safety/controls/catalog.json");
const invIds=new Set(inv.map(x=>x.id)), ctlIds=new Set(ctl.map(x=>x.id));
for(const h of haz){if(!h.authority?.length)errors.push(`HAZ_NO_AUTHORITY:${h.id}`);if(!h.controls?.length)errors.push(`HAZ_NO_CONTROL:${h.id}`);for(const c of h.controls??[])if(!ctlIds.has(c))errors.push(`HAZ_UNKNOWN_CONTROL:${h.id}:${c}`);}
for(const c of ctl){if(!c.authority?.length)errors.push(`CTL_NO_AUTHORITY:${c.id}`);if(c.invariant&&!invIds.has(c.invariant))errors.push(`CTL_UNKNOWN_INV:${c.id}:${c.invariant}`);if(!c.verification?.length)errors.push(`CTL_NO_VERIFICATION:${c.id}`);}
for(const i of inv){if(!i.authority?.length)errors.push(`INV_NO_AUTHORITY:${i.id}`);if(!i.predicate)errors.push(`INV_NO_PREDICATE:${i.id}`);if(!i.tests?.length)errors.push(`INV_NO_TEST:${i.id}`);}
const manifest=load("release/test-evidence-manifest.json");
for(const x of manifest){if(!fs.existsSync(x.test)){errors.push(`MISSING_TEST:${x.test}`);continue;}const h=crypto.createHash("sha256").update(fs.readFileSync(x.test)).digest("hex");if(h!==x.sha256)errors.push(`HASH_MISMATCH:${x.test}`);if(!x.authority?.length)errors.push(`UNBOUND_TEST:${x.test}`);}
const result={status:errors.length?"FAIL":"PASS",counts:{invariants:inv.length,hazards:haz.length,controls:ctl.length,testSources:manifest.length},errors};
console.log(JSON.stringify(result,null,2)); if(errors.length)process.exit(1);
