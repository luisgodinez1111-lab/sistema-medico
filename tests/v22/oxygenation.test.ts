import{describe,it,expect}from"vitest";
import{aaGradient}from"../../packages/oxygenation/src";
// EPIC CA — Gradiente A-a.
describe("aaGradient (aire ambiente, nivel del mar)",()=>{
 it("joven sano: PaO2 95, PaCO2 40 -> PAO2 ~100, gradiente ~5, normal",()=>{
  const r=aaGradient(95,40,30)!; // 0.21*713 - 40/0.8 = 149.7 - 50 = 99.7; grad = 4.7
  expect(r.alveolarPo2).toBeCloseTo(99.7,0);
  expect(r.gradient).toBeCloseTo(4.7,1);
  expect(r.elevated).toBe(false);
 });
 it("intercambio alterado: PaO2 55, PaCO2 40, 60a -> gradiente elevado",()=>{
  const r=aaGradient(55,40,60)!; // PAO2 99.7, grad 44.7; esperado 2.5+12.6=15.1
  expect(r.gradient).toBeGreaterThan(r.expected);
  expect(r.elevated).toBe(true);
  expect(r.interpretation).toMatch(/intercambio gaseoso/i);
 });
 it("hipoventilación pura: PaO2 65, PaCO2 60 -> gradiente normal (no intercambio)",()=>{
  const r=aaGradient(65,60,40)!; // PAO2 = 149.7 - 75 = 74.7; grad = 9.7; esperado 10.9 -> normal
  expect(r.elevated).toBe(false);
 });
 it("el gradiente esperado sube con la edad",()=>{
  expect(aaGradient(90,40,80)!.expected).toBeGreaterThan(aaGradient(90,40,20)!.expected);
 });
 it("parametrizable por altitud (menor presión -> menor PAO2)",()=>{
  const sea=aaGradient(90,40,40)!;const alt=aaGradient(90,40,40,{atmPressure:585})!; // CDMX
  expect(alt.alveolarPo2).toBeLessThan(sea.alveolarPo2);
 });
 it("valores inválidos -> undefined",()=>{
  expect(aaGradient(0,40,40)).toBeUndefined();
  expect(aaGradient(90,40,40,{fio2:2})).toBeUndefined();
 });
});
