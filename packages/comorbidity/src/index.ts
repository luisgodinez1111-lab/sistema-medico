// EPIC CD — Índice de Comorbilidad de Charlson (CCI). Puro, sin PHI.
//
// Auditoría 2026-09-19 (C-08): la versión anterior cubría 8 de las condiciones (faltaban TODAS las de peso alto: neoplasia,
// metástasis, SIDA, hepatopatía grave, demencia, hemiplejía…) y emitía el resultado como un Charlson completo, con
// supervivencia estimada. Ahora se implementan las 17 categorías del índice original (Charlson 1987) con los pesos
// originales y el mapeo CIE-10 de Quan et al. 2005 (Med Care 43:1130), con las jerarquías del índice:
//   · diabetes con complicaciones (2) excluye diabetes sin complicaciones (1);
//   · hepatopatía moderada/grave (3) excluye hepatopatía leve (1);
//   · tumor sólido metastásico (6) excluye neoplasia (2).
// Los pesos son los ORIGINALES (no los actualizados de Quan 2011): es el índice con el que se validó la fórmula de
// supervivencia a 10 años que aquí se reporta. Contenido clínico PENDIENTE de validación por un médico antes de uso asistencial.
export type CharlsonConditions=Readonly<{
 mi?:boolean;chf?:boolean;pvd?:boolean;cerebrovascular?:boolean;dementia?:boolean;copd?:boolean;rheumatic?:boolean;pud?:boolean;
 mildLiver?:boolean;diabetes?:boolean;diabetesComplications?:boolean;hemiplegia?:boolean;renal?:boolean;malignancy?:boolean;
 moderateSevereLiver?:boolean;metastatic?:boolean;aids?:boolean;
}>;
export const CHARLSON_WEIGHTS:Readonly<Record<keyof CharlsonConditions,number>>={
 mi:1,chf:1,pvd:1,cerebrovascular:1,dementia:1,copd:1,rheumatic:1,pud:1,mildLiver:1,diabetes:1,
 diabetesComplications:2,hemiplegia:2,renal:2,malignancy:2,moderateSevereLiver:3,metastatic:6,aids:6,
};
export const CHARLSON_LABELS_ES:Readonly<Record<keyof CharlsonConditions,string>>={
 mi:"Infarto de miocardio",chf:"Insuficiencia cardíaca",pvd:"Enfermedad vascular periférica",cerebrovascular:"Enfermedad cerebrovascular",
 dementia:"Demencia",copd:"Enfermedad pulmonar crónica",rheumatic:"Enfermedad reumática / del tejido conectivo",pud:"Enfermedad ulcerosa péptica",
 mildLiver:"Hepatopatía leve",diabetes:"Diabetes sin complicaciones",diabetesComplications:"Diabetes con complicaciones crónicas",
 hemiplegia:"Hemiplejía o paraplejía",renal:"Enfermedad renal",malignancy:"Neoplasia (incl. linfoma y leucemia)",
 moderateSevereLiver:"Hepatopatía moderada o grave",metastatic:"Tumor sólido metastásico",aids:"SIDA / VIH",
};
export type CharlsonRisk="LOW"|"MILD"|"MODERATE"|"SEVERE";
export type CharlsonResult=Readonly<{score:number;ageScore:number;comorbidityScore:number;risk:CharlsonRisk;estimated10yrSurvivalPct:number;components:Readonly<Record<string,number>>;present:readonly(keyof CharlsonConditions)[]}>;
export function charlson(ageYears:number,c:CharlsonConditions):CharlsonResult|undefined{
 if(!Number.isFinite(ageYears)||ageYears<0)return undefined;
 // Jerarquías: la forma grave sustituye a la leve (no se suman).
 const eff:CharlsonConditions={...c,
  diabetes:!!c.diabetes&&!c.diabetesComplications,
  mildLiver:!!c.mildLiver&&!c.moderateSevereLiver,
  malignancy:!!c.malignancy&&!c.metastatic,
 };
 const components:Record<string,number>={};const present:(keyof CharlsonConditions)[]=[];
 for(const k of Object.keys(CHARLSON_WEIGHTS)as(keyof CharlsonConditions)[]){const on=!!eff[k];components[k]=on?CHARLSON_WEIGHTS[k]:0;if(on)present.push(k);}
 const comorbidityScore=Object.values(components).reduce((a,b)=>a+b,0);
 const ageScore=ageYears<50?0:ageYears<60?1:ageYears<70?2:ageYears<80?3:4;
 const score=comorbidityScore+ageScore;
 // Supervivencia estimada a 10 años (Charlson 1987): 0.983^(e^(score·0.9)).
 const estimated10yrSurvivalPct=Math.round(Math.pow(0.983,Math.exp(score*0.9))*1000)/10;
 let risk:CharlsonRisk;
 if(score===0)risk="LOW";else if(score<=2)risk="MILD";else if(score<=4)risk="MODERATE";else risk="SEVERE";
 return{score,ageScore,comorbidityScore,risk,estimated10yrSurvivalPct,components,present};
}
// ---------- Mapeo CIE-10 → condiciones (Quan 2005). Prefijos de código; "I25.2" cubre I25.2x. ----------
const P=(...p:string[])=>p;
export const CHARLSON_ICD10:Readonly<Record<keyof CharlsonConditions,readonly string[]>>={
 mi:P("I21","I22","I25.2"),
 chf:P("I09.9","I11.0","I13.0","I13.2","I25.5","I42.0","I42.5","I42.6","I42.7","I42.8","I42.9","I43","I50","P29.0"),
 pvd:P("I70","I71","I73.1","I73.8","I73.9","I77.1","I79.0","I79.2","K55.1","K55.8","K55.9","Z95.8","Z95.9"),
 cerebrovascular:P("G45","G46","H34.0","I60","I61","I62","I63","I64","I65","I66","I67","I68","I69"),
 dementia:P("F00","F01","F02","F03","F05.1","G30","G31.1"),
 copd:P("I27.8","I27.9","J40","J41","J42","J43","J44","J45","J46","J47","J60","J61","J62","J63","J64","J65","J66","J67","J68.4","J70.1","J70.3"),
 rheumatic:P("M05","M06","M31.5","M32","M33","M34","M35.1","M35.3","M36.0"),
 pud:P("K25","K26","K27","K28"),
 mildLiver:P("B18","K70.0","K70.1","K70.2","K70.3","K70.9","K71.3","K71.4","K71.5","K71.7","K73","K74","K76.0","K76.2","K76.3","K76.4","K76.8","K76.9","Z94.4"),
 diabetes:P("E10.0","E10.1","E10.6","E10.8","E10.9","E11.0","E11.1","E11.6","E11.8","E11.9","E12.0","E12.1","E12.6","E12.8","E12.9","E13.0","E13.1","E13.6","E13.8","E13.9","E14.0","E14.1","E14.6","E14.8","E14.9"),
 diabetesComplications:P("E10.2","E10.3","E10.4","E10.5","E10.7","E11.2","E11.3","E11.4","E11.5","E11.7","E12.2","E12.3","E12.4","E12.5","E12.7","E13.2","E13.3","E13.4","E13.5","E13.7","E14.2","E14.3","E14.4","E14.5","E14.7"),
 hemiplegia:P("G04.1","G11.4","G80.1","G80.2","G81","G82","G83.0","G83.1","G83.2","G83.3","G83.4","G83.9"),
 renal:P("I12.0","I13.1","N03.2","N03.3","N03.4","N03.5","N03.6","N03.7","N05.2","N05.3","N05.4","N05.5","N05.6","N05.7","N18","N19","N25.0","Z49.0","Z49.1","Z49.2","Z94.0","Z99.2"),
 malignancy:P("C00","C01","C02","C03","C04","C05","C06","C07","C08","C09","C10","C11","C12","C13","C14","C15","C16","C17","C18","C19","C20","C21","C22","C23","C24","C25","C26","C30","C31","C32","C33","C34","C37","C38","C39","C40","C41","C43","C45","C46","C47","C48","C49","C50","C51","C52","C53","C54","C55","C56","C57","C58","C60","C61","C62","C63","C64","C65","C66","C67","C68","C69","C70","C71","C72","C73","C74","C75","C76","C81","C82","C83","C84","C85","C88","C90","C91","C92","C93","C94","C95","C96","C97"),
 moderateSevereLiver:P("I85.0","I85.9","I86.4","I98.2","K70.4","K71.1","K72.1","K72.9","K76.5","K76.6","K76.7"),
 metastatic:P("C77","C78","C79","C80"),
 aids:P("B20","B21","B22","B24"),
};
// Un código "E11" (sin subcategoría) es diabetes de tipo no especificado en cuanto a complicaciones: cuenta como SIN
// complicaciones (1 punto), que es la lectura conservadora. Un código "C34.1" empareja con el prefijo "C34".
function matches(code:string,prefix:string):boolean{const c=code.trim().toUpperCase().replace(/\s+/g,"");const p=prefix.toUpperCase();return c===p||c.startsWith(p+".")||(!p.includes(".")&&c.startsWith(p));}
export function charlsonConditionsFromIcd10(codes:readonly string[]):CharlsonConditions{
 const out:Record<string,boolean>={};
 for(const k of Object.keys(CHARLSON_ICD10)as(keyof CharlsonConditions)[])out[k]=codes.some(code=>CHARLSON_ICD10[k].some(p=>matches(code,p)));
 // "E10"/"E11"… sin subcategoría: diabetes sin complicaciones (conservador).
 if(codes.some(c=>/^E1[0-4]$/.test(c.trim().toUpperCase())))out["diabetes"]=true;
 return out as CharlsonConditions;
}
export function charlsonFromIcd10(ageYears:number,codes:readonly string[]):CharlsonResult|undefined{return charlson(ageYears,charlsonConditionsFromIcd10(codes));}
