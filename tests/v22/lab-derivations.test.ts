import{describe,it,expect}from"vitest";
import{anionGap,correctedCalcium}from"../../packages/lab-derivations/src";
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
