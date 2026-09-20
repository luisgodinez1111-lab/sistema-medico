import{describe,it,expect}from"vitest";
import{verifyAnalyteReadings,provenance,MAX_AGE_DAYS,type AnalyteSpec}from"../../apps/web/lib/analyte-inputs";
import{type AnalyteReading}from"../../apps/web/lib/clinical-runtime";
// Auditoría 2026-09-19 (C-01, C-02, C-11, C-12) — la guarda de ENTRADAS VERIFICADAS de las calculadoras.
// Regla que fijan estos casos: si un dato falta, es viejo, es imposible o no es de la misma extracción,
// la calculadora responde "no computable" con el motivo. Nunca un número.
const NOW=new Date("2026-09-20T12:00:00Z");
const hoursAgo=(h:number)=>new Date(NOW.getTime()-h*3_600_000).toISOString();
const daysAgo=(d:number)=>hoursAgo(d*24);
const reading=(analyte:string,value:number,occurredAt:string,extra:Partial<AnalyteReading>={}):AnalyteReading=>
 ({analyte,rawValue:String(value),value,unit:null,canonicalUnit:null,unitAssumed:false,occurredAt,resultId:`r-${analyte}`,specimenId:null,...extra});
const FIB4:readonly AnalyteSpec[]=["AST","ALT","PLATELETS"].map(analyte=>({analyte,maxAgeDays:MAX_AGE_DAYS.LIVER_PANEL}));
const GAS:readonly AnalyteSpec[]=["PH","PCO2","BICARBONATE"].map(analyte=>({analyte,maxAgeDays:MAX_AGE_DAYS.BLOOD_GAS}));

describe("verifyAnalyteReadings — entradas verificadas de las calculadoras",()=>{
 it("todo presente, vigente, plausible y coherente -> ok con valores y procedencia",()=>{
  const r=verifyAnalyteReadings(FIB4,[reading("AST",40,daysAgo(2)),reading("ALT",35,daysAgo(2)),reading("PLATELETS",250,daysAgo(2))],{now:NOW,coherenceHours:720});
  expect(r.ok).toBe(true);if(!r.ok)return;
  expect(r.values).toEqual({AST:40,ALT:35,PLATELETS:250});expect(r.warnings).toEqual([]);
  expect(provenance(r.inputs)[0]).toMatchObject({analyte:"AST",value:40,ageDays:2,resultId:"r-AST"});
 });
 it("analito faltante -> no computable, con la lista de lo que falta",()=>{
  const r=verifyAnalyteReadings(FIB4,[reading("AST",40,daysAgo(2)),undefined,undefined],{now:NOW});
  // `missing` lleva el CÓDIGO (para clientes); el texto para el médico usa el nombre clínico, nunca el código interno.
  expect(r).toMatchObject({ok:false,missing:["ALT","PLATELETS"]});expect(!r.ok&&r.reason).toBe("Requiere ALT + plaquetas");
 });
 it("dato OBSOLETO -> no computable (una creatinina de hace 3 años no describe la función renal de hoy)",()=>{
  const r=verifyAnalyteReadings([{analyte:"CREATININE",maxAgeDays:MAX_AGE_DAYS.RENAL_FUNCTION}],[reading("CREATININE",1.0,daysAgo(3*365))],{now:NOW});
  expect(r.ok).toBe(false);expect(!r.ok&&r.stale[0]).toMatch(/creatinina de hace 1095 días \(máx\. 365\)/);
 });
 it("en el límite exacto de vigencia el dato sigue siendo válido",()=>{
  const r=verifyAnalyteReadings([{analyte:"INR",maxAgeDays:30}],[reading("INR",2.5,daysAgo(30))],{now:NOW});
  expect(r.ok).toBe(true);
 });
 it("valor IMPLAUSIBLE en un evento antiguo sin unidad -> no computable (caso FIB-4 = 0.00 con plaquetas en /µL)",()=>{
  const r=verifyAnalyteReadings(FIB4,[reading("AST",40,daysAgo(1)),reading("ALT",35,daysAgo(1)),reading("PLATELETS",250000,daysAgo(1),{unitAssumed:true})],{now:NOW});
  expect(r.ok).toBe(false);expect(!r.ok&&r.implausible.join(" ")).toMatch(/PLATELETS/);
 });
 it("gasometría con pH de hoy y pCO₂ de hace 20 h -> extracciones distintas, no computable",()=>{
  const r=verifyAnalyteReadings(GAS,[reading("PH",7.31,hoursAgo(1)),reading("PCO2",52,hoursAgo(20)),reading("BICARBONATE",24,hoursAgo(1))],{now:NOW,coherenceHours:1});
  expect(r.ok).toBe(false);expect(!r.ok&&r.reason).toMatch(/extracciones distintas \(19\.0 h/);
 });
 it("la MISMA muestra (specimenId) es coherente aunque las horas de captura difieran",()=>{
  const s={specimenId:"5b0f3a52-7c0e-4c55-9c0a-1d6f0d2a9e11"};
  const r=verifyAnalyteReadings(GAS,[reading("PH",7.31,hoursAgo(1),s),reading("PCO2",52,hoursAgo(5),s),reading("BICARBONATE",24,hoursAgo(3),s)],{now:NOW,coherenceHours:1});
  expect(r.ok).toBe(true);
 });
 it("muestras DISTINTAS fuera de la ventana no pasan aunque ambas tengan specimenId",()=>{
  const r=verifyAnalyteReadings(GAS,[reading("PH",7.31,hoursAgo(1),{specimenId:"a"}),reading("PCO2",52,hoursAgo(5),{specimenId:"b"}),reading("BICARBONATE",24,hoursAgo(1),{specimenId:"a"})],{now:NOW,coherenceHours:1});
  expect(r.ok).toBe(false);
 });
 it("resultado registrado SIN unidad: se calcula pero se ADVIERTE (unitAssumed viaja en la procedencia)",()=>{
  const r=verifyAnalyteReadings([{analyte:"CREATININE",maxAgeDays:365}],[reading("CREATININE",1.1,daysAgo(10),{unitAssumed:true})],{now:NOW});
  expect(r.ok).toBe(true);if(!r.ok)return;
  expect(r.warnings[0]).toMatch(/creatinina: el resultado se registró SIN unidad; se asumió mg\/dL/);
  expect(provenance(r.inputs)[0]).toMatchObject({unitAssumed:true,unit:"mg/dL"});
 });
 it("varios motivos a la vez se reportan todos (faltante + obsoleto + implausible)",()=>{
  const r=verifyAnalyteReadings(FIB4,[undefined,reading("ALT",35,daysAgo(400)),reading("PLATELETS",250000,daysAgo(1))],{now:NOW});
  expect(r).toMatchObject({ok:false,missing:["AST"]});if(r.ok)return;
  expect(r.stale).toHaveLength(1);expect(r.implausible).toHaveLength(1);expect(r.reason.split(" · ")).toHaveLength(3);
 });
 it("una sola entrada nunca falla por coherencia",()=>{
  expect(verifyAnalyteReadings([{analyte:"HBA1C",maxAgeDays:365}],[reading("HBA1C",7.2,daysAgo(90))],{now:NOW,coherenceHours:1}).ok).toBe(true);
 });
});
describe("MAX_AGE_DAYS — la vigencia es proporcional a lo rápido que cambia el dato",()=>{
 it("gasometría < panel metabólico < anticoagulación < hepático < renal",()=>{
  expect(MAX_AGE_DAYS.BLOOD_GAS).toBeLessThan(MAX_AGE_DAYS.METABOLIC_PANEL);
  expect(MAX_AGE_DAYS.METABOLIC_PANEL).toBeLessThan(MAX_AGE_DAYS.ANTICOAGULATION);
  expect(MAX_AGE_DAYS.ANTICOAGULATION).toBeLessThan(MAX_AGE_DAYS.LIVER_PANEL);
  expect(MAX_AGE_DAYS.LIVER_PANEL).toBeLessThanOrEqual(MAX_AGE_DAYS.RENAL_FUNCTION);
 });
});
