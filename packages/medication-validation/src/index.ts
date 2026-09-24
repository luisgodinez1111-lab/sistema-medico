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
function normIngredient(s:string):string{return s.trim().toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]","g"),"");}
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

// ---------- Auditoría 2026-09-19, anexo R03 (R03-26) ----------
// Tres dimensiones que el techo único no podía expresar y que el anexo midió:
//  1. VÍA. `ketorolaco 30 mg c/6h` = 120 mg/día pasaba como correcto. Lo es por vía IV/IM, pero el máximo ORAL es
//     40 mg/día: el mismo número es correcto o el triple del límite según por dónde entre el fármaco.
//  2. DURACIÓN. El ketorolaco tiene un máximo de 5 días y el metamizol de 7 (riesgo de agranulocitosis): un techo
//     diario correcto no dice nada sobre un tratamiento indefinido.
//  3. EDAD. El máximo de citalopram es 40 mg/día, pero 20 mg/día a partir de los 60 años por prolongación del QT
//     (advertencia explícita de la FDA, 2012). El sistema no emitía nada con 60 mg/día.
// El techo efectivo es el MÍNIMO de los tres, y la respuesta dice cuál manda.
const MAX_DAILY_MG_BY_ROUTE:Readonly<Record<string,Readonly<Record<string,number>>>>={
 ketorolaco:{ORAL:40,VO:40,PO:40,IV:120,IM:120,SL:40},
 metamizol:{ORAL:4000,VO:4000,PO:4000,IV:5000,IM:5000},
 paracetamol:{ORAL:4000,VO:4000,PO:4000,IV:4000,REC:4000},
};
// Límite de DURACIÓN del tratamiento (días) por principio activo, con el riesgo que lo motiva.
export const MAX_DURATION_DAYS:Readonly<Record<string,Readonly<{days:number;reason:string}>>>={
 ketorolaco:{days:5,reason:"Máximo 5 días en total (oral + parenteral): riesgo de sangrado digestivo y nefrotoxicidad"},
 metamizol:{days:7,reason:"Uso corto: riesgo de agranulocitosis (restricción de la EMA)"},
 indometacina:{days:10,reason:"Uso corto por toxicidad digestiva y del sistema nervioso central"},
 piroxicam:{days:14,reason:"Uso limitado: vida media larga y toxicidad digestiva (restricción de la EMA)"},
};
// Techo reducido POR EDAD (el máximo del adulto joven no aplica al adulto mayor).
const MAX_DAILY_MG_BY_AGE:Readonly<Record<string,Readonly<{fromAge:number;max:number;reason:string}>>>={
 citalopram:{fromAge:60,max:20,reason:"FDA 2012: máximo 20 mg/día a partir de los 60 años por prolongación del QT y riesgo de torsades"},
 escitalopram:{fromAge:65,max:10,reason:"Máximo 10 mg/día en mayores de 65 años (QT)"},
 tramadol:{fromAge:75,max:300,reason:"Máximo 300 mg/día a partir de los 75 años (acumulación y riesgo de convulsiones)"},
 ketorolaco:{fromAge:65,max:60,reason:"Máximo 60 mg/día parenteral en mayores de 65 años (y 40 mg/día oral)"},
};
/** Techo efectivo (mg/día) y qué dimensión manda. `undefined` = el catálogo no tiene techo para ese principio activo. */
export type EffectiveCeiling=Readonly<{maxMgPerDay:number;source:"base"|"route"|"age";note?:string}>;
export function effectiveCeiling(ingredient:string,route?:string,ageYears?:number):EffectiveCeiling|undefined{
 const ing=normIngredient(ingredient);
 const base=MAX_DAILY_MG[ing];
 if(base===undefined)return undefined;
 const candidatos:EffectiveCeiling[]=[{maxMgPerDay:base,source:"base"}];
 const r=route===undefined?undefined:MAX_DAILY_MG_BY_ROUTE[ing]?.[normalizeRoute(route)];
 if(r!==undefined)candidatos.push({maxMgPerDay:r,source:"route",note:`Máximo por vía ${normalizeRoute(route!)}: ${r} mg/día`});
 const a=MAX_DAILY_MG_BY_AGE[ing];
 if(a&&ageYears!==undefined&&Number.isFinite(ageYears)&&ageYears>=a.fromAge)candidatos.push({maxMgPerDay:a.max,source:"age",note:a.reason});
 return candidatos.reduce((min,c)=>c.maxMgPerDay<min.maxMgPerDay?c:min);
}
/**
 * La duración se prescribe en TEXTO LIBRE («7 días», «2 semanas», «5 d»). Esto la convierte a días para poder acotarla.
 * `undefined` si no se reconoce: la barrera queda entonces sin evaluar, nunca «dentro del límite».
 */
export function durationToDays(text:string|undefined):number|undefined{
 if(text===undefined)return undefined;
 const t=text.trim().toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]","g"),"");
 if(t==="")return undefined;
 const m=/^(\d+(?:[.,]\d+)?)\s*(d|dia|dias|day|days|sem|semana|semanas|week|weeks|mes|meses|month|months)?\.?$/.exec(t);
 if(!m)return undefined;
 const n=Number(m[1]!.replace(",","."));
 if(!Number.isFinite(n)||n<=0)return undefined;
 const u=m[2]??"d";
 const factor=u.startsWith("sem")||u.startsWith("week")?7:u.startsWith("mes")||u.startsWith("month")?30:1;
 return n*factor;
}
/** ¿La duración prescrita excede el límite del fármaco? `evaluable:false` = el catálogo no limita la duración. */
export type DurationCheck=Readonly<{evaluable:boolean;exceeded:boolean;maxDays?:number;days?:number;reason?:string;ingredient?:string}>;
export function checkDurationLimit(ingredient:string,durationDays:number|undefined):DurationCheck{
 const ing=normIngredient(ingredient);const rule=MAX_DURATION_DAYS[ing];
 if(!rule)return{evaluable:false,exceeded:false,ingredient:ing};
 if(durationDays===undefined||!Number.isFinite(durationDays)||durationDays<=0)return{evaluable:false,exceeded:false,maxDays:rule.days,reason:rule.reason,ingredient:ing};
 return{evaluable:true,exceeded:durationDays>rule.days,maxDays:rule.days,days:durationDays,reason:rule.reason,ingredient:ing};
}
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
// `evaluable` es el nombre que pide la auditoría R03-26 para lo que `checked` significaba: «se pudo verificar». Se
// mantienen los dos porque `checked` está en uso; son el mismo booleano y un test lo fija. Lo que NO puede volver a
// pasar es que un consumidor ramifique sobre `exceeded` sin mirar si hubo verificación: `exceeded:false` con
// `evaluable:false` significa «no se sabe», no «correcto».
export type DoseCeilingCheck=Readonly<{checked:boolean;evaluable:boolean;exceeded:boolean;computedMgPerDay?:number;maxMgPerDay?:number;ingredient?:string;noCeiling?:boolean;derivedFromUnits?:boolean;ceilingSource?:"base"|"route"|"age";ceilingNote?:string}>;
export type DoseCeilingOptions=Readonly<{route?:string;ageYears?:number}>;
// ¿La dosis diaria total excede el tope del fármaco? checked=false cuando no es acotable (unidad no-masa sin concentración
// conocida, frecuencia PRN/continua, o principio activo sin tope): el evaluador lo trata como NO EVALUADO, nunca como OK.
// `drugCode` permite acotar "2 tab" usando la concentración del código ("ibuprofeno-400" => 800 mg por toma).
export function checkDoseCeiling(ingredient:string,dose:string,frequency:string,drugCode?:string,opts:DoseCeilingOptions={}):DoseCeilingCheck{
 const ing=normIngredient(ingredient);
 if(NO_CEILING.has(ing))return{checked:false,evaluable:false,exceeded:false,ingredient:ing,noCeiling:true};
 const eff=effectiveCeiling(ing,opts.route,opts.ageYears);
 if(eff===undefined)return{checked:false,evaluable:false,exceeded:false};
 const max=eff.maxMgPerDay;
 const meta={maxMgPerDay:max,ingredient:ing,ceilingSource:eff.source,...(eff.note?{ceilingNote:eff.note}:{})} as const;
 let mg=doseToMg(dose);let derivedFromUnits=false;
 if(mg===undefined&&drugCode){const units=doseUnits(dose);const strength=unitStrengthMg(drugCode);if(units!==undefined&&strength!==undefined){mg=units*strength;derivedFromUnits=true;}}
 const perDay=dosesPerDay(frequency);
 if(mg===undefined||perDay===undefined)return{checked:false,evaluable:false,exceeded:false,...meta};
 const computed=mg*perDay;
 return{checked:true,evaluable:true,exceeded:computed>max,computedMgPerDay:computed,...meta,derivedFromUnits};
}

// EPIC BD — Dosis pediátrica por peso (mg/kg/día). El ceiling absoluto (checkDoseCeiling) es correcto para
// adultos pero peligrosamente permisivo en niños: un niño de 10 kg sobredosifica muy por debajo del máximo
// adulto. Solo aplica en peso pediátrico (<=PEDIATRIC_MAX_KG); por encima gobierna el ceiling absoluto. Puro.
// Auditoría 2026-09-19, anexo R03 (R03-27): la tabla tenía 6 de 27 fármacos y el criterio era el PESO (≤40 kg), así que
// un adolescente de 45 kg perdía toda verificación por peso. Ahora el criterio es la EDAD (<18 años, que es lo que
// define «pediátrico») y la tabla cubre los fármacos pediátricos de uso corriente, con el máximo mg/kg/día de las
// referencias habituales (Nelson / Lexicomp Pediatric). PENDIENTE de validación clínica, como el resto del contenido.
const MAX_MG_PER_KG_DAY:Record<string,number>={
 paracetamol:75,acetaminofen:75,ibuprofeno:40,naproxeno:20,amoxicilina:90,azitromicina:12,
 ketorolaco:2,metamizol:60,diclofenaco:3,
 cefalexina:100,cefuroxima:30,cefadroxilo:30,dicloxacilina:100,clindamicina:40,sulfametoxazol:40,claritromicina:15,
 prednisona:2,salbutamol:0.6,ondansetron:0.45,tramadol:8,
};
/** Peso a partir del cual la dosificación por kg deja de ser la regla dominante (se conserva por compatibilidad). */
export const PEDIATRIC_MAX_KG=40;
/** Edad (años) por debajo de la cual la dosificación se verifica POR PESO. Es el criterio que manda desde R03-27. */
export const PEDIATRIC_MAX_AGE_YEARS=18;
export type PediatricDoseCheck=Readonly<{checked:boolean;evaluable:boolean;exceeded:boolean;computedMgPerKgPerDay?:number;maxMgPerKgPerDay?:number;weightKg?:number;ingredient?:string;
 /** R03-27: el paciente es pediátrico por EDAD y no hay peso vigente. La dosis por kg no se puede verificar: es un bloqueo. */
 weightRequired?:boolean;
 /** R03-27: el límite real es el MÍNIMO entre el ponderal y el techo absoluto del adulto. Cuál manda, y su valor. */
 boundedBy?:"weight"|"absolute";absoluteMaxMgPerDay?:number;computedMgPerDay?:number}>;
// ¿La dosis diaria por kg excede el máximo pediátrico? checked=false si el peso no es pediátrico, no hay
// peso/máximo conocido, o la orden no es acotable (unidad no-masa / frecuencia PRN): en esos casos NO bloquea.
export function checkPediatricDose(ingredient:string,dose:string,frequency:string,weightKg:number|undefined,ageYears?:number):PediatricDoseCheck{
 const ing=normIngredient(ingredient);const max=MAX_MG_PER_KG_DAY[ing];
 if(max===undefined)return{checked:false,evaluable:false,exceeded:false};
 // ¿Aplica la dosificación por peso? Dos criterios INDEPENDIENTES, y basta uno:
 //  · EDAD pediátrica (<18): es lo que define «pediátrico», y era el hallazgo R03-27 (un adolescente de 45 kg perdía
 //    toda verificación por peso solo por pasar de 40 kg);
 //  · PESO bajo (≤40 kg) a cualquier edad: el techo absoluto del adulto no protege a quien pesa 30 kg (caquexia,
 //    desnutrición). Esto era el criterio anterior y NO se pierde: si se hubiera sustituido por la edad, un adulto de
 //    10 kg habría dejado de verificarse, que es justo el error inverso.
 const edadConocida=ageYears!==undefined&&Number.isFinite(ageYears);
 const pesoValido=weightKg!==undefined&&Number.isFinite(weightKg)&&weightKg>0;
 const menorDeEdad=edadConocida?ageYears!<PEDIATRIC_MAX_AGE_YEARS:false;
 const pesoBajo=pesoValido&&weightKg!<=PEDIATRIC_MAX_KG;
 const pediatrico=menorDeEdad||pesoBajo||(!edadConocida&&!pesoValido);
 if(!pediatrico)return{checked:false,evaluable:false,exceeded:false,maxMgPerKgPerDay:max,ingredient:ing,...(pesoValido?{weightKg}:{})};
 // R03-27: prescribir a un MENOR sin peso registrado es el patrón clásico de la sobredosis pediátrica. No es «no
 // evaluable y seguimos»: es un bloqueo que se levanta registrando el peso. (Un adulto sin peso no se bloquea: ahí
 // gobierna el techo absoluto, que sí se puede verificar.)
 if(!pesoValido)return{checked:false,evaluable:false,exceeded:false,maxMgPerKgPerDay:max,ingredient:ing,...(menorDeEdad?{weightRequired:true}:{})};
 const mg=doseToMg(dose);const perDay=dosesPerDay(frequency);
 if(mg===undefined||perDay===undefined)return{checked:false,evaluable:false,exceeded:false,maxMgPerKgPerDay:max,weightKg,ingredient:ing};
 const mgDia=mg*perDay;
 const computed=mgDia/weightKg!;
 // R03-27: la regla real es `min(mg/kg/día, máximo absoluto)`. Un adolescente de 60 kg con paracetamol 1 g c/6h da
 // 66 mg/kg/día (por debajo de 75) y 4 000 mg/día, justo en el techo; con 1.5 g c/6h el ponderal seguiría pasando y el
 // absoluto no. Antes cada límite vivía en una función distinta y nada garantizaba que se aplicaran los dos.
 const absoluto=MAX_DAILY_MG[ing];
 const excedePonderal=computed>max;
 const excedeAbsoluto=absoluto!==undefined&&mgDia>absoluto;
 return{checked:true,evaluable:true,exceeded:excedePonderal||excedeAbsoluto,
  computedMgPerKgPerDay:Math.round(computed*100)/100,maxMgPerKgPerDay:max,weightKg,ingredient:ing,
  computedMgPerDay:mgDia,...(absoluto!==undefined?{absoluteMaxMgPerDay:absoluto}:{}),
  boundedBy:excedeAbsoluto&&!excedePonderal?"absolute":"weight"};
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
