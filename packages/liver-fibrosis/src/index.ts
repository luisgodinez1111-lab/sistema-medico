// EPIC BR — FIB-4: índice no invasivo de fibrosis hepática avanzada. FIB-4 = (edad·AST) / (plaquetas·√ALT).
// PROFUNDIDAD del eje C: tamizaje de fibrosis (hígado graso/MASLD, hepatitis) sin biopsia. Puro, sin PHI.
// Plaquetas en 10^9/L (== 10^3/µL del catálogo). Cortes estándar; en >65 años el corte bajo puede subir a 2.0.
export type FibrosisRisk="LOW"|"INDETERMINATE"|"HIGH";
export type Fib4Result=Readonly<{value:number;risk:FibrosisRisk;interpretation:string}>;
export function fib4(ageYears:number,ast:number,alt:number,platelets:number):Fib4Result|undefined{
 if(![ageYears,ast,alt,platelets].every(Number.isFinite))return undefined;
 if(ageYears<=0||ast<=0||alt<=0||platelets<=0)return undefined;
 const value=Math.round(((ageYears*ast)/(platelets*Math.sqrt(alt)))*100)/100;
 let risk:FibrosisRisk,interpretation:string;
 if(value<1.3){risk="LOW";interpretation="Fibrosis avanzada poco probable (FIB-4 <1.3)";}
 else if(value<=2.67){risk="INDETERMINATE";interpretation="Indeterminado (FIB-4 1.3–2.67): considerar elastografía/valoración";}
 else{risk="HIGH";interpretation="Alta probabilidad de fibrosis avanzada (FIB-4 >2.67): referir a hepatología";}
 return{value,risk,interpretation};
}
