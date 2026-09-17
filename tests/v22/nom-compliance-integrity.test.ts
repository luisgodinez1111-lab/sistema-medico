import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// EPIC BI (endurecimiento G / ENG-044) — Compliance-as-code: el registro de aplicabilidad NOM debe ser
// estructuralmente válido, con evidencia que EXISTE (archivo o CAP adjudicada) y SIN declarar certificación
// sin evidencia. Mantiene el registro honesto (mismo espíritu que reconciliation-integrity).
const REG="docs/compliance/nom-applicability-register.json";
const RECON="docs/adjudication/session-2026-09-15-reconciliation.json";
const reg=JSON.parse(fs.readFileSync(REG,"utf8"));
const capIds=new Set((JSON.parse(fs.readFileSync(RECON,"utf8")).capabilities as{id:string}[]).map(c=>c.id));
const APPLIC=new Set(reg.applicabilityLevels);const STATUS=new Set(reg.statusLevels);

describe("compliance-as-code: registro de aplicabilidad NOM (ENG-044)",()=>{
 it("estructura válida por instrumento (campos, niveles enumerados)",()=>{
  expect(Array.isArray(reg.instruments)).toBe(true);
  for(const m of reg.instruments){
   for(const k of["id","name","scope","applicability","status","certificationClaimed","evidence","gaps"])expect(m,`${m.id} sin ${k}`).toHaveProperty(k);
   expect(APPLIC.has(m.applicability),`${m.id} applicability inválida`).toBe(true);
   expect(STATUS.has(m.status),`${m.id} status inválido`).toBe(true);
   expect(typeof m.certificationClaimed).toBe("boolean");
   expect(Array.isArray(m.evidence)).toBe(true);
  }
 });
 it("NO se declara certificación sin evidencia (ley: no claim de certificación sin evidencia)",()=>{
  for(const m of reg.instruments){
   if(m.certificationClaimed===true)expect(m.evidence.length,`${m.id} declara certificación sin evidencia`).toBeGreaterThan(0);
  }
 });
 it("toda evidencia citada EXISTE (archivo en disco o CAP en la reconciliación)",()=>{
  for(const m of reg.instruments){
   for(const ev of m.evidence as string[]){
    if(ev.startsWith("CAP-"))expect(capIds.has(ev),`${m.id}: CAP inexistente ${ev}`).toBe(true);
    else if(ev.includes("/"))expect(fs.existsSync(ev),`${m.id}: artefacto inexistente ${ev}`).toBe(true);
    else throw new Error(`${m.id}: evidencia con formato desconocido "${ev}"`);
   }
  }
 });
 it("los instrumentos foundational aplicables están presentes",()=>{
  const byId=new Map(reg.instruments.map((m:{id:string})=>[m.id,m]));
  for(const id of["NOM-004-SSA3-2012","NOM-024-SSA3-2012","LFPDPPP"]){
   expect(byId.has(id),`falta ${id}`).toBe(true);
   expect((byId.get(id) as{applicability:string}).applicability).toBe("APPLICABLE");
  }
 });
 it("las carpetas de gobernanza de la jerarquía existen (compliance + threat-models)",()=>{
  expect(fs.existsSync("docs/compliance")).toBe(true);
  expect(fs.existsSync("docs/threat-models/baseline-threat-model.md")).toBe(true);
 });
});
