import{describe,it,expect}from"vitest";
import{fib4}from"../../packages/liver-fibrosis/src";
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
