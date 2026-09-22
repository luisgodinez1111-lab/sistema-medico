import{describe,it,expect}from"vitest";
import{charlson,charlsonFromIcd10,charlsonConditionsFromIcd10,CHARLSON_WEIGHTS}from"../../packages/comorbidity/src";
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
  const r=charlson(40,{diabetes:true,diabetesComplications:true})!; // C-08: los 2 puntos van al componente "con complicaciones"; el simple queda en 0
  expect(r.components.diabetesComplications).toBe(2);expect(r.components.diabetes).toBe(0);expect(r.comorbidityScore).toBe(2);
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
// Auditoría 2026-09-19 (C-08): 17 categorías (Charlson 1987, mapeo CIE-10 de Quan 2005) con jerarquías.
describe("Charlson completo (C-08)",()=>{
 it("las 17 categorías tienen peso: 1/2/3/6, y el total posible sin edad es 33 (10×1 + 4×2 + 3 + 6 + 6)",()=>{
  expect(Object.keys(CHARLSON_WEIGHTS)).toHaveLength(17);
  expect(Object.values(CHARLSON_WEIGHTS).reduce((a,b)=>a+b,0)).toBe(33);
  expect(CHARLSON_WEIGHTS.metastatic).toBe(6);expect(CHARLSON_WEIGHTS.aids).toBe(6);expect(CHARLSON_WEIGHTS.moderateSevereLiver).toBe(3);
 });
 it("condiciones de peso alto que antes NO existían: metástasis, SIDA, hepatopatía grave, demencia, hemiplejía",()=>{
  expect(charlson(45,{metastatic:true})!.comorbidityScore).toBe(6);
  expect(charlson(45,{aids:true})!.comorbidityScore).toBe(6);
  expect(charlson(45,{moderateSevereLiver:true})!.comorbidityScore).toBe(3);
  expect(charlson(45,{dementia:true,hemiplegia:true})!.comorbidityScore).toBe(3);
 });
 it("jerarquías: metástasis excluye neoplasia; hepatopatía grave excluye leve; diabetes con complicaciones excluye simple",()=>{
  expect(charlson(45,{malignancy:true,metastatic:true})!.comorbidityScore).toBe(6);
  expect(charlson(45,{mildLiver:true,moderateSevereLiver:true})!.comorbidityScore).toBe(3);
  expect(charlson(45,{diabetes:true,diabetesComplications:true})!.comorbidityScore).toBe(2);
  expect(charlson(45,{malignancy:true,metastatic:true})!.present).toEqual(["metastatic"]);
 });
 it("mapeo CIE-10: C34.1 -> neoplasia; C78.0 -> metastásico (y no neoplasia); B20 -> SIDA; K70.4 -> hepatopatía grave; F03 -> demencia; G81.9 -> hemiplejía",()=>{
  expect(charlsonConditionsFromIcd10(["C34.1"])).toMatchObject({malignancy:true,metastatic:false});
  expect(charlsonFromIcd10(60,["C34.1","C78.0"])!.comorbidityScore).toBe(6);
  expect(charlsonFromIcd10(40,["B20"])!.comorbidityScore).toBe(6);
  expect(charlsonFromIcd10(40,["K70.4"])!.comorbidityScore).toBe(3);
  expect(charlsonFromIcd10(40,["F03","G81.9"])!.comorbidityScore).toBe(3);
 });
 it("mapeo CIE-10 conservador: E11 sin subcategoría = diabetes simple; E11.2 = con complicaciones; I21 vs I25.2; N18 renal",()=>{
  expect(charlsonFromIcd10(40,["E11"])!.comorbidityScore).toBe(1);
  expect(charlsonFromIcd10(40,["E11.2"])!.comorbidityScore).toBe(2);
  expect(charlsonFromIcd10(40,["E11.9","E11.2"])!.comorbidityScore).toBe(2);
  expect(charlsonFromIcd10(40,["I25.2"])!.present).toEqual(["mi"]);
  expect(charlsonFromIcd10(40,["N18.3","I50.0","J44.1"])!.comorbidityScore).toBe(4);
 });
 it("no hay coincidencias por prefijo falso: I2 no es I21; E1 no es diabetes; C7 no es metástasis",()=>{
  expect(charlsonFromIcd10(40,["I2","E1","C7","X99"])!.comorbidityScore).toBe(0);
 });
 it("el caso de la auditoría: 75 años con IC + EPOC + ERC sigue dando 7 (compatibilidad con el subconjunto anterior)",()=>{
  expect(charlsonFromIcd10(75,["I50.9","J44.9","N18.4"])!.score).toBe(7);
 });
});
