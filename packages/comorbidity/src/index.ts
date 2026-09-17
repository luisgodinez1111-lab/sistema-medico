// EPIC CD — Índice de Comorbilidad de Charlson (CCI): predictor de mortalidad a 10 años a partir de la carga
// de comorbilidades + edad. PROFUNDIDAD del eje C. Agrega TODA la lista de problemas (a diferencia de scores
// de una sola condición). Puro, sin PHI. Subconjunto de pesos según los códigos CIE-10 del catálogo.
export type CharlsonConditions=Readonly<{mi?:boolean;chf?:boolean;pvd?:boolean;cerebrovascular?:boolean;copd?:boolean;diabetes?:boolean;diabetesComplications?:boolean;renal?:boolean}>;
export type CharlsonRisk="LOW"|"MILD"|"MODERATE"|"SEVERE";
export type CharlsonResult=Readonly<{score:number;ageScore:number;comorbidityScore:number;risk:CharlsonRisk;estimated10yrSurvivalPct:number;components:Readonly<Record<string,number>>}>;
export function charlson(ageYears:number,c:CharlsonConditions):CharlsonResult|undefined{
 if(!Number.isFinite(ageYears)||ageYears<0)return undefined;
 const components:Record<string,number>={
  mi:c.mi?1:0,
  chf:c.chf?1:0,
  pvd:c.pvd?1:0,
  cerebrovascular:c.cerebrovascular?1:0,
  copd:c.copd?1:0,
  diabetes:c.diabetesComplications?2:(c.diabetes?1:0), // con daño a órgano blanco = 2; simple = 1
  renal:c.renal?2:0, // ERC moderada/severa = 2
 };
 const comorbidityScore=Object.values(components).reduce((a,b)=>a+b,0);
 const ageScore=ageYears<50?0:ageYears<60?1:ageYears<70?2:ageYears<80?3:4;
 const score=comorbidityScore+ageScore;
 // Supervivencia estimada a 10 años (Charlson): 0.983^(e^(score·0.9)).
 const estimated10yrSurvivalPct=Math.round(Math.pow(0.983,Math.exp(score*0.9))*1000)/10;
 let risk:CharlsonRisk;
 if(score===0)risk="LOW";else if(score<=2)risk="MILD";else if(score<=4)risk="MODERATE";else risk="SEVERE";
 return{score,ageScore,comorbidityScore,risk,estimated10yrSurvivalPct,components};
}
