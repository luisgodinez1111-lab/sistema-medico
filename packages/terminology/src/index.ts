// EPIC AM — Terminología clínica CIE-10 (ICD-10). Subconjunto curado de diagnósticos frecuentes en
// atención primaria en México. PROFUNDIDAD del eje C: convierte códigos de texto libre en datos
// CODIFICADOS y validados con descripción canónica. Puro, determinista, sin PHI.
// Autoridad: PROD (interoperabilidad semántica / NOM-024), CAP-TERMINOLOGY-001.
// Nota: subconjunto de demostración; el catálogo oficial completo se cargaría desde la fuente autorizada.
export type Icd10Entry=Readonly<{code:string;description:string;category:string}>;
const CATALOG:readonly Icd10Entry[]=[
 {code:"E11",description:"Diabetes mellitus tipo 2",category:"Endocrino"},
 {code:"E11.9",description:"Diabetes mellitus tipo 2 sin complicaciones",category:"Endocrino"},
 {code:"E11.65",description:"Diabetes mellitus tipo 2 con hiperglucemia",category:"Endocrino"},
 {code:"E10",description:"Diabetes mellitus tipo 1",category:"Endocrino"},
 {code:"E66.9",description:"Obesidad, no especificada",category:"Endocrino"},
 {code:"E78.5",description:"Hiperlipidemia, no especificada",category:"Endocrino"},
 {code:"E03.9",description:"Hipotiroidismo, no especificado",category:"Endocrino"},
 {code:"I10",description:"Hipertensión esencial (primaria)",category:"Cardiovascular"},
 {code:"I25.10",description:"Cardiopatía isquémica aterosclerótica",category:"Cardiovascular"},
 {code:"I48.91",description:"Fibrilación auricular, no especificada",category:"Cardiovascular"},
 {code:"I50.9",description:"Insuficiencia cardíaca, no especificada",category:"Cardiovascular"},
 {code:"J45.909",description:"Asma, no especificada, no complicada",category:"Respiratorio"},
 {code:"J44.9",description:"Enfermedad pulmonar obstructiva crónica, no especificada",category:"Respiratorio"},
 {code:"J06.9",description:"Infección aguda de vías respiratorias superiores, no especificada",category:"Respiratorio"},
 {code:"J18.9",description:"Neumonía, no especificada",category:"Respiratorio"},
 {code:"K21.9",description:"Enfermedad por reflujo gastroesofágico sin esofagitis",category:"Digestivo"},
 {code:"K29.70",description:"Gastritis, no especificada, sin hemorragia",category:"Digestivo"},
 {code:"N18.3",description:"Enfermedad renal crónica, estadio 3 (moderada)",category:"Genitourinario"},
 {code:"N39.0",description:"Infección de vías urinarias, sitio no especificado",category:"Genitourinario"},
 {code:"M54.5",description:"Lumbalgia",category:"Musculoesquelético"},
 {code:"M17.9",description:"Gonartrosis, no especificada",category:"Musculoesquelético"},
 {code:"F41.9",description:"Trastorno de ansiedad, no especificado",category:"Salud mental"},
 {code:"F32.9",description:"Episodio depresivo, no especificado",category:"Salud mental"},
 {code:"F17.210",description:"Dependencia de nicotina, cigarrillos, no complicada",category:"Salud mental"},
 {code:"A09",description:"Diarrea y gastroenteritis de presunto origen infeccioso",category:"Infeccioso"},
 {code:"B34.9",description:"Infección viral, no especificada",category:"Infeccioso"},
 {code:"D64.9",description:"Anemia, no especificada",category:"Hematológico"},
 {code:"O80",description:"Parto único espontáneo",category:"Obstétrico"},
 {code:"Z00.00",description:"Examen médico general del adulto sin hallazgos anormales",category:"Factores de salud"},
 {code:"Z23",description:"Necesidad de inmunización contra una sola enfermedad",category:"Factores de salud"},
];
const BY_CODE=new Map(CATALOG.map(e=>[e.code.toUpperCase(),e]));
export function normalizeIcd10(code:string):string{return code.trim().toUpperCase();}
export function lookupIcd10(code:string):Icd10Entry|undefined{return BY_CODE.get(normalizeIcd10(code));}
export function isValidIcd10(code:string):boolean{return BY_CODE.has(normalizeIcd10(code));}
// Búsqueda simple por código o texto de la descripción (case-insensitive). Orden estable por código.
export function searchIcd10(query:string,limit=20):Icd10Entry[]{
 const q=query.trim().toLowerCase();
 if(!q)return[];
 return CATALOG.filter(e=>e.code.toLowerCase().includes(q)||e.description.toLowerCase().includes(q)||e.category.toLowerCase().includes(q))
  .sort((a,b)=>a.code.localeCompare(b.code)).slice(0,limit);
}
export function catalogSize():number{return CATALOG.length;}
