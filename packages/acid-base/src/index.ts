// EPIC BX — Interpretación ácido-base a partir de una gasometría (pH, pCO2, HCO3). PROFUNDIDAD del eje C:
// clasifica el trastorno PRIMARIO y verifica la compensación respiratoria esperada (fórmula de Winters) para
// detectar trastornos MIXTOS. Complementa el anion gap (EPIC BN). Puro, sin PHI. Umbrales estándar de adulto.
export type AcidBaseStatus="ACIDEMIA"|"ALKALEMIA"|"NORMAL";
export type PrimaryDisorder="METABOLIC_ACIDOSIS"|"RESPIRATORY_ACIDOSIS"|"METABOLIC_ALKALOSIS"|"RESPIRATORY_ALKALOSIS"|"NORMAL"|"MIXED_OR_COMPENSATED";
export type AcidBaseResult=Readonly<{status:AcidBaseStatus;primary:PrimaryDisorder;expectedPco2?:number;compensation?:string;interpretation:string}>;
export function interpretAcidBase(ph:number,pco2:number,hco3:number):AcidBaseResult|undefined{
 if(![ph,pco2,hco3].every(Number.isFinite)||ph<=0||pco2<=0||hco3<=0)return undefined;
 const status:AcidBaseStatus=ph<7.35?"ACIDEMIA":ph>7.45?"ALKALEMIA":"NORMAL";
 let primary:PrimaryDisorder="NORMAL";
 if(status==="ACIDEMIA")primary=hco3<22?"METABOLIC_ACIDOSIS":pco2>45?"RESPIRATORY_ACIDOSIS":"MIXED_OR_COMPENSATED";
 else if(status==="ALKALEMIA")primary=hco3>26?"METABOLIC_ALKALOSIS":pco2<35?"RESPIRATORY_ALKALOSIS":"MIXED_OR_COMPENSATED";
 else primary=(hco3<22||pco2<35||hco3>26||pco2>45)?"MIXED_OR_COMPENSATED":"NORMAL"; // pH normal con analitos anormales -> mixto/compensado
 const LABEL:Record<PrimaryDisorder,string>={METABOLIC_ACIDOSIS:"Acidosis metabólica",RESPIRATORY_ACIDOSIS:"Acidosis respiratoria",METABOLIC_ALKALOSIS:"Alcalosis metabólica",RESPIRATORY_ALKALOSIS:"Alcalosis respiratoria",MIXED_OR_COMPENSATED:"Trastorno mixto o compensado",NORMAL:"Equilibrio ácido-base normal"};
 let expectedPco2:number|undefined,compensation:string|undefined;
 if(primary==="METABOLIC_ACIDOSIS"){
  // Winters: pCO2 esperado = 1.5·HCO3 + 8 (±2). Desvía -> trastorno respiratorio concurrente.
  expectedPco2=Math.round((1.5*hco3+8)*10)/10;
  if(pco2>expectedPco2+2)compensation="Acidosis respiratoria concurrente (compensación insuficiente)";
  else if(pco2<expectedPco2-2)compensation="Alcalosis respiratoria concurrente (sobrecompensación)";
  else compensation="Compensación respiratoria adecuada (Winters)";
 }
 const interpretation=LABEL[primary]+(compensation?` — ${compensation}`:"");
 return{status,primary,...(expectedPco2!==undefined?{expectedPco2}:{}),...(compensation?{compensation}:{}),interpretation};
}
