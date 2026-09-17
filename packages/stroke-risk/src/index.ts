// EPIC BQ — CHA₂DS₂-VASc: riesgo de ictus/tromboembolismo en fibrilación auricular no valvular. Guía la
// indicación de anticoagulación. PROFUNDIDAD del eje C. Puro, sin PHI (recibe factores + edad/sexo).
// C: insuficiencia cardíaca (1), H: hipertensión (1), A2: edad≥75 (2), D: diabetes (1), S2: ictus/TIA previo (2),
// V: enfermedad vascular (1), A: edad 65–74 (1), Sc: sexo femenino (1). Umbrales de guía estándar.
export type Cha2ds2VascInput=Readonly<{ageYears:number;female:boolean;chf:boolean;hypertension:boolean;diabetes:boolean;strokeHistory:boolean;vascularDisease:boolean}>;
export type StrokeRisk="LOW"|"INTERMEDIATE"|"HIGH";
export type Cha2ds2VascResult=Readonly<{score:number;risk:StrokeRisk;annualStrokeRiskPct:number;recommendation:string;components:Readonly<Record<string,number>>}>;
// Riesgo anual de ictus (%) por puntaje (tabla publicada, aproximada).
const ANNUAL_RISK:Record<number,number>={0:0,1:1.3,2:2.2,3:3.2,4:4.0,5:6.7,6:9.8,7:9.6,8:6.7,9:15.2};
export function cha2ds2vasc(i:Cha2ds2VascInput):Cha2ds2VascResult|undefined{
 if(!Number.isFinite(i.ageYears)||i.ageYears<0)return undefined;
 const components:Record<string,number>={
  chf:i.chf?1:0,
  hypertension:i.hypertension?1:0,
  age:i.ageYears>=75?2:(i.ageYears>=65?1:0),
  diabetes:i.diabetes?1:0,
  stroke:i.strokeHistory?2:0,
  vascular:i.vascularDisease?1:0,
  female:i.female?1:0,
 };
 const score=Object.values(components).reduce((a,b)=>a+b,0);
 // Umbrales sexo-específicos: el punto por sexo femenino solo es "modificador de riesgo".
 let risk:StrokeRisk,recommendation:string;
 if(i.female){
  if(score<=1){risk="LOW";recommendation="Sin antitrombótico (solo el punto por sexo)";}
  else if(score===2){risk="INTERMEDIATE";recommendation="Considerar anticoagulación oral";}
  else{risk="HIGH";recommendation="Anticoagulación oral recomendada";}
 }else{
  if(score===0){risk="LOW";recommendation="Sin antitrombótico";}
  else if(score===1){risk="INTERMEDIATE";recommendation="Considerar anticoagulación oral";}
  else{risk="HIGH";recommendation="Anticoagulación oral recomendada";}
 }
 return{score,risk,annualStrokeRiskPct:ANNUAL_RISK[Math.min(score,9)]??0,recommendation,components};
}
