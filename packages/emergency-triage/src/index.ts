// Triage de urgencias: el algoritmo ESI de verdad —cuatro puntos de decisión— en vez de un entero que alguien teclea.
// Puro, sin PHI (recibe discriminadores y signos vitales, nunca identidad).
//
// Auditoría 2026-09-19, anexo R02b (R2B-019) — SE NOMBRABA «ESI» Y NO HABÍA NADA DE ESI.
//
// El cuerpo de la clasificación era `acuity:z.number().int().min(1).max(5)` y el fold decía «La acuidad vigente es la del
// último triage (ESI 1-5)». La UI llegaba a tener un botón «Clasificar ESI-2» que enviaba el literal 2. El hallazgo es de
// afirmación falsa, no de omisión: ESI no es «un número del 1 al 5 que el clínico decide», es un ALGORITMO DE DECISIÓN con
// cuatro puntos, y ninguno estaba implementado. Sin los discriminadores tampoco había trazabilidad de CÓMO se llegó al
// número: un ESI-3 y un ESI-2 se veían igual de fundados.
//
// FUENTE Y VERSIÓN. Emergency Severity Index (ESI), algoritmo de cuatro puntos de decisión:
//   · v4 — AHRQ, «Emergency Severity Index (ESI): A Triage Tool for Emergency Department Care, Version 4, Implementation
//     Handbook 2012 Edition». Es la versión con más literatura de validación acumulada.
//   · v5 — Emergency Nurses Association, «Emergency Severity Index Handbook, 5th edition» (2023), que reorganiza los puntos
//     de decisión y traslada los criterios pediátricos de fiebre a las guías vigentes en cada momento en vez de fijarlos.
// Se implementa la ESTRUCTURA, que es idéntica en ambas, y los signos vitales de zona de peligro de la v4, que son los que
// están publicados como tabla numérica. La versión aplicada se declara en la salida (`algorithm`) para que una revisión
// posterior sepa contra qué comparar; no se mezclan criterios de las dos.
//
// LO QUE EL SOFTWARE PUEDE Y NO PUEDE HACER AQUÍ. Los puntos A y B de ESI son juicio clínico irreductible: «¿requiere una
// intervención inmediata para salvar la vida?» y «¿es una situación de alto riesgo?» no se derivan de campos. El punto C
// —cuántos recursos se prevé consumir— también lo estima el clínico. Lo que el software SÍ puede hacer, y hace, es: exigir
// que esas respuestas EXISTAN y queden registradas, aplicar el árbol sin saltarse pasos, y aplicar el punto D (zona de
// peligro por signos vitales) que es puramente numérico y es el que más se olvida a mano.
export type EsiLevel=1|2|3|4|5;
export type EsiDecisionPoint="A"|"B"|"C"|"D";

/** Signos vitales relevantes para el punto D. Cualquiera puede faltar: faltar NO es «normal», y se reporta como tal. */
export type TriageVitals=Readonly<{heartRate?:number;respiratoryRate?:number;spo2?:number}>;

export type EsiInput=Readonly<{
 /** Punto A — ¿requiere intervención inmediata para salvar la vida? (vía aérea, ventilación, circulación, ya). */
 requiresLifeSavingIntervention:boolean;
 /** Punto B — situación de alto riesgo según juicio clínico. */
 highRiskSituation:boolean;
 /** Punto B — confusión, letargo o desorientación de NUEVA aparición. */
 newConfusionLethargyDisorientation:boolean;
 /** Punto B — dolor o distrés severo. El umbral de ESI es ≥7/10 en la escala de dolor; se recibe el valor, no el juicio. */
 painScore?:number;
 severeDistress:boolean;
 /** Punto C — número de recursos que se prevé consumir (laboratorio, imagen, procedimiento, consulta…). 0, 1 o ≥2. */
 predictedResources:number;
 /** Punto D — edad en meses (los umbrales de zona de peligro son por edad) y signos vitales. */
 ageMonths:number;
 vitals:TriageVitals;
}>;

export type EsiResult=Readonly<{
 level:EsiLevel;
 decisionPoint:EsiDecisionPoint;
 /** Por qué salió ese nivel, en el vocabulario del algoritmo. Es la trazabilidad que el hallazgo echaba en falta. */
 rationale:string;
 /** Signos vitales fuera de la zona aceptada, si los hubo. Vacío no significa «normales»: ver `vitalsMissing`. */
 dangerZoneVitals:readonly string[];
 /** Signos vitales que no se aportaron. El punto D no se puede aplicar del todo sin ellos, y se dice. */
 vitalsMissing:readonly string[];
 /** Si el algoritmo SUGIERE subir de 3 a 2 por zona de peligro. En ESI es «considerar»: la decisión es del clínico. */
 upgradeConsidered:boolean;
 algorithm:string;
}>;

/**
 * Umbrales de «zona de peligro» por edad, tabla del handbook ESI v4 (2012). Son los valores publicados; no se ajustan ni se
 * interpolan. `maxAgeMonths` es el límite superior del tramo (exclusivo salvo el último, que es abierto).
 */
export const DANGER_ZONE_VITALS:readonly Readonly<{maxAgeMonths:number;label:string;hrAbove:number;rrAbove:number}>[]=[
 {maxAgeMonths:3,label:"<3 meses",hrAbove:180,rrAbove:50},
 {maxAgeMonths:36,label:"3 meses–3 años",hrAbove:160,rrAbove:40},
 {maxAgeMonths:96,label:"3–8 años",hrAbove:140,rrAbove:30},
 {maxAgeMonths:Number.POSITIVE_INFINITY,label:">8 años",hrAbove:100,rrAbove:20},
];
/** SpO₂ por debajo de este valor es zona de peligro en todas las edades (handbook v4). */
export const DANGER_ZONE_SPO2_BELOW=92;
export const ESI_ALGORITHM="ESI-v4-AHRQ-2012";

export function dangerZoneFor(ageMonths:number){
 return DANGER_ZONE_VITALS.find(t=>ageMonths<t.maxAgeMonths)??DANGER_ZONE_VITALS[DANGER_ZONE_VITALS.length-1]!;
}

/** El umbral de dolor severo del algoritmo: ≥7/10. Se expone para que la UI muestre el mismo número que aplica el motor. */
export const SEVERE_PAIN_AT_OR_ABOVE=7;

export function esiLevel(input:EsiInput):EsiResult{
 const tramo=dangerZoneFor(input.ageMonths);
 const dangerZoneVitals:string[]=[];
 const vitalsMissing:string[]=[];
 const{heartRate,respiratoryRate,spo2}=input.vitals;
 if(heartRate===undefined)vitalsMissing.push("heartRate");else if(heartRate>tramo.hrAbove)dangerZoneVitals.push(`FC ${heartRate} > ${tramo.hrAbove} (${tramo.label})`);
 if(respiratoryRate===undefined)vitalsMissing.push("respiratoryRate");else if(respiratoryRate>tramo.rrAbove)dangerZoneVitals.push(`FR ${respiratoryRate} > ${tramo.rrAbove} (${tramo.label})`);
 if(spo2===undefined)vitalsMissing.push("spo2");else if(spo2<DANGER_ZONE_SPO2_BELOW)dangerZoneVitals.push(`SpO₂ ${spo2} % < ${DANGER_ZONE_SPO2_BELOW} %`);
 const base=(level:EsiLevel,decisionPoint:EsiDecisionPoint,rationale:string,upgradeConsidered=false):EsiResult=>
  ({level,decisionPoint,rationale,dangerZoneVitals,vitalsMissing,upgradeConsidered,algorithm:ESI_ALGORITHM});

 // PUNTO A. Es el único que no admite matiz: si requiere una intervención inmediata para salvar la vida, es nivel 1 y no se
 // sigue evaluando. El orden importa: evaluar recursos antes que esto sería el error de diseño clásico.
 if(input.requiresLifeSavingIntervention)
  return base(1,"A","Punto A: requiere intervención inmediata para salvar la vida");

 // PUNTO B. Cualquiera de los tres discriminadores basta. El dolor severo es ≥7/10 según el algoritmo, y se acepta también
 // el distrés severo declarado por el clínico (que es lo que el handbook llama «severe distress»).
 const dolorSevero=input.painScore!==undefined&&input.painScore>=SEVERE_PAIN_AT_OR_ABOVE;
 if(input.highRiskSituation)return base(2,"B","Punto B: situación de alto riesgo");
 if(input.newConfusionLethargyDisorientation)return base(2,"B","Punto B: confusión, letargo o desorientación de nueva aparición");
 if(dolorSevero||input.severeDistress)
  return base(2,"B",dolorSevero?`Punto B: dolor severo (${input.painScore}/10 ≥ ${SEVERE_PAIN_AT_OR_ABOVE})`:"Punto B: distrés severo");

 // PUNTO C. Cuántos recursos se prevé consumir. 0 → 5; 1 → 4; ≥2 → 3.
 if(input.predictedResources<=0)return base(5,"C","Punto C: ningún recurso previsto");
 if(input.predictedResources===1)return base(4,"C","Punto C: un recurso previsto");

 // PUNTO D. Solo se aplica a quien ya cayó en nivel 3: si los signos vitales están fuera de la zona aceptada, el algoritmo
 // dice «considerar subir a 2». Es una SUGERENCIA por diseño: la decisión de subir es del clínico, y por eso el nivel que
 // se devuelve sigue siendo 3 con la bandera puesta, en vez de subirlo en silencio.
 if(dangerZoneVitals.length>0)
  return base(3,"D",`Punto D: dos o más recursos y signos vitales en zona de peligro (${dangerZoneVitals.join("; ")}) — considerar ESI-2`,true);
 return base(3,"C","Punto C: dos o más recursos previstos");
}

/**
 * Tiempos objetivo de reevaluación por nivel. **ESI NO define tiempos objetivo** —es una escala de agudeza, no de espera—,
 * así que atribuirle unos sería inventar. Los valores por omisión de aquí son los de CTAS (Canadian Triage and Acuity Scale,
 * que sí publica tiempos: nivel 1 continuo, 2 a 15 min, 3 a 30 min, 4 a 60 min, 5 a 120 min) y se declaran como tales. Un
 * establecimiento puede fijar los suyos; lo que no puede pasar es que el sistema muestre un tiempo y diga que es de ESI.
 */
export const REASSESSMENT_MINUTES_CTAS:Readonly<Record<EsiLevel,number|null>>={1:null,2:15,3:30,4:60,5:120};
export const REASSESSMENT_SOURCE="CTAS (Canadian Triage and Acuity Scale) — ESI no publica tiempos objetivo";
/** `null` en el nivel 1 significa vigilancia continua, no «sin plazo». */
export function reassessmentDueAt(level:EsiLevel,fromIso:string):string|null{
 const min=REASSESSMENT_MINUTES_CTAS[level];
 if(min===null)return null;
 const t=new Date(fromIso);
 if(Number.isNaN(t.getTime()))throw new Error("TRIAGE_REASSESSMENT_INVALID_DATE");
 return new Date(t.getTime()+min*60_000).toISOString();
}

export const EMERGENCY_TRIAGE_LIMITS=
 "Se implementa la ESTRUCTURA del algoritmo ESI (puntos A→B→C→D) y la tabla numérica de signos vitales de zona de peligro "+
 "del handbook v4 (AHRQ 2012). Los puntos A, B y C dependen de juicio clínico que ningún campo puede derivar —si requiere "+
 "intervención inmediata, si la situación es de alto riesgo, cuántos recursos se prevén—: lo que el sistema hace es "+
 "EXIGIR que esas respuestas existan, registrarlas y aplicar el árbol sin saltarse pasos. NO se implementan los criterios "+
 "pediátricos de fiebre (la v5 los remite a las guías vigentes en cada momento y fijarlos aquí los dejaría obsoletos), ni "+
 "la reevaluación automática por deterioro, ni la asignación de cama o recurso. Los tiempos objetivo de reevaluación son de "+
 "CTAS y se declaran así porque ESI no publica ninguno. La adopción de ESI como escala del servicio y su validación por el "+
 "responsable de urgencias siguen en ADR-0300.";
