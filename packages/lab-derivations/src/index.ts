// EPIC BN — Derivaciones de laboratorio MULTI-analito: calcula nuevos valores clínicos a partir de varios
// resultados (no solo clasifica uno). PROFUNDIDAD del eje C. Puro, sin PHI (recibe números). Umbrales de
// demostración; los oficiales/por método se parametrizarían aparte.
import{classifyLab,type LabStatus}from"../../lab-reference/src";

function round1(n:number):number{return Math.round(n*10)/10;}

// ---- Brecha aniónica (anion gap) = Na − (Cl + HCO3). Alta (>12) sugiere acidosis metabólica de brecha
// aumentada (cetoacidosis, uremia, lactato, tóxicos). Puro. ----
export type AnionGapStatus="HIGH"|"NORMAL"|"LOW";
export type AnionGap=Readonly<{value:number;status:AnionGapStatus;interpretation:string}>;
export function anionGap(sodium:number,chloride:number,bicarbonate:number):AnionGap|undefined{
 if(![sodium,chloride,bicarbonate].every(Number.isFinite))return undefined;
 const value=round1(sodium-chloride-bicarbonate);
 let status:AnionGapStatus,interpretation:string;
 if(value>12){status="HIGH";interpretation="Brecha aniónica elevada: acidosis metabólica de brecha aumentada (cetoacidosis, uremia, lactato, tóxicos)";}
 else if(value<8){status="LOW";interpretation="Brecha aniónica baja (hipoalbuminemia, paraproteínas)";}
 else{status="NORMAL";interpretation="Brecha aniónica normal";}
 return{value,status,interpretation};
}

// ---- Calcio corregido por albúmina = Ca + 0.8·(4.0 − albúmina). Desenmascara hipo/hipercalcemia cuando la
// albúmina es anormal (el calcio total está ligado a albúmina). Reclasifica con el rango de calcio. ----
export type CorrectedCalcium=Readonly<{measured:number;corrected:number;albumin:number;status:LabStatus;interpretation:string}>;
export function correctedCalcium(measuredCa:number,albumin:number):CorrectedCalcium|undefined{
 if(![measuredCa,albumin].every(Number.isFinite)||albumin<=0)return undefined;
 const corrected=round1(measuredCa+0.8*(4.0-albumin));
 const a=classifyLab("CALCIUM",String(corrected));
 const shifted=Math.abs(corrected-measuredCa)>=0.3;
 const interpretation=`Calcio corregido ${corrected} mg/dL (medido ${measuredCa}, albúmina ${albumin}): ${a.interpretation}`+(shifted?" — la corrección cambia la interpretación vs el calcio total":"");
 return{measured:round1(measuredCa),corrected,albumin:round1(albumin),status:a.status,interpretation};
}
