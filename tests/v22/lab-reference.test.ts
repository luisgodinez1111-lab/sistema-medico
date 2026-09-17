import{describe,it,expect}from"vitest";
import{classifyLab}from"../../packages/lab-reference/src";
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
