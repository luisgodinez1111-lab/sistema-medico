// EPIC AA — Motor de "care gaps" / worklist clínico. Proyección PURA sobre el timeline del paciente
// que computa pendientes accionables y priorizados a través de TODOS los verticales. Basado en REGLAS
// deterministas (NO IA — no toca el copiloto R6 en pausa). Sin PHI: solo tipo/estado/etiqueta.
// Autoridad: PROD (care gaps / Clinical Intelligence rules), CAP-CAREGAPS-001.
// `status` es opcional: lo aportan los agregados que lo computan (p. ej. VitalSign -> NORMAL/ABNORMAL/CRITICAL).
export type TimelineLike=Readonly<{aggregateType:string;aggregateId:string;latestKind:string;status?:string}>;
export type GapPriority="HIGH"|"MEDIUM"|"LOW";
export type CareGap=Readonly<{aggregateType:string;aggregateId:string;code:string;label:string;priority:GapPriority}>;
const RANK:Record<GapPriority,number>={HIGH:0,MEDIUM:1,LOW:2};
// Cada regla: dado el último evento de un agregado, ¿genera un pendiente accionable?
type Rule=(it:TimelineLike)=>Omit<CareGap,"aggregateType"|"aggregateId">|null;
const RULES:Record<string,Rule>={
 // Auditoría C-20: un resultado CRÍTICO sin cerrar es pendiente en CUALQUIER estado no terminal, incluido el recién recibido que nadie
 // ha visto (antes solo contaba ACTIONED). `status` lo aporta el evento (CRITICAL). Un resultado no crítico no genera pendiente.
 DiagnosticResult:it=>it.latestKind!=="CLOSED"&&(it.status==="CRITICAL"||it.latestKind==="ACTIONED")?{code:"CRITICAL_RESULT_OPEN",label:it.latestKind==="RECEIVED"?"Resultado crítico recibido y aún no revisado":it.latestKind==="VERIFIED"?"Resultado crítico verificado sin acción registrada":"Resultado crítico requiere cierre de seguimiento",priority:"HIGH"}:null,
 ClinicalObligation:it=>(it.latestKind!=="COMPLETED"&&it.latestKind!=="CANCELLED")?{code:"FOLLOWUP_OPEN",label:"Obligación de seguimiento abierta (Zero Lost Follow-Up)",priority:"HIGH"}:null,
 Consent:it=>it.latestKind==="PRESENTED"?{code:"CONSENT_PENDING_SIGNATURE",label:"Consentimiento presentado, pendiente de firma",priority:"MEDIUM"}:null,
 Immunization:it=>it.latestKind==="DUE"?{code:"IMMUNIZATION_DUE",label:"Vacuna indicada, pendiente de aplicar",priority:"MEDIUM"}:null,
 CarePlan:it=>it.latestKind==="HELD"?{code:"CAREPLAN_ON_HOLD",label:"Meta de cuidados en pausa, requiere revisión",priority:"MEDIUM"}:null,
 Referral:it=>it.latestKind==="REQUESTED"?{code:"REFERRAL_UNACCEPTED",label:"Interconsulta solicitada, sin aceptar",priority:"LOW"}:null,
 Appointment:it=>it.latestKind==="NO_SHOW"?{code:"APPOINTMENT_NO_SHOW",label:"Cita perdida (no-show), reagendar",priority:"LOW"}:null,
 Claim:it=>it.latestKind==="REJECTED"?{code:"CLAIM_REJECTED",label:"Reclamación rechazada, requiere reenvío",priority:"LOW"}:null,
 Specimen:it=>it.latestKind==="REJECTED"?{code:"SPECIMEN_REJECTED",label:"Muestra rechazada por laboratorio, requiere recolección",priority:"HIGH"}:null,
 Incident:it=>(it.latestKind==="REPORTED"||it.latestKind==="REVIEW_STARTED"||it.latestKind==="ESCALATED")?{code:"SAFETY_INCIDENT_OPEN",label:"Incidente de seguridad del paciente abierto",priority:"HIGH"}:null,
 Triage:it=>(it.latestKind==="ARRIVED"||it.latestKind==="TRIAGE_STARTED")?{code:"TRIAGE_PENDING",label:"Paciente en sala de espera sin triage completado",priority:"HIGH"}:null,
 Transfusion:it=>it.latestKind==="REACTION"?{code:"TRANSFUSION_REACTION",label:"Reacción transfusional, requiere seguimiento y notificación (hemovigilancia)",priority:"HIGH"}:null,
 Dialysis:it=>it.latestKind==="INTERRUPTED"?{code:"DIALYSIS_INTERRUPTED",label:"Sesión de diálisis interrumpida por complicación, requiere resolución",priority:"HIGH"}:null,
 // Un signo vital CRÍTICO vigente (no corregido/anulado) es un pendiente accionable de alta prioridad.
 VitalSign:it=>((it.latestKind==="RECORDED"||it.latestKind==="AMENDED")&&it.status==="CRITICAL")?{code:"VITAL_CRITICAL",label:"Signo vital crítico sin atender",priority:"HIGH"}:null,
};
export function computeCareGaps(items:readonly TimelineLike[]):CareGap[]{
 const gaps:CareGap[]=[];
 for(const it of items){
  const rule=RULES[it.aggregateType];if(!rule)continue;
  const g=rule(it);if(g)gaps.push({aggregateType:it.aggregateType,aggregateId:it.aggregateId,...g});
 }
 // Orden: prioridad (HIGH->LOW) y luego por tipo, determinista.
 return gaps.sort((a,b)=>RANK[a.priority]-RANK[b.priority]||a.aggregateType.localeCompare(b.aggregateType));
}

// EPIC AC — Worklist poblacional / panel del clínico: los mismos pendientes accionables pero a través
// de TODOS los pacientes del tenant. Cada fila lleva su patientId; se prioriza HIGH->LOW y luego por
// paciente/agregado para un recorrido estable del panel. Sigue siendo PURO y determinista.
export type PanelRow=TimelineLike&Readonly<{patientId:string}>;
export type PanelGap=CareGap&Readonly<{patientId:string}>;
export function computePanelWorklist(rows:readonly PanelRow[]):PanelGap[]{
 const gaps:PanelGap[]=[];
 for(const it of rows){
  const rule=RULES[it.aggregateType];if(!rule)continue;
  const g=rule(it);if(g)gaps.push({patientId:it.patientId,aggregateType:it.aggregateType,aggregateId:it.aggregateId,...g});
 }
 return gaps.sort((a,b)=>RANK[a.priority]-RANK[b.priority]||a.patientId.localeCompare(b.patientId)||a.aggregateType.localeCompare(b.aggregateType));
}

// ---------- Auditoría 2026-09-19 (C-20): BRECHAS DE CUIDADO PREVENTIVO ----------
// Las reglas anteriores son estados de flujo (consentimiento sin firmar, cita perdida…). Una brecha de cuidado es otra cosa:
// algo que el paciente DEBERÍA tener según su condición y su edad y no tiene. Función PURA con entradas explícitas;
// la ruta reúne los datos (lista de problemas, fecha del último analito/vital, edad, vacunas). Criterios orientativos
// (ADA, guías de HTA, cartilla): PENDIENTES de validación clínica.
export type PreventiveInputs=Readonly<{
 ageYears:number|undefined;asOf:string;activeProblemCodes:readonly string[];
 lastAt:Readonly<Record<string,string|undefined>>; // clave: HBA1C, CREATININE, LDL, UACR, BP, WEIGHT (ISO de la última determinación)
 overdueVaccines:number;
}>;
export type PreventiveGap=Readonly<{code:string;label:string;priority:GapPriority;domain:"diabetes"|"hipertension"|"prevencion"|"inmunizacion"}>;
const DAY=86_400_000;
const has=(codes:readonly string[],...p:string[])=>codes.some(c=>{const u=c.trim().toUpperCase();return p.some(x=>u.startsWith(x));});
function olderThanDays(iso:string|undefined,asOf:string,days:number):boolean{if(!iso)return true;const d=Date.parse(iso);return!Number.isFinite(d)||Date.parse(asOf)-d>days*DAY;}
export function computePreventiveGaps(i:PreventiveInputs):PreventiveGap[]{
 const out:PreventiveGap[]=[];
 const dm=has(i.activeProblemCodes,"E10","E11","E12","E13","E14");const htn=has(i.activeProblemCodes,"I10","I11","I12","I13","I15");
 if(dm){
  if(olderThanDays(i.lastAt["HBA1C"],i.asOf,180))out.push({code:"DM_HBA1C_DUE",label:"Diabetes: HbA1c sin determinar en los últimos 6 meses",priority:"MEDIUM",domain:"diabetes"});
  if(olderThanDays(i.lastAt["CREATININE"],i.asOf,365))out.push({code:"DM_RENAL_DUE",label:"Diabetes: creatinina/TFG anual pendiente",priority:"MEDIUM",domain:"diabetes"});
  if(olderThanDays(i.lastAt["UACR"],i.asOf,365))out.push({code:"DM_UACR_DUE",label:"Diabetes: albuminuria (UACR) anual pendiente",priority:"LOW",domain:"diabetes"});
  if(olderThanDays(i.lastAt["LDL"],i.asOf,365))out.push({code:"DM_LIPIDS_DUE",label:"Diabetes: perfil de lípidos anual pendiente",priority:"LOW",domain:"diabetes"});
 }
 if(htn&&olderThanDays(i.lastAt["BP"],i.asOf,180))out.push({code:"HTN_BP_DUE",label:"Hipertensión: sin toma de presión arterial en 6 meses",priority:"MEDIUM",domain:"hipertension"});
 if(htn&&olderThanDays(i.lastAt["CREATININE"],i.asOf,365))out.push({code:"HTN_RENAL_DUE",label:"Hipertensión: creatinina/potasio anual pendiente",priority:"LOW",domain:"hipertension"});
 if(i.ageYears!==undefined&&i.ageYears>=40&&!dm&&!htn&&olderThanDays(i.lastAt["BP"],i.asOf,730))out.push({code:"BP_SCREENING_DUE",label:"Tamizaje: presión arterial sin registrar en 2 años",priority:"LOW",domain:"prevencion"});
 if(i.ageYears!==undefined&&i.ageYears>=45&&!dm&&olderThanDays(i.lastAt["GLUCOSE"],i.asOf,1095)&&olderThanDays(i.lastAt["HBA1C"],i.asOf,1095))out.push({code:"DM_SCREENING_DUE",label:"Tamizaje: glucosa o HbA1c sin registrar en 3 años (≥45 años)",priority:"LOW",domain:"prevencion"});
 if(i.overdueVaccines>0)out.push({code:"IMMUNIZATION_OVERDUE",label:`${i.overdueVaccines} dosis de vacuna vencida(s) según la cartilla`,priority:"MEDIUM",domain:"inmunizacion"});
 return out.sort((a,b)=>RANK[a.priority]-RANK[b.priority]||a.code.localeCompare(b.code));
}
