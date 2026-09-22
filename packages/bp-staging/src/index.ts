// EPIC BT — Estadificación de presión arterial (ACC/AHA 2017). PROFUNDIDAD del eje C: convierte S/D en el
// estadio clínico que guía el manejo de la hipertensión (la crónica más frecuente). Puro, sin PHI. Toma el
// estadio MÁS severo cuando sistólica y diastólica difieren (regla estándar). Umbrales ACC/AHA 2017.
// Auditoría 2026-09-19 (C-07): 65/40 salía "Presión normal — Reevaluar anualmente". ACC/AHA estadifica la HIPERTENSIÓN;
// la hipotensión no es "normal": se reporta como estado propio, con los mismos cortes que classifyVital (lab-reference):
// sistólica < 90 o diastólica < 60 = hipotensión; sistólica < 70 = severa (perfusión comprometida hasta demostrar lo contrario).
export type BpStage="HYPOTENSION_SEVERE"|"HYPOTENSION"|"NORMAL"|"ELEVATED"|"STAGE_1"|"STAGE_2"|"CRISIS";
export type BpStaging=Readonly<{systolic:number;diastolic:number;stage:BpStage;label:string;actionNote:string}>;
export function stageBloodPressure(systolic:number,diastolic:number):BpStaging|undefined{
 if(![systolic,diastolic].every(Number.isFinite)||systolic<=0||diastolic<=0)return undefined;
 let stage:BpStage,label:string,actionNote:string;
 if(systolic<70){stage="HYPOTENSION_SEVERE";label="Hipotensión severa";actionNote="Evaluación inmediata: perfusión, estado de conciencia, sangrado/sepsis/deshidratación; no es un hallazgo ambulatorio";}
 else if(systolic>180||diastolic>120){stage="CRISIS";label="Crisis hipertensiva";actionNote="Evaluación urgente; descartar daño a órgano blanco";}
 else if(systolic>=140||diastolic>=90){stage="STAGE_2";label="Hipertensión estadio 2";actionNote="Iniciar/ajustar 2 fármacos; seguimiento estrecho";}
 else if(systolic>=130||diastolic>=80){stage="STAGE_1";label="Hipertensión estadio 1";actionNote="Cambios de estilo de vida ± fármaco según riesgo CV";}
 else if(systolic>=120){stage="ELEVATED";label="Presión elevada";actionNote="Cambios de estilo de vida; reevaluar en 3–6 meses";}
 else if(systolic<90||diastolic<60){stage="HYPOTENSION";label="Hipotensión";actionNote="Correlacionar con síntomas (mareo, síncope), volemia y fármacos hipotensores; repetir la toma";}
 else{stage="NORMAL";label="Presión normal";actionNote="Reevaluar anualmente";}
 return{systolic,diastolic,stage,label,actionNote};
}
// Parsea "S/D" a números. undefined si no reconoce el formato.
export function parseBp(value:string):{systolic:number;diastolic:number}|undefined{
 const m=/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/.exec(value);
 if(!m)return undefined;
 return{systolic:Number(m[1]),diastolic:Number(m[2])};
}
