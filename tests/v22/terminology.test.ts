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
// Auditoría 2026-09-19 (U-13, K-04): en México rige la CIE-10 de la OMS (NOM-024), no la ICD-10-CM de EE. UU.
describe("CIE-10 OMS, no ICD-10-CM",()=>{
 it("todos los códigos tienen formato OMS (categoría de 3 o subcategoría de 4 caracteres); ninguno de 5–7 caracteres",()=>{
  const codes=searchIcd10("",1000).length?searchIcd10("",1000):[];void codes;
  for(const q of["a","e","i","j","k","f","z","m","n","r","g","o"])for(const e of searchIcd10(q,1000))expect(e.code,e.code).toMatch(/^[A-Z]\d{2}(\.\d)?$/);
  for(const cm of["E11.65","J45.909","K29.70","I25.10","I48.91","F17.210","Z00.00"])expect(isValidIcd10(cm),cm).toBe(false);
  for(const who of["J45.9","K29.7","I25.1","I48.9","E11.2","Z00.0"])expect(isValidIcd10(who),who).toBe(true);
 });
});
