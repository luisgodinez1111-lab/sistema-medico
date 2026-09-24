import{describe,it,expect}from"vitest";
import{isValidIcd10,lookupIcd10,searchIcd10,normalizeIcd10,catalogSize,icd10Matches,icd10Key,inValueSet,ICD10_VALUE_SETS,ICD10_VALUE_SET_VERSION}from"../../packages/terminology/src";
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

// Auditoría 2026-09-19, anexo R03 (R03-17): value sets versionados y criterios ALCANZABLES.
describe("value sets de CIE-10 para las escalas clínicas (R03-17)",()=>{
 it("el emparejado no depende del punto decimal ni de los espacios",()=>{
  for(const c of["I48","I48.0","i48,0","I 48.0","I480"])expect(icd10Matches(c,"I48"),c).toBe(true);
  expect(icd10Matches("I49","I48")).toBe(false);
  expect(icd10Matches("I4","I48")).toBe(false);
 });
 it("un patrón de menos de 3 caracteres no empareja nada (no es una categoría CIE-10)",()=>{
  expect(icd10Matches("I48.0","I4")).toBe(false);
  expect(icd10Matches("I48.0","I")).toBe(false);
 });
 it("los criterios incluyen los códigos que faltaban y que SÍ cuentan",()=>{
  expect(inValueSet(["Z86.7"],ICD10_VALUE_SETS.strokeOrTia)).toBe(true);   // antecedente de ECV = criterio S₂
  expect(inValueSet(["I11.0"],ICD10_VALUE_SETS.hypertension)).toBe(true);  // cardiopatía hipertensiva = HTA
  expect(inValueSet(["I11.0"],ICD10_VALUE_SETS.heartFailure)).toBe(true);  // …y con IC, también «C»
  expect(inValueSet(["E13.9"],ICD10_VALUE_SETS.diabetes)).toBe(true);
  expect(inValueSet(["I70.2"],ICD10_VALUE_SETS.vascularDisease)).toBe(true);
  expect(inValueSet(["J15.9"],ICD10_VALUE_SETS.pneumonia)).toBe(true);
  expect(inValueSet(["J44.9"],ICD10_VALUE_SETS.pneumonia)).toBe(false);    // EPOC no es neumonía
 });
 it("cada conjunto declara su criterio y el módulo su versión",()=>{
  expect(ICD10_VALUE_SET_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  for(const[k,v]of Object.entries(ICD10_VALUE_SETS)){
   expect(v.id,k).toMatch(/^VS-/);
   expect(v.criterion.length,k).toBeGreaterThan(20);
   expect(v.codes.length,k).toBeGreaterThan(0);
  }
 });
 it("TODO criterio implementado es alcanzable con el catálogo (no hay comprobaciones ciegas)",()=>{
  // El defecto: el criterio «ictus previo» (2 puntos, el de más peso del CHA₂DS₂-VASc) no tenía ningún código
  // registrable en el catálogo, así que nunca podía cumplirse en producción.
  // `searchIcd10("")` devuelve [] por diseño, así que el catálogo se recorre letra por letra.
  const catalogo=["a","b","d","e","f","g","i","j","k","m","n","o","z"].flatMap(l=>searchIcd10(l,1000)).map(e=>e.code);
  for(const[k,vs]of Object.entries(ICD10_VALUE_SETS)){
   expect(catalogo.some(c=>inValueSet([c],vs)),
    `el criterio «${k}» (${vs.criterion}) no tiene ningún código registrable en el catálogo: es una comprobación ciega`).toBe(true);
  }
 });
 it("la clave de emparejado y el normalizador de almacenamiento son funciones distintas y no se confunden",()=>{
  expect(icd10Key("i48.0")).toBe("I480");      // para comparar
  expect(normalizeIcd10("i48.0")).toBe("I48.0"); // para guardar (el código se lee como en el catálogo)
 });
});
