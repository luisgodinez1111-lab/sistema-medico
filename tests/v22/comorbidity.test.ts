import{describe,it,expect}from"vitest";
import{charlson}from"../../packages/comorbidity/src";
// EPIC CD — Índice de Charlson.
describe("charlson",()=>{
 it("joven sin comorbilidades -> score 0, LOW, supervivencia alta",()=>{
  const r=charlson(40,{})!;expect(r.score).toBe(0);expect(r.risk).toBe("LOW");expect(r.estimated10yrSurvivalPct).toBeGreaterThan(95);
 });
 it("edad puntúa por décadas: <50=0,50-59=1,60-69=2,70-79=3,>=80=4",()=>{
  expect(charlson(45,{})!.ageScore).toBe(0);
  expect(charlson(55,{})!.ageScore).toBe(1);
  expect(charlson(65,{})!.ageScore).toBe(2);
  expect(charlson(75,{})!.ageScore).toBe(3);
  expect(charlson(82,{})!.ageScore).toBe(4);
 });
 it("diabetes simple=1; con complicaciones=2 (no ambas)",()=>{
  expect(charlson(40,{diabetes:true})!.components.diabetes).toBe(1);
  expect(charlson(40,{diabetes:true,diabetesComplications:true})!.components.diabetes).toBe(2);
 });
 it("ERC moderada/severa suma 2",()=>{
  expect(charlson(40,{renal:true})!.components.renal).toBe(2);
 });
 it("suma edad + comorbilidades: 75a con IC+EPOC+ERC = 3(edad)+1+1+2 = 7, SEVERE",()=>{
  const r=charlson(75,{chf:true,copd:true,renal:true})!;
  expect(r.score).toBe(7);expect(r.risk).toBe("SEVERE");
 });
 it("a mayor score, menor supervivencia estimada (monotonía)",()=>{
  expect(charlson(80,{chf:true,renal:true,copd:true})!.estimated10yrSurvivalPct).toBeLessThan(charlson(40,{})!.estimated10yrSurvivalPct);
 });
 it("edad inválida -> undefined",()=>{expect(charlson(NaN,{})).toBeUndefined();});
});
