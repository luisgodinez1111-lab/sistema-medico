// EPIC BU — Monitoreo terapéutico del INR (anticoagulación oral con antagonistas de vitamina K). PROFUNDIDAD
// del eje C: interpreta el INR contra el rango objetivo (contexto del fármaco), no solo el rango de laboratorio.
// Puro, sin PHI. Rango objetivo por defecto 2.0–3.0 (FA/TVP); prótesis mecánica suele 2.5–3.5 (parametrizable).
export type InrStatus="SUBTHERAPEUTIC"|"THERAPEUTIC"|"SUPRATHERAPEUTIC"|"CRITICAL_HIGH";
export type InrTarget=Readonly<{low:number;high:number}>;
export type InrAssessment=Readonly<{inr:number;status:InrStatus;target:InrTarget;interpretation:string}>;
export function interpretINR(inr:number,target:InrTarget={low:2.0,high:3.0}):InrAssessment|undefined{
 if(!Number.isFinite(inr)||inr<=0)return undefined;
 let status:InrStatus,interpretation:string;
 if(inr>=5){status="CRITICAL_HIGH";interpretation="INR críticamente alto (≥5): alto riesgo de hemorragia — suspender dosis y considerar vitamina K";}
 else if(inr>target.high){status="SUPRATHERAPEUTIC";interpretation=`Supraterapéutico (>${target.high}): riesgo hemorrágico — reducir/omitir dosis y recontrolar`;}
 else if(inr<target.low){status="SUBTHERAPEUTIC";interpretation=`Subterapéutico (<${target.low}): riesgo trombótico — ajustar dosis al alza`;}
 else{status="THERAPEUTIC";interpretation=`En rango terapéutico (${target.low}–${target.high})`;}
 return{inr,status,target,interpretation};
}
