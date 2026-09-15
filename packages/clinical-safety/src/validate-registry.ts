import fs from "node:fs"; import path from "node:path";
const root=process.cwd(); const load=(p:string)=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const inv=load("safety/invariants.json"), tests=load("tests/traceability/contracts.json");
const env=load("safety-envelopes/catalog.json");
const errors:string[]=[];
const tested=new Set(tests.map((x:any)=>x.inv).filter(Boolean));
for(const x of inv) if((x.risk==="C4"||x.risk==="C5")&&!tested.has(x.id)) errors.push(`C4_C5_INV_WITHOUT_TEST:${x.id}`);
for(const x of env){
 if(!x.kill_switch) errors.push(`AI_WITHOUT_KILL_SWITCH:${x.id}`);
 if((x.risk==="C4"||x.risk==="C5")&&!x.human_approval_required) errors.push(`HIGH_IMPACT_AI_WITHOUT_HUMAN_AUTHORITY:${x.id}`);
 if((x.risk==="C4"||x.risk==="C5")&&!x.evidence_required) errors.push(`HIGH_IMPACT_AI_WITHOUT_EVIDENCE:${x.id}`);
}
for(const p of ["state-machines/formal/SM-FORMAL-RESULT-001.json","state-machines/formal/SM-FORMAL-OBLIGATION-001.json","state-machines/formal/SM-FORMAL-MED-001.json","state-machines/formal/SM-FORMAL-TRUTH-001.json"])
 if(!fs.existsSync(path.join(root,p))) errors.push(`MISSING_FORMAL_MACHINE:${p}`);
if(errors.length){ console.error(errors.join("\n")); process.exit(1); }
console.log("PASS: formal safety registry admission checks");
