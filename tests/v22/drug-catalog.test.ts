import{describe,it,expect}from"vitest";
import{checkDrugAllergy,resolveDrug,checkContraindications}from"../../packages/drug-catalog/src";
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
describe("contraindicación fármaco–condición (EPIC AY)",()=>{
 it("AINE + ERC (N18.3) -> MAJOR (bloquea)",()=>{
  const r=checkContraindications("ibuprofeno-400",["N18.3"]);
  expect(r).toMatchObject({found:true,severity:"MAJOR"});expect(r.condition).toBe("N18.3");
 });
 it("AINE + insuficiencia cardíaca (I50.9) -> MAJOR",()=>{
  expect(checkContraindications("naproxeno-500",["I50.9"]).severity).toBe("MAJOR");
 });
 it("AINE + gastritis (K29.70) -> MODERATE (alerta, no bloquea)",()=>{
  expect(checkContraindications("ketorolaco-30",["K29.70"])).toMatchObject({found:true,severity:"MODERATE"});
 });
 it("metformina + ERC (N18.3) -> MODERATE (precaución por TFG)",()=>{
  expect(checkContraindications("metformina-850",["N18.3"]).severity).toBe("MODERATE");
 });
 it("prioriza MAJOR sobre MODERATE cuando coexisten condiciones",()=>{
  expect(checkContraindications("ibuprofeno-400",["K29.70","N18.3"]).severity).toBe("MAJOR");
 });
 it("sin condición contraindicante -> permitido",()=>{
  expect(checkContraindications("ibuprofeno-400",["E11.9","I10"]).found).toBe(false);
  expect(checkContraindications("amoxicilina-500",["N18.3"]).found).toBe(false);
 });
});
import{monitoringFor}from"../../packages/drug-catalog/src";
describe("requisitos de monitoreo por fármaco (EPIC BA)",()=>{
 it("anticoagulante -> MONITOR_INR a 3 días",()=>{
  const r=monitoringFor("warfarina-5");
  expect(r).toHaveLength(1);expect(r[0]).toMatchObject({kind:"MONITOR_INR",dueInDays:3});
 });
 it("biguanida -> MONITOR_RENAL; IECA -> MONITOR_K_CREAT",()=>{
  expect(monitoringFor("metformina-850")[0]?.kind).toBe("MONITOR_RENAL");
  expect(monitoringFor("enalapril-10")[0]?.kind).toBe("MONITOR_K_CREAT");
 });
 it("fármaco sin requisito de monitoreo -> vacío",()=>{
  expect(monitoringFor("ibuprofeno-400")).toEqual([]);
  expect(monitoringFor("amoxicilina-500")).toEqual([]);
  expect(monitoringFor("desconocido-xyz")).toEqual([]);
 });
});
