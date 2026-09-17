// EPIC AQ — Rangos de referencia de laboratorio + valores de pánico (PROFUNDIDAD del eje C / CDS).
// Deriva el estado clínico (NORMAL/ABNORMAL/CRITICAL) y el flag `critical` del VALOR real de un analito,
// en vez de confiar en un booleano del cliente. Alimenta el closed-loop de resultados críticos
// (Zero Lost Follow-Up). Puro, sin PHI. Umbrales de adulto de demostración; los oficiales/por método
// se parametrizarían del laboratorio. Autoridad: PROD (resultados críticos / valores de pánico), CAP-LAB-REF-001.
export type LabStatus="NORMAL"|"ABNORMAL"|"CRITICAL"|"UNKNOWN";
export type LabAssessment=Readonly<{status:LabStatus;critical:boolean;interpretation:string}>;
// [criticalLow, abnormalLow, abnormalHigh, criticalHigh]
const RANGES:Record<string,readonly[number,number,number,number]>={
 GLUCOSE:[40,70,200,500],        // mg/dL
 POTASSIUM:[2.5,3.5,5.1,6.5],    // mEq/L
 SODIUM:[120,135,145,160],       // mEq/L
 HEMOGLOBIN:[7,12,17,20],        // g/dL
 WBC:[1,4,11,30],                // 10^3/uL
 PLATELETS:[20,150,400,1000],    // 10^3/uL
 CREATININE:[0,0,1.3,4],         // mg/dL (sin límite bajo relevante)
 INR:[0,0,3.5,5],                // sin límite bajo
 LACTATE:[0,0,2,4],              // mmol/L
 TROPONIN:[0,0,0.04,0.04],       // ng/mL: cualquier elevación >0.04 es crítica
};
function num(x:string):number{const n=Number(String(x).trim());return Number.isFinite(n)?n:NaN;}
export function classifyLab(analyte:string,value:string):LabAssessment{
 const key=analyte.trim().toUpperCase();const rng=RANGES[key];
 if(!rng)return{status:"UNKNOWN",critical:false,interpretation:"Analito sin rango de referencia"};
 const v=num(value);if(Number.isNaN(v))return{status:"UNKNOWN",critical:false,interpretation:"Valor no numérico"};
 const[cl,al,ah,ch]=rng;
 if((cl>0&&v<cl)||v>ch)return{status:"CRITICAL",critical:true,interpretation:v>ch?`${key} críticamente alto`:`${key} críticamente bajo`};
 if((al>0&&v<al)||v>ah)return{status:"ABNORMAL",critical:false,interpretation:v>ah?`${key} alto`:`${key} bajo`};
 return{status:"NORMAL",critical:false,interpretation:`${key} normal`};
}
