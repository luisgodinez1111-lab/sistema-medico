import{describe,it,expect}from"vitest";
import{interpretINR}from"../../packages/anticoagulation/src";
// EPIC BU — Monitoreo terapéutico del INR.
describe("interpretINR (rango objetivo por defecto 2.0–3.0)",()=>{
 it("2.5 -> THERAPEUTIC",()=>{expect(interpretINR(2.5)!.status).toBe("THERAPEUTIC");});
 it("1.5 -> SUBTHERAPEUTIC (riesgo trombótico)",()=>{expect(interpretINR(1.5)!.status).toBe("SUBTHERAPEUTIC");});
 it("3.8 -> SUPRATHERAPEUTIC (riesgo hemorrágico)",()=>{expect(interpretINR(3.8)!.status).toBe("SUPRATHERAPEUTIC");});
 it(">=5 -> CRITICAL_HIGH",()=>{
  expect(interpretINR(5.0)!.status).toBe("CRITICAL_HIGH");
  expect(interpretINR(7.2)!.status).toBe("CRITICAL_HIGH");
 });
 it("límites exactos: 2.0 y 3.0 son terapéuticos",()=>{
  expect(interpretINR(2.0)!.status).toBe("THERAPEUTIC");
  expect(interpretINR(3.0)!.status).toBe("THERAPEUTIC");
 });
 it("rango objetivo personalizado (prótesis mecánica 2.5–3.5)",()=>{
  expect(interpretINR(2.4,{low:2.5,high:3.5})!.status).toBe("SUBTHERAPEUTIC");
  expect(interpretINR(3.4,{low:2.5,high:3.5})!.status).toBe("THERAPEUTIC");
 });
 it("valor inválido -> undefined",()=>{expect(interpretINR(0)).toBeUndefined();expect(interpretINR(NaN)).toBeUndefined();});
});
