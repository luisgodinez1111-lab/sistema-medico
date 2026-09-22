// Auditoría 2026-09-19 (L-06) — Identidad del paciente en México: validación de la CURP. Puro, sin PHI en mensajes.
//
// CURP (RENAPO): 18 caracteres = 4 letras del nombre, fecha de nacimiento AAMMDD, sexo (H/M), entidad federativa (2 letras),
// 3 consonantes internas, diferenciador de homonimia (dígito para nacidos antes de 2000, letra desde 2000) y dígito
// verificador. El dígito verificador se calcula sobre los 17 primeros caracteres con el alfabeto oficial
// "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ" y pesos 18…2: dígito = (10 − (Σ valor·peso mod 10)) mod 10.
// Referencia: Instructivo normativo para la asignación de la CURP (DOF 18/10/2021), SEGOB/RENAPO.
export const CURP_STATES=["AS","BC","BS","CC","CL","CM","CS","CH","DF","DG","GT","GR","HG","JC","MC","MN","MS","NT","NL","OC","PL","QT","QR","SP","SL","SR","TC","TS","TL","VZ","YN","ZS","NE"] as const;
const CURP_RE=new RegExp(`^[A-Z][AEIOUX][A-Z]{2}\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])[HM](${CURP_STATES.join("|")})[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]\\d$`);
const ALPHABET="0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
export type CurpIssue="FORMAT"|"CHECK_DIGIT"|"BIRTHDATE_MISMATCH"|"SEX_MISMATCH"|"INVALID_DATE";
export type CurpValidation=Readonly<{ok:true;curp:string;birthDate:string;sex:"MALE"|"FEMALE";state:string}|{ok:false;issue:CurpIssue}>;
export const normalizeCurp=(s:string):string=>s.trim().toUpperCase();
export function curpCheckDigit(first17:string):number{
 let sum=0;for(let i=0;i<17;i++){const v=ALPHABET.indexOf(first17[i]!);if(v<0)return -1;sum+=v*(18-i);}
 return(10-(sum%10))%10;
}
// Valida formato, dígito verificador y, si se dan, coherencia con fecha de nacimiento (YYYY-MM-DD) y sexo al nacer.
export function validateCurp(input:string,expect:{birthDate?:string;sexAtBirth?:string}={}):CurpValidation{
 const curp=normalizeCurp(input);
 if(!CURP_RE.test(curp))return{ok:false,issue:"FORMAT"};
 if(curpCheckDigit(curp.slice(0,17))!==Number(curp[17]))return{ok:false,issue:"CHECK_DIGIT"};
 const yy=Number(curp.slice(4,6)),mm=curp.slice(6,8),dd=curp.slice(8,10);
 const century=/[A-Z]/.test(curp[16]!)?2000:1900; // diferenciador alfabético = nacido en 2000 o después
 const birthDate=`${century+yy}-${mm}-${dd}`;
 const d=new Date(`${birthDate}T00:00:00Z`);
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==birthDate)return{ok:false,issue:"INVALID_DATE"};
 const sex=curp[10]==="H"?"MALE":"FEMALE";
 if(expect.birthDate&&expect.birthDate!==birthDate)return{ok:false,issue:"BIRTHDATE_MISMATCH"};
 if(expect.sexAtBirth&&(expect.sexAtBirth==="MALE"||expect.sexAtBirth==="FEMALE")&&expect.sexAtBirth!==sex)return{ok:false,issue:"SEX_MISMATCH"};
 return{ok:true,curp,birthDate,sex,state:curp.slice(11,13)};
}
export const CURP_ISSUE_ES:Readonly<Record<CurpIssue,string>>={
 FORMAT:"La CURP no tiene el formato oficial (18 caracteres: 4 letras, fecha AAMMDD, sexo H/M, entidad, 3 consonantes, homoclave y dígito verificador)",
 CHECK_DIGIT:"El dígito verificador de la CURP no coincide: revise la captura",
 BIRTHDATE_MISMATCH:"La fecha de nacimiento no coincide con la que codifica la CURP",
 SEX_MISMATCH:"El sexo al nacer no coincide con el que codifica la CURP",
 INVALID_DATE:"La CURP codifica una fecha de nacimiento inexistente",
};
// Nombre normalizado para detectar duplicados: vocales sin acento (la ñ se conserva), minúsculas, espacios colapsados.
// Debe coincidir EXACTAMENTE con la normalización SQL de `findPatientDuplicate` (translate + lower + regexp_replace + btrim).
const ACCENTS:Record<string,string>={"á":"a","é":"e","í":"i","ó":"o","ú":"u","ü":"u","Á":"A","É":"E","Í":"I","Ó":"O","Ú":"U","Ü":"U"};
export const normalizeName=(s:string):string=>s.replace(/[áéíóúüÁÉÍÓÚÜ]/g,c=>ACCENTS[c]??c).toLowerCase().replace(/\s+/g," ").trim();
// Edad cumplida en años; undefined si la fecha no es válida.
export function ageYearsAt(birthDate:string,asOf:string):number|undefined{
 const b=new Date(birthDate),a=new Date(asOf);if(Number.isNaN(b.getTime())||Number.isNaN(a.getTime()))return undefined;
 let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y>=0?y:undefined;
}
export const ADULT_AGE=18;
export const isMinor=(birthDate:string,asOf:string):boolean|undefined=>{const y=ageYearsAt(birthDate,asOf);return y===undefined?undefined:y<ADULT_AGE;};
