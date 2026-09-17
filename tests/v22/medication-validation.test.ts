import{describe,it,expect}from"vitest";
import{isValidDose,isValidRoute,isValidFrequency,validateMedicationOrder,normalizeRoute}from"../../packages/medication-validation/src";
describe("validación de orden de medicación (EPIC AV)",()=>{
 it("dosis: acepta cantidad+unidad; rechaza texto o sin unidad",()=>{
  for(const d of["500mg","1 g","0.5 mcg","10ml","2 UI","5 meq","1 tab","2 gotas"])expect(isValidDose(d)).toBe(true);
  for(const d of["mucho","500","abc mg","",": mg"])expect(isValidDose(d)).toBe(false);
 });
 it("vía: vocabulario controlado (case/espacios-insensible)",()=>{
  for(const r of["VO"," iv ","IM","sc","INH","SL"])expect(isValidRoute(r)).toBe(true);
  for(const r of["boca","xyz","",";"])expect(isValidRoute(r)).toBe(false);
  expect(normalizeRoute(" vo ")).toBe("VO");
 });
 it("frecuencia: patrón c/Nh, 'cada N horas' y abreviaturas",()=>{
  for(const f of["c/8h","c/ 12 h","cada 8 horas","cada 6 h","BID","tid","PRN","STAT","DU"])expect(isValidFrequency(f)).toBe(true);
  for(const f of["a veces","8","cuando duela",""])expect(isValidFrequency(f)).toBe(false);
 });
 it("validateMedicationOrder: ok cuando todo es válido; junta errores si no",()=>{
  expect(validateMedicationOrder({dose:"500mg",route:"VO",frequency:"c/8h"})).toEqual({ok:true,errors:[]});
  const bad=validateMedicationOrder({dose:"mucho",route:"boca",frequency:"a veces"});
  expect(bad.ok).toBe(false);
  expect(bad.errors).toHaveLength(3);
 });
});
