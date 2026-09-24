// EPIC BN — Derivaciones de laboratorio MULTI-analito: calcula nuevos valores clínicos a partir de varios
// resultados (no solo clasifica uno). PROFUNDIDAD del eje C. Puro, sin PHI (recibe números). Umbrales de
// demostración; los oficiales/por método se parametrizarían aparte.
import{classifyLab,type LabStatus}from"../../lab-reference/src";

function round1(n:number):number{return Math.round(n*10)/10;}

// ---- Brecha aniónica (anion gap) = Na − (Cl + HCO3). Alta (>12) sugiere acidosis metabólica de brecha
// aumentada (cetoacidosis, uremia, lactato, tóxicos). Puro. ----
export type AnionGapStatus="HIGH"|"NORMAL"|"LOW";
export type AnionGap=Readonly<{value:number;status:AnionGapStatus;interpretation:string}>;
// Auditoría 2026-09-19 (C-22): la hipoalbuminemia BAJA la brecha y enmascara una acidosis de brecha aumentada. Con albúmina
// (g/dL) se corrige (Figge): AG + 2.5·(4 − albúmina). Sin albúmina se informa la brecha cruda y se declara sin corregir.
export type AnionGapEx=AnionGap&Readonly<{raw:number;albuminCorrected:boolean;albuminGdl?:number}>;
export function anionGap(sodium:number,chloride:number,bicarbonate:number,albuminGdl?:number):AnionGapEx|undefined{
 if(![sodium,chloride,bicarbonate].every(Number.isFinite))return undefined;
 const raw=round1(sodium-chloride-bicarbonate);
 const albuminCorrected=albuminGdl!==undefined&&Number.isFinite(albuminGdl)&&albuminGdl>0;
 const value=albuminCorrected?round1(raw+2.5*(4-albuminGdl)):raw;
 let status:AnionGapStatus,interpretation:string;
 if(value>12){status="HIGH";interpretation="Brecha aniónica elevada: acidosis metabólica de brecha aumentada (cetoacidosis, uremia, lactato, tóxicos)";}
 else if(value<8){status="LOW";interpretation="Brecha aniónica baja (hipoalbuminemia, paraproteínas)";}
 else{status="NORMAL";interpretation="Brecha aniónica normal";}
 if(albuminCorrected)interpretation+=` (corregida por albúmina ${albuminGdl} g/dL; cruda ${raw})`;else interpretation+=" (sin corregir por albúmina: una hipoalbuminemia la subestima)";
 return albuminCorrected?{value,status,interpretation,raw,albuminCorrected,albuminGdl:albuminGdl!}:{value,status,interpretation,raw,albuminCorrected};
}

// ---- Sodio corregido por glucemia (EPIC BY). La hiperglucemia arrastra agua al intravascular y DILUYE el
// sodio (pseudohiponatremia). Na corregido = Na + 1.6·((glucosa − 100)/100) (factor de Katz). Puro. ----
export type CorrectedSodium=Readonly<{measured:number;corrected:number;glucose:number;interpretation:string;applied:boolean}>;
// Auditoría 2026-09-19, anexo R03 (vector F03): el factor de Katz se derivó para HIPERGLUCEMIA y se aplicaba a cualquier
// glucemia. Con glucosa 50 mg/dL «corregía» un sodio de 140 a 139.2 e informaba «≈ medido»: una corrección fuera de su
// dominio, presentada como resultado. Ahora, por debajo de 100 mg/dL NO se corrige (se devuelve el medido) y se declara.
export const SODIUM_CORRECTION_GLUCOSE_THRESHOLD=100;
export function correctedSodiumForGlucose(sodium:number,glucose:number):CorrectedSodium|undefined{
 if(![sodium,glucose].every(Number.isFinite)||glucose<=0)return undefined;
 const applied=glucose>SODIUM_CORRECTION_GLUCOSE_THRESHOLD;
 const corrected=applied?round1(sodium+1.6*((glucose-100)/100)):round1(sodium);
 const interpretation=applied
  ?`Sodio corregido ${corrected} mEq/L (medido ${sodium}, glucosa ${glucose}): la hiperglucemia diluye el sodio medido`
  :`Sin hiperglucemia (glucosa ${round1(glucose)} ≤ ${SODIUM_CORRECTION_GLUCOSE_THRESHOLD} mg/dL): NO se aplica la corrección de Katz, que solo es válida en hiperglucemia. Se informa el sodio medido.`;
 return{measured:round1(sodium),corrected,glucose:round1(glucose),interpretation,applied};
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
