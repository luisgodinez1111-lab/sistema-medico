import{describe,it,expect}from"vitest";
import{aaGradient,atmPressureFromAltitude}from"../../packages/oxygenation/src";
// EPIC CA — Gradiente A-a. Auditoría R03-08: la FiO₂ y la presión atmosférica son OBLIGATORIAS (antes 0.21 y 760 mmHg por
// omisión: en una sede a 2 240 m eso sobrestima el gradiente ~37 mmHg y convierte una hipoventilación en un falso problema
// de intercambio). Estas pruebas declaran «nivel del mar, aire ambiente» a propósito.
describe("aaGradient (aire ambiente, nivel del mar)",()=>{
 it("joven sano: PaO2 95, PaCO2 40 -> PAO2 ~100, gradiente ~5, normal",()=>{
  const r=aaGradient(95,40,30,{fio2:0.21,atmPressure:760})!; // 0.21*713 - 40/0.8 = 149.7 - 50 = 99.7; grad = 4.7
  expect(r.alveolarPo2).toBeCloseTo(99.7,0);
  expect(r.gradient).toBeCloseTo(4.7,1);
  expect(r.elevated).toBe(false);
 });
 it("intercambio alterado: PaO2 55, PaCO2 40, 60a -> gradiente elevado",()=>{
  const r=aaGradient(55,40,60,{fio2:0.21,atmPressure:760})!; // PAO2 99.7, grad 44.7; esperado 2.5+12.6=15.1
  expect(r.gradient).toBeGreaterThan(r.expected);
  expect(r.elevated).toBe(true);
  expect(r.interpretation).toMatch(/intercambio gaseoso/i);
 });
 it("hipoventilación pura: PaO2 65, PaCO2 60 -> gradiente normal (no intercambio)",()=>{
  const r=aaGradient(65,60,40,{fio2:0.21,atmPressure:760})!; // PAO2 = 149.7 - 75 = 74.7; grad = 9.7; esperado 10.9 -> normal
  expect(r.elevated).toBe(false);
 });
 it("el gradiente esperado sube con la edad",()=>{
  expect(aaGradient(90,40,80,{fio2:0.21,atmPressure:760})!.expected).toBeGreaterThan(aaGradient(90,40,20,{fio2:0.21,atmPressure:760})!.expected);
 });
 it("parametrizable por altitud (menor presión -> menor PAO2)",()=>{
  const sea=aaGradient(90,40,40,{fio2:0.21,atmPressure:760})!;const alt=aaGradient(90,40,40,{fio2:0.21,atmPressure:585})!; // CDMX
  expect(alt.alveolarPo2).toBeLessThan(sea.alveolarPo2);
 });
 // Auditoría 2026-09-19 (C-18): la FiO₂ real es obligatoria; con O₂ suplementario el "esperado por edad" NO aplica.
 it("con O₂ suplementario (FiO₂ 0.40): el gradiente sube pero NO se declara 'elevado' contra la fórmula de aire ambiente",()=>{
  const r=aaGradient(90,40,60,{fio2:0.4,atmPressure:760})!; // PAO2 = 0.4*713 - 50 = 235.2; grad = 145.2
  expect(r.alveolarPo2).toBeCloseTo(235.2,1);expect(r.gradient).toBeCloseTo(145.2,1);
  expect(r.expectedValid).toBe(false);expect(r.elevated).toBe(false);
  expect(r.pfRatio).toBe(225);expect(r.interpretation).toMatch(/NO aplica/);expect(r.interpretation).toMatch(/<300/);
 });
 it("aire ambiente: expectedValid=true y devuelve la FiO₂ y la presión usadas (procedencia del cálculo)",()=>{
  const r=aaGradient(95,40,30,{fio2:0.21,atmPressure:585})!;
  expect(r).toMatchObject({expectedValid:true,fio2:0.21,atmPressure:585});expect(r.pfRatio).toBe(452);
 });
 it("valores inválidos -> undefined",()=>{
  expect(aaGradient(0,40,40,{fio2:0.21,atmPressure:760})).toBeUndefined();
  expect(aaGradient(90,40,40,{fio2:2,atmPressure:760})).toBeUndefined();
 });
});

// Auditoría R03-08 — la presión atmosférica decide el diagnóstico, no es un detalle.
describe("presión atmosférica: obligatoria y derivable de la altitud (R03-08)",()=>{
 it("sin presión o sin FiO₂ no hay resultado (antes asumía nivel del mar y aire ambiente)",()=>{
  // El tipo ya las exige; esto comprueba que además falla en RUNTIME si llega un objeto incompleto desde JSON.
  type Opts=Parameters<typeof aaGradient>[3];
  expect(aaGradient(60,40,60,{fio2:0.21} as Opts)).toBeUndefined();
  expect(aaGradient(60,40,60,{atmPressure:585} as Opts)).toBeUndefined();
  expect(aaGradient(60,40,60,{fio2:0.21,atmPressure:900})).toBeUndefined(); // fuera de rango: no hay sede clínica ahí
 });
 it("MISMA gasometría: a nivel del mar sale «elevado», a la presión de CDMX sale normal",()=>{
  const mar=aaGradient(60,40,60,{fio2:0.21,atmPressure:760})!;
  const cdmx=aaGradient(60,40,60,{fio2:0.21,atmPressure:585})!;
  expect(mar.elevated).toBe(true);        // lectura errónea si la sede está en altitud
  expect(cdmx.elevated).toBe(false);      // lectura correcta: hipoxemia por hipoventilación
  expect(mar.gradient-cdmx.gradient).toBeGreaterThan(30);
 });
 it("la altitud se traduce a presión con la atmósfera estándar (ISO 2533)",()=>{
  expect(atmPressureFromAltitude(0)).toBe(760);
  expect(atmPressureFromAltitude(2240)).toBeCloseTo(578.7,0);   // Ciudad de México
  expect(atmPressureFromAltitude(2660)).toBeCloseTo(549,0);     // Toluca
  expect(atmPressureFromAltitude(7000)).toBeUndefined();
  expect(atmPressureFromAltitude(Number.NaN)).toBeUndefined();
 });
 it("rechaza entradas fisiológicamente imposibles en el propio paquete, no solo en la ruta",()=>{
  expect(aaGradient(900,40,60,{fio2:0.21,atmPressure:760})).toBeUndefined();  // PaO₂ imposible respirando aire
  expect(aaGradient(60,300,60,{fio2:0.21,atmPressure:760})).toBeUndefined();  // PaCO₂ imposible
  expect(aaGradient(60,40,140,{fio2:0.21,atmPressure:760})).toBeUndefined();  // edad imposible
 });
});
