import{describe,it,expect}from"vitest";
import{fib4,FIB4_HIGH_CUTOFF}from"../../packages/liver-fibrosis/src";
// EPIC BR — FIB-4.
describe("fib4 = (edad·AST)/(plaquetas·√ALT)",()=>{
 it("bajo riesgo: 40a, AST 25, ALT 25, plaq 250 -> ~0.8, LOW",()=>{
  const r=fib4(40,25,25,250)!;
  expect(r.value).toBeCloseTo(0.8,1); // (40*25)/(250*5)=1000/1250=0.8
  expect(r.risk).toBe("LOW");
 });
 it("alto riesgo: 65a, AST 80, ALT 40, plaq 100 -> ~8.2, HIGH",()=>{
  const r=fib4(65,80,40,100)!;
  expect(r.value).toBeCloseTo(8.22,1); // (65*80)/(100*6.324)=5200/632.5≈8.22
  expect(r.risk).toBe("HIGH");
 });
 it("indeterminado entra en 1.3–2.67",()=>{
  const r=fib4(60,50,30,150)!; // (60*50)/(150*5.477)=3000/821.6≈3.65 -> HIGH; ajusto
  expect(["LOW","INDETERMINATE","HIGH"]).toContain(r.risk);
  const r2=fib4(50,35,30,200)!; // (50*35)/(200*5.477)=1750/1095≈1.6 -> INDETERMINATE
  expect(r2.risk).toBe("INDETERMINATE");
 });
 it("a mayor edad/AST, mayor FIB-4 (monotonía)",()=>{
  expect(fib4(70,50,30,150)!.value).toBeGreaterThan(fib4(40,50,30,150)!.value);
  expect(fib4(50,90,30,150)!.value).toBeGreaterThan(fib4(50,40,30,150)!.value);
 });
 it("valores inválidos -> undefined",()=>{
  expect(fib4(0,25,25,250)).toBeUndefined();
  expect(fib4(40,25,25,0)).toBeUndefined();
  expect(fib4(40,NaN,25,250)).toBeUndefined();
 });
});

// Auditoría 2026-09-19, anexo R03 (vector F04): el corte bajo pierde especificidad a partir de los 65 años.
describe("corte de FIB-4 ajustado por edad (R03-F04)",()=>{
 it("a los 70 años, un FIB-4 de 1.8 es «poco probable», no «indeterminado»",()=>{
  // 70 años, AST 30, ALT 25, plaquetas 180 -> FIB-4 = (70*30)/(180*5) = 2.33 ... buscamos ~1.8
  const r=fib4(70,25,25,190)!; // (70*25)/(190*5) = 1.84
  expect(r.value).toBeCloseTo(1.84,1);
  expect(r.ageAdjusted).toBe(true);
  expect(r.lowCutoff).toBe(2.0);
  expect(r.risk).toBe("LOW");
  expect(r.interpretation).toMatch(/McPherson 2017/);
 });
 it("el mismo índice en un paciente de 50 años sigue siendo indeterminado",()=>{
  const r=fib4(50,35,25,190)!; // (50*35)/(190*5) = 1.84
  expect(r.value).toBeCloseTo(1.84,1);
  expect(r.ageAdjusted).toBe(false);
  expect(r.lowCutoff).toBe(1.3);
  expect(r.risk).toBe("INDETERMINATE");
 });
 it("el corte alto no cambia con la edad",()=>{
  expect(fib4(70,80,25,100)!.risk).toBe("HIGH"); // (70*80)/(100*5)=11.2
  expect(FIB4_HIGH_CUTOFF).toBe(2.67);
 });
});
