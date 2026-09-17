import{describe,it,expect}from"vitest";
import{computeBMI,bmiCategory,heightToMeters}from"../../packages/anthropometrics/src";
// EPIC BO — IMC + clasificación WHO.
describe("computeBMI + clasificación WHO",()=>{
 it("70kg / 1.75m -> 22.9, NORMAL",()=>{
  const r=computeBMI(70,1.75)!;expect(r.bmi).toBe(22.9);expect(r.category).toBe("NORMAL");
 });
 it("100kg / 1.70m -> 34.6, OBESITY_I",()=>{
  const r=computeBMI(100,1.70)!;expect(r.bmi).toBeCloseTo(34.6,1);expect(r.category).toBe("OBESITY_I");
 });
 it("cubre las categorías WHO por umbral",()=>{
  expect(bmiCategory(17).category).toBe("UNDERWEIGHT");
  expect(bmiCategory(22).category).toBe("NORMAL");
  expect(bmiCategory(27).category).toBe("OVERWEIGHT");
  expect(bmiCategory(32).category).toBe("OBESITY_I");
  expect(bmiCategory(37).category).toBe("OBESITY_II");
  expect(bmiCategory(42).category).toBe("OBESITY_III");
 });
 it("valores inválidos -> undefined",()=>{
  expect(computeBMI(0,1.7)).toBeUndefined();
  expect(computeBMI(70,0)).toBeUndefined();
  expect(computeBMI(70,NaN)).toBeUndefined();
 });
});
describe("heightToMeters (acepta m o cm)",()=>{
 it("175 (cm) -> 1.75 m; 1.75 (m) -> 1.75 m",()=>{
  expect(heightToMeters(175)).toBe(1.75);
  expect(heightToMeters(1.75)).toBe(1.75);
 });
 it("fuera de rango fisiológico -> undefined",()=>{
  expect(heightToMeters(0)).toBeUndefined();
  expect(heightToMeters(300)).toBeUndefined(); // 3 m
 });
});
