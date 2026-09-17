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
