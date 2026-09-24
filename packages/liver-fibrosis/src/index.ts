// EPIC BR — FIB-4: índice no invasivo de fibrosis hepática avanzada. FIB-4 = (edad·AST) / (plaquetas·√ALT).
// PROFUNDIDAD del eje C: tamizaje de fibrosis (hígado graso/MASLD, hepatitis) sin biopsia. Puro, sin PHI.
// Plaquetas en 10^9/L (== 10^3/µL del catálogo). Cortes de Sterling 2006; el corte bajo se ajusta a 2.0 en ≥65 años.
export type FibrosisRisk="LOW"|"INDETERMINATE"|"HIGH";
export type Fib4Result=Readonly<{value:number;risk:FibrosisRisk;interpretation:string;lowCutoff:number;ageAdjusted:boolean}>;
// Auditoría 2026-09-19, anexo R03 (vector F04): el corte bajo de 1.3 pierde especificidad a partir de los 65 años —a esa
// edad el propio término `edad` del numerador infla el índice— y la recomendación es subirlo a 2.0 (McPherson S et al.,
// «Age as a Confounding Factor for the Accurate Non-Invasive Diagnosis of Advanced NAFLD Fibrosis», Am J Gastroenterol
// 2017;112:740-751). Antes, un paciente de 70 años con FIB-4 1.8 caía en «indeterminado» y se derivaba a elastografía sin
// necesidad; el corte ajustado lo deja correctamente en «poco probable».
export const FIB4_LOW_CUTOFF={standard:1.3,age65plus:2.0}as const;
export const FIB4_HIGH_CUTOFF=2.67;
export function fib4(ageYears:number,ast:number,alt:number,platelets:number):Fib4Result|undefined{
 if(![ageYears,ast,alt,platelets].every(Number.isFinite))return undefined;
 if(ageYears<=0||ast<=0||alt<=0||platelets<=0)return undefined;
 const value=Math.round(((ageYears*ast)/(platelets*Math.sqrt(alt)))*100)/100;
 const ageAdjusted=ageYears>=65;
 const lowCutoff=ageAdjusted?FIB4_LOW_CUTOFF.age65plus:FIB4_LOW_CUTOFF.standard;
 const suf=ageAdjusted?" · corte bajo ajustado a 2.0 por edad ≥65 años (McPherson 2017)":"";
 let risk:FibrosisRisk,interpretation:string;
 if(value<lowCutoff){risk="LOW";interpretation=`Fibrosis avanzada poco probable (FIB-4 <${lowCutoff})${suf}`;}
 else if(value<=FIB4_HIGH_CUTOFF){risk="INDETERMINATE";interpretation=`Indeterminado (FIB-4 ${lowCutoff}–${FIB4_HIGH_CUTOFF}): considerar elastografía/valoración${suf}`;}
 else{risk="HIGH";interpretation=`Alta probabilidad de fibrosis avanzada (FIB-4 >${FIB4_HIGH_CUTOFF}): referir a hepatología${suf}`;}
 return{value,risk,interpretation,lowCutoff,ageAdjusted};
}
