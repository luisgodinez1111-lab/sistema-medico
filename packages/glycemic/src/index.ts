// EPIC BP — Control glucémico: HbA1c -> glucosa promedio estimada (eAG) + clasificación. PROFUNDIDAD del eje C
// (manejo de crónicos). El MARCO de interpretación cambia si el paciente es diabético conocido (meta <7%) vs
// tamizaje (rangos diagnósticos ADA). Puro, sin PHI. Umbrales ADA/estándar.
// Glucosa promedio estimada (mg/dL) desde HbA1c (%). Fórmula ADAG: eAG = 28.7·A1c − 46.7.
// Auditoría 2026-09-19, anexo R03 (vector F01): la fórmula se aplicaba a cualquier número positivo. Con HbA1c 0.1
// devolvía una glucosa promedio de −44 mg/dL clasificada como «Normal», y con 50 devolvía 1 388. La HbA1c humana no sale
// del intervalo 3–20 % (el mismo que ya declara `ANALYTE_UNITS` en lab-reference): fuera de él el dato es un error de
// captura o de unidad (IFCC en mmol/mol), no un control glucémico.
export const A1C_PLAUSIBLE=[3,20]as const;
export function estimatedAverageGlucose(a1c:number):number|undefined{
 if(!Number.isFinite(a1c))return undefined;
 if(a1c<A1C_PLAUSIBLE[0]||a1c>A1C_PLAUSIBLE[1])return undefined;
 return Math.round(28.7*a1c-46.7+1e-9); // épsilon: evita que 125.4999… (flotante) redondee a 125 en vez de 126
}
export type GlycemicFrame="DIABETIC"|"SCREENING";
export type GlycemicCategory="CONTROLLED"|"ABOVE_TARGET"|"POOR"|"NORMAL"|"PREDIABETES"|"DIABETES_RANGE";
export type GlycemicAssessment=Readonly<{a1c:number;eag:number;frame:GlycemicFrame;category:GlycemicCategory;label:string}>;
// Interpreta la HbA1c. `diabetic`=true usa el marco de METAS de tratamiento; si no, el marco de TAMIZAJE.
export function glycemicAssessment(a1c:number,diabetic:boolean):GlycemicAssessment|undefined{
 const eag=estimatedAverageGlucose(a1c);
 if(eag===undefined)return undefined;
 let category:GlycemicCategory,label:string;
 if(diabetic){
  if(a1c<7){category="CONTROLLED";label="Diabético en meta (HbA1c <7%)";}
  else if(a1c<=8){category="ABOVE_TARGET";label="Diabético sobre meta (HbA1c 7–8%): intensificar";}
  else{category="POOR";label="Diabético con mal control (HbA1c >8%): ajustar tratamiento";}
 }else{
  if(a1c<5.7){category="NORMAL";label="Normal (HbA1c <5.7%)";}
  else if(a1c<6.5){category="PREDIABETES";label="Prediabetes (HbA1c 5.7–6.4%)";}
  else{category="DIABETES_RANGE";label="Rango diagnóstico de diabetes (HbA1c ≥6.5%): confirmar";}
 }
 return{a1c,eag,frame:diabetic?"DIABETIC":"SCREENING",category,label};
}
