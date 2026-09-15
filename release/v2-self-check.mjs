
import fs from "node:fs";import crypto from "node:crypto";import path from "node:path";
const load=p=>JSON.parse(fs.readFileSync(p)),errors=[];
const caps=load("capabilities/catalog.json"),haz=load("safety/core-hazards.json"),ctl=load("safety/controls/catalog.json"),inv=load("safety/core-invariants.json"),tm=load("release/test-evidence-manifest.json");
const H=new Set(haz.map(x=>x.id)),C=new Set(ctl.map(x=>x.id)),I=new Set(inv.map(x=>x.id)),T=new Map(tm.map(x=>[path.basename(x.test),x]));
for(const c of caps){
 if(!c.authority?.length)errors.push(`CAP_NO_AUTHORITY:${c.id}`);
 if(["C4","C5"].includes(c.risk)&&!c.hazards?.length&&c.releasePolicy!=="BLOCK_UNTIL_HAZARD_CASE_COMPLETE")errors.push(`CAP_NO_HAZARD:${c.id}`);
 for(const x of c.hazards??[])if(!H.has(x))errors.push(`CAP_BAD_HAZ:${c.id}:${x}`);
 for(const x of c.controls??[])if(!C.has(x))errors.push(`CAP_BAD_CTL:${c.id}:${x}`);
 for(const x of c.invariants??[])if(!I.has(x))errors.push(`CAP_BAD_INV:${c.id}:${x}`);
 for(const t of c.tests??[]){const m=T.get(t);if(!m){errors.push(`CAP_BAD_TEST:${c.id}:${t}`);continue;}const h=crypto.createHash("sha256").update(fs.readFileSync(m.test)).digest("hex");if(h!==m.sha256)errors.push(`CAP_TEST_HASH:${c.id}:${t}`);}
}
console.log(JSON.stringify({status:errors.length?"FAIL":"PASS",counts:{capabilities:caps.length,hazards:haz.length,controls:ctl.length,invariants:inv.length,testSources:tm.length},errors},null,2));
if(errors.length)process.exit(1);
