// EPIC BZ — CURB-65: gravedad de neumonía adquirida en la comunidad -> decisión de ingreso. PROFUNDIDAD del
// eje C. 1 punto c/u: Confusión (nueva), Urea(BUN)>19 mg/dL, FR>=30, PA (sist<90 o diast<=60), edad>=65.
// Puro, sin PHI.
//
// Fuente: Lim WS et al. «Defining community acquired pneumonia severity on presentation to hospital: an international
// derivation and validation study». Thorax 2003;58:377-382. De ahí salen los cinco criterios, los cortes y la
// mortalidad a 30 días por puntaje. La escala se derivó y validó en ADULTOS: no es aplicable a población pediátrica.
//
// Auditoría 2026-09-19, anexo R03:
//  - R03-18: la confusión NO se asume 0. Quien llama debe declararla; el dominio de la función exige un booleano y la
//    ruta, si el médico no lo declaró, informa el RANGO (mínimo y máximo) en vez de un riesgo único.
//  - R03-07 (misma disciplina): los valores se validan por PLAUSIBILIDAD, no solo por `Number.isFinite`. Una FR de 300
//    o una sistólica de 12 mmHg no son «datos con los que el puntaje sale bajo»: son datos inválidos.
export type Curb65Risk="LOW"|"MODERATE"|"HIGH";
export type Curb65Input=Readonly<{confusion:boolean;bun:number;respRate:number;systolic:number;diastolic:number;ageYears:number}>;
export type Curb65Result=Readonly<{score:number;criteria:Readonly<Record<string,number>>;risk:Curb65Risk;recommendation:string;mortality:string;mortalityPct:number}>;
/** Edad mínima validada de la escala (Lim 2003 reclutó adultos). Por debajo, la neumonía se estratifica con criterios pediátricos. */
export const CURB65_MIN_AGE_YEARS=16;
/** Cotas de plausibilidad fisiológica de las entradas. Fuera de ellas el dato es inválido, no «favorable». */
export const CURB65_BOUNDS={bun:[1,300],respRate:[4,80],systolic:[40,300],diastolic:[10,200],ageYears:[0,130]} as const satisfies Readonly<Record<string,readonly[number,number]>>;
export type Curb65Reject=Readonly<{reasonCode:"NON_NUMERIC"|"IMPLAUSIBLE_VALUE"|"BP_INVERTED"|"BELOW_VALIDATED_AGE";detail:string}>;
/**
 * Comprueba el DOMINIO de la escala. `undefined` = la entrada es utilizable. Se expone aparte para que la ruta HTTP
 * pueda decir POR QUÉ no se calcula, en lugar de devolver un genérico «valores inválidos».
 */
export function curb65Check(i:Curb65Input):Curb65Reject|undefined{
 const vals:ReadonlyArray<readonly[keyof typeof CURB65_BOUNDS,number]>=[["bun",i.bun],["respRate",i.respRate],["systolic",i.systolic],["diastolic",i.diastolic],["ageYears",i.ageYears]];
 for(const[k,v]of vals)if(!Number.isFinite(v))return{reasonCode:"NON_NUMERIC",detail:`${k} no es numérico`};
 for(const[k,v]of vals){const[lo,hi]=CURB65_BOUNDS[k];if(v<lo||v>hi)return{reasonCode:"IMPLAUSIBLE_VALUE",detail:`${k}=${v} fuera del rango plausible ${lo}–${hi}`};}
 // Una toma con sistólica ≤ diastólica está mal capturada o invertida: el criterio de PA no puede evaluarse.
 if(i.systolic<=i.diastolic)return{reasonCode:"BP_INVERTED",detail:`presión ${i.systolic}/${i.diastolic}: la sistólica debe ser mayor que la diastólica`};
 if(i.ageYears<CURB65_MIN_AGE_YEARS)return{reasonCode:"BELOW_VALIDATED_AGE",detail:`CURB-65 se validó en adultos (≥${CURB65_MIN_AGE_YEARS} años); edad ${i.ageYears}`};
 return undefined;
}
// Mortalidad a 30 días de la cohorte de derivación (Lim 2003, tabla 3). Los puntajes 4 y 5 se informan agrupados
// porque el estudio los reporta juntos: no se inventa un valor separado para 5.
const MORTALITY:Readonly<Record<number,number>>={0:0.7,1:2.1,2:9.2,3:14.5,4:40,5:40};
export function curb65(i:Curb65Input):Curb65Result|undefined{
 if(curb65Check(i))return undefined;
 const criteria:Record<string,number>={
  confusion:i.confusion?1:0,
  urea:i.bun>19?1:0,
  resp:i.respRate>=30?1:0,
  bp:(i.systolic<90||i.diastolic<=60)?1:0,
  age:i.ageYears>=65?1:0,
 };
 const score=Object.values(criteria).reduce((a,b)=>a+b,0);
 const mortalityPct=MORTALITY[score]??0;
 const mortality=`${mortalityPct}% a 30 días (Lim 2003${score>=4?", grupo 4–5":""})`;
 let risk:Curb65Risk,recommendation:string;
 if(score<=1){risk="LOW";recommendation="Bajo riesgo: manejo ambulatorio";}
 else if(score===2){risk="MODERATE";recommendation="Riesgo intermedio: considerar ingreso corto/observación";}
 else{risk="HIGH";recommendation="Alto riesgo: ingreso hospitalario; considerar UCI si 4–5";}
 return{score,criteria,risk,recommendation,mortality,mortalityPct};
}
