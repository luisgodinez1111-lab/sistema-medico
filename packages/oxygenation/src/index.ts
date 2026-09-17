// EPIC CA — Gradiente alveolo-arterial de O2 (A-a). PROFUNDIDAD del eje C: distingue hipoxemia por problema
// de INTERCAMBIO gaseoso (V/Q, shunt, difusión -> gradiente elevado) vs HIPOVENTILACIÓN (gradiente normal).
// Complementa el análisis ácido-base (EPIC BX). Puro, sin PHI.
// PAO2 = FiO2·(Patm − PH2O) − PaCO2/0.8. Aire ambiente FiO2=0.21; nivel del mar Patm=760, PH2O=47 mmHg.
// Parametrizable por altitud (relevante en México: p.ej. CDMX ~585 mmHg) vía atmPressure.
export type AaGradientOptions=Readonly<{fio2?:number;atmPressure?:number}>;
export type AaGradientResult=Readonly<{alveolarPo2:number;gradient:number;expected:number;elevated:boolean;interpretation:string}>;
export function aaGradient(pao2:number,paco2:number,ageYears:number,opts:AaGradientOptions={}):AaGradientResult|undefined{
 if(![pao2,paco2,ageYears].every(Number.isFinite)||pao2<=0||paco2<=0||ageYears<0)return undefined;
 const fio2=opts.fio2??0.21;const atm=opts.atmPressure??760;
 if(!(fio2>0&&fio2<=1)||!(atm>0))return undefined;
 const alveolarPo2=Math.round((fio2*(atm-47)-paco2/0.8)*10)/10;
 const gradient=Math.round((alveolarPo2-pao2)*10)/10;
 const expected=Math.round((2.5+0.21*ageYears)*10)/10; // gradiente normal esperado por edad
 const elevated=gradient>expected;
 const interpretation=elevated
  ?"Gradiente A-a elevado: problema de intercambio gaseoso (V/Q, shunt o difusión)"
  :"Gradiente A-a normal: hipoxemia por hipoventilación (o intercambio conservado)";
 return{alveolarPo2,gradient,expected,elevated,interpretation};
}
