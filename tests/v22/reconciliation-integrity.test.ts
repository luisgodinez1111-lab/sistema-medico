import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// EPIC AD — La reconciliación de adjudicación debe citar SOLO evidencia que existe en disco.
// Auditoría 2026-09-19 (P-10): la guarda solo validaba pruebas en vivo `.mts` (una cita `.mjs` rota pasaba) y no miraba las
// rutas de implementación. Ahora valida toda cita a fichero (.mts/.mjs/.ts/.tsx/.sql), las rutas de implementación
// (con `**` y `{a,b}` reducidos a su prefijo real) y que ninguna capacidad afirme aceptación humana que no conste en
// docs/adjudication/c5-acceptance.json (P-09/G-03: la propuesta del proceso no es una aprobación).
const ROOT=process.cwd();
const rec=JSON.parse(fs.readFileSync(path.join(ROOT,"docs/adjudication/session-2026-09-15-reconciliation.json"),"utf8")) as {capabilities:{id:string;risk?:string;invariants?:string[];implementation?:string[];tests?:string[];runtime_evidence?:string;proposed_review_decision?:string;human_accepted?:boolean}[]};
const acceptance=JSON.parse(fs.readFileSync(path.join(ROOT,"docs/adjudication/c5-acceptance.json"),"utf8")) as {accepted:{capability:string;acceptedBy:string;role:string;date:string}[]};
const pathOf=(c:string)=>(c.trim().split(/\s+/)[0]??"");
const FILE=/\.(mts|mjs|ts|tsx|sql|json)$/;
const exists=(p:string)=>fs.existsSync(path.join(ROOT,p));
// "apps/web/app/api/v1/results/**" -> "apps/web/app/api/v1/results"; "lib/{a,b}.ts" -> "lib"; "clinical-runtime.readPatientTimeline" -> fichero
const implPrefix=(s:string)=>{let p=pathOf(s).replace(/[/]?\*\*.*$/,"").replace(/\{.*$/,"").replace(/\/$/,"");if(!exists(p)&&/\.[A-Za-z]\w*$/.test(p)){const q=p.replace(/\.[A-Za-z]\w*$/,"");if(exists(q+".ts"))p=q+".ts";}return p;};
describe("integridad de la reconciliación de adjudicación (EPIC AD)",()=>{
 it("tiene capacidades",()=>{expect(rec.capabilities.length).toBeGreaterThan(0);});
 it("ninguna capacidad afirma aceptación humana fuera del registro de aceptación C5",()=>{
  const signed=new Set(acceptance.accepted.map(a=>a.capability));
  for(const c of rec.capabilities)if(c.human_accepted===true)expect(signed.has(c.id),`${c.id}: afirma aceptación humana sin firma en c5-acceptance.json`).toBe(true);
  for(const a of acceptance.accepted){expect(a.acceptedBy&&a.role&&a.date,`aceptación incompleta de ${a.capability}`).toBeTruthy();}
 });
 for(const c of rec.capabilities){
  it(`${c.id}: invariantes, implementación, tests existentes y evidencia de runtime`,()=>{
   expect(c.invariants&&c.invariants.length>0,`${c.id} sin invariantes`).toBe(true);
   expect(c.tests&&c.tests.length>0,`${c.id} sin tests`).toBe(true);
   for(const t of c.tests??[])expect(exists(pathOf(t)),`${c.id}: test inexistente ${t}`).toBe(true);
   for(const i of c.implementation??[])for(const seg of i.split(",")){const p=pathOf(seg);if(/^(apps|packages|db|scripts|state-machines|safety)\//.test(p))expect(exists(implPrefix(seg)),`${c.id}: implementación inexistente ${seg.trim()}`).toBe(true);}
   expect(!!c.runtime_evidence&&c.runtime_evidence.trim()!=="",`${c.id} sin runtime_evidence`).toBe(true);
   const s=pathOf(c.runtime_evidence??"");
   if(FILE.test(s))expect(exists(s),`${c.id}: evidencia de runtime inexistente ${s}`).toBe(true);
   expect(!!c.proposed_review_decision,`${c.id} sin decisión propuesta`).toBe(true);
  });
 }
});
