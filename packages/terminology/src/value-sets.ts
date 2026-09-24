// Auditoría 2026-09-19, anexo R03 (R03-17) — VALUE SETS VERSIONADOS de CIE-10 para los criterios de las escalas clínicas.
//
// Tres defectos que cierra este módulo:
//
// 1. **Emparejado dependiente del punto decimal.** Cada ruta llevaba su propio `has(codes, "I48")` con
//    `code.startsWith(prefix)` sobre el texto crudo. Un código registrado como «I48» coincide, «I48.0» coincide… pero
//    «I 48.0», «i48,0» o «I480» no coinciden con los prefijos que sí llevan punto. La CIE-10 se escribe de las dos formas
//    (con y sin punto) y el expediente recibe lo que teclea el médico: el criterio no puede depender de la puntuación.
//
// 2. **Prefijos incompletos.** Faltaban códigos que SÍ cuentan para los criterios: `Z86.7` (antecedente de enfermedad
//    cerebrovascular, que es exactamente el criterio «ictus/TIA previo»), `I70` (aterosclerosis, enfermedad vascular),
//    `I11`–`I15` (enfermedades hipertensivas: cardiopatía y nefropatía hipertensivas son hipertensión) y `E13` (otras
//    diabetes especificadas). Un criterio que no reconoce su propio código no es «negativo», es ciego.
//
// 3. **Criterio sin versión ni fuente.** Los conjuntos vivían dispersos en literales dentro de rutas; ahora cada uno
//    declara su versión y de qué criterio de qué escala sale, de modo que cambiar un criterio sea un cambio visible.
//
// Lo que este módulo NO resuelve, y queda declarado: la CIE-10 no distingue por sí misma un ANTECEDENTE de un evento
// ACTIVO (salvo los `Z86.*`, que son explícitamente antecedentes). Para CHA₂DS₂-VASc eso no cambia el resultado —el
// criterio es «ictus previo», así que el antecedente cuenta—, pero para CURB-65 sí importa: una neumonía pasada no es una
// neumonía actual. Esa distinción exige el estado del problema (activo/resuelto), que el expediente ya tiene y que los
// consumidores deben filtrar antes de llamar aquí.
export const ICD10_VALUE_SET_VERSION="2026-09-24" as const;

/**
 * Clave de EMPAREJADO de un código CIE-10: mayúsculas y sin separadores. «i48,0» → «I480»; «I48.0» → «I480».
 * Distinta a propósito de `normalizeIcd10` (index.ts), que es el normalizador de ALMACENAMIENTO y conserva el punto
 * porque el código guardado debe leerse igual que en el catálogo oficial. Aquí solo se compara.
 */
export function icd10Key(code:string):string{
 return code.toUpperCase().replace(/[^A-Z0-9]/g,"");
}
/**
 * ¿El código pertenece a la categoría/subcategoría del patrón? Compara en forma normalizada, de modo que el punto y los
 * espacios dejan de importar. «I48.0» coincide con «I48»; «I4» NO coincide con «I48» (no es una categoría CIE-10 válida).
 */
export function icd10Matches(code:string,pattern:string):boolean{
 const c=icd10Key(code),p=icd10Key(pattern);
 if(p.length<3)return false; // una categoría CIE-10 tiene 3 caracteres: una letra y dos dígitos
 return c.startsWith(p);
}
export type Icd10ValueSet=Readonly<{id:string;criterion:string;codes:readonly string[];note?:string}>;
/** ¿Alguno de los códigos del paciente pertenece al conjunto? */
export function inValueSet(codes:readonly string[],set:Icd10ValueSet):boolean{
 return codes.some(c=>set.codes.some(p=>icd10Matches(c,p)));
}

// Conjuntos por criterio. Los códigos son categorías CIE-10 de la OMS (3 caracteres) salvo cuando el criterio exige la
// subcategoría (`Z86.7`). Cada entrada dice de qué criterio de qué escala sale.
export const ICD10_VALUE_SETS={
 heartFailure:{id:"VS-CHF",criterion:"CHA₂DS₂-VASc «C»: insuficiencia cardiaca / disfunción ventricular",
  codes:["I50","I11.0","I13.0","I13.2","I42","I43"]},
 hypertension:{id:"VS-HTN",criterion:"CHA₂DS₂-VASc «H»: hipertensión arterial",
  codes:["I10","I11","I12","I13","I15"],
  note:"Incluye I11–I15 (cardiopatía y nefropatía hipertensivas, hipertensión secundaria): un paciente con cardiopatía hipertensiva es hipertenso."},
 diabetes:{id:"VS-DM",criterion:"CHA₂DS₂-VASc «D»: diabetes mellitus",
  codes:["E10","E11","E12","E13","E14"],
  note:"E12 (relacionada con desnutrición), E13 (otras especificadas) y E14 (no especificada) también son diabetes."},
 strokeOrTia:{id:"VS-STROKE",criterion:"CHA₂DS₂-VASc «S₂»: ictus, AIT o tromboembolismo previo",
  codes:["I60","I61","I62","I63","I64","G45","G46","I74","Z86.7"],
  note:"Z86.7 es ANTECEDENTE de enfermedad cerebrovascular, que es precisamente lo que el criterio pide."},
 vascularDisease:{id:"VS-VASC",criterion:"CHA₂DS₂-VASc «V»: enfermedad vascular (coronaria, periférica o aórtica)",
  codes:["I20","I21","I22","I25","I70","I71","I73","I74","Z95.1","Z95.5"],
  note:"I70 (aterosclerosis) y los Z95 de revascularización son enfermedad vascular establecida."},
 atrialFibrillation:{id:"VS-AF",criterion:"Contexto de aplicación de CHA₂DS₂-VASc: fibrilación o flutter auricular",
  codes:["I48"]},
 pneumonia:{id:"VS-PNA",criterion:"Contexto de aplicación de CURB-65: neumonía adquirida en la comunidad",
  codes:["J12","J13","J14","J15","J16","J17","J18"],
  note:"El consumidor debe pasar solo problemas ACTIVOS: una neumonía resuelta no hace aplicable el CURB-65."},
} as const satisfies Readonly<Record<string,Icd10ValueSet>>;
