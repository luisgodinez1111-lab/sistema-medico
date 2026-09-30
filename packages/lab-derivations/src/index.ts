// EPIC BN — Derivaciones de laboratorio MULTI-analito: calcula nuevos valores clínicos a partir de varios
// resultados (no solo clasifica uno). PROFUNDIDAD del eje C. Puro, sin PHI (recibe números). Umbrales de
// demostración; los oficiales/por método se parametrizarían aparte.
import{classifyLab,type LabStatus}from"../../lab-reference/src";

function round1(n:number):number{return Math.round(n*10)/10;}

// Identidad versionada de las derivaciones que devuelve /metabolic-panel (fuente única: la ruta la importa). Toda variación
// observable de su salida (valor, estado, interpretación o advertencia) exige una versión nueva e inmutable (Companion #14:
// un algoritmo no cambia en silencio). v3: la brecha BAJA ya corregida por albúmina deja de atribuirse a hipoalbuminemia (F7).
// tests/v22/lab-derivations.test.ts ancla la huella de la salida de cada versión.
export const METABOLIC_DERIVATIONS_ALGORITHM=Object.freeze({id:"METABOLIC-DERIVATIONS",version:"3"}as const);

// ---- Brecha aniónica (anion gap) = Na − (Cl + HCO3). Alta (>12) sugiere acidosis metabólica de brecha
// aumentada (cetoacidosis, uremia, lactato, tóxicos). Puro. ----
export type AnionGapStatus="HIGH"|"NORMAL"|"LOW";
export type AnionGap=Readonly<{value:number;status:AnionGapStatus;interpretation:string}>;
// Auditoría 2026-09-19 (C-22): la hipoalbuminemia BAJA la brecha y enmascara una acidosis de brecha aumentada. Con albúmina
// (g/dL) se corrige (Figge): AG + 2.5·(4 − albúmina). Sin albúmina se informa la brecha cruda y se declara sin corregir.
export type AnionGapEx=AnionGap&Readonly<{raw:number;albuminCorrected:boolean;albuminGdl?:number}>;
export function anionGap(sodium:number,chloride:number,bicarbonate:number,albuminGdl?:number):AnionGapEx|undefined{
 if(![sodium,chloride,bicarbonate].every(Number.isFinite))return undefined;
 const raw=round1(sodium-chloride-bicarbonate);
 const albuminCorrected=albuminGdl!==undefined&&Number.isFinite(albuminGdl)&&albuminGdl>0;
 const value=albuminCorrected?round1(raw+2.5*(4-albuminGdl)):raw;
 let status:AnionGapStatus,interpretation:string;
 if(value>12){status="HIGH";interpretation="Brecha aniónica elevada: acidosis metabólica de brecha aumentada (cetoacidosis, uremia, lactato, tóxicos)";}
 // Revisión adversarial del lote 11 (F7): corregida por albúmina, una brecha baja ya NO se explica por hipoalbuminemia; las causas
 // que quedan son otras (texto clínico pendiente de validación PROD, como el resto de interpretaciones de este paquete).
 else if(value<8){status="LOW";interpretation=albuminCorrected
  ?"Brecha aniónica baja pese a la corrección por albúmina (paraproteínas, hipercalcemia, litio o bromuro, o error de laboratorio)"
  :"Brecha aniónica baja (hipoalbuminemia, paraproteínas)";}
 else{status="NORMAL";interpretation="Brecha aniónica normal";}
 if(albuminCorrected)interpretation+=` (corregida por albúmina ${albuminGdl} g/dL; cruda ${raw})`;else interpretation+=" (sin corregir por albúmina: una hipoalbuminemia la subestima)";
 return albuminCorrected?{value,status,interpretation,raw,albuminCorrected,albuminGdl:albuminGdl!}:{value,status,interpretation,raw,albuminCorrected};
}
// Hallazgo D9 del lote 11: la advertencia del panel se DERIVA de lo que realmente se calculó y vive aquí (fuente única), no en la
// ruta. Tres estados explícitos (R03-05: el delta-delta se obtiene en /acid-base): corregida, SIN corregir, o sin brecha.
export function anionGapCaveat(ag:Pick<AnionGapEx,"albuminCorrected">|undefined):string{
 if(!ag)return"Sin brecha aniónica: faltan entradas coherentes.";
 return ag.albuminCorrected
  ?"Brecha aniónica corregida por albúmina (Figge). El delta-delta y la bifurcación brecha aumentada vs hiperclorémica se obtienen en /acid-base, que además interpreta la compensación."
  :"Brecha aniónica SIN corregir por albúmina (no hay albúmina coherente con la misma extracción): una hipoalbuminemia la subestima. El delta-delta se obtiene en /acid-base.";
}

// ---- Sodio corregido por glucemia (EPIC BY). La hiperglucemia arrastra agua al intravascular y DILUYE el
// sodio (pseudohiponatremia). Na corregido = Na + 1.6·((glucosa − 100)/100) (factor de Katz). Puro. ----
export type CorrectedSodium=Readonly<{measured:number;corrected:number;glucose:number;interpretation:string;applied:boolean}>;
// Auditoría 2026-09-19, anexo R03 (vector F03): el factor de Katz se derivó para HIPERGLUCEMIA y se aplicaba a cualquier
// glucemia. Con glucosa 50 mg/dL «corregía» un sodio de 140 a 139.2 e informaba «≈ medido»: una corrección fuera de su
// dominio, presentada como resultado. Ahora, por debajo de 100 mg/dL NO se corrige (se devuelve el medido) y se declara.
export const SODIUM_CORRECTION_GLUCOSE_THRESHOLD=100;
export function correctedSodiumForGlucose(sodium:number,glucose:number):CorrectedSodium|undefined{
 if(![sodium,glucose].every(Number.isFinite)||glucose<=0)return undefined;
 const applied=glucose>SODIUM_CORRECTION_GLUCOSE_THRESHOLD;
 const corrected=applied?round1(sodium+1.6*((glucose-100)/100)):round1(sodium);
 const interpretation=applied
  ?`Sodio corregido ${corrected} mEq/L (medido ${sodium}, glucosa ${glucose}): la hiperglucemia diluye el sodio medido`
  :`Sin hiperglucemia (glucosa ${round1(glucose)} ≤ ${SODIUM_CORRECTION_GLUCOSE_THRESHOLD} mg/dL): NO se aplica la corrección de Katz, que solo es válida en hiperglucemia. Se informa el sodio medido.`;
 return{measured:round1(sodium),corrected,glucose:round1(glucose),interpretation,applied};
}

// ---- Osmolalidad sérica calculada (EPIC BY) = 2·Na + glucosa/18 + BUN/2.8. Normal ~275–295 mOsm/kg. Alta:
// estados hiperosmolares (hiperglucemia, uremia). Puro. ----
export type OsmoStatus="HIGH"|"NORMAL"|"LOW";
export type CalculatedOsmolality=Readonly<{value:number;status:OsmoStatus;interpretation:string}>;
// Auditoría 2026-09-19, anexo R03 (vector F05): la osmolalidad CALCULADA sola no tiene utilidad clínica; la que decide es
// la BRECHA OSMOLAL (medida − calculada). Una brecha >10 mOsm/kg es el hallazgo que delata un osmol no medido: etanol,
// metanol, etilenglicol o isopropanol — es decir, la intoxicación que hay que descartar en una acidosis inexplicada.
// Fuente: Kraut JA, Xing SX. «Approach to the evaluation of a patient with an increased serum osmolal gap».
// Am J Kidney Dis 2011;58:480-4. El término de etanol (etanol mg/dL ÷ 3.7) se resta cuando se ha medido.
export const OSMOLAL_GAP_THRESHOLD=10;
export type OsmolalGap=Readonly<{measured:number;calculated:number;gap:number;elevated:boolean;ethanolAccounted:boolean;interpretation:string}>;
export function osmolalGap(sodium:number,glucose:number,bun:number,measuredOsmolality:number,ethanolMgDl?:number):OsmolalGap|undefined{
 const calc=calculatedOsmolality(sodium,glucose,bun);
 if(!calc||!Number.isFinite(measuredOsmolality)||measuredOsmolality<=0)return undefined;
 const etanol=ethanolMgDl!==undefined&&Number.isFinite(ethanolMgDl)&&ethanolMgDl>0?ethanolMgDl/3.7:0;
 const calculada=round1(calc.value+etanol);
 const gap=round1(measuredOsmolality-calculada);
 const elevated=gap>OSMOLAL_GAP_THRESHOLD;
 const interpretation=elevated
  ?`Brecha osmolal ${gap} mOsm/kg (>${OSMOLAL_GAP_THRESHOLD}): hay un osmol no medido en el plasma. ${etanol>0?"Ya se descontó el etanol medido. ":""}Descartar metanol, etilenglicol, isopropanol o propilenglicol (vehículo de fármacos IV).`
  :`Brecha osmolal ${gap} mOsm/kg (≤${OSMOLAL_GAP_THRESHOLD}): sin evidencia de osmoles no medidos.${etanol>0?" Se descontó el etanol medido.":""}`;
 return{measured:round1(measuredOsmolality),calculated:calculada,gap,elevated,ethanolAccounted:etanol>0,interpretation};
}
export function calculatedOsmolality(sodium:number,glucose:number,bun:number):CalculatedOsmolality|undefined{
 if(![sodium,glucose,bun].every(Number.isFinite)||sodium<=0)return undefined;
 const value=round1(2*sodium+glucose/18+bun/2.8);
 let status:OsmoStatus,interpretation:string;
 if(value>295){status="HIGH";interpretation="Hiperosmolar (>295): considerar hiperglucemia/uremia/deshidratación";}
 else if(value<275){status="LOW";interpretation="Hipoosmolar (<275): considerar hiponatremia/hipervolemia";}
 else{status="NORMAL";interpretation="Osmolalidad calculada normal (275–295)";}
 return{value,status,interpretation};
}

// ---- Calcio corregido por albúmina = Ca + 0.8·(4.0 − albúmina). Desenmascara hipo/hipercalcemia cuando la
// albúmina es anormal (el calcio total está ligado a albúmina). Reclasifica con el rango de calcio. ----
export type CorrectedCalcium=Readonly<{measured:number;corrected:number;albumin:number;status:LabStatus;interpretation:string;reliable:boolean;caveats?:readonly string[]}>;
// Auditoría 2026-09-19, anexo R03 (vector F06): la corrección de Payne pierde validez justo donde más se usa —enfermedad
// renal crónica y paciente crítico— y aceptaba una albúmina de 0.5 g/dL sin objeción. Fuera del rango en el que se
// derivó, la fórmula sobrecorrige y puede convertir una hipocalcemia real en un «calcio normal».
// Fuente: Payne RB et al., BMJ 1973;4:643-6; límites de validez en Gauci C et al., J Am Soc Nephrol 2008;19:1592-8.
export const CALCIUM_CORRECTION_ALBUMIN_RANGE=[2.0,5.0]as const;
export function correctedCalcium(measuredCa:number,albumin:number,ctx:Readonly<{ckd?:boolean}>={}):CorrectedCalcium|undefined{
 if(![measuredCa,albumin].every(Number.isFinite)||albumin<=0)return undefined;
 const corrected=round1(measuredCa+0.8*(4.0-albumin));
 const a=classifyLab("CALCIUM",String(corrected));
 const shifted=Math.abs(corrected-measuredCa)>=0.3;
 const[albMin,albMax]=CALCIUM_CORRECTION_ALBUMIN_RANGE;
 const caveats:string[]=[];
 if(albumin<albMin||albumin>albMax)caveats.push(`albúmina ${albumin} g/dL fuera del rango en el que se derivó la corrección (${albMin}–${albMax}): el valor corregido es poco fiable`);
 if(ctx.ckd===true)caveats.push("enfermedad renal crónica: la corrección de Payne no es fiable en la ERC (alteración del equilibrio ácido-base y de la unión a proteínas)");
 if(caveats.length)caveats.push("mida CALCIO IÓNICO para decidir");
 const interpretation=`Calcio corregido ${corrected} mg/dL (medido ${measuredCa}, albúmina ${albumin}): ${a.interpretation}`+(shifted?" — la corrección cambia la interpretación vs el calcio total":"");
 const conCaveat=caveats.length?`${interpretation} · ADVERTENCIA: ${caveats.join('; ')}`:interpretation;
 return{measured:round1(measuredCa),corrected,albumin:round1(albumin),status:caveats.length?"UNKNOWN":a.status,interpretation:conCaveat,reliable:caveats.length===0,...(caveats.length?{caveats}:{})};
}
