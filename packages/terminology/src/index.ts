// EPIC AM — Terminología clínica CIE-10 (OMS). Subconjunto curado de diagnósticos frecuentes en atención primaria en México.
// Auditoría 2026-09-19 (U-13, K-04): el catálogo mezclaba códigos de ICD-10-CM (la modificación clínica de EE. UU., de 5–7
// caracteres: E11.65, J45.909, K29.70…) con la CIE-10 de la OMS, que es la que rige en México (NOM-024; SINBA/DGIS). Ahora
// TODOS los códigos son CIE-10 OMS (categoría de 3 caracteres o subcategoría de 4: "J45.9"); un test lo vigila. PROFUNDIDAD del eje C: convierte códigos de texto libre en datos
// CODIFICADOS y validados con descripción canónica. Puro, determinista, sin PHI.
// Autoridad: PROD (interoperabilidad semántica / NOM-024), CAP-TERMINOLOGY-001.
// Nota: subconjunto de demostración; el catálogo oficial completo se cargaría desde la fuente autorizada.
import{ICD10_WHO_TSV}from"./icd10-who-data";
export type Icd10Entry=Readonly<{code:string;description:string;category:string}>;
// CURATED: subconjunto autoritativo (descripciones canónicas exactas + categorías finas + códigos que los algoritmos de
// comorbilidad necesitan REGISTRABLES). Gana sobre el dataset masivo en caso de código repetido.
const CURATED:readonly Icd10Entry[]=[
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
 // Auditoría 2026-09-19 (hallado al cablear R05a-F03): la UI etiquetaba N18.6 y M15 y el catálogo no los conocía, así que
 // el sistema podía MOSTRAR un diagnóstico que no podía CODIFICAR ni validar. N18.6 es además el estadio que más cambia la
 // conducta —enfermedad renal crónica terminal, dependiente de diálisis— y faltaba precisamente ése.
 {code:"N18.6",description:"Enfermedad renal crónica terminal (dependiente de diálisis)",category:"Genitourinario"},
 {code:"M15.9",description:"Poliartrosis, no especificada",category:"Musculoesquelético"},
 {code:"J44.0",description:"Enfermedad pulmonar obstructiva crónica con infección aguda de las vías respiratorias inferiores",category:"Respiratorio"},
 {code:"E11.7",description:"Diabetes mellitus tipo 2 con complicaciones múltiples",category:"Endocrino"},
 // ---- Ampliación (solicitud del dueño): presentaciones FRECUENTES de consultorio / atención primaria, de lo muy leve a
 // lo agudo cotidiano. El catálogo estaba sesgado a crónicas (para los algoritmos de comorbilidad); esto cubre el motivo
 // real de la mayoría de las consultas. Todos son CIE-10 OMS (categoría de 3 o subcategoría de 4; el test de formato lo vigila).
 // Respiratorio agudo
 {code:"J00",description:"Rinofaringitis aguda (resfriado común)",category:"Respiratorio"},
 {code:"J01.9",description:"Sinusitis aguda, no especificada",category:"Respiratorio"},
 {code:"J02.9",description:"Faringitis aguda, no especificada",category:"Respiratorio"},
 {code:"J02.0",description:"Faringitis estreptocócica",category:"Respiratorio"},
 {code:"J03.9",description:"Amigdalitis aguda, no especificada",category:"Respiratorio"},
 {code:"J04.0",description:"Laringitis aguda",category:"Respiratorio"},
 {code:"J11.1",description:"Influenza (gripe) con otras manifestaciones respiratorias, virus no identificado",category:"Respiratorio"},
 {code:"J20.9",description:"Bronquitis aguda, no especificada",category:"Respiratorio"},
 {code:"J21.9",description:"Bronquiolitis aguda, no especificada",category:"Respiratorio"},
 {code:"J30.4",description:"Rinitis alérgica, no especificada",category:"Respiratorio"},
 {code:"J40",description:"Bronquitis, no especificada como aguda ni crónica",category:"Respiratorio"},
 // Otorrinolaringología
 {code:"H66.9",description:"Otitis media, no especificada",category:"Otorrinolaringología"},
 {code:"H60.9",description:"Otitis externa, no especificada",category:"Otorrinolaringología"},
 {code:"H61.2",description:"Cerumen impactado (tapón de cerumen)",category:"Otorrinolaringología"},
 {code:"H92.0",description:"Otalgia (dolor de oído)",category:"Otorrinolaringología"},
 // Oftalmología
 {code:"H10.9",description:"Conjuntivitis, no especificada",category:"Oftalmología"},
 {code:"H10.1",description:"Conjuntivitis alérgica aguda",category:"Oftalmología"},
 {code:"H00.0",description:"Orzuelo y otras inflamaciones profundas del párpado",category:"Oftalmología"},
 {code:"H01.0",description:"Blefaritis",category:"Oftalmología"},
 {code:"H57.1",description:"Dolor ocular",category:"Oftalmología"},
 // Neurológico / cefalea / sueño
 {code:"R51",description:"Cefalea",category:"Síntomas y signos"},
 {code:"G43.9",description:"Migraña, no especificada",category:"Neurológico"},
 {code:"G44.2",description:"Cefalea tensional",category:"Neurológico"},
 {code:"R42",description:"Mareo y desvanecimiento",category:"Síntomas y signos"},
 {code:"H81.1",description:"Vértigo posicional paroxístico benigno",category:"Otorrinolaringología"},
 {code:"R55",description:"Síncope y colapso",category:"Síntomas y signos"},
 {code:"R56.8",description:"Otras convulsiones y las no especificadas",category:"Neurológico"},
 {code:"G47.0",description:"Trastornos del inicio y del mantenimiento del sueño (insomnio)",category:"Neurológico"},
 // Digestivo frecuente
 {code:"K30",description:"Dispepsia (indigestión funcional)",category:"Digestivo"},
 {code:"K59.0",description:"Estreñimiento",category:"Digestivo"},
 {code:"K58.9",description:"Síndrome del intestino irritable sin diarrea",category:"Digestivo"},
 {code:"K52.9",description:"Gastroenteritis y colitis no infecciosas, no especificadas",category:"Digestivo"},
 {code:"K12.0",description:"Aftas bucales recurrentes",category:"Digestivo"},
 {code:"K05.1",description:"Gingivitis crónica",category:"Digestivo"},
 {code:"K02.9",description:"Caries dental, no especificada",category:"Digestivo"},
 {code:"K64.9",description:"Hemorroides, no especificadas",category:"Digestivo"},
 {code:"A08.4",description:"Infección intestinal viral, no especificada",category:"Infeccioso"},
 {code:"B82.9",description:"Parasitosis intestinal, no especificada",category:"Infeccioso"},
 // Genitourinario / ginecológico
 {code:"N30.0",description:"Cistitis aguda",category:"Genitourinario"},
 {code:"N76.0",description:"Vaginitis aguda",category:"Ginecológico"},
 {code:"B37.3",description:"Candidiasis de la vulva y de la vagina",category:"Ginecológico"},
 {code:"N94.6",description:"Dismenorrea, no especificada",category:"Ginecológico"},
 {code:"N91.2",description:"Amenorrea, no especificada",category:"Ginecológico"},
 {code:"N95.1",description:"Estados menopáusicos y climatéricos femeninos",category:"Ginecológico"},
 {code:"Z30.0",description:"Consejo y asesoramiento general sobre anticoncepción",category:"Factores de salud"},
 // Dermatología
 {code:"L20.9",description:"Dermatitis atópica, no especificada",category:"Dermatología"},
 {code:"L23.9",description:"Dermatitis alérgica de contacto, de causa no especificada",category:"Dermatología"},
 {code:"L30.9",description:"Dermatitis, no especificada",category:"Dermatología"},
 {code:"L50.9",description:"Urticaria, no especificada",category:"Dermatología"},
 {code:"L70.0",description:"Acné vulgar",category:"Dermatología"},
 {code:"L03.9",description:"Celulitis, no especificada",category:"Dermatología"},
 {code:"L02.9",description:"Absceso cutáneo, forúnculo y carbunco, de sitio no especificado",category:"Dermatología"},
 {code:"L65.9",description:"Pérdida no cicatricial del pelo, no especificada (alopecia)",category:"Dermatología"},
 {code:"B35.9",description:"Dermatofitosis (tiña), no especificada",category:"Dermatología"},
 {code:"B35.1",description:"Tiña de las uñas (onicomicosis)",category:"Dermatología"},
 {code:"B35.3",description:"Tiña del pie (pie de atleta)",category:"Dermatología"},
 {code:"B07",description:"Verrugas víricas",category:"Dermatología"},
 {code:"B00.9",description:"Infección por virus del herpes simple, no especificada",category:"Dermatología"},
 {code:"B02.9",description:"Herpes zóster sin complicaciones",category:"Dermatología"},
 {code:"B08.1",description:"Molusco contagioso",category:"Dermatología"},
 {code:"B86",description:"Escabiosis (sarna)",category:"Dermatología"},
 // Musculoesquelético agudo
 {code:"M54.2",description:"Cervicalgia",category:"Musculoesquelético"},
 {code:"M54.4",description:"Lumbago con ciática",category:"Musculoesquelético"},
 {code:"M54.9",description:"Dorsalgia, no especificada",category:"Musculoesquelético"},
 {code:"M79.1",description:"Mialgia",category:"Musculoesquelético"},
 {code:"M25.5",description:"Dolor articular (artralgia)",category:"Musculoesquelético"},
 {code:"M10.9",description:"Gota, no especificada",category:"Musculoesquelético"},
 {code:"M77.9",description:"Entesopatía, no especificada (tendinitis)",category:"Musculoesquelético"},
 {code:"S93.4",description:"Esguince y torcedura del tobillo",category:"Musculoesquelético"},
 {code:"S13.4",description:"Esguince y torcedura de la columna cervical",category:"Musculoesquelético"},
 // Infeccioso / vírico frecuente
 {code:"U07.1",description:"COVID-19, virus identificado",category:"Infeccioso"},
 {code:"B01.9",description:"Varicela sin complicaciones",category:"Infeccioso"},
 {code:"B26.9",description:"Parotiditis (paperas) sin complicaciones",category:"Infeccioso"},
 // Síntomas y signos (motivos de consulta muy frecuentes)
 {code:"R50.9",description:"Fiebre, no especificada",category:"Síntomas y signos"},
 {code:"R05",description:"Tos",category:"Síntomas y signos"},
 {code:"R07.0",description:"Dolor de garganta (odinofagia)",category:"Síntomas y signos"},
 {code:"R07.4",description:"Dolor torácico, no especificado",category:"Síntomas y signos"},
 {code:"R06.0",description:"Disnea",category:"Síntomas y signos"},
 {code:"R10.4",description:"Otros dolores abdominales y los no especificados",category:"Síntomas y signos"},
 {code:"R11",description:"Náuseas y vómito",category:"Síntomas y signos"},
 {code:"R21",description:"Salpullido y otras erupciones cutáneas no especificadas",category:"Síntomas y signos"},
 {code:"R53",description:"Malestar, fatiga y astenia",category:"Síntomas y signos"},
 {code:"R60.9",description:"Edema, no especificado",category:"Síntomas y signos"},
 {code:"R63.4",description:"Pérdida anormal de peso",category:"Síntomas y signos"},
 {code:"R00.2",description:"Palpitaciones",category:"Síntomas y signos"},
 {code:"R04.0",description:"Epistaxis (sangrado nasal)",category:"Síntomas y signos"},
 {code:"E86",description:"Depleción del volumen (deshidratación)",category:"Endocrino"},
 // Salud mental leve frecuente
 {code:"F43.0",description:"Reacción al estrés agudo",category:"Salud mental"},
 {code:"F45.9",description:"Trastorno somatomorfo, no especificado",category:"Salud mental"},
 // Consulta preventiva / factores de salud
 {code:"Z00.1",description:"Control de salud del niño (niño sano)",category:"Factores de salud"},
 {code:"Z02.7",description:"Emisión de certificado médico",category:"Factores de salud"},
 {code:"Z71.9",description:"Consulta para asesoramiento, no especificada",category:"Factores de salud"},
];
// Dataset COMPLETO de la CIE-10 OMS (~14 000 diagnósticos, todas las especialidades: de medicina general a psiquiatría,
// oncología, ginecología, etc.). Se parsea del TSV una vez al cargar el módulo (síncrono: también valida en el servidor).
// Los códigos ya presentes en CURATED se omiten (CURATED gana: conserva descripción canónica y categoría fina).
const CURATED_CODES=new Set(CURATED.map(e=>e.code.toUpperCase()));
const DATASET:Icd10Entry[]=[];
for(const line of ICD10_WHO_TSV.split("\n")){
 const t=line.split("\t");const code=t[0],description=t[1],category=t[2]??"Otros";
 if(!code||!description||CURATED_CODES.has(code.toUpperCase()))continue;
 DATASET.push({code,description,category});
}
const CATALOG:readonly Icd10Entry[]=[...CURATED,...DATASET];
const BY_CODE=new Map(CATALOG.map(e=>[e.code.toUpperCase(),e]));
export function normalizeIcd10(code:string):string{return code.trim().toUpperCase();}
export function lookupIcd10(code:string):Icd10Entry|undefined{return BY_CODE.get(normalizeIcd10(code));}
export function isValidIcd10(code:string):boolean{return BY_CODE.has(normalizeIcd10(code));}
// Búsqueda por código o texto (case-insensitive), ordenada por RELEVANCIA y con desempate estable por código. Al ampliar el
// catálogo, una subcadena podía tapar la coincidencia obvia (p. ej. «tos» devolvía «dermatofiTOSis» antes que «Tos» R05).
// Ranking: código exacto > código que empieza por la consulta > palabra de la descripción que empieza por la consulta >
// subcadena de la descripción > subcadena de código > categoría. Dentro de cada nivel, orden por código (estable).
const wordStart=(text:string,q:string):boolean=>{let i=text.indexOf(q);while(i!==-1){if(i===0||!/[a-záéíóúüñ]/.test(text[i-1]!))return true;i=text.indexOf(q,i+1);}return false;};
function rankIcd10(e:Icd10Entry,q:string):number{
 const code=e.code.toLowerCase(),desc=e.description.toLowerCase(),cat=e.category.toLowerCase();
 if(code===q)return 0;
 if(code.startsWith(q))return 1;
 if(wordStart(desc,q))return 2;
 if(desc.includes(q))return 3;
 if(code.includes(q))return 4;
 if(cat.includes(q))return 5;
 return 6;
}
export function searchIcd10(query:string,limit=20):Icd10Entry[]{
 const q=query.trim().toLowerCase();
 if(!q)return[];
 // Dentro del mismo nivel de relevancia, las entradas CURADAS (comunes/autoritativas) van primero; luego, orden por código.
 return CATALOG.filter(e=>e.code.toLowerCase().includes(q)||e.description.toLowerCase().includes(q)||e.category.toLowerCase().includes(q))
  .map(e=>({e,r:rankIcd10(e,q)*2+(CURATED_CODES.has(e.code.toUpperCase())?0:1)}))
  .sort((a,b)=>a.r-b.r||a.e.code.localeCompare(b.e.code)).map(x=>x.e).slice(0,limit);
}
export function catalogSize():number{return CATALOG.length;}
export*from"./value-sets";
