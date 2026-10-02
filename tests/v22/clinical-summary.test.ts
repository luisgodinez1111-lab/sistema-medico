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
 it("PA: crisis=CRITICAL, estadio 2=WARNING; estadio 1/normal no generan hallazgo",()=>{
  expect(assembleFindings({bp:{stage:"CRISIS"}})[0]!.severity).toBe("CRITICAL");
  expect(assembleFindings({bp:{stage:"STAGE_2"}})[0]!.severity).toBe("WARNING");
  expect(assembleFindings({bp:{stage:"STAGE_1"}})).toEqual([]);
 });
 it("INR: crítico=CRITICAL; supra/subterapéutico=WARNING solo si está anticoagulado",()=>{
  expect(assembleFindings({inr:{status:"CRITICAL_HIGH",onAnticoagulant:false}})[0]!.severity).toBe("CRITICAL");
  expect(assembleFindings({inr:{status:"SUPRATHERAPEUTIC",onAnticoagulant:true}})[0]!.severity).toBe("WARNING");
  expect(assembleFindings({inr:{status:"SUPRATHERAPEUTIC",onAnticoagulant:false}})).toEqual([]); // sin anticoag, no alerta
  expect(assembleFindings({inr:{status:"THERAPEUTIC",onAnticoagulant:true}})).toEqual([]);
 });
 it("paciente sano -> sin hallazgos; summarize cuenta por severidad",()=>{
  const f=assembleFindings({openCriticalResults:0,news2:{score:0,band:"LOW"}});
  expect(f).toEqual([]);
  const f2=assembleFindings({openCriticalResults:1,egfr:{egfr:22,stage:"G4"},bmi:{category:"OBESITY_II"}});
  expect(summarize(f2)).toEqual({critical:1,warning:1,info:1,total:3});
 });
 // HÁBITOS (antecedentes no patológicos) — recordatorios de apoyo basados en guías; el médico decide.
 it("tabaquismo solo -> INFO de cesación; con riesgo cardiometabólico -> WARNING",()=>{
  const solo=assembleFindings({habits:{tabaquismo:true,alcoholismo:false,toxicomanias:false}});
  expect(solo).toHaveLength(1);expect(solo[0]).toMatchObject({domain:"tabaquismo",severity:"INFO"});
  const conRiesgo=assembleFindings({habits:{tabaquismo:true,alcoholismo:false,toxicomanias:false,cardiometabolic:true}});
  expect(conRiesgo[0]).toMatchObject({domain:"tabaquismo",severity:"WARNING"});
 });
 it("elegibilidades de cribado del fumador (AAA y cáncer de pulmón) se enuncian cuando el caller las marca",()=>{
  const f=assembleFindings({habits:{tabaquismo:true,alcoholismo:false,toxicomanias:false,aaaScreenEligible:true,lungCancerScreenAge:true}});
  expect(f.some(x=>/aneurisma de aorta abdominal/.test(x.summary))).toBe(true);
  expect(f.some(x=>/cáncer de pulmón/.test(x.summary))).toBe(true);
 });
 it("alcohol y toxicomanías emiten su recordatorio de cribado/derivación (INFO)",()=>{
  const al=assembleFindings({habits:{tabaquismo:false,alcoholismo:true,toxicomanias:false}});
  expect(al).toHaveLength(1);expect(al[0]).toMatchObject({domain:"alcohol",severity:"INFO"});
  const tx=assembleFindings({habits:{tabaquismo:false,alcoholismo:false,toxicomanias:true}});
  expect(tx[0]).toMatchObject({domain:"adicciones",severity:"INFO"});
 });
 it("sin hábitos marcados -> ningún hallazgo de hábitos",()=>{
  expect(assembleFindings({habits:{tabaquismo:false,alcoholismo:false,toxicomanias:false}})).toEqual([]);
  expect(assembleFindings({})).toEqual([]);
 });
});
