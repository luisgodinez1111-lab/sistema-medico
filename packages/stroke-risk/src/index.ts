// EPIC BQ — Riesgo de ictus/tromboembolismo en fibrilación auricular no valvular. Guía la indicación de anticoagulación.
// PROFUNDIDAD del eje C. Puro, sin PHI (recibe factores + edad; el sexo NO puntúa, ver abajo).
//
// COTEJO DE GUÍAS, decisión D1 (24-sep-2026, docs/compliance/cotejo-de-guias-clinicas.md §6) — SE ADOPTA CHA₂DS₂-VA.
//
// Este módulo implementaba CHA₂DS₂-VASc, con el punto por sexo femenino y umbrales distintos para hombre y mujer. El cotejo
// contra las guías encontró que DOS GUÍAS VIGENTES DISCREPAN: la ESC 2024 de fibrilación auricular sustituyó el índice por
// CHA₂DS₂-VA —elimina la categoría de sexo— y la ACC/AHA 2023 mantiene VASc. El dueño eligió la más reciente y la que
// sustenta el cambio con re-análisis de discriminación: **ESC 2024**.
//
// QUÉ CAMBIA Y POR QUÉ IMPORTA CLÍNICAMENTE:
//   · El sexo deja de sumar un punto. Pasa a ser un MODIFICADOR de riesgo que se informa, no un componente del puntaje.
//   · Desaparecen los umbrales sexo-específicos: el mismo puntaje significa lo mismo en un hombre y en una mujer, que es
//     exactamente la razón del cambio en la guía (un umbral que depende del sexo es difícil de sostener y deja fuera a
//     quien no encaja en la dicotomía).
//   · El puntaje máximo pasa de 9 a 9 sin el componente de sexo (C1+H1+A2+D1+S2+V1+A1 = 9 con A₂ y A excluyentes: máx. 8).
//   · Umbrales ESC 2024: ≥2 anticoagulación recomendada; =1 considerarla; 0 sin antitrombótico.
//
// Se mantiene el nombre de la función y la forma del resultado para no partir a los llamadores, pero el identificador del
// algoritmo, la etiqueta y el puntaje son los de CHA₂DS₂-VA. La equivalencia práctica: el puntaje de una mujer es ahora el
// de antes menos uno, y su umbral también baja en uno, así que la CONDUCTA no cambia para la mayoría; cambia en los casos
// de puntaje 1–2, que es donde vive la duda.
//
// Fuente: 2024 ESC Guidelines for the management of atrial fibrillation (European Heart Journal 2024). Alternativa
// declarada y NO implementada: ACC/AHA/ACCP/HRS 2023 (CHA₂DS₂-VASc).
export const STROKE_RISK_ALGORITHM={id:"CHA2DS2-VA-ESC-2024",label:"CHA₂DS₂-VA",guideline:"ESC 2024",
 supersedes:"CHA₂DS₂-VASc (ACC/AHA 2023), no implementado por decisión D1"}as const;
export type Cha2ds2VascInput=Readonly<{ageYears:number;female:boolean;chf:boolean;hypertension:boolean;diabetes:boolean;strokeHistory:boolean;vascularDisease:boolean}>;
export type StrokeRisk="LOW"|"INTERMEDIATE"|"HIGH";
export type Cha2ds2VascResult=Readonly<{score:number;risk:StrokeRisk;recommendation:string;components:Readonly<Record<string,number>>;bleedingRiskAssessed:false;
 /** Identificador y etiqueta del índice aplicado: el recibo de cálculo y la pantalla citan el mismo. */
 algorithm:typeof STROKE_RISK_ALGORITHM;
 /** El sexo NO puntúa (ESC 2024). Se informa como modificador para que quede constancia de que se consideró. */
 sexModifier:string}>;
// Auditoría 2026-09-19, anexo R03 (R03-03) — SE RETIRA el «riesgo anual de ictus (%)».
//
// La tabla que había era: {0:0, 1:1.3, 2:2.2, 3:3.2, 4:4.0, 5:6.7, 6:9.8, 7:9.6, 8:6.7, 9:15.2}. Nótese 7→9.6, 8→6.7:
// NO es monótona. Un paciente con más factores de riesgo aparecía con MENOS riesgo anual que otro con menos factores, lo
// que es un artefacto de las cohortes pequeñas del trabajo original en los puntajes altos, no un hecho clínico. Mostrar
// «6.7 % anual» para un CHA₂DS₂-VASc de 8 es una cifra falsa con apariencia de precisión.
//
// No se sustituye por otra tabla «de memoria»: publicar tasas por puntaje exige una cohorte citada y validada por un
// médico (queda como deuda declarada). Lo que guía la conducta —el puntaje y el umbral de anticoagulación— se conserva
// intacto; lo que se va es el número inventado.
export function cha2ds2vasc(i:Cha2ds2VascInput):Cha2ds2VascResult|undefined{
 if(!Number.isFinite(i.ageYears)||i.ageYears<0)return undefined;
 // D1/ESC 2024: los siete componentes de CHA₂DS₂-VA. El sexo no está, a propósito.
 const components:Record<string,number>={
  chf:i.chf?1:0,
  hypertension:i.hypertension?1:0,
  age:i.ageYears>=75?2:(i.ageYears>=65?1:0),
  diabetes:i.diabetes?1:0,
  stroke:i.strokeHistory?2:0,
  vascular:i.vascularDisease?1:0,
 };
 const score=Object.values(components).reduce((a,b)=>a+b,0);
 // Umbrales ESC 2024, IGUALES para ambos sexos: ≥2 recomendada, =1 considerar, 0 sin antitrombótico.
 let risk:StrokeRisk,recommendation:string;
 if(score===0){risk="LOW";recommendation="Sin antitrombótico";}
 else if(score===1){risk="INTERMEDIATE";recommendation="Considerar anticoagulación oral";}
 else{risk="HIGH";recommendation="Anticoagulación oral recomendada";}
 // R03-03: la indicación de anticoagular NO puede presentarse sin su contrapeso. No se inventa un HAS-BLED (exige datos
 // que el expediente todavía no captura); se declara explícitamente que el riesgo hemorrágico NO se ha evaluado, y la
 // recomendación lo dice cuando propone anticoagular.
 const conContrapeso=risk==="LOW"?recommendation
  :`${recommendation}. Riesgo HEMORRÁGICO no evaluado por el sistema: valórelo (p. ej. HAS-BLED) antes de indicar`;
 const sexModifier=i.female
  ?"Sexo femenino: modificador de riesgo, NO suma puntos (CHA₂DS₂-VA, ESC 2024). Con puntaje 1 el riesgo absoluto es mayor que en el varón: pesa a favor de anticoagular."
  :"Sexo masculino: el sexo no modifica el puntaje (CHA₂DS₂-VA, ESC 2024).";
 return{score,risk,recommendation:conContrapeso,components,bleedingRiskAssessed:false,algorithm:STROKE_RISK_ALGORITHM,sexModifier};
}
