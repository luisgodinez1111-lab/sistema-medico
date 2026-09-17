import{describe,it,expect}from"vitest";
import{estimatedAverageGlucose,glycemicAssessment}from"../../packages/glycemic/src";
// EPIC BP — Control glucémico (HbA1c -> eAG + clasificación).
describe("estimatedAverageGlucose (ADAG)",()=>{
 it("A1c 7% -> ~154 mg/dL",()=>{expect(estimatedAverageGlucose(7)).toBe(154);}); // 28.7*7-46.7=154.2
 it("A1c 6% -> ~126 mg/dL",()=>{expect(estimatedAverageGlucose(6)).toBe(126);});
 it("A1c inválida -> undefined",()=>{expect(estimatedAverageGlucose(0)).toBeUndefined();expect(estimatedAverageGlucose(NaN)).toBeUndefined();});
});
describe("glycemicAssessment: marco TAMIZAJE (no diabético)",()=>{
 it("<5.7 NORMAL; 5.7–6.4 PREDIABETES; >=6.5 DIABETES_RANGE",()=>{
  expect(glycemicAssessment(5.4,false)!.category).toBe("NORMAL");
  expect(glycemicAssessment(6.0,false)!.category).toBe("PREDIABETES");
  expect(glycemicAssessment(7.2,false)!.category).toBe("DIABETES_RANGE");
 });
});
describe("glycemicAssessment: marco DIABÉTICO (metas de tratamiento)",()=>{
 it("<7 CONTROLLED; 7–8 ABOVE_TARGET; >8 POOR",()=>{
  expect(glycemicAssessment(6.5,true)!.category).toBe("CONTROLLED");
  expect(glycemicAssessment(7.5,true)!.category).toBe("ABOVE_TARGET");
  expect(glycemicAssessment(9.0,true)!.category).toBe("POOR");
 });
 it("el mismo 6.5% se interpreta distinto según el marco",()=>{
  expect(glycemicAssessment(6.5,false)!.category).toBe("DIABETES_RANGE"); // tamizaje: diagnóstico
  expect(glycemicAssessment(6.5,true)!.category).toBe("CONTROLLED");      // diabético conocido: en meta
 });
 it("incluye eAG y el frame",()=>{
  const r=glycemicAssessment(7,true)!;expect(r.eag).toBe(154);expect(r.frame).toBe("DIABETIC");
 });
});
