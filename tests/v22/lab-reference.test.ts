import{describe,it,expect}from"vitest";
import{classifyLab,deltaCheck,computeNEWS2}from"../../packages/lab-reference/src";
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
