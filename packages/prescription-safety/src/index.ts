import{resolveDrug,checkDrugAllergy,checkInteractions,checkDuplicateTherapy,checkContraindications,checkRenalDosing,renalRuleForDrug,type AllergyRecord}from"../../drug-catalog/src";
import{checkDoseCeiling,checkPediatricDose,validateMedicationOrder,PEDIATRIC_MAX_KG}from"../../medication-validation/src";
// Evaluador ÚNICO de las barreras de seguridad de una prescripción (auditoría 2026-09-19: C-03, C-04, C-14, C-16).
//
// Regla de diseño: **"no pude evaluar" nunca se presenta como "seguro"**. Antes, un fármaco fuera del catálogo
// omitía todas las barreras en silencio y la UI pintaba verde lo que nadie había verificado. Aquí cada barrera
// termina en uno de SEIS estados explícitos, y el mismo evaluador alimenta la verificación previa (dry-run) y
// la ruta de escritura (PRESCRIBE), de modo que no pueden divergir.
//
// Puro y determinista: recibe los datos del paciente ya leídos; sin E/S, sin PHI en mensajes (solo códigos).
export type BarrierId="order"|"catalog"|"allergy"|"interaction"|"duplicate"|"contraindication"|"doseCeiling"|"pediatricDose"|"renal";
export type BarrierStatus=
 |"PASSED"          // se evaluó y no hay conflicto
 |"CAUTION"         // se evaluó: requiere atención del médico, no bloquea
 |"BLOCKED"         // se evaluó: bloquea la prescripción
 |"NOT_APPLICABLE"  // la barrera no aplica a este paciente (p. ej. dosis pediátrica en un adulto)
 |"NOT_COVERED"     // el catálogo NO tiene regla para este fármaco: NO evaluado (informativo, no es "seguro")
 |"NOT_EVALUATED";  // debía evaluarse y no se pudo (fármaco fuera de catálogo, falta peso/eGFR, dosis no interpretable)
export type BarrierReason=
 "DRUG_NOT_IN_CATALOG"|"ACTIVE_DRUGS_NOT_IN_CATALOG"|"NO_RULE_IN_CATALOG"|"NO_EGFR"|"NO_WEIGHT"|"DOSE_NOT_PARSEABLE"|"ADULT_PATIENT";
export type BarrierResult=Readonly<{id:BarrierId;label:string;status:BarrierStatus;detail:string;reason?:BarrierReason}>;
export type PrescriptionSafetyInput=Readonly<{
 drugCode:string;dose:string;route:string;frequency:string;
 allergies:readonly AllergyRecord[];activeDrugCodes:readonly string[];activeConditionCodes:readonly string[];
 egfr?:number|undefined;weightKg?:number|undefined;ageYears?:number|undefined;
}>;
// BLOCK: no se puede prescribir. REVIEW: hay advertencias o barreras sin evaluar. CLEAR: todo lo evaluable pasó.
export type SafetyVerdict="BLOCK"|"REVIEW"|"CLEAR";
export type PrescriptionSafetyEvaluation=Readonly<{
 verdict:SafetyVerdict;catalogResolved:boolean;ingredient:string|null;
 requiresAcknowledgement:boolean; // el médico debe confirmar EXPLÍCITAMENTE que prescribe sin verificación automática
 notEvaluated:readonly BarrierId[];notCovered:readonly BarrierId[];unresolvedActiveDrugs:readonly string[];
 barriers:readonly BarrierResult[];
}>;
const LABEL:Record<BarrierId,string>={
 order:"Orden válida (dosis · vía · frecuencia)",catalog:"Fármaco en catálogo",allergy:"Sin conflicto de alergia",
 interaction:"Sin interacciones críticas",duplicate:"Sin duplicados terapéuticos",contraindication:"Sin contraindicaciones por diagnóstico",
 doseCeiling:"Dosis dentro del máximo",pediatricDose:"Dosis pediátrica por peso",renal:"Ajuste renal verificado (eGFR)",
};
const finite=(n:number|undefined):n is number=>typeof n==="number"&&Number.isFinite(n);
// Edad cumplida (años) en `asOf`, en UTC. undefined si alguna fecha no es válida o la edad resulta negativa.
export function ageInYears(birthDate:string,asOf:string):number|undefined{
 const b=new Date(birthDate),a=new Date(asOf);
 if(Number.isNaN(b.getTime())||Number.isNaN(a.getTime()))return undefined;
 let y=a.getUTCFullYear()-b.getUTCFullYear();
 if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;
 return y>=0?y:undefined;
}

export function evaluatePrescriptionSafety(i:PrescriptionSafetyInput):PrescriptionSafetyEvaluation{
 const out:BarrierResult[]=[];
 const push=(id:BarrierId,status:BarrierStatus,detail:string,reason?:BarrierReason)=>{out.push(reason?{id,label:LABEL[id],status,detail,reason}:{id,label:LABEL[id],status,detail});};
 const drug=resolveDrug(i.drugCode)??null;

 // 0) Formato de la orden
 const order=validateMedicationOrder({dose:i.dose,route:i.route,frequency:i.frequency});
 push("order",order.ok?"PASSED":"BLOCKED",order.ok?"Formato correcto":order.errors.join("; "));

 // 1) Catálogo: si el fármaco no se resuelve, NINGUNA barrera dependiente del catálogo puede evaluarse.
 if(!drug)push("catalog","NOT_EVALUATED","El fármaco no está en el catálogo: interacciones, duplicidad, contraindicaciones, dosis y ajuste renal NO se verificaron.","DRUG_NOT_IN_CATALOG");
 else push("catalog","PASSED",`Principio activo reconocido: ${drug.ingredient}`);

 // 2) Alergia: el cruce por NOMBRE funciona sin catálogo; la reactividad cruzada por CLASE, no.
 // Auditoría C-06: gravedad y tipo de coincidencia deciden. GRAVE (o reacción anafiláctica) bloquea; una intolerancia leve o
 // una reactividad cruzada moderada exigen la confirmación expresa del médico (CAUTION con acknowledgement), no bloquean.
 const al=checkDrugAllergy(i.drugCode,i.allergies);
 if(al.blocked)push("allergy","BLOCKED",al.detail??`Alergia activa a ${al.allergen}`);
 else if(al.caution)push("allergy","CAUTION",`${al.detail??`Antecedente con ${al.allergen}`}. Prescribir exige confirmación expresa.`);
 else if(!al.classEvaluated)push("allergy","NOT_EVALUATED","Sin coincidencia por nombre; la reactividad cruzada por clase NO se pudo evaluar (fármaco fuera de catálogo).","DRUG_NOT_IN_CATALOG");
 else push("allergy","PASSED","Sin alergias en conflicto");

 // 3) Interacción farmacológica
 // Auditoría C-17: tabla única; el factor "adulto mayor" (≥65) entra en la barrera como precaución (criterios de Beers).
 const factors:("ELDERLY")[]=i.ageYears!==undefined&&i.ageYears>=65?["ELDERLY"]:[];
 const ix=checkInteractions(i.drugCode,i.activeDrugCodes,factors);
 const factorNote=ix.factorHits?.filter(f=>f.severity!=="MINOR").map(f=>f.note).join(" · ");
 if(!ix.evaluated)push("interaction","NOT_EVALUATED","Interacciones NO evaluadas (fármaco fuera de catálogo).","DRUG_NOT_IN_CATALOG");
 else if(ix.found)push("interaction",ix.severity==="MAJOR"?"BLOCKED":"CAUTION",`${ix.note} (con ${ix.conflictDrug})${factorNote?` · ${factorNote}`:""}`);
 else if(ix.unresolvedActive.length>0)push("interaction","NOT_EVALUATED",`Sin interacción con los fármacos reconocidos; ${ix.unresolvedActive.length} fármaco(s) activo(s) fuera de catálogo NO se evaluaron.`,"ACTIVE_DRUGS_NOT_IN_CATALOG");
 else if(factorNote)push("interaction","CAUTION",factorNote);
 else push("interaction","PASSED","Sin interacciones detectadas");

 // 4) Duplicidad terapéutica (misma regla que bloquea en la escritura: ya no divergen dry-run y PRESCRIBE)
 const dup=checkDuplicateTherapy(i.drugCode,i.activeDrugCodes);
 if(!dup.evaluated)push("duplicate","NOT_EVALUATED","Duplicidad NO evaluada (fármaco fuera de catálogo).","DRUG_NOT_IN_CATALOG");
 else if(dup.duplicate)push("duplicate","BLOCKED",`Duplica la clase ${dup.sharedClass} (ya activo: ${dup.conflictDrug})`);
 else push("duplicate","PASSED","Sin duplicados de clase");

 // 5) Contraindicación por diagnóstico activo
 const ci=checkContraindications(i.drugCode,i.activeConditionCodes);
 if(!ci.evaluated)push("contraindication","NOT_EVALUATED","Contraindicaciones NO evaluadas (fármaco fuera de catálogo).","DRUG_NOT_IN_CATALOG");
 else if(ci.found)push("contraindication",ci.severity==="MAJOR"?"BLOCKED":"CAUTION",`${ci.note} (${ci.condition})`);
 else push("contraindication","PASSED","Sin contraindicaciones");

 // 6) Dosis-techo absoluta (mg/día)
 if(!drug)push("doseCeiling","NOT_EVALUATED","Dosis máxima NO evaluada (fármaco fuera de catálogo).","DRUG_NOT_IN_CATALOG");
 else{const dc=checkDoseCeiling(drug.ingredient,i.dose,i.frequency);
  if(dc.checked)push("doseCeiling",dc.exceeded?"BLOCKED":"PASSED",dc.exceeded?`${dc.computedMgPerDay} mg/día excede el máximo ${dc.maxMgPerDay} mg/día`:`${dc.computedMgPerDay} mg/día · dentro del máximo ${dc.maxMgPerDay} mg/día`);
  else if(dc.maxMgPerDay===undefined)push("doseCeiling","NOT_COVERED","El catálogo no tiene dosis máxima para este fármaco: NO evaluada.","NO_RULE_IN_CATALOG");
  else push("doseCeiling","NOT_EVALUATED",`Dosis o frecuencia no interpretables (p. ej. "tab", "PRN"): máximo ${dc.maxMgPerDay} mg/día NO verificado.`,"DOSE_NOT_PARSEABLE");}

 // 7) Dosis pediátrica por peso (mg/kg/día). El techo absoluto NO protege a un niño.
 const adult=finite(i.ageYears)&&i.ageYears>=18;const w=finite(i.weightKg)&&i.weightKg>0?i.weightKg:undefined;
 if(w!==undefined&&w>PEDIATRIC_MAX_KG)push("pediatricDose","NOT_APPLICABLE",`Peso ${w} kg > ${PEDIATRIC_MAX_KG} kg: gobierna la dosis máxima absoluta`,"ADULT_PATIENT");
 else if(w===undefined&&adult)push("pediatricDose","NOT_APPLICABLE","Paciente adulto","ADULT_PATIENT");
 else if(!drug)push("pediatricDose","NOT_EVALUATED","Dosis por peso NO evaluada (fármaco fuera de catálogo).","DRUG_NOT_IN_CATALOG");
 else if(w===undefined)push("pediatricDose","NOT_EVALUATED","Paciente menor de edad (o edad desconocida) SIN peso registrado: dosis por kg NO verificada. Registre el peso.","NO_WEIGHT");
 else{const pd=checkPediatricDose(drug.ingredient,i.dose,i.frequency,w);
  if(pd.checked)push("pediatricDose",pd.exceeded?"BLOCKED":"PASSED",pd.exceeded?`${pd.computedMgPerKgPerDay} mg/kg/día excede el máximo ${pd.maxMgPerKgPerDay} mg/kg/día (peso ${w} kg)`:`${pd.computedMgPerKgPerDay} mg/kg/día · dentro del máximo ${pd.maxMgPerKgPerDay} (peso ${w} kg)`);
  else if(pd.maxMgPerKgPerDay===undefined)push("pediatricDose","NOT_COVERED","El catálogo no tiene máximo pediátrico (mg/kg/día) para este fármaco: NO evaluado.","NO_RULE_IN_CATALOG");
  else push("pediatricDose","NOT_EVALUATED","Dosis o frecuencia no interpretables: máximo pediátrico NO verificado.","DOSE_NOT_PARSEABLE");}

 // 8) Ajuste renal por eGFR medido
 if(!drug)push("renal","NOT_EVALUATED","Ajuste renal NO evaluado (fármaco fuera de catálogo).","DRUG_NOT_IN_CATALOG");
 else if(!renalRuleForDrug(i.drugCode))push("renal","NOT_COVERED","El catálogo no tiene regla renal para este fármaco: NO evaluado.","NO_RULE_IN_CATALOG");
 else if(!finite(i.egfr))push("renal","NOT_EVALUATED","Este fármaco exige ajuste renal y el paciente NO tiene eGFR disponible.","NO_EGFR");
 else{const rn=checkRenalDosing(i.drugCode,i.egfr);
  push("renal",rn.action==="BLOCK"?"BLOCKED":rn.action==="CAUTION"?"CAUTION":"PASSED",`${rn.action==="OK"?"Función renal suficiente":rn.note??""} (eGFR ${i.egfr})`);}

 const ids=(s:BarrierStatus)=>out.filter(b=>b.status===s).map(b=>b.id);
 const notEvaluated=ids("NOT_EVALUATED"),notCovered=ids("NOT_COVERED");
 const verdict:SafetyVerdict=out.some(b=>b.status==="BLOCKED")?"BLOCK":(out.some(b=>b.status==="CAUTION")||notEvaluated.length>0)?"REVIEW":"CLEAR";
 // Confirmación expresa: barreras NO evaluadas, o una alergia documentada (leve / cruzada) que no bloquea pero no se ignora.
 const allergyCaution=out.some(b=>b.id==="allergy"&&b.status==="CAUTION");
 return{verdict,catalogResolved:!!drug,ingredient:drug?.ingredient??null,requiresAcknowledgement:notEvaluated.length>0||allergyCaution,
  notEvaluated,notCovered,unresolvedActiveDrugs:ix.unresolvedActive,barriers:out};
}
// Resumen compacto y SIN PHI para persistir en el evento MEDICATION_PRESCRIBED: deja constancia inmutable de
// qué barreras se evaluaron, cuáles no, y si el médico aceptó explícitamente prescribir sin verificación.
export type PersistedSafetySummary=Readonly<{verdict:SafetyVerdict;catalogResolved:boolean;barriers:readonly Readonly<{id:BarrierId;status:BarrierStatus;reason?:BarrierReason}>[];acknowledgedUnverified:boolean;justification?:string}>;
export function summarizeForEvent(e:PrescriptionSafetyEvaluation,ack:{acknowledged:boolean;justification?:string|undefined}):PersistedSafetySummary{
 const barriers=e.barriers.map(b=>b.reason?{id:b.id,status:b.status,reason:b.reason}:{id:b.id,status:b.status});
 return{verdict:e.verdict,catalogResolved:e.catalogResolved,barriers,acknowledgedUnverified:ack.acknowledged,...(ack.justification?{justification:ack.justification}:{})};
}
