import { describe,it,expect } from "vitest";
import fs from "node:fs";
import { assertResultTransition } from "../../packages/result-fold/src";
import { assertMedicationTransition, foldMedication } from "../../packages/medication-fold/src";
import { assertObligationTransition } from "../../packages/obligation-fold/src";
// Auditoría 2026-09-19 (K-02): estos contratos se probaban contra `clinical-kernel`, una máquina PARALELA que ningún handler
// ejecutaba. Ahora ejercitan los folds REALES (los que corren en apps/web/lib/*-lifecycle.ts) y comprueban que sus estados
// son un subconjunto de la máquina formal versionada en state-machines/formal/ (la formal es el superconjunto planeado).
const formal=(id:string)=>JSON.parse(fs.readFileSync(`state-machines/formal/${id}.json`,"utf8")) as {states:string[];terminal:string[]};
describe("Result lifecycle truthfulness (fold real)",()=>{
 it("does not allow RECEIVED to become CLOSED directly",()=>{expect(()=>assertResultTransition("RECEIVED","CLOSED")).toThrow(/Illegal result transition/);});
 it("requires explicit verification before action and closure",()=>{
  expect(()=>assertResultTransition("RECEIVED","VERIFIED")).not.toThrow();
  expect(()=>assertResultTransition("VERIFIED","ACTIONED")).not.toThrow();
  expect(()=>assertResultTransition("RECEIVED","ACTIONED")).toThrow(/Illegal result transition/);
 });
 it("los estados del fold están en la máquina formal SM-FORMAL-RESULT-001 y CLOSED es terminal",()=>{
  const f=formal("SM-FORMAL-RESULT-001");for(const s of["RECEIVED","VERIFIED","ACTIONED","CLOSED"])expect(f.states).toContain(s);
  expect(f.terminal).toContain("CLOSED");expect(()=>assertResultTransition("CLOSED","VERIFIED")).toThrow();
 });
});
describe("Medication physician-controlled lifecycle (fold real)",()=>{
 it("does not allow PROPOSED to become ACTIVE directly",()=>{expect(()=>assertMedicationTransition("PROPOSED","ACTIVE")).toThrow(/Illegal medication transition/);});
 it("PROPOSED is not PRESCRIBED: el fold de una propuesta sin PRESCRIBED sigue en PROPOSED",()=>{
  expect(foldMedication([{sequence:1,payload:{kind:"PROPOSED",patientId:"p",drugCode:"x",dose:"1mg",route:"VO",frequency:"c/24h"}}]).state).toBe("PROPOSED");
 });
 it("los estados del fold están en SM-FORMAL-MED-001 y los terminales coinciden",()=>{
  const f=formal("SM-FORMAL-MED-001");for(const s of["PROPOSED","PRESCRIBED","ACTIVE","HELD","STOPPED","CANCELLED"])expect(f.states).toContain(s);
  for(const t of["STOPPED","CANCELLED"]){expect(f.terminal).toContain(t);expect(()=>assertMedicationTransition(t as "STOPPED"|"CANCELLED","ACTIVE")).toThrow();}
 });
});
describe("Obligation lifecycle (fold real)",()=>{
 it("los estados del fold están en SM-FORMAL-OBLIGATION-001 y COMPLETED/CANCELLED son terminales",()=>{
  const f=formal("SM-FORMAL-OBLIGATION-001");for(const s of["OPEN","IN_PROGRESS","COMPLETED","CANCELLED"])expect(f.states).toContain(s);
  for(const t of["COMPLETED","CANCELLED"])expect(()=>assertObligationTransition(t as "COMPLETED"|"CANCELLED","IN_PROGRESS")).toThrow(/Illegal obligation transition/);
 });
});
