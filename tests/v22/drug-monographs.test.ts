import{describe,it,expect}from"vitest";
import{drugMonographCount,drugMonograph,searchMonographs,normDrug}from"../../packages/drug-catalog/src/monographs";
import{drugBrandCount,brandsForIngredient,searchBrands,allBrands}from"../../packages/drug-catalog/src/brands";
// Fase 1-2 del catálogo de medicamentos: monografías REALES por sustancia (Vademecum) + marcas comerciales curadas (México).
// La clínica (acción/indicaciones/contraindicaciones) viene de la sustancia; las marcas solo enlazan marca→principio activo.
describe("monografías de sustancias (Vademecum)",()=>{
 it("hay un catálogo amplio de sustancias con monografía",()=>{
  expect(drugMonographCount()).toBeGreaterThan(1000);
 });
 it("una sustancia común trae acción, indicaciones y contraindicaciones reales",()=>{
  const m=drugMonograph("ibuprofeno");
  expect(m,"ibuprofeno debe estar").toBeTruthy();
  expect(m!.action.length).toBeGreaterThan(0);
  expect(m!.indications.length).toBeGreaterThan(0);
  expect(m!.contraindications.length).toBeGreaterThan(0);
 });
 it("la búsqueda es insensible a acentos y busca por indicación",()=>{
  expect(searchMonographs("hipertension").length,"por indicación, sin acento").toBeGreaterThan(0);
  expect(searchMonographs("omeprazol").some(m=>normDrug(m.name)==="omeprazol")).toBe(true);
 });
});
describe("marcas comerciales curadas (México)",()=>{
 it("hay un set de marcas y todas enlazan a un principio activo",()=>{
  expect(drugBrandCount()).toBeGreaterThan(100);
  for(const b of allBrands()){
   expect(b.brand.trim().length,`marca vacía`).toBeGreaterThan(0);
   expect(b.ingredient.trim().length,`${b.brand} sin principio activo`).toBeGreaterThan(0);
  }
 });
 it("marca→principio activo correcto (Tempra→paracetamol, Advil→ibuprofeno)",()=>{
  expect(brandsForIngredient("paracetamol").map(b=>b.brand)).toContain("Tempra");
  expect(searchBrands("advil")[0]?.ingredient).toBe("ibuprofeno");
  expect(searchBrands("nexium")[0]?.ingredient).toBe("esomeprazol");
 });
 it("la mayoría de las marcas resuelven a una monografía real (detecta typos del principio activo)",()=>{
  const bs=allBrands();
  const conMono=bs.filter(b=>drugMonograph(b.ingredient)).length;
  // No exigimos 100% (hay combinaciones/insumos sin monografía individual), pero sí una mayoría clara.
  expect(conMono/bs.length,`solo ${conMono}/${bs.length} marcas enlazan a monografía`).toBeGreaterThan(0.7);
 });
});
