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

// ---- Sodio corregido por glucemia (EPIC BY). La hiperglucemia arrastra agua al intravascular y DILUYE el
// sodio (pseudohiponatremia). Na corregido = Na + 1.6·((glucosa − 100)/100) (factor de Katz). Puro. ----
export type CorrectedSodium=Readonly<{measured:number;corrected:number;glucose:number;interpretation:string}>;
export function correctedSodiumForGlucose(sodium:number,glucose:number):CorrectedSodium|undefined{
 if(![sodium,glucose].every(Number.isFinite)||glucose<=0)return undefined;
 const corrected=round1(sodium+1.6*((glucose-100)/100));
 const interpretation=glucose>100
  ?`Sodio corregido ${corrected} mEq/L (medido ${sodium}, glucosa ${glucose}): la hiperglucemia diluye el sodio medido`
  :`Sin hiperglucemia significativa; sodio corregido ≈ medido`;
 return{measured:round1(sodium),corrected,glucose:round1(glucose),interpretation};
}

// ---- Osmolalidad sérica calculada (EPIC BY) = 2·Na + glucosa/18 + BUN/2.8. Normal ~275–295 mOsm/kg. Alta:
// estados hiperosmolares (hiperglucemia, uremia). Puro. ----
export type OsmoStatus="HIGH"|"NORMAL"|"LOW";
export type CalculatedOsmolality=Readonly<{value:number;status:OsmoStatus;interpretation:string}>;
export function calculatedOsmolality(sodium:number,glucose:number,bun:number):CalculatedOsmolality|undefined{
 if(![sodium,glucose,bun].every(Number.isFinite)||sodium<=0)return undefined;
 const value=round1(2*sodium+glucose/18+bun/2.8);
 let status:OsmoStatus,interpretation:string;
 if(value>295){status="HIGH";interpretation="Hiperosmolar (>295): considerar hiperglucemia/uremia/deshidratación";}
 else if(value<275){status="LOW";interpretation="Hipoosmolar (<275): considerar hiponatremia/hipervolemia";}
 else{status="NORMAL";interpretation="Osmolalidad calculada normal (275–295)";}
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
