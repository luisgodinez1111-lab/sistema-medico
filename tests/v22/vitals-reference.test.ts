import{describe,it,expect}from"vitest";
import{classifyVital}from"../../packages/vitals-reference/src";
describe("interpretación de signos vitales (EPIC AN)",()=>{
 it("presión: normal / hipertensión / crisis hipertensiva",()=>{
  expect(classifyVital("BP","120/80").status).toBe("NORMAL");
  expect(classifyVital("BP","150/95").status).toBe("ABNORMAL");
  expect(classifyVital("BP","190/125").status).toBe("CRITICAL");
  expect(classifyVital("BP","185/100").interpretation).toBe("Crisis hipertensiva");
 });
 it("presión con formato inválido -> UNKNOWN",()=>{expect(classifyVital("BP","alto").status).toBe("UNKNOWN");});
 it("SpO2: normal / hipoxemia / severa",()=>{
  expect(classifyVital("SPO2","98").status).toBe("NORMAL");
  expect(classifyVital("SPO2","92").status).toBe("ABNORMAL");
  expect(classifyVital("SPO2","85").status).toBe("CRITICAL");
 });
 it("temperatura: normal / fiebre / hipertermia",()=>{
  expect(classifyVital("TEMP","36.7").status).toBe("NORMAL");
  expect(classifyVital("TEMP","38.5").status).toBe("ABNORMAL");
  expect(classifyVital("TEMP","40.2").status).toBe("CRITICAL");
 });
 it("FC: normal / taquicardia / severa; FR crítica",()=>{
  expect(classifyVital("HR","72").status).toBe("NORMAL");
  expect(classifyVital("HR","110").status).toBe("ABNORMAL");
  expect(classifyVital("HR","135").status).toBe("CRITICAL");
  expect(classifyVital("RESP","34").status).toBe("CRITICAL");
 });
 it("tipo sin rango -> UNKNOWN",()=>{expect(classifyVital("WEIGHT","70").status).toBe("UNKNOWN");});
});
