import{describe,it,expect}from"vitest";
import{isValidIcd10,lookupIcd10,searchIcd10,normalizeIcd10,catalogSize}from"../../packages/terminology/src";
describe("terminología CIE-10 (EPIC AM)",()=>{
 it("el catálogo tiene entradas",()=>{expect(catalogSize()).toBeGreaterThan(20);});
 it("normaliza (trim + mayúsculas)",()=>{expect(normalizeIcd10(" e11 ")).toBe("E11");});
 it("valida códigos existentes (case-insensitive) y rechaza inexistentes",()=>{
  expect(isValidIcd10("E11")).toBe(true);
  expect(isValidIcd10("i10")).toBe(true);
  expect(isValidIcd10("XYZ.999")).toBe(false);
  expect(isValidIcd10("")).toBe(false);
 });
 it("lookup devuelve la descripción canónica",()=>{
  expect(lookupIcd10("I10")?.description).toBe("Hipertensión esencial (primaria)");
  expect(lookupIcd10("nope")).toBeUndefined();
 });
 it("búsqueda por código o texto, orden estable y con límite",()=>{
  expect(searchIcd10("diabetes").length).toBeGreaterThan(0);
  expect(searchIcd10("E11").every(e=>e.code.includes("E11"))).toBe(true);
  const codes=searchIcd10("E11").map(e=>e.code);
  expect(codes).toEqual([...codes].sort((a,b)=>a.localeCompare(b)));
  expect(searchIcd10("")).toEqual([]);
 });
});
