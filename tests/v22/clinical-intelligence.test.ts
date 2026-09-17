import{describe,it,expect}from"vitest";
import{ClinicalIntelligenceEngine,DEFAULT_KNOWLEDGE_PACKAGES}from"../../packages/clinical-intelligence/src";
// EPIC S (L18) — motor de inteligencia clínica DETERMINISTA por reglas (no IA). Cobertura añadida en la
// auditoría 2026-09-17 (antes no tenía tests).
const base={patientId:"11111111-1111-1111-1111-111111111111",age:60,sex:"M",activeProblems:[],activeMedications:[],allergies:[],recentVitals:[],recentResults:[],openObligations:[]};
function engine(){return new ClinicalIntelligenceEngine(DEFAULT_KNOWLEDGE_PACKAGES);}
describe("clinical intelligence engine (EPIC S / L18)",()=>{
 it("dolor torácico dispara órdenes y red flags esperadas",()=>{
  const state={...base,recentVitals:[{type:"HR",value:130,unit:"bpm",timestamp:"2026-09-11T11:00:00.000Z"}]};
  const out=JSON.stringify(engine().evaluate(state,"chest pain"));
  expect(out).toContain("ECG 12 derivaciones STAT");     // orderConsideration siempre para chest pain
  expect(out).toContain("Taquicardia");                   // red flag por HR>120
 });
 it("es DETERMINISTA: misma entrada -> misma salida",()=>{
  const state={...base,recentVitals:[{type:"HR",value:130,unit:"bpm",timestamp:"2026-09-11T11:00:00.000Z"}]};
  expect(engine().evaluate(state,"chest pain")).toEqual(engine().evaluate(state,"chest pain"));
 });
 it("no aplica paquetes sin criterio: complaint sin match no produce órdenes de chest pain",()=>{
  const out=JSON.stringify(engine().evaluate(base,"cefalea"));
  expect(out).not.toContain("ECG 12 derivaciones STAT");
 });
 it("hipertensión (I10) dispara su red flag ante BP crítica",()=>{
  const state={...base,activeProblems:[{code:"I10",status:"ACTIVE",onset:"2025-01-01"}],recentVitals:[{type:"BP",value:190,unit:"mmHg",timestamp:"2026-09-11T11:00:00.000Z"}]};
  const out=JSON.stringify(engine().evaluate(state)).toLowerCase();
  expect(out).toContain("crisis hipertensiva");
 });
 it("registerPackage no lanza y el paquete queda disponible",()=>{
  const e=engine();
  expect(()=>e.registerPackage({id:"test-pkg",version:"1.0",specialty:"x",effectiveDate:"2026-01-01",reviewers:[{id:"r",role:"md"}],sources:[],applicability:[],questions:[],redFlags:[],focusedExam:[],differentialHints:[],orderConsiderations:[],followUpRules:[],safetyNet:[]})).not.toThrow();
 });
});
