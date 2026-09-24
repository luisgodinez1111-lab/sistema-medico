// EPIC AM — Terminología clínica CIE-10 (OMS). Subconjunto curado de diagnósticos frecuentes en atención primaria en México.
// Auditoría 2026-09-19 (U-13, K-04): el catálogo mezclaba códigos de ICD-10-CM (la modificación clínica de EE. UU., de 5–7
// caracteres: E11.65, J45.909, K29.70…) con la CIE-10 de la OMS, que es la que rige en México (NOM-024; SINBA/DGIS). Ahora
// TODOS los códigos son CIE-10 OMS (categoría de 3 caracteres o subcategoría de 4: "J45.9"); un test lo vigila. PROFUNDIDAD del eje C: convierte códigos de texto libre en datos
// CODIFICADOS y validados con descripción canónica. Puro, determinista, sin PHI.
// Autoridad: PROD (interoperabilidad semántica / NOM-024), CAP-TERMINOLOGY-001.
// Nota: subconjunto de demostración; el catálogo oficial completo se cargaría desde la fuente autorizada.
export type Icd10Entry=Readonly<{code:string;description:string;category:string}>;
const CATALOG:readonly Icd10Entry[]=[
 {code:"E11",description:"Diabetes mellitus tipo 2",category:"Endocrino"},
 {code:"E11.9",description:"Diabetes mellitus tipo 2 sin complicaciones",category:"Endocrino"},
 {code:"E11.2",description:"Diabetes mellitus tipo 2 con complicaciones renales",category:"Endocrino"},
 {code:"E11.3",description:"Diabetes mellitus tipo 2 con complicaciones oftálmicas",category:"Endocrino"},
 {code:"E11.4",description:"Diabetes mellitus tipo 2 con complicaciones neurológicas",category:"Endocrino"},
 {code:"E11.5",description:"Diabetes mellitus tipo 2 con complicaciones circulatorias periféricas",category:"Endocrino"},
 {code:"E11.6",description:"Diabetes mellitus tipo 2 con otras complicaciones especificadas",category:"Endocrino"},
 {code:"E10",description:"Diabetes mellitus tipo 1",category:"Endocrino"},
 {code:"E66.9",description:"Obesidad, no especificada",category:"Endocrino"},
 {code:"E78.5",description:"Hiperlipidemia, no especificada",category:"Endocrino"},
 {code:"E03.9",description:"Hipotiroidismo, no especificado",category:"Endocrino"},
 {code:"I10",description:"Hipertensión esencial (primaria)",category:"Cardiovascular"},
 {code:"I25.1",description:"Enfermedad aterosclerótica del corazón",category:"Cardiovascular"},
 {code:"I48.9",description:"Fibrilación y aleteo auricular, no especificado",category:"Cardiovascular"},
 {code:"I50.9",description:"Insuficiencia cardíaca, no especificada",category:"Cardiovascular"},
 {code:"J45.9",description:"Asma, no especificada",category:"Respiratorio"},
 {code:"J44.9",description:"Enfermedad pulmonar obstructiva crónica, no especificada",category:"Respiratorio"},
 {code:"J06.9",description:"Infección aguda de vías respiratorias superiores, no especificada",category:"Respiratorio"},
 {code:"J18.9",description:"Neumonía, no especificada",category:"Respiratorio"},
 {code:"K21.9",description:"Enfermedad por reflujo gastroesofágico sin esofagitis",category:"Digestivo"},
 {code:"K29.7",description:"Gastritis, no especificada",category:"Digestivo"},
 {code:"N18.3",description:"Enfermedad renal crónica, estadio 3 (moderada)",category:"Genitourinario"},
 {code:"N39.0",description:"Infección de vías urinarias, sitio no especificado",category:"Genitourinario"},
 {code:"M54.5",description:"Lumbalgia",category:"Musculoesquelético"},
 {code:"M17.9",description:"Gonartrosis, no especificada",category:"Musculoesquelético"},
 {code:"F41.9",description:"Trastorno de ansiedad, no especificado",category:"Salud mental"},
 {code:"F32.9",description:"Episodio depresivo, no especificado",category:"Salud mental"},
 {code:"F17.2",description:"Trastornos por uso de tabaco: síndrome de dependencia",category:"Salud mental"},
 {code:"A09",description:"Diarrea y gastroenteritis de presunto origen infeccioso",category:"Infeccioso"},
 {code:"B34.9",description:"Infección viral, no especificada",category:"Infeccioso"},
 {code:"D64.9",description:"Anemia, no especificada",category:"Hematológico"},
 {code:"O80",description:"Parto único espontáneo",category:"Obstétrico"},
 {code:"Z00.0",description:"Examen médico general",category:"Factores de salud"},
 {code:"Z23",description:"Necesidad de inmunización contra una sola enfermedad",category:"Factores de salud"},
 // ---- Auditoría 2026-09-19, anexo R03 (R03-17): criterios INALCANZABLES ----
 // Los scores clínicos leen la lista de problemas, y la lista de problemas solo admite códigos de ESTE catálogo. Con los
 // 34 códigos originales, el criterio «S₂» del CHA₂DS₂-VASc (ictus/AIT previo: 2 puntos, el de más peso de la escala) NO
 // TENÍA NINGÚN CÓDIGO REGISTRABLE: era imposible que se cumpliera en producción, y lo mismo pasaba con la enfermedad
 // vascular periférica, las cardiopatías hipertensivas y casi toda la neumonía. Un criterio que no puede activarse no es
 // un criterio «negativo»: es una comprobación ciega que baja el puntaje. Estos códigos son CIE-10 de la OMS.
 {code:"I63.9",description:"Infarto cerebral, no especificado",category:"Cardiovascular"},
 {code:"I64",description:"Accidente vascular encefálico agudo, no especificado como hemorrágico ni isquémico",category:"Cardiovascular"},
 {code:"I61.9",description:"Hemorragia intraencefálica, no especificada",category:"Cardiovascular"},
 {code:"I60.9",description:"Hemorragia subaracnoidea, no especificada",category:"Cardiovascular"},
 {code:"G45.9",description:"Isquemia cerebral transitoria, no especificada",category:"Neurológico"},
 {code:"Z86.7",description:"Antecedentes personales de enfermedades del aparato circulatorio",category:"Factores de salud"},
 {code:"I21.9",description:"Infarto agudo del miocardio, sin otra especificación",category:"Cardiovascular"},
 {code:"I70.2",description:"Aterosclerosis de las arterias de las extremidades",category:"Cardiovascular"},
 {code:"I73.9",description:"Enfermedad vascular periférica, no especificada",category:"Cardiovascular"},
 {code:"I71.4",description:"Aneurisma de la aorta abdominal, sin mención de ruptura",category:"Cardiovascular"},
 {code:"I11.0",description:"Enfermedad cardíaca hipertensiva con insuficiencia cardíaca (congestiva)",category:"Cardiovascular"},
 {code:"I11.9",description:"Enfermedad cardíaca hipertensiva sin insuficiencia cardíaca (congestiva)",category:"Cardiovascular"},
 {code:"I12.9",description:"Enfermedad renal hipertensiva sin insuficiencia renal",category:"Cardiovascular"},
 {code:"I50.0",description:"Insuficiencia cardíaca congestiva",category:"Cardiovascular"},
 {code:"I48.0",description:"Fibrilación auricular paroxística",category:"Cardiovascular"},
 {code:"I48.2",description:"Fibrilación auricular crónica",category:"Cardiovascular"},
 {code:"E14.9",description:"Diabetes mellitus, no especificada, sin mención de complicación",category:"Endocrino"},
 {code:"J13",description:"Neumonía debida a Streptococcus pneumoniae",category:"Respiratorio"},
 {code:"J15.9",description:"Neumonía bacteriana, no especificada",category:"Respiratorio"},
 {code:"J12.9",description:"Neumonía viral, no especificada",category:"Respiratorio"},
 {code:"J18.0",description:"Bronconeumonía, no especificada",category:"Respiratorio"},
 // R03-29: el estado gestacional y la lactancia tienen que ser REGISTRABLES para que las reglas de prescripción del
 // embarazo (que ya existían en el catálogo de fármacos) puedan activarse alguna vez.
 {code:"Z34.9",description:"Supervisión de embarazo normal, no especificado",category:"Obstétrico"},
 {code:"Z33",description:"Estado de embarazo, incidental",category:"Obstétrico"},
 {code:"Z39.1",description:"Cuidado y examen de la madre lactante",category:"Obstétrico"},
 {code:"O24.4",description:"Diabetes mellitus que se origina con el embarazo",category:"Obstétrico"},
 {code:"O14.9",description:"Preeclampsia, no especificada",category:"Obstétrico"},
 {code:"O21.0",description:"Hiperemesis gravídica leve",category:"Obstétrico"},
 // ---- Auditoría 2026-09-19, anexo R03 (R03-22): las categorías INALCANZABLES del índice de Charlson ----
 // El índice está implementado con sus 17 categorías y el mapeo de Quan 2005 (lote C-08), pero la lista de problemas solo
 // admite códigos de este catálogo: 9 de las 17 categorías —incluidas LAS DOS DE PESO 6 (tumor metastásico y SIDA) y la
 // de peso 3— no tenían ningún código registrable. El ejemplo del anexo: un paciente de 55 años con tumor metastásico y
 // SIDA (Charlson real 13, supervivencia a 10 años ≈0 %) puntuaba 1 y se informaba con 95.9 % de supervivencia. Con
 // estos códigos las 17 categorías son alcanzables y un test lo vigila. (Cargar la CIE-10 completa —14 000 códigos— desde
 // la fuente oficial sigue siendo decisión del dueño del producto: aquí se cubre lo que los algoritmos ya usan.)
 {code:"C34.9",description:"Tumor maligno del bronquio o del pulmón, parte no especificada",category:"Neoplasias"},
 {code:"C50.9",description:"Tumor maligno de la mama, parte no especificada",category:"Neoplasias"},
 {code:"C18.9",description:"Tumor maligno del colon, parte no especificada",category:"Neoplasias"},
 {code:"C61",description:"Tumor maligno de la próstata",category:"Neoplasias"},
 {code:"C53.9",description:"Tumor maligno del cuello del útero, parte no especificada",category:"Neoplasias"},
 {code:"C91.0",description:"Leucemia linfoblástica aguda",category:"Neoplasias"},
 {code:"C83.9",description:"Linfoma no folicular, no especificado",category:"Neoplasias"},
 {code:"C78.0",description:"Tumor maligno secundario del pulmón",category:"Neoplasias"},
 {code:"C79.5",description:"Tumor maligno secundario del hueso y de la médula ósea",category:"Neoplasias"},
 {code:"C80.9",description:"Tumor maligno de sitio no especificado",category:"Neoplasias"},
 {code:"B20.9",description:"Enfermedad por VIH resultante en enfermedad infecciosa o parasitaria no especificada",category:"Infeccioso"},
 {code:"B24",description:"Enfermedad por VIH, sin otra especificación",category:"Infeccioso"},
 {code:"F03",description:"Demencia, no especificada",category:"Salud mental"},
 {code:"G30.9",description:"Enfermedad de Alzheimer, no especificada",category:"Neurológico"},
 {code:"G81.9",description:"Hemiplejía, no especificada",category:"Neurológico"},
 {code:"G82.2",description:"Paraplejía, no especificada",category:"Neurológico"},
 {code:"M05.9",description:"Artritis reumatoide seropositiva, no especificada",category:"Musculoesquelético"},
 {code:"M32.9",description:"Lupus eritematoso sistémico, no especificado",category:"Musculoesquelético"},
 {code:"K27.9",description:"Úlcera péptica de sitio no especificado, no especificada como aguda ni crónica, sin hemorragia ni perforación",category:"Digestivo"},
 {code:"K74.6",description:"Cirrosis hepática, otras y no especificadas",category:"Digestivo"},
 {code:"B18.2",description:"Hepatitis viral tipo C crónica",category:"Digestivo"},
 {code:"K72.9",description:"Insuficiencia hepática, no especificada",category:"Digestivo"},
 {code:"I85.0",description:"Várices esofágicas con hemorragia",category:"Digestivo"},
 {code:"I21.9",description:"Infarto agudo del miocardio, no especificado",category:"Cardiovascular"},
 {code:"N18.4",description:"Enfermedad renal crónica, estadio 4 (grave)",category:"Genitourinario"},
 {code:"N18.5",description:"Enfermedad renal crónica, estadio 5",category:"Genitourinario"},
 {code:"J44.0",description:"Enfermedad pulmonar obstructiva crónica con infección aguda de las vías respiratorias inferiores",category:"Respiratorio"},
 {code:"E11.7",description:"Diabetes mellitus tipo 2 con complicaciones múltiples",category:"Endocrino"},
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
export*from"./value-sets";
