// EPIC BQ — CHA₂DS₂-VASc: riesgo de ictus/tromboembolismo en fibrilación auricular no valvular. Guía la
// indicación de anticoagulación. PROFUNDIDAD del eje C. Puro, sin PHI (recibe factores + edad/sexo).
// C: insuficiencia cardíaca (1), H: hipertensión (1), A2: edad≥75 (2), D: diabetes (1), S2: ictus/TIA previo (2),
// V: enfermedad vascular (1), A: edad 65–74 (1), Sc: sexo femenino (1). Umbrales de guía estándar.
export type Cha2ds2VascInput=Readonly<{ageYears:number;female:boolean;chf:boolean;hypertension:boolean;diabetes:boolean;strokeHistory:boolean;vascularDisease:boolean}>;
export type StrokeRisk="LOW"|"INTERMEDIATE"|"HIGH";
export type Cha2ds2VascResult=Readonly<{score:number;risk:StrokeRisk;recommendation:string;components:Readonly<Record<string,number>>;bleedingRiskAssessed:false}>;
// Auditoría 2026-09-19, anexo R03 (R03-03) — SE RETIRA el «riesgo anual de ictus (%)».
//
// La tabla que había era: {0:0, 1:1.3, 2:2.2, 3:3.2, 4:4.0, 5:6.7, 6:9.8, 7:9.6, 8:6.7, 9:15.2}. Nótese 7→9.6, 8→6.7:
// NO es monótona. Un paciente con más factores de riesgo aparecía con MENOS riesgo anual que otro con menos factores, lo
// que es un artefacto de las cohortes pequeñas del trabajo original en los puntajes altos, no un hecho clínico. Mostrar
// «6.7 % anual» para un CHA₂DS₂-VASc de 8 es una cifra falsa con apariencia de precisión.
//
// No se sustituye por otra tabla «de memoria»: publicar tasas por puntaje exige una cohorte citada y validada por un
// médico (queda como deuda declarada). Lo que guía la conducta —el puntaje y el umbral de anticoagulación— se conserva
// intacto; lo que se va es el número inventado.
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
 // R03-03: la indicación de anticoagular NO puede presentarse sin su contrapeso. No se inventa un HAS-BLED (exige datos
 // que el expediente todavía no captura); se declara explícitamente que el riesgo hemorrágico NO se ha evaluado, y la
 // recomendación lo dice cuando propone anticoagular.
 const conContrapeso=risk==="LOW"?recommendation
  :`${recommendation}. Riesgo HEMORRÁGICO no evaluado por el sistema: valórelo (p. ej. HAS-BLED) antes de indicar`;
 return{score,risk,recommendation:conContrapeso,components,bleedingRiskAssessed:false};
}
