import{describe,it,expect}from"vitest";
import{interpretAcidBase}from"../../packages/acid-base/src";
// EPIC BX — Interpretación ácido-base (con Winters).
describe("interpretAcidBase",()=>{
 it("normal: pH 7.40, pCO2 40, HCO3 24 -> NORMAL",()=>{
  const r=interpretAcidBase(7.40,40,24)!;expect(r.status).toBe("NORMAL");expect(r.primary).toBe("NORMAL");
 });
 it("acidosis metabólica compensada adecuadamente (Winters): pH 7.30, HCO3 12, pCO2 26",()=>{
  const r=interpretAcidBase(7.30,26,12)!; // esperado = 1.5*12+8 = 26
  expect(r.primary).toBe("METABOLIC_ACIDOSIS");
  expect(r.expectedPco2).toBe(26);
  expect(r.compensation).toMatch(/adecuada/i);
 });
 it("acidosis metabólica + acidosis respiratoria concurrente (pCO2 mayor al esperado)",()=>{
  const r=interpretAcidBase(7.20,40,12)!; // esperado 26, medido 40 -> respiratoria concurrente
  expect(r.compensation).toMatch(/respiratoria concurrente/i);
 });
 it("acidosis metabólica + alcalosis respiratoria concurrente (pCO2 menor al esperado)",()=>{
  const r=interpretAcidBase(7.30,18,12)!; // esperado 26, medido 18 -> sobrecompensación
  expect(r.compensation).toMatch(/sobrecompensaci/i);
 });
 it("acidosis respiratoria: pH 7.28, pCO2 60, HCO3 24",()=>{
  expect(interpretAcidBase(7.28,60,24)!.primary).toBe("RESPIRATORY_ACIDOSIS");
 });
 it("alcalosis metabólica: pH 7.50, HCO3 34, pCO2 40",()=>{
  expect(interpretAcidBase(7.50,40,34)!.primary).toBe("METABOLIC_ALKALOSIS");
 });
 it("alcalosis respiratoria: pH 7.50, pCO2 28, HCO3 24",()=>{
  expect(interpretAcidBase(7.50,28,24)!.primary).toBe("RESPIRATORY_ALKALOSIS");
 });
 it("valores inválidos -> undefined",()=>{
  expect(interpretAcidBase(0,40,24)).toBeUndefined();
  expect(interpretAcidBase(7.4,NaN,24)).toBeUndefined();
 });
});
