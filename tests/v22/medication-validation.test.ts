import{describe,it,expect}from"vitest";
import{isValidDose,isValidRoute,isValidFrequency,validateMedicationOrder,normalizeRoute,doseToMg,dosesPerDay,checkDoseCeiling}from"../../packages/medication-validation/src";
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
describe("tope de dosis máxima diaria — dose ceiling (EPIC AZ)",()=>{
 it("doseToMg: convierte masa a mg; undefined si no es masa",()=>{
  expect(doseToMg("500mg")).toBe(500);expect(doseToMg("1 g")).toBe(1000);expect(doseToMg("0,5 g")).toBe(500);
  expect(doseToMg("250mcg")).toBe(0.25);expect(doseToMg("10ml")).toBeUndefined();expect(doseToMg("2 tab")).toBeUndefined();
 });
 it("dosesPerDay: c/Nh, cada N horas, c/Nd y abreviaturas; PRN no acotable",()=>{
  expect(dosesPerDay("c/8h")).toBe(3);expect(dosesPerDay("cada 6 horas")).toBe(4);expect(dosesPerDay("c/24h")).toBe(1);
  expect(dosesPerDay("BID")).toBe(2);expect(dosesPerDay("TID")).toBe(3);expect(dosesPerDay("c/2d")).toBe(0.5);
  expect(dosesPerDay("PRN")).toBeUndefined();expect(dosesPerDay("a veces")).toBeUndefined();
 });
 it("ibuprofeno 800mg c/6h = 3200mg/día: en el límite, NO excede",()=>{
  expect(checkDoseCeiling("ibuprofeno","800mg","c/6h")).toMatchObject({checked:true,exceeded:false,computedMgPerDay:3200,maxMgPerDay:3200});
 });
 it("ibuprofeno 800mg c/4h = 4800mg/día: EXCEDE el tope de 3200",()=>{
  const r=checkDoseCeiling("ibuprofeno","800mg","c/4h");
  expect(r).toMatchObject({checked:true,exceeded:true,computedMgPerDay:4800,maxMgPerDay:3200});
 });
 it("paracetamol 1g c/4h = 6000mg/día: EXCEDE 4000 (normaliza acento del principio activo)",()=>{
  expect(checkDoseCeiling("acetaminofén","1g","c/4h").exceeded).toBe(true);
 });
 it("no acotable -> checked=false, no bloquea (PRN, unidad no-masa, o sin tope conocido)",()=>{
  expect(checkDoseCeiling("ibuprofeno","400mg","PRN").checked).toBe(false);
  expect(checkDoseCeiling("ibuprofeno","2 tab","c/8h").checked).toBe(false);
  expect(checkDoseCeiling("fármaco-desconocido","500mg","c/8h").checked).toBe(false);
 });
});
