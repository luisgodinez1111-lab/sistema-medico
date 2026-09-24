// EPIC BX — Interpretación ácido-base a partir de una gasometría (pH, pCO2, HCO3). PROFUNDIDAD del eje C:
// clasifica el trastorno PRIMARIO, verifica la compensación esperada de LOS CUATRO trastornos y, con la brecha
// aniónica, bifurca la acidosis metabólica y calcula el delta-delta. Puro, sin PHI. Umbrales de adulto.
//
// Auditoría 2026-09-19, anexo R03:
//  · R03-06: solo existía Winters (acidosis metabólica). Para un EPOC retenedor de CO₂ (pH 7.33, pCO₂ 62, HCO₃ 32) el
//    módulo devolvía «Acidosis respiratoria» SIN compensación, es decir, era incapaz de distinguir la descompensación
//    aguda —que puede requerir ventilación— del estado crónico compensado, que es precisamente la decisión que dice
//    apoyar. Ahora están las cuatro reglas, con el par agudo/crónico de los trastornos respiratorios.
//  · R03-07: los tres valores están SOBREDETERMINADOS (Henderson-Hasselbalch), y aun así `interpretAcidBase(7.40,40,5)`
//    —físicamente imposible: con pCO₂ 40 y HCO₃ 5 el pH sería ≈6.71— se aceptaba y se clasificaba. Una transposición de
//    campos en la captura producía una interpretación de apariencia normal. Ahora se valida la coherencia interna, hay
//    cotas de plausibilidad y el TIPO DE MUESTRA es obligatorio: de una gasometría VENOSA no se juzga la compensación
//    respiratoria (su pCO₂ es 4–6 mmHg mayor que el arterial y la regla dejaría de significar lo que dice).
//  · R03-05: `interpretAcidBase` no recibía la brecha aniónica, así que no podía separar la acidosis de brecha
//    aumentada (cetoacidosis, láctica, tóxicos) de la hiperclorémica —la bifurcación diagnóstica central— ni calcular
//    el delta-delta que descubre los trastornos mixtos.
//
// Fuentes: Winters (Albert MS, Dell RB, Winters RW. Ann Intern Med 1967;66:312-22); reglas de compensación y
// delta-delta según Berend K et al. «Physiological approach to assessment of acid-base disturbances». N Engl J Med
// 2014;371:1434-45; Henderson-Hasselbalch con pK 6.1 y solubilidad 0.0301 mmol/L/mmHg.
export type AcidBaseStatus="ACIDEMIA"|"ALKALEMIA"|"NORMAL";
export type PrimaryDisorder="METABOLIC_ACIDOSIS"|"RESPIRATORY_ACIDOSIS"|"METABOLIC_ALKALOSIS"|"RESPIRATORY_ALKALOSIS"|"NORMAL"|"MIXED_OR_COMPENSATED";
export type Specimen="ARTERIAL"|"VENOUS"|"CAPILLARY";
export type Chronicity="ACUTE"|"CHRONIC";
/** Cotas de plausibilidad de una gasometría humana. Fuera de ellas el panel es un error de captura, no un caso extremo. */
export const GAS_BOUNDS={ph:[6.5,7.9],pco2:[10,150],hco3:[2,60]}as const satisfies Readonly<Record<string,readonly[number,number]>>;
/** Tolerancia entre el pH medido y el calculado por Henderson-Hasselbalch antes de declarar el panel incoherente. */
export const HH_TOLERANCE=0.05;
export type AcidBaseOptions=Readonly<{specimen:Specimen;anionGap?:number;anionGapCorrected?:boolean;chronicity?:Chronicity}>;
export type CompensationScenario=Readonly<{chronicity:Chronicity;expectedHco3:number;matches:boolean}>;
export type AcidBaseReject=Readonly<{reasonCode:"NON_NUMERIC"|"IMPLAUSIBLE_VALUE"|"GAS_PANEL_INCONSISTENT";detail:string}>;
export type AcidBaseResult=Readonly<{
 status:AcidBaseStatus;primary:PrimaryDisorder;interpretation:string;specimen:Specimen;
 phCalculated:number;                       // el pH que implican pCO₂ y HCO₃ (control de coherencia; se devuelve siempre)
 expectedPco2?:number;expectedHco3?:number; // el valor que exige la regla de compensación del trastorno primario
 compensation?:string;
 compensationAssessed:boolean;              // false en muestra no arterial: no se juzga con un pCO₂ venoso
 scenarios?:readonly CompensationScenario[];// trastorno respiratorio sin cronicidad declarada: los dos escenarios
 anionGapBranch?:"HIGH_AG"|"NORMAL_AG";     // bifurcación de la acidosis metabólica
 deltaRatio?:number;deltaInterpretation?:string;
}>;
/** pH que implican pCO₂ y HCO₃ (Henderson-Hasselbalch). Los tres valores de una gasometría están sobredeterminados. */
export function phFromGases(pco2:number,hco3:number):number{
 return Math.round((6.1+Math.log10(hco3/(0.0301*pco2)))*1000)/1000;
}
/** Comprueba el dominio y la coherencia interna. `undefined` = el panel es utilizable. */
export function acidBaseCheck(ph:number,pco2:number,hco3:number):AcidBaseReject|undefined{
 const vals:ReadonlyArray<readonly[keyof typeof GAS_BOUNDS,number]>=[["ph",ph],["pco2",pco2],["hco3",hco3]];
 for(const[k,v]of vals)if(!Number.isFinite(v))return{reasonCode:"NON_NUMERIC",detail:`${k} no es numérico`};
 for(const[k,v]of vals){const[lo,hi]=GAS_BOUNDS[k];if(v<lo||v>hi)return{reasonCode:"IMPLAUSIBLE_VALUE",detail:`${k}=${v} fuera del rango plausible ${lo}–${hi}`};}
 const calc=phFromGases(pco2,hco3);
 if(Math.abs(calc-ph)>HH_TOLERANCE)
  return{reasonCode:"GAS_PANEL_INCONSISTENT",detail:`El panel es internamente incoherente: con pCO₂ ${pco2} mmHg y HCO₃ ${hco3} mEq/L, Henderson-Hasselbalch da pH ${calc}, no ${ph} (tolerancia ±${HH_TOLERANCE}). Verifique la captura: una transposición de pCO₂ y HCO₃ produce exactamente este patrón.`};
 return undefined;
}
const r1=(n:number):number=>Math.round(n*10)/10;
const LABEL:Readonly<Record<PrimaryDisorder,string>>={METABOLIC_ACIDOSIS:"Acidosis metabólica",RESPIRATORY_ACIDOSIS:"Acidosis respiratoria",METABOLIC_ALKALOSIS:"Alcalosis metabólica",RESPIRATORY_ALKALOSIS:"Alcalosis respiratoria",MIXED_OR_COMPENSATED:"Trastorno mixto o compensado",NORMAL:"Equilibrio ácido-base normal"};
// Reglas de compensación de los trastornos RESPIRATORIOS: HCO₃ esperado por cada 10 mmHg de desviación de pCO₂ respecto
// a 40. Los pares agudo/crónico son los que distinguen al retenedor crónico del paciente que se está descompensando.
const RESP_SLOPE={RESPIRATORY_ACIDOSIS:{ACUTE:1,CHRONIC:3.5},RESPIRATORY_ALKALOSIS:{ACUTE:2,CHRONIC:4}}as const;
function respiratoryScenarios(primary:"RESPIRATORY_ACIDOSIS"|"RESPIRATORY_ALKALOSIS",pco2:number,hco3:number):CompensationScenario[]{
 const delta=Math.abs(pco2-40)/10;
 const sign=primary==="RESPIRATORY_ACIDOSIS"?1:-1; // en la alcalosis el HCO₃ esperado BAJA
 return(["ACUTE","CHRONIC"]as const).map(chronicity=>{
  const expectedHco3=r1(24+sign*RESP_SLOPE[primary][chronicity]*delta);
  return{chronicity,expectedHco3,matches:Math.abs(hco3-expectedHco3)<=2};
 });
}
export function interpretAcidBase(ph:number,pco2:number,hco3:number,opts:AcidBaseOptions):AcidBaseResult|undefined{
 if(acidBaseCheck(ph,pco2,hco3))return undefined;
 const status:AcidBaseStatus=ph<7.35?"ACIDEMIA":ph>7.45?"ALKALEMIA":"NORMAL";
 let primary:PrimaryDisorder="NORMAL";
 if(status==="ACIDEMIA")primary=hco3<22?"METABOLIC_ACIDOSIS":pco2>45?"RESPIRATORY_ACIDOSIS":"MIXED_OR_COMPENSATED";
 else if(status==="ALKALEMIA")primary=hco3>26?"METABOLIC_ALKALOSIS":pco2<35?"RESPIRATORY_ALKALOSIS":"MIXED_OR_COMPENSATED";
 else primary=(hco3<22||pco2<35||hco3>26||pco2>45)?"MIXED_OR_COMPENSATED":"NORMAL"; // pH normal con analitos anormales -> mixto/compensado
 // R03-07: de una muestra NO arterial no se juzga la compensación respiratoria. El pCO₂ venoso es 4–6 mmHg mayor y el
 // pH 0.03–0.05 menor: aplicarle Winters o las pendientes respiratorias daría un veredicto con la precisión equivocada.
 const arterial=opts.specimen==="ARTERIAL";
 let expectedPco2:number|undefined,expectedHco3:number|undefined,compensation:string|undefined,scenarios:CompensationScenario[]|undefined;
 if(arterial){
  if(primary==="METABOLIC_ACIDOSIS"){
   // Winters: pCO₂ esperado = 1.5·HCO₃ + 8 (±2).
   expectedPco2=r1(1.5*hco3+8);
   if(pco2>expectedPco2+2)compensation="Acidosis respiratoria concurrente (compensación insuficiente)";
   else if(pco2<expectedPco2-2)compensation="Alcalosis respiratoria concurrente (sobrecompensación)";
   else compensation="Compensación respiratoria adecuada (Winters)";
  }else if(primary==="METABOLIC_ALKALOSIS"){
   // pCO₂ esperado = 40 + 0.7·(HCO₃ − 24) (±2).
   expectedPco2=r1(40+0.7*(hco3-24));
   if(pco2>expectedPco2+2)compensation="Acidosis respiratoria concurrente (hipoventilación mayor que la compensadora)";
   else if(pco2<expectedPco2-2)compensation="Alcalosis respiratoria concurrente (no hay hipoventilación compensadora)";
   else compensation="Compensación respiratoria adecuada";
  }else if(primary==="RESPIRATORY_ACIDOSIS"||primary==="RESPIRATORY_ALKALOSIS"){
   scenarios=respiratoryScenarios(primary,pco2,hco3);
   const agudo=scenarios[0]!,cronico=scenarios[1]!;
   if(opts.chronicity){
    const s=opts.chronicity==="ACUTE"?agudo:cronico;
    expectedHco3=s.expectedHco3;
    const etiqueta=opts.chronicity==="ACUTE"?"aguda":"crónica";
    if(s.matches)compensation=`Compensación metabólica acorde con una forma ${etiqueta} (HCO₃ esperado ${s.expectedHco3} ±2)`;
    else if(hco3>s.expectedHco3+2)compensation=`Alcalosis metabólica concurrente (HCO₃ ${hco3} por encima del esperado ${s.expectedHco3} para una forma ${etiqueta})`;
    else compensation=`Acidosis metabólica concurrente (HCO₃ ${hco3} por debajo del esperado ${s.expectedHco3} para una forma ${etiqueta})`;
   }else{
    // R03-06: sin cronicidad declarada se informan LOS DOS escenarios y cuál concuerda con el HCO₃ medido, en vez de
    // omitir la compensación (que es lo que hacía) o elegir uno por el paciente.
    const cual=agudo.matches&&!cronico.matches?"una forma AGUDA":cronico.matches&&!agudo.matches?"una forma CRÓNICA":agudo.matches&&cronico.matches?"ambas formas (pCO₂ apenas desviado)":"ninguna de las dos (sugiere trastorno metabólico concurrente)";
    compensation=`Cronicidad no declarada: HCO₃ esperado ${agudo.expectedHco3} si es aguda y ${cronico.expectedHco3} si es crónica (±2). El HCO₃ medido (${hco3}) concuerda con ${cual}.`;
   }
  }
 }
 // R03-05: bifurcación de la acidosis metabólica por la brecha aniónica y delta-delta (ΔAG/ΔHCO₃).
 let anionGapBranch:"HIGH_AG"|"NORMAL_AG"|undefined,deltaRatio:number|undefined,deltaInterpretation:string|undefined;
 if(primary==="METABOLIC_ACIDOSIS"&&opts.anionGap!==undefined&&Number.isFinite(opts.anionGap)){
  anionGapBranch=opts.anionGap>12?"HIGH_AG":"NORMAL_AG";
  if(anionGapBranch==="HIGH_AG"){
   const dAG=opts.anionGap-12,dHco3=24-hco3;
   if(dHco3>0){
    deltaRatio=Math.round((dAG/dHco3)*100)/100;
    deltaInterpretation=deltaRatio<0.4
     ?`Delta-delta ${deltaRatio}: el HCO₃ cayó más de lo que subió la brecha — acidosis hiperclorémica concurrente`
     :deltaRatio<=0.8?`Delta-delta ${deltaRatio}: acidosis mixta de brecha aumentada + hiperclorémica`
     :deltaRatio<=2?`Delta-delta ${deltaRatio}: acidosis de brecha aumentada pura`
     :`Delta-delta ${deltaRatio}: la brecha subió más de lo que cayó el HCO₃ — alcalosis metabólica concurrente o acidosis respiratoria crónica previa`;
   }
  }
 }
 const detalles=[
  compensation,
  anionGapBranch==="HIGH_AG"?`brecha aniónica elevada${opts.anionGapCorrected?" (corregida por albúmina)":""}: cetoacidosis, láctica, urémica o tóxicos`:
  anionGapBranch==="NORMAL_AG"?`brecha aniónica normal${opts.anionGapCorrected?" (corregida por albúmina)":""}: hiperclorémica (pérdidas digestivas, acidosis tubular renal, sueros salinos)`:undefined,
  deltaInterpretation,
  arterial?undefined:`Muestra ${opts.specimen==="VENOUS"?"VENOSA":"CAPILAR"}: la compensación respiratoria NO se evalúa (el pCO₂ no es arterial). Para juzgarla se requiere gasometría arterial.`,
 ].filter((x):x is string=>x!==undefined);
 return{status,primary,specimen:opts.specimen,phCalculated:phFromGases(pco2,hco3),compensationAssessed:arterial&&compensation!==undefined,
  interpretation:LABEL[primary]+(detalles.length?` — ${detalles.join(" · ")}`:""),
  ...(expectedPco2!==undefined?{expectedPco2}:{}),...(expectedHco3!==undefined?{expectedHco3}:{}),
  ...(compensation?{compensation}:{}),...(scenarios?{scenarios}:{}),
  ...(anionGapBranch?{anionGapBranch}:{}),...(deltaRatio!==undefined?{deltaRatio}:{}),...(deltaInterpretation?{deltaInterpretation}:{})};
}
