// EPIC AV — Validación estructurada de la orden de medicación (PROFUNDIDAD del eje C / seguridad).
// Convierte dose/route/frequency de texto libre en datos con vocabulario controlado y forma válida,
// para reducir errores de prescripción. Puro, sin PHI. Autoridad: PROD (seguridad de la prescripción), CAP-MED-VALIDATION-001.

// Vías de administración permitidas (vocabulario controlado; ES + abreviaturas comunes MX).
const ROUTES=new Set(["VO","PO","ORAL","IV","IM","SC","SL","TOP","TOPICA","INH","REC","OFT","OTIC","NAS","TD","TRANSDERMICA","IT","EPIDURAL","VAGINAL"]);
export function normalizeRoute(route:string):string{return route.trim().toUpperCase();}
export function isValidRoute(route:string):boolean{return ROUTES.has(normalizeRoute(route));}

// Dosis: debe contener una cantidad numérica + una unidad reconocida (mg, g, mcg/µg, ml, UI, mEq, %, gotas...).
const DOSE_RE=/^\s*\d+(?:[.,]\d+)?\s*(mg|g|mcg|µg|ug|ml|l|ui|u|meq|mmol|%|gotas?|gts|tab|caps?|amp|puff)s?\s*$/i;
export function isValidDose(dose:string):boolean{return DOSE_RE.test(dose.trim());}

// Frecuencia: patrón "c/Nh" o "c/Nd", "cada N horas/días", o abreviaturas estándar.
const FREQ_ABBR=new Set(["QD","BID","TID","QID","QHS","QAM","QPM","PRN","STAT","DU","AC","PC","QOD","CONTINUA","INFUSION"]);
const FREQ_RE=/^\s*(c\/\s*\d+\s*[hd]|cada\s+\d+\s+(horas?|h|d[ií]as?|d))\s*$/i;
export function isValidFrequency(freq:string):boolean{
 const f=freq.trim();
 return FREQ_RE.test(f)||FREQ_ABBR.has(f.toUpperCase());
}

// EPIC AZ — Dosis máxima diaria (dose ceiling). Convierte dose+frequency en mg/día y lo compara contra el
// tope del principio activo, para atrapar sobredosis (error de prescripción frecuente y peligroso). Puro, sin PHI.
// Unidades soportadas para el techo: masa (g/mg/mcg). Otras unidades (ml, UI, gotas, tab...) no se acotan aquí.
const UNIT_TO_MG:Record<string,number>={g:1000,mg:1,mcg:0.001,"µg":0.001,ug:0.001};
// Cantidad de dosis por día a partir de la frecuencia (undefined = no acotable, p. ej. PRN/tópico/continua).
export function dosesPerDay(frequency:string):number|undefined{
 const f=frequency.trim();
 const mHoras=/^\s*(?:c\/\s*(\d+)\s*h|cada\s+(\d+)\s+(?:horas?|h))\s*$/i.exec(f);
 if(mHoras){const n=Number(mHoras[1]??mHoras[2]);return n>0?24/n:undefined;}
 const mDias=/^\s*(?:c\/\s*(\d+)\s*d|cada\s+(\d+)\s+(?:d[ií]as?|d))\s*$/i.exec(f);
 if(mDias){const n=Number(mDias[1]??mDias[2]);return n>0?1/n:undefined;}
 const ABBR:Record<string,number|undefined>={QD:1,QHS:1,QAM:1,QPM:1,STAT:1,DU:1,QOD:0.5,BID:2,TID:3,QID:4,AC:3,PC:3,PRN:undefined,CONTINUA:undefined,INFUSION:undefined};
 return Object.prototype.hasOwnProperty.call(ABBR,f.toUpperCase())?ABBR[f.toUpperCase()]:undefined;
}
// Convierte una dosis textual ("500mg", "1 g") a mg. undefined si la unidad no es de masa o el formato es inválido.
export function doseToMg(dose:string):number|undefined{
 const m=/^\s*(\d+(?:[.,]\d+)?)\s*(g|mg|mcg|µg|ug)\s*$/i.exec(dose.trim());
 if(!m)return undefined;
 const value=Number(m[1]!.replace(",","."));const unit=m[2]!.toLowerCase();
 const factor=UNIT_TO_MG[unit];return factor===undefined?undefined:value*factor;
}
// Tope de dosis diaria por principio activo (mg/día). Subconjunto de demostración; el vademécum oficial se cargaría aparte.
// Auditoría 2026-09-19 (C-15): techos para 12 de 27 fármacos. Se amplía a todo el catálogo salvo los que se dosifican por
// objetivo terapéutico (warfarina, acenocumarol: por INR) o por vía/indicación hospitalaria (ampicilina, ceftriaxona,
// penicilina parenteral), que quedan declarados como NO acotables (Set NO_CEILING) en vez de "sin tope conocido".
// Valores: dosis máxima diaria habitual del adulto en ficha técnica (uso ambulatorio). PENDIENTE de validación clínica.
const MAX_DAILY_MG:Record<string,number>={
 ibuprofeno:3200,naproxeno:1100,ketorolaco:120,aspirina:4000,
 diclofenaco:150,meloxicam:15,piroxicam:20,indometacina:200,celecoxib:400,etoricoxib:120,metamizol:4000,
 paracetamol:4000,acetaminofen:4000,
 amoxicilina:3000,dicloxacilina:4000,cefalexina:4000,cefuroxima:1000,sulfametoxazol:3200,clindamicina:1800,azitromicina:500,
 metformina:2550,enalapril:40,lisinopril:80,losartan:100,espironolactona:100,rivaroxaban:20,
 sertralina:200,fluoxetina:80,citalopram:40,tramadol:400,
};
export const NO_CEILING:ReadonlySet<string>=new Set(["warfarina","acenocumarol","ampicilina","ceftriaxona","penicilina"]);
// Concentración por unidad de forma farmacéutica a partir del código ("ibuprofeno-400" -> 400 mg; "amoxicilina-500mg" -> 500).
export function unitStrengthMg(drugCode:string):number|undefined{
 const m=/-(\d+(?:[.,]\d+)?)\s*(mg|g|mcg|µg|ug)?(?:\b|$)/i.exec(drugCode.trim());
 if(!m)return undefined;const v=Number(m[1]!.replace(",","."));const u=(m[2]??"mg").toLowerCase();
 const f=UNIT_TO_MG[u];return f===undefined||!Number.isFinite(v)||v<=0?undefined:v*f;
}
// "2 tab", "1 comprimido", "½ tableta" -> unidades de forma farmacéutica (undefined si no es una expresión de unidades).
export function doseUnits(dose:string):number|undefined{
 const m=/^\s*(\d+(?:[.,]\d+)?|½|1\/2)\s*(tab|tabs|tableta|tabletas|comp|comprimido|comprimidos|cap|caps|c[aá]psula|c[aá]psulas|gragea|grageas)\.?\s*$/i.exec(dose.trim());
 if(!m)return undefined;const raw=m[1]!;return raw==="½"||raw==="1/2"?0.5:Number(raw.replace(",","."));
}
export type DoseCeilingCheck=Readonly<{checked:boolean;exceeded:boolean;computedMgPerDay?:number;maxMgPerDay?:number;ingredient?:string;noCeiling?:boolean;derivedFromUnits?:boolean}>;
// ¿La dosis diaria total excede el tope del fármaco? checked=false cuando no es acotable (unidad no-masa sin concentración
// conocida, frecuencia PRN/continua, o principio activo sin tope): el evaluador lo trata como NO EVALUADO, nunca como OK.
// `drugCode` permite acotar "2 tab" usando la concentración del código ("ibuprofeno-400" => 800 mg por toma).
export function checkDoseCeiling(ingredient:string,dose:string,frequency:string,drugCode?:string):DoseCeilingCheck{
 const ing=ingredient.trim().toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]","g"),"");
 if(NO_CEILING.has(ing))return{checked:false,exceeded:false,ingredient:ing,noCeiling:true};
 const max=MAX_DAILY_MG[ing];if(max===undefined)return{checked:false,exceeded:false};
 let mg=doseToMg(dose);let derivedFromUnits=false;
 if(mg===undefined&&drugCode){const units=doseUnits(dose);const strength=unitStrengthMg(drugCode);if(units!==undefined&&strength!==undefined){mg=units*strength;derivedFromUnits=true;}}
 const perDay=dosesPerDay(frequency);
 if(mg===undefined||perDay===undefined)return{checked:false,exceeded:false,maxMgPerDay:max,ingredient:ing};
 const computed=mg*perDay;
 return{checked:true,exceeded:computed>max,computedMgPerDay:computed,maxMgPerDay:max,ingredient:ing,derivedFromUnits};
}

// EPIC BD — Dosis pediátrica por peso (mg/kg/día). El ceiling absoluto (checkDoseCeiling) es correcto para
// adultos pero peligrosamente permisivo en niños: un niño de 10 kg sobredosifica muy por debajo del máximo
// adulto. Solo aplica en peso pediátrico (<=PEDIATRIC_MAX_KG); por encima gobierna el ceiling absoluto. Puro.
const MAX_MG_PER_KG_DAY:Record<string,number>={
 paracetamol:75,acetaminofen:75,ibuprofeno:40,naproxeno:20,amoxicilina:90,azitromicina:12,
};
export const PEDIATRIC_MAX_KG=40;
function normIngredient(s:string):string{return s.trim().toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]","g"),"");}
export type PediatricDoseCheck=Readonly<{checked:boolean;exceeded:boolean;computedMgPerKgPerDay?:number;maxMgPerKgPerDay?:number;weightKg?:number;ingredient?:string}>;
// ¿La dosis diaria por kg excede el máximo pediátrico? checked=false si el peso no es pediátrico, no hay
// peso/máximo conocido, o la orden no es acotable (unidad no-masa / frecuencia PRN): en esos casos NO bloquea.
export function checkPediatricDose(ingredient:string,dose:string,frequency:string,weightKg:number|undefined):PediatricDoseCheck{
 const ing=normIngredient(ingredient);const max=MAX_MG_PER_KG_DAY[ing];
 if(max===undefined)return{checked:false,exceeded:false};
 if(weightKg===undefined||Number.isNaN(weightKg)||weightKg<=0||weightKg>PEDIATRIC_MAX_KG)return{checked:false,exceeded:false,maxMgPerKgPerDay:max,ingredient:ing,...(weightKg!==undefined?{weightKg}:{})};
 const mg=doseToMg(dose);const perDay=dosesPerDay(frequency);
 if(mg===undefined||perDay===undefined)return{checked:false,exceeded:false,maxMgPerKgPerDay:max,weightKg,ingredient:ing};
 const computed=(mg*perDay)/weightKg;
 return{checked:true,exceeded:computed>max,computedMgPerKgPerDay:Math.round(computed*100)/100,maxMgPerKgPerDay:max,weightKg,ingredient:ing};
}

export type MedicationOrderInput=Readonly<{dose:string;route:string;frequency:string}>;
export type MedicationOrderValidation=Readonly<{ok:boolean;errors:readonly string[]}>;
// Valida la orden completa; devuelve todos los errores (no corta en el primero).
export function validateMedicationOrder(o:MedicationOrderInput):MedicationOrderValidation{
 const errors:string[]=[];
 if(!isValidDose(o.dose))errors.push(`Dosis no válida: "${o.dose}" (esperado cantidad + unidad, ej. 500mg)`);
 if(!isValidRoute(o.route))errors.push(`Vía de administración no reconocida: "${o.route}"`);
 if(!isValidFrequency(o.frequency))errors.push(`Frecuencia no válida: "${o.frequency}" (esperado c/8h, cada 8 horas, BID, PRN...)`);
 return{ok:errors.length===0,errors};
}
