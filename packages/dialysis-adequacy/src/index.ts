// Adecuación y seguridad de una sesión de hemodiálisis: Kt/V, ultrafiltración y peso seco. Puro, sin PHI (recibe medidas).
//
// Auditoría 2026-09-19, anexo R02b (R2B-020) — NIVEL 0/5: NO HABÍA UNA SOLA VARIABLE DE TERAPIA DE REEMPLAZO RENAL.
//
// El ciclo de vida de diálisis tenía dos campos clínicos —`modality` y `accessType`, ambos solo al agendar— y nada más. Sin
// Kt/V, sin peso seco, sin pesos pre y post sesión, sin volumen ni tasa de ultrafiltración, sin presión arterial
// intra-sesión, sin duración prescrita frente a la real. El anexo lo describió exactamente: «literalmente un cronómetro de
// cuatro estados». `INTERRUPTED` llevaba un `reason` de texto libre y nada que explicara por qué se interrumpió en términos
// medibles.
//
// LO QUE SE IMPLEMENTA Y POR QUÉ ESTOS DOS NÚMEROS. De todo lo que una unidad de diálisis mide, aquí entran los dos que
// deciden si la sesión sirvió y si fue segura:
//
//   1) **Kt/V de una sola piscina (spKt/V), fórmula de Daugirdas de segunda generación (1993)**, que es la que las guías de
//      adecuación (KDOQI) usan para el seguimiento rutinario:
//          spKt/V = −ln(R − 0.008·t) + (4 − 3.5·R)·ΔBW/BW_post
//      con R = urea post / urea pre, t = duración de la sesión en HORAS, ΔBW = pérdida de peso intradiálisis en kg y
//      BW_post = peso post-sesión en kg. No se inventa ningún coeficiente: son los de la publicación.
//
//   2) **Tasa de ultrafiltración normalizada por peso (mL/kg/h)**, que es el número asociado a la hipotensión
//      intradiálisis y a la mortalidad en la literatura observacional. Aquí NO se fija un umbral clínico propio: se calcula
//      y se compara contra el umbral que el establecimiento declare, porque el corte más citado (13 mL/kg/h) proviene de
//      estudios observacionales y adoptarlo como regla del sistema es una decisión clínica, no de ingeniería.
//
// LO QUE NO SE IMPLEMENTA está en DIALYSIS_ADEQUACY_LIMITS, y es deliberado: diálisis peritoneal (el Kt/V peritoneal se
// calcula con otra fórmula y otro volumen de distribución), eKt/V y URR equilibrados, aclaramiento de fósforo, prescripción
// de baño, anticoagulación del circuito y dosis pediátrica.
export type DialysisModality="HEMODIALYSIS"|"PERITONEAL"|"HEMOFILTRATION";

export type SessionMeasurements=Readonly<{
 /** Duración REAL de la sesión, en minutos. La prescrita se compara aparte: cumplir el tiempo es parte de la adecuación. */
 durationMinutes:number;
 prescribedMinutes:number;
 /** Pesos en kg. El pre y el post son obligatorios para cualquier cálculo; el seco es la referencia del paciente. */
 preWeightKg:number;
 postWeightKg:number;
 dryWeightKg?:number;
 /** Urea (BUN) pre y post sesión, en mg/dL. Sin las dos no hay Kt/V, y eso se dice en vez de estimarlo. */
 preUreaMgDl?:number;
 postUreaMgDl?:number;
}>;

export type AdequacyResult=Readonly<{
 /** Kt/V de una sola piscina. `null` cuando faltan datos: no se estima ni se sustituye por un valor por omisión. */
 spKtV:number|null;
 /** Reducción porcentual de urea (URR), que se reporta junto al Kt/V porque es la que muchas unidades siguen usando. */
 urrPercent:number|null;
 /** Volumen ultrafiltrado (kg ≈ L) y tasa normalizada por peso post-sesión. */
 ultrafiltrationL:number;
 ultrafiltrationRateMlKgH:number|null;
 /** Diferencia entre el peso post y el peso seco: positiva = sobrecarga residual; negativa = por debajo del seco. */
 deltaFromDryWeightKg:number|null;
 /** Minutos que faltaron respecto a lo prescrito (0 si se cumplió o se superó). */
 shortfallMinutes:number;
 /** Qué medidas faltaron para completar la valoración. Vacío significa que no faltó ninguna. */
 missing:readonly string[];
 /** Avisos con contenido clínico verificable: lo que los números dicen, sin decidir por el clínico. */
 warnings:readonly string[];
 formula:string;
}>;

export const KTV_FORMULA="Daugirdas 2.ª generación (1993), spKt/V de una sola piscina";
/** Objetivo mínimo de spKt/V por sesión en hemodiálisis tres veces por semana según KDOQI. Se declara, no se deduce. */
export const KTV_TARGET_THRICE_WEEKLY=1.2;
/** URR mínima históricamente usada como objetivo equivalente. Se reporta como referencia, no como regla. */
export const URR_TARGET_PERCENT=65;
/**
 * Tasa de ultrafiltración por omisión con la que comparar, en mL/kg/h. NO es un umbral que este sistema imponga: es el corte
 * más citado en la literatura observacional y el establecimiento puede declarar el suyo. Lo importante es que el número
 * tenga dueño: atribuirle a una guía un umbral que no publica es lo que la auditoría llama inventar.
 */
export const UF_RATE_REFERENCE_ML_KG_H=13;

export function dialysisAdequacy(m:SessionMeasurements,opts?:{ufRateLimitMlKgH?:number}):AdequacyResult{
 const missing:string[]=[];const warnings:string[]=[];
 const limite=opts?.ufRateLimitMlKgH??UF_RATE_REFERENCE_ML_KG_H;
 const perdidaKg=Math.round((m.preWeightKg-m.postWeightKg)*1000)/1000;
 const horas=m.durationMinutes/60;

 // ULTRAFILTRACIÓN. Un kg perdido en diálisis es aproximadamente un litro de líquido retirado: la equivalencia es la que usa
 // la propia práctica clínica, no una aproximación de este código.
 const ultrafiltrationL=Math.max(0,perdidaKg);
 let ultrafiltrationRateMlKgH:number|null=null;
 if(horas>0&&m.postWeightKg>0){
  ultrafiltrationRateMlKgH=Math.round((ultrafiltrationL*1000/m.postWeightKg/horas)*10)/10;
  if(ultrafiltrationRateMlKgH>limite)
   warnings.push(`UF_RATE_ALTA: ${ultrafiltrationRateMlKgH} mL/kg/h supera el límite declarado (${limite}); asociada a hipotensión intradiálisis`);
 }else missing.push("durationMinutes o postWeightKg");

 // PESO SECO. Sin él no se puede decir si el paciente quedó con sobrecarga: se reporta faltante en vez de asumir que el peso
 // post ES el seco, que es el atajo que convierte una sobrecarga en un «objetivo alcanzado».
 let deltaFromDryWeightKg:number|null=null;
 if(m.dryWeightKg===undefined)missing.push("dryWeightKg");
 else{
  deltaFromDryWeightKg=Math.round((m.postWeightKg-m.dryWeightKg)*1000)/1000;
  if(deltaFromDryWeightKg>1)warnings.push(`SOBRE_PESO_SECO: ${deltaFromDryWeightKg} kg por encima del peso seco al terminar`);
  if(deltaFromDryWeightKg<-1)warnings.push(`BAJO_PESO_SECO: ${Math.abs(deltaFromDryWeightKg)} kg por debajo del peso seco; riesgo de hipotensión`);
 }

 // DURACIÓN. Cumplir el tiempo prescrito es parte de la dosis: una sesión acortada es una dosis menor, no un detalle
 // administrativo. Por eso el déficit se calcula y se avisa, aunque el Kt/V salga suficiente.
 const shortfallMinutes=Math.max(0,Math.round(m.prescribedMinutes-m.durationMinutes));
 if(shortfallMinutes>0)warnings.push(`SESION_ACORTADA: ${shortfallMinutes} min menos de los ${m.prescribedMinutes} prescritos`);

 // Kt/V y URR. Las dos exigen urea pre y post: sin ellas el resultado es `null` y se declara lo que falta.
 let spKtV:number|null=null,urrPercent:number|null=null;
 if(m.preUreaMgDl===undefined)missing.push("preUreaMgDl");
 if(m.postUreaMgDl===undefined)missing.push("postUreaMgDl");
 if(m.preUreaMgDl!==undefined&&m.postUreaMgDl!==undefined){
  if(m.preUreaMgDl<=0||m.postUreaMgDl<=0||m.postWeightKg<=0||horas<=0){
   warnings.push("KTV_NO_CALCULABLE: las medidas no permiten evaluar la fórmula (valores no positivos)");
  }else{
   const R=m.postUreaMgDl/m.preUreaMgDl;
   urrPercent=Math.round((1-R)*1000)/10;
   // El logaritmo exige `R - 0.008·t > 0`. Con una urea post desproporcionadamente baja respecto al tiempo, la fórmula no
   // aplica: se dice, en vez de devolver NaN o un número sin sentido.
   const dentro=R-0.008*horas;
   if(dentro<=0)warnings.push("KTV_FUERA_DE_DOMINIO: la relación urea post/pre y la duración no admiten la fórmula");
   else{
    const bruto=-Math.log(dentro)+(4-3.5*R)*(perdidaKg/m.postWeightKg);
    spKtV=Math.round(bruto*100)/100;
    if(spKtV<KTV_TARGET_THRICE_WEEKLY)
     warnings.push(`KTV_BAJO: ${spKtV} por debajo del objetivo ${KTV_TARGET_THRICE_WEEKLY} (KDOQI, tres sesiones por semana)`);
    if(urrPercent<URR_TARGET_PERCENT)warnings.push(`URR_BAJA: ${urrPercent} % por debajo de la referencia ${URR_TARGET_PERCENT} %`);
   }
  }
 }
 return{spKtV,urrPercent,ultrafiltrationL,ultrafiltrationRateMlKgH,deltaFromDryWeightKg,shortfallMinutes,
  missing,warnings,formula:KTV_FORMULA};
}

export const DIALYSIS_ADEQUACY_LIMITS=
 "Se calcula el spKt/V de una sola piscina con la fórmula de Daugirdas de segunda generación (1993) y la tasa de "+
 "ultrafiltración normalizada por peso, que son los dos números que deciden si una sesión de HEMODIÁLISIS sirvió y si fue "+
 "segura. NO se cubre: diálisis peritoneal (su Kt/V usa otra fórmula y otro volumen de distribución, y no se aproxima con "+
 "esta), eKt/V ni URR equilibrada, aclaramiento de fósforo o de moléculas medias, prescripción del baño y su composición, "+
 "anticoagulación del circuito, dosis pediátrica y adecuación de hemofiltración continua. El umbral de tasa de "+
 "ultrafiltración es una REFERENCIA declarada por el establecimiento: el corte más citado proviene de estudios "+
 "observacionales y convertirlo en regla del sistema es una decisión clínica. La validación de todo esto por el responsable "+
 "de la unidad renal sigue en ADR-0300.";
