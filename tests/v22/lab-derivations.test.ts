import{describe,it,expect}from"vitest";
import{anionGap,correctedCalcium,correctedSodiumForGlucose,calculatedOsmolality}from"../../packages/lab-derivations/src";
// EPIC BN — Derivaciones de laboratorio multi-analito.
describe("anionGap (Na − Cl − HCO3)",()=>{
 it("normal: 140 − 104 − 24 = 12 -> NORMAL",()=>{
  expect(anionGap(140,104,24)).toMatchObject({value:12,status:"NORMAL"});
 });
 it("elevada: 140 − 100 − 10 = 30 -> HIGH (acidosis de brecha aumentada)",()=>{
  const r=anionGap(140,100,10)!;
  expect(r.value).toBe(30);expect(r.status).toBe("HIGH");
  expect(r.interpretation).toMatch(/brecha aniónica elevada/i);
 });
 it("baja: 140 − 112 − 24 = 4 -> LOW",()=>{
  expect(anionGap(140,112,24)!.status).toBe("LOW");
 });
 it("valores no finitos -> undefined",()=>{
  expect(anionGap(NaN,100,24)).toBeUndefined();
 });
});
describe("correctedCalcium (Ca + 0.8·(4−alb))",()=>{
 it("albúmina baja desenmascara hipocalcemia: Ca 8.0 medido (normal-bajo) con alb 2.0 -> corregido 9.6",()=>{
  const r=correctedCalcium(8.0,2.0)!;
  expect(r.corrected).toBe(9.6);   // 8 + 0.8*(4-2) = 9.6
  expect(r.measured).toBe(8.0);
 });
 it("Ca 7.0 con alb 2.0 -> corregido 8.6 (sigue reflejando el ajuste)",()=>{
  expect(correctedCalcium(7.0,2.0)!.corrected).toBe(8.6);
 });
 it("albúmina normal (4.0): corregido == medido",()=>{
  const r=correctedCalcium(9.5,4.0)!;
  expect(r.corrected).toBe(9.5);
 });
 it("albúmina inválida (<=0) o no finita -> undefined",()=>{
  expect(correctedCalcium(9.0,0)).toBeUndefined();
  expect(correctedCalcium(NaN,4)).toBeUndefined();
 });
});
describe("correctedSodiumForGlucose (EPIC BY)",()=>{
 it("hiperglucemia diluye el Na: Na 130 con glucosa 600 -> corregido 138 (130 + 1.6*5)",()=>{
  const r=correctedSodiumForGlucose(130,600)!;
  expect(r.corrected).toBe(138);expect(r.measured).toBe(130);
 });
 it("glucosa normal (<=100): corregido ≈ medido",()=>{
  expect(correctedSodiumForGlucose(140,90)!.corrected).toBeCloseTo(139.8,1); // 140+1.6*(-0.1)
 });
 it("valores inválidos -> undefined",()=>{expect(correctedSodiumForGlucose(140,0)).toBeUndefined();});
});
describe("calculatedOsmolality (EPIC BY)",()=>{
 it("normal: Na 140, glucosa 90, BUN 14 -> ~290, NORMAL",()=>{
  const r=calculatedOsmolality(140,90,14)!; // 280 + 5 + 5 = 290
  expect(r.value).toBeCloseTo(290,0);expect(r.status).toBe("NORMAL");
 });
 it("hiperosmolar: Na 145, glucosa 600, BUN 40 -> >295, HIGH",()=>{
  expect(calculatedOsmolality(145,600,40)!.status).toBe("HIGH");
 });
 it("valores inválidos -> undefined",()=>{expect(calculatedOsmolality(0,90,14)).toBeUndefined();});
});
// Auditoría 2026-09-19 (C-22): brecha aniónica corregida por albúmina (Figge).
describe("brecha aniónica corregida por albúmina",()=>{
 it("con albúmina 2.0 g/dL una brecha cruda 'normal' de 11 se vuelve 16 (alta): la hipoalbuminemia la enmascaraba",()=>{
  const r=anionGap(140,105,24,2.0)!;
  expect(r.raw).toBe(11);expect(r.value).toBe(16);expect(r.status).toBe("HIGH");expect(r.albuminCorrected).toBe(true);expect(r.interpretation).toMatch(/corregida por albúmina/);
 });
 it("con albúmina normal (4.0) no cambia; sin albúmina se declara sin corregir",()=>{
  expect(anionGap(140,105,24,4.0)!.value).toBe(11);
  const r=anionGap(140,105,24)!;expect(r.value).toBe(11);expect(r.albuminCorrected).toBe(false);expect(r.interpretation).toMatch(/sin corregir/);
 });
});
