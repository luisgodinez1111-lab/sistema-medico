import{resolveDrug,checkDrugAllergy,checkInteractions,checkDuplicateTherapy,checkContraindications,checkRenalDosing,renalRuleForDrug,unitStrengthFromCatalog,type AllergyRecord,type PatientFactor}from"../../drug-catalog/src";
import{checkDoseCeiling,checkPediatricDose,checkDurationLimit,validateMedicationOrder,unitStrengthMg,PEDIATRIC_MAX_KG}from"../../medication-validation/src";
// Evaluador ÚNICO de las barreras de seguridad de una prescripción (auditoría 2026-09-19: C-03, C-04, C-14, C-16).
//
// Regla de diseño: **"no pude evaluar" nunca se presenta como "seguro"**. Antes, un fármaco fuera del catálogo
// omitía todas las barreras en silencio y la UI pintaba verde lo que nadie había verificado. Aquí cada barrera
// termina en uno de SEIS estados explícitos, y el mismo evaluador alimenta la verificación previa (dry-run) y
// la ruta de escritura (PRESCRIBE), de modo que no pueden divergir.
//
// Puro y determinista: recibe los datos del paciente ya leídos; sin E/S, sin PHI en mensajes (solo códigos).
export type BarrierId="order"|"catalog"|"allergy"|"interaction"|"duplicate"|"contraindication"|"doseCeiling"|"duration"|"pediatricDose"|"renal";
export type BarrierStatus=
 |"PASSED"          // se evaluó y no hay conflicto
 |"CAUTION"         // se evaluó: requiere atención del médico, no bloquea
 |"BLOCKED"         // se evaluó: bloquea la prescripción
 |"NOT_APPLICABLE"  // la barrera no aplica a este paciente (p. ej. dosis pediátrica en un adulto)
 |"NOT_COVERED"     // el catálogo NO tiene regla para este fármaco: NO evaluado (informativo, no es "seguro")
 |"NOT_EVALUATED";  // debía evaluarse y no se pudo (fármaco fuera de catálogo, falta peso/eGFR, dosis no interpretable)
export type BarrierReason=
 "DRUG_NOT_IN_CATALOG"|"ACTIVE_DRUGS_NOT_IN_CATALOG"|"NO_RULE_IN_CATALOG"|"NO_EGFR"|"NO_WEIGHT"|"WEIGHT_REQUIRED"|"NO_DURATION"|"DOSE_NOT_PARSEABLE"|"ADULT_PATIENT";
// Auditoría 2026-09-19, anexo R09 (R09-034) — EL VOCABULARIO, EN TIEMPO DE EJECUCIÓN.
//
// Estos tres vocabularios son lo que el sistema le MUESTRA a un médico, y hasta ahora solo existían como tipos: medibles
// por el compilador, invisibles para una prueba. El manual del clínico (`docs/manual-clinico.md`) tiene que explicar cada
// uno, y la única forma de garantizar que no se queda corto cuando alguien añade un estado es comprobarlo contra una
// LISTA, no contra una copia escrita a mano. `satisfies` ata cada lista a su tipo: si el tipo gana un miembro y la lista
// no, el compilador avisa aquí; si la lista gana uno y el manual no lo explica, falla la prueba del manual.
export const BARRIER_STATUSES=["PASSED","CAUTION","BLOCKED","NOT_APPLICABLE","NOT_COVERED","NOT_EVALUATED"] as const satisfies readonly BarrierStatus[];
export const BARRIER_REASONS=["DRUG_NOT_IN_CATALOG","ACTIVE_DRUGS_NOT_IN_CATALOG","NO_RULE_IN_CATALOG","NO_EGFR","NO_WEIGHT","WEIGHT_REQUIRED","NO_DURATION","DOSE_NOT_PARSEABLE","ADULT_PATIENT"] as const satisfies readonly BarrierReason[];
export type BarrierResult=Readonly<{id:BarrierId;label:string;status:BarrierStatus;detail:string;reason?:BarrierReason;overridable:boolean}>;
// Auditoría 2026-09-19 (U-19): un BLOQUEO no es siempre una negación absoluta. Hay bloqueos que la práctica clínica anula
// bajo criterio y responsabilidad del médico (alergia documentada sin alternativa, interacción mayor con monitorización,
// duplicidad intencional, contraindicación relativa, ajuste renal en diálisis…) y bloqueos que este sistema NUNCA anula
// porque no existe escenario clínico que los justifique: una orden mal formada y una dosis por encima del techo diario
// absoluto o del máximo pediátrico por peso (ahí lo que procede es corregir la dosis). La anulación exige nombrar CADA
// barrera anulada y una justificación clínica, y queda inmutable en el evento (ver `summarizeForEvent`).
export const OVERRIDABLE_BARRIERS=["allergy","interaction","duplicate","contraindication","renal"] as const satisfies readonly BarrierId[];
// R03-26/R03-27: exceder la duración máxima y prescribir por kg sin peso son bloqueos DUROS (se corrige la orden o
// se registra el peso), no avisos que se confirman.
export const HARD_BARRIERS=["order","catalog","doseCeiling","duration","pediatricDose"] as const satisfies readonly BarrierId[];
export const isOverridable=(id:BarrierId):boolean=>(OVERRIDABLE_BARRIERS as readonly BarrierId[]).includes(id);
export const OVERRIDE_MIN_JUSTIFICATION=20;
export type PrescriptionSafetyInput=Readonly<{
 drugCode:string;dose:string;route:string;frequency:string;
 allergies:readonly AllergyRecord[];activeDrugCodes:readonly string[];activeConditionCodes:readonly string[];
 egfr?:number|undefined;weightKg?:number|undefined;ageYears?:number|undefined;
 // R03-26: duración prescrita en días (ketorolaco máximo 5, metamizol 7). Sin ella, la barrera de duración queda sin evaluar.
 durationDays?:number|undefined;
 // R03-29: factores del paciente (EMBARAZO, LACTANCIA, alcohol, insuficiencia renal/hepática) que activan las reglas
 // fármaco–factor del catálogo. Se DERIVAN del expediente (lista de problemas activos) en la capa HTTP: hasta ahora
 // `checkInteractions` los aceptaba y nadie se los pasaba, así que las reglas del embarazo no se activaban nunca.
 patientFactors?:readonly PatientFactor[]|undefined;
}>;
// BLOCK: no se puede prescribir. REVIEW: hay advertencias o barreras sin evaluar. CLEAR: todo lo evaluable pasó.
export type SafetyVerdict="BLOCK"|"REVIEW"|"CLEAR";
export const SAFETY_VERDICTS=["BLOCK","REVIEW","CLEAR"] as const satisfies readonly SafetyVerdict[];
export type PrescriptionSafetyEvaluation=Readonly<{
 verdict:SafetyVerdict;catalogResolved:boolean;ingredient:string|null;
 requiresAcknowledgement:boolean; // el médico debe confirmar EXPLÍCITAMENTE que prescribe sin verificación automática
 notEvaluated:readonly BarrierId[];notCovered:readonly BarrierId[];unresolvedActiveDrugs:readonly string[];
 blockedOverridable:readonly BarrierId[]; // bloqueos que el médico PUEDE anular con justificación (U-19)
 blockedHard:readonly BarrierId[];        // bloqueos que NO admiten anulación: hay que corregir la orden
 barriers:readonly BarrierResult[];
}>;
const LABEL:Record<BarrierId,string>={
 order:"Orden válida (dosis · vía · frecuencia)",catalog:"Fármaco en catálogo",allergy:"Sin conflicto de alergia",
 interaction:"Sin interacciones críticas",duplicate:"Sin duplicados terapéuticos",contraindication:"Sin contraindicaciones por diagnóstico",
 doseCeiling:"Dosis dentro del máximo",duration:"Duración dentro del máximo",pediatricDose:"Dosis pediátrica por peso",renal:"Ajuste renal verificado (eGFR)",
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
 const push=(id:BarrierId,status:BarrierStatus,detail:string,reason?:BarrierReason)=>{const overridable=isOverridable(id);out.push(reason?{id,label:LABEL[id],status,detail,reason,overridable}:{id,label:LABEL[id],status,detail,overridable});};
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
 // R03-29: ELDERLY se deriva de la edad y el resto (EMBARAZO, LACTANCIA…) viene del expediente. Sin duplicar: si quien
 // llama ya declaró ELDERLY, no se añade dos veces.
 const declarados=i.patientFactors??[];
 const factors:PatientFactor[]=[...declarados,...(i.ageYears!==undefined&&i.ageYears>=65&&!declarados.includes("ELDERLY")?["ELDERLY" as PatientFactor]:[])];
 const ix=checkInteractions(i.drugCode,i.activeDrugCodes,factors);
 const factorHits=ix.factorHits??[];
 const factorNote=factorHits.filter(f=>f.severity!=="MINOR").map(f=>f.note).join(" · ");
 // Un fármaco CONTRAINDICADO por un factor del paciente (IECA o estatina en el embarazo, tramadol en lactancia) bloquea
 // la prescripción por sí solo, sin depender de que además haya una interacción con otro fármaco activo.
 const factorBloqueante=factorHits.find(f=>f.severity==="CONTRAINDICATED")??factorHits.find(f=>f.severity==="MAJOR");
 if(!ix.evaluated)push("interaction","NOT_EVALUATED","Interacciones NO evaluadas (fármaco fuera de catálogo).","DRUG_NOT_IN_CATALOG");
 else if(factorBloqueante!==undefined&&!(ix.found&&ix.severity==="MAJOR"))push("interaction","BLOCKED",`${factorBloqueante.note}${ix.found?` · ${ix.note} (con ${ix.conflictDrug})`:""}`);
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
 else{
  // R03-F11: la concentración de «1 tab» se resuelve contra las PRESENTACIONES del catálogo, no contra el sufijo del código.
  const st=unitStrengthFromCatalog(i.drugCode,unitStrengthMg(i.drugCode));
  const dc=checkDoseCeiling(drug.ingredient,i.dose,i.frequency,i.drugCode,{...(i.route?{route:i.route}:{}),...(finite(i.ageYears)?{ageYears:i.ageYears}:{}),unitStrengthMg:st.strengthMg}); // C-15: "2 tab" se acota con la concentración del código · R03-26: el techo depende de la VÍA y de la EDAD
  if(dc.checked)push("doseCeiling",dc.exceeded?"BLOCKED":"PASSED",`${dc.exceeded?`${dc.computedMgPerDay} mg/día excede el máximo ${dc.maxMgPerDay} mg/día`:`${dc.computedMgPerDay} mg/día · dentro del máximo ${dc.maxMgPerDay} mg/día`}${dc.derivedFromUnits?" (mg calculados a partir de la concentración del código)":""}${dc.ceilingNote?` · ${dc.ceilingNote}`:""}`);
  else if(dc.noCeiling)push("doseCeiling","NOT_APPLICABLE","Sin tope diario fijo: se dosifica por objetivo terapéutico o vía hospitalaria (revisado)");
  else if(dc.maxMgPerDay===undefined)push("doseCeiling","NOT_COVERED","El catálogo no tiene dosis máxima para este fármaco: NO evaluada.","NO_RULE_IN_CATALOG");
  else push("doseCeiling","NOT_EVALUATED",`Dosis o frecuencia no interpretables (p. ej. "tab", "PRN"): máximo ${dc.maxMgPerDay} mg/día NO verificado.`,"DOSE_NOT_PARSEABLE");}

 // 6b) DURACIÓN del tratamiento (R03-26): un techo diario correcto no dice nada sobre un ketorolaco indefinido.
 if(!drug)push("duration","NOT_EVALUATED","Duración máxima NO evaluada (fármaco fuera de catálogo).","DRUG_NOT_IN_CATALOG");
 else{const dur=checkDurationLimit(drug.ingredient,i.durationDays);
  if(dur.evaluable)push("duration",dur.exceeded?"BLOCKED":"PASSED",dur.exceeded?`${dur.days} días excede el máximo de ${dur.maxDays}: ${dur.reason}`:`${dur.days} días · dentro del máximo de ${dur.maxDays}`);
  else if(dur.maxDays!==undefined)push("duration","NOT_EVALUATED",`Este fármaco tiene duración máxima (${dur.maxDays} días: ${dur.reason}) y la orden NO declara duración.`,"NO_DURATION");
  else push("duration","NOT_APPLICABLE","El catálogo no limita la duración de este fármaco");}

 // 7) Dosis pediátrica por peso (mg/kg/día). El techo absoluto NO protege a un niño.
 // R03-27: «pediátrico» lo define la EDAD (<18), no el peso. Antes, un adolescente de 45 kg quedaba fuera de toda
 // verificación por peso solo por pasar de 40 kg, y el techo absoluto del adulto no protege a un niño de 12.
 const adult=finite(i.ageYears)&&i.ageYears>=18;const w=finite(i.weightKg)&&i.weightKg>0?i.weightKg:undefined;
 const menor=finite(i.ageYears)&&i.ageYears<18;
 // Un adulto con peso normal no pasa por aquí; uno de 30 kg SÍ (el techo absoluto no protege a quien pesa 30 kg).
 if(adult&&w!==undefined&&w>PEDIATRIC_MAX_KG)push("pediatricDose","NOT_APPLICABLE",`Paciente adulto de ${w} kg: gobierna la dosis máxima absoluta`,"ADULT_PATIENT");
 else if(adult&&w===undefined)push("pediatricDose","NOT_APPLICABLE","Paciente adulto: gobierna la dosis máxima absoluta","ADULT_PATIENT");
 else if(!menor&&!adult&&w!==undefined&&w>PEDIATRIC_MAX_KG)push("pediatricDose","NOT_APPLICABLE",`Sin edad registrada y peso ${w} kg > ${PEDIATRIC_MAX_KG} kg: gobierna la dosis máxima absoluta`,"ADULT_PATIENT");
 else if(!drug)push("pediatricDose","NOT_EVALUATED","Dosis por peso NO evaluada (fármaco fuera de catálogo).","DRUG_NOT_IN_CATALOG");
 else if(!menor&&w===undefined)push("pediatricDose","NOT_EVALUATED","Sin edad ni peso registrados: la dosificación por kg NO se pudo verificar.","NO_WEIGHT");
 else{const pd=checkPediatricDose(drug.ingredient,i.dose,i.frequency,w,finite(i.ageYears)?i.ageYears:undefined);
  // R03-27: menor + fármaco con máximo por kg + SIN peso = BLOQUEO DURO. Es el patrón clásico de la sobredosis
  // pediátrica letal, y antes salía como «no evaluado»: un aviso que se confirma y se sigue.
  if(pd.weightRequired){push("pediatricDose","BLOCKED",`Paciente pediátrico (${finite(i.ageYears)?`${i.ageYears} años`:"menor de edad"}) SIN peso registrado: la dosis de ${drug.ingredient} se calcula por kg y no puede verificarse. Registre el peso para prescribir.`,"WEIGHT_REQUIRED");}
  else{
  if(pd.checked)push("pediatricDose",pd.exceeded?"BLOCKED":"PASSED",pd.exceeded?(pd.boundedBy==="absolute"?`${pd.computedMgPerDay} mg/día excede el máximo absoluto ${pd.absoluteMaxMgPerDay} mg/día (peso ${w} kg)`:`${pd.computedMgPerKgPerDay} mg/kg/día excede el máximo ${pd.maxMgPerKgPerDay} mg/kg/día (peso ${w} kg)`):`${pd.computedMgPerKgPerDay} mg/kg/día · dentro del máximo ${pd.maxMgPerKgPerDay} (peso ${w} kg)`);
  else if(pd.maxMgPerKgPerDay===undefined)push("pediatricDose","NOT_COVERED","El catálogo no tiene máximo pediátrico (mg/kg/día) para este fármaco: NO evaluado.","NO_RULE_IN_CATALOG");
  else push("pediatricDose","NOT_EVALUATED","Dosis o frecuencia no interpretables: máximo pediátrico NO verificado.","DOSE_NOT_PARSEABLE");}}

 // 8) Ajuste renal por eGFR medido
 if(!drug)push("renal","NOT_EVALUATED","Ajuste renal NO evaluado (fármaco fuera de catálogo).","DRUG_NOT_IN_CATALOG");
 else if(!renalRuleForDrug(i.drugCode))push("renal","NOT_COVERED","El catálogo no tiene regla renal para este fármaco: NO evaluado.","NO_RULE_IN_CATALOG");
 else if(!finite(i.egfr))push("renal","NOT_EVALUATED","Este fármaco exige ajuste renal y el paciente NO tiene eGFR disponible.","NO_EGFR");
 else{const rn=checkRenalDosing(i.drugCode,i.egfr);
  push("renal",rn.action==="BLOCK"?"BLOCKED":rn.action==="CAUTION"?"CAUTION":"PASSED",`${rn.action==="OK"?"Función renal suficiente":rn.note??""} (eGFR ${i.egfr})`);}

 const ids=(s:BarrierStatus)=>out.filter(b=>b.status===s).map(b=>b.id);
 const notEvaluated=ids("NOT_EVALUATED"),notCovered=ids("NOT_COVERED");
 // Auditoría R02a-MED-03: `NOT_COVERED` (el catálogo no tiene regla para este fármaco) entra en el veredicto REVIEW
 // igual que `NOT_EVALUATED`. Antes solo era informativo: la barrera aparecía en la lista pero el veredicto podía ser
 // CLEAR, y «no hay regla» se leía como «está bien». No evaluado nunca es seguro.
 const verdict:SafetyVerdict=out.some(b=>b.status==="BLOCKED")?"BLOCK":(out.some(b=>b.status==="CAUTION")||notEvaluated.length>0||notCovered.length>0)?"REVIEW":"CLEAR";
 // Confirmación expresa: barreras NO evaluadas o SIN REGLA en el catálogo, o una alergia documentada (leve / cruzada)
 // que no bloquea pero no se ignora. R02a-MED-03: sin esto, prescribir un fármaco sin techo de dosis conocido no pedía
 // ninguna confirmación al médico, que es precisamente el caso en que su criterio es el único control que queda.
 const allergyCaution=out.some(b=>b.id==="allergy"&&b.status==="CAUTION");
 const blocked=ids("BLOCKED");
 return{verdict,catalogResolved:!!drug,ingredient:drug?.ingredient??null,requiresAcknowledgement:notEvaluated.length>0||notCovered.length>0||allergyCaution,
  notEvaluated,notCovered,unresolvedActiveDrugs:ix.unresolvedActive,
  blockedOverridable:blocked.filter(isOverridable),blockedHard:blocked.filter(id=>!isOverridable(id)),barriers:out};
}
// ---------- Anulación justificada de un bloqueo (U-19) ----------
// El cliente debe NOMBRAR cada barrera que anula (no hay "anular todo") y dar una justificación clínica. Decisión pura:
//  · HARD_BLOCK: hay un bloqueo no anulable -> corregir la orden; ninguna justificación lo levanta.
//  · OVERRIDE_REQUIRED: hay bloqueos anulables y falta nombrar alguno (o no se pidió anulación).
//  · OVERRIDE_NOT_BLOCKED: se nombra una barrera que hoy NO bloquea (una anulación "por si acaso" no se registra).
//  · JUSTIFICATION_TOO_SHORT: la justificación no alcanza el mínimo.
//  · ok: `override` describe exactamente lo anulado (o null si no había nada que anular).
export type OverrideRequest=Readonly<{barriers:readonly BarrierId[];justification:string}>;
export type SafetyOverride=Readonly<{barriers:readonly BarrierId[];justification:string}>;
export type OverrideDecision=
 |Readonly<{ok:true;override:SafetyOverride|null}>
 |Readonly<{ok:false;code:"HARD_BLOCK"|"OVERRIDE_REQUIRED"|"OVERRIDE_NOT_BLOCKED"|"JUSTIFICATION_TOO_SHORT";blocked:readonly BarrierId[];hard:readonly BarrierId[];overridable:readonly BarrierId[];unmatched:readonly BarrierId[]}>;
export function decideOverride(e:PrescriptionSafetyEvaluation,req:OverrideRequest|undefined):OverrideDecision{
 // La barrera `order` se valida antes (400 VALIDATION_ERROR) y no entra en el juicio de seguridad.
 const blocked=e.barriers.filter(b=>b.status==="BLOCKED"&&b.id!=="order").map(b=>b.id);
 const hard=blocked.filter(id=>!isOverridable(id));
 const overridable=blocked.filter(isOverridable);
 const fail=(code:Exclude<OverrideDecision,{ok:true}>["code"],unmatched:readonly BarrierId[]=[]):OverrideDecision=>({ok:false,code,blocked,hard,overridable,unmatched});
 if(hard.length>0)return fail("HARD_BLOCK");
 const named=[...new Set(req?.barriers??[])];
 const notBlocking=named.filter(id=>!overridable.includes(id));
 if(notBlocking.length>0)return fail("OVERRIDE_NOT_BLOCKED",notBlocking);
 if(overridable.length===0)return{ok:true,override:null};
 const missing=overridable.filter(id=>!named.includes(id));
 if(req===undefined||missing.length>0)return fail("OVERRIDE_REQUIRED",missing);
 const justification=req.justification.trim();
 if(justification.length<OVERRIDE_MIN_JUSTIFICATION)return fail("JUSTIFICATION_TOO_SHORT");
 return{ok:true,override:{barriers:[...overridable],justification}};
}
// Resumen compacto y SIN PHI para persistir en el evento MEDICATION_PRESCRIBED: deja constancia inmutable de
// qué barreras se evaluaron, cuáles no, y si el médico aceptó explícitamente prescribir sin verificación.
// `override` (U-19): qué bloqueos anuló el médico, con qué justificación y quién (sub del prescriptor).
export type PersistedSafetySummary=Readonly<{verdict:SafetyVerdict;catalogResolved:boolean;barriers:readonly Readonly<{id:BarrierId;status:BarrierStatus;reason?:BarrierReason}>[];acknowledgedUnverified:boolean;justification?:string;
 override?:Readonly<{barriers:readonly BarrierId[];justification:string;by:string}>}>;
export function summarizeForEvent(e:PrescriptionSafetyEvaluation,ack:{acknowledged:boolean;justification?:string|undefined},override?:Readonly<{override:SafetyOverride|null;by:string}>):PersistedSafetySummary{
 const barriers=e.barriers.map(b=>b.reason?{id:b.id,status:b.status,reason:b.reason}:{id:b.id,status:b.status});
 return{verdict:e.verdict,catalogResolved:e.catalogResolved,barriers,acknowledgedUnverified:ack.acknowledged,...(ack.justification?{justification:ack.justification}:{}),
  ...(override?.override?{override:{barriers:override.override.barriers,justification:override.override.justification,by:override.by}}:{})};
}
