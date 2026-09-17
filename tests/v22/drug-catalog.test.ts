import{describe,it,expect}from"vitest";
import{checkDrugAllergy,resolveDrug}from"../../packages/drug-catalog/src";
describe("catálogo de fármacos + gate de alergia (EPIC AP)",()=>{
 it("resuelve el principio activo dentro del código",()=>{
  expect(resolveDrug("amoxicilina-500mg")?.ingredient).toBe("amoxicilina");
  expect(resolveDrug("xyz-desconocido")).toBeUndefined();
 });
 it("bloquea por principio activo exacto (compatibilidad con subcadena)",()=>{
  expect(checkDrugAllergy("amoxicilina-500",["amoxicilina"]).blocked).toBe(true);
 });
 it("bloquea por CLASE: alergia a penicilina -> amoxicilina (lo que la subcadena NO detectaba)",()=>{
  const r=checkDrugAllergy("amoxicilina-500",["penicilina"]);
  expect(r.blocked).toBe(true);expect(r.via).toBe("class");
 });
 it("bloquea por REACTIVIDAD CRUZADA beta-lactámicos: alergia a penicilina -> cefalexina",()=>{
  const r=checkDrugAllergy("cefalexina-500",["penicilina"]);
  expect(r.blocked).toBe(true);expect(r.via).toBe("class");
 });
 it("bloquea AINEs por clase: alergia a AINE -> ibuprofeno",()=>{
  expect(checkDrugAllergy("ibuprofeno-400",["AINE"]).blocked).toBe(true);
 });
 it("NO bloquea sin conflicto: alergia a sulfa -> amoxicilina",()=>{
  expect(checkDrugAllergy("amoxicilina-500",["sulfa"]).blocked).toBe(false);
 });
 it("NO bloquea sin alergias",()=>{expect(checkDrugAllergy("cefalexina-500",[]).blocked).toBe(false);});
});
import{checkDuplicateTherapy}from"../../packages/drug-catalog/src";
describe("duplicación terapéutica (EPIC AW)",()=>{
 it("bloquea dos AINE (misma clase NSAID)",()=>{
  const r=checkDuplicateTherapy("ibuprofeno-400",["naproxeno-500"]);
  expect(r.duplicate).toBe(true);expect(r.sharedClass).toBe("NSAID");
 });
 it("bloquea dos beta-lactámicos (amoxicilina + cefalexina por reactividad de clase)",()=>{
  expect(checkDuplicateTherapy("amoxicilina-500",["cefalexina-500"]).duplicate).toBe(true);
 });
 it("NO bloquea clases distintas (AINE + antibiótico)",()=>{
  expect(checkDuplicateTherapy("ibuprofeno-400",["amoxicilina-500"]).duplicate).toBe(false);
 });
 it("NO se compara consigo mismo ni con lista vacía",()=>{
  expect(checkDuplicateTherapy("ibuprofeno-400",["ibuprofeno-400"]).duplicate).toBe(false);
  expect(checkDuplicateTherapy("ibuprofeno-400",[]).duplicate).toBe(false);
 });
});
import{checkInteractions}from"../../packages/drug-catalog/src";
describe("interacciones farmacológicas (EPIC AX)",()=>{
 it("anticoagulante + AINE -> MAJOR (hemorragia)",()=>{
  const r=checkInteractions("ibuprofeno-400",["warfarina-5"]);
  expect(r.found).toBe(true);expect(r.severity).toBe("MAJOR");
 });
 it("IECA + ahorrador de potasio -> MAJOR (hiperkalemia)",()=>{
  expect(checkInteractions("espironolactona-25",["enalapril-10"]).severity).toBe("MAJOR");
 });
 it("IECA + ARA-II -> MODERATE (doble bloqueo SRAA)",()=>{
  expect(checkInteractions("losartan-50",["enalapril-10"])).toMatchObject({found:true,severity:"MODERATE"});
 });
 it("sin interacción entre clases no relacionadas",()=>{
  expect(checkInteractions("amoxicilina-500",["metformina-850"]).found).toBe(false);
  expect(checkInteractions("ibuprofeno-400",[]).found).toBe(false);
 });
});
