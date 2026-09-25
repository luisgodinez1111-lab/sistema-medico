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
 // Auditoría 2026-09-19, anexo R07 (R07-01) — UNA FILA DE JSON BIEN FORMADA NO ES UNA PRUEBA.
 //
 // EL HALLAZGO: este archivo generaba **un `it()` por capacidad** —151 de los 1.600 tests de la suite, casi el 10 %— y cada
 // uno solo comprobaba que unos campos del JSON no estuvieran vacíos y que las rutas citadas existieran en disco. El conteo
 // de la suite contaba eso como si fueran pruebas de comportamiento clínico, que es el defecto: «803 tests passing» decía
 // el anexo, y una parte importante era esto.
 //
 // LA CORRECCIÓN: la comprobación se conserva —es útil: una cita rota es una cita rota— pero se AGREGA. Un solo test por
 // clase de problema, que reporta TODAS las filas ofensoras de una vez. El conteo de la suite baja y describe mejor lo que
 // de verdad cubre, y el diagnóstico mejora: antes fallaba un test y había que repetir para ver el siguiente.
 //
 // QUÉ NO VERIFICA ESTE ARCHIVO, dicho aquí para que nadie lo suponga: que la evidencia citada se haya EJECUTADO y esté en
 // verde. Eso lo hace `pnpm evidence:dossier` cruzando los libros de ejecución (R11-22), y no puede vivir aquí porque los
 // libros se generan corriendo esta misma batería.
 it("toda capacidad declara invariantes, tests y decisión propuesta",()=>{
  const sinInv=rec.capabilities.filter(c=>!c.invariants||c.invariants.length===0).map(c=>c.id);
  const sinTests=rec.capabilities.filter(c=>!c.tests||c.tests.length===0).map(c=>c.id);
  const sinDecision=rec.capabilities.filter(c=>!c.proposed_review_decision).map(c=>c.id);
  const sinRuntime=rec.capabilities.filter(c=>!c.runtime_evidence||c.runtime_evidence.trim()==="").map(c=>c.id);
  expect(sinInv,"capacidades sin invariantes").toEqual([]);
  expect(sinTests,"capacidades sin tests").toEqual([]);
  expect(sinDecision,"capacidades sin decisión propuesta").toEqual([]);
  expect(sinRuntime,"capacidades sin evidencia de runtime").toEqual([]);
 });
 it("toda cita a un fichero existe en disco (tests, implementación y evidencia de runtime)",()=>{
  const roto:string[]=[];
  for(const c of rec.capabilities){
   for(const t of c.tests??[])if(!exists(pathOf(t)))roto.push(`${c.id}: test ${t}`);
   for(const i of c.implementation??[])for(const seg of i.split(",")){
    const p=pathOf(seg);
    if(/^(apps|packages|db|scripts|state-machines|safety)\//.test(p)&&!exists(implPrefix(seg)))roto.push(`${c.id}: implementación ${seg}`);
   }
   const s=pathOf(c.runtime_evidence??"");
   if(FILE.test(s)&&!exists(s))roto.push(`${c.id}: evidencia de runtime ${s}`);
  }
  expect(roto,"cita a un fichero que no existe").toEqual([]);
 });
 it("la cita de evidencia es una ruta o la marca de ausencia, nunca un veredicto",()=>{
  // R11-22: 146 de 151 guardaban un veredicto escrito a mano en el campo de la cita («PASS 10/10…»), que envejece y sigue
  // afirmando. La ruta es comprobable; el relato vive en `runtime_evidence_note`, etiquetado como nota.
  const malas=rec.capabilities
   .filter(c=>{const ev=(c.runtime_evidence??"").trim();return ev!=="SIN CITA EJECUTABLE"&&!FILE.test(pathOf(ev));})
   .map(c=>`${c.id}: ${(c.runtime_evidence??"").slice(0,60)}`);
  expect(malas,"la cita de evidencia tiene que ser una ruta o la marca de ausencia").toEqual([]);
 });
});
