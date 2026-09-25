// EPIC BL — Función renal estimada (eGFR) por CKD-EPI 2021 (race-free, estándar actual) + estadificación ERC
// (KDIGO G1–G5). PROFUNDIDAD del eje C: convierte una creatinina cruda en función renal interpretada, base
// para el ajuste renal de dosis. Puro, sin PHI (recibe valor, edad, sexo). Validado para ADULTOS (>=18);
// en pediatría se usa Schwartz (no se computa aquí, se reporta not-computable). Umbrales KDIGO.
export type Sex="FEMALE"|"MALE";
export type CkdStage=Readonly<{stage:string;label:string}>;
export function ckdStage(egfr:number):CkdStage{
 if(egfr>=90)return{stage:"G1",label:"Normal o alto"};
 if(egfr>=60)return{stage:"G2",label:"Levemente disminuido"};
 if(egfr>=45)return{stage:"G3a",label:"Leve a moderadamente disminuido"};
 if(egfr>=30)return{stage:"G3b",label:"Moderada a severamente disminuido"};
 if(egfr>=15)return{stage:"G4",label:"Severamente disminuido"};
 return{stage:"G5",label:"Falla renal"};
}
// ============================================================================================================
// Cotejo de guías, decisión D2 (24-sep-2026, docs/compliance/cotejo-de-guias-clinicas.md §1) — ESTADIFICACIÓN C-G-A.
//
// EL HALLAZGO DEL COTEJO: la ecuación CKD-EPI 2021 estaba bien implementada, pero la ENFERMEDAD se estadificaba solo por
// filtración (G). KDIGO estadifica la ERC por CAUSA, FILTRACIÓN y ALBUMINURIA, y la conducta —frecuencia de vigilancia,
// referencia a nefrología— sale de la COMBINACIÓN de las dos últimas, no de la filtración sola.
//
// La consecuencia concreta, que es la que justifica este trabajo: un paciente con eGFR 95 y cociente albúmina/creatinina de
// 400 mg/g tiene ERC de RIESGO MUY ALTO según KDIGO, y el sistema lo presentaba como «G1 — normal o alto». Un daño renal
// establecido leído como función renal normal.
//
// NO SE INVENTA NINGÚN NÚMERO. Las categorías de albuminuria (A1 < 30, A2 30–300, A3 > 300 mg/g) ya estaban en el catálogo
// de laboratorio de este repositorio con su fuente KDIGO; la matriz de riesgo es la tabla publicada por la guía, transcrita
// entera, no una interpolación. Lo único que aporta este módulo es juntarlas.
//
// Fuente: KDIGO Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease (mapa de riesgo por
// categoría de TFG y de albuminuria). Verificar vigencia contra la actualización de 2024.
export type AlbuminuriaCategory="A1"|"A2"|"A3";
export type CkdRisk="LOW"|"MODERATE"|"HIGH"|"VERY_HIGH";
/** Cortes KDIGO del cociente albúmina/creatinina en orina (mg/g). Los mismos que el catálogo de laboratorio. */
export const UACR_CATEGORY_CUTOFFS={a1Below:30,a3Above:300}as const;
export function albuminuriaCategory(uacrMgG:number):AlbuminuriaCategory|undefined{
 if(!Number.isFinite(uacrMgG)||uacrMgG<0)return undefined;
 if(uacrMgG<UACR_CATEGORY_CUTOFFS.a1Below)return "A1";
 return uacrMgG<=UACR_CATEGORY_CUTOFFS.a3Above?"A2":"A3";
}
/** Mapa de riesgo de KDIGO, transcrito completo: filas G1–G5 × columnas A1–A3. */
const CGA_RISK:Readonly<Record<string,Readonly<Record<AlbuminuriaCategory,CkdRisk>>>>={
 G1:{A1:"LOW",A2:"MODERATE",A3:"HIGH"},
 G2:{A1:"LOW",A2:"MODERATE",A3:"HIGH"},
 G3a:{A1:"MODERATE",A2:"HIGH",A3:"VERY_HIGH"},
 G3b:{A1:"HIGH",A2:"VERY_HIGH",A3:"VERY_HIGH"},
 G4:{A1:"VERY_HIGH",A2:"VERY_HIGH",A3:"VERY_HIGH"},
 G5:{A1:"VERY_HIGH",A2:"VERY_HIGH",A3:"VERY_HIGH"},
};
const RISK_LABEL:Readonly<Record<CkdRisk,string>>={
 LOW:"Riesgo bajo",MODERATE:"Riesgo moderadamente aumentado",HIGH:"Riesgo alto",VERY_HIGH:"Riesgo muy alto",
};
const RISK_ACTION:Readonly<Record<CkdRisk,string>>={
 LOW:"Sin ERC por estos dos criterios si no hay otro marcador de daño renal. Vigilancia según el contexto clínico.",
 MODERATE:"Vigilancia al menos anual.",
 HIGH:"Vigilancia al menos cada 6 meses; valorar referencia a nefrología.",
 VERY_HIGH:"Vigilancia al menos cada 3–4 meses; referencia a nefrología.",
};
export type CgaStage=Readonly<{
 gCategory:string;aCategory:AlbuminuriaCategory;risk:CkdRisk;label:string;action:string;
 /** Falso cuando falta la albuminuria: entonces NO hay estadio C-G-A y no se puede afirmar riesgo. */
 complete:boolean;
 /** Lo que falta para poder estadificar, dicho en la respuesta. */
 missing:readonly string[];
}>;
/**
 * Estadio C-G-A. Sin albuminuria NO devuelve un riesgo: devuelve qué falta. Estadificar por filtración sola y llamarlo
 * riesgo es precisamente el defecto que corrige la decisión D2.
 */
export function cgaStage(egfr:number,uacrMgG?:number):CgaStage|undefined{
 if(!Number.isFinite(egfr))return undefined;
 const g=ckdStage(egfr).stage;
 const a=uacrMgG===undefined?undefined:albuminuriaCategory(uacrMgG);
 if(!a)return{gCategory:g,aCategory:"A1",risk:"LOW",label:"Estadio C-G-A incompleto",
  action:"Solicite cociente albúmina/creatinina en orina: sin albuminuria la ERC no se puede estadificar ni su riesgo afirmar (KDIGO).",
  complete:false,missing:["cociente albúmina/creatinina en orina (UACR)"]};
 const risk=CGA_RISK[g]![a];
 return{gCategory:g,aCategory:a,risk,label:`${g}${a} — ${RISK_LABEL[risk]}`,action:RISK_ACTION[risk],complete:true,missing:[]};
}
export type EgfrResult=Readonly<{egfr:number;stage:string;label:string}>;

// ---------- Auditoría 2026-09-19, anexo R03 (R03-01): el DOMINIO de CKD-EPI ----------
//
// El comentario de cabecera afirmaba «validado para adultos (>=18); en pediatría se usa Schwartz», y la función no
// comprobaba la edad: `computeEGFR(0.4, 3, "FEMALE")` devolvía un eGFR con estadio KDIGO para un niño de 3 años, donde
// la ecuación no es válida. Tampoco había cotas: una creatinina de 88.4 (el mismo valor en µmol/L, que equivale a
// 1.0 mg/dL) daba eGFR ≈0.5 y «G5 Falla renal» a un paciente con función renal NORMAL. Ahora el dominio se comprueba
// dentro de la función —la afirmación del comentario y el comportamiento del código por fin coinciden— y la pediatría
// tiene su propia ecuación en vez de un cálculo inválido.
export const EGFR_BOUNDS={scrMgDl:[0.1,25],ageYears:[18,120]}as const satisfies Readonly<Record<string,readonly[number,number]>>;
export type EgfrReject=Readonly<{reasonCode:"NON_NUMERIC"|"IMPLAUSIBLE_CREATININE"|"PEDIATRIC_REQUIRES_SCHWARTZ"|"AGE_OUT_OF_RANGE";detail:string}>;
/** Comprueba el dominio de CKD-EPI 2021. `undefined` = la entrada es utilizable. */
export function egfrCheck(scrMgDl:number,ageYears:number):EgfrReject|undefined{
 if(!Number.isFinite(scrMgDl)||!Number.isFinite(ageYears))return{reasonCode:"NON_NUMERIC",detail:"creatinina o edad no numéricas"};
 const[cl,chi]=EGFR_BOUNDS.scrMgDl;
 if(scrMgDl<cl||scrMgDl>chi)return{reasonCode:"IMPLAUSIBLE_CREATININE",detail:`creatinina ${scrMgDl} mg/dL fuera del rango plausible ${cl}–${chi}. Si el laboratorio informa en µmol/L, divida entre 88.4 (88.4 µmol/L = 1.0 mg/dL).`};
 const[al,ahi]=EGFR_BOUNDS.ageYears;
 if(ageYears<al)return{reasonCode:"PEDIATRIC_REQUIRES_SCHWARTZ",detail:`CKD-EPI 2021 se derivó en adultos (≥${al} años); edad ${ageYears}. En pediatría se usa Schwartz de cabecera, que requiere la TALLA.`};
 if(ageYears>ahi)return{reasonCode:"AGE_OUT_OF_RANGE",detail:`edad ${ageYears} fuera del rango ${al}–${ahi}`};
 return undefined;
}
// CKD-EPI 2021: 142 · min(Scr/κ,1)^α · max(Scr/κ,1)^-1.200 · 0.9938^edad · (1.012 si mujer). Scr en mg/dL.
export function computeEGFR(scrMgDl:number,ageYears:number,sex:Sex):EgfrResult|undefined{
 if(egfrCheck(scrMgDl,ageYears))return undefined;
 const female=sex==="FEMALE";
 const k=female?0.7:0.9;const a=female?-0.241:-0.302;
 const ratio=scrMgDl/k;
 const raw=142*Math.pow(Math.min(ratio,1),a)*Math.pow(Math.max(ratio,1),-1.200)*Math.pow(0.9938,ageYears)*(female?1.012:1);
 const egfr=Math.round(raw*10)/10;
 const s=ckdStage(egfr);
 return{egfr,stage:s.stage,label:s.label};
}

// ---------- Schwartz de cabecera (pediatría) ----------
// eGFR (mL/min/1.73 m²) = 0.413 × talla(cm) / creatinina(mg/dL).
// Fuente: Schwartz GJ et al. «New equations to estimate GFR in children with CKD». J Am Soc Nephrol 2009;20:629-637.
//
// Por qué existe esta función: antes del anexo R03, `grep schwartz` no encontraba nada fuera de un comentario. La
// consecuencia no era solo que CKD-EPI se aplicara a niños: es que la función renal pediátrica NO SE PODÍA ESTIMAR.
// Límites declarados: la ecuación se derivó en niños de 1 a 16 años con ERC; no se usa en lactantes menores de 1 año
// (donde la creatinina refleja aún la materna y se requieren ecuaciones específicas) ni sustituye a CKD-EPI en adultos.
// El resultado NO se estadifica como ERC KDIGO: la estadificación pediátrica y la exigencia de cronicidad (≥3 meses)
// son otro problema, y etiquetar «G5» con una sola creatinina es el defecto R03-02 que ya se corrigió en la ruta.
export const SCHWARTZ_AGE_RANGE=[1,17]as const;
export const SCHWARTZ_HEIGHT_CM_RANGE=[40,200]as const;
export type SchwartzReject=Readonly<{reasonCode:"NON_NUMERIC"|"OUT_OF_AGE_RANGE"|"IMPLAUSIBLE_HEIGHT"|"IMPLAUSIBLE_CREATININE";detail:string}>;
export type SchwartzResult=Readonly<{egfr:number;equation:"SCHWARTZ_BEDSIDE_2009";heightCm:number;ckdStaged:false;note:string}>;
export function schwartzCheck(heightCm:number,scrMgDl:number,ageYears:number):SchwartzReject|undefined{
 if(![heightCm,scrMgDl,ageYears].every(Number.isFinite))return{reasonCode:"NON_NUMERIC",detail:"talla, creatinina o edad no numéricas"};
 const[al,ahi]=SCHWARTZ_AGE_RANGE;
 if(ageYears<al||ageYears>ahi)return{reasonCode:"OUT_OF_AGE_RANGE",detail:`Schwartz de cabecera se derivó en niños de ${al} a ${ahi} años; edad ${ageYears}. Por debajo de ${al} año se requieren ecuaciones neonatales/de lactante (no implementadas); a partir de ${ahi+1} se usa CKD-EPI.`};
 const[hl,hhi]=SCHWARTZ_HEIGHT_CM_RANGE;
 if(heightCm<hl||heightCm>hhi)return{reasonCode:"IMPLAUSIBLE_HEIGHT",detail:`talla ${heightCm} cm fuera del rango plausible ${hl}–${hhi}`};
 const[cl,chi]=EGFR_BOUNDS.scrMgDl;
 if(scrMgDl<cl||scrMgDl>chi)return{reasonCode:"IMPLAUSIBLE_CREATININE",detail:`creatinina ${scrMgDl} mg/dL fuera del rango plausible ${cl}–${chi}`};
 return undefined;
}
export function schwartzBedside(heightCm:number,scrMgDl:number,ageYears:number):SchwartzResult|undefined{
 if(schwartzCheck(heightCm,scrMgDl,ageYears))return undefined;
 return{egfr:Math.round((0.413*heightCm/scrMgDl)*10)/10,equation:"SCHWARTZ_BEDSIDE_2009",heightCm,ckdStaged:false,
  note:"eGFR pediátrico por Schwartz de cabecera (0.413 × talla cm / creatinina mg/dL). NO se estadifica como ERC: la estadificación pediátrica y el requisito de cronicidad (≥3 meses) son aparte."};
}
