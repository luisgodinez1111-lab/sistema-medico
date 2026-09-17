import{describe,it,expect}from"vitest";
import{curb65}from"../../packages/pneumonia-severity/src";
// EPIC BZ — CURB-65.
const base={confusion:false,bun:10,respRate:18,systolic:120,diastolic:80,ageYears:50};
describe("curb65",()=>{
 it("paciente joven estable -> score 0, LOW, ambulatorio",()=>{
  const r=curb65(base)!;expect(r.score).toBe(0);expect(r.risk).toBe("LOW");
 });
 it("cada criterio suma 1",()=>{
  expect(curb65({...base,confusion:true})!.criteria.confusion).toBe(1);
  expect(curb65({...base,bun:25})!.criteria.urea).toBe(1);      // BUN>19
  expect(curb65({...base,respRate:32})!.criteria.resp).toBe(1); // FR>=30
  expect(curb65({...base,systolic:85})!.criteria.bp).toBe(1);   // sist<90
  expect(curb65({...base,diastolic:58})!.criteria.bp).toBe(1);  // diast<=60
  expect(curb65({...base,ageYears:70})!.criteria.age).toBe(1);  // edad>=65
 });
 it("score 2 -> MODERATE (considerar ingreso)",()=>{
  expect(curb65({...base,ageYears:70,bun:25})!.risk).toBe("MODERATE");
 });
 it("score 3+ -> HIGH (ingreso)",()=>{
  const r=curb65({...base,ageYears:70,bun:25,respRate:32})!;
  expect(r.score).toBe(3);expect(r.risk).toBe("HIGH");expect(r.recommendation).toMatch(/ingreso/i);
 });
 it("valores inválidos -> undefined",()=>{
  expect(curb65({...base,bun:NaN})).toBeUndefined();
 });
});
