import{describe,it,expect}from"vitest";
import{meldScore}from"../../packages/meld/src";
// EPIC BW — MELD.
describe("meldScore",()=>{
 it("valores normales (todo 1) -> 6, LOW",()=>{
  const r=meldScore(1,1,1)!;expect(r.score).toBe(6);expect(r.risk).toBe("LOW");
 });
 it("hepatopatía avanzada: bili 10, INR 2.5, creat 3.5 -> ~37, VERY_HIGH",()=>{
  const r=meldScore(10,2.5,3.5)!;expect(r.score).toBeGreaterThanOrEqual(35);expect(r.risk).toBe("VERY_HIGH");
 });
 it("moderado: bili 2, INR 1.5, creat 1.5 -> ~17, MODERATE",()=>{
  const r=meldScore(2,1.5,1.5)!;expect(r.score).toBeGreaterThanOrEqual(15);expect(r.score).toBeLessThan(20);expect(r.risk).toBe("MODERATE");
 });
 it("acota creatinina a 4 y valores <1 a 1",()=>{
  expect(meldScore(10,2.5,8)!.score).toBe(meldScore(10,2.5,4)!.score); // creatinina >4 se acota
  expect(meldScore(0.5,0.9,0.6)!.score).toBe(6);                       // todos <1 -> 6
 });
 it("monotonía: mayor bilirrubina -> mayor MELD",()=>{
  expect(meldScore(20,1.5,1.5)!.score).toBeGreaterThan(meldScore(2,1.5,1.5)!.score);
 });
 it("valores inválidos -> undefined",()=>{
  expect(meldScore(NaN,1.5,1.5)).toBeUndefined();
  expect(meldScore(2,0,1.5)).toBeUndefined();
 });
});
