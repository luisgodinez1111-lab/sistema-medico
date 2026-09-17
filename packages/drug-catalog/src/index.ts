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
 "ibuprofeno":{ingredient:"ibuprofeno",classes:["NSAID"]},
 "naproxeno":{ingredient:"naproxeno",classes:["NSAID"]},
 "ketorolaco":{ingredient:"ketorolaco",classes:["NSAID"]},
 "aspirina":{ingredient:"aspirina",classes:["NSAID","SALICYLATE"]},
 "sulfametoxazol":{ingredient:"sulfametoxazol",classes:["SULFONAMIDE"]},
 "trimetoprima-sulfametoxazol":{ingredient:"sulfametoxazol",classes:["SULFONAMIDE"]},
 "azitromicina":{ingredient:"azitromicina",classes:["MACROLIDE"]},
 "clindamicina":{ingredient:"clindamicina",classes:["LINCOSAMIDE"]},
};
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
