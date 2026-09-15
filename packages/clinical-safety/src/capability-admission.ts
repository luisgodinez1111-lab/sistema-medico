
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const root=process.cwd(), load=(p:string)=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const caps=load("capabilities/catalog.json"), haz=load("safety/core-hazards.json"), ctl=load("safety/controls/catalog.json"),
 inv=load("safety/core-invariants.json"), manifest=load("release/test-evidence-manifest.json"),
 execution=fs.existsSync(path.join(root,"release/test-execution.json"))?load("release/test-execution.json"):{status:"NOT_RUN"},
 defects=load("release/defects.json");
const hazIds=new Set(haz.map((x:any)=>x.id)),ctlIds=new Set(ctl.map((x:any)=>x.id)),invIds=new Set(inv.map((x:any)=>x.id));
const tests=new Map(manifest.map((x:any)=>[path.basename(x.test),x]));
const rows:any[]=[];
for(const c of caps){
 const reasons:string[]=[];
 if(!c.authority?.length) reasons.push("AUTHORITY");
 if(["C4","C5"].includes(c.risk) && !c.hazards?.length) reasons.push("HAZARD_CASE");
 if(c.hazards?.some((x:string)=>!hazIds.has(x))) reasons.push("HAZARD_REFERENCE");
 if(c.controls?.some((x:string)=>!ctlIds.has(x))) reasons.push("CONTROL_REFERENCE");
 if(c.invariants?.some((x:string)=>!invIds.has(x))) reasons.push("INVARIANT_REFERENCE");
 for(const t of c.tests??[]){
   const m:any=tests.get(t);
   if(!m){reasons.push(`TEST_SOURCE:${t}`);continue;}
   const p=path.join(root,m.test); if(!fs.existsSync(p)){reasons.push(`TEST_MISSING:${t}`);continue;}
   const h=crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); if(h!==m.sha256) reasons.push(`TEST_HASH:${t}`);
 }
 if(defects.some((d:any)=>d.capability===c.id&&["S0","S1"].includes(d.severity)&&d.status!=="CLOSED")) reasons.push("S0_S1_DEFECT");
 if(execution.status!=="PASS") reasons.push("EXECUTION_EVIDENCE");
 rows.push({capability:c.id,risk:c.risk,status:reasons.length?"BLOCKED":"PASS",reasons});
}
fs.writeFileSync(path.join(root,"release/capabilities/admission.json"),JSON.stringify({generatedAt:new Date().toISOString(),capabilities:rows},null,2));
console.table(rows.map(x=>({capability:x.capability,status:x.status,reasons:x.reasons.join(",")})));
if(rows.some(x=>x.status==="BLOCKED")) process.exit(1);
