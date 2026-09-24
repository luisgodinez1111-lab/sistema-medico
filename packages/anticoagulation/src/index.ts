// EPIC BU — Monitoreo terapéutico del INR (anticoagulación oral con antagonistas de vitamina K). PROFUNDIDAD
// del eje C: interpreta el INR contra el rango objetivo (contexto del fármaco), no solo el rango de laboratorio.
// Puro, sin PHI. Rango objetivo por defecto 2.0–3.0 (FA/TVP); prótesis mecánica suele 2.5–3.5 (parametrizable).
export type InrStatus="SUBTHERAPEUTIC"|"THERAPEUTIC"|"SUPRATHERAPEUTIC"|"CRITICAL_HIGH";
export type InrTarget=Readonly<{low:number;high:number}>;
// Auditoría 2026-09-19, anexo R03 (vectores F02 y F07):
//  · F02: un INR de 12 recibía EXACTAMENTE el mismo texto que un INR de 5 («suspender dosis y considerar vitamina K»).
//    La conducta no es la misma: las guías CHEST escalonan 4.5–10 sin sangrado (omitir dosis y recontrolar), >10 sin
//    sangrado (vitamina K ORAL) y sangrado mayor a cualquier INR (concentrado de complejo protrombínico + vitamina K IV).
//  · F07: el INR se interpretaba en cualquier paciente anticoagulado, y NO monitoriza a los anticoagulantes orales
//    directos: un INR «terapéutico» en un paciente con rivaroxabán o apixabán es una lectura sin significado que puede
//    tranquilizar sobre una anticoagulación que nadie ha comprobado. Y el rango objetivo depende de la INDICACIÓN
//    (válvula mecánica 2.5–3.5, no 2.0–3.0), así que se declara de dónde sale.
export type AnticoagulantClass="VKA"|"DOAC"|"UNKNOWN";
export type InrIndication="AF_OR_VTE"|"MECHANICAL_VALVE"|"UNSPECIFIED";
export const INR_TARGETS:Readonly<Record<InrIndication,InrTarget>>={
 AF_OR_VTE:{low:2.0,high:3.0},
 MECHANICAL_VALVE:{low:2.5,high:3.5},
 UNSPECIFIED:{low:2.0,high:3.0},
};
export type InrOptions=Readonly<{indication?:InrIndication;anticoagulant?:AnticoagulantClass;majorBleeding?:boolean}>;
export type InrAssessment=Readonly<{inr:number;status:InrStatus;target:InrTarget;interpretation:string;
 applicable:boolean;targetSource:InrIndication;action?:string}>;
export function interpretINR(inr:number,target:InrTarget|InrOptions={low:2.0,high:3.0}):InrAssessment|undefined{
 if(!Number.isFinite(inr)||inr<=0)return undefined;
 // Compatibilidad: la firma anterior recibía el rango directamente.
 const esRango=(t:InrTarget|InrOptions):t is InrTarget=>typeof(t as InrTarget).low==="number";
 const opts:InrOptions=esRango(target)?{}:target;
 const targetSource:InrIndication=opts.indication??"UNSPECIFIED";
 const rango:InrTarget=esRango(target)?target:INR_TARGETS[targetSource];
 // F07: en un paciente con ACOD el INR NO es la prueba de monitoreo. Se informa el valor y se dice explícitamente.
 if(opts.anticoagulant==="DOAC")return{inr,status:inr>=5?"CRITICAL_HIGH":"THERAPEUTIC",target:rango,applicable:false,targetSource,
  interpretation:"El INR NO monitoriza a los anticoagulantes orales directos (rivaroxabán, apixabán, dabigatrán): un valor «en rango» no dice nada sobre el efecto anticoagulante. Si busca comprobar el efecto, la prueba depende del fármaco (anti-Xa calibrado, tiempo de trombina diluido).",
  action:"NO_INTERPRETAR_INR_CON_ACOD"};
 let status:InrStatus,interpretation:string,action:string|undefined;
 // F02: escalones de conducta de las guías CHEST (Holbrook A et al., Chest 2012;141:e152S) por tramo de INR.
 if(opts.majorBleeding===true){
  status="CRITICAL_HIGH";action="PCC_MAS_VITAMINA_K_IV";
  interpretation=`Sangrado MAYOR con INR ${inr}: revertir de inmediato con concentrado de complejo protrombínico y vitamina K 5–10 mg IV, independientemente del valor del INR.`;
 }else if(inr>10){
  status="CRITICAL_HIGH";action="VITAMINA_K_ORAL";
  interpretation=`INR >10 sin sangrado: suspender el antagonista de vitamina K y administrar vitamina K 2.5–5 mg ORAL; recontrolar en 24 h.`;
 }else if(inr>=4.5){
  status="CRITICAL_HIGH";action="OMITIR_DOSIS_Y_RECONTROLAR";
  interpretation=`INR ${inr} (4.5–10) sin sangrado: omitir una o dos dosis y recontrolar; la vitamina K de rutina NO está indicada en este tramo.`;
 }else if(inr>rango.high){
  status="SUPRATHERAPEUTIC";action="REDUCIR_DOSIS";
  interpretation=`Supraterapéutico (>${rango.high}): riesgo hemorrágico — reducir/omitir dosis y recontrolar`;
 }else if(inr<rango.low){
  status="SUBTHERAPEUTIC";action="AJUSTAR_AL_ALZA";
  interpretation=`Subterapéutico (<${rango.low}): riesgo trombótico — ajustar dosis al alza`;
 }else{
  status="THERAPEUTIC";
  interpretation=`En rango terapéutico (${rango.low}–${rango.high}${targetSource==="MECHANICAL_VALVE"?", válvula mecánica":""})`;
 }
 return{inr,status,target:rango,applicable:true,targetSource,interpretation,...(action?{action}:{})};
}
