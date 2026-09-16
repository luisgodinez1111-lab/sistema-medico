import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// EPIC AD — La reconciliación de adjudicación debe citar SOLO evidencia que existe en disco.
// Esto convierte el dossier de aceptación C5 en una revisión turnkey y evita citas rotas.
const ROOT=process.cwd();
const rec=JSON.parse(fs.readFileSync(path.join(ROOT,"docs/adjudication/session-2026-09-15-reconciliation.json"),"utf8")) as {capabilities:{id:string;invariants?:string[];tests?:string[];runtime_evidence?:string;proposed_review_decision?:string}[]};
const pathOf=(c:string)=>(c.trim().split(/\s+/)[0]??"");
const exists=(p:string)=>fs.existsSync(path.join(ROOT,pathOf(p)));
describe("integridad de la reconciliación de adjudicación (EPIC AD)",()=>{
 it("tiene capacidades",()=>{expect(rec.capabilities.length).toBeGreaterThan(0);});
 for(const c of rec.capabilities){
  it(`${c.id}: invariantes, tests existentes y evidencia de runtime`,()=>{
   expect(c.invariants&&c.invariants.length>0,`${c.id} sin invariantes`).toBe(true);
   expect(c.tests&&c.tests.length>0,`${c.id} sin tests`).toBe(true);
   for(const t of c.tests??[])expect(exists(t),`${c.id}: test inexistente ${t}`).toBe(true);
   expect(!!c.runtime_evidence&&c.runtime_evidence.trim()!=="",`${c.id} sin runtime_evidence`).toBe(true);
   const s=pathOf(c.runtime_evidence??"");
   if(s.endsWith(".mts"))expect(exists(s),`${c.id}: prueba en vivo inexistente ${s}`).toBe(true);
   expect(!!c.proposed_review_decision,`${c.id} sin decisión propuesta`).toBe(true);
  });
 }
});
