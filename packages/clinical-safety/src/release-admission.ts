
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const root=process.cwd(), load=(p:string)=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
type R={gate:string;value:number|string;target:number|string;status:"PASS"|"BLOCKED";detail:string};
const rs:R[]=[]; const add=(g:string,v:number|string,t:number|string,ok:boolean,d:string)=>rs.push({gate:g,value:v,target:t,status:ok?"PASS":"BLOCKED",detail:d});

// Registro EJECUTABLE de invariantes. Auditoría 2026-09-19, anexo R09 (hallazgo R09-027, verificado el 23-sep):
// RG-002 y RG-003 leían `safety/invariants.json` y `tests/traceability/contracts.json`, AMBOS arreglos vacíos desde el
// baseline del scaffold, así que contaban 0 incumplimientos sobre 0 filas y pasaban sin evaluar nada. Un gate que no
// puede fallar no es un gate. Ahora leen el registro real (`safety/core-invariants.json`, el mismo que exige RG-016) y
// comprueban que cada invariante declare tests, que esos tests EXISTAN en el repo y que estén fijados por sha256 en el
// manifiesto de evidencia (así un test no se puede editar en silencio). Si el corpus llega vacío, BLOQUEA.
const inv=load("safety/core-invariants.json"), manifest=load("release/test-evidence-manifest.json");
const pinned=new Set<string>(manifest.map((x:any)=>x.test));
const walk=(d:string,acc:string[]=[]):string[]=>{for(const e of fs.readdirSync(path.join(root,d),{withFileTypes:true})){const p=`${d}/${e.name}`;if(e.isDirectory())walk(p,acc);else if(/\.tsx?$/.test(e.name))acc.push(p);}return acc;};
const byBasename=new Map<string,string[]>();
for(const f of walk("tests")){const b=f.slice(f.lastIndexOf("/")+1);byBasename.set(b,[...(byBasename.get(b)??[]),f]);}
// Un invariante tiene contrato ejecutable verificable si declara tests y todos resuelven a un fichero fijado en el manifiesto.
const unverifiable=(x:any):boolean=>!x.tests?.length||x.tests.some((t:string)=>!(byBasename.get(t)??[]).some(p=>pinned.has(p)));
let n:number|string=inv.length?inv.filter((x:any)=>["C4","C5"].includes(x.risk)&&unverifiable(x)).length:"CORPUS_VACÍO";
add("RG-002",n,0,n===0,"C4/C5 registry invariant coverage (tests declarados, existentes y fijados por sha256)");
n=inv.length?inv.filter(unverifiable).length:"CORPUS_VACÍO";
add("RG-003",n,0,n===0,"Registry invariant→TEST coverage (todo el registro, no solo C4/C5)");

const required=["SM-FORMAL-RESULT-001.json","SM-FORMAL-OBLIGATION-001.json","SM-FORMAL-MED-001.json","SM-FORMAL-TRUTH-001.json"];
n=required.filter(x=>!fs.existsSync(path.join(root,"state-machines/formal",x))).length; add("RG-006",n,0,n===0,"Required formal state machines");

const tasks=load("ai-tasks/catalog.json"), binds=load("ai-tasks/bindings.json"), env=load("safety-envelopes/catalog.json"), evals=load("ai-tasks/evals.json");
const envIds=new Set(env.map((x:any)=>x.id)), evalIds=new Set(evals.map((x:any)=>x.id)), bm=new Map(binds.map((x:any)=>[x.ai_task,x.safety_envelope]));
n=tasks.filter((t:any)=>["C4","C5"].includes(t.risk)&&(!bm.get(t.id)||!envIds.has(bm.get(t.id))||!evalIds.has(t.evalSuite)||!t.killSwitch)).length;
add("RG-008",n,0,n===0,"High-impact AI task→envelope→eval→kill switch");

const defects=load("release/defects.json"); n=defects.filter((x:any)=>["S0","S1"].includes(x.severity)&&x.status!=="CLOSED").length; add("RG-011",n,0,n===0,"Open S0/S1 defects");

let bad=0;
for(const x of manifest){const p=path.join(root,x.test);if(!fs.existsSync(p)){bad++;continue;}const h=crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");if(h!==x.sha256||!x.authority?.length)bad++;}
add("RG-013",bad,0,bad===0,"Test source integrity + authority binding");

const coreInv=inv, hazards=load("safety/core-hazards.json"), controls=load("safety/controls/catalog.json");
const ctlIds=new Set(controls.map((x:any)=>x.id)), coreInvIds=new Set(coreInv.map((x:any)=>x.id));
// Mismo criterio que RG-002/RG-003: un corpus vacío BLOQUEA en vez de pasar vacíamente (auditoría R09-027).
const sized=(arr:any[],f:()=>number):number|string=>arr.length?f():"CORPUS_VACÍO";
n=sized(hazards,()=>hazards.filter((h:any)=>!h.controls?.length || h.controls.some((c:string)=>!ctlIds.has(c))).length);
add("RG-014",n,0,n===0,"Core hazard→control completeness");
n=sized(controls,()=>controls.filter((c:any)=>c.invariant && !coreInvIds.has(c.invariant)).length);
add("RG-015",n,0,n===0,"Control→core invariant integrity");
n=sized(coreInv,()=>coreInv.filter((i:any)=>!i.tests?.length || !i.predicate || !i.authority?.length).length);
add("RG-016",n,0,n===0,"Core invariant executable-contract completeness");

const ex=fs.existsSync(path.join(root,"release/test-execution.json"))?load("release/test-execution.json"):null;
add("RG-012",ex?.status??"MISSING","PASS",ex?.status==="PASS","Reproducible full safety test execution");

fs.writeFileSync(path.join(root,"release/admission-result.json"),JSON.stringify({generatedAt:new Date().toISOString(),results:rs},null,2));
console.table(rs); if(rs.some(x=>x.status==="BLOCKED")) process.exit(1);
