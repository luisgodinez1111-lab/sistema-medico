
import fs from "node:fs"; import crypto from "node:crypto";
const load=p=>JSON.parse(fs.readFileSync(p));
const caps=load("capabilities/catalog.json"), hazards=load("safety/core-hazards.json"), controls=load("safety/controls/catalog.json"), inv=load("safety/core-invariants.json");
const H=new Map(hazards.map(x=>[x.id,x])),C=new Map(controls.map(x=>[x.id,x])),I=new Map(inv.map(x=>[x.id,x]));
for(const cap of caps){
 const dossier={
  schemaVersion:"2.0",capability:cap.id,name:cap.name,risk:cap.risk,authority:cap.authority,
  hazardCase:cap.hazards.map(id=>H.get(id)??{id,status:"MISSING"}),
  controls:cap.controls.map(id=>C.get(id)??{id,status:"MISSING"}),
  invariants:cap.invariants.map(id=>I.get(id)??{id,status:"MISSING"}),
  stateMachines:cap.machines,tests:cap.tests,releasePolicy:cap.releasePolicy,
  safetyArgument:[
   "Authority establishes intended behavior and boundaries.",
   "Hazards identify foreseeable unsafe conditions.",
   "Controls prevent, detect, correct, or recover from those conditions.",
   "Invariants define conditions that must remain true.",
   "Tests provide executable oracles; execution evidence is separately required.",
   "Capability remains blocked when any required safety-case element is absent."
  ]
 };
 const raw=JSON.stringify(dossier,null,2); dossier.dossierSha256=crypto.createHash("sha256").update(raw).digest("hex");
 fs.writeFileSync(`safety/cases/${cap.id}.json`,JSON.stringify(dossier,null,2));
}
console.log(`Generated ${caps.length} capability safety cases`);
