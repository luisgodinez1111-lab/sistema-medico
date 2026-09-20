// EPIC AP — Catálogo de fármacos + verificación de alergia por clase y REACTIVIDAD CRUZADA (PROFUNDIDAD/seguridad).
// Reemplaza el match por subcadena (frágil) por match de principio activo + clase de alérgeno, incluyendo
// reactividad cruzada beta-lactámicos (una alergia a penicilina bloquea también cefalosporinas). Puro, sin PHI.
// Subconjunto de demostración; el catálogo oficial (p. ej. RxNorm/COFEPRIS) se cargaría de la fuente autorizada.
// Autoridad: PROD (seguridad de la prescripción / alertas de alergia), CAP-DRUG-ALLERGY-001.
export type DrugEntry=Readonly<{ingredient:string;classes:readonly string[]}>;
// clave = principio activo normalizado (lowercase, sin acentos). classes = grupos de alérgenos.
const DRUGS:Record<string,DrugEntry>={
 "amoxicilina":{ingredient:"amoxicilina",classes:["PENICILLIN","BETA_LACTAM"]},
 "ampicilina":{ingredient:"ampicilina",classes:["PENICILLIN","BETA_LACTAM"]},
 "penicilina":{ingredient:"penicilina",classes:["PENICILLIN","BETA_LACTAM"]},
 "dicloxacilina":{ingredient:"dicloxacilina",classes:["PENICILLIN","BETA_LACTAM"]},
 "cefalexina":{ingredient:"cefalexina",classes:["CEPHALOSPORIN","BETA_LACTAM"]},
 "ceftriaxona":{ingredient:"ceftriaxona",classes:["CEPHALOSPORIN","BETA_LACTAM"]},
 "cefuroxima":{ingredient:"cefuroxima",classes:["CEPHALOSPORIN","BETA_LACTAM"]},
 "paracetamol":{ingredient:"paracetamol",classes:["ANALGESIC_ANTIPYRETIC"]},
 "acetaminofen":{ingredient:"paracetamol",classes:["ANALGESIC_ANTIPYRETIC"]},
 "ibuprofeno":{ingredient:"ibuprofeno",classes:["NSAID"]},
 "naproxeno":{ingredient:"naproxeno",classes:["NSAID"]},
 "ketorolaco":{ingredient:"ketorolaco",classes:["NSAID"]},
 "aspirina":{ingredient:"aspirina",classes:["NSAID","SALICYLATE"]},
 "sulfametoxazol":{ingredient:"sulfametoxazol",classes:["SULFONAMIDE"]},
 "trimetoprima-sulfametoxazol":{ingredient:"sulfametoxazol",classes:["SULFONAMIDE"]},
 "azitromicina":{ingredient:"azitromicina",classes:["MACROLIDE"]},
 "clindamicina":{ingredient:"clindamicina",classes:["LINCOSAMIDE"]},
 // — Fármacos con interacciones relevantes (EPIC AX) —
 "warfarina":{ingredient:"warfarina",classes:["ANTICOAGULANT"]},
 "acenocumarol":{ingredient:"acenocumarol",classes:["ANTICOAGULANT"]},
 "rivaroxaban":{ingredient:"rivaroxaban",classes:["ANTICOAGULANT"]},
 "enalapril":{ingredient:"enalapril",classes:["ACE_INHIBITOR"]},
 "lisinopril":{ingredient:"lisinopril",classes:["ACE_INHIBITOR"]},
 "losartan":{ingredient:"losartan",classes:["ARB"]},
 "espironolactona":{ingredient:"espironolactona",classes:["POTASSIUM_SPARING"]},
 "metformina":{ingredient:"metformina",classes:["BIGUANIDE"]},
 "sertralina":{ingredient:"sertralina",classes:["SSRI","SEROTONERGIC"]},
 "fluoxetina":{ingredient:"fluoxetina",classes:["SSRI","SEROTONERGIC"]},
 "citalopram":{ingredient:"citalopram",classes:["SSRI","SEROTONERGIC"]},
 "tramadol":{ingredient:"tramadol",classes:["OPIOID","SEROTONERGIC"]},
};

// EPIC AX — Interacciones farmacológicas por clase (pares peligrosos conocidos). Severidad MAJOR = bloquea.
export type DrugInteraction=Readonly<{classA:string;classB:string;severity:"MAJOR"|"MODERATE";note:string}>;
const INTERACTIONS:readonly DrugInteraction[]=[
 {classA:"ANTICOAGULANT",classB:"NSAID",severity:"MAJOR",note:"Riesgo de hemorragia mayor"},
 {classA:"ANTICOAGULANT",classB:"SALICYLATE",severity:"MAJOR",note:"Riesgo de hemorragia mayor"},
 {classA:"ACE_INHIBITOR",classB:"POTASSIUM_SPARING",severity:"MAJOR",note:"Hiperkalemia"},
 {classA:"ARB",classB:"POTASSIUM_SPARING",severity:"MAJOR",note:"Hiperkalemia"},
 {classA:"ACE_INHIBITOR",classB:"ARB",severity:"MODERATE",note:"Doble bloqueo del SRAA: hiperkalemia/lesión renal"},
 {classA:"ACE_INHIBITOR",classB:"NSAID",severity:"MODERATE",note:"Deterioro de función renal (triple whammy con diurético)"},
];
function interactionFor(a:readonly string[],b:readonly string[]):DrugInteraction|undefined{
 const sa=new Set(a),sb=new Set(b);
 return INTERACTIONS.find(i=>(sa.has(i.classA)&&sb.has(i.classB))||(sa.has(i.classB)&&sb.has(i.classA)));
}
// `evaluated=false` => el fármaco a prescribir NO está en el catálogo: NO se verificó nada (nunca leer como "sin
// interacciones"). `unresolvedActive` = fármacos activos del paciente fuera de catálogo (cobertura parcial).
export type InteractionHit=Readonly<{found:boolean;evaluated:boolean;unresolvedActive:readonly string[];severity?:"MAJOR"|"MODERATE";note?:string;conflictDrug?:string}>;
// ¿El fármaco a prescribir interactúa con alguno ya activo? Devuelve la interacción de mayor severidad.
export function checkInteractions(newDrugCode:string,activeDrugCodes:readonly string[]):InteractionHit{
 const nd=resolveDrug(newDrugCode);if(!nd)return{found:false,evaluated:false,unresolvedActive:[]};
 const unresolvedActive=activeDrugCodes.filter(a=>norm(a)!==norm(newDrugCode)&&!resolveDrug(a));
 let best:InteractionHit={found:false,evaluated:true,unresolvedActive};
 for(const active of activeDrugCodes){
  if(norm(active)===norm(newDrugCode))continue;
  const ad=resolveDrug(active);if(!ad)continue;
  const hit=interactionFor(nd.classes,ad.classes);
  if(hit){if(hit.severity==="MAJOR")return{found:true,evaluated:true,unresolvedActive,severity:"MAJOR",note:hit.note,conflictDrug:active};
   if(!best.found)best={found:true,evaluated:true,unresolvedActive,severity:hit.severity,note:hit.note,conflictDrug:active};}
 }
 return best;
}
// EPIC BM — Ajuste/contraindicación renal por FUNCIÓN medida (eGFR). Complementa la contraindicación por
// DIAGNÓSTICO (EPIC AY) con la función renal real. BLOCK si eGFR < umbral de contraindicación; CAUTION si
// < umbral de precaución. Reutiliza las clases del catálogo. Umbrales de demostración (vademécum oficial aparte).
export type RenalRule=Readonly<{blockBelow?:number;cautionBelow?:number;note:string}>;
const RENAL_RULES_BY_CLASS:Record<string,RenalRule>={
 BIGUANIDE:{blockBelow:30,cautionBelow:45,note:"Metformina: contraindicada si TFG<30 (acidosis láctica); ajustar/vigilar entre 30–45"},
 NSAID:{blockBelow:30,note:"AINE: evitar si TFG<30 (nefrotoxicidad / deterioro renal)"},
};
// "OK" SOLO si existe una regla renal para el fármaco y el eGFR la supera. Sin regla en el catálogo => "NOT_COVERED";
// fármaco fuera de catálogo => "NOT_EVALUATED". Ninguno de los dos significa "seguro" (auditoría 2026-09-19, C-03).
export type RenalDosing=Readonly<{action:"BLOCK"|"CAUTION"|"OK"|"NOT_COVERED"|"NOT_EVALUATED";note?:string;threshold?:number;drugClass?:string;reason?:"DRUG_NOT_IN_CATALOG"|"NO_RENAL_RULE"}>;
// ¿El catálogo tiene alguna regla renal para este fármaco? (para distinguir "sin regla" de "regla superada").
export function renalRuleForDrug(drugCode:string):(RenalRule&{drugClass:string})|undefined{
 const d=resolveDrug(drugCode);return d?renalRuleFor(d.classes)??undefined:undefined;
}
// ¿La función renal (eGFR) contraindica o exige precaución para este fármaco? Devuelve la acción más severa.
export function checkRenalDosing(drugCode:string,egfr:number):RenalDosing{
 const d=resolveDrug(drugCode);if(!d)return{action:"NOT_EVALUATED",reason:"DRUG_NOT_IN_CATALOG",note:"Fármaco fuera del catálogo: ajuste renal NO evaluado"};
 if(!renalRuleFor(d.classes))return{action:"NOT_COVERED",reason:"NO_RENAL_RULE",note:"El catálogo no tiene regla renal para este fármaco: ajuste renal NO evaluado"};
 let best:RenalDosing={action:"OK"};
 for(const cl of d.classes){
  const r=RENAL_RULES_BY_CLASS[cl];if(!r)continue;
  if(r.blockBelow!==undefined&&egfr<r.blockBelow)return{action:"BLOCK",note:r.note,threshold:r.blockBelow,drugClass:cl};
  if(r.cautionBelow!==undefined&&egfr<r.cautionBelow&&best.action==="OK")best={action:"CAUTION",note:r.note,threshold:r.cautionBelow,drugClass:cl};
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
const MONITORING_BY_CLASS:Record<string,MonitoringRule>={
 ANTICOAGULANT:{kind:"MONITOR_INR",test:"INR/TP",dueInDays:3,note:"Ajuste de anticoagulación oral"},
 BIGUANIDE:{kind:"MONITOR_RENAL",test:"Creatinina/TFG",dueInDays:90,note:"Riesgo de acidosis láctica: vigilar función renal"},
 ACE_INHIBITOR:{kind:"MONITOR_K_CREAT",test:"Potasio y creatinina",dueInDays:14,note:"Vigilar hiperkalemia y función renal"},
 ARB:{kind:"MONITOR_K_CREAT",test:"Potasio y creatinina",dueInDays:14,note:"Vigilar hiperkalemia y función renal"},
 POTASSIUM_SPARING:{kind:"MONITOR_K",test:"Potasio",dueInDays:14,note:"Vigilar hiperkalemia"},
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
 "sulfa":["SULFONAMIDE"],"sulfamida":["SULFONAMIDE"],"sulfonamida":["SULFONAMIDE"],"sulfonamide":["SULFONAMIDE"],
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
// `classEvaluated=false` => fármaco fuera de catálogo: solo se comparó por nombre; la reactividad cruzada por
// CLASE (p. ej. penicilina ↔ cefalosporina, AINE ↔ AINE) NO se pudo evaluar.
export type AllergyConflict=Readonly<{blocked:boolean;classEvaluated:boolean;allergen?:string;via?:"class"|"ingredient"}>;
// ¿Prescribir `drugCode` entra en conflicto con alguna sustancia de alergia activa?
export function checkDrugAllergy(drugCode:string,substances:readonly string[]):AllergyConflict{
 const c=norm(drugCode);const drug=resolveDrug(drugCode);
 const drugClasses=drug?new Set(drug.classes):new Set<string>();
 for(const raw of substances){
  const s=norm(raw);if(!s)continue;
  // 1) match por clase de alérgeno (incluye reactividad cruzada beta-lactámicos)
  if(drug){const acs=allergyClasses(raw);if(acs.some(x=>drugClasses.has(x)))return{blocked:true,classEvaluated:true,allergen:raw,via:"class"};
   if(s.includes(drug.ingredient))return{blocked:true,classEvaluated:true,allergen:raw,via:"ingredient"};}
  // 2) fallback por subcadena del principio activo en el código (compatibilidad)
  if(c.includes(s))return{blocked:true,classEvaluated:!!drug,allergen:raw,via:"ingredient"};
 }
 return{blocked:false,classEvaluated:!!drug};
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
export type RichInteraction=Readonly<{classA:string;classB:string;severity:InteractionSeverity;mechanism:string;recommendation:string}>;
const RICH_INTERACTIONS:readonly RichInteraction[]=[
 {classA:"SEROTONERGIC",classB:"SEROTONERGIC",severity:"MAJOR",mechanism:"Efecto serotoninérgico aditivo: riesgo de síndrome serotoninérgico (hipertermia, rigidez, clonus, agitación).",recommendation:"Evitar la combinación o usar la mínima dosis con vigilancia estrecha; suspender ante los primeros signos."},
 {classA:"SSRI",classB:"NSAID",severity:"MAJOR",mechanism:"Inhibición serotoninérgica de la agregación plaquetaria sumada al efecto gastroerosivo del AINE: sangrado digestivo.",recommendation:"Preferir paracetamol; si el AINE es necesario, añadir gastroprotección con IBP y vigilar sangrado."},
 {classA:"SSRI",classB:"ANTICOAGULANT",severity:"MAJOR",mechanism:"Efecto antiagregante del SSRI sumado a la anticoagulación: riesgo hemorrágico aumentado.",recommendation:"Vigilar signos de sangrado; considerar antidepresivo con menor efecto plaquetario (p. ej. no serotoninérgico)."},
 {classA:"ANTICOAGULANT",classB:"NSAID",severity:"MAJOR",mechanism:"AINE inhibe plaquetas y erosiona mucosa gástrica sobre un paciente anticoagulado: hemorragia mayor.",recommendation:"Evitar el AINE; usar paracetamol. Si es imprescindible, gastroprotección e INR/vigilancia estrecha."},
 {classA:"ANTICOAGULANT",classB:"SALICYLATE",severity:"MAJOR",mechanism:"Doble efecto antiagregante/anticoagulante: hemorragia mayor.",recommendation:"Evitar salicilatos salvo indicación cardiológica explícita con balance riesgo-beneficio documentado."},
 {classA:"ACE_INHIBITOR",classB:"POTASSIUM_SPARING",severity:"MAJOR",mechanism:"Retención aditiva de potasio: hiperkalemia grave.",recommendation:"Vigilar potasio sérico al inicio y tras cada ajuste; evitar suplementos de potasio."},
 {classA:"ARB",classB:"POTASSIUM_SPARING",severity:"MAJOR",mechanism:"Retención aditiva de potasio: hiperkalemia grave.",recommendation:"Vigilar potasio sérico al inicio y tras cada ajuste; evitar suplementos de potasio."},
 {classA:"ACE_INHIBITOR",classB:"ARB",severity:"MODERATE",mechanism:"Doble bloqueo del SRAA: hiperkalemia y deterioro de la función renal.",recommendation:"Evitar la combinación de rutina; si se usa, monitorizar potasio y creatinina."},
 {classA:"ACE_INHIBITOR",classB:"NSAID",severity:"MODERATE",mechanism:"El AINE reduce la perfusión renal y antagoniza el efecto antihipertensivo del IECA.",recommendation:"Limitar el AINE a cursos cortos; vigilar presión arterial y función renal (triple whammy con diurético)."},
 {classA:"OPIOID",classB:"NSAID",severity:"MINOR",mechanism:"Combinación analgésica frecuente; sin interacción farmacocinética relevante.",recommendation:"Combinación aceptable para dolor moderado; vigilar tolerancia gastrointestinal del AINE."},
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
export type PatientFactor="ALCOHOL"|"RENAL_IMPAIRMENT"|"HEPATIC_IMPAIRMENT"|"PREGNANCY"|"ELDERLY";
const FACTOR_SYNONYMS:Record<PatientFactor,readonly string[]>={
 ALCOHOL:["alcohol","consumo de alcohol","etilismo","alcoholismo","alcohol activo"],
 RENAL_IMPAIRMENT:["insuficiencia renal","enfermedad renal","erc","falla renal","renal","tfg baja"],
 HEPATIC_IMPAIRMENT:["insuficiencia hepatica","hepatopatia","enfermedad hepatica","cirrosis","hepatico"],
 PREGNANCY:["embarazo","gestacion","embarazada","gestante"],
 ELDERLY:["adulto mayor","edad avanzada","anciano","geriatrico","mayor de 65"],
};
export const FACTOR_LABEL:Record<PatientFactor,string>={ALCOHOL:"Consumo de alcohol",RENAL_IMPAIRMENT:"Insuficiencia renal",HEPATIC_IMPAIRMENT:"Insuficiencia hepática",PREGNANCY:"Embarazo",ELDERLY:"Adulto mayor"};
export type FactorRule=Readonly<{factor:PatientFactor;drugClass:string;severity:InteractionSeverity;mechanism:string;recommendation:string}>;
const FACTOR_RULES:readonly FactorRule[]=[
 {factor:"ALCOHOL",drugClass:"SSRI",severity:"MODERATE",mechanism:"Potenciación de la depresión del sistema nervioso central y aumento del riesgo de sangrado digestivo.",recommendation:"Aconsejar evitar el alcohol durante el tratamiento con el SSRI."},
 {factor:"ALCOHOL",drugClass:"NSAID",severity:"MODERATE",mechanism:"Efecto gastroerosivo aditivo: mayor riesgo de hemorragia digestiva.",recommendation:"Evitar alcohol; considerar gastroprotección si el AINE es prolongado."},
 {factor:"ALCOHOL",drugClass:"OPIOID",severity:"MAJOR",mechanism:"Depresión respiratoria y del SNC aditiva: riesgo de sedación grave.",recommendation:"Contraindicar el consumo de alcohol durante el tratamiento opioide."},
 {factor:"ALCOHOL",drugClass:"BIGUANIDE",severity:"MODERATE",mechanism:"El alcohol aumenta el riesgo de acidosis láctica con metformina.",recommendation:"Evitar el consumo agudo/excesivo de alcohol."},
 {factor:"RENAL_IMPAIRMENT",drugClass:"BIGUANIDE",severity:"MODERATE",mechanism:"Disminución de la eliminación renal de metformina: acumulación y riesgo de acidosis láctica.",recommendation:"Ajustar dosis según TFGe; contraindicada si TFGe<30 mL/min."},
 {factor:"RENAL_IMPAIRMENT",drugClass:"NSAID",severity:"MINOR",mechanism:"Inhibición de prostaglandinas renales: reducción de la perfusión renal.",recommendation:"Usar la dosis mínima efectiva por el menor tiempo posible y vigilar la función renal."},
 {factor:"RENAL_IMPAIRMENT",drugClass:"ACE_INHIBITOR",severity:"MODERATE",mechanism:"Riesgo de deterioro de la función renal e hiperkalemia en enfermedad renal.",recommendation:"Vigilar potasio y creatinina; nefroprotector pero requiere monitoreo estrecho."},
 {factor:"HEPATIC_IMPAIRMENT",drugClass:"OPIOID",severity:"MODERATE",mechanism:"Metabolismo hepático reducido: acumulación y sedación prolongada.",recommendation:"Reducir dosis y espaciar intervalos; vigilar nivel de conciencia."},
 {factor:"PREGNANCY",drugClass:"NSAID",severity:"MAJOR",mechanism:"AINE en el 3.º trimestre: cierre precoz del conducto arterioso y oligohidramnios.",recommendation:"Evitar AINE en el embarazo, en especial el 3.º trimestre; preferir paracetamol."},
 {factor:"PREGNANCY",drugClass:"ACE_INHIBITOR",severity:"CONTRAINDICATED",mechanism:"Fetotoxicidad (oligohidramnios, daño renal fetal, malformaciones).",recommendation:"Contraindicado en el embarazo; suspender y cambiar a antihipertensivo seguro (p. ej. metildopa)."},
 {factor:"PREGNANCY",drugClass:"ARB",severity:"CONTRAINDICATED",mechanism:"Fetotoxicidad análoga a los IECA.",recommendation:"Contraindicado en el embarazo; suspender y cambiar a antihipertensivo seguro."},
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
function renalRuleFor(classes:readonly string[]):(RenalRule&{drugClass:string})|null{for(const c of classes){const r=RENAL_RULES_BY_CLASS[c];if(r)return{...r,drugClass:c};}return null;}
export function drugCatalog():DrugCatalogItem[]{
 const seen=new Set<string>();const out:DrugCatalogItem[]=[];
 for(const[code,entry]of Object.entries(DRUGS)){
  if(seen.has(entry.ingredient))continue;seen.add(entry.ingredient);
  out.push({code,ingredient:entry.ingredient,classes:entry.classes,category:categoryFor(entry.classes),monitoring:monitoringFor(code),renal:renalRuleFor(entry.classes)});
 }
 return out.sort((a,b)=>a.ingredient.localeCompare(b.ingredient,"es"));
}
// Matriz de interacciones por clase (para paneles de conocimiento/alertas de la UI). Copia inmutable.
export function interactionRules():readonly DrugInteraction[]{return INTERACTIONS;}
