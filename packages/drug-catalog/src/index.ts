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
export type InteractionHit=Readonly<{found:boolean;severity?:"MAJOR"|"MODERATE";note?:string;conflictDrug?:string}>;
// ¿El fármaco a prescribir interactúa con alguno ya activo? Devuelve la interacción de mayor severidad.
export function checkInteractions(newDrugCode:string,activeDrugCodes:readonly string[]):InteractionHit{
 const nd=resolveDrug(newDrugCode);if(!nd)return{found:false};
 let best:InteractionHit={found:false};
 for(const active of activeDrugCodes){
  if(norm(active)===norm(newDrugCode))continue;
  const ad=resolveDrug(active);if(!ad)continue;
  const hit=interactionFor(nd.classes,ad.classes);
  if(hit){if(hit.severity==="MAJOR")return{found:true,severity:"MAJOR",note:hit.note,conflictDrug:active};
   if(!best.found)best={found:true,severity:hit.severity,note:hit.note,conflictDrug:active};}
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
export type RenalDosing=Readonly<{action:"BLOCK"|"CAUTION"|"OK";note?:string;threshold?:number;drugClass?:string}>;
// ¿La función renal (eGFR) contraindica o exige precaución para este fármaco? Devuelve la acción más severa.
export function checkRenalDosing(drugCode:string,egfr:number):RenalDosing{
 const d=resolveDrug(drugCode);if(!d)return{action:"OK"};
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
export type ContraindicationHit=Readonly<{found:boolean;severity?:"MAJOR"|"MODERATE";note?:string;condition?:string}>;
// ¿El fármaco a prescribir está contraindicado por alguna condición activa? Devuelve la de mayor severidad.
export function checkContraindications(newDrugCode:string,activeConditionCodes:readonly string[]):ContraindicationHit{
 const nd=resolveDrug(newDrugCode);if(!nd)return{found:false};
 const classes=new Set(nd.classes);
 let best:ContraindicationHit={found:false};
 for(const raw of activeConditionCodes){
  const code=raw.trim().toUpperCase();if(!code)continue;
  for(const ci of CONTRAINDICATIONS){
   if(!classes.has(ci.drugClass))continue;
   if(!code.startsWith(ci.icd10Prefix))continue;
   if(ci.severity==="MAJOR")return{found:true,severity:"MAJOR",note:ci.note,condition:raw};
   if(!best.found)best={found:true,severity:"MODERATE",note:ci.note,condition:raw};
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
export type AllergyConflict=Readonly<{blocked:boolean;allergen?:string;via?:"class"|"ingredient"}>;
// ¿Prescribir `drugCode` entra en conflicto con alguna sustancia de alergia activa?
export function checkDrugAllergy(drugCode:string,substances:readonly string[]):AllergyConflict{
 const c=norm(drugCode);const drug=resolveDrug(drugCode);
 const drugClasses=drug?new Set(drug.classes):new Set<string>();
 for(const raw of substances){
  const s=norm(raw);if(!s)continue;
  // 1) match por clase de alérgeno (incluye reactividad cruzada beta-lactámicos)
  if(drug){const acs=allergyClasses(raw);if(acs.some(x=>drugClasses.has(x)))return{blocked:true,allergen:raw,via:"class"};
   if(s.includes(drug.ingredient))return{blocked:true,allergen:raw,via:"ingredient"};}
  // 2) fallback por subcadena del principio activo en el código (compatibilidad)
  if(c.includes(s))return{blocked:true,allergen:raw,via:"ingredient"};
 }
 return{blocked:false};
}

// EPIC AW — Duplicación terapéutica: ¿el fármaco a prescribir comparte CLASE con alguno ya activo?
// (p. ej. dos AINE, dos beta-lactámicos, dos IECA). Reutiliza el catálogo de clases. Puro, sin PHI.
export type DuplicateTherapy=Readonly<{duplicate:boolean;conflictDrug?:string;sharedClass?:string}>;
export function checkDuplicateTherapy(newDrugCode:string,activeDrugCodes:readonly string[]):DuplicateTherapy{
 const nd=resolveDrug(newDrugCode);if(!nd)return{duplicate:false};
 const ndClasses=new Set(nd.classes);const nIng=nd.ingredient;
 for(const active of activeDrugCodes){
  if(norm(active)===norm(newDrugCode))continue; // no se compara consigo mismo
  const ad=resolveDrug(active);if(!ad)continue;
  if(ad.ingredient===nIng)return{duplicate:true,conflictDrug:active,sharedClass:nd.classes[0]??nIng}; // mismo principio activo
  const shared=ad.classes.find(cl=>ndClasses.has(cl));
  if(shared)return{duplicate:true,conflictDrug:active,sharedClass:shared};
 }
 return{duplicate:false};
}
