// GENERADO por scripts/refactor/split-workspace.mts (partición de page.tsx, K-09). Helpers, estilos, tipos y constantes
// de módulo del workspace, exportados para las vistas. Los estilos base (`btn`, `ghost`, `card`, `input`, `stateBadge`,
// `patientBar`, `LINE`) son adaptadores sobre el design system (packages/design-system/src/components.tsx): la paleta y la
// anatomía viven allí; aquí solo se conservan los nombres que usan las vistas.
import {primitive,typography,LINE as DS_LINE,buttonStyle,cardStyle,inputStyle,badgeStyle,toneOfState,patientHeaderStyle} from "../../../../packages/design-system/src";
// Solo el FORMATO del UUID (módulo sin dependencias de Node: el bundle del cliente no puede traer node:crypto).
import {uuidFromDigest} from "../../../../packages/canonical-json/src/uuid";

// EPIC K — Espacio de trabajo clínico. Consume los endpoints ya probados con la sesión autenticada.
// Módulos: encuentro (abrir->valorar->firmar) y medicación (proponer->prescribir->activar->suspender),
// ambos para el mismo paciente, con concurrencia optimista (If-Match).

export type EncState="OPEN"|"READY_TO_SIGN"|"SIGNED";
export type Encounter=Readonly<{id:string;state:EncState;version:number;signatureDigest?:string}>;
export type MedState="PROPOSED"|"PRESCRIBED"|"ACTIVE"|"STOPPED";
export type Med=Readonly<{id:string;label:string;state:MedState;version:number}>;
export type ResState="RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED";
export type Result=Readonly<{id:string;label:string;critical:boolean;state:ResState;version:number}>;
export type DocState="DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED";
export type Doc=Readonly<{id:string;label:string;state:DocState;version:number}>;
export type OrderSt="DRAFT"|"ORDERED"|"FULFILLED"|"CANCELLED";
export type Order=Readonly<{id:string;label:string;state:OrderSt;version:number}>;
export type ObSt="OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";
export type Ob=Readonly<{id:string;label:string;state:ObSt;version:number}>;
export type ProbSt="ACTIVE"|"RESOLVED"|"CHRONIC"|"ENTERED_IN_ERROR";
export type Prob=Readonly<{id:string;label:string;state:ProbSt;version:number}>;
export type AlSt="ACTIVE"|"REFUTED"|"INACTIVE";
export type Al=Readonly<{id:string;label:string;state:AlSt;version:number}>;
export type RefSt="REQUESTED"|"ACCEPTED"|"DECLINED"|"COMPLETED"|"CANCELLED";
export type Ref=Readonly<{id:string;label:string;state:RefSt;version:number}>;
export type ApptSt="SCHEDULED"|"CHECKED_IN"|"COMPLETED"|"CANCELLED"|"NO_SHOW";
export type Appt=Readonly<{id:string;label:string;state:ApptSt;version:number}>;
export type ImmSt="DUE"|"ADMINISTERED"|"REFUSED"|"ADVERSE_EVENT";
export type Imm=Readonly<{id:string;label:string;state:ImmSt;version:number}>;
export type VitSt="RECORDED"|"AMENDED"|"ENTERED_IN_ERROR";
export type Vit=Readonly<{id:string;vitalType:string;value:string;unit:string;state:VitSt;version:number;vstatus?:string;interp?:string}>;
export type CpSt="PROPOSED"|"ACTIVE"|"ON_HOLD"|"ACHIEVED"|"CANCELLED";
export type Cp=Readonly<{id:string;label:string;state:CpSt;version:number}>;
export type ClmSt="DRAFT"|"CODED"|"SUBMITTED"|"PAID"|"REJECTED"|"VOIDED";
export type Clm=Readonly<{id:string;label:string;state:ClmSt;version:number}>;
export type CsSt="DRAFTED"|"PRESENTED"|"GRANTED"|"DECLINED"|"REVOKED";
export type Cs=Readonly<{id:string;label:string;state:CsSt;version:number}>;
export type AdmSt="ADMITTED"|"TRANSFERRED"|"DISCHARGED"|"CANCELLED";
export type Adm=Readonly<{id:string;unit:string;state:AdmSt;version:number}>;
export type SpSt="COLLECTED"|"IN_TRANSIT"|"RECEIVED"|"RESULTED"|"REJECTED";
export type Sp=Readonly<{id:string;specimenType:string;state:SpSt;version:number}>;
export type IncSt="REPORTED"|"UNDER_REVIEW"|"ESCALATED"|"RESOLVED";
export type Inc=Readonly<{id:string;label:string;state:IncSt;version:number}>;
export type TrSt="WAITING"|"IN_TRIAGE"|"TRIAGED"|"CLOSED"|"LWBS";
export type Tr=Readonly<{id:string;chiefComplaint:string;acuity:number;state:TrSt;version:number}>;
export type WnSt="OPEN"|"HEALED"|"ESCALATED";
export type Wn=Readonly<{id:string;location:string;stage:string;state:WnSt;version:number}>;
export type TfSt="ORDERED"|"CROSSMATCHED"|"TRANSFUSING"|"COMPLETED"|"REACTION"|"CANCELLED";
export type Tf=Readonly<{id:string;product:string;units:string;state:TfSt;version:number}>;
export type SgSt="SCHEDULED"|"TIMED_OUT"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";
export type Sg=Readonly<{id:string;procedure:string;state:SgSt;version:number}>;
export type DzSt="SCHEDULED"|"IN_SESSION"|"INTERRUPTED"|"COMPLETED"|"CANCELLED"|"NO_SHOW";
export type Dz=Readonly<{id:string;modality:string;state:DzSt;version:number}>;
export type TL=Readonly<{aggregateType:string;aggregateId:string;latestKind:string;version:number;lastAt:string}>;
export type Gap=Readonly<{aggregateType:string;aggregateId:string;code:string;label:string;priority:"HIGH"|"MEDIUM"|"LOW"}>;
export type PanelGap=Gap&Readonly<{patientId:string}>;
export type IxSev="CONTRAINDICATED"|"MAJOR"|"MODERATE"|"MINOR";
export type IxFinding=Readonly<{kind:"pair"|"factor";severity:IxSev;severityLabel:string;a:string;b:string;mechanism:string;recommendation:string}>;
export type IxResult=Readonly<{findings:IxFinding[];counts:Record<IxSev,number>;highestSeverity:IxSev|null;highestSeverityLabel:string|null;resolvedDrugs:{input:string;ingredient:string|null;classes:string[]}[];resolvedFactors:{input:string;code:string|null}[];unresolvedDrugs:string[];unresolvedFactors:string[]}>;
export type AllergenType="Medicamento"|"Alimento"|"Ambiental"|"Contraste"|"Otros";
export type AllergyItem=Readonly<{allergyId:string;patientId:string;patientName:string;substance:string;type:AllergenType;reaction:string;severity:"MILD"|"MODERATE"|"SEVERE";severityLabel:string;status:"ACTIVE"|"REFUTED"|"INACTIVE";statusLabel:string;recordedAt:string;registeredBy:string}>;
export type AllergyRegistry=Readonly<{items:AllergyItem[];total:number;patientsWithAllergies:number;bySeverity:{grave:number;moderada:number;leve:number;incierta:number};byType:Record<AllergenType,number>;activeCount:number}>;
export type ProblemStatus="ACTIVE"|"CHRONIC"|"RESOLVED"|"INACTIVE";
export type ProblemItem=Readonly<{problemId:string;patientId:string;patientName:string;code:string;description:string;category:string;chronic:boolean;status:ProblemStatus;statusLabel:string;recordedAt:string;registeredBy:string}>;
export type ProblemRegistry=Readonly<{items:ProblemItem[];total:number;byStatus:{activos:number;enSeguimiento:number;resueltos:number;inactivos:number};byCategory:Record<string,number>;topPatients:{name:string;count:number}[]}>;
export type IcdEntry=Readonly<{code:string;description:string;category:string}>;
export type ImmStatus="COMPLETE"|"PENDING"|"REFUSED"|"ADVERSE";
export type ImmItem=Readonly<{immunizationId:string;patientId:string;patientName:string;vaccine:string;dose:string;lot:string;site:string;status:ImmStatus;statusLabel:string;appliedAt:string;registeredBy:string}>;
export type ImmRegistry=Readonly<{items:ImmItem[];total:number;appliedCount:number;pendingCount:number;vaccinatedPatients:number;incompleteSchemes:number;byVaccine:Record<string,number>}>;
export type VitalRecord=Readonly<{at:string;ta:string;fc:string;fr:string;temp:string;spo2:string;peso:string;talla:string;imc:string}>;
export type VitalHistory=Readonly<{records:VitalRecord[];series:{BP:{value:number;at:string}[];HR:{value:number;at:string}[];WEIGHT:{value:number;at:string}[];IMC:{value:number;at:string}[]};latest:VitalRecord|null;count:number}>;
export type CarePlanSnap=Readonly<{counts:{problems:number;medications:number;allergies:number};problems:{code:string;description:string;status:string;statusLabel:string}[];goals:{category:string;goal:string;status:string;statusLabel:string}[];metrics:{hba1c:string|null;bp:string|null;weight:string|null;imc:string|null}}>;
export type RefContext=Readonly<{allergies:string[];medications:string[];problems:{code:string;description:string}[];labs:{hba1c:string|null};vitals:{bp:string|null;hr:string|null;imc:string|null}}>;
export type FUDelta={first:number;last:number}|null;
export type FollowUpSnap=Readonly<{tasks:{obligationId:string;task:string;dueAt:string;status:string;statusLabel:string;done:boolean;priority?:string;blocksSignature?:"URGENT"|"OVERDUE"|"INVALID_DUE_DATE"|null}[];vitalsTrend:{series:{BP:number[];HR:number[];WEIGHT:number[];IMC:number[]};avg:{ta:string|null;bp:number|null;hr:number|null;weight:number|null;imc:number|null}};indicators:{hba1c:FUDelta;ldl:FUDelta;weight:FUDelta;imc:FUDelta};counts:{problems:number;medications:number;allergies:number}}>;
export type ClaimItem=Readonly<{claimId:string;folio:string;patientId:string;patientName:string;amount:number;currency:string;status:string;statusLabel:string;recordedAt:string}>;
export type ClaimsRegistry=Readonly<{items:ClaimItem[];total:number;incomePeriod?:string;incomeThisMonth:number;incomeAllTime?:number;issuedCount:number;pendingCount:number;pendingAmount:number;cancellations:number}>;
export type DocItem=Readonly<{documentId:string;title:string;docType:string;typeLabel:string;status:string;statusLabel:string;createdAt:string;actorId:string}>;
export type DocsSnap=Readonly<{items:DocItem[];total:number;byType:Record<string,number>;chips:{clinical:number;consents:number;studies:number}}>;
export type DocAttachment={attachmentId:string;filename:string;mime:string;size:number;pathname:string;contentHash:string;authorId:string;attachedAt:string};
export type DocDetail=Readonly<{documentId:string;patientId:string;title:string;docType:string;typeLabel:string;content:string;state:string;statusLabel:string;version:number;createdAt:string;addenda:{addendum:string;authorId:string;at:string}[];signature:{authorId:string;contentHash:string;signatureDigest:string;signedAt:string}|null;attachments:DocAttachment[]}>;
export type ResultItem=Readonly<{resultId:string;patientId:string;patientName:string;analyte:string;value:string;critical:boolean;status:string;interpretation:string;tipo:string;estado:string;lifecycle:string;receivedAt:string}>;
export type ResultsRegistry=Readonly<{items:ResultItem[];total:number;abnormal:number;enSeguimiento:number;pendientes:number}>;
export type ConsTabs=Readonly<{results:{analyte:string;value:string;estado:string;critical:boolean;receivedAt:string}[];orders:{typeLabel:string;detail:string;status:string;createdAt:string}[];medications:string[];planGoals:{goal:string;statusLabel:string}[];documents:{title:string;typeLabel:string;createdAt:string}[];obligations:{task:string;dueAt:string;statusLabel:string;done:boolean}[]}>;
export type RegObItem=Readonly<{obligationId:string;name:string;category:string;periodicity:string;dueDate:string|null;estado:string;daysUntil:number|null}>;
export type RegObSnap=Readonly<{items:RegObItem[];total:number;alDia:number;proximas:number;vencidas:number;compliance:Record<string,number>}>;
export type ScheduleRow={day:string;open:boolean;from:string;to:string};
export type OfficeSettings={officeName:string;specialty:string;rfc:string;cedula:string;address:string;phone:string;email:string;timezone:string;language:string;color:string;theme:string;fontSize:string;realtimeAlerts:boolean;followupReminders:boolean;showInteractions:boolean;darkMode:boolean;schedule:ScheduleRow[];modules:Record<string,boolean>;prefRecordView:string;prefNoteTemplate:string;prefUnits:string;prefDoseCalc:string;regCountry:string;regState:string;regCity:string;regPostalCode:string;regDateFormat:string;regTimeFormat:string;regCurrency:string;regTaxRate:string};
export const CFG_MODULES=["Pacientes","Agenda","Consulta","Resultados","Órdenes","Interconsultas","Seguimiento","Facturación","Documentos","Obligaciones","Clinical Intelligence","Reportes","Biblioteca clínica"];
export const CFG_SCHEDULE:ScheduleRow[]=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"].map(day=>day==="Domingo"?{day,open:false,from:"",to:""}:day==="Sábado"?{day,open:true,from:"08:00",to:"13:00"}:{day,open:true,from:"08:00",to:"15:00"});
export type CiFinding=Readonly<{domain:string;severity:string;summary:string}>;
export type CiSnap=Readonly<{registered:boolean;problems?:string[];allergies?:string[];labs?:{hba1c?:number;egfr?:number};findings?:CiFinding[];demographics?:{age:number;sex:string}}>;
export type ReportsSnap=Readonly<{patientsAttended:number;income:number;diagnosesTotal:number;topDiagnoses:{code:string;description:string;count:number;pct:number}[];ordersTotal:number;ordersByType:{type:string;label:string;count:number;pct:number}[];topProcedures:{detail:string;count:number;pct:number}[];resultsTotal:number;immunizationsApplied:number;encountersTotal:number;encountersSigned:number;encountersByDay:{date:string;count:number;pct:number}[];prescriptionsTotal:number;topMedications:{drugCode:string;count:number;pct:number}[];appointmentsTotal:number;appointmentsByType:{type:string;label:string;count:number;pct:number}[];qualityIndicators:{key:string;label:string;numerator:number;denominator:number;pct:number;target:number;direction:"higher"|"lower";met:boolean;computable:boolean;note:string}[]}>;
export const TYPE_LABEL:Record<string,string>={Encounter:"Encuentro",ClinicalOrder:"Orden",Medication:"Medicación",DiagnosticResult:"Resultado",ClinicalDocument:"Documento",ClinicalObligation:"Obligación",ClinicalProblem:"Problema",Allergy:"Alergia",Referral:"Interconsulta",Appointment:"Cita",Immunization:"Vacuna",VitalSign:"Signo vital",CarePlan:"Plan de cuidados",Claim:"Facturación",Consent:"Consentimiento",Admission:"Internamiento",Specimen:"Muestra",Incident:"Incidente",Triage:"Triage",Wound:"Herida/UPP",Transfusion:"Transfusión",Surgery:"Cirugía",Dialysis:"Diálisis",Preventive:"Cuidado preventivo"};
// Hero de consulta — etiqueta clínica corta desde el código CIE-10 (chips de diagnóstico).
export const DX_LABEL=(code:string):string=>{const c=code.trim().toUpperCase();
 const m:[string,string][]=[["N18.3","ERC G3a"],["N18.4","ERC G3b"],["N18.5","ERC G4"],["N18.6","ERC G5"],["N18","ERC"],["I10","HTA"],["E11","DM2"],["E10","DM1"],["E78","Dislipidemia"],["I50","IC"],["I48","FA"],["J44","EPOC"],["J45","Asma"],["I25","Cardiopatía isq."],["E66","Obesidad"],["M15","Osteoartrosis"],["M17","Gonartrosis"],["F32","Depresión"],["K21","ERGE"]];
 for(const[p,l]of m)if(c.startsWith(p))return l;return c;};
export type Snap=Readonly<{demographics:{age:number;sex:string;birthDate:string;name?:string;curp?:string;phone?:string;email?:string;address?:string;occupation?:string;maritalStatus?:string};problems:string[];allergies:string[];vitals:Record<string,string>;labs:{hba1c?:number;creatinine?:number;glucose?:number;ldl?:number;egfr?:number;egfrStage?:string};findings:{domain:string;severity:"CRITICAL"|"WARNING"|"INFO";summary:string}[]}>;
export const SEX_ES:Record<string,string>={FEMALE:"Femenino",MALE:"Masculino",INTERSEX:"Intersexual",UNKNOWN:"Sin especificar"};
// Tiempo relativo compacto (panel de auditoría / actividad).
export function relTime(iso:string):string{try{const d=Date.now()-new Date(iso).getTime();const m=Math.floor(d/60000);if(m<1)return "ahora";if(m<60)return `hace ${m} min`;const h=Math.floor(m/60);if(h<24)return `hace ${h} h`;const dd=Math.floor(h/24);return dd<30?`hace ${dd} d`:new Date(iso).toLocaleDateString("es-MX",{day:"2-digit",month:"short"});}catch{return "";}}
// Panel 5 — clasificación del estado de un follow-up (por latestKind del agregado).
export const FOLLOW_TYPES=new Set(["ClinicalObligation","Referral","Appointment","Immunization","CarePlan"]);
export const DONE_KINDS=new Set(["COMPLETED","FULFILLED","ADMINISTERED","ACHIEVED","CLOSED"]);
export const SCHED_KINDS=new Set(["IN_PROGRESS","ACCEPTED","CHECKED_IN","SCHEDULED","ACTIVE","PROGRESSED"]);
export const CANCEL_KINDS=new Set(["CANCELLED","DECLINED","NO_SHOW","REVOKED","ENTERED_IN_ERROR"]);
export function followState(kind:string):"pend"|"prog"|"done"|"skip"{if(DONE_KINDS.has(kind))return "done";if(CANCEL_KINDS.has(kind))return "skip";if(SCHED_KINDS.has(kind))return "prog";return "pend";}
export type RxCheck=Readonly<{drug:{input:string;resolved:{ingredient:string;classes:string[]}|null};egfr:number|null;checks:{id:string;label:string;status:"OK"|"WARN"|"BLOCK"|"NOT_EVALUATED"|"NOT_COVERED"|"NA";detail:string;overridable?:boolean}[];monitoring:{test:string;note:string;dueInDays:number}[];indications:string;verdict:"OK"|"WARN"|"BLOCK";requiresAcknowledgement?:boolean;notEvaluated?:string[];notCovered?:string[];blockedOverridable?:string[];blockedHard?:string[]}>;
// Auditoría U-19: la dosis se captura como cantidad + unidad (nada de texto libre "1 tab" sin unidad); el servidor recibe "500 mg".
export const DOSE_UNITS=["mg","g","mcg","mL","UI","mEq","tab","cap","gotas","puff","amp"] as const;
export const composeDose=(amount:string,unit:string)=>amount.trim()?`${amount.trim()} ${unit}`:"";
// Etiquetas de las barreras anulables para el diálogo de anulación (los ids vienen del servidor).
export const BARRIER_LABEL:Record<string,string>={allergy:"Alergia documentada",interaction:"Interacción farmacológica mayor",duplicate:"Duplicidad terapéutica",contraindication:"Contraindicación por diagnóstico",renal:"Ajuste renal (eGFR)",doseCeiling:"Dosis por encima del máximo diario",pediatricDose:"Dosis pediátrica por peso",order:"Orden mal formada",catalog:"Fármaco fuera de catálogo"};
export type BlockDetails=Readonly<{barriers?:string[];hard?:string[];overridable?:string[];missing?:string[]}>;
export const blockDetails=(r:{body:Record<string,unknown>}):BlockDetails=>((r.body["error"] as{details?:BlockDetails}|undefined)?.details)??{};
// Panel 4 — evolución longitudinal
export type Series=readonly{value:number;at:string}[];
export type Trends=Readonly<{series:Record<string,Series>;latest:{LDL:number|null;CREATININE:number|null;UACR:number|null;EGFR:number|null}}>;
export type TrendKey="HBA1C"|"GLUCOSE"|"LDL"|"CREATININE";
export const CHART:Record<TrendKey,{label:string;unit:string;target?:number;targetLabel?:string;domain:[number,number]}>={
 HBA1C:{label:"HbA1c",unit:"%",target:7,targetLabel:"Objetivo <7%",domain:[4,11]},
 GLUCOSE:{label:"Glucosa (ayuno)",unit:"mg/dL",target:100,targetLabel:"Meta <100 mg/dL",domain:[60,220]},
 LDL:{label:"Colesterol LDL",unit:"mg/dL",target:100,targetLabel:"Meta <100 mg/dL",domain:[40,220]},
 CREATININE:{label:"Creatinina",unit:"mg/dL",domain:[0.4,3]},
};
export const fmtN=(v:number)=>v%1?v.toFixed(1):String(v);
export function trendChart(series:Series,key:TrendKey){
 const cfg=CHART[key];
 if(!series.length)return <div style={{padding:"28px 0",textAlign:"center",color:P.muted,fontSize:13}}>Sin datos de {cfg.label} todavía. Registra resultados para ver la tendencia.</div>;
 const W=680,H=250,padL=42,padR=14,padT=18,padB=38,cb=H-padB;
 const vals=series.map(p=>p.value);
 const dmin=Math.min(cfg.domain[0],...vals),dmax=Math.max(cfg.domain[1],...vals);
 const x=(i:number)=>padL+(series.length===1?0.5:i/(series.length-1))*(W-padL-padR);
 const y=(v:number)=>padT+(1-(v-dmin)/(dmax-dmin||1))*(cb-padT);
 const line=series.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
 const area=`M${x(0).toFixed(1)},${cb} `+series.map((p,i)=>`L${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")+` L${x(series.length-1).toFixed(1)},${cb} Z`;
 const yticks=[dmin,(dmin+dmax)/2,dmax];
 const fmt=(at:string)=>{try{return new Date(at).toLocaleDateString("es-MX",{month:"short",year:"2-digit"});}catch{return "";}};
 const xIdx=series.length<=6?series.map((_,i)=>i):[0,Math.round((series.length-1)/2),series.length-1];
 return <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",maxWidth:W}} role="img" aria-label={`Tendencia de ${cfg.label}`}>
  {cfg.target!==undefined&&y(cfg.target)<cb&&<rect x={padL} y={y(cfg.target)} width={W-padL-padR} height={cb-y(cfg.target)} fill="#EAF7EF"/>}
  {yticks.map((t,i)=><g key={i}><line x1={padL} y1={y(t)} x2={W-padR} y2={y(t)} stroke="#EEF1F6"/><text x={padL-6} y={y(t)+3} textAnchor="end" fontSize="10" fill="#8a8b9a">{fmtN(t)}</text></g>)}
  {cfg.target!==undefined&&<><line x1={padL} y1={y(cfg.target)} x2={W-padR} y2={y(cfg.target)} stroke="#168B5B" strokeDasharray="4 3" strokeWidth="1.2"/><text x={padL+6} y={y(cfg.target)-4} textAnchor="start" fontSize="10" fontWeight="600" fill="#168B5B">{cfg.targetLabel}</text></>}
  <path d={area} fill="#1769E014"/>
  <path d={line} fill="none" stroke="#1769E0" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/>
  {series.map((p,i)=>{const last=i===series.length-1;return <g key={i}><circle cx={x(i)} cy={y(p.value)} r={last?4.5:3.2} fill="#fff" stroke="#1769E0" strokeWidth={last?2.4:1.8}/><text x={x(i)} y={y(p.value)-9} textAnchor="middle" fontSize="10" fontWeight={last?700:600} fill={last?"#14213D":"#5F6B7A"}>{fmtN(p.value)}</text></g>;})}
  {xIdx.map(i=>{const s=series[i];return s?<text key={i} x={x(i)} y={H-14} textAnchor="middle" fontSize="10" fill="#8a8b9a">{fmt(s.at)}</text>:null;})}
 </svg>;
}
// Severidad de hallazgo -> etiqueta + color del panel "Alertas y sugerencias".
export const SEV:Record<"CRITICAL"|"WARNING"|"INFO",{label:string;bg:string;fg:string;bd:string}>={
 CRITICAL:{label:"ALTA",bg:"#FDEAEA",fg:"#B3261E",bd:"#F3C9C9"},
 WARNING:{label:"IMPORTANTE",bg:"#FFF4E5",fg:"#A15C00",bd:"#F0DBB8"},
 INFO:{label:"SUGERENCIA",bg:"#EEF3FB",fg:"#2C5AA6",bd:"#D3E0F5"}};
export function alActions(a:{id:string;state:AlSt}):{label:string;path:string;body:Record<string,unknown>;to:AlSt}[]{
 const now=new Date().toISOString();const base=`/api/v1/allergies/${a.id}`;
 if(a.state==="ACTIVE")return[{label:"Refutar",path:base+"/refutation",body:{occurredAt:now},to:"REFUTED"},{label:"Inactivar",path:base+"/inactivation",body:{occurredAt:now},to:"INACTIVE"}];
 if(a.state==="INACTIVE")return[{label:"Reactivar",path:base+"/reactivation",body:{occurredAt:now},to:"ACTIVE"}];
 return[];
}
export function probActions(p:{id:string;state:ProbSt}):{label:string;path:string;body:Record<string,unknown>;to:ProbSt}[]{
 const now=new Date().toISOString();const base=`/api/v1/problems/${p.id}`;
 if(p.state==="ACTIVE")return[{label:"Resolver",path:base+"/resolution",body:{note:"Resuelto",occurredAt:now},to:"RESOLVED"},{label:"Crónico",path:base+"/chronicity",body:{occurredAt:now},to:"CHRONIC"}];
 if(p.state==="RESOLVED")return[{label:"Reactivar",path:base+"/reactivation",body:{occurredAt:now},to:"ACTIVE"}];
 if(p.state==="CHRONIC")return[{label:"Resolver",path:base+"/resolution",body:{note:"Resuelto",occurredAt:now},to:"RESOLVED"}];
 return[];
}

// Tokens del design-system (único origen de verdad). El app-shell y las tarjetas se derivan de aquí.
export const P=primitive.color,S=primitive.space,UI=typography.family.ui;
export const LINE=DS_LINE;
export const shell:React.CSSProperties={minHeight:"100vh",background:P.canvas,fontFamily:UI,color:P.ink};
export const appbar:React.CSSProperties={position:"sticky",top:0,zIndex:30,background:P.white,borderBottom:`1px solid ${LINE}`,padding:"11px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"};
export const patientBar:React.CSSProperties=patientHeaderStyle;
export const content:React.CSSProperties={maxWidth:1140,margin:"0 auto",padding:`${S[5]}px ${S[5]}px ${S[12]}px`};
// Sidebar del expediente (diseño exacto S1.png): navegación primaria con íconos + badges en tiempo real.
// h2:"" => volver arriba (Inicio). badge: clave del conteo real; badgeColor rojo=urgente, morado=informativo.
export type BadgeKey="agenda"|"resultados"|"seguimiento"|"obligaciones";
export const SIDE_NAV:{label:string;h2:string;icon:string;badge?:BadgeKey;badgeColor?:"r"|"p"}[]=[
 {label:"Inicio",h2:"",icon:"home"},
 {label:"Pacientes",h2:"Paciente",icon:"people"},
 {label:"Consulta",h2:"Encuentro",icon:"steth"},
 {label:"Agenda",h2:"Agenda",icon:"cal",badge:"agenda",badgeColor:"p"},
 {label:"Resultados",h2:"Resultados diagnósticos",icon:"flask",badge:"resultados",badgeColor:"r"},
 {label:"Órdenes",h2:"Órdenes clínicas",icon:"orders"},
 {label:"Medicamentos",h2:"Medicación",icon:"pill"},
 {label:"Alergias",h2:"Alergias",icon:"warning"},
 {label:"Problemas",h2:"Lista de problemas",icon:"clipboard"},
 {label:"Vacunas",h2:"Vacunas",icon:"syringe"},
 {label:"Signos vitales",h2:"Signos vitales",icon:"activity"},
 {label:"Plan de cuidados",h2:"Plan de cuidados",icon:"target"},
 {label:"Interconsultas",h2:"Interconsultas",icon:"people"},
 {label:"Seguimiento",h2:"Seguimiento automático",icon:"chart",badge:"seguimiento",badgeColor:"p"},
 {label:"Facturación",h2:"Facturación",icon:"card"},
 {label:"Documentos",h2:"Documentos clínicos",icon:"folder"},
 {label:"Obligaciones",h2:"Obligaciones de seguimiento",icon:"checkbox",badge:"obligaciones",badgeColor:"r"},
 {label:"Clinical Intelligence",h2:"",icon:"brain"},
 {label:"Reportes",h2:"Evolución longitudinal",icon:"barchart"},
];
export const TOOLS_NAV:{label:string;h2:string;icon:string}[]=[
 {label:"Biblioteca clínica",h2:"",icon:"book"},
 {label:"Configuración",h2:"",icon:"gear"},
];
export const ICONS:Record<string,string>={
 home:"M4 11l8-6 8 6M6 10v9h12v-9",
 people:"M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M16 4.5a3 3 0 010 6M22 20a6 6 0 00-5-5.9",
 steth:"M6 4v5a5 5 0 0010 0V4M11 14v2a4 4 0 008 0M19 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
 cal:"M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
 flask:"M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3",
 orders:"M8 4h8v3H8zM6 5H5a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1V6a1 1 0 00-1-1h-1M8 12h8M8 16h5",
 pill:"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7zM7 8l6 6",
 warning:"M12 4l9 15.5H3zM12 10v4M12 17h.01",
 clipboard:"M9 4h6v2H9zM7 5H6a1 1 0 00-1 1v14a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1h-1M8 11h8M8 15h8",
 syringe:"M14 4l6 6M16.5 6.5l-10 10-3.5 4.5.9.9L8 18.5l10-10M6 14l4 4",
 activity:"M3 12h4l2.5 7 4-14 2.5 7H21",
 target:"M12 21a9 9 0 100-18 9 9 0 000 18zM12 17a5 5 0 100-10 5 5 0 000 10zM12 13a1 1 0 100-2 1 1 0 000 2",
 chart:"M4 19V5M4 19h16M8 15l3-4 3 2 4-6",
 card:"M3 6h18v12H3zM3 10h18",
 folder:"M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z",
 checkbox:"M4 4h16v16H4zM8 12l3 3 5-6",
 brain:"M9 4.5a3 3 0 00-3 3 3 3 0 00-1.5 5A3 3 0 006 17.5 3 3 0 009 20a2.5 2.5 0 003-2.4V5.4A2.5 2.5 0 009 4.5zM15 4.5a3 3 0 013 3 3 3 0 011.5 5A3 3 0 0118 17.5 3 3 0 0115 20a2.5 2.5 0 01-3-2.4",
 barchart:"M3 21h18M6 21V11M11 21V5M16 21v-8",
 book:"M12 6C10 4.5 7 4 4 4v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14",
 gear:"M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007.5 19a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 8.5a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z",
 lock:"M6 11h12v9H6zM9 11V8a3 3 0 016 0v3",
};
export function NavIcon({k}:{k:string}){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONS[k]??ICONS.home}/></svg>;}
export function scrollToSection(h2Text:string){
 if(!h2Text){window.scrollTo({top:0,behavior:"smooth"});return;}
 const h=Array.from(document.querySelectorAll("h2")).find(e=>e.textContent?.trim()===h2Text);
 h?.closest("section")?.scrollIntoView({behavior:"smooth",block:"start"});
}
export const RAIL_CSS=`
/* App-shell: expediente como cockpit (sidebar oscuro + body + rejilla de ventanas) */
.mos-app{display:flex;min-height:100vh;background:#F4F7FB}
.mos-side{position:sticky;top:0;align-self:flex-start;height:100vh;flex:0 0 264px;width:264px;background:linear-gradient(177deg,#26235C 0%,#201D4A 45%,#1A1740 100%);color:#EAEBFA;display:flex;flex-direction:column;padding:18px 14px 14px;overflow:hidden;transition:width .18s ease,flex-basis .18s ease}
.mos-side::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#7B6BF6,#4E8DF5);box-shadow:0 0 24px 3px #6a5bf580}
.mos-side.col{flex:0 0 74px;width:74px;padding:18px 10px 14px}
.mos-brand{display:flex;align-items:center;gap:12px;padding:2px 6px 0}
.mos-bname{font-size:20px;font-weight:800;letter-spacing:.01em;line-height:1;color:#fff;white-space:nowrap}
.mos-bname .os{color:#8E7DF8}
.mos-bsub{font-size:8.5px;font-weight:600;letter-spacing:.16em;color:#8A8FC6;margin-top:5px;line-height:1.5;white-space:nowrap}
.mos-nav{display:flex;flex-direction:column;gap:1px;margin-top:20px;flex:1;overflow-y:auto;overflow-x:hidden;padding-right:2px}
.mos-nav::-webkit-scrollbar{width:5px}.mos-nav::-webkit-scrollbar-thumb{background:#ffffff1f;border-radius:9px}
.mos-navi{display:flex;align-items:center;gap:14px;padding:10px 14px;border-radius:12px;color:#B7BCE6;font-size:14.5px;font-weight:500;background:transparent;border:0;cursor:pointer;text-align:left;width:100%;font-family:inherit;position:relative;white-space:nowrap}
.mos-navi svg{flex:0 0 auto;opacity:.92}
.mos-navi:hover{background:#ffffff0f;color:#fff}
.mos-navi.active{background:linear-gradient(100deg,#ffffff20,#ffffff10);color:#fff;font-weight:600;box-shadow:inset 0 0 0 1px #8B7DF85c,0 8px 18px #12103a80}
.mos-navi .lbl{flex:1;overflow:hidden;text-overflow:ellipsis}
.mos-badge{flex:0 0 auto;min-width:22px;height:22px;border-radius:999px;display:grid;place-items:center;font-size:12px;font-weight:700;color:#fff;padding:0 6px;font-variant-numeric:tabular-nums}
.mos-badge.p{background:#6C5CF6}.mos-badge.r{background:#F0455E}
.mos-side.col .lbl,.mos-side.col .mos-bname,.mos-side.col .mos-bsub,.mos-side.col .mos-toolslbl,.mos-side.col .mos-doc .info,.mos-side.col .mos-collapse .lbl{display:none}
.mos-side.col .mos-navi{justify-content:center;padding:11px 0}
.mos-side.col .mos-badge{position:absolute;top:3px;right:8px;min-width:16px;height:16px;font-size:9px;padding:0 3px}
.mos-side.col .mos-brand{justify-content:center;padding:0}
.mos-divider{height:1px;background:#ffffff14;margin:14px 6px}
.mos-toolslbl{font-size:10px;font-weight:700;letter-spacing:.16em;color:#7C81BC;padding:2px 14px 8px}
.mos-doc{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:14px;cursor:pointer;position:relative}
.mos-doc:hover{background:#ffffff0d}
.mos-doc .av{width:40px;height:40px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;font-weight:700;font-size:14px;color:#fff;background:#3A3570;box-shadow:0 0 0 2px #7B6BF6}
.mos-doc .nm{font-size:14.5px;font-weight:700;color:#fff;white-space:nowrap}
.mos-doc .rl{font-size:11.5px;color:#9095CB;margin-top:1px;white-space:nowrap}
.mos-docmenu{position:absolute;bottom:calc(100% + 6px);left:8px;right:8px;background:#2A2760;border:1px solid #ffffff1f;border-radius:12px;padding:6px;box-shadow:0 12px 32px #0a0820aa;z-index:5}
.mos-docmenu button{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:transparent;border:0;color:#C7CBEC;font-size:13.5px;font-family:inherit;padding:9px 11px;border-radius:9px;cursor:pointer}
.mos-docmenu button:hover{background:#ffffff10;color:#fff}
.mos-collapse{display:flex;align-items:center;gap:10px;justify-content:center;margin-top:8px;padding:12px;border-radius:12px;background:#ffffff0a;border:1px solid #ffffff14;color:#9095CB;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.mos-collapse:hover{background:#ffffff12;color:#fff}
.mos-body{flex:1;min-width:0;display:flex;flex-direction:column}
.mos-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start;padding:20px 22px 52px;max-width:1400px;margin:0 auto;width:100%;box-sizing:border-box}
.mos-grid>*{margin-top:0!important}
.mos-grid>section{scroll-margin-top:132px}
.mos-grid>.span2{grid-column:1 / -1}
.mos-hero-grid{display:grid;grid-template-columns:1.6fr 1fr}
.mos-vitals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
@media(max-width:1150px){.mos-vitals{grid-template-columns:repeat(2,minmax(0,1fr))}}
.mos-rx-form{display:grid;grid-template-columns:1fr 130px 120px 150px auto;gap:8px;margin-top:12px;align-items:center}
.mos-rx-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:14px;margin-top:14px}
@media(max-width:760px){.mos-rx-form{grid-template-columns:1fr 1fr}.mos-rx-grid{grid-template-columns:1fr}}
@media(max-width:760px){.mos-hero-grid{grid-template-columns:1fr}.mos-hero-grid>div:first-child{border-right:0!important;border-bottom:1px solid #E4E9F2}}
@media(max-width:1000px){.mos-side{display:none}.mos-grid{grid-template-columns:1fr}}
.mos-topsearch{flex:1;max-width:440px;display:flex;align-items:center;gap:8px;background:#F1F4F9;border:1px solid #E4E9F2;border-radius:10px;padding:8px 12px}
.mos-topsearch input{flex:1;border:0;background:transparent;outline:none;font-size:13.5px;font-family:inherit;color:#14213D}
@media(max-width:1180px){.mos-mid{grid-template-columns:1fr 1fr!important}.mos-low2{grid-template-columns:1fr 1fr!important}}
@media(max-width:900px){.mos-kpis{grid-template-columns:1fr 1fr!important}.mos-banners{grid-template-columns:1fr!important}.mos-mid{grid-template-columns:1fr!important}.mos-low{grid-template-columns:1fr!important}.mos-low2{grid-template-columns:1fr!important}}
@media(max-width:1150px){.mos-detail{display:none!important}}
@media(max-width:1100px){.mos-ag{grid-template-columns:1fr!important}}
@media(max-width:1150px){.mos-res{grid-template-columns:1fr!important}.mos-res .mos-detail{display:block!important;border-left:0!important;border-top:1px solid #E4E9F2}}
@media(max-width:1250px){.mos-res3{grid-template-columns:1fr 1fr!important}.mos-res3 .mos-detail{grid-column:1 / -1}}
@media(max-width:820px){.mos-res3{grid-template-columns:1fr!important}}
@media(max-width:760px){.mos-med2{grid-template-columns:1fr!important}}
@media(max-width:1250px){.mos-ord3{grid-template-columns:1fr 1fr!important}.mos-ord3 .mos-detail{grid-column:1 / -1}.mos-ord2{grid-template-columns:1fr!important}}
@media(max-width:820px){.mos-ord3{grid-template-columns:1fr!important}}
.mos-phone{width:270px;max-width:100%;margin:14px auto 0;border-radius:30px;background:#0C2148;padding:9px;box-shadow:0 18px 44px rgba(16,42,86,.22)}
.mos-phone .screen{background:#F4F7FB;border-radius:23px;overflow:hidden}
.mos-pnav{display:flex;justify-content:space-around;align-items:center;padding:9px 4px;background:#fff;border-top:1px solid #E4E9F2}
.mos-pnav div{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:9.5px;color:#8a8b9a}
`;
export const wrap:React.CSSProperties={maxWidth:1080,margin:"0 auto",padding:S[8],minHeight:"100vh",background:P.canvas,fontFamily:UI,color:P.ink};
export const card:React.CSSProperties=cardStyle;
export const btn:React.CSSProperties=buttonStyle.primary;
export const ghost:React.CSSProperties=buttonStyle.ghost;
export const input:React.CSSProperties=inputStyle;
export const mono:React.CSSProperties={fontFamily:"ui-monospace,Menlo,monospace",fontSize:12,background:"#EEF3FB",color:"#33507D",padding:"2px 6px",borderRadius:6};
export const lbl:React.CSSProperties={fontSize:13,fontWeight:600,color:"#3C4658",display:"block",margin:"12px 0 6px"};
export const stateBadge=(s:string):React.CSSProperties=>badgeStyle(toneOfState(s));
export const in7days=()=>new Date(Date.now()+7*864e5).toISOString();
export const uuid=()=>globalThis.crypto.randomUUID();
export const nowIso=()=>new Date().toISOString();
// Auditoría U-12: al usuario nunca se le muestra una excepción cruda (String(e) con stack o "TypeError: Failed to fetch").
// UUID DETERMINISTA en el cliente a partir de una clave (U-09): dos hashes FNV-1a de 64 bits con semillas distintas => 128 bits
// estables; formato v4 para que el servidor lo acepte como uuid. No es criptográfico: solo necesita ser estable y único por clave.
export function derivedClientUuid(key:string):string{
 // En el navegador no hay `node:crypto`, así que la huella se calcula con FNV-1a de 128 bits (dos pasadas con semillas
 // distintas). El FORMATO —nibbles de versión y variante— lo fija el mismo helper que usa el servidor (R01-015), así que
 // no hay dos maneras de dar forma a un UUID en el repo.
 const fnv=(seed:bigint)=>{let h=seed;for(let i=0;i<key.length;i++){h^=BigInt(key.charCodeAt(i));h=(h*0x100000001b3n)&0xffffffffffffffffn;}return h;};
 const hex=(fnv(0xcbf29ce484222325n).toString(16).padStart(16,"0")+fnv(0x84222325cbf29ce4n).toString(16).padStart(16,"0")).slice(0,32);
 return uuidFromDigest(hex);
}
export function userMessage(e:unknown):string{
 const m=e instanceof Error?e.message:String(e);
 if(/failed to fetch|networkerror|load failed|network request failed/i.test(m))return "Sin conexión con el servidor. Compruebe la red y vuelva a intentarlo.";
 if(/WebCrypto/i.test(m))return m; // mensaje ya redactado para el usuario
 return "No se pudo completar la acción. Vuelva a intentarlo; si persiste, avise a soporte.";
}
// Accesibilidad (auditoría 2026-09-19, R05b): un div/span que actúa como control se anuncia como botón y se opera con
// teclado (Enter/Espacio); una fila/elemento de lista activable recibe foco y teclado sin cambiar su semántica de tabla/lista.
export type ActEvent=React.MouseEvent<HTMLElement>|React.KeyboardEvent<HTMLElement>;
export const keyAct=(onClick:(e:ActEvent)=>void)=>(e:React.KeyboardEvent<HTMLElement>)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onClick(e);}};
// Sin manejador (control inactivo) no se anuncia como botón ni recibe foco.
export const act=(onClick:((e:ActEvent)=>void)|undefined)=>onClick?{role:"button" as const,tabIndex:0,onClick,onKeyDown:keyAct(onClick)}:{};
export const actRow=(onClick:(e:ActEvent)=>void)=>({tabIndex:0,onClick,onKeyDown:keyAct(onClick)});
export function errMsg(r:{status:number;body:Record<string,unknown>}):string{const e=r.body["error"] as{code?:string;message?:string;details?:{reason?:string}}|undefined;
 // L-05: el servidor exige la identidad profesional; se dice dónde completarla en lugar del código crudo.
 if(r.status===428&&e?.details?.reason==="PHYSICIAN_CREDENTIALS_REQUIRED")return "Registra tu cédula profesional en Configuración → Identidad profesional antes de prescribir o firmar.";
 return `${r.status} ${e?.code??""} ${e?.message??""}`.trim();}
// Auditoría 2026-09-19 (U-16) — los "motivos" del registro inmutable NO son literales del código. Cada transición que lleva
// un motivo/evidencia/desenlace lo marca con ASK(...) y el diálogo se lo pide al médico antes de enviar; sin texto, no se envía.
export type Ask=Readonly<{__ask:string;min:number;placeholder?:string}>;
export const ASK=(label:string,min=5,placeholder?:string):Ask=>({__ask:label,min,...(placeholder?{placeholder}:{})});
export const isAsk=(v:unknown):v is Ask=>!!v&&typeof v==="object"&&typeof(v as{__ask?:unknown}).__ask==="string";
// Siguiente transición de una medicación (label, ruta, cuerpo, estado destino).
export function medNext(m:Med):{label:string;path:string;body:Record<string,unknown>;to:MedState}|null{
 if(m.state==="PROPOSED")return{label:"Prescribir",path:`/api/v1/medications/${m.id}/prescription`,body:{occurredAt:nowIso()},to:"PRESCRIBED"};
 if(m.state==="PRESCRIBED")return{label:"Activar",path:`/api/v1/medications/${m.id}/activation`,body:{occurredAt:nowIso()},to:"ACTIVE"};
 if(m.state==="ACTIVE")return{label:"Suspender",path:`/api/v1/medications/${m.id}/discontinuation`,body:{reason:ASK("Motivo de la suspensión del medicamento",5,"p. ej. efecto adverso, fin del tratamiento, cambio de esquema"),occurredAt:nowIso()},to:"STOPPED"};
 return null;
}
// Siguiente transición de un resultado diagnóstico (closed-loop de seguimiento).
export function resNext(r:Result):{label:string;path:string;body:Record<string,unknown>;to:ResState}|null{
 if(r.state==="RECEIVED")return{label:"Verificar",path:`/api/v1/results/${r.id}/verification`,body:{occurredAt:nowIso()},to:"VERIFIED"};
 if(r.state==="VERIFIED")return{label:"Requiere acción",path:`/api/v1/results/${r.id}/action`,body:{ownerId:uuid(),dueAt:in7days(),occurredAt:nowIso()},to:"ACTIONED"};
 if(r.state==="ACTIONED")return{label:"Cerrar",path:`/api/v1/results/${r.id}/closure`,body:{evidence:ASK("Evidencia del cierre del resultado crítico",10,"qué se hizo, cuándo y con qué resultado (p. ej. paciente contactado, potasio de control 4.4)"),occurredAt:nowIso()},to:"CLOSED"};
 return null;
}
// Siguiente transición de un documento clínico (borrador -> finalizado -> firmado -> enmendado).
export function docNext(d:Doc):{label:string;path:string;body:Record<string,unknown>;to:DocState}|null{
 if(d.state==="DRAFT")return{label:"Finalizar",path:`/api/v1/documents/${d.id}/finalization`,body:{occurredAt:nowIso()},to:"FINALIZED"};
 // Firmar y Enmendar NO se ejecutan desde aquí: pasan por confirmación (contenido + huella) y por texto real del médico.
 if(d.state==="FINALIZED")return{label:"Revisar y firmar",path:"",body:{},to:"SIGNED"};
 if(d.state==="SIGNED"||d.state==="AMENDED")return{label:"Enmendar…",path:"",body:{},to:"AMENDED"};
 return null;
}
export function orderNext(o:Order):{label:string;path:string;body:Record<string,unknown>;to:OrderSt}|null{
 if(o.state==="DRAFT")return{label:"Colocar",path:`/api/v1/orders/${o.id}/placement`,body:{occurredAt:nowIso()},to:"ORDERED"};
 if(o.state==="ORDERED")return{label:"Cumplir",path:`/api/v1/orders/${o.id}/fulfillment`,body:{occurredAt:nowIso()},to:"FULFILLED"};
 return null;
}
export function referralNext(r:Ref):{label:string;path:string;body:Record<string,unknown>;to:RefSt}|null{
 if(r.state==="REQUESTED")return{label:"Aceptar",path:`/api/v1/referrals/${r.id}/acceptance`,body:{occurredAt:nowIso()},to:"ACCEPTED"};
 if(r.state==="ACCEPTED")return{label:"Completar",path:`/api/v1/referrals/${r.id}/completion`,body:{occurredAt:nowIso()},to:"COMPLETED"};
 return null;
}
export function apptNext(a:Appt):{label:string;path:string;body:Record<string,unknown>;to:ApptSt}|null{
 if(a.state==="SCHEDULED")return{label:"Registrar llegada",path:`/api/v1/appointments/${a.id}/check-in`,body:{occurredAt:nowIso()},to:"CHECKED_IN"};
 if(a.state==="CHECKED_IN")return{label:"Completar",path:`/api/v1/appointments/${a.id}/completion`,body:{occurredAt:nowIso()},to:"COMPLETED"};
 return null;
}
export function dzActions(d:{id:string;state:DzSt}):{label:string;path:string;body:Record<string,unknown>;to:DzSt}[]{
 const base=`/api/v1/dialysis-sessions/${d.id}`;
 if(d.state==="SCHEDULED")return[{label:"Iniciar",path:base+"/start",body:{occurredAt:nowIso()},to:"IN_SESSION"},{label:"No-show",path:base+"/no-show",body:{occurredAt:nowIso()},to:"NO_SHOW"}];
 if(d.state==="IN_SESSION")return[{label:"Completar",path:base+"/completion",body:{occurredAt:nowIso()},to:"COMPLETED"},{label:"Interrumpir",path:base+"/interruption",body:{reason:ASK("Descripción de la complicación",5),occurredAt:nowIso()},to:"INTERRUPTED"}];
 if(d.state==="INTERRUPTED")return[{label:"Reanudar",path:base+"/resumption",body:{occurredAt:nowIso()},to:"IN_SESSION"},{label:"Completar",path:base+"/completion",body:{occurredAt:nowIso()},to:"COMPLETED"}];
 return[];
}
export function sgNext(s:Sg):{label:string;path:string;body:Record<string,unknown>;to:SgSt}|null{
 if(s.state==="SCHEDULED")return{label:"Time-out OMS",path:`/api/v1/surgeries/${s.id}/timeout`,body:{occurredAt:nowIso()},to:"TIMED_OUT"};
 if(s.state==="TIMED_OUT")return{label:"Iniciar",path:`/api/v1/surgeries/${s.id}/start`,body:{occurredAt:nowIso()},to:"IN_PROGRESS"};
 if(s.state==="IN_PROGRESS")return{label:"Completar",path:`/api/v1/surgeries/${s.id}/completion`,body:{outcome:ASK("Desenlace del procedimiento",5),occurredAt:nowIso()},to:"COMPLETED"};
 return null;
}
export function tfNext(t:Tf):{label:string;path:string;body:Record<string,unknown>;to:TfSt}|null{
 if(t.state==="ORDERED")return{label:"Cruzar (crossmatch)",path:`/api/v1/transfusions/${t.id}/crossmatch`,body:{occurredAt:nowIso()},to:"CROSSMATCHED"};
 if(t.state==="CROSSMATCHED")return{label:"Iniciar",path:`/api/v1/transfusions/${t.id}/start`,body:{occurredAt:nowIso()},to:"TRANSFUSING"};
 if(t.state==="TRANSFUSING")return{label:"Completar",path:`/api/v1/transfusions/${t.id}/completion`,body:{occurredAt:nowIso()},to:"COMPLETED"};
 return null;
}
export function wnActions(w:{id:string;state:WnSt}):{label:string;path:string;body:Record<string,unknown>;to:WnSt}[]{
 const base=`/api/v1/wounds/${w.id}`;
 if(w.state==="OPEN")return[{label:"Re-valorar (peor)",path:base+"/reassessment",body:{stage:"STAGE_3",occurredAt:nowIso()},to:"OPEN"},{label:"Cicatrizada",path:base+"/healing",body:{occurredAt:nowIso()},to:"HEALED"},{label:"Escalar",path:base+"/escalation",body:{reason:ASK("Descripción del deterioro",5),occurredAt:nowIso()},to:"ESCALATED"}];
 return[];
}
export function trActions(t:{id:string;state:TrSt}):{label:string;path:string;body:Record<string,unknown>;to:TrSt}[]{
 const base=`/api/v1/triage/${t.id}`;
 if(t.state==="WAITING")return[{label:"Iniciar triage",path:base+"/start",body:{occurredAt:nowIso()},to:"IN_TRIAGE"},{label:"LWBS",path:base+"/lwbs",body:{reason:ASK("Circunstancias de la salida sin atención",5),occurredAt:nowIso()},to:"LWBS"}];
 if(t.state==="IN_TRIAGE")return[{label:"Clasificar ESI-2",path:base+"/assessment",body:{acuity:2,occurredAt:nowIso()},to:"TRIAGED"},{label:"LWBS",path:base+"/lwbs",body:{reason:ASK("Circunstancias de la salida sin atención",5),occurredAt:nowIso()},to:"LWBS"}];
 if(t.state==="TRIAGED")return[{label:"Re-clasificar ESI-1",path:base+"/assessment",body:{acuity:1,occurredAt:nowIso()},to:"TRIAGED"},{label:"Cerrar",path:base+"/closure",body:{occurredAt:nowIso()},to:"CLOSED"}];
 return[];
}
export function incActions(i:{id:string;state:IncSt}):{label:string;path:string;body:Record<string,unknown>;to:IncSt}[]{
 const base=`/api/v1/incidents/${i.id}`;const resolve={label:"Resolver",path:base+"/resolution",body:{resolution:"CAPA implementada",occurredAt:nowIso()},to:"RESOLVED" as IncSt};
 if(i.state==="REPORTED")return[{label:"Revisar",path:base+"/review",body:{occurredAt:nowIso()},to:"UNDER_REVIEW"},resolve];
 if(i.state==="UNDER_REVIEW")return[{label:"Escalar",path:base+"/escalation",body:{reason:ASK("Motivo de la escalada",5),occurredAt:nowIso()},to:"ESCALATED"},resolve];
 if(i.state==="ESCALATED")return[resolve];
 return[];
}
export function spNext(s:Sp):{label:string;path:string;body:Record<string,unknown>;to:SpSt}|null{
 if(s.state==="COLLECTED")return{label:"Enviar",path:`/api/v1/specimens/${s.id}/transit`,body:{occurredAt:nowIso()},to:"IN_TRANSIT"};
 if(s.state==="IN_TRANSIT")return{label:"Recibir",path:`/api/v1/specimens/${s.id}/receipt`,body:{occurredAt:nowIso()},to:"RECEIVED"};
 if(s.state==="RECEIVED")return{label:"Resultar",path:`/api/v1/specimens/${s.id}/result`,body:{occurredAt:nowIso()},to:"RESULTED"};
 return null;
}
export function admActions(a:{id:string;state:AdmSt}):{label:string;path:string;body:Record<string,unknown>;to:AdmSt}[]{
 const base=`/api/v1/admissions/${a.id}`;
 if(a.state==="ADMITTED"||a.state==="TRANSFERRED")return[{label:"Trasladar a UCI",path:base+"/transfer",body:{unit:"ICU",occurredAt:nowIso()},to:"TRANSFERRED"},{label:"Dar de alta",path:base+"/discharge",body:{disposition:"Alta a domicilio",occurredAt:nowIso()},to:"DISCHARGED"},{label:"Cancelar",path:base+"/cancellation",body:{reason:ASK("Motivo de la cancelación de la admisión",5),occurredAt:nowIso()},to:"CANCELLED"}];
 return[];
}
export function csActions(c:{id:string;state:CsSt}):{label:string;path:string;body:Record<string,unknown>;to:CsSt}[]{
 const base=`/api/v1/consents/${c.id}`;const w={occurredAt:nowIso()};
 if(c.state==="DRAFTED")return[{label:"Presentar",path:base+"/presentation",body:w,to:"PRESENTED"}];
 if(c.state==="PRESENTED")return[{label:"Otorgar",path:base+"/grant",body:{signerName:"Paciente/Tutor",occurredAt:nowIso()},to:"GRANTED"},{label:"Rechazar",path:base+"/decline",body:{reason:ASK("Motivo del rechazo",5),occurredAt:nowIso()},to:"DECLINED"}];
 if(c.state==="GRANTED")return[{label:"Revocar",path:base+"/revocation",body:{reason:ASK("Motivo de la revocación",5),occurredAt:nowIso()},to:"REVOKED"}];
 return[];
}
export function clmActions(c:{id:string;state:ClmSt}):{label:string;path:string;body:Record<string,unknown>;to:ClmSt}[]{
 const base=`/api/v1/claims/${c.id}`;const w={occurredAt:nowIso()};const voidAct={label:"Anular",path:base+"/void",body:{reason:ASK("Motivo de la anulación",5),occurredAt:nowIso()},to:"VOIDED" as ClmSt};
 if(c.state==="DRAFT")return[{label:"Codificar",path:base+"/coding",body:{codes:["99213"],occurredAt:nowIso()},to:"CODED"},voidAct];
 if(c.state==="CODED")return[{label:"Enviar",path:base+"/submission",body:w,to:"SUBMITTED"},voidAct];
 if(c.state==="SUBMITTED")return[{label:"Pagada",path:base+"/payment",body:{reference:"EOB-"+Date.now(),occurredAt:nowIso()},to:"PAID"},{label:"Rechazada",path:base+"/rejection",body:{reason:ASK("Motivo del rechazo del pagador",5),occurredAt:nowIso()},to:"REJECTED"}];
 if(c.state==="REJECTED")return[{label:"Reenviar",path:base+"/submission",body:w,to:"SUBMITTED"},voidAct];
 return[];
}
export function cpActions(c:{id:string;state:CpSt}):{label:string;path:string;body:Record<string,unknown>;to:CpSt}[]{
 const base=`/api/v1/care-plans/${c.id}`;const w={occurredAt:nowIso()};
 if(c.state==="PROPOSED")return[{label:"Activar",path:base+"/activation",body:w,to:"ACTIVE"},{label:"Cancelar",path:base+"/cancellation",body:{reason:ASK("Motivo",5),occurredAt:nowIso()},to:"CANCELLED"}];
 if(c.state==="ACTIVE")return[{label:"Lograda",path:base+"/achievement",body:w,to:"ACHIEVED"},{label:"Pausar",path:base+"/hold",body:w,to:"ON_HOLD"},{label:"Cancelar",path:base+"/cancellation",body:{reason:ASK("Motivo",5),occurredAt:nowIso()},to:"CANCELLED"}];
 if(c.state==="ON_HOLD")return[{label:"Reanudar",path:base+"/resumption",body:w,to:"ACTIVE"},{label:"Cancelar",path:base+"/cancellation",body:{reason:ASK("Motivo",5),occurredAt:nowIso()},to:"CANCELLED"}];
 return[];
}
export function vitActions(v:{id:string;state:VitSt;value:string;unit:string}):{label:string;path:string;body:Record<string,unknown>;to:VitSt}[]{
 const base=`/api/v1/vitals/${v.id}`;
 if(v.state==="RECORDED"||v.state==="AMENDED")return[{label:"Enmendar",path:base+"/amendment",body:{value:v.value,unit:v.unit,reason:ASK("Motivo de la corrección",5),occurredAt:nowIso()},to:"AMENDED"},{label:"Marcar error",path:base+"/error-mark",body:{reason:ASK("Motivo de marcar el registro como error",5),occurredAt:nowIso()},to:"ENTERED_IN_ERROR"}];
 return[];
}
export function immActions(i:{id:string;state:ImmSt}):{label:string;path:string;body:Record<string,unknown>;to:ImmSt}[]{
 const base=`/api/v1/immunizations/${i.id}`;
 if(i.state==="DUE")return[{label:"Aplicar",path:base+"/administration",body:{lot:"L-2026-A",site:"deltoides izq",occurredAt:nowIso()},to:"ADMINISTERED"},{label:"Rechazar",path:base+"/refusal",body:{reason:ASK("Motivo del rechazo (paciente/tutor)",5),occurredAt:nowIso()},to:"REFUSED"}];
 if(i.state==="ADMINISTERED")return[{label:"Evento adverso",path:base+"/adverse-event",body:{reaction:ASK("Descripción de la reacción transfusional",10),occurredAt:nowIso()},to:"ADVERSE_EVENT"}];
 return[];
}
export function obNext(o:Ob):{label:string;path:string;body:Record<string,unknown>;to:ObSt}|null{
 if(o.state==="OPEN")return{label:"En progreso",path:`/api/v1/obligations/${o.id}/progress`,body:{occurredAt:nowIso()},to:"IN_PROGRESS"};
 if(o.state==="IN_PROGRESS")return{label:"Completar",path:`/api/v1/obligations/${o.id}/completion`,body:{evidence:ASK("Evidencia del seguimiento realizado",10,"qué se hizo, cuándo y con qué resultado"),occurredAt:nowIso()},to:"COMPLETED"};
 return null;
}
// Tipos que estaban declarados dentro del componente Workspace (hoisteados: un tipo no depende del estado).

 // Auditoría L-05: identidad profesional del médico (nombre, cédula, institución) — exigida por el servidor para prescribir y firmar.
 export type Credentials={fullName:string;cedulaProfesional:string;institution:string;specialty:string;cedulaEspecialidad:string}; // antecedentes marcados (se componen en la nota del encuentro)
 export type AgendaAppt={appointmentId:string;patientId:string;patientName:string;startAt:string;endAt:string|null;reason:string;consultorio:string|null;apptType:string|null;status:string;version:number};
