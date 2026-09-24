import{inValueSet,ICD10_VALUE_SETS}from"../../../packages/terminology/src";
import{type PatientFactor}from"../../../packages/drug-catalog/src";
import{ageInYears}from"../../../packages/prescription-safety/src";
// Auditoría 2026-09-19, anexo R03 (R03-29) — FACTORES DEL PACIENTE derivados del expediente.
//
// El catálogo de fármacos tiene reglas fármaco–factor desde hace varios lotes (IECA y ARA-II contraindicados en el
// embarazo, warfarina embriopática, criterios de Beers en el adulto mayor…) y `checkInteractions` acepta el argumento
// `patientFactors`. Pero NADIE se lo pasaba: la única ruta que lo usaba era el verificador de interacciones, donde el
// médico escribe los factores a mano. En la barrera de prescripción —la que bloquea— la lista llegaba vacía, así que
// TODAS las reglas del embarazo eran código inalcanzable. Este módulo cierra ese hueco con lo que el expediente ya sabe:
//   · EMBARAZO y LACTANCIA, de la lista de problemas ACTIVOS (capítulo O de la CIE-10 y Z33–Z36 / Z39.1);
//   · INSUFICIENCIA RENAL y HEPÁTICA, de sus códigos (N18, K70/K74);
//   · ALCOHOL, del trastorno por consumo (F10);
//   · ADULTO MAYOR, de la fecha de nacimiento.
// Lo que NO se deriva se queda fuera: no se adivina un embarazo por el sexo y la edad.
export function derivePatientFactors(activeConditionCodes:readonly string[],birthDate?:string|null):PatientFactor[]{
 const out=new Set<PatientFactor>();
 if(inValueSet(activeConditionCodes,ICD10_VALUE_SETS.pregnancy))out.add("PREGNANCY");
 if(inValueSet(activeConditionCodes,ICD10_VALUE_SETS.lactation))out.add("LACTATION");
 const tiene=(...prefijos:string[])=>activeConditionCodes.some(c=>{const u=c.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");return prefijos.some(p=>u.startsWith(p));});
 if(tiene("N18","N19"))out.add("RENAL_IMPAIRMENT");
 if(tiene("K70","K74","K72","B18"))out.add("HEPATIC_IMPAIRMENT");
 if(tiene("F10"))out.add("ALCOHOL");
 if(birthDate){const edad=ageInYears(birthDate,new Date().toISOString());if(edad!==undefined&&edad>=65)out.add("ELDERLY");}
 return[...out];
}
