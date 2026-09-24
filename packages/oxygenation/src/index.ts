// EPIC CA — Gradiente alveolo-arterial de O2 (A-a). PROFUNDIDAD del eje C: distingue hipoxemia por problema
// de INTERCAMBIO gaseoso (V/Q, shunt, difusión -> gradiente elevado) vs HIPOVENTILACIÓN (gradiente normal).
// Complementa el análisis ácido-base (EPIC BX). Puro, sin PHI.
// PAO2 = FiO2·(Patm − PH2O) − PaCO2/0.8. Aire ambiente FiO2=0.21; nivel del mar Patm=760, PH2O=47 mmHg.
// Auditoría 2026-09-19, anexo R03 (R03-08) — LA PRESIÓN ATMOSFÉRICA YA NO TIENE VALOR POR DEFECTO.
//
// La fórmula usaba 760 mmHg (nivel del mar) cuando no se declaraba, y esto es un producto «México-first»: en la Ciudad de
// México (≈2 240 m) la presión real ronda los 580 mmHg. Con 760 el PAO₂ alveolar sale ~38 mmHg más alto, así que el
// gradiente A-a queda SOBRESTIMADO en esa misma magnitud: un gradiente normal se lee como elevado y la hipoxemia por
// hipoventilación se interpreta como un problema de intercambio gaseoso. El aviso en el JSON no bastaba — un valor
// numérico que parece calculado se usa aunque venga con nota al pie.
//
// Ahora `atmPressure` es OBLIGATORIA. Quien consulta la declara, o se deriva de la altitud de la sede
// (`atmPressureFromAltitude`), o no se calcula.
export type AaGradientOptions=Readonly<{fio2:number;atmPressure:number}>;

/**
 * Presión atmosférica (mmHg) a una altitud dada, por la atmósfera estándar internacional:
 *   P = 760 · (1 − 2.25577e−5 · h)^5.25588   (h en metros)
 * Referencia: ISO 2533:1975 (Standard Atmosphere). Ejemplos: 0 m → 760; Ciudad de México 2 240 m → ≈579;
 * Toluca 2 660 m → ≈550. No sustituye una medición barométrica local (el clima mueve la presión ±10 mmHg).
 */
export function atmPressureFromAltitude(meters:number):number|undefined{
 if(!Number.isFinite(meters)||meters<-500||meters>6000)return undefined; // fuera de eso no hay asistencia clínica habitual
 return Math.round(760*Math.pow(1-2.25577e-5*meters,5.25588)*10)/10;
}
// `expectedValid=false` con O₂ suplementario: la fórmula del gradiente esperado por edad (2.5 + 0.21·edad) SOLO vale
// respirando aire ambiente; con FiO₂ > 0.21 el gradiente "normal" sube y no debe compararse (usar PaO₂/FiO₂).
export type AaGradientResult=Readonly<{alveolarPo2:number;gradient:number;expected:number;expectedValid:boolean;elevated:boolean;fio2:number;atmPressure:number;pfRatio:number;interpretation:string}>;
export function aaGradient(pao2:number,paco2:number,ageYears:number,opts:AaGradientOptions):AaGradientResult|undefined{
 if(![pao2,paco2,ageYears].every(Number.isFinite)||pao2<=0||paco2<=0||ageYears<0)return undefined;
 const fio2=opts.fio2;const atm=opts.atmPressure;
 // R03-08: sin FiO₂ ni presión declaradas no hay cálculo posible. R03-01/R03-09: cotas de plausibilidad en el propio
 // paquete, no solo en la ruta — una función clínica pura no debe devolver un número para una entrada imposible.
 if(!Number.isFinite(fio2)||!Number.isFinite(atm))return undefined;
 if(!(fio2>=0.21&&fio2<=1)||!(atm>=300&&atm<=800))return undefined; // 300 mmHg ≈ 8 800 m; por encima de 800 no hay sede clínica
 if(pao2>800||paco2>200||ageYears>130)return undefined;             // valores fuera de lo fisiológicamente posible
 const alveolarPo2=Math.round((fio2*(atm-47)-paco2/0.8)*10)/10;
 const gradient=Math.round((alveolarPo2-pao2)*10)/10;
 const expected=Math.round((2.5+0.21*ageYears)*10)/10; // gradiente normal esperado por edad
 const roomAir=Math.abs(fio2-0.21)<0.005;const pfRatio=Math.round(pao2/fio2);
 const elevated=roomAir&&gradient>expected;
 const interpretation=!roomAir
  ?`Con O₂ suplementario (FiO₂ ${fio2}) el gradiente esperado por edad NO aplica; PaO₂/FiO₂ = ${pfRatio}${pfRatio<300?" (<300: alteración del intercambio gaseoso)":""}`
  :elevated
   ?"Gradiente A-a elevado: problema de intercambio gaseoso (V/Q, shunt o difusión)"
   :"Gradiente A-a normal: hipoxemia por hipoventilación (o intercambio conservado)";
 return{alveolarPo2,gradient,expected,expectedValid:roomAir,elevated,fio2,atmPressure:atm,pfRatio,interpretation};
}
