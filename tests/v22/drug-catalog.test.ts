import{describe,it,expect}from"vitest";
import{checkDrugAllergy,resolveDrug,checkContraindications,drugCatalog,interactionRules,checkInteractionSet,richInteractionRules}from"../../packages/drug-catalog/src";
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
 it("bloquea por REACTIVIDAD CRUZADA beta-lactámicos: alergia a penicilina (sin gravedad => grave) -> cefalexina",()=>{
  const r=checkDrugAllergy("cefalexina-500",["penicilina"]);
  expect(r.blocked).toBe(true);expect(r.via).toBe("cross");expect(r.severity).toBe("SEVERE");
 });
 // Auditoría 2026-09-19 (C-06): gravedad y tipo de reacción deciden; "AINE" resuelve contra los AINE comunes.
 it("alergia a AINE bloquea diclofenaco, meloxicam y metamizol (antes: diclofenaco no estaba en el catálogo -> 'sin conflicto')",()=>{
  for(const d of["diclofenaco-50","meloxicam-15","metamizol-500","celecoxib-200"])expect(checkDrugAllergy(d,[{substance:"AINE",severity:"SEVERE",reaction:"broncoespasmo"}]).blocked,d).toBe(true);
  expect(checkDrugAllergy("paracetamol-500",[{substance:"AINE",severity:"SEVERE"}]).blocked).toBe(false); // el paracetamol no es AINE
 });
 it("una INTOLERANCIA leve a penicilina NO bloquea las cefalosporinas: precaución con confirmación (antes bloqueaba)",()=>{
  const r=checkDrugAllergy("ceftriaxona-1g",[{substance:"penicilina",severity:"MILD",reaction:"náusea y vómito"}]);
  expect(r).toMatchObject({blocked:false,caution:true,via:"cross",severity:"MILD"});
 });
 it("una reacción anafiláctica es GRAVE aunque se haya registrado como leve (la reacción manda)",()=>{
  expect(checkDrugAllergy("ceftriaxona-1g",[{substance:"penicilina",severity:"MILD",reaction:"anafilaxia"}])).toMatchObject({blocked:true,severity:"SEVERE",via:"cross"});
 });
 it("MODERATE: bloquea misma clase y el mismo principio activo; precaución en cruzada",()=>{
  expect(checkDrugAllergy("amoxicilina-500",[{substance:"penicilina",severity:"MODERATE",reaction:"urticaria"}]).blocked).toBe(true);
  expect(checkDrugAllergy("ceftriaxona-1g",[{substance:"penicilina",severity:"MODERATE",reaction:"urticaria"}])).toMatchObject({blocked:false,caution:true});
 });
 it("el alérgeno puede ser un fármaco del catálogo: leve a naproxeno -> ibuprofeno con precaución; grave a amoxicilina -> cefalexina bloqueada",()=>{
  expect(checkDrugAllergy("ibuprofeno-400",[{substance:"naproxeno",severity:"MILD",reaction:"dispepsia"}])).toMatchObject({caution:true,via:"class"});
  expect(checkDrugAllergy("cefalexina-500",[{substance:"amoxicilina",severity:"SEVERE",reaction:"anafilaxia"}])).toMatchObject({blocked:true,via:"cross"});
 });
 it("con varias alergias gana la peor coincidencia",()=>{
  const r=checkDrugAllergy("ibuprofeno-400",[{substance:"naproxeno",severity:"MILD"},{substance:"AINE",severity:"SEVERE",reaction:"anafilaxia"}]);
  expect(r).toMatchObject({blocked:true,allergen:"AINE"});
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
import{checkRenalDosing}from"../../packages/drug-catalog/src";
describe("ajuste/contraindicación renal por eGFR (EPIC BM)",()=>{
 it("metformina + TFG<30 -> BLOCK",()=>{
  expect(checkRenalDosing("metformina-850",25)).toMatchObject({action:"BLOCK",threshold:30});
 });
 it("metformina TFG 30–45 -> CAUTION; TFG>=45 -> OK",()=>{
  expect(checkRenalDosing("metformina-850",40).action).toBe("CAUTION");
  expect(checkRenalDosing("metformina-850",60).action).toBe("OK");
 });
 it("AINE + TFG<30 -> BLOCK; AINE TFG>=30 -> OK",()=>{
  expect(checkRenalDosing("ibuprofeno-400",20).action).toBe("BLOCK");
  expect(checkRenalDosing("ibuprofeno-400",50).action).toBe("OK");
 });
 // Auditoría 2026-09-19 (C-03/C-05): "no pude evaluar" NUNCA es "OK". Este test antes fijaba el fallo abierto.
 it("fármaco en catálogo SIN regla renal -> NOT_COVERED (no es 'OK')",()=>{
  const r=checkRenalDosing("amoxicilina-500",10);
  expect(r.action).toBe("NOT_COVERED");expect(r.reason).toBe("NO_RENAL_RULE");
 });
 it("fármaco FUERA de catálogo -> NOT_EVALUATED (no es 'OK')",()=>{
  const r=checkRenalDosing("desconocido-xyz",10);
  expect(r.action).toBe("NOT_EVALUATED");expect(r.reason).toBe("DRUG_NOT_IN_CATALOG");
  // apixabán con TFG 15 era el caso real de la auditoría: devolvía {action:"OK"}.
  expect(checkRenalDosing("apixaban",15).action).toBe("NOT_EVALUATED");
 });
 it("las demás barreras declaran si pudieron evaluar",()=>{
  expect(checkInteractions("desconocido-xyz",["warfarina"])).toMatchObject({found:false,evaluated:false});
  expect(checkInteractions("ibuprofeno-400",["medicina-rara"])).toMatchObject({evaluated:true,unresolvedActive:["medicina-rara"]});
  expect(checkContraindications("desconocido-xyz",["N18.3"])).toMatchObject({found:false,evaluated:false});
  expect(checkDuplicateTherapy("desconocido-xyz",["ibuprofeno"])).toMatchObject({duplicate:false,evaluated:false});
  expect(checkDrugAllergy("desconocido-xyz",["AINE"])).toMatchObject({blocked:false,classEvaluated:false});
  expect(checkDrugAllergy("ibuprofeno-400",["penicilina"])).toMatchObject({blocked:false,classEvaluated:true});
 });
});

// EPIC AP/UI — catálogo determinista para la vista Medicamentos (drugCatalog + interactionRules).
describe("catálogo determinista para la UI (drugCatalog)",()=>{
 it("deduplica por principio activo y ordena alfabéticamente",()=>{
  const c=drugCatalog();
  expect(c.length).toBeGreaterThan(0);
  const ings=c.map(d=>d.ingredient);
  expect(new Set(ings).size).toBe(ings.length);           // sin duplicados (paracetamol/acetaminofen -> uno)
  expect(ings.includes("paracetamol")).toBe(true);
  expect(ings.includes("acetaminofen")).toBe(false);      // sinónimo colapsado al principio activo
  const sorted=[...ings].sort((a,b)=>a.localeCompare(b,"es"));
  expect(ings).toEqual(sorted);
 });
 it("cada ítem trae categoría, clases y reglas coherentes con el motor",()=>{
  const c=drugCatalog();
  const met=c.find(d=>d.ingredient==="metformina")!;
  expect(met.category).toMatch(/Antidiab/);
  expect(met.classes).toContain("BIGUANIDE");
  expect(met.monitoring.map(m=>m.kind)).toContain("MONITOR_RENAL");
  expect(met.renal?.blockBelow).toBe(30);                 // coherente con checkRenalDosing
  const amox=c.find(d=>d.ingredient==="amoxicilina")!;
  expect(amox.renal).toBeNull();                          // sin ajuste renal conocido
 });
 it("expone la matriz de interacciones por clase (>=1 regla MAJOR)",()=>{
  const r=interactionRules();
  expect(r.length).toBeGreaterThan(0);
  expect(r.some(x=>x.severity==="MAJOR")).toBe(true);
 });
});
// Auditoría 2026-09-19 (C-17): UNA sola tabla de interacciones; la barrera y la pestaña informativa no pueden divergir.
describe("interacciones: tabla única (C-17)",()=>{
 it("sertralina + tramadol: la BARRERA bloquea (antes solo lo detectaba la pestaña informativa)",()=>{
  const r=checkInteractions("tramadol-50",["sertralina-50"]);
  expect(r).toMatchObject({found:true,evaluated:true,severity:"MAJOR"});expect(r.note).toMatch(/serotonin/i);
 });
 it("pares clásicos que faltaban: warfarina + TMP-SMX, warfarina + macrólido, doble anticoagulante",()=>{
  expect(checkInteractions("trimetoprima-sulfametoxazol-800",["warfarina-5"])).toMatchObject({found:true,severity:"MAJOR"});
  expect(checkInteractions("azitromicina-500",["warfarina-5"])).toMatchObject({found:true,severity:"MAJOR"});
  expect(checkInteractions("rivaroxaban-20",["warfarina-5"])).toMatchObject({found:true,severity:"MAJOR"}); // CONTRAINDICATED -> bloquea
 });
 it("toda regla de la barrera existe en la tabla rica (derivación, no copia) y las MINOR no bloquean",()=>{
  const rich=richInteractionRules();const barrier=interactionRules();
  for(const b of barrier)expect(rich.some(r=>r.classA===b.classA&&r.classB===b.classB),`${b.classA}/${b.classB}`).toBe(true);
  expect(barrier.some(b=>(b as{severity:string}).severity==="MINOR")).toBe(false);
  expect(checkInteractions("tramadol-50",["ibuprofeno-400"]).found).toBe(false); // OPIOID+NSAID es MINOR: no interviene en la barrera
  expect(checkInteractionSet(["tramadol-50","ibuprofeno-400"]).findings.some(f=>f.severity==="MINOR")).toBe(true); // …pero sí se informa
 });
 it("adulto mayor: el factor ELDERLY ahora tiene reglas (AINE, opioide) y la barrera las devuelve",()=>{
  const r=checkInteractions("naproxeno-500",[],["ELDERLY"]);
  expect(r.factorHits?.some(f=>f.factor==="ELDERLY"&&f.severity==="MODERATE")).toBe(true);
  expect(checkInteractions("naproxeno-500",[]).factorHits).toBeUndefined();
 });
 it("embarazo + anticoagulante: contraindicado (faltaba)",()=>{
  expect(checkInteractionSet(["warfarina-5"],["embarazo"]).findings.some(f=>f.severity==="CONTRAINDICATED")).toBe(true);
 });
});
