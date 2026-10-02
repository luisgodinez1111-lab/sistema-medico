// EPIC AP — Catálogo de fármacos + verificación de alergia por clase y REACTIVIDAD CRUZADA (PROFUNDIDAD/seguridad).
// Reemplaza el match por subcadena (frágil) por match de principio activo + clase de alérgeno, incluyendo
// reactividad cruzada beta-lactámicos (una alergia a penicilina bloquea también cefalosporinas). Puro, sin PHI.
// Subconjunto de demostración; el catálogo oficial (p. ej. RxNorm/COFEPRIS) se cargaría de la fuente autorizada.
// Autoridad: PROD (seguridad de la prescripción / alertas de alergia), CAP-DRUG-ALLERGY-001.
export type DrugEntry=Readonly<{ingredient:string;classes:readonly string[];r1?:string}>;
// clave = principio activo normalizado (lowercase, sin acentos). classes = grupos de alérgenos.
const DRUGS:Record<string,DrugEntry>={
 "amoxicilina":{ingredient:"amoxicilina",classes:["PENICILLIN","BETA_LACTAM"],r1:"AMINOBENZYL"},
 "ampicilina":{ingredient:"ampicilina",classes:["PENICILLIN","BETA_LACTAM"],r1:"AMINOBENZYL"},
 // «Penicilina» a secas es lo que el paciente refiere y NO dice de qué penicilina se trata: se marca como no
 // especificada, y el emparejado por R1 la trata como si pudiera ser una aminopenicilina (amoxicilina/ampicilina son
 // las de uso masivo). Bencilpenicilina y fenoximetilpenicilina, cuando se nombran con precisión, sí tienen su R1.
 "penicilina":{ingredient:"penicilina",classes:["PENICILLIN","BETA_LACTAM"],r1:"PENICILLIN_UNSPECIFIED"},
 "bencilpenicilina":{ingredient:"bencilpenicilina",classes:["PENICILLIN","BETA_LACTAM"],r1:"BENZYL"},
 "penicilina g":{ingredient:"bencilpenicilina",classes:["PENICILLIN","BETA_LACTAM"],r1:"BENZYL"},
 "dicloxacilina":{ingredient:"dicloxacilina",classes:["PENICILLIN","BETA_LACTAM"],r1:"ISOXAZOLYL"},
 "cefalexina":{ingredient:"cefalexina",classes:["CEPHALOSPORIN","BETA_LACTAM"],r1:"AMINOBENZYL"},
 "cefadroxilo":{ingredient:"cefadroxilo",classes:["CEPHALOSPORIN","BETA_LACTAM"],r1:"AMINOBENZYL"},
 "cefaclor":{ingredient:"cefaclor",classes:["CEPHALOSPORIN","BETA_LACTAM"],r1:"AMINOBENZYL"},
 "ceftriaxona":{ingredient:"ceftriaxona",classes:["CEPHALOSPORIN","BETA_LACTAM"],r1:"AMINOTHIAZOLYL_METHOXYIMINO"},
 "cefotaxima":{ingredient:"cefotaxima",classes:["CEPHALOSPORIN","BETA_LACTAM"],r1:"AMINOTHIAZOLYL_METHOXYIMINO"},
 "cefepima":{ingredient:"cefepima",classes:["CEPHALOSPORIN","BETA_LACTAM"],r1:"AMINOTHIAZOLYL_METHOXYIMINO"},
 "cefuroxima":{ingredient:"cefuroxima",classes:["CEPHALOSPORIN","BETA_LACTAM"],r1:"FURANYL_METHOXYIMINO"},
 "paracetamol":{ingredient:"paracetamol",classes:["ANALGESIC_ANTIPYRETIC"]},
 "acetaminofen":{ingredient:"paracetamol",classes:["ANALGESIC_ANTIPYRETIC"]},
 "ibuprofeno":{ingredient:"ibuprofeno",classes:["NSAID"]},
 "naproxeno":{ingredient:"naproxeno",classes:["NSAID"]},
 "ketorolaco":{ingredient:"ketorolaco",classes:["NSAID"]},
 "aspirina":{ingredient:"aspirina",classes:["NSAID","SALICYLATE"]},
 // Auditoría C-06: AINE de uso corriente en México que faltaban (la alergia a "AINE" no podía resolverse contra ellos).
 "diclofenaco":{ingredient:"diclofenaco",classes:["NSAID"]},
 "diclofenac":{ingredient:"diclofenaco",classes:["NSAID"]},
 "meloxicam":{ingredient:"meloxicam",classes:["NSAID"]},
 "piroxicam":{ingredient:"piroxicam",classes:["NSAID"]},
 "indometacina":{ingredient:"indometacina",classes:["NSAID"]},
 "celecoxib":{ingredient:"celecoxib",classes:["NSAID","COX2_SELECTIVE"]},
 "etoricoxib":{ingredient:"etoricoxib",classes:["NSAID","COX2_SELECTIVE"]},
 "metamizol":{ingredient:"metamizol",classes:["NSAID","PYRAZOLONE"]}, // dipirona: hipersensibilidad cruzada con AINE
 "dipirona":{ingredient:"metamizol",classes:["NSAID","PYRAZOLONE"]},
 "sulfametoxazol":{ingredient:"sulfametoxazol",classes:["SULFONAMIDE","SULFONAMIDE_ANTIBIOTIC"]},
 "trimetoprima-sulfametoxazol":{ingredient:"sulfametoxazol",classes:["SULFONAMIDE","SULFONAMIDE_ANTIBIOTIC"]},
 "sulfadiazina":{ingredient:"sulfadiazina",classes:["SULFONAMIDE","SULFONAMIDE_ANTIBIOTIC"]},
 // Auditoría R03-24: las sulfonamidas NO antibióticas (diuréticos, sulfonilureas, celecoxib, acetazolamida) no
 // comparten el grupo arilamina responsable de la hipersensibilidad, y la evidencia no sostiene la reactividad cruzada
 // (Strom BL et al., N Engl J Med 2003;349:1628-35). Que furosemida no se bloqueara con una alergia a «sulfa» era
 // correcto POR ACCIDENTE —no estaba en el catálogo—; ahora está y la regla es explícita.
 "furosemida":{ingredient:"furosemida",classes:["LOOP_DIURETIC","SULFONAMIDE_NON_ANTIBIOTIC"]},
 "hidroclorotiazida":{ingredient:"hidroclorotiazida",classes:["THIAZIDE","SULFONAMIDE_NON_ANTIBIOTIC"]},
 "clortalidona":{ingredient:"clortalidona",classes:["THIAZIDE","SULFONAMIDE_NON_ANTIBIOTIC"]},
 "glibenclamida":{ingredient:"glibenclamida",classes:["SULFONYLUREA","SULFONAMIDE_NON_ANTIBIOTIC"]},
 "glimepirida":{ingredient:"glimepirida",classes:["SULFONYLUREA","SULFONAMIDE_NON_ANTIBIOTIC"]},
 "acetazolamida":{ingredient:"acetazolamida",classes:["CARBONIC_ANHYDRASE_INHIBITOR","SULFONAMIDE_NON_ANTIBIOTIC"]},
 "azitromicina":{ingredient:"azitromicina",classes:["MACROLIDE","QT_PROLONGING"]},
 "clindamicina":{ingredient:"clindamicina",classes:["LINCOSAMIDE"]},
 // — Fármacos con interacciones relevantes (EPIC AX) —
 "warfarina":{ingredient:"warfarina",classes:["ANTICOAGULANT","VKA"]},
 "acenocumarol":{ingredient:"acenocumarol",classes:["ANTICOAGULANT","VKA"]},
 "rivaroxaban":{ingredient:"rivaroxaban",classes:["ANTICOAGULANT","DOAC"]},
 "enalapril":{ingredient:"enalapril",classes:["ACE_INHIBITOR"]},
 "lisinopril":{ingredient:"lisinopril",classes:["ACE_INHIBITOR"]},
 "losartan":{ingredient:"losartan",classes:["ARB"]},
 "espironolactona":{ingredient:"espironolactona",classes:["POTASSIUM_SPARING"]},
 "metformina":{ingredient:"metformina",classes:["BIGUANIDE"]},
 "sertralina":{ingredient:"sertralina",classes:["SSRI","SEROTONERGIC"]},
 "fluoxetina":{ingredient:"fluoxetina",classes:["SSRI","SEROTONERGIC"]},
 "citalopram":{ingredient:"citalopram",classes:["SSRI","SEROTONERGIC","QT_PROLONGING"]},
 "escitalopram":{ingredient:"escitalopram",classes:["SSRI","SEROTONERGIC","QT_PROLONGING"]},
 "tramadol":{ingredient:"tramadol",classes:["OPIOID","SEROTONERGIC"]},
 // ---- Auditoría 2026-09-19, anexo R03 (R03-23, R03-28, F13) ----
 // El anexo ejecutó las seis barreras con diez fármacos de uso cotidiano AUSENTES del catálogo (diclofenaco, meloxicam,
 // apixabán, clonazepam, digoxina, levotiroxina, furosemida, atorvastatina, insulina glargina, amiodarona). Los AINE se
 // añadieron en el lote C-06; aquí entran los demás. Que un fármaco esté en el catálogo es lo que permite que las
 // barreras lo EVALÚEN: fuera de él la respuesta es NOT_EVALUATED, que es honesto pero no protege.
 "apixaban":{ingredient:"apixaban",classes:["ANTICOAGULANT","DOAC"]},
 "dabigatran":{ingredient:"dabigatran",classes:["ANTICOAGULANT","DOAC"]},
 "clopidogrel":{ingredient:"clopidogrel",classes:["ANTIPLATELET"]},
 "digoxina":{ingredient:"digoxina",classes:["DIGITALIS"]},
 "levotiroxina":{ingredient:"levotiroxina",classes:["THYROID_HORMONE"]},
 "atorvastatina":{ingredient:"atorvastatina",classes:["STATIN"]},
 "simvastatina":{ingredient:"simvastatina",classes:["STATIN"]},
 "rosuvastatina":{ingredient:"rosuvastatina",classes:["STATIN"]},
 "clonazepam":{ingredient:"clonazepam",classes:["BENZODIAZEPINE","CNS_DEPRESSANT"]},
 "alprazolam":{ingredient:"alprazolam",classes:["BENZODIAZEPINE","CNS_DEPRESSANT"]},
 "insulina glargina":{ingredient:"insulina glargina",classes:["INSULIN"]},
 "insulina":{ingredient:"insulina",classes:["INSULIN"]},
 "amiodarona":{ingredient:"amiodarona",classes:["ANTIARRHYTHMIC","QT_PROLONGING"]},
 "ondansetron":{ingredient:"ondansetron",classes:["ANTIEMETIC_5HT3","QT_PROLONGING"]},
 "haloperidol":{ingredient:"haloperidol",classes:["ANTIPSYCHOTIC","QT_PROLONGING"]},
 "levofloxacino":{ingredient:"levofloxacino",classes:["FLUOROQUINOLONE","QT_PROLONGING"]},
 "ciprofloxacino":{ingredient:"ciprofloxacino",classes:["FLUOROQUINOLONE","QT_PROLONGING"]},
 "claritromicina":{ingredient:"claritromicina",classes:["MACROLIDE","QT_PROLONGING"]},
 "omeprazol":{ingredient:"omeprazol",classes:["PPI"]},
 "pantoprazol":{ingredient:"pantoprazol",classes:["PPI"]},
 "amlodipino":{ingredient:"amlodipino",classes:["CALCIUM_CHANNEL_BLOCKER"]},
 "metoprolol":{ingredient:"metoprolol",classes:["BETA_BLOCKER"]},
 "prednisona":{ingredient:"prednisona",classes:["CORTICOSTEROID"]},
 "salbutamol":{ingredient:"salbutamol",classes:["SABA"]},
 "gabapentina":{ingredient:"gabapentina",classes:["GABAPENTINOID","CNS_DEPRESSANT"]},
 "pregabalina":{ingredient:"pregabalina",classes:["GABAPENTINOID","CNS_DEPRESSANT"]},
};

// EPIC AX — Interacciones farmacológicas por clase. Auditoría 2026-09-19 (C-17): existían DOS tablas que divergían (la
// pestaña informativa detectaba sertralina + tramadol y la barrera que bloquea no). Ahora hay UNA sola fuente,
// RICH_INTERACTIONS (más abajo, con mecanismo y recomendación); la barrera deriva de ella: CONTRAINDICATED y MAJOR
// bloquean, MODERATE es precaución, MINOR no interviene en la barrera (sí en la pestaña informativa).
export type DrugInteraction=Readonly<{classA:string;classB:string;severity:"MAJOR"|"MODERATE";note:string}>;
function barrierSeverity(s:InteractionSeverity):"MAJOR"|"MODERATE"|undefined{return s==="CONTRAINDICATED"||s==="MAJOR"?"MAJOR":s==="MODERATE"?"MODERATE":undefined;}
function interactionFor(a:readonly string[],b:readonly string[]):DrugInteraction|undefined{
 const rich=richPairFor(a,b);if(!rich)return undefined;
 const severity=barrierSeverity(rich.severity);if(!severity)return undefined;
 return{classA:rich.classA,classB:rich.classB,severity,note:`${rich.mechanism} ${rich.recommendation}`};
}
// `evaluated=false` => el fármaco a prescribir NO está en el catálogo: NO se verificó nada (nunca leer como "sin
// interacciones"). `unresolvedActive` = fármacos activos del paciente fuera de catálogo (cobertura parcial).
export type InteractionHit=Readonly<{found:boolean;evaluated:boolean;unresolvedActive:readonly string[];severity?:"MAJOR"|"MODERATE";note?:string;conflictDrug?:string;factorHits?:readonly Readonly<{factor:PatientFactor;severity:InteractionSeverity;note:string}>[]}>;
// ¿El fármaco a prescribir interactúa con alguno ya activo? Devuelve la interacción de mayor severidad. `patientFactors`
// (auditoría C-17: p. ej. ELDERLY) añade las reglas fármaco–paciente que aplican a la clase del fármaco nuevo.
export function checkInteractions(newDrugCode:string,activeDrugCodes:readonly string[],patientFactors:readonly PatientFactor[]=[]):InteractionHit{
 const nd=resolveDrug(newDrugCode);if(!nd)return{found:false,evaluated:false,unresolvedActive:[]};
 const unresolvedActive=activeDrugCodes.filter(a=>norm(a)!==norm(newDrugCode)&&!resolveDrug(a));
 const factorHits=FACTOR_RULES.filter(r=>patientFactors.includes(r.factor)&&nd.classes.includes(r.drugClass)).map(r=>({factor:r.factor,severity:r.severity,note:`${FACTOR_LABEL[r.factor]}: ${r.mechanism} ${r.recommendation}`}));
 let best:InteractionHit={found:false,evaluated:true,unresolvedActive,...(factorHits.length?{factorHits}:{})};
 for(const active of activeDrugCodes){
  if(norm(active)===norm(newDrugCode))continue;
  const ad=resolveDrug(active);if(!ad)continue;
  const hit=interactionFor(nd.classes,ad.classes);
  if(hit){if(hit.severity==="MAJOR")return{...best,found:true,severity:"MAJOR",note:hit.note,conflictDrug:active};
   if(!best.found)best={...best,found:true,severity:hit.severity,note:hit.note,conflictDrug:active};}
 }
 return best;
}
// EPIC BM — Ajuste/contraindicación renal por FUNCIÓN medida (eGFR). Complementa la contraindicación por
// DIAGNÓSTICO (EPIC AY) con la función renal real. BLOCK si eGFR < umbral de contraindicación; CAUTION si
// < umbral de precaución. Reutiliza las clases del catálogo. Umbrales de demostración (vademécum oficial aparte).
// Auditoría 2026-09-19 (C-15): había ajuste renal para 2 clases de 27 fármacos (rivaroxabán con TFG 15, espironolactona con
// TFG 20 y enalapril con TFG 15 salían "OK"). Ahora cada clase del catálogo declara su regla, y un ingrediente puede
// sobrescribir la de su clase. `noAdjustment` = revisado y sin ajuste renal (distinto de "sin regla"). Umbrales de ficha
// técnica / KDIGO (uso ambulatorio). PENDIENTE de validación clínica.
export type RenalRule=Readonly<{blockBelow?:number;cautionBelow?:number;noAdjustment?:boolean;note:string}>;
const RENAL_RULES_BY_CLASS:Record<string,RenalRule>={
 BIGUANIDE:{blockBelow:30,cautionBelow:45,note:"Metformina: contraindicada si TFG<30 (acidosis láctica); ajustar/vigilar entre 30–45"},
 NSAID:{blockBelow:30,cautionBelow:60,note:"AINE: evitar si TFG<30 (nefrotoxicidad); entre 30–60 ciclo corto, dosis mínima y vigilar creatinina"},
 VKA:{noAdjustment:true,note:"Antagonistas de vitamina K: sin ajuste renal (guiar por INR)"},
 ACE_INHIBITOR:{cautionBelow:30,note:"IECA con TFG<30: iniciar con dosis baja, vigilar potasio y creatinina a la semana"},
 ARB:{cautionBelow:30,note:"ARA-II con TFG<30: iniciar con dosis baja, vigilar potasio y creatinina"},
 POTASSIUM_SPARING:{blockBelow:30,cautionBelow:50,note:"Espironolactona: evitar si TFG<30 (hiperkalemia grave); entre 30–50 dosis reducida y potasio a la semana"},
 SULFONAMIDE:{blockBelow:15,cautionBelow:30,note:"TMP-SMX: evitar si TFG<15; entre 15–30 mitad de dosis; riesgo de hiperkalemia y elevación de creatinina"},
 PENICILLIN:{cautionBelow:30,note:"Penicilinas con TFG<30: alargar el intervalo (p. ej. amoxicilina c/12–24 h)"},
 CEPHALOSPORIN:{cautionBelow:50,note:"Cefalosporinas orales con TFG<50: reducir dosis o alargar intervalo"},
 MACROLIDE:{noAdjustment:true,note:"Azitromicina: sin ajuste renal"},
 LINCOSAMIDE:{noAdjustment:true,note:"Clindamicina: sin ajuste renal"},
 ANALGESIC_ANTIPYRETIC:{noAdjustment:true,note:"Paracetamol: sin ajuste por TFG (intervalo ≥6 h en insuficiencia grave)"},
 SSRI:{noAdjustment:true,note:"ISRS: sin ajuste renal relevante"},
 OPIOID:{cautionBelow:30,note:"Tramadol con TFG<30: intervalo ≥12 h, máximo 200 mg/día; evitar liberación prolongada"},
};
// Auditoría 2026-09-19, anexo R03 (R03-28). En el momento de la auditoría la regla renal era por CLASE y solo existían
// dos (biguanidas y AINE), así que 22 de los 27 principios activos devolvían `action:"OK"` —una afirmación POSITIVA de
// seguridad— para cualquier TFG: espironolactona con TFG 20 → OK (hiperkalemia grave), enalapril con TFG 15 → OK,
// cefalexina con TFG 10 → OK. El lote C-15 amplió las clases y esta tabla; aquí se completa POR PRINCIPIO ACTIVO para
// los fármacos cuyo umbral concreto cambia la conducta (los ACOD no se ajustan igual entre sí, la digoxina se ajusta
// desde TFG 60, la gabapentina se elimina íntegra por riñón). Umbrales de las fichas técnicas y de las guías citadas en
// cada nota; cargar un vademécum oficial versionado sigue siendo trabajo del dueño del producto.
const RENAL_RULES_BY_INGREDIENT:Record<string,RenalRule>={
 rivaroxaban:{blockBelow:15,cautionBelow:50,note:"Rivaroxabán: evitar si TFG<15; entre 15–49 reducir a 15 mg/día (fibrilación auricular)"},
 apixaban:{blockBelow:15,cautionBelow:30,note:"Apixabán: evitar si TFG<15 (no estudiado en diálisis fuera de indicación); reducir a 2.5 mg/12 h si TFG 15–29 con otro criterio de reducción"},
 dabigatran:{blockBelow:30,cautionBelow:50,note:"Dabigatrán: CONTRAINDICADO con TFG<30 (eliminación 80 % renal); 110 mg/12 h si TFG 30–49 con riesgo hemorrágico"},
 espironolactona:{blockBelow:30,cautionBelow:45,note:"Espironolactona: evitar con TFG<30 por hiperkalemia grave; con TFG 30–44 dosis máxima 25 mg/día y potasio a los 7 días"},
 enalapril:{cautionBelow:30,note:"Enalapril con TFG<30: iniciar 2.5 mg/día, vigilar potasio y creatinina a los 7–14 días (una caída de TFG >30 % obliga a reevaluar)"},
 lisinopril:{cautionBelow:30,note:"Lisinopril con TFG<30: iniciar 2.5–5 mg/día; vigilar potasio y creatinina"},
 losartan:{cautionBelow:30,note:"Losartán con TFG<30: vigilar potasio y creatinina; no requiere ajuste de dosis de inicio"},
 ceftriaxona:{noAdjustment:true,note:"Ceftriaxona: sin ajuste renal (vigilar si hay insuficiencia hepática concomitante)"},
 cefalexina:{cautionBelow:30,note:"Cefalexina con TFG<30: espaciar el intervalo (500 mg cada 8–12 h) y no exceder 500 mg cada 12 h con TFG<15"},
 cefuroxima:{cautionBelow:30,note:"Cefuroxima con TFG<30: 250–500 mg cada 12 h; con TFG<10, cada 24 h"},
 amoxicilina:{cautionBelow:30,note:"Amoxicilina con TFG<30: alargar el intervalo a cada 12 h; con TFG<10, cada 24 h y máximo 500 mg"},
 sulfametoxazol:{blockBelow:15,cautionBelow:30,note:"Trimetoprima-sulfametoxazol: evitar con TFG<15; con TFG 15–29 reducir la dosis a la mitad y vigilar potasio y creatinina (riesgo de hiperkalemia y de falsa elevación de creatinina)"},
 levofloxacino:{cautionBelow:50,note:"Levofloxacino con TFG<50: mantener la dosis de carga y espaciar (500 mg/48 h si TFG 20–49)"},
 ciprofloxacino:{cautionBelow:30,note:"Ciprofloxacino con TFG<30: reducir a la mitad la dosis diaria"},
 digoxina:{cautionBelow:60,note:"Digoxina con TFG<60: reducir la dosis (eliminación renal) y medir digoxinemia; el riesgo de intoxicación sube con la hipokalemia"},
 metformina:{blockBelow:30,cautionBelow:45,note:"Metformina: CONTRAINDICADA con TFG<30; con TFG 30–44 no iniciar y, si ya la toma, máximo 1 000 mg/día (etiqueta FDA 2016)"},
 gabapentina:{cautionBelow:60,note:"Gabapentina con TFG<60: ajustar dosis e intervalo (eliminación renal íntegra); somnolencia y mioclonías si no se ajusta"},
 tramadol:{cautionBelow:30,note:"Tramadol con TFG<30: máximo 200 mg/día y espaciar a cada 12 h (acumulación del metabolito M1)"},
 acetazolamida:{blockBelow:30,note:"Acetazolamida: evitar con TFG<30 (acidosis metabólica y riesgo de nefrolitiasis)"},
 hidroclorotiazida:{cautionBelow:30,note:"Hidroclorotiazida: pierde eficacia antihipertensiva con TFG<30; preferir un diurético de asa"},
 clortalidona:{cautionBelow:30,note:"Clortalidona: eficacia reducida con TFG<30; preferir un diurético de asa"},
 // Un invariante del lote C-15 (con su test) exige que NINGÚN fármaco del catálogo quede sin revisar renalmente: si no,
 // ampliar el catálogo debilitaría la barrera en silencio, que es el patrón que la auditoría persigue. Los siguientes
 // están revisados y NO requieren ajuste por TFG (o lo requieren por otra razón, declarada en la nota).
 furosemida:{noAdjustment:true,note:"Furosemida: sin ajuste por TFG (en insuficiencia avanzada suele hacer falta MÁS dosis, no menos); vigilar volemia y electrolitos"},
 glibenclamida:{blockBelow:30,cautionBelow:60,note:"Glibenclamida: evitar con TFG<30 (metabolitos activos: hipoglucemia grave y prolongada); con TFG 30–59 preferir otra sulfonilurea o reducir dosis"},
 glimepirida:{cautionBelow:45,note:"Glimepirida con TFG<45: iniciar 1 mg/día y vigilar hipoglucemias"},
 insulina:{cautionBelow:45,note:"Insulina con TFG<45: la eliminación renal de insulina cae; reducir dosis ~25 % (TFG 10–50) y vigilar hipoglucemias"},
 "insulina glargina":{cautionBelow:45,note:"Insulina glargina con TFG<45: reducir dosis y vigilar hipoglucemias (menor aclaramiento renal de insulina)"},
 pregabalina:{cautionBelow:60,note:"Pregabalina con TFG<60: ajustar dosis e intervalo (eliminación renal íntegra)"},
 clonazepam:{noAdjustment:true,note:"Clonazepam: sin ajuste por TFG (metabolismo hepático); vigilar sedación acumulada en ancianos"},
 alprazolam:{noAdjustment:true,note:"Alprazolam: sin ajuste por TFG; vigilar sedación en ancianos"},
 amiodarona:{noAdjustment:true,note:"Amiodarona: sin ajuste por TFG (eliminación hepática); vigilar tiroides, hígado y QT"},
 ondansetron:{noAdjustment:true,note:"Ondansetrón: sin ajuste por TFG; el límite es hepático (máximo 8 mg/día en Child-Pugh C)"},
 haloperidol:{noAdjustment:true,note:"Haloperidol: sin ajuste por TFG; vigilar QT y efectos extrapiramidales"},
 levotiroxina:{noAdjustment:true,note:"Levotiroxina: sin ajuste por TFG (dosis guiada por TSH)"},
 atorvastatina:{noAdjustment:true,note:"Atorvastatina: sin ajuste por TFG (eliminación biliar); es la estatina de elección en enfermedad renal"},
 simvastatina:{cautionBelow:30,note:"Simvastatina con TFG<30: no exceder 10 mg/día (riesgo de miopatía)"},
 rosuvastatina:{cautionBelow:30,note:"Rosuvastatina con TFG<30: máximo 10 mg/día; no iniciar 40 mg"},
 clopidogrel:{noAdjustment:true,note:"Clopidogrel: sin ajuste por TFG; el riesgo hemorrágico sí aumenta en la enfermedad renal avanzada"},
 amlodipino:{noAdjustment:true,note:"Amlodipino: sin ajuste por TFG (metabolismo hepático)"},
 metoprolol:{noAdjustment:true,note:"Metoprolol: sin ajuste por TFG (metabolismo hepático); atenolol sí lo requiere"},
 omeprazol:{noAdjustment:true,note:"Omeprazol: sin ajuste por TFG"},
 pantoprazol:{noAdjustment:true,note:"Pantoprazol: sin ajuste por TFG"},
 prednisona:{noAdjustment:true,note:"Prednisona: sin ajuste por TFG; vigilar glucemia, presión y potasio"},
 salbutamol:{noAdjustment:true,note:"Salbutamol: sin ajuste por TFG; dosis altas repetidas bajan el potasio"},
 escitalopram:{cautionBelow:20,note:"Escitalopram con TFG<20: usar con precaución (sin datos suficientes); vigilar QT"},
 cefadroxilo:{cautionBelow:50,note:"Cefadroxilo con TFG<50: alargar el intervalo (500 mg cada 12–24 h)"},
 cefaclor:{cautionBelow:50,note:"Cefaclor con TFG<50: alargar el intervalo"},
 cefotaxima:{cautionBelow:20,note:"Cefotaxima con TFG<20: reducir la dosis a la mitad"},
 cefepima:{cautionBelow:60,note:"Cefepima con TFG<60: ajustar dosis e intervalo (neurotoxicidad si no se ajusta)"},
 sulfadiazina:{blockBelow:15,cautionBelow:30,note:"Sulfadiazina: evitar con TFG<15 (cristaluria); con TFG 15–29 reducir dosis y asegurar hidratación"},
 bencilpenicilina:{cautionBelow:30,note:"Bencilpenicilina con TFG<30: alargar el intervalo; dosis altas IV pueden ser neurotóxicas"},
 dicloxacilina:{noAdjustment:true,note:"Dicloxacilina: sin ajuste por TFG (eliminación biliar)"},
 acenocumarol:{noAdjustment:true,note:"Acenocumarol: sin ajuste renal (guiar por INR)"},
 metamizol:{cautionBelow:30,note:"Metamizol con TFG<30: evitar el uso prolongado"},
 clindamicina:{noAdjustment:true,note:"Clindamicina: sin ajuste por TFG (eliminación hepática)"},
 azitromicina:{noAdjustment:true,note:"Azitromicina: sin ajuste por TFG"},
 claritromicina:{cautionBelow:30,note:"Claritromicina con TFG<30: reducir la dosis a la mitad"},
};
// "OK" SOLO si existe una regla renal para el fármaco y el eGFR la supera. Sin regla en el catálogo => "NOT_COVERED";
// fármaco fuera de catálogo => "NOT_EVALUATED". Ninguno de los dos significa "seguro" (auditoría 2026-09-19, C-03).
export type RenalDosing=Readonly<{action:"BLOCK"|"CAUTION"|"OK"|"NOT_COVERED"|"NOT_EVALUATED";note?:string;threshold?:number;drugClass?:string;reason?:"DRUG_NOT_IN_CATALOG"|"NO_RENAL_RULE"}>;
// ¿El catálogo tiene alguna regla renal para este fármaco? (para distinguir "sin regla" de "regla superada").
export function renalRuleForDrug(drugCode:string):(RenalRule&{drugClass:string})|undefined{
 const d=resolveDrug(drugCode);return d?renalRuleFor(d.classes,d.ingredient)??undefined:undefined;
}
// ¿La función renal (eGFR) contraindica o exige precaución para este fármaco? Devuelve la acción más severa.
export function checkRenalDosing(drugCode:string,egfr:number):RenalDosing{
 const d=resolveDrug(drugCode);if(!d)return{action:"NOT_EVALUATED",reason:"DRUG_NOT_IN_CATALOG",note:"Fármaco fuera del catálogo: ajuste renal NO evaluado"};
 // La regla del INGREDIENTE manda sobre la de su clase (rivaroxabán ≠ warfarina aunque ambos sean ANTICOAGULANT), con
 // una precisión que la auditoría R03-28 obligó a hacer explícita: una regla de ingrediente con umbrales NUMÉRICOS se
 // SUMA a la de su clase y gana la más severa (poner `cefalexina: TFG<30` no debe relajar el `CEPHALOSPORIN: TFG<50`
 // que ya existía); solo `noAdjustment:true` a nivel de ingrediente es una EXENCIÓN explícita que descarta la de clase
 // (ceftriaxona no necesita ajuste aunque sea cefalosporina). Sin esto, añadir detalle habría debilitado la barrera.
 const ri=RENAL_RULES_BY_INGREDIENT[d.ingredient];
 const porClase=d.classes.flatMap(cl=>{const r=RENAL_RULES_BY_CLASS[cl];return r?[{...r,drugClass:cl}]:[];});
 const rules:(RenalRule&{drugClass:string})[]=ri===undefined?porClase
  :ri.noAdjustment?[{...ri,drugClass:d.ingredient}]
  :[{...ri,drugClass:d.ingredient},...porClase];
 if(rules.length===0)return{action:"NOT_COVERED",reason:"NO_RENAL_RULE",note:"El catálogo no tiene regla renal para este fármaco: ajuste renal NO evaluado"};
 let best:RenalDosing=rules.every(r=>r.noAdjustment)?{action:"OK",note:rules[0]!.note,drugClass:rules[0]!.drugClass}:{action:"OK",drugClass:rules[0]!.drugClass};
 for(const r of rules){
  if(r.blockBelow!==undefined&&egfr<r.blockBelow)return{action:"BLOCK",note:r.note,threshold:r.blockBelow,drugClass:r.drugClass};
  if(r.cautionBelow!==undefined&&egfr<r.cautionBelow&&best.action==="OK")best={action:"CAUTION",note:r.note,threshold:r.cautionBelow,drugClass:r.drugClass};
 }
 return best;
}
// EPIC AY — Contraindicación fármaco–condición (drug–disease). Cruza la CLASE del fármaco a prescribir
// contra las condiciones ACTIVAS del paciente (lista de problemas, CIE-10). MAJOR = bloquea; MODERATE = alerta.
// Match por prefijo CIE-10 (grupo de enfermedad): "N18.3" (ERC estadio 3) coincide con el prefijo "N18".
// Puro, sin PHI. Subconjunto de demostración; el vademécum oficial se cargaría de la fuente autorizada.
export type DrugCondition=Readonly<{drugClass:string;icd10Prefix:string;severity:"MAJOR"|"MODERATE";note:string}>;
const CONTRAINDICATIONS:readonly DrugCondition[]=[
 {drugClass:"NSAID",icd10Prefix:"N18",severity:"MAJOR",note:"AINE en enfermedad renal crónica: nefrotoxicidad y deterioro de la función renal"},
 {drugClass:"NSAID",icd10Prefix:"I50",severity:"MAJOR",note:"AINE en insuficiencia cardíaca: retención de líquidos y descompensación"},
 {drugClass:"NSAID",icd10Prefix:"K29",severity:"MODERATE",note:"AINE en gastritis/enfermedad péptica: riesgo de hemorragia gastrointestinal (usar con gastroprotección)"},
 {drugClass:"BIGUANIDE",icd10Prefix:"N18",severity:"MODERATE",note:"Metformina en ERC: riesgo de acidosis láctica; contraindicada si TFG<30, ajustar dosis y vigilar"},
 {drugClass:"ACE_INHIBITOR",icd10Prefix:"N18",severity:"MODERATE",note:"IECA en ERC: vigilar potasio y creatinina (nefroprotector pero requiere monitoreo estrecho)"},
];
export type ContraindicationHit=Readonly<{found:boolean;evaluated:boolean;severity?:"MAJOR"|"MODERATE";note?:string;condition?:string}>;
// ¿El fármaco a prescribir está contraindicado por alguna condición activa? Devuelve la de mayor severidad.
export function checkContraindications(newDrugCode:string,activeConditionCodes:readonly string[]):ContraindicationHit{
 const nd=resolveDrug(newDrugCode);if(!nd)return{found:false,evaluated:false};
 const classes=new Set(nd.classes);
 let best:ContraindicationHit={found:false,evaluated:true};
 for(const raw of activeConditionCodes){
  const code=raw.trim().toUpperCase();if(!code)continue;
  for(const ci of CONTRAINDICATIONS){
   if(!classes.has(ci.drugClass))continue;
   if(!code.startsWith(ci.icd10Prefix))continue;
   if(ci.severity==="MAJOR")return{found:true,evaluated:true,severity:"MAJOR",note:ci.note,condition:raw};
   if(!best.found)best={found:true,evaluated:true,severity:"MODERATE",note:ci.note,condition:raw};
  }
 }
 return best;
}
// EPIC BA — Requisitos de monitoreo por clase de fármaco. Prescribir un fármaco de estas clases exige
// vigilancia de laboratorio; el sistema crea automáticamente una obligación de seguimiento (Zero-Lost-Follow-Up).
// Puro, sin PHI. Subconjunto de demostración; los protocolos oficiales se cargarían de la fuente autorizada.
export type MonitoringRule=Readonly<{kind:string;test:string;dueInDays:number;note:string}>;
// Auditoría 2026-09-19, anexo R03 (vector F10): el monitoreo cubría 5 clases. Faltaban vigilancias que son estándar y que
// el propio catálogo ya podía resolver: la hepática y muscular de las estatinas, el sodio de los ISRS en el adulto mayor
// (SIADH, criterios de Beers), la tiroidea y hepática de la amiodarona, la digoxinemia, la función renal de los ACOD, el
// hemograma del metamizol (agranulocitosis) y la glucemia del corticoide. Cada regla dice qué prueba y en cuántos días.
const MONITORING_BY_CLASS:Record<string,MonitoringRule>={
 // F07/F10: el INR monitoriza a los ANTAGONISTAS DE VITAMINA K, no a los ACOD. Antes la regla vivía en la clase
 // ANTICOAGULANT, así que un paciente con apixabán recibía «control de INR en 3 días»: una prueba que no mide su efecto.
 VKA:{kind:"MONITOR_INR",test:"INR/TP",dueInDays:3,note:"Ajuste de anticoagulación con antagonistas de vitamina K (el INR NO monitoriza a los ACOD)"},
 DOAC:{kind:"MONITOR_RENAL_DOAC",test:"Creatinina/TFG y hemograma",dueInDays:180,note:"Los ACOD se dosifican por función renal: revalorar al menos cada 6 meses (y antes si hay deterioro)"},
 BIGUANIDE:{kind:"MONITOR_RENAL",test:"Creatinina/TFG",dueInDays:90,note:"Riesgo de acidosis láctica: vigilar función renal"},
 ACE_INHIBITOR:{kind:"MONITOR_K_CREAT",test:"Potasio y creatinina",dueInDays:14,note:"Vigilar hiperkalemia y función renal"},
 ARB:{kind:"MONITOR_K_CREAT",test:"Potasio y creatinina",dueInDays:14,note:"Vigilar hiperkalemia y función renal"},
 POTASSIUM_SPARING:{kind:"MONITOR_K",test:"Potasio",dueInDays:14,note:"Vigilar hiperkalemia"},
 STATIN:{kind:"MONITOR_HEPATIC_CK",test:"ALT/AST (y CK si hay mialgias)",dueInDays:90,note:"Transaminasas antes de iniciar y ante síntomas; CK solo si hay dolor muscular"},
 SSRI:{kind:"MONITOR_SODIUM",test:"Sodio sérico",dueInDays:21,note:"Hiponatremia por SIADH en las primeras semanas, sobre todo en el adulto mayor (criterios de Beers)"},
 ANTIARRHYTHMIC:{kind:"MONITOR_THYROID_HEPATIC",test:"TSH, ALT/AST y ECG (QT)",dueInDays:180,note:"Amiodarona: toxicidad tiroidea, hepática y pulmonar; vigilancia semestral"},
 DIGITALIS:{kind:"MONITOR_DIGOXIN",test:"Digoxinemia, potasio y creatinina",dueInDays:30,note:"Ventana terapéutica estrecha: la hipokalemia y el deterioro renal precipitan la intoxicación"},
 THYROID_HORMONE:{kind:"MONITOR_TSH",test:"TSH",dueInDays:42,note:"Ajuste de dosis por TSH a las 6 semanas de cada cambio"},
 PYRAZOLONE:{kind:"MONITOR_CBC",test:"Hemograma",dueInDays:14,note:"Metamizol: riesgo de agranulocitosis; hemograma si el uso pasa de unos días o aparece fiebre/odinofagia"},
 CORTICOSTEROID:{kind:"MONITOR_GLUCOSE_BP",test:"Glucosa y presión arterial",dueInDays:30,note:"Hiperglucemia, hipertensión e hipokalemia con uso sostenido"},
 SULFONYLUREA:{kind:"MONITOR_GLUCOSE",test:"Glucosa capilar / HbA1c",dueInDays:90,note:"Riesgo de hipoglucemia, mayor en el adulto mayor y con deterioro renal"},
 LOOP_DIURETIC:{kind:"MONITOR_ELECTROLYTES",test:"Sodio, potasio y creatinina",dueInDays:21,note:"Hipokalemia, hiponatremia y depleción de volumen"},
 THIAZIDE:{kind:"MONITOR_ELECTROLYTES",test:"Sodio, potasio y creatinina",dueInDays:21,note:"Hiponatremia e hipokalemia, sobre todo al inicio y en el adulto mayor"},
 FLUOROQUINOLONE:{kind:"MONITOR_QT_TENDON",test:"ECG (QT) si hay otros fármacos que lo prolongan",dueInDays:7,note:"Prolongación del QT; advertir sobre tendinopatía y neuropatía"},
};
// Reglas de monitoreo aplicables al fármaco (deduplicadas por kind). Vacío si no requiere vigilancia conocida.
export function monitoringFor(drugCode:string):MonitoringRule[]{
 const d=resolveDrug(drugCode);if(!d)return[];
 const seen=new Set<string>();const out:MonitoringRule[]=[];
 for(const cl of d.classes){const r=MONITORING_BY_CLASS[cl];if(r&&!seen.has(r.kind)){seen.add(r.kind);out.push(r);}}
 return out;
}
// Sinónimos de sustancia de alergia -> clases de alérgeno (para normalizar la alergia registrada).
const ALLERGY_SYNONYMS:Record<string,readonly string[]>={
 "penicilina":["PENICILLIN","BETA_LACTAM"],"penicillin":["PENICILLIN","BETA_LACTAM"],"pcn":["PENICILLIN","BETA_LACTAM"],
 "betalactamico":["BETA_LACTAM"],"beta-lactamico":["BETA_LACTAM"],"beta-lactam":["BETA_LACTAM"],
 "cefalosporina":["CEPHALOSPORIN","BETA_LACTAM"],"cephalosporin":["CEPHALOSPORIN","BETA_LACTAM"],
 // R03-24: quien dice «alergia a sulfas» se refiere al antibiótico (TMP-SMX). No se propaga a las sulfonamidas no
 // antibióticas: bloquear furosemida o hidroclorotiazida por ese antecedente es un daño sin base en la evidencia.
 "sulfa":["SULFONAMIDE_ANTIBIOTIC"],"sulfamida":["SULFONAMIDE_ANTIBIOTIC"],"sulfonamida":["SULFONAMIDE_ANTIBIOTIC"],"sulfonamide":["SULFONAMIDE_ANTIBIOTIC"],
 "trimetoprima":["SULFONAMIDE_ANTIBIOTIC"],"bactrim":["SULFONAMIDE_ANTIBIOTIC"],
 "aine":["NSAID"],"nsaid":["NSAID"],"antiinflamatorio":["NSAID"],
 "aspirina":["SALICYLATE","NSAID"],"salicilato":["SALICYLATE","NSAID"],
 "macrolido":["MACROLIDE"],
};
function norm(s:string):string{return s.trim().toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]","g"),"");}
// Resuelve el fármaco por principio activo contenido en el código (p. ej. "amoxicilina-500" -> amoxicilina).
export function resolveDrug(drugCode:string):DrugEntry|undefined{
 const c=norm(drugCode);
 // preferir la clave más larga que sea subcadena (evita que "penicilina" gane sobre "amoxicilina")
 let best:DrugEntry|undefined;let bestLen=0;
 for(const[k,v]of Object.entries(DRUGS)){if(c.includes(k)&&k.length>bestLen){best=v;bestLen=k.length;}}
 return best;
}
function allergyClasses(substance:string):string[]{
 const s=norm(substance);const out=new Set<string>();
 for(const[k,v]of Object.entries(ALLERGY_SYNONYMS))if(s.includes(k))for(const cl of v)out.add(cl);
 return[...out];
}
// Auditoría 2026-09-19 (C-06) — la alergia tiene GRAVEDAD y TIPO DE REACCIÓN, y la respuesta lo refleja.
// Antes cualquier antecedente con "penicilina" (incluida una intolerancia digestiva leve) bloqueaba todas las
// cefalosporinas, y "AINE" no bloqueaba diclofenaco (no estaba en el catálogo). Ahora:
//   · coincidencia por PRINCIPIO ACTIVO (el mismo fármaco), por CLASE (otro AINE, otra penicilina) o CRUZADA (clase
//     emparentada: penicilina ↔ cefalosporina vía BETA_LACTAM; AINE ↔ salicilatos/pirazolonas);
//   · gravedad SEVERE (o una reacción que describe anafilaxia/angioedema/broncoespasmo/SJS, diga lo que diga la
//     gravedad) => BLOQUEA en los tres casos; MODERATE => bloquea ingrediente y clase, precaución en cruzada;
//     MILD (intolerancia) => precaución con confirmación expresa del médico en los tres casos;
//   · sin gravedad conocida (registros antiguos, solo la sustancia) => se trata como SEVERE (fail-closed).
// `classEvaluated=false` => fármaco fuera de catálogo: solo se comparó por nombre; la reactividad por clase NO se pudo evaluar.
export type AllergySeverity="MILD"|"MODERATE"|"SEVERE";
export type AllergyRecord=Readonly<{substance:string;severity?:AllergySeverity|null;reaction?:string|null}>;
// Auditoría 2026-09-19, anexo R03 (R03-24) — REACTIVIDAD CRUZADA BETALACTÁMICA POR CADENA LATERAL R1.
//
// El bloqueo anterior era por el anillo betalactámico: una alergia a penicilina bloqueaba TODAS las cefalosporinas.
// Esa es la enseñanza superada del «10 % de reactividad cruzada», y su daño está documentado: empuja a vancomicina y
// quinolonas, aumenta C. difficile y empeora desenlaces (Shenoy ES et al., JAMA 2019;321:188-199; parámetros
// AAAAI/ACAAI). La reactividad real la determina la similitud de la CADENA LATERAL R1, no el anillo:
//   · amoxicilina/ampicilina ↔ cefalexina, cefadroxilo, cefaclor comparten R1 (aminobencilo) -> cruzada REAL;
//   · ceftriaxona, cefotaxima y cefepima comparten R1 entre sí, y NINGUNO con las penicilinas -> ~1 % o menos;
//   · penicilina G (bencilo) y dicloxacilina (isoxazolilo) no comparten R1 con ninguna cefalosporina del catálogo.
// Por eso hay dos veredictos distintos: `cross` (R1 compartido: se comporta como antes) y `cross-r1-differs`
// (betalactámicos con R1 distinto: NUNCA bloquea; deja constancia para que el médico decida, con el dato a la vista).
export type AllergyMatch="ingredient"|"class"|"cross"|"cross-r1-differs";
export type AllergyConflict=Readonly<{blocked:boolean;caution:boolean;classEvaluated:boolean;allergen?:string;via?:AllergyMatch;severity?:AllergySeverity;detail?:string}>;
const SEVERE_REACTION=/anafila|angioedema|broncoespasmo|stevens|johnson|lyell|necr[oó]lisis|dress|choque|shock|edema (de )?glotis|dificultad respiratoria/i;
// Clases "de la misma familia" (misma reactividad esperada) vs clases EMPARENTADAS (reactividad cruzada parcial).
const CROSS_FAMILY:Readonly<Record<string,readonly string[]>>={PENICILLIN:["BETA_LACTAM"],CEPHALOSPORIN:["BETA_LACTAM"],NSAID:["NSAID"],SALICYLATE:["NSAID"],PYRAZOLONE:["NSAID"],SULFONAMIDE_ANTIBIOTIC:["SULFONAMIDE_ANTIBIOTIC"],SULFONAMIDE:["SULFONAMIDE"],MACROLIDE:["MACROLIDE"],BETA_LACTAM:["BETA_LACTAM"]};
// Grupos de cadena lateral R1 que SÍ cruzan entre sí. `PENICILLIN_UNSPECIFIED` («alergia a penicilina», sin decir cuál)
// se trata como aminopenicilina: amoxicilina y ampicilina son las de uso masivo y comparten R1 con las cefalosporinas de
// 1.ª generación (cefalexina, cefadroxilo, cefaclor). Con las de 3.ª–4.ª (ceftriaxona, cefotaxima, cefepima) y con
// cefuroxima no hay R1 común, y ahí la evidencia sitúa la reactividad en ~1 % o menos.
const R1_CROSS:Readonly<Record<string,readonly string[]>>={
 AMINOBENZYL:["AMINOBENZYL","PENICILLIN_UNSPECIFIED"],
 PENICILLIN_UNSPECIFIED:["AMINOBENZYL","BENZYL","ISOXAZOLYL","PENICILLIN_UNSPECIFIED"],
 BENZYL:["BENZYL","PENICILLIN_UNSPECIFIED"],
 ISOXAZOLYL:["ISOXAZOLYL","PENICILLIN_UNSPECIFIED"],
 AMINOTHIAZOLYL_METHOXYIMINO:["AMINOTHIAZOLYL_METHOXYIMINO"],
 FURANYL_METHOXYIMINO:["FURANYL_METHOXYIMINO"],
};
function r1CrossReacts(a:string,b:string):boolean{return a===b||(R1_CROSS[a]??[]).includes(b);}
// Auditoría 2026-09-19, anexo R05b (R05b-07) — REACTIVIDAD CRUZADA DE UN ALÉRGENO, desde este catálogo y no desde un regex.
//
// EL HALLAZGO: la vista de Alergias pintaba una «Alerta clínica» a partir de siete palabras sueltas buscadas en un campo de
// TEXTO LIBRE (`/penicil|amoxi|betalact|cefal|sulfa|aine|ibuprof/`), sin relación con el motor que de verdad bloquea las
// prescripciones. Dos fuentes para el mismo hecho clínico, y ya discrepaban:
//   · La alerta decía «Evitar sulfonamidas y considerar reactividad cruzada con otros de su familia». Este catálogo
//     documenta lo contrario desde R03-24: quien dice «alergia a sulfas» se refiere al ANTIBIÓTICO, y propagarlo a
//     furosemida o hidroclorotiazida es un daño sin base en la evidencia. La pantalla empujaba exactamente a ese daño.
//   · La alerta afirmaba la reactividad cruzada de los betalactámicos sin matiz. Este catálogo la modela por cadena
//     lateral R1 y anota que con cefalosporinas de 3.ª–4.ª generación la evidencia la sitúa en ~1 % o menos.
//
// Esta función expone lo que el catálogo YA sabe, para que la pantalla no tenga que inventarlo. Si no reconoce la clase del
// alérgeno, lo dice: «no se pudo evaluar» es la única respuesta honesta, y no una alerta por omisión.
const CLASS_ES:Readonly<Record<string,string>>={
 PENICILLIN:"penicilinas",CEPHALOSPORIN:"cefalosporinas",BETA_LACTAM:"betalactámicos",
 SULFONAMIDE_ANTIBIOTIC:"sulfonamidas antibióticas (tipo trimetoprima-sulfametoxazol)",SULFONAMIDE:"sulfonamidas",
 NSAID:"AINE",SALICYLATE:"salicilatos",PYRAZOLONE:"pirazolonas",MACROLIDE:"macrólidos",
};
const CLASS_CAVEAT:Readonly<Record<string,string>>={
 SULFONAMIDE_ANTIBIOTIC:"No incluye las sulfonamidas NO antibióticas: furosemida, tiazidas o celecoxib no se retiran por este antecedente (R03-24).",
 BETA_LACTAM:"La reactividad penicilina↔cefalosporina depende de la cadena lateral R1: con cefalosporinas de 3.ª–4.ª generación la evidencia la sitúa en ~1 % o menos.",
};
export type AllergyCrossReactivity=Readonly<{
 /** false = el catálogo no reconoce la clase de este alérgeno; no se puede afirmar nada sobre su familia. */
 recognized:boolean;
 /** Clases del alérgeno según los sinónimos y el propio catálogo de fármacos. */
 classes:readonly string[];
 /** Qué evitar, en español, derivado de esas clases. */
 avoid:readonly string[];
 /** Familias emparentadas (la misma tabla que usa el bloqueo de prescripción). */
 crossFamilies:readonly string[];
 /** Advertencias que este catálogo documenta para esas clases. Vacío si no hay ninguna. */
 caveats:readonly string[];
}>;
export function allergyCrossReactivity(substance:string):AllergyCrossReactivity{
 const propias=allergyClasses(substance);
 const delCatalogo=resolveDrug(substance)?.classes??[];
 const classes=[...new Set([...propias,...delCatalogo])];
 if(classes.length===0)return{recognized:false,classes:[],avoid:[],crossFamilies:[],caveats:[]};
 const crossFamilies=[...new Set(classes.flatMap(c=>CROSS_FAMILY[c]??[]))];
 const avoid=[...new Set([...classes,...crossFamilies].map(c=>CLASS_ES[c]).filter((x):x is string=>!!x))];
 const caveats=[...new Set([...classes,...crossFamilies].map(c=>CLASS_CAVEAT[c]).filter((x):x is string=>!!x))];
 return{recognized:true,classes,avoid,crossFamilies,caveats};
}
export function effectiveAllergySeverity(a:AllergyRecord):AllergySeverity{
 if(a.reaction&&SEVERE_REACTION.test(a.reaction))return "SEVERE";
 return a.severity==="MILD"||a.severity==="MODERATE"||a.severity==="SEVERE"?a.severity:"SEVERE";
}
function matchKind(drug:DrugEntry,allergenClasses:readonly string[],normalizedSubstance:string,allergenDrug?:DrugEntry):AllergyMatch|undefined{
 if(normalizedSubstance.includes(drug.ingredient)||drug.ingredient.includes(normalizedSubstance)&&normalizedSubstance.length>=4)return "ingredient";
 const drugClasses=new Set(drug.classes);
 // misma clase: el alérgeno nombra una clase que el fármaco TIENE (AINE -> ibuprofeno; penicilina -> amoxicilina)
 if(allergenClasses.some(c=>drugClasses.has(c)&&c!=="BETA_LACTAM"))return "class";
 // R03-24: entre betalactámicos, la cruzada depende de la cadena lateral R1, no del anillo.
 const ambosBetaLactam=drugClasses.has("BETA_LACTAM")&&allergenClasses.includes("BETA_LACTAM");
 if(ambosBetaLactam){
  const r1Alergeno=allergenDrug?.r1;
  return r1Alergeno!==undefined&&drug.r1!==undefined&&r1CrossReacts(r1Alergeno,drug.r1)?"cross":"cross-r1-differs";
 }
 // cruzada por familia en el resto (AINE ↔ salicilatos/pirazolonas)
 const families=new Set(allergenClasses.flatMap(c=>CROSS_FAMILY[c]??[]));
 if([...drugClasses].some(c=>families.has(c)||(CROSS_FAMILY[c]??[]).some(f=>families.has(f))))return "cross";
 return undefined;
}
export function checkDrugAllergy(drugCode:string,allergies:readonly(string|AllergyRecord)[]):AllergyConflict{
 const c=norm(drugCode);const drug=resolveDrug(drugCode);
 let worst:AllergyConflict|undefined;
 const rank=(x:AllergyConflict)=>x.blocked?2:x.caution?1:0;
 for(const raw of allergies){
  const rec:AllergyRecord=typeof raw==="string"?{substance:raw}:raw;
  const s=norm(rec.substance);if(!s)continue;
  const sev=effectiveAllergySeverity(rec);
  let via:AllergyMatch|undefined;
  // Las clases del alérgeno salen de los sinónimos ("AINE", "sulfa"…) Y del catálogo si nombra un fármaco ("naproxeno").
  const alergeno=resolveDrug(rec.substance);
  if(drug)via=matchKind(drug,[...allergyClasses(rec.substance),...(alergeno?.classes??[])],s,alergeno);
  else if(c.includes(s))via="ingredient"; // fuera de catálogo: solo por nombre (compatibilidad)
  if(!via)continue;
  // R03-24: un betalactámico con R1 DISTINTO no bloquea ni siquiera con antecedente grave: la evidencia sitúa la
  // reactividad en ~1 % (o menos con 3.ª–4.ª generación) y el bloqueo en bloque hace más daño que el riesgo que evita.
  const blocked=via!=="cross-r1-differs"&&(sev==="SEVERE"||(sev==="MODERATE"&&via!=="cross"));
  const label=via==="ingredient"?"principio activo":via==="class"?"misma clase":via==="cross"?"reactividad cruzada (misma cadena lateral R1)":"mismo anillo betalactámico pero cadena lateral R1 DISTINTA";
  const extra=via==="cross-r1-differs"?" — reactividad cruzada esperada ~1 % (Shenoy, JAMA 2019): valore el antecedente; no se bloquea automáticamente":"";
  const detail=`Alergia ${sev==="SEVERE"?"GRAVE":sev==="MODERATE"?"moderada":"leve"} a ${rec.substance}${rec.reaction?` (${rec.reaction})`:""} — coincidencia por ${label}${extra}`;
  const hit:AllergyConflict={blocked,caution:!blocked,classEvaluated:!!drug,allergen:rec.substance,via,severity:sev,detail};
  if(!worst||rank(hit)>rank(worst))worst=hit;
 }
 return worst??{blocked:false,caution:false,classEvaluated:!!drug};
}

// EPIC AW — Duplicación terapéutica: ¿el fármaco a prescribir comparte CLASE con alguno ya activo?
// (p. ej. dos AINE, dos beta-lactámicos, dos IECA). Reutiliza el catálogo de clases. Puro, sin PHI.
export type DuplicateTherapy=Readonly<{duplicate:boolean;evaluated:boolean;conflictDrug?:string;sharedClass?:string}>;
export function checkDuplicateTherapy(newDrugCode:string,activeDrugCodes:readonly string[]):DuplicateTherapy{
 const nd=resolveDrug(newDrugCode);if(!nd)return{duplicate:false,evaluated:false};
 const ndClasses=new Set(nd.classes);const nIng=nd.ingredient;
 for(const active of activeDrugCodes){
  if(norm(active)===norm(newDrugCode))continue; // no se compara consigo mismo
  const ad=resolveDrug(active);if(!ad)continue;
  if(ad.ingredient===nIng)return{duplicate:true,evaluated:true,conflictDrug:active,sharedClass:nd.classes[0]??nIng}; // mismo principio activo
  const shared=ad.classes.find(cl=>ndClasses.has(cl));
  if(shared)return{duplicate:true,evaluated:true,conflictDrug:active,sharedClass:shared};
 }
 return{duplicate:false,evaluated:true};
}

// EPIC R/UI — Clasificación determinista del alérgeno por sustancia (para el registro de alergias: tipo + gráficas).
// Categorías alineadas con la vista Alergias: Medicamento / Alimento / Ambiental / Contraste / Otros.
export type AllergenType="Medicamento"|"Alimento"|"Ambiental"|"Contraste"|"Otros";
const ALLERGEN_KEYWORDS:readonly[AllergenType,readonly string[]][]=[
 ["Contraste",["contraste","iodado","yodado","gadolinio","medio de contraste"]],
 ["Alimento",["marisco","camaron","gamba","huevo","leche","lacteo","lactosa","proteina de leche","cacahuate","mani","nuez","almendra","gluten","trigo","pescado","fresa","soya","kiwi","chocolate","frijol"]],
 ["Ambiental",["polen","latex","acaro","polvo","graminea","moho","hongo","pelo","caspa","gato","perro","abeja","avispa","picadura","niquel"]],
];
// Devuelve la categoría del alérgeno. Los fármacos del catálogo (o clases de alérgeno de fármaco) son Medicamento.
export function classifyAllergen(substance:string):AllergenType{
 const s=norm(substance);
 for(const[type,kws]of ALLERGEN_KEYWORDS)if(kws.some(k=>s.includes(k)))return type;
 if(resolveDrug(substance)||allergyClasses(substance).length>0)return"Medicamento";
 return"Otros";
}

// EPIC BN — Verificador de INTERACCIONES (conjunto). A diferencia de checkInteractions (dry-run de UNA
// prescripción contra la lista activa, barrera de commit), este evalúa TODO un conjunto de fármacos entre sí
// MÁS factores del paciente (alcohol, insuficiencia renal, embarazo…) y devuelve cada interacción con
// severidad de 4 niveles + MECANISMO + RECOMENDACIÓN. Alimenta la pestaña "Interacciones" (verificación previa,
// no bloqueo). Puro, sin PHI. Subconjunto de demostración; el vademécum oficial se cargaría de la fuente autorizada.
export type InteractionSeverity="CONTRAINDICATED"|"MAJOR"|"MODERATE"|"MINOR";
const SEVERITY_RANK:Record<InteractionSeverity,number>={CONTRAINDICATED:4,MAJOR:3,MODERATE:2,MINOR:1};
// Etiqueta clínica en español para la UI (leyenda de severidad).
export const SEVERITY_LABEL:Record<InteractionSeverity,string>={CONTRAINDICATED:"Contraindicada",MAJOR:"Mayor",MODERATE:"Moderada",MINOR:"Menor"};

// Interacciones fármaco–fármaco por CLASE, con mecanismo y recomendación (conjunto simétrico).
// Auditoría R03-25: cada fila declara su FUENTE y la fecha de revisión. Una tabla de interacciones sin procedencia no se
// puede auditar ni mantener: no hay forma de saber si falta un par porque nadie lo revisó o porque se decidió omitirlo.
export type RichInteraction=Readonly<{classA:string;classB:string;severity:InteractionSeverity;mechanism:string;recommendation:string;source:string;reviewedAt:string}>;
/** Fecha de la última revisión del conjunto de interacciones (todas las filas se revisaron en este corte). */
export const INTERACTIONS_REVIEWED_AT="2026-09-24";
const RICH_INTERACTIONS:readonly RichInteraction[]=[
 {classA:"SEROTONERGIC",classB:"SEROTONERGIC",severity:"MAJOR",mechanism:"Efecto serotoninérgico aditivo: riesgo de síndrome serotoninérgico (hipertermia, rigidez, clonus, agitación).",recommendation:"Evitar la combinación o usar la mínima dosis con vigilancia estrecha; suspender ante los primeros signos.",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"SSRI",classB:"NSAID",severity:"MAJOR",mechanism:"Inhibición serotoninérgica de la agregación plaquetaria sumada al efecto gastroerosivo del AINE: sangrado digestivo.",recommendation:"Preferir paracetamol; si el AINE es necesario, añadir gastroprotección con IBP y vigilar sangrado.",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"SSRI",classB:"ANTICOAGULANT",severity:"MAJOR",mechanism:"Efecto antiagregante del SSRI sumado a la anticoagulación: riesgo hemorrágico aumentado.",recommendation:"Vigilar signos de sangrado; considerar antidepresivo con menor efecto plaquetario (p. ej. no serotoninérgico).",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"ANTICOAGULANT",classB:"NSAID",severity:"MAJOR",mechanism:"AINE inhibe plaquetas y erosiona mucosa gástrica sobre un paciente anticoagulado: hemorragia mayor.",recommendation:"Evitar el AINE; usar paracetamol. Si es imprescindible, gastroprotección e INR/vigilancia estrecha.",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"ANTICOAGULANT",classB:"SALICYLATE",severity:"MAJOR",mechanism:"Doble efecto antiagregante/anticoagulante: hemorragia mayor.",recommendation:"Evitar salicilatos salvo indicación cardiológica explícita con balance riesgo-beneficio documentado.",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"ACE_INHIBITOR",classB:"POTASSIUM_SPARING",severity:"MAJOR",mechanism:"Retención aditiva de potasio: hiperkalemia grave.",recommendation:"Vigilar potasio sérico al inicio y tras cada ajuste; evitar suplementos de potasio.",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"ARB",classB:"POTASSIUM_SPARING",severity:"MAJOR",mechanism:"Retención aditiva de potasio: hiperkalemia grave.",recommendation:"Vigilar potasio sérico al inicio y tras cada ajuste; evitar suplementos de potasio.",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"ACE_INHIBITOR",classB:"ARB",severity:"MODERATE",mechanism:"Doble bloqueo del SRAA: hiperkalemia y deterioro de la función renal.",recommendation:"Evitar la combinación de rutina; si se usa, monitorizar potasio y creatinina.",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"ACE_INHIBITOR",classB:"NSAID",severity:"MODERATE",mechanism:"El AINE reduce la perfusión renal y antagoniza el efecto antihipertensivo del IECA.",recommendation:"Limitar el AINE a cursos cortos; vigilar presión arterial y función renal (triple whammy con diurético).",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
 // Auditoría C-17 — pares clásicos que faltaban.
 {classA:"ANTICOAGULANT",classB:"ANTICOAGULANT",severity:"CONTRAINDICATED",mechanism:"Doble anticoagulación: hemorragia mayor sin beneficio adicional (salvo puente transitorio programado).",recommendation:"No combinar; si es un puente heparina–warfarina, protocolo explícito con INR y suspensión programada.",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"ANTICOAGULANT",classB:"SULFONAMIDE",severity:"MAJOR",mechanism:"Trimetoprima-sulfametoxazol inhibe el CYP2C9 y desplaza a la warfarina de la albúmina: elevación brusca del INR.",recommendation:"Evitar; si es imprescindible, INR a las 48–72 h y reducir la dosis de warfarina.",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"ANTICOAGULANT",classB:"MACROLIDE",severity:"MAJOR",mechanism:"Los macrólidos (claritromicina, eritromicina, en menor grado azitromicina) inhiben el CYP3A4 y reducen la flora productora de vitamina K: potenciación de la anticoagulación.",recommendation:"Preferir otro antibiótico; si no, INR a los 3–5 días.",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
 // ---- Auditoría 2026-09-19, anexo R03 (R03-25 y F13): pares que el anexo probó con AMBOS fármacos en el catálogo y
 // devolvían `findings:[]`. No eran huecos de cobertura del catálogo: eran huecos de la tabla. ----
 {classA:"POTASSIUM_SPARING",classB:"SULFONAMIDE_ANTIBIOTIC",severity:"MAJOR",mechanism:"La trimetoprima bloquea el canal de sodio del túbulo distal como un diurético ahorrador de potasio: hiperkalemia grave aditiva.",recommendation:"Evitar la combinación en mayores de 65 años; si es imprescindible, potasio sérico a las 72 h y suspender ante K+ >5.5 mEq/L.",source:"Antoniou T et al., BMJ 2011;343:d5228 (muerte súbita por hiperkalemia en ancianos con espironolactona + TMP-SMX)",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"ACE_INHIBITOR",classB:"SULFONAMIDE_ANTIBIOTIC",severity:"MAJOR",mechanism:"Efecto aditivo sobre la excreción de potasio (IECA reduce la aldosterona; la trimetoprima bloquea su canal): hiperkalemia.",recommendation:"Preferir otro antibiótico; si no es posible, controlar potasio y creatinina a las 72 h.",source:"Fralick M et al., BMJ 2014;349:g6196",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"ARB",classB:"SULFONAMIDE_ANTIBIOTIC",severity:"MAJOR",mechanism:"Mismo mecanismo aditivo de retención de potasio que con los IECA.",recommendation:"Preferir otro antibiótico; si no es posible, controlar potasio y creatinina a las 72 h.",source:"Fralick M et al., BMJ 2014;349:g6196",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"QT_PROLONGING",classB:"QT_PROLONGING",severity:"MAJOR",mechanism:"Prolongación ADITIVA del intervalo QT: riesgo de torsades de pointes (citalopram, azitromicina, ondansetrón, amiodarona, fluoroquinolonas, haloperidol).",recommendation:"Evitar la combinación; si es imprescindible, ECG con QTc antes y durante, corregir potasio y magnesio, y revisar la dosis (citalopram máximo 40 mg/día, 20 mg si >60 años).",source:"FDA Drug Safety Communication citalopram (2012); CredibleMeds / AHA-ACC-HRS statement on QT drugs 2010",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"SALICYLATE",classB:"NSAID",severity:"MODERATE",mechanism:"El AINE compite por la COX-1 plaquetaria y antagoniza la inhibición irreversible del ácido acetilsalicílico: pérdida de la cardioprotección.",recommendation:"Si el AINE es imprescindible en un paciente con AAS cardioprotector, administrar el AAS 2 h antes del ibuprofeno (o preferir paracetamol/naproxeno pautado).",source:"FDA Drug Safety Communication 2006 (ibuprofeno y aspirina); EMA PRAC",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"ANTICOAGULANT",classB:"ANALGESIC_ANTIPYRETIC",severity:"MODERATE",mechanism:"El paracetamol en dosis sostenida (≥2 g/día por varios días) eleva el INR de los antagonistas de la vitamina K.",recommendation:"Aceptable como analgésico de elección, pero controlar el INR si se usa ≥2 g/día más de 3 días.",source:"Mahé I et al., Haematologica 2006;91:1621-7",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"STATIN",classB:"MACROLIDE",severity:"MAJOR",mechanism:"La claritromicina inhibe el CYP3A4 y multiplica la exposición a simvastatina/atorvastatina: rabdomiólisis.",recommendation:"Suspender la estatina durante el macrólido (o preferir azitromicina, que casi no inhibe CYP3A4).",source:"Patel AM et al., Ann Intern Med 2013;158:869-76",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"DIGITALIS",classB:"MACROLIDE",severity:"MODERATE",mechanism:"Los macrólidos reducen la flora que inactiva la digoxina y aumentan su concentración: intoxicación digitálica.",recommendation:"Vigilar náusea, alteraciones visuales y bradicardia; considerar digoxinemia.",source:"Ficha técnica de digoxina; Gomes T et al., Arch Intern Med 2009",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"BENZODIAZEPINE",classB:"OPIOID",severity:"MAJOR",mechanism:"Depresión respiratoria y sedación aditivas: la combinación multiplica el riesgo de sobredosis fatal.",recommendation:"Evitar la coprescripción; si es inevitable, la dosis mínima eficaz, duración mínima y advertir al paciente/cuidador.",source:"FDA Boxed Warning 2016 (opioides + benzodiacepinas)",reviewedAt:INTERACTIONS_REVIEWED_AT},
 {classA:"OPIOID",classB:"NSAID",severity:"MINOR",mechanism:"Combinación analgésica frecuente; sin interacción farmacocinética relevante.",recommendation:"Combinación aceptable para dolor moderado; vigilar tolerancia gastrointestinal del AINE.",source:"Interacción de consenso (fichas técnicas y vademécum clínico); pendiente de contraste con fuente oficial versionada",reviewedAt:INTERACTIONS_REVIEWED_AT},
];
function richPairFor(a:readonly string[],b:readonly string[]):RichInteraction|undefined{
 const sa=new Set(a),sb=new Set(b);let best:RichInteraction|undefined;
 for(const i of RICH_INTERACTIONS){
  const hit=(sa.has(i.classA)&&sb.has(i.classB))||(sa.has(i.classB)&&sb.has(i.classA));
  if(hit&&(!best||SEVERITY_RANK[i.severity]>SEVERITY_RANK[best.severity]))best=i;
 }
 return best;
}

// Factores del paciente (no farmacológicos) que modulan la seguridad de una clase. Código canónico + sinónimos.
// Auditoría 2026-09-19, anexo R03 (R03-29): la LACTANCIA no existía como factor, y es una decisión de prescripción
// distinta del embarazo (lo que pasa al recién nacido por la leche no es lo que atraviesa la placenta).
export type PatientFactor="ALCOHOL"|"RENAL_IMPAIRMENT"|"HEPATIC_IMPAIRMENT"|"PREGNANCY"|"LACTATION"|"ELDERLY";
const FACTOR_SYNONYMS:Record<PatientFactor,readonly string[]>={
 ALCOHOL:["alcohol","consumo de alcohol","etilismo","alcoholismo","alcohol activo"],
 RENAL_IMPAIRMENT:["insuficiencia renal","enfermedad renal","erc","falla renal","renal","tfg baja"],
 HEPATIC_IMPAIRMENT:["insuficiencia hepatica","hepatopatia","enfermedad hepatica","cirrosis","hepatico"],
 PREGNANCY:["embarazo","gestacion","embarazada","gestante"],
 LACTATION:["lactancia","lactando","amamantando","seno materno","puerperio con lactancia"],
 ELDERLY:["adulto mayor","edad avanzada","anciano","geriatrico","mayor de 65"],
};
export const FACTOR_LABEL:Record<PatientFactor,string>={ALCOHOL:"Consumo de alcohol",RENAL_IMPAIRMENT:"Insuficiencia renal",HEPATIC_IMPAIRMENT:"Insuficiencia hepática",PREGNANCY:"Embarazo",LACTATION:"Lactancia",ELDERLY:"Adulto mayor"};
export type FactorRule=Readonly<{factor:PatientFactor;drugClass:string;severity:InteractionSeverity;mechanism:string;recommendation:string}>;
const FACTOR_RULES:readonly FactorRule[]=[
 {factor:"ALCOHOL",drugClass:"SSRI",severity:"MODERATE",mechanism:"Potenciación de la depresión del sistema nervioso central y aumento del riesgo de sangrado digestivo.",recommendation:"Aconsejar evitar el alcohol durante el tratamiento con el SSRI."},
 {factor:"ALCOHOL",drugClass:"NSAID",severity:"MODERATE",mechanism:"Efecto gastroerosivo aditivo: mayor riesgo de hemorragia digestiva.",recommendation:"Evitar alcohol; considerar gastroprotección si el AINE es prolongado."},
 {factor:"ALCOHOL",drugClass:"OPIOID",severity:"MAJOR",mechanism:"Depresión respiratoria y del SNC aditiva: riesgo de sedación grave.",recommendation:"Contraindicar el consumo de alcohol durante el tratamiento opioide."},
 {factor:"ALCOHOL",drugClass:"BIGUANIDE",severity:"MODERATE",mechanism:"El alcohol aumenta el riesgo de acidosis láctica con metformina.",recommendation:"Evitar el consumo agudo/excesivo de alcohol."},
 // Hepatotóxicos + alcohol (antecedente de alcoholismo / F10). El alcohol crónico depleta el glutatión e induce CYP2E1:
 {factor:"ALCOHOL",drugClass:"ANALGESIC_ANTIPYRETIC",severity:"MODERATE",mechanism:"El alcohol crónico induce el CYP2E1 y depleta el glutatión: el paracetamol puede ser hepatotóxico incluso a dosis terapéuticas.",recommendation:"Limitar el paracetamol (≤2 g/día) y evitarlo en consumo intenso/crónico de alcohol; vigilar transaminasas si se prolonga."},
 {factor:"ALCOHOL",drugClass:"STATIN",severity:"MODERATE",mechanism:"Riesgo aditivo de hepatotoxicidad: tanto la estatina como el alcohol pueden elevar las transaminasas.",recommendation:"Vigilar transaminasas al inicio y ante síntomas; aconsejar moderar/evitar el alcohol."},
 {factor:"RENAL_IMPAIRMENT",drugClass:"BIGUANIDE",severity:"MODERATE",mechanism:"Disminución de la eliminación renal de metformina: acumulación y riesgo de acidosis láctica.",recommendation:"Ajustar dosis según TFGe; contraindicada si TFGe<30 mL/min."},
 {factor:"RENAL_IMPAIRMENT",drugClass:"NSAID",severity:"MINOR",mechanism:"Inhibición de prostaglandinas renales: reducción de la perfusión renal.",recommendation:"Usar la dosis mínima efectiva por el menor tiempo posible y vigilar la función renal."},
 {factor:"RENAL_IMPAIRMENT",drugClass:"ACE_INHIBITOR",severity:"MODERATE",mechanism:"Riesgo de deterioro de la función renal e hiperkalemia en enfermedad renal.",recommendation:"Vigilar potasio y creatinina; nefroprotector pero requiere monitoreo estrecho."},
 {factor:"HEPATIC_IMPAIRMENT",drugClass:"OPIOID",severity:"MODERATE",mechanism:"Metabolismo hepático reducido: acumulación y sedación prolongada.",recommendation:"Reducir dosis y espaciar intervalos; vigilar nivel de conciencia."},
 {factor:"PREGNANCY",drugClass:"NSAID",severity:"MAJOR",mechanism:"AINE en el 3.º trimestre: cierre precoz del conducto arterioso y oligohidramnios.",recommendation:"Evitar AINE en el embarazo, en especial el 3.º trimestre; preferir paracetamol."},
 {factor:"PREGNANCY",drugClass:"ACE_INHIBITOR",severity:"CONTRAINDICATED",mechanism:"Fetotoxicidad (oligohidramnios, daño renal fetal, malformaciones).",recommendation:"Contraindicado en el embarazo; suspender y cambiar a antihipertensivo seguro (p. ej. metildopa)."},
 {factor:"PREGNANCY",drugClass:"ARB",severity:"CONTRAINDICATED",mechanism:"Fetotoxicidad análoga a los IECA.",recommendation:"Contraindicado en el embarazo; suspender y cambiar a antihipertensivo seguro."},
 // Auditoría C-17 — faltaban: warfarina en embarazo; y el factor "adulto mayor" se reconocía pero no tenía ninguna regla.
 {factor:"PREGNANCY",drugClass:"ANTICOAGULANT",severity:"CONTRAINDICATED",mechanism:"Warfarina: embriopatía (6.ª–12.ª semana) y hemorragia fetal; los anticoagulantes orales directos no están estudiados en el embarazo.",recommendation:"Cambiar a heparina de bajo peso molecular durante el embarazo."},
 {factor:"ELDERLY",drugClass:"NSAID",severity:"MODERATE",mechanism:"Criterios de Beers: en mayores de 65 años el AINE crónico aumenta el sangrado digestivo, la lesión renal aguda y la descompensación de insuficiencia cardíaca.",recommendation:"Evitar el uso crónico; si se usa, dosis mínima, ciclo corto y gastroprotección; vigilar creatinina."},
 {factor:"ELDERLY",drugClass:"OPIOID",severity:"MODERATE",mechanism:"Mayor sensibilidad a la sedación y depresión respiratoria; caídas y delirium.",recommendation:"Iniciar con dosis bajas, titular despacio, evitar combinar con otros depresores."},
 // Auditoría R03-29 — embarazo: faltaban las clases que el anexo nombró (sulfonamidas) y las de riesgo conocido.
 {factor:"PREGNANCY",drugClass:"SULFONAMIDE_ANTIBIOTIC",severity:"MAJOR",mechanism:"Trimetoprima: antagonista del folato (riesgo de defectos del tubo neural en el 1.º trimestre). Sulfametoxazol cerca del término: desplaza la bilirrubina y puede provocar kernícterus en el recién nacido.",recommendation:"Evitar en el 1.º trimestre y en las últimas semanas; preferir otro antibiótico. Si es imprescindible, suplementar folato."},
 {factor:"PREGNANCY",drugClass:"STATIN",severity:"CONTRAINDICATED",mechanism:"El colesterol es esencial para el desarrollo fetal; la exposición no tiene beneficio materno que compense en el embarazo.",recommendation:"Suspender la estatina durante el embarazo y la lactancia; retomar después."},
 {factor:"PREGNANCY",drugClass:"FLUOROQUINOLONE",severity:"MAJOR",mechanism:"Toxicidad sobre el cartílago en modelos animales; alternativas más seguras disponibles.",recommendation:"Preferir betalactámico o nitrofurantoína según el foco; reservar para cuando no haya alternativa."},
 {factor:"PREGNANCY",drugClass:"BENZODIAZEPINE",severity:"MAJOR",mechanism:"Uso sostenido cerca del término: síndrome de abstinencia neonatal y síndrome del lactante hipotónico.",recommendation:"Evitar el uso crónico; si es imprescindible, la dosis mínima y avisar a neonatología."},
 {factor:"PREGNANCY",drugClass:"THIAZIDE",severity:"MODERATE",mechanism:"Reducción del volumen plasmático materno y alteraciones electrolíticas neonatales.",recommendation:"Preferir alfametildopa, labetalol o nifedipino como antihipertensivos en el embarazo."},
 // Auditoría R03-29 — LACTANCIA: lo que pasa a la leche no es lo que atraviesa la placenta, así que son reglas propias.
 {factor:"LACTATION",drugClass:"OPIOID",severity:"CONTRAINDICATED",mechanism:"Codeína y tramadol: metabolizadores rápidos de CYP2D6 concentran morfina/O-desmetiltramadol en la leche; hay muertes neonatales descritas.",recommendation:"Contraindicados durante la lactancia (FDA 2017). Usar paracetamol o ibuprofeno."},
 {factor:"LACTATION",drugClass:"ANTIARRHYTHMIC",severity:"MAJOR",mechanism:"Amiodarona: vida media de semanas y alto contenido de yodo; se acumula en la leche y bloquea la tiroides del lactante.",recommendation:"Evitar durante la lactancia; si es imprescindible, suspender la lactancia y vigilar la tiroides del lactante."},
 {factor:"LACTATION",drugClass:"SULFONAMIDE_ANTIBIOTIC",severity:"MODERATE",mechanism:"Riesgo de kernícterus en el lactante ictérico, prematuro o con déficit de G6PD.",recommendation:"Evitar en el primer mes y en lactantes prematuros o con ictericia; preferir otro antibiótico."},
 {factor:"LACTATION",drugClass:"BENZODIAZEPINE",severity:"MODERATE",mechanism:"Sedación y dificultad para alimentarse en el lactante, sobre todo con dosis repetidas.",recommendation:"Dosis única y la mínima eficaz; vigilar somnolencia y la succión del lactante."},
 {factor:"LACTATION",drugClass:"STATIN",severity:"MAJOR",mechanism:"Sin datos de seguridad y el colesterol es necesario para el desarrollo del lactante.",recommendation:"Suspender durante la lactancia."},
 {factor:"ELDERLY",drugClass:"SSRI",severity:"MINOR",mechanism:"Hiponatremia por SIADH y riesgo de caídas al inicio del tratamiento.",recommendation:"Sodio sérico a las 2–4 semanas del inicio; vigilar mareo/caídas."},
];
// Normaliza una etiqueta libre de factor a su código canónico (o undefined si no se reconoce).
export function resolveFactor(raw:string):PatientFactor|undefined{
 const s=norm(raw);
 for(const[code,syns]of Object.entries(FACTOR_SYNONYMS) as [PatientFactor,readonly string[]][])
  if(syns.some(x=>s.includes(norm(x))))return code;
 return undefined;
}

export type InteractionFinding=Readonly<{
 kind:"pair"|"factor";
 severity:InteractionSeverity;
 a:string;            // fármaco (nombre resuelto)
 b:string;            // otro fármaco (pair) o etiqueta del factor (factor)
 mechanism:string;
 recommendation:string;
}>;
export type InteractionSetResult=Readonly<{
 findings:readonly InteractionFinding[];
 counts:Readonly<Record<InteractionSeverity,number>>;
 unresolvedDrugs:readonly string[];   // fármacos no reconocidos en el catálogo (transparencia)
 unresolvedFactors:readonly string[]; // factores no reconocidos
 highestSeverity:InteractionSeverity|null;
}>;
// Evalúa TODO el conjunto: cada par de fármacos entre sí + cada fármaco contra cada factor del paciente.
// Devuelve los hallazgos ordenados de mayor a menor severidad, con conteos por nivel y transparencia de lo no resuelto.
export function checkInteractionSet(drugCodes:readonly string[],factorLabels:readonly string[]=[]):InteractionSetResult{
 const resolved=drugCodes.map(c=>({code:c,drug:resolveDrug(c)}));
 const unresolvedDrugs=resolved.filter(r=>!r.drug).map(r=>r.code);
 const known=resolved.filter((r):r is{code:string;drug:DrugEntry}=>!!r.drug);
 const findings:InteractionFinding[]=[];
 // 1) pares fármaco–fármaco (combinaciones sin repetición)
 for(let i=0;i<known.length;i++)for(let j=i+1;j<known.length;j++){
  const A=known[i]!,B=known[j]!;
  if(A.drug.ingredient===B.drug.ingredient)continue; // el mismo principio activo es duplicación, no interacción
  const hit=richPairFor(A.drug.classes,B.drug.classes);
  if(hit)findings.push({kind:"pair",severity:hit.severity,a:A.drug.ingredient,b:B.drug.ingredient,mechanism:hit.mechanism,recommendation:hit.recommendation});
 }
 // 2) fármaco–factor del paciente
 const factors=factorLabels.map(f=>({label:f,code:resolveFactor(f)}));
 const unresolvedFactors=factors.filter(f=>!f.code).map(f=>f.label);
 for(const f of factors){if(!f.code)continue;
  for(const k of known){
   const rule=FACTOR_RULES.find(r=>r.factor===f.code&&k.drug.classes.includes(r.drugClass));
   if(rule)findings.push({kind:"factor",severity:rule.severity,a:k.drug.ingredient,b:FACTOR_LABEL[f.code],mechanism:rule.mechanism,recommendation:rule.recommendation});
  }
 }
 findings.sort((x,y)=>SEVERITY_RANK[y.severity]-SEVERITY_RANK[x.severity]);
 const counts:Record<InteractionSeverity,number>={CONTRAINDICATED:0,MAJOR:0,MODERATE:0,MINOR:0};
 for(const f of findings)counts[f.severity]++;
 const highestSeverity=findings.length?findings[0]!.severity:null;
 return{findings,counts,unresolvedDrugs,unresolvedFactors,highestSeverity};
}

// EPIC AP/UI — Catálogo determinista para la vista Medicamentos. Ensambla, a partir de la base de fármacos
// y las reglas puras ya definidas, un catálogo deduplicado por principio activo con su categoría terapéutica
// (en español), reglas de monitoreo aplicables y regla renal (contraindicación/precaución por TFG). Puro, sin PHI.
// Subconjunto de demostración; el catálogo oficial (RxNorm/COFEPRIS) se cargaría de la fuente autorizada.
const CATEGORY_BY_CLASS:Record<string,string>={PENICILLIN:"Antibiótico (penicilinas)",CEPHALOSPORIN:"Antibiótico (cefalosporinas)",BETA_LACTAM:"Antibiótico betalactámico",MACROLIDE:"Antibiótico (macrólidos)",LINCOSAMIDE:"Antibiótico (lincosamidas)",SULFONAMIDE:"Antibiótico (sulfonamidas)",ANALGESIC_ANTIPYRETIC:"Analgésico / antipirético",NSAID:"AINE",SALICYLATE:"Salicilato",ANTICOAGULANT:"Anticoagulante",ACE_INHIBITOR:"IECA (antihipertensivo)",ARB:"ARA II (antihipertensivo)",POTASSIUM_SPARING:"Diurético ahorrador de potasio",BIGUANIDE:"Antidiabético (biguanida)",SSRI:"Antidepresivo (ISRS)",SEROTONERGIC:"Serotoninérgico",OPIOID:"Opioide"};
export type DrugCatalogItem=Readonly<{code:string;ingredient:string;classes:readonly string[];category:string;monitoring:readonly MonitoringRule[];renal:RenalRule&{drugClass:string}|null}>;
// Categoría del fármaco = etiqueta de su primera clase con categoría conocida (o "Otros").
function categoryFor(classes:readonly string[]):string{for(const c of classes){const l=CATEGORY_BY_CLASS[c];if(l)return l;}return"Otros";}
function renalRuleFor(classes:readonly string[],ingredient?:string):(RenalRule&{drugClass:string})|null{
 if(ingredient){const ri=RENAL_RULES_BY_INGREDIENT[ingredient];if(ri)return{...ri,drugClass:ingredient};}
 for(const c of classes){const r=RENAL_RULES_BY_CLASS[c];if(r)return{...r,drugClass:c};}return null;}
export function drugCatalog():DrugCatalogItem[]{
 const seen=new Set<string>();const out:DrugCatalogItem[]=[];
 for(const[code,entry]of Object.entries(DRUGS)){
  if(seen.has(entry.ingredient))continue;seen.add(entry.ingredient);
  out.push({code,ingredient:entry.ingredient,classes:entry.classes,category:categoryFor(entry.classes),monitoring:monitoringFor(code),renal:renalRuleFor(entry.classes,entry.ingredient)}); // C-15: la regla del ingrediente manda
 }
 return out.sort((a,b)=>a.ingredient.localeCompare(b.ingredient,"es"));
}
// Matriz de interacciones por clase (para paneles de conocimiento/alertas de la UI). Copia inmutable.
// Reglas de la barrera (derivadas de la tabla única; sin las MINOR).
// ---------- Auditoría 2026-09-19, anexo R03 (R03-23): la COBERTURA REAL, medida y declarada ----------
//
// El catálogo es un subconjunto curado, no un vademécum oficial. Eso no es un defecto en sí; el defecto era que nadie
// podía saberlo desde la respuesta: las barreras devolvían un veredicto sin decir sobre cuántos fármacos y cuántas
// reglas se había construido. Ahora la cobertura se CALCULA de las tablas (no se escribe a mano, así que no puede
// quedar obsoleta) y viaja en la respuesta de la verificación de prescripción.
export const DRUG_CATALOG_VERSION="2026-09-24";

// ---------- Auditoría 2026-09-19, anexo R03 (vector F11): PRESENTACIONES del catálogo ----------
// El techo de dosis resolvía «2 tab» con el SUFIJO DEL CÓDIGO (`ibuprofeno-400` → 400 mg). Funciona cuando el código
// trae la concentración, pero el código es texto que teclea alguien: `ibuprofeno-4000` (un cero de más) se aceptaba como
// una presentación de 4 g y «2 tab» pasaba el techo sin objeción. Ahora las presentaciones REALES están en el catálogo:
// una concentración que no existe se rechaza, y un fármaco con presentación única se resuelve sin depender del sufijo.
export type DoseForm="TABLET"|"CAPSULE"|"SUSPENSION"|"AMPOULE"|"DROPS";
export type Presentation=Readonly<{strengthMg:number;form:DoseForm;perMl?:number}>;
const PRESENTATIONS:Readonly<Record<string,readonly Presentation[]>>={
 paracetamol:[{strengthMg:500,form:"TABLET"},{strengthMg:750,form:"TABLET"},{strengthMg:1000,form:"TABLET"},{strengthMg:100,form:"DROPS",perMl:1},{strengthMg:120,form:"SUSPENSION",perMl:5}],
 ibuprofeno:[{strengthMg:200,form:"TABLET"},{strengthMg:400,form:"TABLET"},{strengthMg:600,form:"TABLET"},{strengthMg:800,form:"TABLET"},{strengthMg:100,form:"SUSPENSION",perMl:5}],
 naproxeno:[{strengthMg:250,form:"TABLET"},{strengthMg:500,form:"TABLET"},{strengthMg:550,form:"TABLET"}],
 diclofenaco:[{strengthMg:50,form:"TABLET"},{strengthMg:75,form:"AMPOULE"},{strengthMg:100,form:"TABLET"}],
 ketorolaco:[{strengthMg:10,form:"TABLET"},{strengthMg:30,form:"AMPOULE"}],
 metamizol:[{strengthMg:500,form:"TABLET"},{strengthMg:1000,form:"AMPOULE"}],
 amoxicilina:[{strengthMg:500,form:"CAPSULE"},{strengthMg:875,form:"TABLET"},{strengthMg:250,form:"SUSPENSION",perMl:5}],
 dicloxacilina:[{strengthMg:500,form:"CAPSULE"},{strengthMg:250,form:"SUSPENSION",perMl:5}],
 cefalexina:[{strengthMg:500,form:"CAPSULE"},{strengthMg:250,form:"SUSPENSION",perMl:5}],
 azitromicina:[{strengthMg:500,form:"TABLET"},{strengthMg:200,form:"SUSPENSION",perMl:5}],
 clindamicina:[{strengthMg:300,form:"CAPSULE"},{strengthMg:600,form:"AMPOULE"}],
 sulfametoxazol:[{strengthMg:800,form:"TABLET"},{strengthMg:400,form:"TABLET"},{strengthMg:200,form:"SUSPENSION",perMl:5}],
 metformina:[{strengthMg:500,form:"TABLET"},{strengthMg:850,form:"TABLET"},{strengthMg:1000,form:"TABLET"}],
 enalapril:[{strengthMg:5,form:"TABLET"},{strengthMg:10,form:"TABLET"},{strengthMg:20,form:"TABLET"}],
 losartan:[{strengthMg:50,form:"TABLET"},{strengthMg:100,form:"TABLET"}],
 espironolactona:[{strengthMg:25,form:"TABLET"},{strengthMg:100,form:"TABLET"}],
 citalopram:[{strengthMg:20,form:"TABLET"}],
 sertralina:[{strengthMg:50,form:"TABLET"},{strengthMg:100,form:"TABLET"}],
 fluoxetina:[{strengthMg:20,form:"CAPSULE"}],
 tramadol:[{strengthMg:50,form:"CAPSULE"},{strengthMg:100,form:"AMPOULE"}],
 warfarina:[{strengthMg:5,form:"TABLET"}],
 rivaroxaban:[{strengthMg:15,form:"TABLET"},{strengthMg:20,form:"TABLET"}],
 atorvastatina:[{strengthMg:20,form:"TABLET"},{strengthMg:40,form:"TABLET"},{strengthMg:80,form:"TABLET"}],
 amlodipino:[{strengthMg:5,form:"TABLET"},{strengthMg:10,form:"TABLET"}],
 metoprolol:[{strengthMg:50,form:"TABLET"},{strengthMg:100,form:"TABLET"}],
 prednisona:[{strengthMg:5,form:"TABLET"},{strengthMg:50,form:"TABLET"}],
 omeprazol:[{strengthMg:20,form:"CAPSULE"},{strengthMg:40,form:"CAPSULE"}],
 levotiroxina:[{strengthMg:0.05,form:"TABLET"},{strengthMg:0.075,form:"TABLET"},{strengthMg:0.1,form:"TABLET"}],
};
/** Presentaciones conocidas del principio activo. `[]` si el catálogo no las tiene declaradas. */
export function presentationsFor(drugCode:string):readonly Presentation[]{
 const d=resolveDrug(drugCode);return d?PRESENTATIONS[d.ingredient]??[]:[];
}
export type UnitStrength=Readonly<{strengthMg:number;source:"CODE_MATCHES_CATALOG"|"CATALOG_SINGLE_PRESENTATION"|"CODE_ONLY"}>
 |Readonly<{strengthMg:null;reason:"NOT_IN_CATALOG_PRESENTATIONS"|"AMBIGUOUS"|"UNKNOWN"}>;
/**
 * Concentración por unidad de forma farmacéutica («1 tab» = ¿cuántos mg?), resuelta contra el CATÁLOGO.
 *  · el código declara una concentración que el catálogo confirma -> se usa;
 *  · el código declara una que NO existe -> se rechaza (`NOT_IN_CATALOG_PRESENTATIONS`): «2 tab» no se acota con un dato inventado;
 *  · el código no la declara y el fármaco tiene UNA sola presentación sólida -> se usa la del catálogo;
 *  · varias presentaciones y ninguna declarada -> `AMBIGUOUS` (no se adivina).
 */
export function unitStrengthFromCatalog(drugCode:string,codeStrengthMg?:number):UnitStrength{
 const pres=presentationsFor(drugCode);
 const solidas=pres.filter(p=>p.form==="TABLET"||p.form==="CAPSULE");
 if(codeStrengthMg!==undefined&&Number.isFinite(codeStrengthMg)&&codeStrengthMg>0){
  if(pres.length===0)return{strengthMg:codeStrengthMg,source:"CODE_ONLY"};      // sin presentaciones declaradas: lo que dice el código
  return pres.some(p=>Math.abs(p.strengthMg-codeStrengthMg)<1e-9)
   ?{strengthMg:codeStrengthMg,source:"CODE_MATCHES_CATALOG"}
   :{strengthMg:null,reason:"NOT_IN_CATALOG_PRESENTATIONS"};
 }
 if(solidas.length===1)return{strengthMg:solidas[0]!.strengthMg,source:"CATALOG_SINGLE_PRESENTATION"};
 return{strengthMg:null,reason:solidas.length>1?"AMBIGUOUS":"UNKNOWN"};
}
export type CatalogCoverage=Readonly<{version:string;ingredients:number;interactionPairs:number;interactionsReviewedAt:string;
 renalRulesByIngredient:number;renalRulesByClass:number;monitoringRules:number;factorRules:number;conditionRules:number;
 sourceNote:string}>;
export function catalogCoverage():CatalogCoverage{
 const ingredients=new Set(Object.values(DRUGS).map(d=>d.ingredient)).size;
 return{version:DRUG_CATALOG_VERSION,ingredients,interactionPairs:RICH_INTERACTIONS.length,interactionsReviewedAt:INTERACTIONS_REVIEWED_AT,
  renalRulesByIngredient:Object.keys(RENAL_RULES_BY_INGREDIENT).length,renalRulesByClass:Object.keys(RENAL_RULES_BY_CLASS).length,
  monitoringRules:Object.keys(MONITORING_BY_CLASS).length,factorRules:FACTOR_RULES.length,conditionRules:CONTRAINDICATIONS.length,
  sourceNote:`Subconjunto curado de ${ingredients} principios activos de uso frecuente en atención primaria en México, con las fuentes citadas fila por fila. NO es un vademécum oficial: un fármaco fuera de este catálogo devuelve NOT_EVALUATED en todas las barreras (nunca «sin hallazgos»). Cargar RxNorm/COFEPRIS versionado es decisión del dueño del producto.`};
}
export function interactionRules():readonly DrugInteraction[]{return RICH_INTERACTIONS.flatMap(r=>{const s=barrierSeverity(r.severity);return s?[{classA:r.classA,classB:r.classB,severity:s,note:r.mechanism}]:[];});}
export function richInteractionRules():readonly RichInteraction[]{return RICH_INTERACTIONS;}
