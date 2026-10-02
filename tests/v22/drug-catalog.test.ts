import{describe,it,expect}from"vitest";
import{checkDrugAllergy,resolveDrug,checkContraindications,drugCatalog,interactionRules,checkInteractionSet,richInteractionRules,catalogCoverage}from"../../packages/drug-catalog/src";
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
  expect(r).toMatchObject({blocked:false,caution:true,via:"cross-r1-differs",severity:"MILD"});
  // Y una intolerancia leve tampoco bloquea donde el R1 SÍ coincide: solo eleva a precaución.
  expect(checkDrugAllergy("cefalexina-500",[{substance:"penicilina",severity:"MILD",reaction:"náusea"}])).toMatchObject({blocked:false,caution:true,via:"cross"});
 });
 it("una reacción anafiláctica es GRAVE aunque se haya registrado como leve (la reacción manda)",()=>{
  // El objetivo del test es la ESCALADA por la reacción descrita, así que se comprueba sobre un fármaco que sí comparte
  // cadena lateral R1 (cefalexina). Con ceftriaxona, desde R03-24, ni una anafilaxia bloquea: ver el bloque de R1.
  expect(checkDrugAllergy("cefalexina-500",[{substance:"penicilina",severity:"MILD",reaction:"anafilaxia"}])).toMatchObject({blocked:true,severity:"SEVERE",via:"cross"});
 });
 it("MODERATE: bloquea misma clase y el mismo principio activo; precaución en cruzada",()=>{
  expect(checkDrugAllergy("amoxicilina-500",[{substance:"penicilina",severity:"MODERATE",reaction:"urticaria"}]).blocked).toBe(true);
  expect(checkDrugAllergy("ceftriaxona-1g",[{substance:"penicilina",severity:"MODERATE",reaction:"urticaria"}])).toMatchObject({blocked:false,caution:true,via:"cross-r1-differs"});
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
 // Ampliación 2026 — pares de alto valor con ambos fármacos en el catálogo.
 it("ciprofloxacino + teofilina/clozapina (CYP1A2) -> MAJOR; clopidogrel + anticoagulante -> MAJOR",()=>{
  expect(checkInteractions("ciprofloxacino-500",["teofilina-300"])).toMatchObject({found:true,severity:"MAJOR"});
  expect(checkInteractions("ciprofloxacino-500",["clozapina-100"]).severity).toBe("MAJOR");
  expect(checkInteractions("clopidogrel-75",["warfarina-5"]).severity).toBe("MAJOR");
  expect(checkInteractions("ciprofloxacino-500",["warfarina-5"]).severity).toBe("MAJOR");
 });
 it("prednisona + AINE, ARA-II + AINE, omeprazol + clopidogrel y digoxina + furosemida -> MODERATE",()=>{
  expect(checkInteractions("prednisona-5",["ibuprofeno-400"])).toMatchObject({found:true,severity:"MODERATE"});
  expect(checkInteractions("losartan-50",["naproxeno-500"]).severity).toBe("MODERATE");
  expect(checkInteractions("omeprazol-20",["clopidogrel-75"]).severity).toBe("MODERATE");
  expect(checkInteractions("digoxina-0.25",["furosemida-40"]).severity).toBe("MODERATE");
 });
 it("verapamilo/diltiazem + betabloqueador -> MAJOR; + estatina -> MODERATE (fármacos de la ampliación)",()=>{
  expect(checkInteractions("verapamilo-80",["metoprolol-50"]).severity).toBe("MAJOR");
  expect(checkInteractions("diltiazem-60",["atenolol-50"]).severity).toBe("MAJOR");
  expect(checkInteractions("verapamilo-80",["simvastatina-20"]).severity).toBe("MODERATE");
  // y los nuevos ARA-II/IECA/SNRI heredan las reglas de su clase
  expect(checkInteractions("valsartan-80",["espironolactona-25"]).severity).toBe("MAJOR"); // ARB + ahorrador de K
  expect(checkInteractions("venlafaxina-75",["fluoxetina-20"]).severity).toBe("MAJOR");     // doble serotoninérgico
 });
 it("lote 2: nitrato+PDE5 y azol+estatina/anticoagulante y litio+AINE/IECA/tiazida son de alta severidad",()=>{
  expect(checkInteractions("sildenafil-50",["isosorbide-20"]).found,"nitrato+PDE5").toBe(true);
  expect(checkInteractions("fluconazol-150",["simvastatina-20"]).severity).toBe("MAJOR");
  expect(checkInteractions("fluconazol-150",["warfarina-5"]).severity).toBe("MAJOR");
  expect(checkInteractions("litio-300",["ibuprofeno-400"]).severity).toBe("MAJOR");
  expect(checkInteractions("litio-300",["enalapril-10"]).severity).toBe("MAJOR");
  expect(checkInteractions("litio-300",["hidroclorotiazida-25"]).severity).toBe("MAJOR");
  expect(checkInteractions("carbamazepina-200",["etinilestradiol-30"]).severity).toBe("MAJOR"); // fallo anticonceptivo
  expect(checkInteractions("gentamicina-240",["furosemida-40"]).severity).toBe("MODERATE");     // oto/nefrotoxicidad
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
 it("AINE + gastritis (K29.7) -> MODERATE (alerta, no bloquea)",()=>{
  expect(checkContraindications("ketorolaco-30",["K29.7"])).toMatchObject({found:true,severity:"MODERATE"});
 });
 it("metformina + ERC (N18.3) -> MODERATE (precaución por TFG)",()=>{
  expect(checkContraindications("metformina-850",["N18.3"]).severity).toBe("MODERATE");
 });
 it("prioriza MAJOR sobre MODERATE cuando coexisten condiciones",()=>{
  expect(checkContraindications("ibuprofeno-400",["K29.7","N18.3"]).severity).toBe("MAJOR");
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
 it("AINE + TFG<30 -> BLOCK; TFG 30–60 -> precaución (KDIGO); TFG>=60 -> OK",()=>{
  expect(checkRenalDosing("ibuprofeno-400",20).action).toBe("BLOCK");
  expect(checkRenalDosing("ibuprofeno-400",50).action).toBe("CAUTION"); // C-15: antes OK
  expect(checkRenalDosing("ibuprofeno-400",70).action).toBe("OK");
 });
 // Auditoría 2026-09-19 (C-03/C-05, C-15): "no pude evaluar" NUNCA es "OK"; y ahora todo el catálogo tiene regla renal
 // (amoxicilina con TFG 10 exige alargar el intervalo: precaución, no 'sin regla').
 it("amoxicilina con TFG 10 -> precaución con nota; con TFG 80 -> OK",()=>{
  const r=checkRenalDosing("amoxicilina-500",10);expect(r.action).toBe("CAUTION");expect(r.note).toMatch(/intervalo/);
  expect(checkRenalDosing("amoxicilina-500",80).action).toBe("OK");
 });
 it("fármaco FUERA de catálogo -> NOT_EVALUATED (no es 'OK')",()=>{
  const r=checkRenalDosing("desconocido-xyz",10);
  expect(r.action).toBe("NOT_EVALUATED");expect(r.reason).toBe("DRUG_NOT_IN_CATALOG");
  // apixabán con TFG 15 era el caso real de la auditoría: devolvía {action:"OK"}. Entró al catálogo en el lote 11f con
  // su propia regla, así que ahora la respuesta es la clínicamente correcta (reducir dosis), no un "no evaluado".
  expect(checkRenalDosing("apixaban",15).action).toBe("CAUTION");
  expect(checkRenalDosing("apixaban",10).action).toBe("BLOCK");
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
  expect(amox.renal?.cautionBelow).toBe(30);              // C-15: penicilinas alargan intervalo con TFG<30
  const riva=c.find(d=>d.ingredient==="rivaroxaban")!;const warf=c.find(d=>d.ingredient==="warfarina")!;
  expect(riva.renal?.blockBelow).toBe(15);expect(warf.renal?.noAdjustment).toBe(true); // el ingrediente manda sobre la clase
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
// Auditoría 2026-09-19 (C-15): ajuste renal para todo el catálogo (antes 2 clases de 27) y techos con "N tab".
describe("ajuste renal ampliado (C-15)",()=>{
 it("los casos de la auditoría ya no salen OK: rivaroxabán TFG 15 -> precaución (y <15 bloquea); espironolactona TFG 20 -> BLOQUEA; enalapril TFG 15 -> precaución",()=>{
  expect(checkRenalDosing("rivaroxaban-20",15).action).toBe("CAUTION");expect(checkRenalDosing("rivaroxaban-20",10).action).toBe("BLOCK");
  expect(checkRenalDosing("espironolactona-25",20).action).toBe("BLOCK");
  expect(checkRenalDosing("enalapril-10",15).action).toBe("CAUTION");
 });
 it("la regla del ingrediente manda sobre la de su clase: warfarina (sin ajuste, OK revisado) ≠ rivaroxabán",()=>{
  const w=checkRenalDosing("warfarina-5",15);expect(w.action).toBe("OK");expect(w.note).toMatch(/INR/);
  expect(checkRenalDosing("ceftriaxona-1g",20).action).toBe("OK");expect(checkRenalDosing("cefalexina-500",40).action).toBe("CAUTION");
 });
 it("ningún fármaco del catálogo queda sin regla renal (NOT_COVERED solo para lo no revisado)",async()=>{
  const{drugCatalog}=await import("../../packages/drug-catalog/src");
  const uncovered=drugCatalog().map(d=>d.code).filter(c=>checkRenalDosing(c,10).action==="NOT_COVERED");
  expect(uncovered).toEqual([]);
 });
});

// Auditoría 2026-09-19, anexo R03 — R03-23 (cobertura declarada), R03-24 (cadena lateral R1 y sulfonamidas),
// R03-25 (pares que faltaban, con fuente) y F13 (clase QT, que no existía en el repositorio).
describe("reactividad cruzada betalactámica por cadena lateral R1 (R03-24)",()=>{
 it("comparten R1: amoxicilina/ampicilina ↔ cefalexina, cefadroxilo, cefaclor -> cruzada real",()=>{
  for(const c of["cefalexina-500","cefadroxilo-500","cefaclor-500"])
   expect(checkDrugAllergy(c,[{substance:"amoxicilina",severity:"SEVERE"}]),c).toMatchObject({blocked:true,via:"cross"});
 });
 it("NO comparten R1: ceftriaxona, cefotaxima, cefepima y cefuroxima -> precaución con la evidencia citada",()=>{
  for(const c of["ceftriaxona-1g","cefotaxima-1g","cefepima-1g","cefuroxima-500"]){
   const r=checkDrugAllergy(c,[{substance:"penicilina",severity:"SEVERE",reaction:"anafilaxia"}]);
   expect(r.blocked,c).toBe(false);
   expect(r.caution,c).toBe(true);
   expect(r.via,c).toBe("cross-r1-differs");
   expect(r.detail,c).toMatch(/Shenoy, JAMA 2019/);
  }
 });
 it("dentro de las cefalosporinas, el R1 compartido sí cruza (ceftriaxona ↔ cefotaxima ↔ cefepima)",()=>{
  expect(checkDrugAllergy("cefotaxima-1g",[{substance:"ceftriaxona",severity:"SEVERE"}]).blocked).toBe(true);
 });
 it("la misma CLASE sigue bloqueando (penicilina -> amoxicilina no es cruzada, es la misma clase)",()=>{
  expect(checkDrugAllergy("amoxicilina-500",["penicilina"])).toMatchObject({blocked:true,via:"class"});
 });
});

describe("sulfonamidas: antibiótica vs no antibiótica (R03-24)",()=>{
 it("una alergia a «sulfas» NO bloquea furosemida, hidroclorotiazida ni glibenclamida",()=>{
  // Antes esto era correcto POR ACCIDENTE: esos fármacos no estaban en el catálogo. Ahora están y la regla es explícita.
  for(const d of["furosemida-40","hidroclorotiazida-25","glibenclamida-5","acetazolamida-250","celecoxib-200"])
   expect(checkDrugAllergy(d,[{substance:"sulfa",severity:"SEVERE",reaction:"exantema"}]).blocked,d).toBe(false);
 });
 it("y sí bloquea el antibiótico (trimetoprima-sulfametoxazol)",()=>{
  expect(checkDrugAllergy("sulfametoxazol-800",[{substance:"sulfa",severity:"SEVERE"}]).blocked).toBe(true);
  expect(checkDrugAllergy("trimetoprima-sulfametoxazol",[{substance:"sulfa",severity:"SEVERE"}]).blocked).toBe(true);
 });
});

describe("interacciones que el anexo probó vacías (R03-25) y la clase QT (F13)",()=>{
 const pares:readonly[string,string,"MAJOR"|"MODERATE"][]=[
  ["warfarina","sulfametoxazol","MAJOR"],      // CYP2C9: alza masiva del INR
  ["warfarina","azitromicina","MAJOR"],
  ["warfarina","rivaroxaban","MAJOR"],         // doble anticoagulación
  ["espironolactona","sulfametoxazol","MAJOR"],// hiperkalemia (BMJ 2011)
  ["enalapril","sulfametoxazol","MAJOR"],
  ["losartan","sulfametoxazol","MAJOR"],
  ["aspirina","ibuprofeno","MODERATE"],        // antagonismo de la cardioprotección
  ["citalopram","azitromicina","MAJOR"],       // QT aditivo
  ["warfarina","paracetamol","MODERATE"],
  ["claritromicina","atorvastatina","MAJOR"],  // rabdomiólisis
  ["clonazepam","tramadol","MAJOR"],           // depresión respiratoria (boxed warning FDA)
  ["digoxina","claritromicina","MODERATE"],
 ];
 it("los doce pares producen hallazgo en la BARRERA (no solo en la pestaña informativa)",()=>{
  for(const[a,b,sev]of pares){
   const h=checkInteractions(a,[b]);
   expect(h.found,`${a} + ${b}`).toBe(true);
   expect(h.severity,`${a} + ${b}`).toBe(sev);
  }
 });
 it("y son simétricos (da igual cuál se prescribe)",()=>{
  for(const[a,b]of pares)expect(checkInteractions(b,[a]).found,`${b} + ${a}`).toBe(true);
 });
 it("la clase QT existe y es aditiva entre sí (antes `grep QT` no encontraba nada)",()=>{
  const qt=["citalopram","escitalopram","azitromicina","claritromicina","amiodarona","ondansetron","haloperidol","levofloxacino","ciprofloxacino"];
  for(const d of qt)expect(resolveDrug(d)?.classes,d).toContain("QT_PROLONGING");
  const h=checkInteractions("ondansetron",["amiodarona"]);
  expect(h.found).toBe(true);expect(h.severity).toBe("MAJOR");
  expect(h.note).toMatch(/torsades/i);
 });
 it("TODA fila de interacción declara fuente y fecha de revisión",()=>{
  for(const r of richInteractionRules()){
   expect(r.source,`${r.classA}+${r.classB}`).toBeTruthy();
   expect(r.source.length,`${r.classA}+${r.classB}`).toBeGreaterThan(20);
   expect(r.reviewedAt,`${r.classA}+${r.classB}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
 });
});

describe("cobertura del catálogo declarada (R03-23)",()=>{
 it("la cobertura se CALCULA de las tablas (no puede quedar obsoleta) y dice qué NO es",()=>{
  const c=catalogCoverage();
  expect(c.ingredients).toBe(drugCatalog().length);
  expect(c.ingredients).toBeGreaterThanOrEqual(60);   // eran 27 en la auditoría
  expect(c.interactionPairs).toBe(richInteractionRules().length);
  expect(c.renalRulesByIngredient).toBeGreaterThanOrEqual(50);
  expect(c.sourceNote).toMatch(/NO es un vademécum oficial/);
  expect(c.sourceNote).toMatch(/NOT_EVALUATED/);
  expect(c.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
 });
 it("los diez fármacos que el anexo probó fuera del catálogo ya están dentro (o siguen declarados como fuera)",()=>{
  // Los AINE entraron en C-06; el resto en 11f. Lo que NO puede pasar es que un fármaco ausente devuelva un veredicto
  // de seguridad: eso lo fija `INV-CORE-0009` con un fármaco realmente ausente.
  for(const d of["diclofenaco","meloxicam","apixaban","clonazepam","digoxina","levotiroxina","furosemida","atorvastatina","insulina glargina","amiodarona"])
   expect(resolveDrug(d),d).toBeDefined();
 });
 it("ningún fármaco del catálogo queda sin revisión renal (invariante del lote C-15, mantenido tras ampliarlo)",()=>{
  const sinRegla=drugCatalog().map(d=>d.ingredient).filter(i=>checkRenalDosing(i,10).action==="NOT_COVERED");
  expect(sinRegla).toEqual([]);
 });
 it("una regla de ingrediente con umbrales no RELAJA la de su clase (solo `noAdjustment` es exención explícita)",()=>{
  // cefalexina declara TFG<30 y su clase CEPHALOSPORIN declara TFG<50: manda la más severa.
  expect(checkRenalDosing("cefalexina-500",40).action).toBe("CAUTION");
  // ceftriaxona sí está exenta explícitamente aunque sea cefalosporina.
  expect(checkRenalDosing("ceftriaxona-1g",20).action).toBe("OK");
 });
});

// Auditoría 2026-09-19, anexo R03 (vector F10): el monitoreo cubría 5 clases y el INR se pedía a pacientes con ACOD.
describe("monitoreo por clase ampliado (R03-F10)",()=>{
 it("cada fármaco con vigilancia estándar la declara, con prueba y plazo",()=>{
  const esperado:readonly[string,RegExp][]=[
   ["warfarina",/INR/],["apixaban",/Creatinina/],["atorvastatina",/ALT/],["sertralina",/Sodio/],
   ["amiodarona",/TSH/],["digoxina",/Digoxinemia/],["levotiroxina",/TSH/],["metamizol",/Hemograma/],
   ["prednisona",/Glucosa/],["furosemida",/potasio/],["glibenclamida",/Glucosa/],["levofloxacino",/QT/],
  ];
  for(const[d,re]of esperado){
   const m=monitoringFor(d);
   expect(m.length,`${d} sin monitoreo`).toBeGreaterThan(0);
   expect(m.map(x=>x.test).join(" | "),d).toMatch(re);
   for(const r of m)expect(r.dueInDays,`${d}: plazo no declarado`).toBeGreaterThan(0);
  }
 });
 it("el INR NO se pide para un ACOD (contradecía lo que dice la propia interpretación del INR)",()=>{
  for(const d of["apixaban","rivaroxaban","dabigatran"]){
   const pruebas=monitoringFor(d).map(m=>m.test).join(" ");
   expect(pruebas,`${d} pide INR`).not.toMatch(/INR/);
   expect(pruebas,`${d} sin vigilancia renal`).toMatch(/Creatinina/);
  }
  expect(monitoringFor("warfarina").map(m=>m.test).join(" ")).toMatch(/INR/);
 });
 it("un fármaco sin vigilancia conocida devuelve lista vacía (no se inventa una)",()=>{
  expect(monitoringFor("paracetamol")).toEqual([]);
 });
});
