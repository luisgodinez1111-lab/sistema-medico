import{describe,it,expect}from"vitest";
import{assembleFindings,summarize}from"../../packages/clinical-summary/src";
// EPIC BS — Resumen de inteligencia clínica determinista.
describe("assembleFindings (prioriza por severidad)",()=>{
 it("resultado crítico sin cerrar -> CRITICAL",()=>{
  const f=assembleFindings({openCriticalResults:2});
  expect(f).toHaveLength(1);expect(f[0]).toMatchObject({severity:"CRITICAL",domain:"resultados"});
 });
 it("ordena CRITICAL antes que WARNING antes que INFO",()=>{
  const f=assembleFindings({news2:{score:8,band:"HIGH"},egfr:{egfr:25,stage:"G4"},bmi:{category:"OBESITY_I"}});
  expect(f.map(x=>x.severity)).toEqual(["CRITICAL","WARNING","INFO"]);
 });
 it("NEWS2 HIGH=CRITICAL, MEDIUM=WARNING; LOW no genera hallazgo",()=>{
  expect(assembleFindings({news2:{score:8,band:"HIGH"}})[0]!.severity).toBe("CRITICAL");
  expect(assembleFindings({news2:{score:5,band:"MEDIUM"}})[0]!.severity).toBe("WARNING");
  expect(assembleFindings({news2:{score:0,band:"LOW"}})).toEqual([]);
 });
 it("ERC G4 y FIB-4 alto y CHA2DS2-VASc alto aplicable -> WARNING c/u",()=>{
  const f=assembleFindings({egfr:{egfr:22,stage:"G4"},fib4:{value:4,risk:"HIGH"},cha2ds2vasc:{score:5,risk:"HIGH",applicable:true}});
  expect(f.every(x=>x.severity==="WARNING")).toBe(true);
  expect(f.map(x=>x.domain).sort()).toEqual(["anticoagulación","hepático","renal"]);
 });
 it("CHA2DS2-VASc alto pero NO aplicable (sin FA) -> no genera hallazgo",()=>{
  expect(assembleFindings({cha2ds2vasc:{score:5,risk:"HIGH",applicable:false}})).toEqual([]);
 });
 it("glucémico POOR=WARNING; PREDIABETES=INFO",()=>{
  expect(assembleFindings({glycemic:{category:"POOR",label:"x"}})[0]!.severity).toBe("WARNING");
  expect(assembleFindings({glycemic:{category:"PREDIABETES",label:"x"}})[0]!.severity).toBe("INFO");
 });
 it("paciente sano -> sin hallazgos; summarize cuenta por severidad",()=>{
  const f=assembleFindings({openCriticalResults:0,news2:{score:0,band:"LOW"}});
  expect(f).toEqual([]);
  const f2=assembleFindings({openCriticalResults:1,egfr:{egfr:22,stage:"G4"},bmi:{category:"OBESITY_II"}});
  expect(summarize(f2)).toEqual({critical:1,warning:1,info:1,total:3});
 });
});
