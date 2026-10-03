import{describe,it,expect}from"vitest";
import{assembleFindings,summarize}from"../../packages/clinical-summary/src";
import{hasBled}from"../../packages/bleeding-risk/src";
import{timeInTherapeuticRange}from"../../packages/anticoagulation/src";
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
 // BRECHAS DE TERAPIA DIRIGIDA POR GUÍAS (care gaps) — recordatorios de apoyo con fuente; el médico decide. Solo
 // se emiten si la terapia está INDICADA y el paciente NO la tiene activa (no se repregunta lo ya resuelto).
 it("brecha de estatina: indicada sin estatina activa -> WARNING; con estatina activa -> sin hallazgo",()=>{
  const gap=assembleFindings({statinGap:{indicated:true,onStatin:false,reason:"Diabetes en 40–75 años"}});
  expect(gap).toHaveLength(1);expect(gap[0]).toMatchObject({domain:"lípidos",severity:"WARNING"});
  expect(gap[0]!.summary).toMatch(/estatina/);
  expect(assembleFindings({statinGap:{indicated:true,onStatin:true,reason:"x"}})).toEqual([]);
 });
 it("brecha de IECA/ARA-II: indicada sin terapia -> INFO; con terapia activa -> sin hallazgo",()=>{
  const gap=assembleFindings({reninAngiotensinGap:{indicated:true,onTherapy:false,reason:"Insuficiencia cardíaca"}});
  expect(gap).toHaveLength(1);expect(gap[0]).toMatchObject({domain:"cardiorrenal",severity:"INFO"});
  expect(gap[0]!.summary).toMatch(/IECA\/ARA-II/);
  expect(assembleFindings({reninAngiotensinGap:{indicated:true,onTherapy:true,reason:"x"}})).toEqual([]);
 });
 it("diabetes sin HbA1c vigente -> recordatorio de monitoreo (INFO)",()=>{
  const f=assembleFindings({diabetesMonitoringGap:{dueHba1c:true}});
  expect(f).toHaveLength(1);expect(f[0]).toMatchObject({domain:"glucémico",severity:"INFO"});
  expect(f[0]!.summary).toMatch(/HbA1c/);
 });
 it("FA de alto riesgo: avisa si NO está anticoagulado; NO repregunta si ya lo está",()=>{
  expect(assembleFindings({cha2ds2vasc:{score:5,risk:"HIGH",applicable:true,onAnticoagulant:false}})[0]).toMatchObject({domain:"anticoagulación",severity:"WARNING"});
  expect(assembleFindings({cha2ds2vasc:{score:5,risk:"HIGH",applicable:true,onAnticoagulant:true}})).toEqual([]);
 });
 it("brecha de iSGLT2: indicada sin iSGLT2 activo -> INFO; con iSGLT2 activo -> sin hallazgo",()=>{
  const gap=assembleFindings({sglt2Gap:{indicated:true,onSglt2:false,reason:"Diabetes tipo 2 con insuficiencia cardíaca"}});
  expect(gap).toHaveLength(1);expect(gap[0]).toMatchObject({domain:"cardiorrenal",severity:"INFO"});
  expect(gap[0]!.summary).toMatch(/iSGLT2/);
  expect(assembleFindings({sglt2Gap:{indicated:true,onSglt2:true,reason:"x"}})).toEqual([]);
 });
 it("brecha de antiagregante en ASCVD: sin terapia -> INFO; con antiagregante/anticoagulante -> sin hallazgo",()=>{
  expect(assembleFindings({antiplateletGap:{indicated:true,onTherapy:false}})[0]).toMatchObject({domain:"antiagregación",severity:"INFO"});
  expect(assembleFindings({antiplateletGap:{indicated:true,onTherapy:true}})).toEqual([]);
 });
 it("«triple whammy» (IECA/ARA-II + diurético + AINE activos) -> WARNING renal por riesgo de LRA",()=>{
  const f=assembleFindings({tripleWhammy:true});
  expect(f).toHaveLength(1);expect(f[0]).toMatchObject({domain:"renal",severity:"WARNING"});
  expect(f[0]!.summary).toMatch(/triple whammy/);
  expect(assembleFindings({tripleWhammy:false})).toEqual([]);
 });
 it("riesgos de la medicación ACTIVA × estado: hiperkalemia, metformina con TFG<30 y AINE en ERC -> WARNING c/u",()=>{
  expect(assembleFindings({activeRisk:{hyperkalemiaCombo:true}})[0]).toMatchObject({domain:"electrolitos",severity:"WARNING"});
  expect(assembleFindings({activeRisk:{metforminContraindicated:true}})[0]!.summary).toMatch(/Metformina activa con TFG<30/);
  expect(assembleFindings({activeRisk:{nsaidInCkd:true}})[0]!.summary).toMatch(/AINE activo/);
  const all=assembleFindings({activeRisk:{hyperkalemiaCombo:true,metforminContraindicated:true,nsaidInCkd:true}});
  expect(all).toHaveLength(3);expect(all.every(x=>x.severity==="WARNING")).toBe(true);
  expect(assembleFindings({activeRisk:{}})).toEqual([]);
 });
 // Escenarios priorizados por el dueño: adulto mayor (Beers), embarazo, pediatría, lípidos por meta.
 it("adulto mayor (Beers): fármacos inapropiados activos -> WARNING; polifarmacia -> INFO",()=>{
  const f=assembleFindings({geriatric:{beersActive:["benzodiacepina","AINE"],polypharmacy:true}});
  expect(f.some(x=>x.domain==="geriatría"&&x.severity==="WARNING"&&/Beers/.test(x.summary))).toBe(true);
  expect(f.some(x=>x.domain==="geriatría"&&x.severity==="INFO"&&/Polifarmacia/.test(x.summary))).toBe(true);
  expect(assembleFindings({geriatric:{beersActive:[],polypharmacy:false}})).toEqual([]);
 });
 it("embarazo: teratógeno activo -> WARNING; recordatorio de ácido fólico -> INFO",()=>{
  const f=assembleFindings({pregnancyRisk:{teratogensActive:["IECA/ARA-II","estatina"],folateReminder:true}});
  expect(f.some(x=>x.domain==="embarazo"&&x.severity==="WARNING"&&/teratog/i.test(x.summary))).toBe(true);
  expect(f.some(x=>x.domain==="embarazo"&&x.severity==="INFO"&&/ácido fólico/.test(x.summary))).toBe(true);
 });
 it("pediatría: salicilato en <16 -> WARNING (Reye); peso/talla faltantes -> INFO",()=>{
  expect(assembleFindings({pediatricRisk:{reyeAspirin:true,growthDataMissing:false}})[0]).toMatchObject({domain:"pediatría",severity:"WARNING"});
  expect(assembleFindings({pediatricRisk:{reyeAspirin:false,growthDataMissing:true}})[0]).toMatchObject({domain:"pediatría",severity:"INFO"});
 });
 it("lípidos por meta de riesgo: LDL por encima de la meta -> WARNING con la meta citada",()=>{
  const f=assembleFindings({ldlTarget:{value:120,target:70,riskLabel:"riesgo muy alto (ASCVD)"}});
  expect(f[0]).toMatchObject({domain:"lípidos",severity:"WARNING"});
  expect(f[0]!.summary).toMatch(/<70/);
 });
 // Balance de la anticoagulación: HAS-BLED (riesgo de sangrado) junto al CHA₂DS₂-VASc (riesgo trombótico).
 it("HAS-BLED: no se muestra si no es relevante (show=false)",()=>{
  expect(assembleFindings({hasBled:{score:4,risk:"HIGH",show:false,minimum:false}})).toEqual([]);
 });
 it("HAS-BLED alto -> WARNING que aclara que NO contraindica anticoagular",()=>{
  const f=assembleFindings({hasBled:{score:3,risk:"HIGH",show:true,minimum:false}});
  expect(f).toHaveLength(1);expect(f[0]).toMatchObject({domain:"anticoagulación",severity:"WARNING"});
  expect(f[0]!.summary).toMatch(/HAS-BLED 3/);expect(f[0]!.summary).toMatch(/NO contraindica/);
 });
 it("HAS-BLED moderado/bajo -> INFO para el balance",()=>{
  expect(assembleFindings({hasBled:{score:2,risk:"MODERATE",show:true,minimum:false}})[0]).toMatchObject({domain:"anticoagulación",severity:"INFO"});
  expect(assembleFindings({hasBled:{score:0,risk:"LOW",show:true,minimum:false}})[0]!.summary).toMatch(/bajo/);
 });
 it("HAS-BLED con componentes no evaluados -> el texto marca que el score es mínimo",()=>{
  expect(assembleFindings({hasBled:{score:2,risk:"MODERATE",show:true,minimum:true}})[0]!.summary).toMatch(/mínimo/);
 });
 it("balance completo: CHA₂DS₂-VASc alto + HAS-BLED se muestran JUNTOS (trombosis ↔ sangrado)",()=>{
  const f=assembleFindings({cha2ds2vasc:{score:5,risk:"HIGH",applicable:true,onAnticoagulant:false},hasBled:{score:3,risk:"HIGH",show:true,minimum:false}});
  const anticoag=f.filter(x=>x.domain==="anticoagulación");
  expect(anticoag).toHaveLength(2);
  expect(anticoag.some(x=>/CHA₂DS₂-VASc/.test(x.summary))).toBe(true);
  expect(anticoag.some(x=>/HAS-BLED/.test(x.summary))).toBe(true);
 });
 // TTR (tiempo en rango terapéutico): calidad del control del VKA.
 it("TTR bajo -> WARNING de control inestable con el porcentaje; TTR aceptable -> INFO",()=>{
  const lab=assembleFindings({ttr:{pct:45,points:6,labile:true,thresholdPct:60}});
  expect(lab[0]).toMatchObject({domain:"anticoagulación",severity:"WARNING"});
  expect(lab[0]!.summary).toMatch(/45%/);expect(lab[0]!.summary).toMatch(/ACOD/);
  const ok=assembleFindings({ttr:{pct:78,points:8,labile:false,thresholdPct:60}});
  expect(ok[0]).toMatchObject({domain:"anticoagulación",severity:"INFO"});
  expect(ok[0]!.summary).toMatch(/78%/);
 });
});
// Calculador HAS-BLED puro (Pisters 2010): 1 punto por ítem, máx. 9; ≥3 = alto. INR lábil no evaluable se reporta aparte.
describe("hasBled (riesgo de sangrado, Pisters 2010)",()=>{
 const NONE={hypertensionUncontrolled:false,abnormalRenal:false,abnormalLiver:false,strokeHistory:false,bleedingHistory:false,elderly:false,drugsAntiplateletOrNsaid:false,alcoholExcess:false} as const;
 it("sin factores (y sin evaluar INR) -> 0, bajo, con el INR lábil listado como no evaluado",()=>{
  const r=hasBled({...NONE,labileINR:undefined});
  expect(r).toMatchObject({score:0,risk:"LOW"});
  expect(r.components).toEqual([]);
  expect(r.notAssessed).toEqual(["INR lábil (TTR no disponible)"]);
 });
 it("cuenta 1 punto por cada componente presente",()=>{
  const r=hasBled({hypertensionUncontrolled:true,abnormalRenal:true,abnormalLiver:true,strokeHistory:true,bleedingHistory:true,labileINR:true,elderly:true,drugsAntiplateletOrNsaid:true,alcoholExcess:true});
  expect(r.score).toBe(9);expect(r.risk).toBe("HIGH");expect(r.notAssessed).toEqual([]);
 });
 it("umbrales: 0 bajo, 1–2 moderado, ≥3 alto",()=>{
  expect(hasBled({...NONE,labileINR:false}).risk).toBe("LOW");
  expect(hasBled({...NONE,labileINR:false,elderly:true}).risk).toBe("MODERATE");
  expect(hasBled({...NONE,labileINR:false,elderly:true,hypertensionUncontrolled:true}).risk).toBe("MODERATE");
  expect(hasBled({...NONE,labileINR:false,elderly:true,hypertensionUncontrolled:true,bleedingHistory:true}).risk).toBe("HIGH");
 });
 it("no inventa el punto de INR lábil cuando no es evaluable (score es un piso)",()=>{
  const r=hasBled({...NONE,labileINR:undefined,elderly:true,hypertensionUncontrolled:true});
  expect(r.score).toBe(2); // solo lo evaluado
  expect(r.notAssessed.length).toBe(1);
 });
});
// TTR por el método de Rosendaal (Thromb Haemost 1993): fracción del tiempo con el INR interpolado dentro del rango.
describe("timeInTherapeuticRange (Rosendaal 1993)",()=>{
 const day=(n:number)=>new Date(Date.UTC(2026,0,1+n)).toISOString();
 it("no calculable con <2 determinaciones ni con periodo demasiado corto -> undefined (no inventa %)",()=>{
  expect(timeInTherapeuticRange({readings:[{value:2.5,at:day(0)}]})).toBeUndefined();
  expect(timeInTherapeuticRange({readings:[{value:2.5,at:day(0)},{value:2.6,at:day(5)}]})).toBeUndefined(); // 5 días < 28
 });
 it("todos los INR dentro de 2.0–3.0 durante el periodo -> TTR 100%, no lábil",()=>{
  const r=timeInTherapeuticRange({readings:[{value:2.5,at:day(0)},{value:2.4,at:day(30)},{value:2.6,at:day(60)}]});
  expect(r).toBeDefined();expect(r!.ttrPct).toBe(100);expect(r!.labile).toBe(false);expect(r!.points).toBe(3);
 });
 it("interpolación lineal: de 2.0 a 4.0 en 40 días, la mitad del tramo queda sobre 3.0 -> 50% y es lábil (<60%)",()=>{
  const r=timeInTherapeuticRange({readings:[{value:2.0,at:day(0)},{value:4.0,at:day(40)}]});
  expect(r!.ttrPct).toBe(50);expect(r!.labile).toBe(true);expect(r!.method).toBe("Rosendaal");
 });
 it("respeta el rango de válvula mecánica (2.5–3.5)",()=>{
  const r=timeInTherapeuticRange({readings:[{value:3.0,at:day(0)},{value:3.0,at:day(40)}],target:{low:2.5,high:3.5}});
  expect(r!.ttrPct).toBe(100);
 });
});
