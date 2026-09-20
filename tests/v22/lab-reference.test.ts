import{describe,it,expect}from"vitest";
import{classifyLab,deltaCheck,computeNEWS2,normalizeLabValue,acceptedUnitsOf,canonicalUnitOf,labReferenceRanges,analyteLabel,ANALYTE_UNITS}from"../../packages/lab-reference/src";
// EPIC AQ + AU — valores de pánico de laboratorio. El flag `critical` se DERIVA del valor.
describe("classifyLab (rangos de referencia / valores de pánico)",()=>{
 it("potasio: normal / anormal / crítico (alto y bajo)",()=>{
  expect(classifyLab("POTASSIUM","4.2")).toMatchObject({status:"NORMAL",critical:false});
  expect(classifyLab("POTASSIUM","5.8")).toMatchObject({status:"ABNORMAL",critical:false});
  expect(classifyLab("POTASSIUM","7.0")).toMatchObject({status:"CRITICAL",critical:true});
  expect(classifyLab("POTASSIUM","2.0")).toMatchObject({status:"CRITICAL",critical:true});
 });
 it("glucosa crítica alta y baja",()=>{
  expect(classifyLab("GLUCOSE","600").critical).toBe(true);
  expect(classifyLab("GLUCOSE","35").critical).toBe(true);
  expect(classifyLab("GLUCOSE","100").status).toBe("NORMAL");
 });
 it("troponina: cualquier elevación >0.04 es crítica",()=>{
  expect(classifyLab("TROPONIN","0.02").status).toBe("NORMAL");
  expect(classifyLab("TROPONIN","0.5").critical).toBe(true);
 });
 it("analitos nuevos: calcio, bicarbonato, pH, lactato, BNP, ALT",()=>{
  expect(classifyLab("CALCIUM","14").critical).toBe(true);        // hipercalcemia severa
  expect(classifyLab("CALCIUM","5.5").critical).toBe(true);       // hipocalcemia severa
  expect(classifyLab("BICARBONATE","8").critical).toBe(true);     // acidosis severa
  expect(classifyLab("PH","7.1").critical).toBe(true);            // acidemia severa
  expect(classifyLab("PH","7.4").status).toBe("NORMAL");
  expect(classifyLab("LACTATE","5").critical).toBe(true);         // hiperlactatemia
  expect(classifyLab("BNP","500").critical).toBe(true);           // IC descompensada
  expect(classifyLab("ALT","1200").critical).toBe(true);          // hepatitis fulminante
  expect(classifyLab("ALT","30").status).toBe("NORMAL");
 });
 it("analito desconocido o valor no numérico -> UNKNOWN, nunca falso NORMAL",()=>{
  expect(classifyLab("XYZ","5").status).toBe("UNKNOWN");
  expect(classifyLab("POTASSIUM","alto").status).toBe("UNKNOWN");
 });
});
describe("deltaCheck (variación crítica entre resultados — EPIC BB)",()=>{
 it("creatinina que se duplica -> delta CRÍTICO (por ratio y por abs)",()=>{
  const r=deltaCheck("CREATININE","0.9","1.9");
  expect(r).toMatchObject({flagged:true,severity:"CRITICAL"});expect(r.changeAbs).toBe(1);
 });
 it("creatinina estable (subida leve) -> no flag",()=>{
  expect(deltaCheck("CREATININE","0.9","1.1").flagged).toBe(false);
 });
 it("hemoglobina que cae >=2 g/dL -> CRÍTICO; una subida NO (dirección)",()=>{
  expect(deltaCheck("HEMOGLOBIN","12","9.5").flagged).toBe(true);
  expect(deltaCheck("HEMOGLOBIN","9.5","12").flagged).toBe(false);
 });
 it("sodio: cambio >=10 en cualquier dirección -> CRÍTICO",()=>{
  expect(deltaCheck("SODIUM","140","128").flagged).toBe(true);
  expect(deltaCheck("SODIUM","128","140").flagged).toBe(true);
  expect(deltaCheck("SODIUM","140","136").flagged).toBe(false);
 });
 it("plaquetas: caída >=50% -> CRÍTICO (por ratio)",()=>{
  expect(deltaCheck("PLATELETS","200","90").flagged).toBe(true);
  expect(deltaCheck("PLATELETS","200","160").flagged).toBe(false);
 });
 it("sin regla de delta o sin valor numérico -> no flag",()=>{
  expect(deltaCheck("ALT","30","900").flagged).toBe(false);       // sin regla de delta
  expect(deltaCheck("CREATININE","x","1.9").flagged).toBe(false); // previo no numérico
 });
});
describe("computeNEWS2 (early warning score agregado — EPIC BC)",()=>{
 it("paciente estable -> score 0, banda LOW, sin escalamiento",()=>{
  const r=computeNEWS2({resp:16,spo2:98,temp:36.8,sbp:120,hr:72,consciousness:"A"});
  expect(r).toMatchObject({score:0,band:"LOW",redFlag:false,escalation:false});
 });
 it("suma correcta de parámetros anormales",()=>{
  // resp 22->2, spo2 93->2, temp 38.5->1, sbp 100->2, hr 112->2, A->0 = 9
  const r=computeNEWS2({resp:22,spo2:93,temp:38.5,sbp:100,hr:112,consciousness:"A"});
  expect(r.score).toBe(9);expect(r.band).toBe("HIGH");expect(r.escalation).toBe(true);
 });
 it("un solo parámetro en 3 (red flag) escala a MEDIUM aunque el score sea bajo",()=>{
  // spo2 90 -> 3 (único), resto normal -> score 3, redFlag true, banda MEDIUM
  const r=computeNEWS2({resp:16,spo2:90,temp:36.8,sbp:120,hr:72,consciousness:"A"});
  expect(r.score).toBe(3);expect(r.redFlag).toBe(true);expect(r.band).toBe("MEDIUM");
 });
 it("consciencia alterada (V/P/U) puntúa 3",()=>{
  expect(computeNEWS2({consciousness:"V"}).params["consciousness"]).toBe(3);
  expect(computeNEWS2({consciousness:"ALERT"}).params["consciousness"]).toBe(0);
 });
 it("O2 suplementario suma 2; aire ambiente 0 por defecto",()=>{
  expect(computeNEWS2({supplementalO2:true}).params["supplementalO2"]).toBe(2);
  expect(computeNEWS2({}).params["supplementalO2"]).toBe(0);
 });
 it("parámetros faltantes se reportan (score = cota inferior)",()=>{
  const r=computeNEWS2({hr:72});
  expect(r.missing).toEqual(expect.arrayContaining(["resp","spo2","temp","sbp","consciousness"]));
  expect(r.score).toBe(0);
 });
 it("score 5-6 -> MEDIUM",()=>{
  // resp 21->2, hr 111->2, temp 39.5->2 = 6
  expect(computeNEWS2({resp:21,hr:111,temp:39.5,spo2:98,sbp:120,consciousness:"A"}).band).toBe("MEDIUM");
 });
});
// Auditoría 2026-09-19 (C-01, C-02, U-07) — un número de laboratorio SIN unidad no es un dato clínico.
// Antes: glucosa 7 (mmol/L, normal) => "críticamente baja"; plaquetas 250000 (/µL) => FIB-4 = 0.00 "sin fibrosis".
describe("normalizeLabValue (unidad canónica, conversión y plausibilidad)",()=>{
 it("convierte SI -> convencional con los factores estándar",()=>{
  expect(normalizeLabValue("GLUCOSE","7","mmol/L")).toMatchObject({ok:true,canonicalUnit:"mg/dL",unitAssumed:false});
  const g=normalizeLabValue("GLUCOSE","7","mmol/L");expect(g.ok&&g.canonicalValue).toBeCloseTo(126.1,1);
  const c=normalizeLabValue("CREATININE","88.4","µmol/L");expect(c.ok&&c.canonicalValue).toBeCloseTo(1.0,3);
  const p=normalizeLabValue("PLATELETS","250000","/µL");expect(p.ok&&p.canonicalValue).toBeCloseTo(250,6);
  const h=normalizeLabValue("HBA1C","53","mmol/mol");expect(h.ok&&h.canonicalValue).toBeCloseTo(7.0,1); // IFCC->NGSP
  const o=normalizeLabValue("PO2","10","kPa");expect(o.ok&&o.canonicalValue).toBeCloseTo(75.0,1);
 });
 it("grafías equivalentes de la misma unidad (µ/μ/u, mayúsculas, espacios, /mm3)",()=>{
  for(const u of["mg/dL","MG/DL"," mg / dl "])expect(normalizeLabValue("GLUCOSE","95",u)).toMatchObject({ok:true,canonicalValue:95});
  for(const u of["µmol/L","μmol/L","umol/L"])expect(normalizeLabValue("CREATININE","88.4",u).ok).toBe(true);
  for(const u of["10^3/µL","x10^3/uL","10^9/L","K/µL"])expect(normalizeLabValue("PLATELETS","250",u)).toMatchObject({ok:true,canonicalValue:250});
  expect(normalizeLabValue("WBC","7500","/mm3")).toMatchObject({ok:true,canonicalValue:7.5});
 });
 it("coma decimal (captura habitual en México) se interpreta como decimal",()=>{
  expect(normalizeLabValue("POTASSIUM","5,8","mEq/L")).toMatchObject({ok:true,canonicalValue:5.8});
  expect(classifyLab("POTASSIUM","5,8","mEq/L").status).toBe("ABNORMAL");
 });
 it("sin unidad: se ASUME la canónica y se declara (unitAssumed)",()=>{
  expect(normalizeLabValue("GLUCOSE","95")).toMatchObject({ok:true,canonicalValue:95,canonicalUnit:"mg/dL",unitAssumed:true});
 });
 it("unidad que el analito no admite -> UNKNOWN_UNIT (no se adivina la conversión)",()=>{
  expect(normalizeLabValue("GLUCOSE","95","g/L")).toMatchObject({ok:false,reason:"UNKNOWN_UNIT"});
  expect(normalizeLabValue("CREATININE","1.0","mEq/L")).toMatchObject({ok:false,reason:"UNKNOWN_UNIT"});
 });
 it("valor físicamente imposible en la unidad declarada -> IMPLAUSIBLE (atrapa el cruce SI<->convencional)",()=>{
  expect(normalizeLabValue("GLUCOSE","7")).toMatchObject({ok:false,reason:"IMPLAUSIBLE"});          // 7 mg/dL no existe: era mmol/L
  expect(normalizeLabValue("PLATELETS","250000")).toMatchObject({ok:false,reason:"IMPLAUSIBLE"});   // 250000 x10^3/µL no existe: era /µL
  expect(normalizeLabValue("CREATININE","88.4")).toMatchObject({ok:false,reason:"IMPLAUSIBLE"});    // 88.4 mg/dL no existe: era µmol/L
  expect(normalizeLabValue("PH","74")).toMatchObject({ok:false,reason:"IMPLAUSIBLE"});
  expect(normalizeLabValue("POTASSIUM","-4")).toMatchObject({ok:false,reason:"IMPLAUSIBLE"});
 });
 it("no numérico -> NOT_NUMERIC",()=>{
  expect(normalizeLabValue("POTASSIUM","alto")).toMatchObject({ok:false,reason:"NOT_NUMERIC"});
  expect(normalizeLabValue("POTASSIUM","")).toMatchObject({ok:false,reason:"NOT_NUMERIC"});
 });
});
describe("classifyLab con unidades (un valor implausible NUNCA dispara un crítico falso)",()=>{
 it("glucosa 7 mmol/L es NORMAL; la misma cifra sin unidad es UNKNOWN, no 'críticamente baja'",()=>{
  expect(classifyLab("GLUCOSE","7","mmol/L").critical).toBe(false);
  expect(classifyLab("GLUCOSE","7")).toMatchObject({status:"UNKNOWN",critical:false});
 });
 it("un crítico REAL expresado en SI sigue siendo crítico",()=>{
  expect(classifyLab("GLUCOSE","33.3","mmol/L")).toMatchObject({status:"CRITICAL",critical:true});   // = 600 mg/dL
  expect(classifyLab("CREATININE","900","µmol/L").critical).toBe(true);                               // = 10.2 mg/dL
  expect(classifyLab("HEMOGLOBIN","60","g/L").critical).toBe(true);                                   // = 6 g/dL
 });
 it("unidad no admitida -> UNKNOWN",()=>{expect(classifyLab("GLUCOSE","95","g/L").status).toBe("UNKNOWN");});
});
describe("catálogo de unidades — invariantes",()=>{
 const analytes=labReferenceRanges().map(r=>r.analyte);
 it("todo analito con rango de referencia declara unidad canónica, y viceversa",()=>{
  expect(analytes.filter(a=>!ANALYTE_UNITS[a])).toEqual([]);
  expect(Object.keys(ANALYTE_UNITS).filter(a=>!analytes.includes(a))).toEqual([]);
 });
 it("toda unidad que la UI OFRECE la acepta el servidor, y la primera es la canónica",()=>{
  for(const a of analytes){
   const units=acceptedUnitsOf(a);expect(units.length,a).toBeGreaterThan(0);expect(units[0],a).toBe(canonicalUnitOf(a));
   expect(new Set(units.map(u=>u.toLowerCase())).size,a).toBe(units.length); // sin duplicados
   for(const u of units){const n=normalizeLabValue(a,"1",u);expect(n.ok===false&&n.reason==="UNKNOWN_UNIT",`${a} ${u}`).toBe(false);}
  }
 });
 it("todo analito tabulado tiene nombre clínico en español (los mensajes al médico nunca muestran el código interno)",()=>{
  for(const a of analytes)expect(analyteLabel(a),a).not.toBe("");
  expect(analyteLabel("CREATININE")).toBe("creatinina");expect(analyteLabel("PLATELETS")).toBe("plaquetas");
  expect(analyteLabel("XYZ")).toBe("XYZ"); // no tabulado: se devuelve el propio código, sin inventar
 });
 it("todo umbral de pánico REAL es alcanzable: la plausibilidad nunca rechaza un valor crítico verdadero",()=>{
  // Centinelas de la tabla de rangos: criticalLow=0 => sin crítico bajo; criticalHigh=99/999 => sin crítico alto.
  for(const r of labReferenceRanges()){const[lo,hi]=ANALYTE_UNITS[r.analyte]!.plausible;
   if(r.criticalLow>0)expect(lo,`${r.analyte} (bajo)`).toBeLessThan(r.criticalLow);
   if(r.criticalHigh!==99&&r.criticalHigh!==999)expect(hi,`${r.analyte} (alto)`).toBeGreaterThan(r.criticalHigh);}
 });
});
