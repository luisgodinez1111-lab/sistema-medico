// EPIC BZ — CURB-65: gravedad de neumonía adquirida en la comunidad -> decisión de ingreso. PROFUNDIDAD del
// eje C. 1 punto c/u: Confusión (nueva), Urea(BUN)>19 mg/dL, FR>=30, PA (sist<90 o diast<=60), edad>=65.
// Puro, sin PHI. La confusión no se captura como dato estructurado -> se asume 0 y se reporta como asunción.
export type Curb65Risk="LOW"|"MODERATE"|"HIGH";
export type Curb65Input=Readonly<{confusion:boolean;bun:number;respRate:number;systolic:number;diastolic:number;ageYears:number}>;
export type Curb65Result=Readonly<{score:number;criteria:Readonly<Record<string,number>>;risk:Curb65Risk;recommendation:string;mortality:string}>;
export function curb65(i:Curb65Input):Curb65Result|undefined{
 if(![i.bun,i.respRate,i.systolic,i.diastolic,i.ageYears].every(Number.isFinite))return undefined;
 const criteria:Record<string,number>={
  confusion:i.confusion?1:0,
  urea:i.bun>19?1:0,
  resp:i.respRate>=30?1:0,
  bp:(i.systolic<90||i.diastolic<=60)?1:0,
  age:i.ageYears>=65?1:0,
 };
 const score=Object.values(criteria).reduce((a,b)=>a+b,0);
 let risk:Curb65Risk,recommendation:string,mortality:string;
 if(score<=1){risk="LOW";recommendation="Bajo riesgo: manejo ambulatorio";mortality="~1.5% a 30 días";}
 else if(score===2){risk="MODERATE";recommendation="Riesgo intermedio: considerar ingreso corto/observación";mortality="~9% a 30 días";}
 else{risk="HIGH";recommendation="Alto riesgo: ingreso hospitalario; considerar UCI si 4–5";mortality="~22% a 30 días";}
 return{score,criteria,risk,recommendation,mortality};
}
