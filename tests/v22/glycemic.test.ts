import{describe,it,expect}from"vitest";
import{estimatedAverageGlucose,glycemicAssessment,A1C_PLAUSIBLE,A1C_DIABETIC_TARGET_PCT}from"../../packages/glycemic/src";
import{HBA1C_CONTROL_THRESHOLD}from"../../apps/web/lib/runtime/analytics";
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

// Auditoría 2026-09-19, anexo R03 (vector F01): el eAG se calculaba sobre cualquier número positivo.
describe("cotas de la HbA1c en el eAG (R03-F01)",()=>{
 it("una HbA1c de 0.1 % ya no produce una glucosa promedio NEGATIVA «normal»",()=>{
  expect(estimatedAverageGlucose(0.1)).toBeUndefined(); // antes: −44 mg/dL
  expect(glycemicAssessment(0.1,false)).toBeUndefined();
 });
 it("una HbA1c de 50 (IFCC mmol/mol capturado como %) se rechaza en vez de dar eAG 1388",()=>{
  expect(estimatedAverageGlucose(50)).toBeUndefined();
  expect(A1C_PLAUSIBLE).toEqual([3,20]);
 });
 it("dentro del intervalo humano sigue calculando igual",()=>{
  expect(estimatedAverageGlucose(7)).toBe(154); // 28.7*7−46.7 = 154.2
  expect(estimatedAverageGlucose(A1C_PLAUSIBLE[0])).toBeDefined();
  expect(estimatedAverageGlucose(A1C_PLAUSIBLE[1])).toBeDefined();
 });
});
// Hallazgo D10 (porte): una sola meta para la evaluación por paciente y el indicador del tablero.
describe("meta glucémica del diabético (D10)",()=>{
 it("la evaluación por paciente usa A1C_DIABETIC_TARGET_PCT como corte",()=>{
  expect(A1C_DIABETIC_TARGET_PCT).toBe(7);
  expect(glycemicAssessment(A1C_DIABETIC_TARGET_PCT-0.01,true)?.category).toBe("CONTROLLED");
  expect(glycemicAssessment(A1C_DIABETIC_TARGET_PCT,true)?.category).toBe("ABOVE_TARGET");
 });
 it("el umbral del tablero ES la misma constante",()=>{expect(HBA1C_CONTROL_THRESHOLD).toBe(A1C_DIABETIC_TARGET_PCT);});
});
