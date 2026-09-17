import{describe,it,expect}from"vitest";
import{classifyLab,deltaCheck}from"../../packages/lab-reference/src";
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
