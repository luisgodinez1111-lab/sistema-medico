import fs from "node:fs"; import path from "node:path";
const root=process.cwd(); const load=(p:string)=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
// Auditoría 2026-09-19, anexo R09 (R09-027): este gate leía `safety/invariants.json` y `tests/traceability/contracts.json`,
// ambos arreglos VACÍOS desde el baseline, de modo que el bucle de cobertura C4/C5 no recorría nada y siempre pasaba.
// Ahora recorre el registro ejecutable real y falla si llega vacío.
const inv=load("safety/core-invariants.json");
const env=load("safety-envelopes/catalog.json");
const errors:string[]=[];
if(!inv.length) errors.push("EMPTY_INVARIANT_REGISTRY:safety/core-invariants.json");
for(const x of inv){
 if(!x.predicate) errors.push(`INV_WITHOUT_PREDICATE:${x.id}`);
 if((x.risk==="C4"||x.risk==="C5")&&!x.tests?.length) errors.push(`C4_C5_INV_WITHOUT_TEST:${x.id}`);
}
for(const x of env){
 if(!x.kill_switch) errors.push(`AI_WITHOUT_KILL_SWITCH:${x.id}`);
 if((x.risk==="C4"||x.risk==="C5")&&!x.human_approval_required) errors.push(`HIGH_IMPACT_AI_WITHOUT_HUMAN_AUTHORITY:${x.id}`);
 if((x.risk==="C4"||x.risk==="C5")&&!x.evidence_required) errors.push(`HIGH_IMPACT_AI_WITHOUT_EVIDENCE:${x.id}`);
}
for(const p of ["state-machines/formal/SM-FORMAL-RESULT-001.json","state-machines/formal/SM-FORMAL-OBLIGATION-001.json","state-machines/formal/SM-FORMAL-MED-001.json","state-machines/formal/SM-FORMAL-TRUTH-001.json"])
 if(!fs.existsSync(path.join(root,p))) errors.push(`MISSING_FORMAL_MACHINE:${p}`);
if(errors.length){ console.error(errors.join("\n")); process.exit(1); }
console.log("PASS: formal safety registry admission checks");
