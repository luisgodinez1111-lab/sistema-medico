"use client";
import{useEffect,useState,Fragment}from"react";
import{getStoredSession,apiRequest,logout as sessionLogout,type MedicalSession}from"../../lib/session-client";
import{summarizePatient}from"../../../../packages/patient-summary/src";
import{primitive,typography}from"../../../../packages/design-system/src";
import{labReferenceRanges}from"../../../../packages/lab-reference/src";
import{drugCatalog,interactionRules,type DrugCatalogItem}from"../../../../packages/drug-catalog/src";
import{searchIcd10}from"../../../../packages/terminology/src";
// EPIC K — Espacio de trabajo clínico. Consume los endpoints ya probados con la sesión autenticada.
// Módulos: encuentro (abrir->valorar->firmar) y medicación (proponer->prescribir->activar->suspender),
// ambos para el mismo paciente, con concurrencia optimista (If-Match).

type EncState="OPEN"|"READY_TO_SIGN"|"SIGNED";
type Encounter=Readonly<{id:string;state:EncState;version:number;signatureDigest?:string}>;
type MedState="PROPOSED"|"PRESCRIBED"|"ACTIVE"|"STOPPED";
type Med=Readonly<{id:string;label:string;state:MedState;version:number}>;
type ResState="RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED";
type Result=Readonly<{id:string;label:string;critical:boolean;state:ResState;version:number}>;
type DocState="DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED";
type Doc=Readonly<{id:string;label:string;state:DocState;version:number}>;
type OrderSt="DRAFT"|"ORDERED"|"FULFILLED"|"CANCELLED";
type Order=Readonly<{id:string;label:string;state:OrderSt;version:number}>;
type ObSt="OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";
type Ob=Readonly<{id:string;label:string;state:ObSt;version:number}>;
type ProbSt="ACTIVE"|"RESOLVED"|"CHRONIC"|"ENTERED_IN_ERROR";
type Prob=Readonly<{id:string;label:string;state:ProbSt;version:number}>;
type AlSt="ACTIVE"|"REFUTED"|"INACTIVE";
type Al=Readonly<{id:string;label:string;state:AlSt;version:number}>;
type RefSt="REQUESTED"|"ACCEPTED"|"DECLINED"|"COMPLETED"|"CANCELLED";
type Ref=Readonly<{id:string;label:string;state:RefSt;version:number}>;
type ApptSt="SCHEDULED"|"CHECKED_IN"|"COMPLETED"|"CANCELLED"|"NO_SHOW";
type Appt=Readonly<{id:string;label:string;state:ApptSt;version:number}>;
type ImmSt="DUE"|"ADMINISTERED"|"REFUSED"|"ADVERSE_EVENT";
type Imm=Readonly<{id:string;label:string;state:ImmSt;version:number}>;
type VitSt="RECORDED"|"AMENDED"|"ENTERED_IN_ERROR";
type Vit=Readonly<{id:string;vitalType:string;value:string;unit:string;state:VitSt;version:number;vstatus?:string;interp?:string}>;
type CpSt="PROPOSED"|"ACTIVE"|"ON_HOLD"|"ACHIEVED"|"CANCELLED";
type Cp=Readonly<{id:string;label:string;state:CpSt;version:number}>;
type ClmSt="DRAFT"|"CODED"|"SUBMITTED"|"PAID"|"REJECTED"|"VOIDED";
type Clm=Readonly<{id:string;label:string;state:ClmSt;version:number}>;
type CsSt="DRAFTED"|"PRESENTED"|"GRANTED"|"DECLINED"|"REVOKED";
type Cs=Readonly<{id:string;label:string;state:CsSt;version:number}>;
type AdmSt="ADMITTED"|"TRANSFERRED"|"DISCHARGED"|"CANCELLED";
type Adm=Readonly<{id:string;unit:string;state:AdmSt;version:number}>;
type SpSt="COLLECTED"|"IN_TRANSIT"|"RECEIVED"|"RESULTED"|"REJECTED";
type Sp=Readonly<{id:string;specimenType:string;state:SpSt;version:number}>;
type IncSt="REPORTED"|"UNDER_REVIEW"|"ESCALATED"|"RESOLVED";
type Inc=Readonly<{id:string;label:string;state:IncSt;version:number}>;
type TrSt="WAITING"|"IN_TRIAGE"|"TRIAGED"|"CLOSED"|"LWBS";
type Tr=Readonly<{id:string;chiefComplaint:string;acuity:number;state:TrSt;version:number}>;
type WnSt="OPEN"|"HEALED"|"ESCALATED";
type Wn=Readonly<{id:string;location:string;stage:string;state:WnSt;version:number}>;
type TfSt="ORDERED"|"CROSSMATCHED"|"TRANSFUSING"|"COMPLETED"|"REACTION"|"CANCELLED";
type Tf=Readonly<{id:string;product:string;units:string;state:TfSt;version:number}>;
type SgSt="SCHEDULED"|"TIMED_OUT"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";
type Sg=Readonly<{id:string;procedure:string;state:SgSt;version:number}>;
type DzSt="SCHEDULED"|"IN_SESSION"|"INTERRUPTED"|"COMPLETED"|"CANCELLED"|"NO_SHOW";
type Dz=Readonly<{id:string;modality:string;state:DzSt;version:number}>;
type TL=Readonly<{aggregateType:string;aggregateId:string;latestKind:string;version:number;lastAt:string}>;
type Gap=Readonly<{aggregateType:string;aggregateId:string;code:string;label:string;priority:"HIGH"|"MEDIUM"|"LOW"}>;
type PanelGap=Gap&Readonly<{patientId:string}>;
type IxSev="CONTRAINDICATED"|"MAJOR"|"MODERATE"|"MINOR";
type IxFinding=Readonly<{kind:"pair"|"factor";severity:IxSev;severityLabel:string;a:string;b:string;mechanism:string;recommendation:string}>;
type IxResult=Readonly<{findings:IxFinding[];counts:Record<IxSev,number>;highestSeverity:IxSev|null;highestSeverityLabel:string|null;resolvedDrugs:{input:string;ingredient:string|null;classes:string[]}[];resolvedFactors:{input:string;code:string|null}[];unresolvedDrugs:string[];unresolvedFactors:string[]}>;
type AllergenType="Medicamento"|"Alimento"|"Ambiental"|"Contraste"|"Otros";
type AllergyItem=Readonly<{allergyId:string;patientId:string;patientName:string;substance:string;type:AllergenType;reaction:string;severity:"MILD"|"MODERATE"|"SEVERE";severityLabel:string;status:"ACTIVE"|"REFUTED"|"INACTIVE";statusLabel:string;recordedAt:string;registeredBy:string}>;
type AllergyRegistry=Readonly<{items:AllergyItem[];total:number;patientsWithAllergies:number;bySeverity:{grave:number;moderada:number;leve:number;incierta:number};byType:Record<AllergenType,number>;activeCount:number}>;
type ProblemStatus="ACTIVE"|"CHRONIC"|"RESOLVED"|"INACTIVE";
type ProblemItem=Readonly<{problemId:string;patientId:string;patientName:string;code:string;description:string;category:string;chronic:boolean;status:ProblemStatus;statusLabel:string;recordedAt:string;registeredBy:string}>;
type ProblemRegistry=Readonly<{items:ProblemItem[];total:number;byStatus:{activos:number;enSeguimiento:number;resueltos:number;inactivos:number};byCategory:Record<string,number>;topPatients:{name:string;count:number}[]}>;
type IcdEntry=Readonly<{code:string;description:string;category:string}>;
type ImmStatus="COMPLETE"|"PENDING"|"REFUSED"|"ADVERSE";
type ImmItem=Readonly<{immunizationId:string;patientId:string;patientName:string;vaccine:string;dose:string;lot:string;site:string;status:ImmStatus;statusLabel:string;appliedAt:string;registeredBy:string}>;
type ImmRegistry=Readonly<{items:ImmItem[];total:number;appliedCount:number;pendingCount:number;vaccinatedPatients:number;incompleteSchemes:number;byVaccine:Record<string,number>}>;
type VitalRecord=Readonly<{at:string;ta:string;fc:string;fr:string;temp:string;spo2:string;peso:string;talla:string;imc:string}>;
type VitalHistory=Readonly<{records:VitalRecord[];series:{BP:{value:number;at:string}[];HR:{value:number;at:string}[];WEIGHT:{value:number;at:string}[];IMC:{value:number;at:string}[]};latest:VitalRecord|null;count:number}>;
type CarePlanSnap=Readonly<{counts:{problems:number;medications:number;allergies:number};problems:{code:string;description:string;status:string;statusLabel:string}[];goals:{category:string;goal:string;status:string;statusLabel:string}[];metrics:{hba1c:string|null;bp:string|null;weight:string|null;imc:string|null}}>;
type RefContext=Readonly<{allergies:string[];medications:string[];problems:{code:string;description:string}[];labs:{hba1c:string|null};vitals:{bp:string|null;hr:string|null;imc:string|null}}>;
type FUDelta={first:number;last:number}|null;
type FollowUpSnap=Readonly<{tasks:{obligationId:string;task:string;dueAt:string;status:string;statusLabel:string;done:boolean}[];vitalsTrend:{series:{BP:number[];HR:number[];WEIGHT:number[];IMC:number[]};avg:{ta:string|null;bp:number|null;hr:number|null;weight:number|null;imc:number|null}};indicators:{hba1c:FUDelta;ldl:FUDelta;weight:FUDelta;imc:FUDelta};counts:{problems:number;medications:number;allergies:number}}>;
type ClaimItem=Readonly<{claimId:string;folio:string;patientId:string;patientName:string;amount:number;currency:string;status:string;statusLabel:string;recordedAt:string}>;
type ClaimsRegistry=Readonly<{items:ClaimItem[];total:number;incomeThisMonth:number;issuedCount:number;pendingCount:number;pendingAmount:number;cancellations:number}>;
type DocItem=Readonly<{documentId:string;title:string;docType:string;typeLabel:string;status:string;statusLabel:string;createdAt:string;actorId:string}>;
type DocsSnap=Readonly<{items:DocItem[];total:number;byType:Record<string,number>;chips:{clinical:number;consents:number;studies:number}}>;
type ResultItem=Readonly<{resultId:string;patientId:string;patientName:string;analyte:string;value:string;critical:boolean;status:string;interpretation:string;tipo:string;estado:string;lifecycle:string;receivedAt:string}>;
type ResultsRegistry=Readonly<{items:ResultItem[];total:number;abnormal:number;enSeguimiento:number;pendientes:number}>;
type ConsTabs=Readonly<{results:{analyte:string;value:string;estado:string;critical:boolean;receivedAt:string}[];orders:{typeLabel:string;detail:string;status:string;createdAt:string}[];medications:string[];planGoals:{goal:string;statusLabel:string}[];documents:{title:string;typeLabel:string;createdAt:string}[];obligations:{task:string;dueAt:string;statusLabel:string;done:boolean}[]}>;
type RegObItem=Readonly<{obligationId:string;name:string;category:string;periodicity:string;dueDate:string|null;estado:string;daysUntil:number|null}>;
type RegObSnap=Readonly<{items:RegObItem[];total:number;alDia:number;proximas:number;vencidas:number;compliance:Record<string,number>}>;
type CiFinding=Readonly<{domain:string;severity:string;summary:string}>;
type CiSnap=Readonly<{registered:boolean;problems?:string[];allergies?:string[];labs?:{hba1c?:number;egfr?:number};findings?:CiFinding[];demographics?:{age:number;sex:string}}>;
type ReportsSnap=Readonly<{patientsAttended:number;income:number;diagnosesTotal:number;topDiagnoses:{code:string;description:string;count:number;pct:number}[]}>;
const TYPE_LABEL:Record<string,string>={Encounter:"Encuentro",ClinicalOrder:"Orden",Medication:"Medicación",DiagnosticResult:"Resultado",ClinicalDocument:"Documento",ClinicalObligation:"Obligación",ClinicalProblem:"Problema",Allergy:"Alergia",Referral:"Interconsulta",Appointment:"Cita",Immunization:"Vacuna",VitalSign:"Signo vital",CarePlan:"Plan de cuidados",Claim:"Facturación",Consent:"Consentimiento",Admission:"Internamiento",Specimen:"Muestra",Incident:"Incidente",Triage:"Triage",Wound:"Herida/UPP",Transfusion:"Transfusión",Surgery:"Cirugía",Dialysis:"Diálisis"};
// Hero de consulta — etiqueta clínica corta desde el código CIE-10 (chips de diagnóstico).
const DX_LABEL=(code:string):string=>{const c=code.trim().toUpperCase();
 const m:[string,string][]=[["N18.3","ERC G3a"],["N18.4","ERC G3b"],["N18.5","ERC G4"],["N18.6","ERC G5"],["N18","ERC"],["I10","HTA"],["E11","DM2"],["E10","DM1"],["E78","Dislipidemia"],["I50","IC"],["I48","FA"],["J44","EPOC"],["J45","Asma"],["I25","Cardiopatía isq."],["E66","Obesidad"],["M15","Osteoartrosis"],["M17","Gonartrosis"],["F32","Depresión"],["K21","ERGE"]];
 for(const[p,l]of m)if(c.startsWith(p))return l;return c;};
type Snap=Readonly<{demographics:{age:number;sex:string;birthDate:string;name?:string;curp?:string;phone?:string;email?:string;address?:string;occupation?:string;maritalStatus?:string};problems:string[];allergies:string[];vitals:Record<string,string>;labs:{hba1c?:number;creatinine?:number;glucose?:number;ldl?:number;egfr?:number;egfrStage?:string};findings:{domain:string;severity:"CRITICAL"|"WARNING"|"INFO";summary:string}[]}>;
const SEX_ES:Record<string,string>={FEMALE:"Femenino",MALE:"Masculino",INTERSEX:"Intersexual",UNKNOWN:"Sin especificar"};
// Tiempo relativo compacto (panel de auditoría / actividad).
function relTime(iso:string):string{try{const d=Date.now()-new Date(iso).getTime();const m=Math.floor(d/60000);if(m<1)return "ahora";if(m<60)return `hace ${m} min`;const h=Math.floor(m/60);if(h<24)return `hace ${h} h`;const dd=Math.floor(h/24);return dd<30?`hace ${dd} d`:new Date(iso).toLocaleDateString("es-MX",{day:"2-digit",month:"short"});}catch{return "";}}
// Panel 5 — clasificación del estado de un follow-up (por latestKind del agregado).
const FOLLOW_TYPES=new Set(["ClinicalObligation","Referral","Appointment","Immunization","CarePlan"]);
const DONE_KINDS=new Set(["COMPLETED","FULFILLED","ADMINISTERED","ACHIEVED","CLOSED"]);
const SCHED_KINDS=new Set(["IN_PROGRESS","ACCEPTED","CHECKED_IN","SCHEDULED","ACTIVE","PROGRESSED"]);
const CANCEL_KINDS=new Set(["CANCELLED","DECLINED","NO_SHOW","REVOKED","ENTERED_IN_ERROR"]);
function followState(kind:string):"pend"|"prog"|"done"|"skip"{if(DONE_KINDS.has(kind))return "done";if(CANCEL_KINDS.has(kind))return "skip";if(SCHED_KINDS.has(kind))return "prog";return "pend";}
type RxCheck=Readonly<{drug:{input:string;resolved:{ingredient:string;classes:string[]}|null};egfr:number|null;checks:{id:string;label:string;status:"OK"|"WARN"|"BLOCK";detail:string}[];monitoring:{test:string;note:string;dueInDays:number}[];indications:string;verdict:"OK"|"WARN"|"BLOCK"}>;
// Panel 4 — evolución longitudinal
type Series=readonly{value:number;at:string}[];
type Trends=Readonly<{series:Record<string,Series>;latest:{LDL:number|null;CREATININE:number|null;UACR:number|null;EGFR:number|null}}>;
type TrendKey="HBA1C"|"GLUCOSE"|"LDL"|"CREATININE";
const CHART:Record<TrendKey,{label:string;unit:string;target?:number;targetLabel?:string;domain:[number,number]}>={
 HBA1C:{label:"HbA1c",unit:"%",target:7,targetLabel:"Objetivo <7%",domain:[4,11]},
 GLUCOSE:{label:"Glucosa (ayuno)",unit:"mg/dL",target:100,targetLabel:"Meta <100 mg/dL",domain:[60,220]},
 LDL:{label:"Colesterol LDL",unit:"mg/dL",target:100,targetLabel:"Meta <100 mg/dL",domain:[40,220]},
 CREATININE:{label:"Creatinina",unit:"mg/dL",domain:[0.4,3]},
};
const fmtN=(v:number)=>v%1?v.toFixed(1):String(v);
function trendChart(series:Series,key:TrendKey){
 const cfg=CHART[key];
 if(!series.length)return <div style={{padding:"28px 0",textAlign:"center",color:"#8a8b9a",fontSize:13}}>Sin datos de {cfg.label} todavía. Registra resultados para ver la tendencia.</div>;
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
const SEV:Record<"CRITICAL"|"WARNING"|"INFO",{label:string;bg:string;fg:string;bd:string}>={
 CRITICAL:{label:"ALTA",bg:"#FDEAEA",fg:"#B3261E",bd:"#F3C9C9"},
 WARNING:{label:"IMPORTANTE",bg:"#FFF4E5",fg:"#A15C00",bd:"#F0DBB8"},
 INFO:{label:"SUGERENCIA",bg:"#EEF3FB",fg:"#2C5AA6",bd:"#D3E0F5"}};
function alActions(a:{id:string;state:AlSt}):{label:string;path:string;body:Record<string,unknown>;to:AlSt}[]{
 const now=new Date().toISOString();const base=`/api/v1/allergies/${a.id}`;
 if(a.state==="ACTIVE")return[{label:"Refutar",path:base+"/refutation",body:{occurredAt:now},to:"REFUTED"},{label:"Inactivar",path:base+"/inactivation",body:{occurredAt:now},to:"INACTIVE"}];
 if(a.state==="INACTIVE")return[{label:"Reactivar",path:base+"/reactivation",body:{occurredAt:now},to:"ACTIVE"}];
 return[];
}
function probActions(p:{id:string;state:ProbSt}):{label:string;path:string;body:Record<string,unknown>;to:ProbSt}[]{
 const now=new Date().toISOString();const base=`/api/v1/problems/${p.id}`;
 if(p.state==="ACTIVE")return[{label:"Resolver",path:base+"/resolution",body:{note:"Resuelto",occurredAt:now},to:"RESOLVED"},{label:"Crónico",path:base+"/chronicity",body:{occurredAt:now},to:"CHRONIC"}];
 if(p.state==="RESOLVED")return[{label:"Reactivar",path:base+"/reactivation",body:{occurredAt:now},to:"ACTIVE"}];
 if(p.state==="CHRONIC")return[{label:"Resolver",path:base+"/resolution",body:{note:"Resuelto",occurredAt:now},to:"RESOLVED"}];
 return[];
}

// Tokens del design-system (único origen de verdad). El app-shell y las tarjetas se derivan de aquí.
const P=primitive.color,S=primitive.space,UI=typography.family.ui;
const LINE="#E4E9F2";
const shell:React.CSSProperties={minHeight:"100vh",background:P.canvas,fontFamily:UI,color:P.ink};
const appbar:React.CSSProperties={position:"sticky",top:0,zIndex:30,background:P.white,borderBottom:`1px solid ${LINE}`,padding:"11px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"};
const patientBar:React.CSSProperties={position:"sticky",top:57,zIndex:25,background:"rgba(255,255,255,.92)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",borderBottom:`1px solid ${LINE}`,padding:"11px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16};
const content:React.CSSProperties={maxWidth:1140,margin:"0 auto",padding:`${S[5]}px ${S[5]}px ${S[12]}px`};
// Sidebar del expediente (diseño exacto S1.png): navegación primaria con íconos + badges en tiempo real.
// h2:"" => volver arriba (Inicio). badge: clave del conteo real; badgeColor rojo=urgente, morado=informativo.
type BadgeKey="agenda"|"resultados"|"seguimiento"|"obligaciones";
const SIDE_NAV:{label:string;h2:string;icon:string;badge?:BadgeKey;badgeColor?:"r"|"p"}[]=[
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
const TOOLS_NAV:{label:string;h2:string;icon:string}[]=[
 {label:"Biblioteca clínica",h2:"",icon:"book"},
 {label:"Configuración",h2:"",icon:"gear"},
];
const ICONS:Record<string,string>={
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
function NavIcon({k}:{k:string}){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONS[k]??ICONS.home}/></svg>;}
function scrollToSection(h2Text:string){
 if(!h2Text){window.scrollTo({top:0,behavior:"smooth"});return;}
 const h=Array.from(document.querySelectorAll("h2")).find(e=>e.textContent?.trim()===h2Text);
 h?.closest("section")?.scrollIntoView({behavior:"smooth",block:"start"});
}
const RAIL_CSS=`
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
const wrap:React.CSSProperties={maxWidth:1080,margin:"0 auto",padding:S[8],minHeight:"100vh",background:P.canvas,fontFamily:UI,color:P.ink};
const card:React.CSSProperties={background:P.white,border:`1px solid ${LINE}`,borderRadius:16,padding:S[6],boxShadow:"0 1px 2px rgba(16,42,86,.04),0 8px 24px rgba(16,42,86,.05)",marginTop:S[5]};
const btn:React.CSSProperties={background:P.blue,color:"#fff",border:0,borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:UI};
const ghost:React.CSSProperties={...btn,background:"transparent",color:P.blue,border:"1px solid #CFE0F7"};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"10px 12px",border:`1px solid ${LINE}`,borderRadius:10,fontSize:14,fontFamily:"inherit",background:"#fff",color:P.ink};
const mono:React.CSSProperties={fontFamily:"ui-monospace,Menlo,monospace",fontSize:12,background:"#EEF3FB",color:"#33507D",padding:"2px 6px",borderRadius:6};
const lbl:React.CSSProperties={fontSize:13,fontWeight:600,color:"#3C4658",display:"block",margin:"12px 0 6px"};
function stateBadge(s:string){const m:Record<string,[string,string]>={SIGNED:["#e8f7ee","#1a7f43"],READY_TO_SIGN:["#fff4e5","#a15c00"],OPEN:["#eef0ff","#3f3aa0"],PROPOSED:["#eef0ff","#3f3aa0"],PRESCRIBED:["#eaf3ff","#1f5fb0"],ACTIVE:["#e8f7ee","#1a7f43"],STOPPED:["#f1f1f4","#5f6072"],RECEIVED:["#eef0ff","#3f3aa0"],VERIFIED:["#eaf3ff","#1f5fb0"],ACTIONED:["#fff4e5","#a15c00"],CLOSED:["#e8f7ee","#1a7f43"],DRAFT:["#eef0ff","#3f3aa0"],FINALIZED:["#eaf3ff","#1f5fb0"],AMENDED:["#e8f7ee","#1a7f43"],ORDERED:["#eaf3ff","#1f5fb0"],FULFILLED:["#e8f7ee","#1a7f43"],CANCELLED:["#f1f1f4","#5f6072"],IN_PROGRESS:["#fff4e5","#a15c00"],COMPLETED:["#e8f7ee","#1a7f43"],ACTIVE_PROB:["#eef0ff","#3f3aa0"],RESOLVED:["#f1f1f4","#5f6072"],CHRONIC:["#fff4e5","#a15c00"],ENTERED_IN_ERROR:["#f1f1f4","#5f6072"],REFUTED:["#f1f1f4","#5f6072"],INACTIVE:["#f1f1f4","#5f6072"],REQUESTED:["#eef0ff","#3f3aa0"],ACCEPTED:["#eaf3ff","#1f5fb0"],DECLINED:["#f1f1f4","#5f6072"],SCHEDULED:["#eef0ff","#3f3aa0"],CHECKED_IN:["#fff4e5","#a15c00"],NO_SHOW:["#f1f1f4","#5f6072"],DUE:["#eef0ff","#3f3aa0"],ADMINISTERED:["#e8f7ee","#1a7f43"],ADVERSE_EVENT:["#fdeaea","#b3261e"],RECORDED:["#e8f7ee","#1a7f43"],ON_HOLD:["#fff4e5","#a15c00"],ACHIEVED:["#e8f7ee","#1a7f43"],CODED:["#eaf3ff","#1f5fb0"],SUBMITTED:["#fff4e5","#a15c00"],PAID:["#e8f7ee","#1a7f43"],REJECTED:["#fdeaea","#b3261e"],VOIDED:["#f1f1f4","#5f6072"],DRAFTED:["#eef0ff","#3f3aa0"],PRESENTED:["#fff4e5","#a15c00"],GRANTED:["#e8f7ee","#1a7f43"],REVOKED:["#f1f1f4","#5f6072"],ADMITTED:["#e8f7ee","#1a7f43"],TRANSFERRED:["#fff4e5","#a15c00"],DISCHARGED:["#eef0ff","#3f3aa0"],COLLECTED:["#eef0ff","#3f3aa0"],RESULTED:["#e8f7ee","#1a7f43"],UNDER_REVIEW:["#fff4e5","#a15c00"],ESCALATED:["#fdeaea","#b3261e"],WAITING:["#eef0ff","#3f3aa0"],IN_TRIAGE:["#fff4e5","#a15c00"],TRIAGED:["#eaf3ff","#1f5fb0"],LWBS:["#f1f1f4","#5f6072"],HEALED:["#e8f7ee","#1a7f43"],CROSSMATCHED:["#eaf3ff","#1f5fb0"],TRANSFUSING:["#fff4e5","#a15c00"],REACTION:["#fdeaea","#b3261e"],TIMED_OUT:["#eaf3ff","#1f5fb0"],IN_SESSION:["#fff4e5","#a15c00"],INTERRUPTED:["#fdeaea","#b3261e"]};const c=m[s]??["#eef0ff","#3f3aa0"];return{display:"inline-block",background:c[0],color:c[1],fontWeight:700,fontSize:12,padding:"3px 10px",borderRadius:999};}
const in7days=()=>new Date(Date.now()+7*864e5).toISOString();
const uuid=()=>globalThis.crypto.randomUUID();
const nowIso=()=>new Date().toISOString();
function errMsg(r:{status:number;body:Record<string,unknown>}):string{const e=r.body["error"] as{code?:string;message?:string}|undefined;return `${r.status} ${e?.code??""} ${e?.message??""}`.trim();}
// Siguiente transición de una medicación (label, ruta, cuerpo, estado destino).
function medNext(m:Med):{label:string;path:string;body:Record<string,unknown>;to:MedState}|null{
 if(m.state==="PROPOSED")return{label:"Prescribir",path:`/api/v1/medications/${m.id}/prescription`,body:{occurredAt:nowIso()},to:"PRESCRIBED"};
 if(m.state==="PRESCRIBED")return{label:"Activar",path:`/api/v1/medications/${m.id}/activation`,body:{occurredAt:nowIso()},to:"ACTIVE"};
 if(m.state==="ACTIVE")return{label:"Suspender",path:`/api/v1/medications/${m.id}/discontinuation`,body:{reason:"Suspendido por el médico",occurredAt:nowIso()},to:"STOPPED"};
 return null;
}
// Siguiente transición de un resultado diagnóstico (closed-loop de seguimiento).
function resNext(r:Result):{label:string;path:string;body:Record<string,unknown>;to:ResState}|null{
 if(r.state==="RECEIVED")return{label:"Verificar",path:`/api/v1/results/${r.id}/verification`,body:{occurredAt:nowIso()},to:"VERIFIED"};
 if(r.state==="VERIFIED")return{label:"Requiere acción",path:`/api/v1/results/${r.id}/action`,body:{ownerId:uuid(),dueAt:in7days(),occurredAt:nowIso()},to:"ACTIONED"};
 if(r.state==="ACTIONED")return{label:"Cerrar",path:`/api/v1/results/${r.id}/closure`,body:{evidence:"Paciente contactado y tratado",occurredAt:nowIso()},to:"CLOSED"};
 return null;
}
// Siguiente transición de un documento clínico (borrador -> finalizado -> firmado -> enmendado).
function docNext(d:Doc):{label:string;path:string;body:Record<string,unknown>;to:DocState}|null{
 if(d.state==="DRAFT")return{label:"Finalizar",path:`/api/v1/documents/${d.id}/finalization`,body:{occurredAt:nowIso()},to:"FINALIZED"};
 if(d.state==="FINALIZED")return{label:"Firmar",path:`/api/v1/documents/${d.id}/signature`,body:{occurredAt:nowIso()},to:"SIGNED"};
 if(d.state==="SIGNED"||d.state==="AMENDED")return{label:"Enmendar",path:`/api/v1/documents/${d.id}/amendment`,body:{addendum:"Addendum clínico",occurredAt:nowIso()},to:"AMENDED"};
 return null;
}
function orderNext(o:Order):{label:string;path:string;body:Record<string,unknown>;to:OrderSt}|null{
 if(o.state==="DRAFT")return{label:"Colocar",path:`/api/v1/orders/${o.id}/placement`,body:{occurredAt:nowIso()},to:"ORDERED"};
 if(o.state==="ORDERED")return{label:"Cumplir",path:`/api/v1/orders/${o.id}/fulfillment`,body:{occurredAt:nowIso()},to:"FULFILLED"};
 return null;
}
function referralNext(r:Ref):{label:string;path:string;body:Record<string,unknown>;to:RefSt}|null{
 if(r.state==="REQUESTED")return{label:"Aceptar",path:`/api/v1/referrals/${r.id}/acceptance`,body:{occurredAt:nowIso()},to:"ACCEPTED"};
 if(r.state==="ACCEPTED")return{label:"Completar",path:`/api/v1/referrals/${r.id}/completion`,body:{occurredAt:nowIso()},to:"COMPLETED"};
 return null;
}
function apptNext(a:Appt):{label:string;path:string;body:Record<string,unknown>;to:ApptSt}|null{
 if(a.state==="SCHEDULED")return{label:"Registrar llegada",path:`/api/v1/appointments/${a.id}/check-in`,body:{occurredAt:nowIso()},to:"CHECKED_IN"};
 if(a.state==="CHECKED_IN")return{label:"Completar",path:`/api/v1/appointments/${a.id}/completion`,body:{occurredAt:nowIso()},to:"COMPLETED"};
 return null;
}
function dzActions(d:{id:string;state:DzSt}):{label:string;path:string;body:Record<string,unknown>;to:DzSt}[]{
 const base=`/api/v1/dialysis-sessions/${d.id}`;
 if(d.state==="SCHEDULED")return[{label:"Iniciar",path:base+"/start",body:{occurredAt:nowIso()},to:"IN_SESSION"},{label:"No-show",path:base+"/no-show",body:{occurredAt:nowIso()},to:"NO_SHOW"}];
 if(d.state==="IN_SESSION")return[{label:"Completar",path:base+"/completion",body:{occurredAt:nowIso()},to:"COMPLETED"},{label:"Interrumpir",path:base+"/interruption",body:{reason:"Complicación",occurredAt:nowIso()},to:"INTERRUPTED"}];
 if(d.state==="INTERRUPTED")return[{label:"Reanudar",path:base+"/resumption",body:{occurredAt:nowIso()},to:"IN_SESSION"},{label:"Completar",path:base+"/completion",body:{occurredAt:nowIso()},to:"COMPLETED"}];
 return[];
}
function sgNext(s:Sg):{label:string;path:string;body:Record<string,unknown>;to:SgSt}|null{
 if(s.state==="SCHEDULED")return{label:"Time-out OMS",path:`/api/v1/surgeries/${s.id}/timeout`,body:{occurredAt:nowIso()},to:"TIMED_OUT"};
 if(s.state==="TIMED_OUT")return{label:"Iniciar",path:`/api/v1/surgeries/${s.id}/start`,body:{occurredAt:nowIso()},to:"IN_PROGRESS"};
 if(s.state==="IN_PROGRESS")return{label:"Completar",path:`/api/v1/surgeries/${s.id}/completion`,body:{outcome:"Sin complicaciones",occurredAt:nowIso()},to:"COMPLETED"};
 return null;
}
function tfNext(t:Tf):{label:string;path:string;body:Record<string,unknown>;to:TfSt}|null{
 if(t.state==="ORDERED")return{label:"Cruzar (crossmatch)",path:`/api/v1/transfusions/${t.id}/crossmatch`,body:{occurredAt:nowIso()},to:"CROSSMATCHED"};
 if(t.state==="CROSSMATCHED")return{label:"Iniciar",path:`/api/v1/transfusions/${t.id}/start`,body:{occurredAt:nowIso()},to:"TRANSFUSING"};
 if(t.state==="TRANSFUSING")return{label:"Completar",path:`/api/v1/transfusions/${t.id}/completion`,body:{occurredAt:nowIso()},to:"COMPLETED"};
 return null;
}
function wnActions(w:{id:string;state:WnSt}):{label:string;path:string;body:Record<string,unknown>;to:WnSt}[]{
 const base=`/api/v1/wounds/${w.id}`;
 if(w.state==="OPEN")return[{label:"Re-valorar (peor)",path:base+"/reassessment",body:{stage:"STAGE_3",occurredAt:nowIso()},to:"OPEN"},{label:"Cicatrizada",path:base+"/healing",body:{occurredAt:nowIso()},to:"HEALED"},{label:"Escalar",path:base+"/escalation",body:{reason:"Deterioro",occurredAt:nowIso()},to:"ESCALATED"}];
 return[];
}
function trActions(t:{id:string;state:TrSt}):{label:string;path:string;body:Record<string,unknown>;to:TrSt}[]{
 const base=`/api/v1/triage/${t.id}`;
 if(t.state==="WAITING")return[{label:"Iniciar triage",path:base+"/start",body:{occurredAt:nowIso()},to:"IN_TRIAGE"},{label:"LWBS",path:base+"/lwbs",body:{reason:"Se retiró sin ser visto",occurredAt:nowIso()},to:"LWBS"}];
 if(t.state==="IN_TRIAGE")return[{label:"Clasificar ESI-2",path:base+"/assessment",body:{acuity:2,occurredAt:nowIso()},to:"TRIAGED"},{label:"LWBS",path:base+"/lwbs",body:{reason:"Se retiró sin ser visto",occurredAt:nowIso()},to:"LWBS"}];
 if(t.state==="TRIAGED")return[{label:"Re-clasificar ESI-1",path:base+"/assessment",body:{acuity:1,occurredAt:nowIso()},to:"TRIAGED"},{label:"Cerrar",path:base+"/closure",body:{occurredAt:nowIso()},to:"CLOSED"}];
 return[];
}
function incActions(i:{id:string;state:IncSt}):{label:string;path:string;body:Record<string,unknown>;to:IncSt}[]{
 const base=`/api/v1/incidents/${i.id}`;const resolve={label:"Resolver",path:base+"/resolution",body:{resolution:"CAPA implementada",occurredAt:nowIso()},to:"RESOLVED" as IncSt};
 if(i.state==="REPORTED")return[{label:"Revisar",path:base+"/review",body:{occurredAt:nowIso()},to:"UNDER_REVIEW"},resolve];
 if(i.state==="UNDER_REVIEW")return[{label:"Escalar",path:base+"/escalation",body:{reason:"Riesgo alto",occurredAt:nowIso()},to:"ESCALATED"},resolve];
 if(i.state==="ESCALATED")return[resolve];
 return[];
}
function spNext(s:Sp):{label:string;path:string;body:Record<string,unknown>;to:SpSt}|null{
 if(s.state==="COLLECTED")return{label:"Enviar",path:`/api/v1/specimens/${s.id}/transit`,body:{occurredAt:nowIso()},to:"IN_TRANSIT"};
 if(s.state==="IN_TRANSIT")return{label:"Recibir",path:`/api/v1/specimens/${s.id}/receipt`,body:{occurredAt:nowIso()},to:"RECEIVED"};
 if(s.state==="RECEIVED")return{label:"Resultar",path:`/api/v1/specimens/${s.id}/result`,body:{occurredAt:nowIso()},to:"RESULTED"};
 return null;
}
function admActions(a:{id:string;state:AdmSt}):{label:string;path:string;body:Record<string,unknown>;to:AdmSt}[]{
 const base=`/api/v1/admissions/${a.id}`;
 if(a.state==="ADMITTED"||a.state==="TRANSFERRED")return[{label:"Trasladar a UCI",path:base+"/transfer",body:{unit:"ICU",occurredAt:nowIso()},to:"TRANSFERRED"},{label:"Dar de alta",path:base+"/discharge",body:{disposition:"Alta a domicilio",occurredAt:nowIso()},to:"DISCHARGED"},{label:"Cancelar",path:base+"/cancellation",body:{reason:"Admisión por error",occurredAt:nowIso()},to:"CANCELLED"}];
 return[];
}
function csActions(c:{id:string;state:CsSt}):{label:string;path:string;body:Record<string,unknown>;to:CsSt}[]{
 const base=`/api/v1/consents/${c.id}`;const w={occurredAt:nowIso()};
 if(c.state==="DRAFTED")return[{label:"Presentar",path:base+"/presentation",body:w,to:"PRESENTED"}];
 if(c.state==="PRESENTED")return[{label:"Otorgar",path:base+"/grant",body:{signerName:"Paciente/Tutor",occurredAt:nowIso()},to:"GRANTED"},{label:"Rechazar",path:base+"/decline",body:{reason:"Paciente no acepta",occurredAt:nowIso()},to:"DECLINED"}];
 if(c.state==="GRANTED")return[{label:"Revocar",path:base+"/revocation",body:{reason:"Paciente revoca",occurredAt:nowIso()},to:"REVOKED"}];
 return[];
}
function clmActions(c:{id:string;state:ClmSt}):{label:string;path:string;body:Record<string,unknown>;to:ClmSt}[]{
 const base=`/api/v1/claims/${c.id}`;const w={occurredAt:nowIso()};const voidAct={label:"Anular",path:base+"/void",body:{reason:"Anulada",occurredAt:nowIso()},to:"VOIDED" as ClmSt};
 if(c.state==="DRAFT")return[{label:"Codificar",path:base+"/coding",body:{codes:["99213"],occurredAt:nowIso()},to:"CODED"},voidAct];
 if(c.state==="CODED")return[{label:"Enviar",path:base+"/submission",body:w,to:"SUBMITTED"},voidAct];
 if(c.state==="SUBMITTED")return[{label:"Pagada",path:base+"/payment",body:{reference:"EOB-"+Date.now(),occurredAt:nowIso()},to:"PAID"},{label:"Rechazada",path:base+"/rejection",body:{reason:"Rechazo del pagador",occurredAt:nowIso()},to:"REJECTED"}];
 if(c.state==="REJECTED")return[{label:"Reenviar",path:base+"/submission",body:w,to:"SUBMITTED"},voidAct];
 return[];
}
function cpActions(c:{id:string;state:CpSt}):{label:string;path:string;body:Record<string,unknown>;to:CpSt}[]{
 const base=`/api/v1/care-plans/${c.id}`;const w={occurredAt:nowIso()};
 if(c.state==="PROPOSED")return[{label:"Activar",path:base+"/activation",body:w,to:"ACTIVE"},{label:"Cancelar",path:base+"/cancellation",body:{reason:"No procede",occurredAt:nowIso()},to:"CANCELLED"}];
 if(c.state==="ACTIVE")return[{label:"Lograda",path:base+"/achievement",body:w,to:"ACHIEVED"},{label:"Pausar",path:base+"/hold",body:w,to:"ON_HOLD"},{label:"Cancelar",path:base+"/cancellation",body:{reason:"No procede",occurredAt:nowIso()},to:"CANCELLED"}];
 if(c.state==="ON_HOLD")return[{label:"Reanudar",path:base+"/resumption",body:w,to:"ACTIVE"},{label:"Cancelar",path:base+"/cancellation",body:{reason:"No procede",occurredAt:nowIso()},to:"CANCELLED"}];
 return[];
}
function vitActions(v:{id:string;state:VitSt;value:string;unit:string}):{label:string;path:string;body:Record<string,unknown>;to:VitSt}[]{
 const base=`/api/v1/vitals/${v.id}`;
 if(v.state==="RECORDED"||v.state==="AMENDED")return[{label:"Enmendar",path:base+"/amendment",body:{value:v.value,unit:v.unit,reason:"Corrección clínica",occurredAt:nowIso()},to:"AMENDED"},{label:"Marcar error",path:base+"/error-mark",body:{reason:"Captura errónea",occurredAt:nowIso()},to:"ENTERED_IN_ERROR"}];
 return[];
}
function immActions(i:{id:string;state:ImmSt}):{label:string;path:string;body:Record<string,unknown>;to:ImmSt}[]{
 const base=`/api/v1/immunizations/${i.id}`;
 if(i.state==="DUE")return[{label:"Aplicar",path:base+"/administration",body:{lot:"L-2026-A",site:"deltoides izq",occurredAt:nowIso()},to:"ADMINISTERED"},{label:"Rechazar",path:base+"/refusal",body:{reason:"Rechazo del paciente/tutor",occurredAt:nowIso()},to:"REFUSED"}];
 if(i.state==="ADMINISTERED")return[{label:"Evento adverso",path:base+"/adverse-event",body:{reaction:"Reacción reportada",occurredAt:nowIso()},to:"ADVERSE_EVENT"}];
 return[];
}
function obNext(o:Ob):{label:string;path:string;body:Record<string,unknown>;to:ObSt}|null{
 if(o.state==="OPEN")return{label:"En progreso",path:`/api/v1/obligations/${o.id}/progress`,body:{occurredAt:nowIso()},to:"IN_PROGRESS"};
 if(o.state==="IN_PROGRESS")return{label:"Completar",path:`/api/v1/obligations/${o.id}/completion`,body:{evidence:"Seguimiento realizado y documentado",occurredAt:nowIso()},to:"COMPLETED"};
 return null;
}

export default function Workspace(){
 const[session,setSession]=useState<MedicalSession|null>(null);
 const[ready,setReady]=useState(false);
 const[patientId,setPatientId]=useState("");
 const[enc,setEnc]=useState<Encounter|null>(null);
 const[assessment,setAssessment]=useState("");
 const[plan,setPlan]=useState("");
 const[meds,setMeds]=useState<Med[]>([]);
 const[drug,setDrug]=useState("");const[dose,setDose]=useState("");const[route,setRoute]=useState("VO");const[freq,setFreq]=useState("");
 const[results,setResults]=useState<Result[]>([]);
 const[resName,setResName]=useState("");const[resCritical,setResCritical]=useState(false);
 const[docs,setDocs]=useState<Doc[]>([]);
 const[docTitle,setDocTitle]=useState("");const[docContent,setDocContent]=useState("");const[docType,setDocType]=useState("PROGRESS_NOTE");
 const[orders,setOrders]=useState<Order[]>([]);
 const[orderType,setOrderType]=useState("LAB");const[orderDetail,setOrderDetail]=useState("");
 const[allergies,setAllergies]=useState<Al[]>([]);const[alSub,setAlSub]=useState("");const[alSev,setAlSev]=useState("MODERATE");const[alReac,setAlReac]=useState("");
 const[problems,setProblems]=useState<Prob[]>([]);const[probCode,setProbCode]=useState("");const[probDesc,setProbDesc]=useState("");
 const[obligations,setObligations]=useState<Ob[]>([]);const[obKind,setObKind]=useState("");
 const[referrals,setReferrals]=useState<Ref[]>([]);const[refSpecialty,setRefSpecialty]=useState("");const[refReason,setRefReason]=useState("");
 const[appts,setAppts]=useState<Appt[]>([]);const[apptStart,setApptStart]=useState("");const[apptReason,setApptReason]=useState("");const[apptCons,setApptCons]=useState("Consultorio 1");const[apptType,setApptType]=useState("CONSULTA_GENERAL");
 const[imms,setImms]=useState<Imm[]>([]);const[immCode,setImmCode]=useState("");const[immDose,setImmDose]=useState("1");
 const[vitals,setVitals]=useState<Vit[]>([]);const[vitType,setVitType]=useState("BP");const[vitValue,setVitValue]=useState("");const[vitUnit,setVitUnit]=useState("mmHg");
 const[plans,setPlans]=useState<Cp[]>([]);const[planCat,setPlanCat]=useState("DIABETES");const[planGoal,setPlanGoal]=useState("");
 const[claims,setClaims]=useState<Clm[]>([]);const[clmAmount,setClmAmount]=useState("");const[clmCurrency,setClmCurrency]=useState("MXN");
 const[consents,setConsents]=useState<Cs[]>([]);const[csType,setCsType]=useState("PROCEDURE");const[csRef,setCsRef]=useState("");
 const[adms,setAdms]=useState<Adm[]>([]);const[admUnit,setAdmUnit]=useState("ER");const[admReason,setAdmReason]=useState("");
 const[specs,setSpecs]=useState<Sp[]>([]);const[specType,setSpecType]=useState("BLOOD");
 const[incs,setIncs]=useState<Inc[]>([]);const[incCat,setIncCat]=useState("MEDICATION_ERROR");const[incSev,setIncSev]=useState("MODERATE");const[incDesc,setIncDesc]=useState("");
 const[triages,setTriages]=useState<Tr[]>([]);const[trComplaint,setTrComplaint]=useState("");
 const[wounds,setWounds]=useState<Wn[]>([]);const[wnLoc,setWnLoc]=useState("SACRUM");const[wnStage,setWnStage]=useState("STAGE_2");
 const[transfs,setTransfs]=useState<Tf[]>([]);const[tfProduct,setTfProduct]=useState("PRBC");const[tfUnits,setTfUnits]=useState("2");
 const[surgs,setSurgs]=useState<Sg[]>([]);const[sgProc,setSgProc]=useState("");const[sgLat,setSgLat]=useState("NA");
 const[dialz,setDialz]=useState<Dz[]>([]);const[dzMod,setDzMod]=useState("HEMODIALYSIS");const[dzAcc,setDzAcc]=useState("FISTULA");
 const[tl,setTl]=useState<TL[]|null>(null);
 const[gaps,setGaps]=useState<Gap[]|null>(null);
 const[exportInfo,setExportInfo]=useState<{aggregateCount:number;eventCount:number;contentHash:string}|null>(null);
 const[panel,setPanel]=useState<{gaps:PanelGap[];patientCount:number}|null>(null);
 const[patientName,setPatientName]=useState("");
 const[activeH2,setActiveH2]=useState(""); // scrollspy: módulo visible resaltado en el nav-rail
 const[snap,setSnap]=useState<Snap|null>(null); // snapshot de consulta (hero panel 1)
 const[rxDrug,setRxDrug]=useState("");const[rxDose,setRxDose]=useState("");const[rxRoute,setRxRoute]=useState("Oral");const[rxFreq,setRxFreq]=useState("");
 const[rxCheck,setRxCheck]=useState<RxCheck|null>(null);const[rxMsg,setRxMsg]=useState("");
 const[trends,setTrends]=useState<Trends|null>(null);const[trendKey,setTrendKey]=useState<TrendKey>("HBA1C");
 const[followTab,setFollowTab]=useState<"pend"|"prog"|"done"|"all">("pend");
 const[topSearch,setTopSearch]=useState("");
 const[sideCollapsed,setSideCollapsed]=useState(false);
 const[docMenu,setDocMenu]=useState(false);
 const[view,setView]=useState<"inicio"|"pacientes"|"consulta"|"agenda"|"resultados"|"medicamentos"|"ordenes"|"alergias"|"problemas"|"vacunas"|"signos"|"planCuidado"|"interconsulta"|"seguimiento"|"facturacion"|"documentos"|"obligaciones"|"clinicalIntel"|"reportes"|"biblioteca"|"configuracion"|"exp">("inicio"); // vistas de nivel-sistema + exp(expediente crudo)
 const[medTab,setMedTab]=useState<"catalogo"|"plantillas"|"rapidas"|"interacciones"|"alertas"|"reportes">("catalogo");
 const[medQuery,setMedQuery]=useState("");        // búsqueda en el catálogo de fármacos
 const[medCat,setMedCat]=useState("");            // filtro por categoría terapéutica ("":todas)
 const[medOnlyMon,setMedOnlyMon]=useState(false); // solo con monitoreo obligado
 const[medOnlyRenal,setMedOnlyRenal]=useState(false); // solo con alerta renal
 const[medSel,setMedSel]=useState<string|null>(null); // principio activo seleccionado (detalle)
 // Pestaña Interacciones (S8.3) — verificador de conjunto cableado a POST /api/v1/interactions
 const[ixDrugs,setIxDrugs]=useState<string[]>(["Sertralina","Ibuprofeno","Metformina"]);
 const[ixFactors,setIxFactors]=useState<string[]>([]);
 const[ixInput,setIxInput]=useState("");
 const[ixRes,setIxRes]=useState<IxResult|null>(null);
 const[ixBusy,setIxBusy]=useState(false);
 // Vista Alergias (S-ALERGIAS) — registro clínica-wide cableado a GET /api/v1/allergies
 const[alergReg,setAlergReg]=useState<AllergyRegistry|null>(null);
 const[alergSel,setAlergSel]=useState(0);
 const[alergOnlyActive,setAlergOnlyActive]=useState(true);const[alergOnlySevere,setAlergOnlySevere]=useState(false);
 const[alergSearch,setAlergSearch]=useState("");const[alergType,setAlergType]=useState("Todos");
 const[algNew,setAlgNew]=useState(false);const[algBusy,setAlgBusy]=useState(false);const[algMsg,setAlgMsg]=useState<string|null>(null);
 const[algForm,setAlgForm]=useState<{patientId:string;substance:string;severity:string;reaction:string}>({patientId:"",substance:"",severity:"MODERATE",reaction:""});
 // Vista Problemas (S-PROBLEMAS) — lista clínica-wide cableada a GET /api/v1/problems + form + plantillas
 const[probScreen,setProbScreen]=useState<"lista"|"nuevo"|"plantillas">("lista");
 const[probReg,setProbReg]=useState<ProblemRegistry|null>(null);
 const[probSel,setProbSel]=useState(0);
 const[probSearch,setProbSearch]=useState("");const[probStatusF,setProbStatusF]=useState("Todos");
 const[probPlantCat,setProbPlantCat]=useState("Todas las plantillas");
 // Form "Nuevo problema"
 const[pfName,setPfName]=useState("");const[pfCode,setPfCode]=useState("");
 const[pfType,setPfType]=useState<"Agudo"|"Crónico"|"Recurrente">("Agudo");
 const[pfEstado,setPfEstado]=useState("Activo");const[pfDesc,setPfDesc]=useState("");
 const[pfSev,setPfSev]=useState("Leve");const[pfNotes,setPfNotes]=useState("");
 const[pfResults,setPfResults]=useState<IcdEntry[]>([]);const[pfBusy,setPfBusy]=useState(false);const[pfMsg,setPfMsg]=useState("");
 // Vista Vacunas (S-VACUNAS) — registro clínica-wide cableado a GET /api/v1/immunizations
 const[immReg,setImmReg]=useState<ImmRegistry|null>(null);const[immSel,setImmSel]=useState(0);
 const[vacNew,setVacNew]=useState(false);const[vacBusy,setVacBusy]=useState(false);const[vacMsg,setVacMsg]=useState<string|null>(null);
 const[vacForm,setVacForm]=useState<{patientId:string;vaccineCode:string;dose:string;lot:string;site:string}>({patientId:"",vaccineCode:"",dose:"1/1",lot:"",site:"Brazo izquierdo"});
 const[immSearch,setImmSearch]=useState("");const[immStatusF,setImmStatusF]=useState("Todos");
 // Vista Signos vitales (S-SIGNOS) — historial por paciente cableado a GET /patients/:id/vitals + form -> POST /vitals
 const[vitHist,setVitHist]=useState<VitalHistory|null>(null);
 const[svTemp,setSvTemp]=useState("");const[svFc,setSvFc]=useState("");const[svFr,setSvFr]=useState("");
 const[svBpS,setSvBpS]=useState("");const[svBpD,setSvBpD]=useState("");const[svSpo2,setSvSpo2]=useState("");
 const[svPeso,setSvPeso]=useState("");const[svTalla,setSvTalla]=useState("");const[svPab,setSvPab]=useState("");
 const[svPain,setSvPain]=useState("0");const[svEstado,setSvEstado]=useState("Bueno");const[svObs,setSvObs]=useState("");
 const[svBusy,setSvBusy]=useState(false);const[svMsg,setSvMsg]=useState("");
 // Vista Plan de cuidado (S-PLANCUIDADO) — snapshot compuesto cableado a GET /patients/:id/care-plan
 const[cpSnap,setCpSnap]=useState<CarePlanSnap|null>(null);
 const[cpPlanTab,setCpPlanTab]=useState<"plan"|"historial"|"objetivos"|"educacion"|"notas">("plan");
 const[cpNew,setCpNew]=useState(false);const[cpBusy,setCpBusy]=useState(false);const[cpMsg,setCpMsg]=useState<string|null>(null);
 const[cpForm,setCpForm]=useState<{category:string;goal:string}>({category:"DIABETES",goal:""});
 // Vista Interconsultas (S-INTERCONSULTA) — form Nueva interconsulta; panel derecho cableado a referral-context, envío -> POST /referrals
 const[refCtx,setRefCtx]=useState<RefContext|null>(null);
 const[icPatientId,setIcPatientId]=useState(""); // paciente elegido para la interconsulta
 const[icTab,setIcTab]=useState<"datos"|"resumen"|"documentos"|"indicaciones">("datos");
 const[icSpecialty,setIcSpecialty]=useState("Endocrinología");const[icPriority,setIcPriority]=useState("Preferente (2–4 semanas)");const[icType,setIcType]=useState("Primera vez");
 const[icMotivo,setIcMotivo]=useState("");const[icResumen,setIcResumen]=useState("");
 const[icBusy,setIcBusy]=useState(false);const[icMsg,setIcMsg]=useState("");
 // Vista Seguimiento (S-SEGUIMIENTO) — snapshot compuesto cableado a GET /patients/:id/follow-up
 const[fuSnap,setFuSnap]=useState<FollowUpSnap|null>(null);
 const[segTab,setSegTab]=useState<"seguimiento"|"evolucion"|"graficas"|"metas"|"recordatorios"|"alertas">("seguimiento");
 // Vista Facturación (S-FACTURACION) — registro clínica-wide cableado a GET /api/v1/claims; emisión -> POST /claims
 const[claimsReg,setClaimsReg]=useState<ClaimsRegistry|null>(null);
 const[facTab,setFacTab]=useState<"facturas"|"recibos"|"notas"|"cotizaciones">("facturas");
 const[nfConcepts,setNfConcepts]=useState<{desc:string;qty:number;price:number}[]>([{desc:"Consulta médica",qty:1,price:500},{desc:"Aplicación de vacuna",qty:1,price:350}]);
 const[nfPatientId,setNfPatientId]=useState(""); // paciente elegido para la factura (Facturación)
 const[nfBusy,setNfBusy]=useState(false);const[nfMsg,setNfMsg]=useState("");
 // Vista Documentos (S-DOCUMENTOS) — lista por paciente cableada a GET /patients/:id/documents
 const[docsSnap,setDocsSnap]=useState<DocsSnap|null>(null);
 const[docsTab,setDocsTab]=useState<"todos"|"clinicos"|"administrativos"|"consentimientos"|"estudios"|"recetas"|"notas"|"otros">("todos");
 const[docSel,setDocSel]=useState(0);const[docFolder,setDocFolder]=useState("Todos los documentos");const[docMsg,setDocMsg]=useState("");
 const[docNew,setDocNew]=useState(false);const[docBusy,setDocBusy]=useState(false);
 const[docForm,setDocForm]=useState<{docType:string;title:string;content:string}>({docType:"PROGRESS_NOTE",title:"",content:""});
 // Vista Obligaciones (S-OBLIGACIONES) — obligaciones regulatorias del consultorio cableadas a GET /regulatory-obligations
 const[regObSnap,setRegObSnap]=useState<RegObSnap|null>(null);
 const[oblNew,setOblNew]=useState(false);const[oblBusy,setOblBusy]=useState(false);const[oblMsg,setOblMsg]=useState<string|null>(null);
 const[oblForm,setOblForm]=useState<{name:string;category:string;periodicity:string;dueDate:string}>({name:"",category:"Fiscal (SAT)",periodicity:"Mensual",dueDate:""});
 const[oblTab,setOblTab]=useState<"todas"|"fiscales"|"salud"|"laborales"|"proteccion"|"administrativas"|"otros">("todas");
 // Vista Clinical Intelligence (S-CLINICALINTEL) — alertas y calculadoras DETERMINISTAS (R6 IA generativa en pausa)
 const[ciSnap,setCiSnap]=useState<CiSnap|null>(null);
 const[ciTab,setCiTab]=useState<"asistente"|"diferencial"|"guias"|"interacciones"|"calculadoras"|"alertas"|"educacion">("asistente");
 // Vista Reportes (S-REPORTES) — tablero analítico; KPIs de pacientes/ingresos y diagnósticos cableados a GET /reports
 const[repSnap,setRepSnap]=useState<ReportsSnap|null>(null);
 const[repTab,setRepTab]=useState("Resumen");
 // Vista Biblioteca Clínica (S-BIBLIOTECA) — repositorio de conocimiento curado (presentacional); herramientas reales enlazadas
 const[bibTab,setBibTab]=useState("Todo");const[bibEsp,setBibEsp]=useState("Medicina general");
 // Vista Configuración (S-CONFIG) — ajustes/preferencias del consultorio (presentacional)
 const[cfgTab,setCfgTab]=useState("General");const[cfgSaved,setCfgSaved]=useState(false);const[cfgColor,setCfgColor]=useState("#6C5CF6");
 const[ordTab,setOrdTab]=useState<"todas"|"laboratorio"|"imagenologia"|"gabinete"|"interconsultas"|"procedimientos"|"otros">("todas");
 const[selRow,setSelRow]=useState(0); // fila seleccionada en la lista de pacientes (panel de detalle)
 const[cTab,setCTab]=useState<"actual"|"resultados"|"ordenes"|"medicamentos"|"plan"|"documentos"|"seguimiento">("actual");
 const[consultaPid,setConsultaPid]=useState<string|null>(null); // paciente de la consulta abierta (null = panel de consultas)
 const[consultaNewPid,setConsultaNewPid]=useState(""); // selector "iniciar nueva consulta" en el panel
 // Abre el workspace de la consulta de un paciente (desde el panel, agenda, pacientes, etc.).
 const openConsulta=(pid:string,name:string,tab:typeof cTab="actual")=>{selectPatientRaw(pid,name);setConsultaPid(pid);setCTab(tab);setView("consulta");window.scrollTo({top:0,behavior:"smooth"});};
 const[consTabs,setConsTabs]=useState<ConsTabs|null>(null); // pestañas por paciente de Consulta (cableado)
 const[resTab,setResTab]=useState<"resultados"|"solicitudes"|"seguimiento"|"referencia"|"alertas">("resultados");
 const[resReg,setResReg]=useState<ResultsRegistry|null>(null); // registro de resultados clínica-wide (cableado)
 const[resNew,setResNew]=useState(false);const[resBusy2,setResBusy2]=useState(false);const[resMsg2,setResMsg2]=useState<string|null>(null);
 const[resForm,setResForm]=useState<{patientId:string;analyte:string;value:string}>({patientId:"",analyte:"GLUCOSE",value:""});
 const[resSel,setResSel]=useState<string|null>(null); // resultId seleccionado en el navegador de resultados
 const[resQ,setResQ]=useState("");const[resTypeF,setResTypeF]=useState("Todos");const[resEstadoF,setResEstadoF]=useState("Todos"); // filtros reales del navegador
 const[ordReg,setOrdReg]=useState<{items:{orderId:string;patientId:string;patientName:string;orderType:string;typeLabel:string;detail:string;status:string;createdAt:string;version:number}[];total:number;solicitadas:number;enviadas:number;completadas:number}|null>(null);
 const[ordSel,setOrdSel]=useState<string|null>(null); // orderId seleccionado (panel de detalle) de la vista Órdenes
 const[ordBusy,setOrdBusy]=useState(false); // transición de orden en curso
 const[ordMsg,setOrdMsg]=useState<string|null>(null); // aviso tras una acción (creada/enviada/completada/cancelada)
 const[ordNew,setOrdNew]=useState(false); // panel "Nueva orden" abierto
 const[ordForm,setOrdForm]=useState<{patientId:string;orderType:string;detail:string}>({patientId:"",orderType:"LAB",detail:""});
 const[ordQuery,setOrdQuery]=useState(""); // búsqueda por paciente/estudio en la vista Órdenes
 const[ordStatus,setOrdStatus]=useState(""); // filtro por estado ("":todos)
 const[cForm,setCForm]=useState({motivo:"",historia:"",antec:"",interrog:"",explor:"",plan:""}); // borrador de la consulta actual
 const[cPreview,setCPreview]=useState(false); // vista previa de la nota compuesta (Consulta)
 const[cMsg,setCMsg]=useState<string|null>(null); // aviso del flujo de encuentro (Consulta)
 const[cVit,setCVit]=useState({ta:"",fc:"",fr:"",temp:"",spo2:""}); // signos vitales de la Consulta
 const[cVitMsg,setCVitMsg]=useState<string|null>(null);const[cVitBusy,setCVitBusy]=useState(false);
 const[cOrdCat,setCOrdCat]=useState<"LAB"|"IMAGING"|"PROCEDURE"|"REFERRAL">("LAB"); // categoría de órdenes de la Consulta
 const[cOrdSel,setCOrdSel]=useState<string[]>([]);const[cOrdMsg,setCOrdMsg]=useState<string|null>(null);const[cOrdBusy,setCOrdBusy]=useState(false);
 const[cDxQuery,setCDxQuery]=useState("");const[cDxMsg,setCDxMsg]=useState<string|null>(null);const[cDxBusy,setCDxBusy]=useState(false); // buscador CIE-10 de la Consulta
 const[cAntec,setCAntec]=useState<string[]>([]); // antecedentes marcados (se componen en la nota del encuentro)
 type AgendaAppt={appointmentId:string;patientId:string;patientName:string;startAt:string;endAt:string|null;reason:string;consultorio:string|null;apptType:string|null;status:string;version:number};
 const[agenda,setAgenda]=useState<{appointments:AgendaAppt[];counts:{programadas:number;atendidas:number;enEspera:number;canceladas:number}}|null>(null);
 const[agendaDate,setAgendaDate]=useState<string>(new Date().toISOString().slice(0,10)); // fecha de la agenda (YYYY-MM-DD)
 const[agendaView,setAgendaView]=useState<"dia"|"lista">("dia"); // vista de la agenda (rejilla del día / lista)
 const[apptSel,setApptSel]=useState<string|null>(null);          // cita seleccionada (panel de detalle)
 const[apptBusy,setApptBusy]=useState(false);                     // transición de cita en curso
 const[apptMsg,setApptMsg]=useState<string|null>(null);           // aviso tras una acción de la agenda
 const[apptNew,setApptNew]=useState(false);                       // panel "Nueva cita" abierto
 const[apptForm,setApptForm]=useState<{patientId:string;time:string;reason:string;consultorio:string;apptType:string}>({patientId:"",time:"09:00",reason:"",consultorio:"Consultorio 1",apptType:"CONSULTA_GENERAL"});
 const[clock,setClock]=useState<Date>(()=>new Date());
 const[topMenu,setTopMenu]=useState(false);
 const[patientList,setPatientList]=useState<{patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string;version?:number}[]|null>(null);
 const[regName,setRegName]=useState("");const[regDob,setRegDob]=useState("");const[regSex,setRegSex]=useState("UNKNOWN");
 const[patStatus,setPatStatus]=useState("");const[patSex,setPatSex]=useState(""); // filtros de la vista Pacientes ("":todos)
 const[patNew,setPatNew]=useState(false);const[patMsg,setPatMsg]=useState<string|null>(null); // creador inline + aviso
 const[patSelId,setPatSelId]=useState<string|null>(null); // paciente seleccionado (la ficha sólo aparece al seleccionar)
 const[patTab,setPatTab]=useState<"resumen"|"historial"|"notas"|"documentos">("resumen"); // pestaña de la ficha (en sitio)
 const[patEdit,setPatEdit]=useState(false);const[editBusy,setEditBusy]=useState(false);
 const[editForm,setEditForm]=useState<{name:string;birthDate:string;sexAtBirth:string;curp:string;phone:string;email:string;address:string;occupation:string;maritalStatus:string}>({name:"",birthDate:"",sexAtBirth:"UNKNOWN",curp:"",phone:"",email:"",address:"",occupation:"",maritalStatus:""});
 const[regExtra,setRegExtra]=useState({curp:"",phone:"",email:"",address:"",occupation:"",maritalStatus:""});
 const[busy,setBusy]=useState("");
 const[error,setError]=useState("");

 useEffect(()=>{
  const s=getStoredSession();
  if(!s){window.location.replace("/login");return;} // guard duro: el espacio clínico exige sesión
  setSession(s);setPatientId(uuid());setReady(true);
 },[]);

 // Auto-carga silenciosa del contexto de seguridad (timeline + care-gaps) al cambiar de paciente,
 // para que los contadores del patient header estén SIEMPRE presentes. Debounce para no disparar
 // en cada tecla del input de ID; 404 => sin datos (no es error). No usa `call` (no bloquea la UI).
 useEffect(()=>{
  if(!patientId||!ready||!session)return;
  let cancelled=false;
  const t=setTimeout(async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/timeline`,{method:"GET"});
    if(cancelled)return;
    setTl(r.status<400?((r.body["items"] as TL[])??[]):[]);
    const g=await apiRequest(`/api/v1/patients/${patientId}/care-gaps`,{method:"GET"});
    if(cancelled)return;
    setGaps(g.status<400?((g.body["gaps"] as Gap[])??[]):[]);
    const sp=await apiRequest(`/api/v1/patients/${patientId}/consultation-snapshot`,{method:"GET"});
    if(cancelled)return;
    setSnap(sp.status<400&&sp.body["registered"]?(sp.body as unknown as Snap):null);
    const tr=await apiRequest(`/api/v1/patients/${patientId}/trends`,{method:"GET"});
    if(cancelled)return;
    setTrends(tr.status<400?(tr.body as unknown as Trends):null);
   }catch{/* red caída: el header simplemente no muestra chips */}
  },450);
  return()=>{cancelled=true;clearTimeout(t);};
 },[patientId,ready,session]);

 // Reloj en vivo del dashboard (hora del consultorio).
 useEffect(()=>{const id=setInterval(()=>setClock(new Date()),1000*30);return()=>clearInterval(id);},[]);
 // Ficha de Pacientes: al seleccionar un paciente, carga sus documentos (para la pestaña Documentos/Notas de la ficha).
 useEffect(()=>{
  if(view!=="pacientes"||!patSelId||!ready||!session)return;
  let cancelled=false;
  (async()=>{try{const r=await apiRequest(`/api/v1/patients/${patSelId}/documents`,{method:"GET"});if(!cancelled&&r.status===200)setDocsSnap(r.body as unknown as DocsSnap);}catch{/* documentos no disponibles */}})();
  return()=>{cancelled=true;};
 },[view,patSelId,ready,session]);
 // Agenda del día real (vistas Agenda e Inicio).
 useEffect(()=>{
  if((view!=="agenda"&&view!=="inicio"&&view!=="consulta")||!ready||!session)return;
  let cancelled=false;const date=view==="agenda"?agendaDate:new Date().toISOString().slice(0,10);
  (async()=>{try{const r=await apiRequest(`/api/v1/appointments?date=${date}`,{method:"GET"});
   if(!cancelled&&r.status<400)setAgenda({appointments:(r.body["appointments"] as AgendaAppt[])??[],counts:(r.body["counts"] as{programadas:number;atendidas:number;enEspera:number;canceladas:number})??{programadas:0,atendidas:0,enEspera:0,canceladas:0}});
  }catch{/* agenda no disponible */}})();
  return()=>{cancelled=true;};
 },[view,ready,session,agendaDate]);
 // Inicio, Pacientes, Órdenes y Agenda: cargan worklist (tareas del consultorio) + lista de pacientes reales.
 useEffect(()=>{
  if((view!=="inicio"&&view!=="pacientes"&&view!=="ordenes"&&view!=="agenda"&&view!=="alergias"&&view!=="vacunas"&&view!=="facturacion"&&view!=="interconsulta"&&view!=="resultados"&&view!=="signos"&&view!=="consulta")||!ready||!session)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/worklist",{method:"GET"});
    if(!cancelled&&r.status<400)setPanel({gaps:(r.body["gaps"] as PanelGap[])??[],patientCount:Number(r.body["patientCount"]??0)});
   }catch{/* worklist no disponible */}
   try{
    const r=await apiRequest("/api/v1/patients",{method:"GET"});
    if(!cancelled&&r.status<400)setPatientList((r.body["patients"] as{patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string;version?:number}[])??[]);
   }catch{/* lista no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session]);

 // Auto-carga del registro de alergias (vista Alergias) — GET clínica-wide con conteos por gravedad/tipo.
 useEffect(()=>{
  if(view!=="alergias"||!ready||!session)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/allergies",{method:"GET"});
    if(!cancelled&&r.status===200)setAlergReg(r.body as unknown as AllergyRegistry);
   }catch{/* registro no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session]);

 // Auto-carga del registro de problemas (vista Problemas › lista) — GET clínica-wide con conteos.
 useEffect(()=>{
  if(view!=="problemas"||probScreen!=="lista"||!ready||!session)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/problems",{method:"GET"});
    if(!cancelled&&r.status===200)setProbReg(r.body as unknown as ProblemRegistry);
   }catch{/* registro no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,probScreen,ready,session]);

 // Auto-carga del registro de vacunas (vista Vacunas) — GET clínica-wide con conteos y cobertura.
 useEffect(()=>{
  if(view!=="vacunas"||!ready||!session)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/immunizations",{method:"GET"});
    if(!cancelled&&r.status===200)setImmReg(r.body as unknown as ImmRegistry);
   }catch{/* registro no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session]);

 // Auto-carga del historial de signos vitales del paciente en contexto (vista Signos vitales).
 useEffect(()=>{
  if(view!=="signos"||!ready||!session||!patientId)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/vitals`,{method:"GET"});
    if(!cancelled&&r.status===200)setVitHist(r.body as unknown as VitalHistory);
   }catch{/* historial no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session,patientId]);

 // Auto-carga del snapshot del Plan de cuidado del paciente en contexto.
 useEffect(()=>{
  if(view!=="planCuidado"||!ready||!session||!patientId)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/care-plan`,{method:"GET"});
    if(!cancelled&&r.status===200)setCpSnap(r.body as unknown as CarePlanSnap);
   }catch{/* snapshot no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session,patientId]);

 // Auto-carga del contexto para Nueva interconsulta (panel derecho: alergias/medicamentos/problemas/labs/vitales).
 useEffect(()=>{
  if(view!=="interconsulta"||!ready||!session||!patientId)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/referral-context`,{method:"GET"});
    if(!cancelled&&r.status===200)setRefCtx(r.body as unknown as RefContext);
   }catch{/* contexto no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session,patientId]);

 // Auto-carga del snapshot de Seguimiento (tareas + tendencia de vitales + indicadores clave).
 useEffect(()=>{
  if(view!=="seguimiento"||!ready||!session||!patientId)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/follow-up`,{method:"GET"});
    if(!cancelled&&r.status===200)setFuSnap(r.body as unknown as FollowUpSnap);
   }catch{/* snapshot no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session,patientId]);

 // Auto-carga del registro de facturación (vista Facturación) — GET clínica-wide con KPIs.
 useEffect(()=>{
  if(view!=="facturacion"||!ready||!session)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/claims",{method:"GET"});
    if(!cancelled&&r.status===200)setClaimsReg(r.body as unknown as ClaimsRegistry);
   }catch{/* registro no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session]);

 // Auto-carga de documentos del paciente en contexto (vista Documentos).
 useEffect(()=>{
  if(view!=="documentos"||!ready||!session||!patientId)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/documents`,{method:"GET"});
    if(!cancelled&&r.status===200)setDocsSnap(r.body as unknown as DocsSnap);
   }catch{/* lista no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session,patientId]);

 // Auto-carga de las obligaciones regulatorias del consultorio (vista Obligaciones) — nivel tenant, sin paciente.
 useEffect(()=>{
  if(view!=="obligaciones"||!ready||!session)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/regulatory-obligations",{method:"GET"});
    if(!cancelled&&r.status===200)setRegObSnap(r.body as unknown as RegObSnap);
   }catch{/* lista no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session]);

 // Auto-carga del snapshot para Clinical Intelligence (alertas deterministas + contexto). R6 IA generativa en pausa.
 useEffect(()=>{
  if(view!=="clinicalIntel"||!ready||!session||!patientId)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/consultation-snapshot`,{method:"GET"});
    if(!cancelled&&r.status===200)setCiSnap(r.body as unknown as CiSnap);
   }catch{/* snapshot no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session,patientId]);

 // Auto-carga del tablero de Reportes (KPIs de pacientes/ingresos + diagnósticos principales, nivel tenant).
 useEffect(()=>{
  if(view!=="reportes"||!ready||!session)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/reports",{method:"GET"});
    if(!cancelled&&r.status===200)setRepSnap(r.body as unknown as ReportsSnap);
   }catch{/* tablero no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session]);

 // Auto-carga del registro de resultados (vista Resultados) — GET clínica-wide con estado-UI derivado + KPIs.
 useEffect(()=>{
  if((view!=="resultados"&&view!=="ordenes")||!ready||!session)return;
  let cancelled=false;
  (async()=>{
   if(view==="resultados"){try{
    const r=await apiRequest("/api/v1/results",{method:"GET"});
    if(!cancelled&&r.status===200)setResReg(r.body as unknown as ResultsRegistry);
   }catch{/* registro no disponible */}}
   try{
    const r=await apiRequest("/api/v1/orders",{method:"GET"});
    if(!cancelled&&r.status===200)setOrdReg(r.body as unknown as typeof ordReg);
   }catch{/* órdenes no disponibles */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session]);

 // Auto-carga de las pestañas por paciente de la vista Consulta (resultados/órdenes/medicamentos/plan/documentos/seguimiento).
 useEffect(()=>{
  if(view!=="consulta"||!ready||!session||!patientId){setConsTabs(null);return;}
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/consultation-tabs`,{method:"GET"});
    if(!cancelled&&r.status===200)setConsTabs(r.body as unknown as ConsTabs);
   }catch{/* pestañas no disponibles */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session,patientId]);

 // Scrollspy: resalta en el nav-rail el módulo actual = la ÚLTIMA sección cuyo top ya cruzó bajo los
 // headers sticky (~140px). El IntersectionObserver solo dispara el recálculo en cada cruce de esa línea.
 useEffect(()=>{
  if(!ready)return;
  const sections=Array.from(document.querySelectorAll<HTMLElement>(".mos-grid > section"));
  if(!sections.length)return;
  const OFF=140;
  const compute=()=>{
   let cur:HTMLElement|undefined=sections[0];
   for(const s of sections){if(s.getBoundingClientRect().top-OFF<=1)cur=s;else break;}
   const h2=cur?.querySelector("h2")?.textContent?.trim();
   if(h2)setActiveH2(h2);
  };
  const io=new IntersectionObserver(compute,{rootMargin:`-${OFF}px 0px 0px 0px`,threshold:[0,1]});
  sections.forEach(s=>io.observe(s));
  compute();
  return()=>io.disconnect();
 },[ready]);

 async function call(tag:string,fn:()=>Promise<void>){setBusy(tag);setError("");try{await fn();}catch(e){setError(String(e));}finally{setBusy("");}}
 const openEncounter=()=>call("open",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/encounters",{method:"POST",body:{encounterId:id,patientId,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}setEnc({id,state:"OPEN",version:Number(r.body["version"]??1)});
 });
 const saveAssessment=()=>call("assess",async()=>{if(!enc)return;
  const r=await apiRequest(`/api/v1/encounters/${enc.id}/assessment`,{method:"POST",body:{assessment,plan,occurredAt:nowIso()},ifMatch:enc.version});
  if(r.status>=400){setError(errMsg(r));return;}setEnc({...enc,state:"READY_TO_SIGN",version:Number(r.body["version"]??enc.version+1)});
 });
 const signEncounter=()=>call("sign",async()=>{if(!enc)return;
  const r=await apiRequest(`/api/v1/encounters/${enc.id}/signature`,{method:"POST",body:{occurredAt:nowIso()},ifMatch:enc.version});
  if(r.status>=400){setError(errMsg(r));return;}setEnc({...enc,state:"SIGNED",version:Number(r.body["version"]??enc.version+1),signatureDigest:String(r.body["signatureDigest"]??"")});
 });
 // Compone la nota clínica del encuentro (valoración) a partir del formulario estructurado de la Consulta.
 function composeNote():string{
  const parts:string[]=[];
  if(cForm.motivo.trim())parts.push(`MOTIVO DE CONSULTA: ${cForm.motivo.trim()}`);
  if(cForm.historia.trim())parts.push(`HISTORIA DE LA ENFERMEDAD ACTUAL: ${cForm.historia.trim()}`);
  const antecTxt=[cAntec.join(", "),cForm.antec.trim()].filter(Boolean).join(" · ");
  if(antecTxt)parts.push(`ANTECEDENTES RELEVANTES: ${antecTxt}`);
  if(cForm.interrog.trim())parts.push(`INTERROGATORIO POR APARATOS Y SISTEMAS: ${cForm.interrog.trim()}`);
  if(cForm.explor.trim())parts.push(`EXPLORACIÓN FÍSICA: ${cForm.explor.trim()}`);
  const dx=(snap?.problems??[]).slice(0,4).map(c=>`${c} ${DX_LABEL(c)}`).join("; ");
  if(dx)parts.push(`IMPRESIÓN DIAGNÓSTICA: ${dx}`);
  return parts.join("\n")||"Consulta registrada.";
 }
 // Acción CONTEXTUAL del encuentro desde la Consulta: abre -> guarda valoración -> firma (FSM real, con gate de firma).
 const consultaAdvance=()=>call("cadv",async()=>{
  setCMsg(null);
  if(!patientId){setCMsg("Selecciona un paciente para iniciar la consulta.");return;}
  if(!enc){
   const id=uuid();const r=await apiRequest("/api/v1/encounters",{method:"POST",body:{encounterId:id,patientId,occurredAt:nowIso()}});
   if(r.status>=400){setCMsg(errMsg(r));return;}
   setEnc({id,state:"OPEN",version:Number(r.body["version"]??1)});setCMsg("Encuentro abierto. Documenta y guarda la valoración.");return;
  }
  if(enc.state==="OPEN"){
   const assessmentText=composeNote();const planText=cForm.plan.trim()||"Plan pendiente de detallar.";
   setAssessment(assessmentText);setPlan(planText);
   const r=await apiRequest(`/api/v1/encounters/${enc.id}/assessment`,{method:"POST",body:{assessment:assessmentText,plan:planText,occurredAt:nowIso()},ifMatch:enc.version});
   if(r.status>=400){setCMsg(errMsg(r));return;}
   setEnc({...enc,state:"READY_TO_SIGN",version:Number(r.body["version"]??enc.version+1)});setCMsg("Valoración guardada. Lista para firmar.");return;
  }
  if(enc.state==="READY_TO_SIGN"){
   const r=await apiRequest(`/api/v1/encounters/${enc.id}/signature`,{method:"POST",body:{occurredAt:nowIso()},ifMatch:enc.version});
   if(r.status>=400){setCMsg(errMsg(r));return;} // el backend bloquea la firma si hay un resultado crítico sin cerrar
   setEnc({...enc,state:"SIGNED",version:Number(r.body["version"]??enc.version+1),signatureDigest:String(r.body["signatureDigest"]??"")});setCMsg("Consulta firmada (registro inmutable).");return;
  }
 });
 // Guarda los signos vitales de la Consulta como eventos reales (POST /vitals); surfacea la interpretación crítica del kernel.
 const saveConsultaVitals=async()=>{
  if(!patientId){setCVitMsg("Selecciona un paciente para guardar los signos vitales.");return;}
  const at=nowIso();const toSave:[string,string,string][]=[];
  if(cVit.ta.trim())toSave.push(["BP",cVit.ta.trim(),"mmHg"]);
  if(cVit.fc.trim())toSave.push(["HR",cVit.fc.trim(),"lpm"]);
  if(cVit.fr.trim())toSave.push(["RESP",cVit.fr.trim(),"rpm"]);
  if(cVit.temp.trim())toSave.push(["TEMP",cVit.temp.trim(),"°C"]);
  if(cVit.spo2.trim())toSave.push(["SPO2",cVit.spo2.trim(),"%"]);
  if(!toSave.length){setCVitMsg("Captura al menos un signo vital.");return;}
  setCVitBusy(true);setCVitMsg(null);
  try{
   const marks:string[]=[];
   for(const[vt,val,u]of toSave){
    const r=await apiRequest("/api/v1/vitals",{method:"POST",body:{vitalId:uuid(),patientId,vitalType:vt,value:val,unit:u,occurredAt:at}});
    if(r.status>=400){setCVitMsg(errMsg(r));setCVitBusy(false);return;}
    if(String(r.body["status"]??"")==="CRITICAL")marks.push(`${vt} ${val}: ${String(r.body["interpretation"]??"crítico")}`);
   }
   setCVit({ta:"",fc:"",fr:"",temp:"",spo2:""});
   setCVitMsg(marks.length?`Guardados. ⚠ ${marks.length} signo(s) crítico(s) — ${marks.join("; ")}. Un vital crítico sin firmar bloquea la firma.`:"Signos vitales guardados en el expediente ✓");
  }catch(e){setCVitMsg(String(e));}finally{setCVitBusy(false);}
 };
 // Crea órdenes clínicas reales desde la Consulta (POST /orders) por cada estudio seleccionado, con el tipo de la categoría.
 const createConsultaOrders=async()=>{
  if(!patientId){setCOrdMsg("Selecciona un paciente para crear órdenes.");return;}
  if(!cOrdSel.length){setCOrdMsg("Selecciona al menos un estudio.");return;}
  setCOrdBusy(true);setCOrdMsg(null);
  try{
   for(const detail of cOrdSel){
    const r=await apiRequest("/api/v1/orders",{method:"POST",body:{orderId:uuid(),patientId,orderType:cOrdCat,detail,occurredAt:nowIso()}});
    if(r.status>=400){setCOrdMsg(errMsg(r));setCOrdBusy(false);return;}
   }
   const n=cOrdSel.length;setCOrdSel([]);setCOrdMsg(`${n} orden(es) creada(s) y registrada(s) en el expediente ✓`);
  }catch(e){setCOrdMsg(String(e));}finally{setCOrdBusy(false);}
 };
 // ===== Resultados: registrar un resultado real (POST /results; critical se DERIVA del valor por CDS) + recarga =====
 const reloadResults=async()=>{const r=await apiRequest("/api/v1/results",{method:"GET"});if(r.status===200)setResReg(r.body as unknown as ResultsRegistry);};
 const createResult=async()=>{
  if(!resForm.patientId||!resForm.analyte.trim()||!resForm.value.trim()){setResMsg2("Selecciona paciente, analito y valor.");return;}
  setResBusy2(true);setResMsg2(null);
  try{
   const r=await apiRequest("/api/v1/results",{method:"POST",body:{resultId:uuid(),patientId:resForm.patientId,orderId:uuid(),analyte:resForm.analyte.trim(),value:resForm.value.trim(),occurredAt:nowIso()}});
   if(r.status>=400){setResMsg2(errMsg(r));return;}
   const crit=r.body["critical"]===true;const delta=r.body["deltaFlagged"]===true;
   await reloadResults();setResNew(false);setResForm({patientId:resForm.patientId,analyte:resForm.analyte,value:""});
   setResMsg2(crit?`Resultado registrado ⚠ CRÍTICO${delta?" · Δ crítico vs previo":""} — requiere acción y bloquea la firma hasta cerrarse.`:`Resultado registrado ✓${delta?" · Δ vs previo":" (dentro de rango)"}.`);
  }catch(e){setResMsg2(String(e));}finally{setResBusy2(false);}
 };
 // ===== Obligaciones regulatorias del consultorio: alta inline real (POST /regulatory-obligations) + recarga =====
 const reloadRegObligations=async()=>{const r=await apiRequest("/api/v1/regulatory-obligations",{method:"GET"});if(r.status===200)setRegObSnap(r.body as unknown as RegObSnap);};
 const createRegObligation=async()=>{
  if(!oblForm.name.trim()){setOblMsg("Indica el nombre de la obligación.");return;}
  setOblBusy(true);setOblMsg(null);
  try{
   const r=await apiRequest("/api/v1/regulatory-obligations",{method:"POST",body:{obligationId:uuid(),name:oblForm.name.trim(),category:oblForm.category,periodicity:oblForm.periodicity.trim()||"Única",...(oblForm.dueDate?{dueDate:`${oblForm.dueDate}T00:00:00.000Z`}:{}),occurredAt:nowIso()}});
   if(r.status>=400){setOblMsg(errMsg(r));return;}
   await reloadRegObligations();setOblNew(false);setOblForm({name:"",category:oblForm.category,periodicity:oblForm.periodicity,dueDate:""});setOblMsg("Obligación agregada; su estado se computa de la fecha límite ✓");
  }catch(e){setOblMsg(String(e));}finally{setOblBusy(false);}
 };
 // ===== Documentos: crear un documento clínico real (POST /documents; contenido de texto) + recarga por paciente =====
 const createDocument=async()=>{
  if(!patientId){setDocMsg("Selecciona un paciente para crear el documento.");return;}
  if(!docForm.title.trim()||!docForm.content.trim()){setDocMsg("Indica título y contenido.");return;}
  setDocBusy(true);setDocMsg("");
  try{
   const r=await apiRequest("/api/v1/documents",{method:"POST",body:{documentId:uuid(),patientId,docType:docForm.docType,title:docForm.title.trim(),content:docForm.content.trim(),occurredAt:nowIso()}});
   if(r.status>=400){setDocMsg(errMsg(r));return;}
   const g=await apiRequest(`/api/v1/patients/${patientId}/documents`,{method:"GET"});if(g.status===200)setDocsSnap(g.body as unknown as DocsSnap);
   setDocNew(false);setDocForm({docType:docForm.docType,title:"",content:""});setDocMsg("Documento creado ✓");
  }catch(e){setDocMsg(String(e));}finally{setDocBusy(false);}
 };
 // ===== Plan de cuidado: agregar meta real al plan del paciente en contexto (POST /care-plans) + recarga =====
 const reloadCarePlan=async()=>{if(!patientId)return;const r=await apiRequest(`/api/v1/patients/${patientId}/care-plan`,{method:"GET"});if(r.status===200)setCpSnap(r.body as unknown as CarePlanSnap);};
 const addCarePlanGoal=async()=>{
  if(!patientId){setCpMsg("Selecciona un paciente para agregar una meta al plan.");return;}
  if(!cpForm.goal.trim()){setCpMsg("Escribe el objetivo/meta.");return;}
  setCpBusy(true);setCpMsg(null);
  try{
   const r=await apiRequest("/api/v1/care-plans",{method:"POST",body:{carePlanId:uuid(),patientId,category:cpForm.category,goal:cpForm.goal.trim(),occurredAt:nowIso()}});
   if(r.status>=400){setCpMsg(errMsg(r));return;}
   await reloadCarePlan();setCpNew(false);setCpForm({category:cpForm.category,goal:""});setCpMsg("Meta agregada al plan de cuidado ✓");
  }catch(e){setCpMsg(String(e));}finally{setCpBusy(false);}
 };
 // ===== Vacunas: registro inline real (POST /immunizations; si hay lote+sitio, administra) + recarga =====
 const reloadImmunizations=async()=>{const r=await apiRequest("/api/v1/immunizations",{method:"GET"});if(r.status===200)setImmReg(r.body as unknown as ImmRegistry);};
 const createImmunizationInline=async()=>{
  if(!vacForm.patientId||!vacForm.vaccineCode.trim()){setVacMsg("Selecciona un paciente e indica la vacuna.");return;}
  setVacBusy(true);setVacMsg(null);
  try{
   const id=uuid();
   const r=await apiRequest("/api/v1/immunizations",{method:"POST",body:{immunizationId:id,patientId:vacForm.patientId,vaccineCode:vacForm.vaccineCode.trim(),dose:vacForm.dose.trim()||"1/1",occurredAt:nowIso()}});
   if(r.status>=400){setVacMsg(errMsg(r));return;}
   let applied=false;
   if(vacForm.lot.trim()&&vacForm.site.trim()){
    const a=await apiRequest(`/api/v1/immunizations/${id}/administration`,{method:"POST",body:{lot:vacForm.lot.trim(),site:vacForm.site.trim(),occurredAt:nowIso()},ifMatch:Number(r.body["version"]??1)});
    if(a.status>=400){setVacMsg(`Vacuna registrada (pendiente); no se pudo administrar: ${errMsg(a)}`);await reloadImmunizations();setVacBusy(false);return;}
    applied=true;
   }
   await reloadImmunizations();setVacNew(false);setVacForm({patientId:"",vaccineCode:"",dose:"1/1",lot:"",site:"Brazo izquierdo"});
   setVacMsg(applied?"Vacuna registrada y aplicada ✓":"Vacuna registrada como pendiente ✓ (captura lote y sitio para marcarla aplicada).");
  }catch(e){setVacMsg(String(e));}finally{setVacBusy(false);}
 };
 // ===== Alergias: creación inline real (POST /allergies) + recarga del registro clínica-wide =====
 const reloadAllergies=async()=>{const r=await apiRequest("/api/v1/allergies",{method:"GET"});if(r.status===200)setAlergReg(r.body as unknown as AllergyRegistry);};
 const createAllergyInline=async()=>{
  if(!algForm.patientId||!algForm.substance.trim()){setAlgMsg("Selecciona un paciente e indica la sustancia.");return;}
  setAlgBusy(true);setAlgMsg(null);
  try{
   const r=await apiRequest("/api/v1/allergies",{method:"POST",body:{allergyId:uuid(),patientId:algForm.patientId,substance:algForm.substance.trim(),severity:algForm.severity,reaction:algForm.reaction.trim()||"No especificada",occurredAt:nowIso()}});
   if(r.status>=400){setAlgMsg(errMsg(r));return;}
   await reloadAllergies();setAlgNew(false);setAlgForm({patientId:"",substance:"",severity:"MODERATE",reaction:""});setAlgMsg("Alergia registrada. Ya bloquea la prescripción del fármaco relacionado.");
  }catch(e){setAlgMsg(String(e));}finally{setAlgBusy(false);}
 };
 // Agrega un problema (CIE-10 del catálogo real) a la lista del paciente (POST /problems) y refresca el snapshot.
 const addConsultaProblem=async(code:string)=>{
  if(!patientId){setCDxMsg("Selecciona un paciente.");return;}
  setCDxBusy(true);setCDxMsg(null);
  try{
   const r=await apiRequest("/api/v1/problems",{method:"POST",body:{problemId:uuid(),patientId,code,occurredAt:nowIso()}});
   if(r.status>=400){setCDxMsg(errMsg(r));return;}
   setCDxQuery("");setCDxMsg(`Problema ${code} agregado a la lista ✓`);
   try{const sp=await apiRequest(`/api/v1/patients/${patientId}/consultation-snapshot`,{method:"GET"});if(sp.status<400&&sp.body["registered"])setSnap(sp.body as unknown as Snap);}catch{/* refresco best-effort del snapshot */}
  }catch(e){setCDxMsg(String(e));}finally{setCDxBusy(false);}
 };
 const proposeMed=()=>call("med-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/medications",{method:"POST",body:{medicationId:id,patientId,drugCode:drug,dose,route,frequency:freq,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setMeds(ms=>[...ms,{id,label:`${drug} ${dose} ${route} ${freq}`,state:"PROPOSED",version:Number(r.body["version"]??1)}]);
  setDrug("");setDose("");setFreq("");
 });
 const advanceMed=(m:Med)=>call("med-"+m.id,async()=>{
  const n=medNext(m);if(!n)return;
  const r=await apiRequest(n.path,{method:"POST",body:n.body,ifMatch:m.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setMeds(ms=>ms.map(x=>x.id===m.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 // Panel 3 — verificación de seguridad SIN escribir (dry-run de las barreras) y envío de la Rx.
 const verifyRx=()=>call("rxcheck",async()=>{
  setRxMsg("");
  const r=await apiRequest(`/api/v1/patients/${patientId}/prescription-check`,{method:"POST",body:{drug:rxDrug,dose:rxDose,route:rxRoute,frequency:rxFreq}});
  if(r.status>=400){setError(errMsg(r));setRxCheck(null);return;}
  setRxCheck(r.body as unknown as RxCheck);
 });
 const sendRx=()=>call("rxsend",async()=>{
  const id=uuid();
  const r=await apiRequest("/api/v1/medications",{method:"POST",body:{medicationId:id,patientId,drugCode:rxDrug,dose:rxDose,route:rxRoute,frequency:rxFreq,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setMeds(ms=>[{id,label:`${rxDrug} ${rxDose}`.trim(),state:"PROPOSED",version:Number(r.body["version"]??0)},...ms]);
  setRxCheck(null);setRxMsg("✓ Prescripción registrada como PROPOSED. Gestiona su ciclo (prescribir → activar) en el módulo Medicación.");
 });
 const receiveResult=()=>call("res-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/results",{method:"POST",body:{resultId:id,patientId,orderId:uuid(),critical:resCritical,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setResults(rs=>[...rs,{id,label:resName||"Resultado diagnóstico",critical:resCritical,state:"RECEIVED",version:Number(r.body["version"]??1)}]);
  setResName("");setResCritical(false);
 });
 const advanceResult=(res:Result)=>call("res-"+res.id,async()=>{
  const n=resNext(res);if(!n)return;
  const r=await apiRequest(n.path,{method:"POST",body:n.body,ifMatch:res.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setResults(rs=>rs.map(x=>x.id===res.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createDoc=()=>call("doc-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/documents",{method:"POST",body:{documentId:id,patientId,docType,title:docTitle||"Documento",content:docContent,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setDocs(ds=>[...ds,{id,label:`${docTitle||"Documento"} (${docType})`,state:"DRAFT",version:Number(r.body["version"]??1)}]);
  setDocTitle("");setDocContent("");
 });
 const advanceDoc=(d:Doc)=>call("doc-"+d.id,async()=>{
  const n=docNext(d);if(!n)return;
  const r=await apiRequest(n.path,{method:"POST",body:n.body,ifMatch:d.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setDocs(ds=>ds.map(x=>x.id===d.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createOrder=()=>call("ord-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/orders",{method:"POST",body:{orderId:id,patientId,orderType,detail:orderDetail,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setOrders(os=>[...os,{id,label:`${orderType}: ${orderDetail}`,state:"DRAFT",version:Number(r.body["version"]??1)}]);setOrderDetail("");
 });
 const advanceOrder=(o:Order)=>call("ord-"+o.id,async()=>{
  const n=orderNext(o);if(!n)return;
  const r=await apiRequest(n.path,{method:"POST",body:n.body,ifMatch:o.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setOrders(os=>os.map(x=>x.id===o.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createReferral=()=>call("ref-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/referrals",{method:"POST",body:{referralId:id,patientId,specialty:refSpecialty,reason:refReason,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setReferrals(rs=>[...rs,{id,label:`${refSpecialty}: ${refReason}`,state:"REQUESTED",version:Number(r.body["version"]??1)}]);setRefSpecialty("");setRefReason("");
 });
 const advanceReferral=(rr:Ref)=>call("ref-"+rr.id,async()=>{
  const n=referralNext(rr);if(!n)return;
  const r=await apiRequest(n.path,{method:"POST",body:n.body,ifMatch:rr.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setReferrals(rs=>rs.map(x=>x.id===rr.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const cancelReferral=(rr:Ref)=>call("ref-"+rr.id,async()=>{
  const path=rr.state==="REQUESTED"?`/api/v1/referrals/${rr.id}/decline`:`/api/v1/referrals/${rr.id}/cancellation`;
  const to:RefSt=rr.state==="REQUESTED"?"DECLINED":"CANCELLED";
  const r=await apiRequest(path,{method:"POST",body:{reason:"Cerrada desde el chart",occurredAt:nowIso()},ifMatch:rr.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setReferrals(rs=>rs.map(x=>x.id===rr.id?{...x,state:to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createAppointment=()=>call("apt-new",async()=>{
  const id=uuid();const startIso=apptStart?new Date(apptStart).toISOString():in7days();
  const r=await apiRequest("/api/v1/appointments",{method:"POST",body:{appointmentId:id,patientId,startAt:startIso,reason:apptReason,consultorio:apptCons,apptType,endAt:new Date(new Date(startIso).getTime()+30*60000).toISOString(),occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setAppts(as=>[...as,{id,label:`${new Date(startIso).toLocaleString()} · ${apptReason}`,state:"SCHEDULED",version:Number(r.body["version"]??1)}]);setApptStart("");setApptReason("");
 });
 const advanceAppt=(a:Appt)=>call("apt-"+a.id,async()=>{
  const n=apptNext(a);if(!n)return;
  const r=await apiRequest(n.path,{method:"POST",body:n.body,ifMatch:a.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setAppts(as=>as.map(x=>x.id===a.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const closeAppt=(a:Appt,mode:"cancel"|"noshow")=>call("apt-"+a.id,async()=>{
  const path=mode==="noshow"?`/api/v1/appointments/${a.id}/no-show`:`/api/v1/appointments/${a.id}/cancellation`;
  const to:ApptSt=mode==="noshow"?"NO_SHOW":"CANCELLED";
  const body=mode==="noshow"?{occurredAt:nowIso()}:{reason:"Cerrada desde la agenda",occurredAt:nowIso()};
  const r=await apiRequest(path,{method:"POST",body,ifMatch:a.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setAppts(as=>as.map(x=>x.id===a.id?{...x,state:to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createDialysis=()=>call("dz-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/dialysis-sessions",{method:"POST",body:{dialysisId:id,patientId,modality:dzMod,accessType:dzAcc,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setDialz(ds=>[...ds,{id,modality:dzMod,state:"SCHEDULED",version:Number(r.body["version"]??1)}]);
 });
 const doDialysisAction=(d:Dz,act:{path:string;body:Record<string,unknown>;to:DzSt})=>call("dz-"+d.id,async()=>{
  const r=await apiRequest(act.path,{method:"POST",body:act.body,ifMatch:d.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setDialz(ds=>ds.map(x=>x.id===d.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createSurgery=()=>call("sg-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/surgeries",{method:"POST",body:{surgeryId:id,patientId,procedure:sgProc,laterality:sgLat,surgeon:"Cirujano de guardia",occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setSurgs(ss=>[...ss,{id,procedure:sgProc,state:"SCHEDULED",version:Number(r.body["version"]??1)}]);setSgProc("");
 });
 const advanceSurgery=(s:Sg)=>call("sg-"+s.id,async()=>{
  const n=sgNext(s);if(!n)return;
  const r=await apiRequest(n.path,{method:"POST",body:n.body,ifMatch:s.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setSurgs(ss=>ss.map(x=>x.id===s.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const cancelSurgery=(s:Sg)=>call("sg-"+s.id,async()=>{
  const r=await apiRequest(`/api/v1/surgeries/${s.id}/cancellation`,{method:"POST",body:{reason:"Cancelada",occurredAt:nowIso()},ifMatch:s.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setSurgs(ss=>ss.map(x=>x.id===s.id?{...x,state:"CANCELLED",version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createTransfusion=()=>call("tf-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/transfusions",{method:"POST",body:{transfusionId:id,patientId,bloodProduct:tfProduct,units:tfUnits,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setTransfs(ts=>[...ts,{id,product:tfProduct,units:tfUnits,state:"ORDERED",version:Number(r.body["version"]??1)}]);
 });
 const advanceTransfusion=(t:Tf)=>call("tf-"+t.id,async()=>{
  const n=tfNext(t);if(!n)return;
  const r=await apiRequest(n.path,{method:"POST",body:n.body,ifMatch:t.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setTransfs(ts=>ts.map(x=>x.id===t.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const transfusionReaction=(t:Tf)=>call("tf-"+t.id,async()=>{
  const r=await apiRequest(`/api/v1/transfusions/${t.id}/reaction`,{method:"POST",body:{reaction:"Reacción reportada",occurredAt:nowIso()},ifMatch:t.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setTransfs(ts=>ts.map(x=>x.id===t.id?{...x,state:"REACTION",version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createWound=()=>call("wn-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/wounds",{method:"POST",body:{woundId:id,patientId,location:wnLoc,stage:wnStage,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setWounds(ws=>[...ws,{id,location:wnLoc,stage:wnStage,state:"OPEN",version:Number(r.body["version"]??1)}]);
 });
 const doWoundAction=(w:Wn,act:{path:string;body:Record<string,unknown>;to:WnSt})=>call("wn-"+w.id,async()=>{
  const r=await apiRequest(act.path,{method:"POST",body:act.body,ifMatch:w.version});
  if(r.status>=400){setError(errMsg(r));return;}
  const ns=act.body["stage"];setWounds(ws=>ws.map(x=>x.id===w.id?{...x,state:act.to,stage:typeof ns==="string"?ns:x.stage,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createTriage=()=>call("tr-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/triage",{method:"POST",body:{triageId:id,patientId,chiefComplaint:trComplaint,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setTriages(ts=>[...ts,{id,chiefComplaint:trComplaint,acuity:0,state:"WAITING",version:Number(r.body["version"]??1)}]);setTrComplaint("");
 });
 const doTriageAction=(t:Tr,act:{path:string;body:Record<string,unknown>;to:TrSt})=>call("tr-"+t.id,async()=>{
  const r=await apiRequest(act.path,{method:"POST",body:act.body,ifMatch:t.version});
  if(r.status>=400){setError(errMsg(r));return;}
  const na=act.body["acuity"];setTriages(ts=>ts.map(x=>x.id===t.id?{...x,state:act.to,acuity:typeof na==="number"?na:x.acuity,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createIncident=()=>call("inc-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/incidents",{method:"POST",body:{incidentId:id,patientId,category:incCat,severity:incSev,description:incDesc,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setIncs(is=>[...is,{id,label:`${incCat} · ${incSev} · ${incDesc}`,state:"REPORTED",version:Number(r.body["version"]??1)}]);setIncDesc("");
 });
 const doIncAction=(i:Inc,act:{path:string;body:Record<string,unknown>;to:IncSt})=>call("inc-"+i.id,async()=>{
  const r=await apiRequest(act.path,{method:"POST",body:act.body,ifMatch:i.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setIncs(is=>is.map(x=>x.id===i.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createSpecimen=()=>call("sp-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/specimens",{method:"POST",body:{specimenId:id,patientId,specimenType:specType,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setSpecs(ss=>[...ss,{id,specimenType:specType,state:"COLLECTED",version:Number(r.body["version"]??1)}]);
 });
 const advanceSpecimen=(s:Sp)=>call("sp-"+s.id,async()=>{
  const n=spNext(s);if(!n)return;
  const r=await apiRequest(n.path,{method:"POST",body:n.body,ifMatch:s.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setSpecs(ss=>ss.map(x=>x.id===s.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const rejectSpecimen=(s:Sp)=>call("sp-"+s.id,async()=>{
  const r=await apiRequest(`/api/v1/specimens/${s.id}/rejection`,{method:"POST",body:{reason:"Muestra no apta",occurredAt:nowIso()},ifMatch:s.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setSpecs(ss=>ss.map(x=>x.id===s.id?{...x,state:"REJECTED",version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createAdmission=()=>call("adm-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/admissions",{method:"POST",body:{admissionId:id,patientId,unit:admUnit,reason:admReason,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setAdms(as=>[...as,{id,unit:admUnit,state:"ADMITTED",version:Number(r.body["version"]??1)}]);setAdmReason("");
 });
 const doAdmAction=(a:Adm,act:{path:string;body:Record<string,unknown>;to:AdmSt})=>call("adm-"+a.id,async()=>{
  const r=await apiRequest(act.path,{method:"POST",body:act.body,ifMatch:a.version});
  if(r.status>=400){setError(errMsg(r));return;}
  const nu=act.body["unit"];setAdms(as=>as.map(x=>x.id===a.id?{...x,state:act.to,unit:typeof nu==="string"?nu:x.unit,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createConsent=()=>call("cs-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/consents",{method:"POST",body:{consentId:id,patientId,scopeType:csType,documentRef:csRef,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setConsents(cs=>[...cs,{id,label:`${csType} · ${csRef}`,state:"DRAFTED",version:Number(r.body["version"]??1)}]);setCsRef("");
 });
 const doConsentAction=(c:Cs,act:{path:string;body:Record<string,unknown>;to:CsSt})=>call("cs-"+c.id,async()=>{
  const r=await apiRequest(act.path,{method:"POST",body:act.body,ifMatch:c.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setConsents(cs=>cs.map(x=>x.id===c.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createClaim=()=>call("clm-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/claims",{method:"POST",body:{claimId:id,patientId,amount:clmAmount,currency:clmCurrency,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setClaims(cs=>[...cs,{id,label:`${clmAmount} ${clmCurrency}`,state:"DRAFT",version:Number(r.body["version"]??1)}]);setClmAmount("");
 });
 const doClaimAction=(c:Clm,act:{path:string;body:Record<string,unknown>;to:ClmSt})=>call("clm-"+c.id,async()=>{
  const r=await apiRequest(act.path,{method:"POST",body:act.body,ifMatch:c.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setClaims(cs=>cs.map(x=>x.id===c.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createPlan=()=>call("cp-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/care-plans",{method:"POST",body:{carePlanId:id,patientId,category:planCat,goal:planGoal,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setPlans(ps=>[...ps,{id,label:`${planCat} · ${planGoal}`,state:"PROPOSED",version:Number(r.body["version"]??1)}]);setPlanGoal("");
 });
 const doPlanAction=(c:Cp,act:{path:string;body:Record<string,unknown>;to:CpSt})=>call("cp-"+c.id,async()=>{
  const r=await apiRequest(act.path,{method:"POST",body:act.body,ifMatch:c.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setPlans(ps=>ps.map(x=>x.id===c.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createVital=()=>call("vit-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/vitals",{method:"POST",body:{vitalId:id,patientId,vitalType:vitType,value:vitValue,unit:vitUnit,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setVitals(vs=>[...vs,{id,vitalType:vitType,value:vitValue,unit:vitUnit,state:"RECORDED",version:Number(r.body["version"]??1),vstatus:String(r.body["status"]??""),interp:String(r.body["interpretation"]??"")}]);setVitValue("");
 });
 const doVitAction=(v:Vit,act:{path:string;body:Record<string,unknown>;to:VitSt})=>call("vit-"+v.id,async()=>{
  const r=await apiRequest(act.path,{method:"POST",body:act.body,ifMatch:v.version});
  if(r.status>=400){setError(errMsg(r));return;}
  const nv=act.body["value"];setVitals(vs=>vs.map(x=>x.id===v.id?{...x,state:act.to,value:typeof nv==="string"?nv:x.value,version:Number(r.body["version"]??x.version+1),vstatus:r.body["status"]!==undefined?String(r.body["status"]):(x.vstatus??""),interp:r.body["interpretation"]!==undefined?String(r.body["interpretation"]):(x.interp??"")}:x));
 });
 const createImmunization=()=>call("imm-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/immunizations",{method:"POST",body:{immunizationId:id,patientId,vaccineCode:immCode,dose:immDose,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setImms(is=>[...is,{id,label:`${immCode} · dosis ${immDose}`,state:"DUE",version:Number(r.body["version"]??1)}]);setImmCode("");
 });
 const doImmAction=(i:Imm,act:{path:string;body:Record<string,unknown>;to:ImmSt})=>call("imm-"+i.id,async()=>{
  const r=await apiRequest(act.path,{method:"POST",body:act.body,ifMatch:i.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setImms(is=>is.map(x=>x.id===i.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createAllergy=()=>call("al-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/allergies",{method:"POST",body:{allergyId:id,patientId,substance:alSub,severity:alSev,reaction:alReac||"—",occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setAllergies(as=>[...as,{id,label:`${alSub} (${alSev})`,state:"ACTIVE",version:Number(r.body["version"]??1)}]);setAlSub("");setAlReac("");
 });
 const doAllergyAction=(a:Al,act:{path:string;body:Record<string,unknown>;to:AlSt})=>call("al-"+a.id,async()=>{
  const r=await apiRequest(act.path,{method:"POST",body:act.body,ifMatch:a.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setAllergies(as=>as.map(x=>x.id===a.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createProblem=()=>call("pb-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/problems",{method:"POST",body:{problemId:id,patientId,code:probCode,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  const desc=String(r.body["description"]??probCode);const code=String(r.body["code"]??probCode);
  setProblems(ps=>[...ps,{id,label:`${desc} (${code})`,state:"ACTIVE",version:Number(r.body["version"]??1)}]);setProbCode("");setProbDesc("");
 });
 const doProblemAction=(p:Prob,a:{path:string;body:Record<string,unknown>;to:ProbSt})=>call("pb-"+p.id,async()=>{
  const r=await apiRequest(a.path,{method:"POST",body:a.body,ifMatch:p.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setProblems(ps=>ps.map(x=>x.id===p.id?{...x,state:a.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createObligation=()=>call("ob-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/obligations",{method:"POST",body:{obligationId:id,patientId,ownerId:uuid(),dueAt:in7days(),kind:obKind||"FOLLOWUP",occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setObligations(os=>[...os,{id,label:obKind||"Seguimiento",state:"OPEN",version:Number(r.body["version"]??1)}]);setObKind("");
 });
 const advanceObligation=(o:Ob)=>call("ob-"+o.id,async()=>{
  const n=obNext(o);if(!n)return;
  const r=await apiRequest(n.path,{method:"POST",body:n.body,ifMatch:o.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setObligations(os=>os.map(x=>x.id===o.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 function selectPatientRaw(id:string,name:string){setPatientId(id);setPatientName(name);setEnc(null);setAssessment("");setPlan("");setMeds([]);setResults([]);setDocs([]);setOrders([]);setObligations([]);setProblems([]);setAllergies([]);setReferrals([]);setAppts([]);setImms([]);setVitals([]);setPlans([]);setClaims([]);setConsents([]);setAdms([]);setSpecs([]);setIncs([]);setTriages([]);setWounds([]);setTransfs([]);setSurgs([]);setDialz([]);setTl(null);setGaps(null);setExportInfo(null);setError("");}
 const loadPatients=()=>call("pt-list",async()=>{
  const r=await apiRequest("/api/v1/patients",{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  setPatientList((r.body["patients"] as {patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string;version?:number}[])??[]);
 });
 // ===== Acciones REALES de la vista Órdenes (crear + transiciones del ciclo de vida) =====
 const reloadOrders=async()=>{const r=await apiRequest("/api/v1/orders",{method:"GET"});if(r.status===200)setOrdReg(r.body as unknown as typeof ordReg);};
 const submitOrder=async()=>{
  if(!ordForm.patientId||!ordForm.detail.trim()){setOrdMsg("Selecciona un paciente e indica el estudio.");return;}
  setOrdBusy(true);setOrdMsg(null);
  try{
   const id=uuid();
   const r=await apiRequest("/api/v1/orders",{method:"POST",body:{orderId:id,patientId:ordForm.patientId,orderType:ordForm.orderType,detail:ordForm.detail.trim(),occurredAt:nowIso()}});
   if(r.status>=400){setOrdMsg(errMsg(r));return;}
   await reloadOrders();setOrdSel(id);setOrdNew(false);setOrdForm({patientId:"",orderType:"LAB",detail:""});setOrdMsg("Orden creada y registrada.");
  }catch(e){setOrdMsg(String(e));}finally{setOrdBusy(false);}
 };
 const orderTransition=async(orderId:string,version:number,path:"placement"|"fulfillment"|"cancellation",okMsg:string)=>{
  setOrdBusy(true);setOrdMsg(null);
  try{
   const body=path==="cancellation"?{reason:"Cancelada por el médico",occurredAt:nowIso()}:{occurredAt:nowIso()};
   const r=await apiRequest(`/api/v1/orders/${orderId}/${path}`,{method:"POST",body,ifMatch:version});
   if(r.status>=400){setOrdMsg(errMsg(r));return;}
   await reloadOrders();setOrdMsg(okMsg);
  }catch(e){setOrdMsg(String(e));}finally{setOrdBusy(false);}
 };
 // ===== Acciones REALES de la vista Agenda (crear cita + ciclo de vida) =====
 const reloadAgenda=async()=>{const r=await apiRequest(`/api/v1/appointments?date=${agendaDate}`,{method:"GET"});if(r.status<400)setAgenda({appointments:(r.body["appointments"] as AgendaAppt[])??[],counts:(r.body["counts"] as{programadas:number;atendidas:number;enEspera:number;canceladas:number})??{programadas:0,atendidas:0,enEspera:0,canceladas:0}});};
 const apptTransition=async(id:string,version:number,path:"check-in"|"completion"|"cancellation"|"no-show",okMsg:string)=>{
  setApptBusy(true);setApptMsg(null);
  try{
   const body=path==="cancellation"?{reason:"Cancelada desde la agenda",occurredAt:nowIso()}:{occurredAt:nowIso()};
   const r=await apiRequest(`/api/v1/appointments/${id}/${path}`,{method:"POST",body,ifMatch:version});
   if(r.status>=400){setApptMsg(errMsg(r));return;}
   await reloadAgenda();setApptMsg(okMsg);
  }catch(e){setApptMsg(String(e));}finally{setApptBusy(false);}
 };
 const createAppt=async()=>{
  if(!apptForm.patientId||!apptForm.reason.trim()){setApptMsg("Selecciona un paciente e indica el motivo.");return;}
  setApptBusy(true);setApptMsg(null);
  try{
   const id=uuid();const startAt=`${agendaDate}T${apptForm.time}:00.000Z`;const endAt=new Date(new Date(startAt).getTime()+30*60000).toISOString();
   const r=await apiRequest("/api/v1/appointments",{method:"POST",body:{appointmentId:id,patientId:apptForm.patientId,startAt,endAt,reason:apptForm.reason.trim(),consultorio:apptForm.consultorio,apptType:apptForm.apptType,occurredAt:nowIso()}});
   if(r.status>=400){setApptMsg(errMsg(r));return;}
   await reloadAgenda();setApptSel(id);setApptNew(false);setApptForm({patientId:"",time:"09:00",reason:"",consultorio:"Consultorio 1",apptType:"CONSULTA_GENERAL"});setApptMsg("Cita agendada.");
  }catch(e){setApptMsg(String(e));}finally{setApptBusy(false);}
 };
 const loadPanel=()=>call("panel",async()=>{
  const r=await apiRequest("/api/v1/worklist",{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  setPanel({gaps:(r.body["gaps"] as PanelGap[])??[],patientCount:Number(r.body["patientCount"]??0)});
 });
 const registerPatient=(inline=false)=>call("pt-reg",async()=>{
  if(!regName.trim()){if(inline)setPatMsg("Indica el nombre del paciente.");else setError("El nombre del paciente es obligatorio");return;}
  const id=uuid();const e=regExtra;
  const r=await apiRequest("/api/v1/patients",{method:"POST",body:{patientId:id,name:regName,birthDate:regDob||"1990-01-01",sexAtBirth:regSex,occurredAt:nowIso(),...(e.curp?{curp:e.curp}:{}),...(e.phone?{phone:e.phone}:{}),...(e.email?{email:e.email}:{}),...(e.address?{address:e.address}:{}),...(e.occupation?{occupation:e.occupation}:{}),...(e.maritalStatus?{maritalStatus:e.maritalStatus}:{})}});
  if(r.status>=400){if(inline)setPatMsg(errMsg(r));else setError(errMsg(r));return;}
  selectPatientRaw(id,regName);setPatientList(l=>[{patientId:id,name:regName,status:"ACTIVE",...(regDob?{birthDate:regDob}:{}),sexAtBirth:regSex,...(e.curp?{curp:e.curp}:{})},...(l??[])]);setRegName("");setRegDob("");setRegExtra({curp:"",phone:"",email:"",address:"",occupation:"",maritalStatus:""});
  if(inline){setPatNew(false);setPatMsg("Paciente registrado.");}
 });
 // ===== Pacientes: editar (AMENDED) la ficha del paciente con datos reales (POST /patients/:id/amendment) =====
 const openEdit=(pid:string)=>{
  const p=(patientList??[]).find(x=>x.patientId===pid);const sd=(patientId===pid?snap?.demographics:undefined);
  setEditForm({name:p?.name||sd?.name||"",birthDate:(sd?.birthDate||p?.birthDate||"").slice(0,10),sexAtBirth:sd?.sex||p?.sexAtBirth||"UNKNOWN",curp:sd?.curp||p?.curp||"",phone:sd?.phone||"",email:sd?.email||"",address:sd?.address||"",occupation:sd?.occupation||"",maritalStatus:sd?.maritalStatus||""});
  setPatEdit(true);setPatMsg(null);
 };
 const amendPatient=async(pid:string)=>{
  if(!editForm.name.trim()){setPatMsg("El nombre no puede quedar vacío.");return;}
  const p=(patientList??[]).find(x=>x.patientId===pid);const ver=p?.version??1;const e=editForm;
  setEditBusy(true);setPatMsg(null);
  try{
   const body={name:e.name.trim(),...(e.birthDate?{birthDate:e.birthDate}:{}),sexAtBirth:e.sexAtBirth,occurredAt:nowIso(),...(e.curp.trim()?{curp:e.curp.trim()}:{}),...(e.phone.trim()?{phone:e.phone.trim()}:{}),...(e.email.trim()?{email:e.email.trim()}:{}),...(e.address.trim()?{address:e.address.trim()}:{}),...(e.occupation.trim()?{occupation:e.occupation.trim()}:{}),...(e.maritalStatus.trim()?{maritalStatus:e.maritalStatus.trim()}:{})};
   const r=await apiRequest(`/api/v1/patients/${pid}/amendment`,{method:"POST",body,ifMatch:ver});
   if(r.status>=400){setPatMsg(errMsg(r));return;}
   // refresca la lista (nombre/CURP/versión) y el snapshot (contacto) del paciente
   const lr=await apiRequest("/api/v1/patients",{method:"GET"});if(lr.status<400)setPatientList((lr.body["patients"] as {patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string;version?:number}[])??[]);
   if(patientId===pid){try{const sp=await apiRequest(`/api/v1/patients/${pid}/consultation-snapshot`,{method:"GET"});if(sp.status<400&&sp.body["registered"])setSnap(sp.body as unknown as Snap);}catch{/* refresco best-effort */}}
   setPatientName(e.name.trim());setPatEdit(false);setPatMsg("Ficha del paciente actualizada ✓");
  }catch(err){setPatMsg(String(err));}finally{setEditBusy(false);}
 };
 const exportRecord=()=>call("exp",async()=>{
  const r=await apiRequest(`/api/v1/patients/${patientId}/export`,{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  const m=r.body["manifest"] as{aggregateCount:number;eventCount:number};
  setExportInfo({aggregateCount:m.aggregateCount,eventCount:m.eventCount,contentHash:String(r.body["contentHash"]??"")});
 });
 const loadTimeline=()=>call("tl",async()=>{
  const r=await apiRequest(`/api/v1/patients/${patientId}/timeline`,{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  setTl((r.body["items"] as TL[])??[]);
  const g=await apiRequest(`/api/v1/patients/${patientId}/care-gaps`,{method:"GET"});
  if(g.status<400)setGaps((g.body["gaps"] as Gap[])??[]);
 });
 function reset(){setEnc(null);setAssessment("");setPlan("");setMeds([]);setResults([]);setDocs([]);setOrders([]);setObligations([]);setProblems([]);setAllergies([]);setReferrals([]);setAppts([]);setImms([]);setVitals([]);setPlans([]);setClaims([]);setConsents([]);setAdms([]);setSpecs([]);setIncs([]);setTriages([]);setWounds([]);setTransfs([]);setSurgs([]);setDialz([]);setTl(null);setGaps(null);setExportInfo(null);setError("");setPatientId(uuid());}

 if(!ready)return <main style={wrap}><p>Cargando…</p></main>;
 if(!session)return <main style={wrap}>
  <div style={{fontSize:13,color:"#6255c7",fontWeight:700}}>MEDICAL OS</div><h1 style={{fontSize:32}}>Espacio clínico</h1>
  <div style={card}><p>No hay una sesión activa.</p><a href="/login" style={{...btn,display:"inline-block",textDecoration:"none"}}>Iniciar sesión</a></div>
 </main>;

 // Contexto de seguridad del paciente (P0/P1) para el patient header — SIEMPRE visible.
 const summary=tl?summarizePatient(tl):null;
 const highGaps=gaps?gaps.filter(g=>g.priority==="HIGH").length:0;
 const safetyChip=(n:number,label:string,tone:"crit"|"warn",icon?:React.ReactNode)=>{
  const c=tone==="crit"?{bg:"#FDEAEA",fg:"#B3261E",bd:"#F3C9C9"}:{bg:"#FFF4E5",fg:"#A15C00",bd:"#F0DBB8"};
  return <span style={{display:"inline-flex",alignItems:"center",gap:6,background:c.bg,color:c.fg,border:`1px solid ${c.bd}`,borderRadius:999,padding:"4px 11px",fontSize:12.5,fontWeight:600,whiteSpace:"nowrap"}}>{icon}<b style={{fontSize:13,fontVariantNumeric:"tabular-nums"}}>{n}</b>{label}</span>;
 };
 const anyAlert=!!summary&&(highGaps>0||summary.activeAllergies>0||summary.openResults>0||summary.openObligations>0);
 // Badges del sidebar en tiempo real (conteos del paciente activo, desde datos ya cargados).
 const navCounts:Record<BadgeKey,number>={
  agenda:(tl??[]).filter(t=>t.aggregateType==="Appointment"&&(t.latestKind==="SCHEDULED"||t.latestKind==="CHECKED_IN")).length,
  resultados:summary?.openResults??0,
  seguimiento:gaps?.length??0,
  obligaciones:summary?.openObligations??0,
 };
 // Identidad del médico (desde la sesión autenticada; fallback si el IdP no expone nombre/rol).
 const docName=(session.physicianName&&session.physicianName.trim())||"Médico tratante";
 const docRole=(session.physicianRole&&session.physicianRole.trim())||"Personal clínico";
 const docInitials=docName.replace(/^Dr\.?\s*/i,"").trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()||"MD";
 const docDisplay=/^dr/i.test(docName)?docName:`Dr. ${docName}`;
 // Notificaciones (campana): pendientes críticos reales del consultorio (worklist HIGH) o del paciente.
 const notifCount=(panel?panel.gaps.filter(g=>g.priority==="HIGH").length:0)+(view==="exp"?highGaps+((summary?.openResults)??0):0);
 const alertGlyph=<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3.5l9 15.5H3l9-15.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M12 10v4M12 16.5v.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>;

 return <div className="mos-app">
  <style>{RAIL_CSS}</style>
  {/* SIDEBAR OSCURO — navegación primaria del expediente (slider a un lado) */}
  <aside className={"mos-side"+(sideCollapsed?" col":"")}>
   <div className="mos-brand">
    <span style={{width:40,height:40,flex:"0 0 auto"}} aria-hidden>
     <svg width="40" height="40" viewBox="0 0 44 44" fill="none">
      <defs><linearGradient id="mosg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8B7DF8"/><stop offset="1" stopColor="#5B6BF0"/></linearGradient></defs>
      <rect x="18" y="5" width="8" height="34" rx="4" fill="url(#mosg)"/><rect x="5" y="18" width="34" height="8" rx="4" fill="url(#mosg)" opacity=".92"/>
     </svg>
    </span>
    <div><div className="mos-bname">MEDICAL <span className="os">OS</span></div><div className="mos-bsub">CLÍNICA INTELIGENTE<br/>MEJOR MEDICINA</div></div>
   </div>
   <nav className="mos-nav" aria-label="Navegación del expediente">
    {SIDE_NAV.map(it=>{const VMAP:Record<string,typeof view>={Inicio:"inicio",Pacientes:"pacientes",Consulta:"consulta",Agenda:"agenda",Resultados:"resultados",Medicamentos:"medicamentos",["Órdenes"]:"ordenes",Alergias:"alergias",Problemas:"problemas",Vacunas:"vacunas",["Signos vitales"]:"signos",["Plan de cuidados"]:"planCuidado",Interconsultas:"interconsulta",Seguimiento:"seguimiento",["Facturación"]:"facturacion",Documentos:"documentos",Obligaciones:"obligaciones",["Clinical Intelligence"]:"clinicalIntel",Reportes:"reportes"};const vTarget=VMAP[it.label];const on=vTarget?view===vTarget:(view==="exp"&&!!it.h2&&activeH2===it.h2);const n=it.badge?navCounts[it.badge]:0;return (
     <button key={it.label} className={"mos-navi"+(on?" active":"")} aria-current={on?"true":undefined} title={sideCollapsed?it.label:undefined} onClick={()=>{if(vTarget){if(vTarget==="consulta")setConsultaPid(null);setView(vTarget);window.scrollTo({top:0,behavior:"smooth"});}else{setView("exp");setTimeout(()=>scrollToSection(it.h2),0);}}}>
      <NavIcon k={it.icon}/><span className="lbl">{it.label}</span>{it.badge&&n>0&&<span className={"mos-badge "+(it.badgeColor??"p")}>{n}</span>}
     </button>);})}
   </nav>
   <div className="mos-divider"/>
   <div className="mos-toolslbl">HERRAMIENTAS</div>
   {TOOLS_NAV.map(it=>(
    <button key={it.label} className={"mos-navi"+((it.label==="Biblioteca clínica"&&view==="biblioteca")||(it.label==="Configuración"&&view==="configuracion")?" active":"")} aria-current={(it.label==="Biblioteca clínica"&&view==="biblioteca")||(it.label==="Configuración"&&view==="configuracion")?"true":undefined} title={sideCollapsed?it.label:undefined} onClick={()=>{if(it.label==="Configuración"){setView("configuracion");window.scrollTo({top:0,behavior:"smooth"});}else if(it.label==="Biblioteca clínica"){setView("biblioteca");window.scrollTo({top:0,behavior:"smooth"});}}}>
     <NavIcon k={it.icon}/><span className="lbl">{it.label}</span>
    </button>))}
   <div className="mos-divider"/>
   <div className="mos-doc" onClick={()=>setDocMenu(m=>!m)} role="button" aria-expanded={docMenu} aria-label="Menú del médico">
    <span className="av">{docInitials}</span>
    <div className="info" style={{minWidth:0}}><div className="nm">{docDisplay}</div><div className="rl">{docRole}</div></div>
    <span style={{marginLeft:"auto",color:"#8A8FC6",transform:docMenu?"rotate(180deg)":"none",transition:"transform .15s"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6"/></svg></span>
    {docMenu&&<div className="mos-docmenu" onClick={e=>e.stopPropagation()}>
     <button onClick={()=>{setDocMenu(false);}}><NavIcon k="gear"/>Configuración</button>
     <button onClick={()=>{setDocMenu(false);scrollToSection("Seguridad y auditoría");}}><NavIcon k="lock"/>Seguridad y auditoría</button>
     <button onClick={async()=>{await sessionLogout();location.href="/login";}} style={{color:"#F0919E"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/></svg>Cerrar sesión</button>
    </div>}
   </div>
   <button className="mos-collapse" onClick={()=>setSideCollapsed(c=>!c)} aria-label={sideCollapsed?"Expandir menú":"Contraer menú"}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={sideCollapsed?"M11 6l6 6-6 6M5 6l6 6-6 6":"M13 6l-6 6 6 6M19 6l-6 6 6 6"}/></svg>
    <span className="lbl">Contraer menú</span>
   </button>
  </aside>
  {/* BODY — topbar con buscador global + patient header + rejilla de ventanas */}
  <div className="mos-body">
   <header style={appbar}>
    <div className="mos-topsearch" style={{maxWidth:640}}>
     <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8a90ae" strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" strokeLinecap="round"/></svg>
     <input placeholder="Buscar paciente por nombre, CURP, teléfono o expediente…" value={topSearch} onChange={e=>setTopSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setView("exp");loadPatients();scrollToSection("Paciente");}}}/>
     <span style={{fontSize:11,background:"#E7EAF2",borderRadius:5,padding:"2px 6px",color:"#8A90AE",fontWeight:600,flex:"0 0 auto"}}>⌘ K</span>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:16,flex:"0 0 auto",marginLeft:"auto"}}>
     <button title="Notificaciones" onClick={()=>{setView("exp");scrollToSection("Seguridad y auditoría");}} style={{position:"relative",background:"transparent",border:0,cursor:"pointer",color:P.muted,padding:2,display:"grid",placeItems:"center"}}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 004 0"/></svg>
      {notifCount>0&&<span style={{position:"absolute",top:-3,right:-3,minWidth:16,height:16,borderRadius:999,background:"#F0455E",color:"#fff",fontSize:9.5,fontWeight:800,display:"grid",placeItems:"center",padding:"0 3px"}}>{notifCount}</span>}
     </button>
     <button title="Ayuda" style={{background:"transparent",border:0,cursor:"pointer",color:P.muted,padding:2,display:"grid",placeItems:"center"}}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .2c0 1.8-2.5 2-2.5 3.8M12 17h.01" strokeLinecap="round"/></svg>
     </button>
     <div style={{position:"relative"}}>
      <button onClick={()=>setTopMenu(m=>!m)} style={{display:"flex",alignItems:"center",gap:9,background:"transparent",border:0,cursor:"pointer",fontFamily:UI}}>
       <span style={{width:34,height:34,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontWeight:700,fontSize:12}}>{docInitials}</span>
       <span style={{textAlign:"left"}}><span style={{display:"block",fontSize:13.5,fontWeight:700,color:P.ink}}>{docDisplay}</span><span style={{display:"block",fontSize:11.5,color:P.muted}}>{docRole}</span></span>
       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a90ae" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {topMenu&&<div style={{position:"absolute",top:"calc(100% + 8px)",right:0,minWidth:200,background:"#fff",border:`1px solid ${LINE}`,borderRadius:12,boxShadow:"0 12px 32px rgba(16,42,86,.14)",padding:6,zIndex:40}} onClick={e=>e.stopPropagation()}>
       <button onClick={()=>setTopMenu(false)} style={{display:"flex",alignItems:"center",gap:9,width:"100%",textAlign:"left",background:"transparent",border:0,color:P.ink,fontSize:13.5,fontFamily:UI,padding:"9px 11px",borderRadius:9,cursor:"pointer"}}><NavIcon k="gear"/>Configuración</button>
       <button onClick={async()=>{await sessionLogout();location.href="/login";}} style={{display:"flex",alignItems:"center",gap:9,width:"100%",textAlign:"left",background:"transparent",border:0,color:"#C9364A",fontSize:13.5,fontFamily:UI,padding:"9px 11px",borderRadius:9,cursor:"pointer"}}>Cerrar sesión</button>
      </div>}
     </div>
    </div>
   </header>
  {view==="inicio" ? (()=>{
   // ===== DASHBOARD INICIO (consultorio) — S2.png =====
   const fecha=clock.toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).replace(/^\w/,c=>c.toUpperCase());
   const hora=clock.toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"}).toLowerCase();
   const nameOf=(pid:string)=>patientList?.find(p=>p.patientId===pid)?.name||`Paciente ${pid.slice(0,8)}`;
   const prTag=(pr:string):[string,string,string]=>pr==="HIGH"?["Crítico","#FDE7EA","#D23651"]:pr==="MEDIUM"?["Seguimiento","#EEEBFD","#6C5CF6"]:["Administrativo","#EEF0F5","#6B7391"];
   // Tareas: worklist real (tenant-wide) si hay; si no, ejemplo pulido.
   const realTasks=(panel?.gaps??[]).slice(0,6).map(g=>({title:g.label,who:nameOf(g.patientId),pr:g.priority as string,pid:g.patientId}));
   const demoTasks=[{title:"Resultado crítico: Potasio 6.2 mmol/L",who:"Pérez López, Juan · 58 años",pr:"HIGH",pid:""},{title:"Signos vitales críticos (TA 190/110)",who:"Ramírez Torres, Ana · 72 años",pr:"HIGH",pid:""},{title:"Seguimiento pendiente",who:"Díaz Martínez, Carlos · 45 años",pr:"MEDIUM",pid:""},{title:"Revisar interacción medicamentosa",who:"González Ruiz, María · 66 años",pr:"MEDIUM",pid:""},{title:"Firmar consentimiento pendiente",who:"López Sánchez, Daniel · 34 años",pr:"LOW",pid:""}];
   const tasks=realTasks.length?realTasks:demoTasks;
   // Pacientes recientes: lista real si hay; si no, ejemplo.
   const stEs=(s:string):[string,string,string]=>s==="ACTIVE"?["Activo","#E6F6EE","#16A66A"]:s==="INACTIVE"?["Inactivo","#EEF0F5","#6B7391"]:["Pendiente","#FBF0DC","#B7791F"];
   const realPts=(patientList??[]).slice(0,5).map(p=>({name:p.name,status:p.status,patientId:p.patientId}));
   const demoPts=[{name:"María Fernández",status:"PEND",age:"28 años",last:"Hoy 2:00 p.m.",motivo:"Primera vez"},{name:"Juan Pérez López",status:"ACTIVE",age:"58 años",last:"Hoy 12:30 p.m.",motivo:"Control DM2"},{name:"Ana Ramírez Torres",status:"PEND",age:"72 años",last:"Hoy 11:00 a.m.",motivo:"Resultados"},{name:"Carlos Díaz Martínez",status:"ACTIVE",age:"45 años",last:"Hoy 9:30 a.m.",motivo:"Dolor abdominal"},{name:"Sofía Vega Ramírez",status:"ACTIVE",age:"31 años",last:"Hoy 8:00 a.m.",motivo:"Control prenatal"}];
   const usingRealPts=realPts.length>0;
   const initials=(n:string)=>n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const critCount=notifCount;
   const kico=(bg:string,ic:React.ReactNode)=>(<span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}>{ic}</span>);
   const svg=(d:string,st:string,w="1.8")=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={st} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d}/></svg>;
   const kpiCard:React.CSSProperties={...card,marginTop:0,padding:18,display:"flex",gap:14,alignItems:"flex-start"};
   const h2row:React.CSSProperties={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px 10px"};
   const h2s:React.CSSProperties={fontSize:16.5,fontWeight:700,margin:0,display:"flex",alignItems:"center",gap:9};
   const link:React.CSSProperties={color:P.blue,fontSize:13,fontWeight:600,cursor:"pointer"};
   const cardP:React.CSSProperties={...card,marginTop:0};
   const qbtn:React.CSSProperties={display:"flex",alignItems:"center",gap:11,width:"100%",textAlign:"left",border:0,background:"transparent",padding:"11px 12px",borderRadius:10,fontSize:13.5,fontWeight:500,color:P.ink,cursor:"pointer",fontFamily:UI};
   const qa=(label:string,d:string,onClick:()=>void)=>(<button style={qbtn} onClick={onClick}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d}/></svg>{label}</button>);
   const go=(h2:string)=>{setView("exp");scrollToSection(h2);};
   // Interconexión con contexto: abre al paciente concreto en su Consulta (desde tareas/agenda/lista).
   const openPatientCtx=(pid:string,name:string)=>{if(pid){openConsulta(pid,name);}else{go("Panel del clínico");}};
   const citasHoy=agenda?.appointments.length??0;const atendidasHoy=agenda?.counts.atendidas??0;
   return <div style={{padding:"22px 26px 40px",maxWidth:1400,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div><h1 style={{fontSize:30,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Inicio</h1><p style={{color:P.muted,fontSize:14.5,margin:"6px 0 0"}}>Bienvenido, <b style={{color:P.ink}}>{docDisplay}</b>. Aquí tienes el resumen de hoy.</p></div>
     <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
      <span style={{display:"inline-flex",alignItems:"center",gap:8,background:P.white,border:`1px solid ${LINE}`,borderRadius:11,padding:"9px 14px",fontSize:13.5,fontWeight:600}}>{svg("M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",P.purple,"1.8")}{fecha}</span>
      <span style={{display:"inline-flex",alignItems:"center",gap:8,background:P.white,border:`1px solid ${LINE}`,borderRadius:11,padding:"9px 14px",fontSize:13.5,fontWeight:600}}>{svg("M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0",P.purple,"1.8")}{hora}</span>
     </div>
    </div>
    {/* KPIs */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:16,marginTop:20}} className="mos-kpis">
     <div style={kpiCard}>{kico("#EEEBFD",svg("M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",P.purple))}<div style={{flex:1}}><div style={{fontSize:13,color:P.muted}}>Citas de hoy</div><div style={{fontSize:26,fontWeight:800,margin:"2px 0"}}>{citasHoy}</div><div style={{height:6,borderRadius:99,background:"#EDEFF6",overflow:"hidden"}}><i style={{display:"block",height:"100%",width:`${citasHoy?Math.round(atendidasHoy/citasHoy*100):0}%`,background:P.purple,borderRadius:99}}/></div><div style={{fontSize:11.5,marginTop:5}}><span style={link} onClick={()=>setView("agenda")}>Ver agenda →</span></div></div></div>
     <div style={kpiCard}>{kico("#E6F6EE",svg("M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z",P.green))}<div style={{flex:1}}><div style={{fontSize:13,color:P.muted}}>Consultas atendidas</div><div style={{fontSize:26,fontWeight:800,margin:"2px 0"}}>{atendidasHoy}</div><div style={{fontSize:11.5,color:P.muted,marginTop:5}}>de {citasHoy} citas de hoy</div></div></div>
     <div style={kpiCard}>{kico("#FDE7EA",svg("M7 3h7l4 4v14H7zM14 3v4h4M10 13h5M10 16h3",P.red))}<div style={{flex:1}}><div style={{fontSize:13,color:P.muted}}>Pendientes críticos</div><div style={{fontSize:26,fontWeight:800,margin:"2px 0"}}>{critCount}</div><div style={{fontSize:11.5,marginTop:5}}><span style={link} onClick={()=>setView("resultados")}>Ver resultados →</span></div></div></div>
     <div style={kpiCard}>{kico("#E7EEFB",svg("M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",P.blue))}<div style={{flex:1,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div>{(()=>{const nx=agenda?.appointments.find(a=>a.status==="SCHEDULED"||a.status==="CHECKED_IN");return <><div style={{fontSize:13,color:P.muted}}>Próxima cita</div><div style={{fontSize:22,fontWeight:800,margin:"2px 0"}}>{nx?new Date(nx.startAt).toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"}).toLowerCase():"—"}</div><div style={{fontSize:11.5,color:P.muted}}>{nx?nx.patientName:"Sin citas próximas"}</div></>;})()}</div><span style={{width:30,height:30,borderRadius:"50%",background:"#E7EEFB",color:P.blue,display:"grid",placeItems:"center",cursor:"pointer"}} onClick={()=>setView("agenda")}>→</span></div></div>
    </div>
    {/* Banners */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16}} className="mos-banners">
     <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:14,background:"#FDECEE",border:"1px solid #F6CDD3"}}>{svg("M12 4l9 15.5H3zM12 10v4M12 17h.01",P.red)}<div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{critCount||2} resultados críticos sin resolver</div><div style={{fontSize:12.5,color:P.muted}}>Requieren acción para poder firmar consultas.</div></div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"8px 14px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}} onClick={()=>setView("resultados")}>Ver resultados</button></div>
     <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:14,background:"#FDF4E6",border:"1px solid #F2E1C0"}}>{svg("M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7zM7 8l6 6",P.amber)}<div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>Verificador de interacciones</div><div style={{fontSize:12.5,color:P.muted}}>Revisa el conjunto de fármacos del paciente (motor determinista).</div></div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"8px 14px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}} onClick={()=>{setView("medicamentos");setMedTab("interacciones");}}>Revisar</button></div>
    </div>
    {/* Mid: tareas | agenda | (CI + acciones) */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-mid">
     <div style={cardP}><div style={h2row}><h2 style={h2s}>Tareas clínicas prioritarias <span style={{background:P.purple,color:"#fff",fontSize:11,fontWeight:800,borderRadius:999,minWidth:20,height:20,display:"grid",placeItems:"center",padding:"0 5px"}}>{tasks.length}</span></h2><span style={link} onClick={()=>go("Panel del clínico")}>Ver todas →</span></div>
      {tasks.map((t,i)=>{const[tag,tbg,tfg]=prTag(t.pr);return <div key={i} title={t.pid?"Abrir consulta del paciente":undefined} style={{display:"flex",gap:12,padding:"12px 18px",borderTop:`1px solid #F1F3F9`,cursor:"pointer"}} onClick={()=>openPatientCtx(t.pid,t.who)}>
       <span style={{width:34,height:34,borderRadius:9,background:tbg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><span style={{width:8,height:8,borderRadius:"50%",background:tfg}}/></span>
       <div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:600}}>{t.title}</div><div style={{fontSize:12,color:P.muted}}>{t.who}</div></div>
       <span style={{fontSize:10.5,fontWeight:700,borderRadius:6,padding:"3px 8px",background:tbg,color:tfg,whiteSpace:"nowrap",alignSelf:"flex-start"}}>{tag}</span>
      </div>;})}
     </div>
     <div style={cardP}><div style={h2row}><h2 style={h2s}>Agenda de hoy</h2><span style={link} onClick={()=>setView("agenda")}>Ver agenda →</span></div>
      <div style={{padding:"4px 18px 14px",position:"relative"}}>
       <div style={{position:"absolute",left:73,top:8,bottom:14,width:2,background:"#EDEFF6"}}/>
       {(agenda?.appointments.length?agenda.appointments.slice(0,8).map(a=>({tm:new Date(a.startAt).toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"}).toLowerCase(),txt:`${a.patientName} · ${a.reason}`,on:a.status==="CHECKED_IN",pid:a.patientId,name:a.patientName})):([["8:00 a.m.","García Herrera, Laura · Control DM2",false],["9:00 a.m.","Martínez Soto, Roberto · Infección respiratoria",false],["10:00 a.m.","Vega Ramírez, Sofía · Control prenatal",false],["11:00 a.m.","Luna Pérez, Miguel · Dolor abdominal",false],["12:00 p.m.","Torres Jiménez, Carmen · Resultados de laboratorio",false],["2:00 p.m.","María Fernández · Primera vez",true],["3:00 p.m.","Hernández Ruiz, Alfonso · Control HTA",false],["4:00 p.m.","Mesas Rodríguez, Valeria · Retiro de DIU",false]] as [string,string,boolean][]).map(([tm,txt,on])=>({tm,txt,on,pid:"",name:""}))).map((it,i)=>(
        <div key={i} onClick={()=>openPatientCtx(it.pid,it.name)} title={it.pid?"Abrir consulta del paciente":undefined} style={{display:"flex",gap:14,padding:it.on?"9px 12px":"9px 0",position:"relative",cursor:it.pid?"pointer":"default",...(it.on?{background:"#F1EFFE",border:"1px solid #D9D3FA",borderRadius:12,margin:"2px -12px"}:{})}}>
         <span style={{fontSize:12,color:P.muted,width:62,flex:"0 0 auto",textAlign:"right",paddingTop:1}}>{it.tm}</span>
         <span style={{width:11,height:11,borderRadius:"50%",background:it.on?P.purple:"#fff",border:`2px solid ${it.on?P.purple:"#C9CEE6"}`,flex:"0 0 auto",marginTop:3,zIndex:1}}/>
         <div><div style={{fontSize:13,fontWeight:600,color:it.on?P.purple:P.ink}}>Consulta</div><div style={{fontSize:12,color:P.muted}}>{it.txt}</div></div>
        </div>))}
      </div>
     </div>
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={cardP}><div style={h2row}><h2 style={{...h2s,color:P.purple}}><NavIcon k="brain"/>Clinical Intelligence (IA)</h2></div>
       <div style={{padding:"0 18px",fontSize:12,color:P.muted,marginBottom:6}}>Ejemplos de hallazgos poblacionales (representativos; el tablero por cohorte se conecta al motor determinista).</div>
       <div style={{padding:"4px 18px 16px"}}>
        {[["#EEEBFD",P.purple,"flask","3 pacientes","con tamizaje de depresión pendiente"],["#FDE7EA",P.red,"activity","2 pacientes","con HbA1c > 8% (sin ajuste en 3 meses)"],["#E7EEFB",P.blue,"syringe","1 paciente","con vacunas atrasadas"],["#FBF0DC",P.amber,"pill","1 posible duplicidad","terapéutica en antihipertensivos"]].map(([bg,fg,ic,b,rest],i)=>(
         <div key={i} style={{display:"flex",gap:11,alignItems:"flex-start",padding:"9px 0",borderTop:i?`1px solid #F1F3F9`:"0"}}><span style={{width:30,height:30,borderRadius:8,background:bg as string,display:"grid",placeItems:"center",flex:"0 0 auto",color:fg as string}}><NavIcon k={ic as string}/></span><div style={{fontSize:13,lineHeight:1.35}}><b>{b}</b> {rest}</div></div>))}
        <button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px 14px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI,width:"100%",marginTop:10}} onClick={()=>setView("clinicalIntel")}>Ver Clinical Intelligence →</button>
       </div>
      </div>
      <div style={cardP}><div style={h2row}><h2 style={h2s}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.9" aria-hidden><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>Acciones rápidas</h2></div>
       <div style={{padding:8}}>
        {qa("Nueva consulta","M12 5v14M5 12h14",()=>{setConsultaPid(null);setView("consulta");})}
        {qa("Registrar resultado","M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3",()=>setView("resultados"))}
        {qa("Crear orden clínica","M8 4h8v3H8zM6 5H5v16h14V5h-1M8 12h8M8 16h5",()=>{setView("ordenes");setOrdNew(true);})}
        {qa("Prescribir medicamento","M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7zM7 8l6 6",()=>setView("medicamentos"))}
        {qa("Agendar cita","M4 6h16v14H4zM8 3v4M16 3v4",()=>{setView("agenda");setApptNew(true);})}
        {qa("Subir documento","M12 16V4m0 0l-4 4m4-4l4 4M4 20h16",()=>setView("documentos"))}
        {qa("Solicitar interconsulta","M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M16 4.5a3 3 0 010 6M22 20a6 6 0 00-5-5.9",()=>setView("interconsulta"))}
       </div>
      </div>
     </div>
    </div>
    {/* Pacientes recientes | recursos */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-low">
     <div style={cardP}><div style={h2row}><h2 style={h2s}>Pacientes recientes</h2><span style={link} onClick={()=>setView("pacientes")}>Ver todas →</span></div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr>{["Nombre","Edad","Última consulta","Motivo","Estado"].map(h=><th key={h} style={{textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"8px 18px",borderBottom:`1px solid ${LINE}`}}>{h}</th>)}</tr></thead>
       <tbody>{(usingRealPts?realPts:demoPts).map((p,i)=>{const[stl,sbg,sfg]=stEs(p.status);const d=p as{name:string;status:string;age?:string;last?:string;motivo?:string;patientId?:string};return <tr key={i}>
        <td style={{padding:"11px 18px",borderBottom:`1px solid #F4F6FB`,fontSize:13}}><span style={{display:"flex",alignItems:"center",gap:10,fontWeight:600,cursor:"pointer"}} onClick={()=>d.patientId?openPatientCtx(d.patientId,p.name):setView("pacientes")}><span style={{width:30,height:30,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700}}>{initials(p.name)}</span>{p.name}</span></td>
        <td style={{padding:"11px 18px",borderBottom:`1px solid #F4F6FB`,fontSize:13,color:P.muted}}>{d.age??"—"}</td>
        <td style={{padding:"11px 18px",borderBottom:`1px solid #F4F6FB`,fontSize:13,color:P.muted}}>{d.last??"—"}</td>
        <td style={{padding:"11px 18px",borderBottom:`1px solid #F4F6FB`,fontSize:13}}>{d.motivo??"—"}</td>
        <td style={{padding:"11px 18px",borderBottom:`1px solid #F4F6FB`}}><span style={{fontSize:11,fontWeight:700,borderRadius:999,padding:"3px 10px",background:sbg,color:sfg,whiteSpace:"nowrap"}}>{stl}</span></td>
       </tr>;})}</tbody>
      </table></div>
     </div>
     <div style={cardP}><div style={h2row}><h2 style={h2s}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.8" aria-hidden><path d="M4 5a2 2 0 012-2h9v18H6a2 2 0 01-2-2zM15 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3"/></svg>Recursos clínicos</h2></div>
      <div style={{padding:"6px 8px"}}>{([["Calculadoras médicas",()=>setView("biblioteca")],["Interacciones medicamentosas",()=>{setView("medicamentos");setMedTab("interacciones");}],["CIE-10 / CUPS",()=>setView("biblioteca")],["Protocolos del consultorio",()=>setView("biblioteca")],["Guías de práctica clínica",()=>setView("biblioteca")]] as const).map(([r,fn])=><div key={r} onClick={fn} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:9,color:P.blue,fontSize:13.5,fontWeight:500,cursor:"pointer"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="M8 6h9M8 12h9M8 18h6M4 6h.01M4 12h.01M4 18h.01"/></svg>{r}</div>)}</div>
     </div>
    </div>
    {/* Indicadores | donut | mensajes */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 340px",gap:16,marginTop:16,alignItems:"start"}} className="mos-low2">
     <div style={cardP}><div style={h2row}><h2 style={{...h2s,fontSize:15}}>Indicadores del consultorio</h2><span style={{fontSize:11,color:P.muted,background:"#F3F5FA",borderRadius:6,padding:"2px 8px"}}>representativo</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",padding:"0 6px 12px"}}>
       {[["48","Consultas totales","↑ 12%",true,"#DDD8FA"],["92%","Asistencia a citas","↑ 5%",true,"#DDD8FA"],["2.3 días","Tiempo de seguimiento","↓ 18%",false,"#DDD8FA"],["4.8/5","Satisfacción pacientes","↑ 0.4",true,"#B7E7CC"]].map(([v,l,tr,up,bar],i)=>(
        <div key={i} style={{padding:"14px 16px"}}><div style={{fontSize:23,fontWeight:800}}>{v as string}</div><div style={{fontSize:11.5,color:P.muted}}>{l as string}</div>
         <div style={{display:"flex",alignItems:"flex-end",gap:3,height:32,margin:"8px 0"}}>{[40,62,48,75,88,70].map((h,j)=><span key={j} style={{flex:1,height:`${h}%`,background:bar as string,borderRadius:2}}/>)}</div>
         <div style={{fontSize:12,fontWeight:700,color:up?P.green:"#D23651"}}>{tr as string}</div></div>))}
      </div>
     </div>
     <div style={{...cardP,padding:"16px 18px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h2 style={{...h2s,fontSize:15}}>Distribución de motivos de consulta</h2><span style={{fontSize:11,color:P.muted,background:"#F3F5FA",borderRadius:6,padding:"2px 8px"}}>representativo</span></div>
      <div style={{display:"flex",gap:20,alignItems:"center"}}>
       <div style={{width:150,height:150,borderRadius:"50%",flex:"0 0 auto",display:"grid",placeItems:"center",background:"conic-gradient(#6C5CF6 0 29%,#8B7DF8 29% 56%,#20B7D9 56% 71%,#5B8DEF 71% 83%,#C9CEE6 83% 100%)"}}><div style={{width:96,height:96,borderRadius:"50%",background:P.white,display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:22,fontWeight:800}}>48</div><div style={{fontSize:10,color:P.muted}}>consultas</div></div></div></div>
       <div style={{flex:1}}>{[["#6C5CF6","Infecciones respiratorias","29%"],["#8B7DF8","Control crónicos","27%"],["#20B7D9","Gastrointestinal","15%"],["#5B8DEF","Salud preventiva","12%"],["#C9CEE6","Otros","17%"]].map(([c,l,p],i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,padding:"4px 0"}}><span style={{width:9,height:9,borderRadius:"50%",background:c as string,flex:"0 0 auto"}}/>{l as string}<b style={{marginLeft:"auto"}}>{p as string}</b></div>)}</div>
      </div>
     </div>
     <div style={cardP}><div style={h2row}><h2 style={{...h2s,fontSize:15}}>Mensajes y notificaciones <span style={{background:P.red,color:"#fff",fontSize:11,fontWeight:800,borderRadius:999,minWidth:20,height:20,display:"grid",placeItems:"center",padding:"0 5px"}}>3</span></h2><span style={link}>Ver todos →</span></div>
      {[["#5B8DEF","Nuevo resultado de laboratorio","Hoy 12:45 p.m."],["#16A66A","Interconsulta aceptada","Hoy 10:20 a.m."],["#E5983B","Documento pendiente por firmar","Ayer 6:15 p.m."]].map(([c,t,tm],i)=><div key={i} style={{display:"flex",gap:11,padding:"10px 18px",borderTop:`1px solid #F1F3F9`,alignItems:"flex-start"}}><span style={{width:8,height:8,borderRadius:"50%",background:c as string,marginTop:5,flex:"0 0 auto"}}/><div style={{flex:1,fontSize:13,fontWeight:600}}>{t as string}</div><span style={{fontSize:11.5,color:"#9AA0BC",whiteSpace:"nowrap"}}>{tm as string}</span></div>)}
     </div>
    </div>
   </div>;
  })() : view==="pacientes" ? (()=>{
   // ===== VISTA PACIENTES — lista real + FICHA contextual (sólo al seleccionar) con pestañas en sitio y edición real =====
   const ageOf=(bd?:string):number|null=>{if(!bd)return null;const b=new Date(bd),n=new Date();let y=n.getFullYear()-b.getFullYear();if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))y--;return y;};
   const sexAbbr=(s?:string)=>s==="FEMALE"?"F":s==="MALE"?"M":s==="INTERSEX"?"I":"—";
   const sexEs=(s?:string)=>s==="F"||s==="FEMALE"?"Femenino":s==="M"||s==="MALE"?"Masculino":s==="I"||s==="INTERSEX"?"Intersexual":"—";
   const initials=(n:string)=>n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()||"P";
   type Row={patientId:string;name:string;status:string;age:number|null;sexo:string;curp:string};
   const real=(patientList??[]).map(p=>({patientId:p.patientId,name:p.name,status:p.status,age:ageOf(p.birthDate),sexo:sexAbbr(p.sexAtBirth),curp:p.curp||"—"}));
   // Solo pacientes REALES del tenant. Sin filas de ejemplo (evita clics inertes): si no hay, estado vacío honesto.
   const loading=patientList===null;const allRows:Row[]=real;
   const total=allRows.length;const activos=allRows.filter(r=>r.status==="ACTIVE").length;
   const q=topSearch.trim().toLowerCase();
   const rows=allRows.filter(r=>(!q||r.name.toLowerCase().includes(q)||r.curp.toLowerCase().includes(q))&&(!patStatus||r.status===patStatus)&&(!patSex||r.sexo===patSex));
   const anyFilter=!!q||!!patStatus||!!patSex;
   const stTag=(s:string):[string,string,string]=>s==="ACTIVE"?["Activo","#E6F6EE","#16A66A"]:["Inactivo","#EEF0F5","#6B7191"];
   const kico=(bg:string,d:string,st:string)=>(<span style={{width:42,height:42,borderRadius:11,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={st} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d}/></svg></span>);
   const kcard:React.CSSProperties={...card,marginTop:0,padding:16,display:"flex",gap:13,alignItems:"center"};
   const selSty:React.CSSProperties={display:"inline-flex",alignItems:"center",gap:7,background:P.white,border:`1px solid ${LINE}`,borderRadius:10,padding:"9px 12px",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:UI,color:P.ink};
   const dk:React.CSSProperties={color:P.muted,width:140,flex:"0 0 auto",fontSize:12.5};
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"};
   const inp:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink,boxSizing:"border-box"};
   const isReal=(_r:Row)=>true; // todas las filas son pacientes reales del tenant
   const selectRow=(r:Row)=>{if(isReal(r)){setPatSelId(r.patientId);selectPatientRaw(r.patientId,r.name);setPatTab("resumen");setPatEdit(false);}else{setPatSelId(null);}};
   const exportSelected=async(pid:string,name:string)=>{setPatMsg(`Generando export del expediente de ${name}…`);try{const resp=await apiRequest(`/api/v1/patients/${pid}/export`,{method:"GET"});if(resp.status>=400){setPatMsg(errMsg(resp));return;}const m=resp.body["manifest"] as{aggregateCount:number;eventCount:number};setPatMsg(`Export de ${name}: ${m.aggregateCount} agregados · ${m.eventCount} eventos · hash ${String(resp.body["contentHash"]??"").slice(0,12)}…`);}catch(e){setPatMsg(String(e));}};
   // Paciente en foco (la ficha SÓLO existe si hay selección real):
   const fp=patSelId?(patientList??[]).find(p=>p.patientId===patSelId):undefined;
   const fAge=ageOf(fp?.birthDate);const fresh=patientId===patSelId; // snapshot/timeline/docs corresponden al paciente en foco
   const sd=fresh?snap?.demographics:undefined;
   const fmtDT=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);if(isNaN(d.getTime()))return"—";const now=Date.now(),diff=(now-d.getTime())/1000;if(diff<3600)return `hace ${Math.max(1,Math.round(diff/60))} min`;if(diff<86400)return `hace ${Math.round(diff/3600)} h`;return d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const fmtDate=(iso?:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const KIND_ES:Record<string,string>={REGISTERED:"Registrado",SIGNED:"Firmado",PROPOSED:"Propuesto",ACTIVATED:"Activado",PRESCRIBED:"Prescrito",RECEIVED:"Recibido",VERIFIED:"Verificado",ACTIONED:"En acción",CLOSED:"Cerrado",CREATED:"Creado",PLACED:"Enviado",FULFILLED:"Cumplido",CANCELLED:"Cancelado",SCHEDULED:"Agendado",CHECKED_IN:"En espera",COMPLETED:"Completado",OPEN:"Abierta",RESOLVED:"Resuelta",DUE:"Pendiente",ADMINISTERED:"Aplicada",RECORDED:"Registrado",AMENDED:"Corregido"};
   const notesDocs=(docsSnap?.items??[]).filter(d=>/nota/i.test(d.typeLabel));
   const allDocs=docsSnap?.items??[];
   return <div style={{display:"flex",minHeight:"100%",alignItems:"stretch"}}>
    <div style={{flex:1,minWidth:0,padding:"22px 24px 40px"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Pacientes</h1><p style={{color:P.muted,fontSize:13.5,margin:"6px 0 0"}}>Gestiona, busca y da seguimiento a todos tus pacientes.</p></div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
       <button title="Importación masiva próximamente" style={{display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 15px",fontWeight:600,fontSize:13.5,cursor:"not-allowed",fontFamily:UI,color:"#C7CCE0"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 15V4m0 0l-4 4m4-4l4 4M4 20h16"/></svg>Importar</button>
       <button style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setPatNew(v=>!v);setPatMsg(null);}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 5v14M5 12h14"/></svg>{patNew?"Cerrar":"Nuevo paciente"}</button>
      </div>
     </div>
     {patMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:patMsg.includes("✓")?"#F0FBF4":"#EEF6FF",border:`1px solid ${patMsg.includes("✓")?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:patMsg.includes("✓")?P.green:P.blue,fontWeight:700}}>{patMsg.includes("✓")?"✓":"ℹ"}</span><span style={{flex:1}}>{patMsg}</span><button onClick={()=>setPatMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
     {patNew&&<div style={{...card,marginTop:14,padding:18}}>
      <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>Nuevo paciente</div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:14}} className="mos-med2">
       <div><div style={flbl}>Nombre completo</div><input value={regName} onChange={e=>setRegName(e.target.value)} placeholder="Ej. María Fernández López" style={inp}/></div>
       <div><div style={flbl}>Fecha de nacimiento</div><input type="date" value={regDob} onChange={e=>setRegDob(e.target.value)} style={inp}/></div>
       <div><div style={flbl}>Sexo</div><select value={regSex} onChange={e=>setRegSex(e.target.value)} style={inp}><option value="FEMALE">Femenino</option><option value="MALE">Masculino</option><option value="INTERSEX">Intersexual</option><option value="UNKNOWN">Sin especificar</option></select></div>
      </div>
      <div style={{marginTop:12,maxWidth:360}}><div style={flbl}>CURP (opcional)</div><input value={regExtra.curp} onChange={e=>setRegExtra({...regExtra,curp:e.target.value.toUpperCase()})} placeholder="18 caracteres" style={inp}/></div>
      <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>registerPatient(true)} disabled={busy==="pt-reg"||!regName.trim()} style={{border:0,background:(busy==="pt-reg"||!regName.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(busy==="pt-reg"||!regName.trim())?"default":"pointer",fontFamily:UI}}>{busy==="pt-reg"?"Registrando…":"Registrar paciente"}</button><button onClick={()=>setPatNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
     </div>}
     <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:14,marginTop:18}} className="mos-kpis">
      <div style={kcard}>{kico("#EEEBFD","M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M16 4.5a3 3 0 010 6M22 20a6 6 0 00-5-5.9",P.purple)}<div><div style={{fontSize:12.5,color:P.muted}}>Total de pacientes</div><div style={{fontSize:24,fontWeight:800}}>{total.toLocaleString("es-MX")}</div></div></div>
      <div style={kcard}>{kico("#E6F6EE","M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z",P.green)}<div><div style={{fontSize:12.5,color:P.muted}}>Pacientes activos</div><div style={{fontSize:24,fontWeight:800}}>{activos.toLocaleString("es-MX")} <span style={{fontSize:12,color:P.green,fontWeight:600}}>● {total?Math.round(activos/total*100):0}%</span></div></div></div>
      <div style={kcard}>{kico("#E7EEFB","M6 2h12l-1 6H7zM5 8h14l-1 12H6z",P.blue)}<div><div style={{fontSize:12.5,color:P.muted}}>{anyFilter?"Coinciden con el filtro":"En el registro"}</div><div style={{fontSize:24,fontWeight:800}}>{rows.length}</div></div></div>
      <div style={kcard}>{kico("#FDECEE","M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z",P.red)}<div><div style={{fontSize:12.5,color:P.muted}}>En seguimiento</div><div style={{fontSize:24,fontWeight:800}}>{(patSelId&&patientId===patSelId)?(gaps?.length??0):"—"}</div></div></div>
     </div>
     <div style={{display:"flex",gap:10,alignItems:"center",marginTop:16,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:200,display:"flex",alignItems:"center",gap:9,background:P.white,border:`1px solid ${LINE}`,borderRadius:10,padding:"9px 13px"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" strokeLinecap="round"/></svg><input placeholder="Buscar por nombre o CURP…" value={topSearch} onChange={e=>setTopSearch(e.target.value)} style={{border:0,outline:"none",background:"transparent",fontSize:13.5,fontFamily:UI,flex:1,color:P.ink}}/></div>
      <select value={patStatus} onChange={e=>setPatStatus(e.target.value)} style={selSty}><option value="">Estado: Todos</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option></select>
      <select value={patSex} onChange={e=>setPatSex(e.target.value)} style={selSty}><option value="">Sexo: Todos</option><option value="F">Femenino</option><option value="M">Masculino</option></select>
      {anyFilter&&<button onClick={()=>{setTopSearch("");setPatStatus("");setPatSex("");}} style={{...selSty,color:P.blue,fontWeight:600}}>Limpiar filtros</button>}
     </div>
     <div style={{...card,marginTop:14,overflow:"hidden"}}>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr>{["Paciente","Edad","Sexo","Estado","Acciones"].map((h,i)=><th key={i} style={{textAlign:i>=3?"right":"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"12px 16px",borderBottom:`1px solid ${LINE}`,background:"#FAFBFD"}}>{h}</th>)}</tr></thead>
       <tbody>{rows.length===0?(
        <tr><td colSpan={5} style={{padding:"44px 16px",textAlign:"center",color:P.muted,fontSize:13.5}}>{loading?"Cargando pacientes…":allRows.length===0?<span>Aún no hay pacientes registrados. Usa <b style={{color:P.ink}}>«Nuevo paciente»</b> para crear el primero.</span>:"Ningún paciente coincide con la búsqueda o el filtro."}</td></tr>
       ):rows.map(r=>{const[stl,sbg,sfg]=stTag(r.status);const on=isReal(r)&&r.patientId===patSelId;return <tr key={r.patientId} onClick={()=>selectRow(r)} style={{background:on?"#F6F5FE":"transparent",cursor:isReal(r)?"pointer":"default",borderLeft:on?`3px solid ${P.purple}`:"3px solid transparent"}}>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`}}><div style={{display:"flex",alignItems:"center",gap:11}}><span style={{width:38,height:38,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:12.5,fontWeight:700,flex:"0 0 auto"}}>{initials(r.name)}</span><div><div style={{fontWeight:600,fontSize:13.5}}>{r.name}</div><div style={{fontSize:11,color:"#9AA0BC"}}>CURP: {r.curp}</div></div></div></td>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,fontSize:13}}>{r.age!=null?`${r.age} años`:"—"}</td>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,fontSize:13}}>{sexEs(r.sexo)}</td>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,textAlign:"right"}}><span style={{fontSize:11.5,fontWeight:600,borderRadius:999,padding:"3px 11px",background:sbg,color:sfg}}>{stl}</span></td>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,textAlign:"right"}}><span style={{color:isReal(r)?P.blue:"#C7CCE0",fontWeight:600,fontSize:12.5,cursor:isReal(r)?"pointer":"default"}} onClick={e=>{e.stopPropagation();selectRow(r);}}>{on?"En ficha ›":"Abrir ficha ›"}</span></td>
       </tr>;})}</tbody>
      </table></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",fontSize:13,color:P.muted,flexWrap:"wrap",gap:10}}>
       <span>Mostrando {rows.length} de {total.toLocaleString("es-MX")} pacientes{anyFilter?" (filtrado)":""}</span>
      </div>
     </div>
    </div>
    {/* FICHA — sólo cuando hay un paciente seleccionado (real) */}
    {fp&&<aside style={{flex:"0 0 400px",borderLeft:`1px solid ${LINE}`,background:P.white,minHeight:"100%",display:"flex",flexDirection:"column"}} className="mos-detail">
     <div style={{padding:"20px 22px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
       <div style={{display:"flex",gap:13,minWidth:0}}><span style={{width:56,height:56,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontWeight:800,fontSize:20,flex:"0 0 auto"}}>{initials(fp.name)}</span><div style={{minWidth:0}}><div style={{fontSize:18,fontWeight:800,lineHeight:1.15}}>{fp.name}</div><div style={{fontSize:12.5,color:P.muted,marginTop:2}}>{fAge!=null?`${fAge} años · `:""}{sexEs(fp.sexAtBirth)}</div>{(()=>{const[stl,sbg,sfg]=stTag(fp.status);return <span style={{display:"inline-flex",alignItems:"center",gap:6,background:sbg,color:sfg,borderRadius:999,padding:"2px 10px",fontSize:11.5,fontWeight:700,marginTop:6}}>● {stl}</span>;})()}</div></div>
       <div style={{display:"flex",gap:6,flex:"0 0 auto"}}>{!patEdit&&<button onClick={()=>openEdit(fp.patientId)} title="Editar ficha" style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"7px 11px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI,display:"inline-flex",alignItems:"center",gap:6}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 20h9M16.5 3.5a2 2 0 013 3L7 19l-4 1 1-4z"/></svg>Editar</button>}<button onClick={()=>setPatSelId(null)} title="Cerrar ficha" style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,width:32,height:32,cursor:"pointer",color:P.muted,fontFamily:UI}}>×</button></div>
      </div>
      {!patEdit&&<div style={{display:"flex",gap:16,borderBottom:`1px solid ${LINE}`,marginTop:16}}>{([["resumen","Resumen"],["historial","Historial"],["notas","Notas"],["documentos","Documentos"]] as const).map(([k,l])=><span key={k} onClick={()=>setPatTab(k)} style={{fontSize:13.5,color:patTab===k?P.purple:P.muted,fontWeight:patTab===k?700:500,paddingBottom:10,borderBottom:patTab===k?`2px solid ${P.purple}`:"2px solid transparent",cursor:"pointer"}}>{l}</span>)}</div>}
     </div>
     <div style={{padding:"16px 22px 24px",overflowY:"auto",flex:1}}>
      {patEdit?(
       <div>
        <div style={{fontSize:15,fontWeight:800,marginBottom:14}}>Editar ficha del paciente</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
         <div><div style={flbl}>Nombre completo</div><input value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} style={inp}/></div>
         <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><div style={flbl}>Fecha de nacimiento</div><input type="date" value={editForm.birthDate} onChange={e=>setEditForm({...editForm,birthDate:e.target.value})} style={inp}/></div><div><div style={flbl}>Sexo</div><select value={editForm.sexAtBirth} onChange={e=>setEditForm({...editForm,sexAtBirth:e.target.value})} style={inp}><option value="FEMALE">Femenino</option><option value="MALE">Masculino</option><option value="INTERSEX">Intersexual</option><option value="UNKNOWN">Sin especificar</option></select></div></div>
         <div><div style={flbl}>CURP</div><input value={editForm.curp} onChange={e=>setEditForm({...editForm,curp:e.target.value.toUpperCase()})} style={inp}/></div>
         <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><div style={flbl}>Teléfono</div><input value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})} style={inp}/></div><div><div style={flbl}>Correo</div><input value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})} style={inp}/></div></div>
         <div><div style={flbl}>Dirección</div><input value={editForm.address} onChange={e=>setEditForm({...editForm,address:e.target.value})} style={inp}/></div>
         <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><div style={flbl}>Ocupación</div><input value={editForm.occupation} onChange={e=>setEditForm({...editForm,occupation:e.target.value})} style={inp}/></div><div><div style={flbl}>Estado civil</div><input value={editForm.maritalStatus} onChange={e=>setEditForm({...editForm,maritalStatus:e.target.value})} style={inp}/></div></div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void amendPatient(fp.patientId)} disabled={editBusy||!editForm.name.trim()} style={{flex:1,border:0,background:(editBusy||!editForm.name.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px",fontWeight:700,fontSize:14,cursor:(editBusy||!editForm.name.trim())?"default":"pointer",fontFamily:UI}}>{editBusy?"Guardando…":"Guardar cambios"}</button><button onClick={()=>setPatEdit(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 16px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
       </div>
      ):patTab==="resumen"?(
       <div>
        <div style={{fontSize:13.5,fontWeight:800,margin:"0 0 10px"}}>Información general</div>
        {[["Fecha de nacimiento",sd?.birthDate?`${fmtDate(sd.birthDate)}${fAge!=null?` (${fAge} años)`:""}`:(fAge!=null?`${fAge} años`:"—")],["Sexo",sexEs(fp.sexAtBirth)],["CURP",fp.curp||"—"],["Teléfono",sd?.phone||"—"],["Correo",sd?.email||"—"],["Dirección",sd?.address||"—"],["Ocupación",sd?.occupation||"—"],["Estado civil",sd?.maritalStatus||"—"]].map(([k,v])=><div key={k} style={{display:"flex",fontSize:13,padding:"5px 0",borderBottom:"1px solid #F6F7FB"}}><span style={dk}>{k}</span><span style={{fontWeight:500}}>{v}</span></div>)}
        {!fresh&&<div style={{fontSize:11.5,color:P.muted,marginTop:8}}>Cargando datos del paciente…</div>}
        <div style={{fontSize:13.5,fontWeight:800,margin:"18px 0 10px"}}>Antecedentes relevantes</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
         <div style={{display:"flex",gap:10,padding:"9px 11px",borderRadius:10,background:"#FDECEE"}}><span style={{color:"#D23651",fontWeight:800,fontSize:12,minWidth:78}}>Alergias</span><span style={{fontSize:12.5,color:"#7a1f2b"}}>{sd&&snap?.allergies.length?snap.allergies.join(", "):"Sin alergias conocidas"}</span></div>
         <div style={{display:"flex",gap:10,padding:"9px 11px",borderRadius:10,background:"#EEEBFD"}}><span style={{color:"#6C5CF6",fontWeight:800,fontSize:12,minWidth:78}}>Problemas</span><span style={{fontSize:12.5,color:"#3a2f7a"}}>{sd&&snap?.problems.length?snap.problems.map(DX_LABEL).slice(0,4).join(", "):"Sin problemas activos"}</span></div>
         <div style={{display:"flex",gap:8}}>{([["Medicamentos","Medicación"],["Vacunas","Vacunas"]] as const).map(([l,h2])=><button key={l} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection(h2),0);}} style={{flex:1,border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px",fontSize:12.5,fontWeight:600,color:P.ink,cursor:"pointer",fontFamily:UI}}>{l} →</button>)}</div>
        </div>
        <div style={{fontSize:13.5,fontWeight:800,margin:"18px 0 10px"}}>Acciones</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
         <button onClick={()=>openConsulta(fp.patientId,fp.name)} style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"11px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Ver consulta</button>
         <div style={{display:"flex",gap:9}}>
          <button onClick={()=>{setApptForm(f=>({...f,patientId:fp.patientId}));setApptNew(true);setAgendaDate(new Date().toISOString().slice(0,10));setView("agenda");window.scrollTo({top:0,behavior:"smooth"});}} style={{flex:1,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>Agendar cita</button>
          <button onClick={()=>void exportSelected(fp.patientId,fp.name)} style={{flex:1,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>Exportar</button>
         </div>
        </div>
       </div>
      ):patTab==="historial"?(
       <div>
        <div style={{fontSize:13.5,fontWeight:800,margin:"0 0 12px"}}>Historial del expediente</div>
        {!fresh?<div style={{fontSize:12.5,color:P.muted}}>Cargando historial…</div>:(tl&&tl.length)?<div style={{position:"relative",paddingLeft:18}}><div style={{position:"absolute",left:4,top:6,bottom:6,width:2,background:"#EDEFF6"}}/>{tl.slice(0,20).map((it,i)=><div key={i} style={{position:"relative",padding:"9px 0"}}><span style={{position:"absolute",left:-18,top:12,width:9,height:9,borderRadius:"50%",background:P.purple,border:"2px solid #fff",boxShadow:"0 0 0 1px "+P.purple}}/><div style={{display:"flex",justifyContent:"space-between",gap:8}}><span style={{fontSize:13,fontWeight:600}}>{TYPE_LABEL[it.aggregateType]??it.aggregateType}</span><span style={{fontSize:11,color:P.muted,whiteSpace:"nowrap"}}>{fmtDT(it.lastAt)}</span></div><div style={{fontSize:12,color:P.muted}}>{KIND_ES[it.latestKind]??it.latestKind} · v{it.version}</div></div>)}</div>:<div style={{fontSize:12.5,color:P.muted,padding:"20px 0",textAlign:"center"}}>Sin eventos en el expediente de este paciente todavía.</div>}
       </div>
      ):patTab==="notas"?(
       <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"0 0 12px"}}><div style={{fontSize:13.5,fontWeight:800}}>Notas clínicas</div><button onClick={()=>{selectPatientRaw(fp.patientId,fp.name);setView("documentos");setDocNew(true);}} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:8,padding:"5px 10px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:UI}}>+ Nueva</button></div>
        {!fresh?<div style={{fontSize:12.5,color:P.muted}}>Cargando notas…</div>:notesDocs.length?notesDocs.map((d,i)=><div key={i} style={{display:"flex",gap:10,padding:"11px 0",borderBottom:"1px solid #F2F4F9"}}><span style={{color:P.blue,flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z"/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600}}>{d.title}</div><div style={{fontSize:11.5,color:P.muted}}>{d.typeLabel} · {fmtDate(d.createdAt)}</div></div></div>):<div style={{fontSize:12.5,color:P.muted,padding:"20px 0",textAlign:"center"}}>Sin notas clínicas para este paciente.</div>}
       </div>
      ):(
       <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"0 0 12px"}}><div style={{fontSize:13.5,fontWeight:800}}>Documentos ({allDocs.length})</div><button onClick={()=>{selectPatientRaw(fp.patientId,fp.name);setView("documentos");setDocNew(true);}} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:8,padding:"5px 10px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:UI}}>+ Nuevo</button></div>
        {!fresh?<div style={{fontSize:12.5,color:P.muted}}>Cargando documentos…</div>:allDocs.length?allDocs.map((d,i)=><div key={i} style={{display:"flex",gap:10,padding:"11px 0",borderBottom:"1px solid #F2F4F9"}}><span style={{color:P.red,flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2h9l5 5v15H6zM14 2v6h6"/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600}}>{d.title}</div><div style={{fontSize:11.5,color:P.muted}}>{d.typeLabel} · {fmtDate(d.createdAt)}</div></div></div>):<div style={{fontSize:12.5,color:P.muted,padding:"20px 0",textAlign:"center"}}>Sin documentos para este paciente.</div>}
       </div>
      )}
     </div>
    </aside>}
   </div>;
  })() : view==="consulta" ? (()=>{
   // ===== PANEL DE CONSULTAS (landing) — sin paciente en foco: citas de hoy + iniciar nueva consulta =====
   if(!consultaPid){
    const card2:React.CSSProperties={...card,marginTop:0};
    const ini=(n:string)=>n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()||"P";
    const tHM=(iso:string)=>{const d=new Date(iso);if(isNaN(d.getTime()))return"—";const h=d.getUTCHours();const mn=d.getUTCMinutes().toString().padStart(2,"0");const ap=h<12?"a.m.":"p.m.";const h12=h%12||12;return `${h12}:${mn} ${ap}`;};
    const ST:Record<string,[string,string,string]>={SCHEDULED:["Programada","#EAF1FD","#1769E0"],CHECKED_IN:["En espera","#FBF0DC","#B7791F"],COMPLETED:["Atendida","#E6F6EE","#16A66A"],CANCELLED:["Cancelada","#F0F1F4","#8A8FA3"],NO_SHOW:["Inasistencia","#FDE7EA","#D23651"]};
    const appts=(agenda?.appointments??[]).slice().sort((a,b)=>a.startAt.localeCompare(b.startAt));
    const pend=appts.filter(a=>a.status==="SCHEDULED"||a.status==="CHECKED_IN");
    const cnt=agenda?.counts??{programadas:appts.length,atendidas:0,enEspera:0,canceladas:0};
    const kc=(bg:string,fg:string,d:string,n:number|string,l:string)=><div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span><div><div style={{fontSize:24,fontWeight:800}}>{n}</div><div style={{fontSize:11.5,color:P.muted}}>{l}</div></div></div>;
    const npName=(patientList??[]).find(p=>p.patientId===consultaNewPid)?.name??"";
    return <div style={{padding:"22px 26px 40px",maxWidth:1120,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M6 4v5a5 5 0 0010 0V4M11 14v2a4 4 0 008 0M19 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Consultas</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Panel del día. Inicia una nueva consulta o abre la de una cita agendada.</p></div></div>
      <button style={{display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setApptNew(true);setAgendaDate(new Date().toISOString().slice(0,10));setView("agenda");window.scrollTo({top:0,behavior:"smooth"});}}>+ Agendar consulta</button>
     </div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginTop:18}} className="mos-kpis">
      {kc("#EEEBFD",P.purple,"M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",cnt.programadas,"Citas de hoy")}
      {kc("#FBF0DC",P.amber,"M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0",cnt.enEspera,"En espera")}
      {kc("#E6F6EE",P.green,"M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z",cnt.atendidas,"Atendidas hoy")}
     </div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-mid">
      <div style={{...card2,padding:18}}>
       <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>Iniciar nueva consulta</div>
       <div style={{fontSize:12.5,color:P.muted,marginBottom:14}}>Elige el paciente para abrir su expediente de consulta.</div>
       <div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Paciente</div>
       <select value={consultaNewPid} onChange={e=>setConsultaNewPid(e.target.value)} style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"10px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink}}><option value="">Selecciona un paciente…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select>
       {(patientList??[]).length===0&&<div style={{fontSize:11.5,color:P.muted,marginTop:6}}>No hay pacientes en el tenant. Regístralos en «Pacientes».</div>}
       <button disabled={!consultaNewPid} onClick={()=>openConsulta(consultaNewPid,npName)} style={{marginTop:14,width:"100%",justifyContent:"center",display:"flex",border:0,background:consultaNewPid?P.purple:"#C7CCE0",color:"#fff",borderRadius:10,padding:"11px",fontWeight:700,fontSize:14,cursor:consultaNewPid?"pointer":"default",fontFamily:UI}}>Abrir consulta</button>
      </div>
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px 10px"}}><div style={{fontSize:16,fontWeight:800}}>Citas de hoy ({pend.length} por atender)</div><span style={{color:P.blue,fontSize:13,fontWeight:600,cursor:"pointer"}} onClick={()=>setView("agenda")}>Ver agenda →</span></div>
       {appts.length===0?<div style={{padding:"28px 18px",textAlign:"center",color:P.muted,fontSize:13}}>No hay citas para hoy. Usa «+ Agendar consulta».</div>:appts.slice(0,8).map(a=>{const st=ST[a.status]??["",P.canvas,P.muted];const canOpen=a.status==="SCHEDULED"||a.status==="CHECKED_IN";return <div key={a.appointmentId} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 18px",borderTop:`1px solid #F1F3F9`}}><span style={{fontSize:12.5,color:P.muted,width:64,flex:"0 0 auto"}}>{tHM(a.startAt)}</span><span style={{width:34,height:34,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,flex:"0 0 auto"}}>{ini(a.patientName)}</span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13}}>{a.patientName}</div><div style={{fontSize:11.5,color:P.muted}}>{a.reason}</div></div><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:st[1],color:st[2]}}>{st[0]}</span><button disabled={!canOpen} onClick={()=>openConsulta(a.patientId,a.patientName)} style={{border:0,background:canOpen?P.purple:"#EEF0F5",color:canOpen?"#fff":"#9AA0BC",borderRadius:8,padding:"7px 12px",fontWeight:700,fontSize:12,cursor:canOpen?"pointer":"default",fontFamily:UI}}>Abrir</button></div>;})}
      </div>
     </div>
    </div>;
   }
   // ===== VISTA CONSULTA (workspace clínico) — S4.png, pestaña "Consulta actual" =====
   const pName=patientName||"María Fernández López";
   const age=snap?.demographics.age??28;
   const sexo=snap?snap.demographics.sex:"FEMALE";
   const sexoEs=sexo==="FEMALE"?"Femenino":sexo==="MALE"?"Masculino":"—";
   const alN=snap?snap.allergies.length:1,prN=snap?snap.problems.length:2;
   const findings=snap?.findings??[];
   const V=snap?.vitals??{};
   const initials=pName.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const card2:React.CSSProperties={...card,marginTop:0};
   const sec:React.CSSProperties={...card2,padding:18};
   const sect:React.CSSProperties={fontSize:15,fontWeight:700,margin:"0 0 12px"};
   const ta:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:11,padding:"12px 14px",fontSize:13.5,fontFamily:UI,resize:"vertical",minHeight:64,color:P.ink,boxSizing:"border-box"};
   const cc:React.CSSProperties={fontSize:11,color:"#9AA0BC",textAlign:"right",marginTop:5};
   const antp=(bg:string,fg:string,label:string,d:string)=>(<div style={{display:"flex",alignItems:"center",gap:7,borderRadius:10,padding:"8px 12px",fontSize:12.5,fontWeight:600,whiteSpace:"nowrap",background:bg,color:fg,cursor:"pointer"}} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection(label==="Alergias"?"Alergias":label==="Problemas"?"Lista de problemas":label==="Medicamentos"?"Medicación":"Vacunas"),0);}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={d}/></svg>{label}</div>);
   const link:React.CSSProperties={color:P.blue,fontSize:13,fontWeight:600,cursor:"pointer"};
   // Botón real que abre la sección correspondiente del expediente (antes era un chip decorativo "+ Agregar" sin acción).
   const sgo=(label:string,section:string)=><button onClick={()=>{setView("exp");setTimeout(()=>scrollToSection(section),0);}} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:600,color:P.purple,cursor:"pointer",whiteSpace:"nowrap",fontFamily:UI}}>{label}</button>;
   const CTABS:[typeof cTab,string][]=[["actual","Consulta actual"],["resultados","Resultados"],["ordenes","Órdenes"],["medicamentos","Medicamentos"],["plan","Plan de cuidados"],["documentos","Documentos"],["seguimiento","Seguimiento"]];
   const rsum=(bg:string,fg:string,d:string,title:string,sub:string,right:React.ReactNode)=>(<div style={{display:"flex",gap:11,padding:"12px 0",borderTop:`1px solid #F1F3F9`,alignItems:"flex-start"}}><span style={{width:34,height:34,borderRadius:9,background:bg,color:fg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={d}/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13.5}}>{title}</div><div style={{fontSize:12.5,color:P.muted}}>{sub}</div></div>{right}</div>);
   return <div style={{padding:"20px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
     <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{width:34,height:34,borderRadius:9,border:`1px solid ${LINE}`,background:P.white,display:"grid",placeItems:"center",cursor:"pointer",color:P.muted}} title="Volver al panel de consultas" onClick={()=>setConsultaPid(null)}>←</span><div><div style={{display:"flex",alignItems:"center",gap:10}}><h1 style={{fontSize:27,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Consulta</h1>{enc&&(()=>{const m=enc.state==="SIGNED"?["#E6F6EE","#16A66A","Firmada"]:enc.state==="READY_TO_SIGN"?["#FBF0DC","#B7791F","Lista para firmar"]:["#EAF1FD","#1769E0","Abierta"];return <span style={{fontSize:11,fontWeight:700,borderRadius:999,padding:"3px 10px",background:m[0],color:m[1]}}>Encuentro · {m[2]}</span>;})()}</div><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Registro y gestión de la consulta médica</p></div></div>
     {(()=>{
      const st=enc?.state;const label=!patientId?"Selecciona un paciente":!enc?"Abrir encuentro":st==="OPEN"?"Guardar valoración":st==="READY_TO_SIGN"?"Firmar consulta":"✓ Consulta firmada";
      const disabled=busy!==""||!patientId||st==="SIGNED";
      const primaryBg=st==="READY_TO_SIGN"?"linear-gradient(90deg,#16A66A,#12905c)":"linear-gradient(90deg,#6C5CF6,#5B6BF0)";
      return <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
       <button onClick={()=>setCPreview(v=>!v)} style={{display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:cPreview?"#EEEBFD":P.white,color:cPreview?P.purple:P.ink,borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Vista previa</button>
       <button onClick={consultaAdvance} disabled={disabled} style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:disabled?"#C7CCE0":primaryBg,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:disabled?"default":"pointer",fontFamily:UI,boxShadow:disabled?"none":"0 6px 16px #6c5cf640"}}>{busy==="cadv"?"Procesando…":label}</button>
      </div>;
     })()}
    </div>
    {cMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:enc?.state==="SIGNED"?"#F0FBF4":"#EEF6FF",border:`1px solid ${enc?.state==="SIGNED"?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:enc?.state==="SIGNED"?P.green:P.blue,fontWeight:700}}>{enc?.state==="SIGNED"?"✓":"ℹ"}</span><span style={{flex:1}}>{cMsg}{enc?.signatureDigest?<> Firma: <span style={mono}>{enc.signatureDigest.slice(0,24)}…</span></>:null}</span><button onClick={()=>setCMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {cPreview&&<div style={{...card,marginTop:14,padding:18}}><div style={{fontWeight:800,fontSize:15,marginBottom:10}}>Vista previa de la nota clínica</div><pre style={{whiteSpace:"pre-wrap",fontFamily:UI,fontSize:13,color:P.ink,margin:0,lineHeight:1.6}}>{composeNote()}{"\n\nPLAN DE MANEJO: "+(cForm.plan.trim()||"—")}</pre><div style={{fontSize:11.5,color:P.muted,marginTop:10}}>Así se guardará la valoración del encuentro al firmar. Médico: {docDisplay}.</div></div>}
    <div style={{...card2,display:"flex",alignItems:"center",gap:18,padding:"16px 20px",marginTop:16,flexWrap:"wrap"}}>
     <span style={{width:66,height:66,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontWeight:800,fontSize:22,flex:"0 0 auto"}}>{initials}</span>
     <div style={{flex:1,minWidth:180}}><div><span style={{fontSize:21,fontWeight:800}}>{pName}</span><span style={{background:"#E6F6EE",color:"#16A66A",borderRadius:999,padding:"3px 11px",fontSize:12,fontWeight:600,marginLeft:10}}>Paciente activo</span></div><div style={{fontSize:13,color:P.muted,marginTop:3}}>{age} años · {sexoEs}{snap?.demographics.birthDate?` · ${new Date(snap.demographics.birthDate).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"})}`:""}</div><div style={{fontSize:13,color:P.muted}}>{snap?.demographics.curp?<>CURP: <span style={mono}>{snap.demographics.curp}</span></>:<>ID <span style={mono}>{patientId.slice(0,8)}</span></>}</div></div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,flex:"0 0 auto"}}>
      {antp("#FDECEE","#D23651",`Alergias (${alN})`,"M12 4l9 15.5H3zM12 10v4M12 17h.01")}
      {antp("#EEEBFD","#6C5CF6",`Problemas (${prN})`,"M9 4h6v2H9zM7 5H6v16h12V5h-1")}
      {antp("#E7F0FD","#1769E0","Medicamentos","M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z")}
      {antp("#E6F6EE","#16A66A","Vacunas","M14 4l6 6M6 14l4 4M16.5 6.5l-10 10")}
     </div>
     <div style={{borderLeft:`1px solid ${LINE}`,paddingLeft:18,fontSize:12.5,color:P.muted}}>Última consulta<div style={{color:P.ink,marginTop:5}}>{docDisplay}</div><span style={link} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Timeline del paciente"),0);}}>Ver historial →</span></div>
    </div>
    <div style={{display:"flex",gap:4,marginTop:16,borderBottom:`1px solid ${LINE}`,overflowX:"auto"}}>
     {CTABS.map(([k,l])=><button key={k} onClick={()=>setCTab(k)} style={{padding:"12px 16px",fontSize:13.5,fontWeight:cTab===k?700:500,color:cTab===k?P.purple:P.muted,cursor:"pointer",borderBottom:cTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:"0",borderBottomWidth:2,fontFamily:UI,whiteSpace:"nowrap"}}>{l}</button>)}
    </div>
    {cTab!=="actual"?(
     (()=>{
      const cc:React.CSSProperties={...card2,marginTop:16,padding:0,overflow:"hidden"};
      const tth:React.CSSProperties={textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"11px 14px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
      const ttd:React.CSSProperties={padding:"10px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,whiteSpace:"nowrap"};
      const pilr=(bg:string,fg:string,t:string)=><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:bg,color:fg}}>{t}</span>;
      const fmtC=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
      const head=(title:string,n:number,section:string,cta:string)=><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px"}}><div style={{fontSize:16,fontWeight:800}}>{title} ({n})</div><button style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:9,padding:"7px 12px",fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection(section),0);}}>{cta} →</button></div>;
      const empty=(t:string)=><div style={{padding:"40px",textAlign:"center",color:P.muted,fontSize:13}}>{patientId?t:"Selecciona un paciente para ver esta información."}</div>;
      if(cTab==="resultados"){const rows=consTabs?.results??[];const est=(e:string):[string,string]=>e==="Hallazgos"?["#FDE7EA","#D23651"]:e==="En seguimiento"?["#EAF1FD","#1769E0"]:e==="En revisión"?["#FBF0DC","#B7791F"]:["#E6F6EE","#16A66A"];
       return <div style={cc}>{head("Resultados del paciente",rows.length,"Resultados diagnósticos","Abrir en el expediente")}{rows.length?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={tth}>Analito</th><th style={tth}>Valor</th><th style={tth}>Fecha</th><th style={{...tth,textAlign:"right"}}>Estado</th></tr></thead><tbody>{rows.map((r,i)=>{const[bg,fg]=est(r.estado);return <tr key={i}><td style={{...ttd,fontWeight:600}}>{r.analyte}</td><td style={{...ttd,color:r.critical?"#D23651":P.ink,fontWeight:r.critical?700:400}}>{r.value}</td><td style={{...ttd,color:P.muted}}>{fmtC(r.receivedAt)}</td><td style={{...ttd,textAlign:"right"}}>{pilr(bg,fg,r.estado)}</td></tr>;})}</tbody></table></div>:empty("Sin resultados diagnósticos para este paciente.")}</div>;
      }
      if(cTab==="ordenes"){const rows=consTabs?.orders??[];const est=(s:string):[string,string]=>s==="Completada"?["#E6F6EE","#16A66A"]:s==="Enviada"?["#EAF1FD","#1769E0"]:s==="Cancelada"?["#EEF1F7","#6B7191"]:["#FBF0DC","#B7791F"];
       return <div style={cc}>{head("Órdenes del paciente",rows.length,"Órdenes clínicas","Abrir en el expediente")}{rows.length?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={tth}>Estudio</th><th style={tth}>Tipo</th><th style={tth}>Fecha</th><th style={{...tth,textAlign:"right"}}>Estado</th></tr></thead><tbody>{rows.map((r,i)=>{const[bg,fg]=est(r.status);return <tr key={i}><td style={{...ttd,fontWeight:600}}>{r.detail}</td><td style={{...ttd,color:P.muted}}>{r.typeLabel}</td><td style={{...ttd,color:P.muted}}>{fmtC(r.createdAt)}</td><td style={{...ttd,textAlign:"right"}}>{pilr(bg,fg,r.status)}</td></tr>;})}</tbody></table></div>:empty("Sin órdenes de estudio para este paciente.")}</div>;
      }
      if(cTab==="medicamentos"){const rows=consTabs?.medications??[];
       return <div style={cc}>{head("Medicamentos activos",rows.length,"Medicación","Abrir en el expediente")}{rows.length?<div style={{padding:"4px 16px 16px"}}>{rows.map((m,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 0",borderBottom:i<rows.length-1?`1px solid #F2F4F9`:"0"}}><span style={{width:34,height:34,borderRadius:9,background:"#E6F6EE",color:"#16A66A",display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z"/></svg></span><span style={{flex:1,fontSize:13.5,fontWeight:600,textTransform:"capitalize"}}>{m}</span>{pilr("#E6F6EE","#16A66A","Activo")}</div>)}</div>:empty("Sin medicamentos activos para este paciente.")}</div>;
      }
      if(cTab==="plan"){const rows=consTabs?.planGoals??[];const done=(s:string)=>s==="Lograda";
       return <div style={cc}>{head("Metas del plan de cuidado",rows.length,"Plan de cuidados","Abrir en el expediente")}{rows.length?<div style={{padding:"4px 16px 16px"}}>{rows.map((g,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 0",borderBottom:i<rows.length-1?`1px solid #F2F4F9`:"0"}}><span style={{width:18,height:18,borderRadius:"50%",border:done(g.statusLabel)?"0":"1.8px solid #C7CCE0",background:done(g.statusLabel)?"#16A66A":"transparent",color:"#fff",display:"grid",placeItems:"center",fontSize:11,flex:"0 0 auto"}}>{done(g.statusLabel)?"✓":""}</span><span style={{flex:1,fontSize:13.5,color:done(g.statusLabel)?P.muted:P.ink,textDecoration:done(g.statusLabel)?"line-through":"none"}}>{g.goal}</span>{pilr("#EEEBFD",P.purple,g.statusLabel)}</div>)}</div>:empty("Sin metas de plan de cuidado para este paciente.")}</div>;
      }
      if(cTab==="documentos"){const rows=consTabs?.documents??[];
       return <div style={cc}>{head("Documentos del paciente",rows.length,"Documentos clínicos","Abrir en el expediente")}{rows.length?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={tth}>Nombre</th><th style={tth}>Tipo</th><th style={{...tth,textAlign:"right"}}>Fecha</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td style={ttd}><span style={{display:"flex",alignItems:"center",gap:9}}><span style={{color:P.red}}>▤</span>{r.title}</span></td><td style={{...ttd,color:P.muted}}>{r.typeLabel}</td><td style={{...ttd,textAlign:"right",color:P.muted}}>{fmtC(r.createdAt)}</td></tr>)}</tbody></table></div>:empty("Sin documentos para este paciente.")}</div>;
      }
      if(cTab==="seguimiento"){const rows=consTabs?.obligations??[];
       return <div style={cc}>{head("Tareas de seguimiento",rows.length,"Obligaciones de seguimiento","Abrir en el expediente")}{rows.length?<div style={{padding:"4px 16px 16px"}}>{rows.map((o,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 0",borderBottom:i<rows.length-1?`1px solid #F2F4F9`:"0"}}><span style={{width:17,height:17,borderRadius:5,border:o.done?"0":"1.7px solid #C7CCE0",background:o.done?P.purple:"transparent",color:"#fff",display:"grid",placeItems:"center",fontSize:10,flex:"0 0 auto"}}>{o.done?"✓":""}</span><span style={{flex:1,fontSize:13.5,color:o.done?P.muted:P.ink,textDecoration:o.done?"line-through":"none"}}>{o.task}</span><span style={{fontSize:11.5,color:P.muted}}>📅 {fmtC(o.dueAt)}</span></div>)}</div>:empty("Sin tareas de seguimiento para este paciente.")}</div>;
      }
      return <div/>;
     })()
    ):(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-mid">
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={sec}><h3 style={sect}>1. Motivo de consulta</h3><textarea style={ta} disabled={!!enc&&enc.state!=="OPEN"} value={cForm.motivo} onChange={e=>setCForm(f=>({...f,motivo:e.target.value.slice(0,500)}))} placeholder="Motivo de la consulta…"/><div style={cc}>{cForm.motivo.length}/500</div></div>
      <div style={sec}><h3 style={sect}>2. Historia de la enfermedad actual</h3><textarea style={{...ta,minHeight:90}} disabled={!!enc&&enc.state!=="OPEN"} value={cForm.historia} onChange={e=>setCForm(f=>({...f,historia:e.target.value.slice(0,2000)}))} placeholder="Padecimiento actual…"/><div style={cc}>{cForm.historia.length}/2000</div></div>
      {(()=>{const locked=!!enc&&enc.state!=="OPEN";const toggle=(a:string)=>{if(!locked)setCAntec(s=>s.includes(a)?s.filter(x=>x!==a):[...s,a]);};return <div style={sec}><h3 style={sect}>3. Antecedentes relevantes</h3><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>{["HTA","DM2","Asma","Alergias","Quirúrgicos","Tabaquismo","Alcohol","Otros"].map(a=>{const on=cAntec.includes(a);return <label key={a} onClick={()=>toggle(a)} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:locked?"default":"pointer",opacity:locked?.6:1}}><span style={{width:17,height:17,borderRadius:5,border:on?"0":"1.6px solid #C7CCE0",background:on?P.purple:"transparent",display:"grid",placeItems:"center",color:"#fff",fontSize:11,flex:"0 0 auto"}}>{on?"✓":""}</span>{a}</label>;})}</div><textarea style={{...ta,marginTop:12}} disabled={locked} value={cForm.antec} onChange={e=>setCForm(f=>({...f,antec:e.target.value.slice(0,1000)}))} placeholder="Detalle de antecedentes (además de los marcados)…"/><div style={cc}>{cForm.antec.length}/1000</div></div>;})()}
      <div style={sec}><h3 style={sect}>4. Interrogatorio por aparatos y sistemas</h3><textarea style={{...ta,minHeight:80}} disabled={!!enc&&enc.state!=="OPEN"} value={cForm.interrog} onChange={e=>setCForm(f=>({...f,interrog:e.target.value.slice(0,2000)}))} placeholder="Cardiovascular, respiratorio, digestivo, neurológico…"/><div style={cc}>{cForm.interrog.length}/2000</div></div>
      <div style={sec}><h3 style={sect}>5. Exploración física</h3><textarea style={{...ta,minHeight:80}} disabled={!!enc&&enc.state!=="OPEN"} value={cForm.explor} onChange={e=>setCForm(f=>({...f,explor:e.target.value.slice(0,2000)}))} placeholder="Hallazgos de la exploración por regiones…"/><div style={cc}>{cForm.explor.length}/2000</div></div>
      <div style={card2}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px 8px",fontSize:15,fontWeight:700}}>6. Impresión diagnóstica<span style={{fontSize:11.5,fontWeight:600,color:P.muted}}>Se gestiona en «Diagnósticos / Problemas» →</span></div><div style={{padding:"0 18px 18px",display:"flex",gap:10,flexWrap:"wrap"}}>{(snap?.problems??[]).length===0?<span style={{fontSize:12.5,color:P.muted}}>Sin diagnósticos registrados. Añádelos en el panel «Diagnósticos / Problemas».</span>:(snap?.problems??[]).slice(0,6).map(c=><span key={c} style={{display:"inline-flex",alignItems:"center",gap:8,background:"#F3F5FA",border:`1px solid ${LINE}`,borderRadius:9,padding:"6px 11px",fontSize:12.5,fontWeight:600}}>{c} {DX_LABEL(c)}</span>)}</div></div>
     </div>
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={sec}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={sect}>Signos vitales</h3><span style={{fontSize:12,color:P.muted}}>{clock.toLocaleDateString("es-MX",{day:"numeric",month:"short"})} · {clock.toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"})}</span></div>
       <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>{([["TA","ta",V["BP"]??"120/80","mmHg"],["FC","fc",V["HR"]??"72","lpm"],["FR","fr",V["RESP"]??"16","rpm"],["Temp.","temp",V["TEMP"]??"36.5","°C"],["SpO₂","spo2",V["SPO2"]??"98","%"]] as const).map(([l,k,ph,u])=><div key={l}><label style={{fontSize:11.5,color:P.muted,display:"block",marginBottom:5,fontWeight:600}}>{l}</label><input value={cVit[k]} onChange={e=>setCVit(s=>({...s,[k]:e.target.value}))} placeholder={ph} style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 6px",fontSize:15,fontWeight:700,textAlign:"center",fontFamily:UI,boxSizing:"border-box",color:P.ink}}/><div style={{fontSize:10.5,color:"#9AA0BC",textAlign:"center",marginTop:3}}>{u}</div></div>)}</div>
       <div style={{display:"flex",alignItems:"center",gap:10,marginTop:12,flexWrap:"wrap"}}><button onClick={()=>void saveConsultaVitals()} disabled={cVitBusy} style={{border:0,background:cVitBusy?"#C7CCE0":P.purple,color:"#fff",borderRadius:9,padding:"9px 16px",fontWeight:700,fontSize:13,cursor:cVitBusy?"default":"pointer",fontFamily:UI}}>{cVitBusy?"Guardando…":"Guardar signos vitales"}</button><span style={link} onClick={()=>{if(patientId){setView("signos");}}}>Ver historial →</span></div>
       {cVitMsg&&<div style={{marginTop:10,fontSize:12.5,color:cVitMsg.includes("⚠")?"#B3261E":cVitMsg.includes("✓")?"#1A7F43":P.muted,fontWeight:600}}>{cVitMsg}</div>}
      </div>
      <div style={sec}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={sect}>Diagnósticos / Problemas</h3><span style={link} onClick={()=>setView("problemas")}>Ver historial →</span></div>
       <div style={{position:"relative"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 12px"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input value={cDxQuery} onChange={e=>{setCDxQuery(e.target.value);setCDxMsg(null);}} placeholder="Buscar CIE-10 o descripción…" style={{border:0,outline:"none",fontSize:13,fontFamily:UI,color:P.ink,width:"100%",background:"transparent"}}/></div>
        {cDxQuery.trim().length>=2&&(()=>{const res=searchIcd10(cDxQuery.trim(),6);return <div style={{position:"absolute",left:0,right:0,top:"calc(100% + 4px)",background:P.white,border:`1px solid ${LINE}`,borderRadius:10,boxShadow:"0 8px 24px #1a1d2914",zIndex:20,overflow:"hidden"}}>{res.length?res.map(e=><div key={e.code} onClick={()=>void addConsultaProblem(e.code)} style={{display:"flex",gap:8,padding:"9px 12px",fontSize:12.5,cursor:cDxBusy?"default":"pointer",borderBottom:`1px solid #F4F6FB`,alignItems:"baseline"}}><b style={{color:P.purple,flex:"0 0 auto"}}>{e.code}</b><span style={{color:P.ink}}>{e.description}</span></div>):<div style={{padding:"10px 12px",fontSize:12.5,color:P.muted}}>Sin coincidencias en el catálogo CIE-10.</div>}</div>;})()}
       </div>
       {cDxMsg&&<div style={{marginTop:10,fontSize:12.5,color:cDxMsg.includes("✓")?"#1A7F43":P.muted,fontWeight:600}}>{cDxMsg}</div>}
       <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>{(snap?.problems??["J02.9","B34.9"]).slice(0,4).map((c,i)=><span key={c} style={{display:"inline-flex",alignItems:"center",gap:8,background:"#F3F5FA",border:`1px solid ${LINE}`,borderRadius:9,padding:"6px 11px",fontSize:12.5,fontWeight:600}}>{c} {DX_LABEL(c)}{i===0&&<span style={{background:"#EEEBFD",color:"#6C5CF6",borderRadius:6,padding:"1px 7px",fontSize:10.5,fontWeight:700}}>Principal</span>}</span>)}{(snap?.problems??[]).length===0&&<span style={{fontSize:12.5,color:P.muted}}>Sin problemas activos. Busca un CIE-10 para agregar.</span>}</div>
      </div>
      {(()=>{
       const CORD:[typeof cOrdCat,string,string[]][]=[["LAB","Laboratorio",["Biometría hemática completa","Química sanguínea (6 elementos)","Perfil lipídico","Examen general de orina","Proteína C reactiva","Exudado faríngeo (cultivo)"]],["IMAGING","Imagen",["Radiografía de tórax PA","Ultrasonido abdominal","Tomografía simple de cráneo","Mastografía"]],["PROCEDURE","Procedimiento",["Electrocardiograma","Espirometría","Prueba de esfuerzo"]],["REFERRAL","Interconsulta",["Cardiología","Endocrinología","Nefrología","Oftalmología"]]];
       const studies=CORD.find(c=>c[0]===cOrdCat)?.[2]??[];
       const toggle=(o:string)=>setCOrdSel(s=>s.includes(o)?s.filter(x=>x!==o):[...s,o]);
       return <div style={sec}><h3 style={sect}>Órdenes clínicas</h3>
        <div style={{display:"flex",gap:16,borderBottom:`1px solid ${LINE}`,fontSize:13}}>{CORD.map(([k,l])=><span key={k} onClick={()=>{setCOrdCat(k);setCOrdSel([]);setCOrdMsg(null);}} style={{paddingBottom:8,color:cOrdCat===k?P.purple:P.muted,fontWeight:cOrdCat===k?700:400,borderBottom:cOrdCat===k?`2px solid ${P.purple}`:"0",cursor:"pointer"}}>{l}</span>)}</div>
        <div style={{marginTop:12}}>{studies.map(o=>{const on=cOrdSel.includes(o);return <label key={o} onClick={()=>toggle(o)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 0",fontSize:13.5,cursor:"pointer"}}><span style={{width:17,height:17,borderRadius:5,border:on?"0":"1.6px solid #C7CCE0",background:on?P.purple:"transparent",display:"grid",placeItems:"center",color:"#fff",fontSize:11,flex:"0 0 auto"}}>{on?"✓":""}</span>{o}</label>;})}</div>
        <div style={{display:"flex",gap:10,alignItems:"center",marginTop:8,flexWrap:"wrap"}}><button onClick={()=>void createConsultaOrders()} disabled={cOrdBusy||cOrdSel.length===0} style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:(cOrdBusy||cOrdSel.length===0)?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"9px 16px",fontWeight:700,fontSize:13,cursor:(cOrdBusy||cOrdSel.length===0)?"default":"pointer",fontFamily:UI}}>{cOrdBusy?"Creando…":`Crear ${cOrdSel.length||""} orden${cOrdSel.length===1?"":"es"}`.replace("  "," ")}</button><span style={link} onClick={()=>setView("ordenes")}>Abrir en Órdenes →</span></div>
        {cOrdMsg&&<div style={{marginTop:10,fontSize:12.5,color:cOrdMsg.includes("✓")?"#1A7F43":P.muted,fontWeight:600}}>{cOrdMsg}</div>}
       </div>;
      })()}
      <div style={sec}><h3 style={sect}>Plan de manejo</h3><textarea style={{...ta,minHeight:110}} disabled={!!enc&&enc.state!=="OPEN"} value={cForm.plan} onChange={e=>setCForm(f=>({...f,plan:e.target.value}))} placeholder="Plan de manejo…"/></div>
     </div>
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={sec}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={sect}>Resumen clínico</h3><span style={{fontSize:11.5,color:P.muted}}>Derivado del expediente</span></div>
       {rsum("#FDECEE","#D23651","M12 4l9 15.5H3zM12 10v4M12 17h.01","Alergias",snap?.allergies.length?snap.allergies.join(", "):"Sin alergias conocidas",<span style={{background:"#FDE7EA",color:"#D23651",borderRadius:999,padding:"2px 9px",fontSize:10.5,fontWeight:700}}>{snap?.allergies.length?"Alta":"—"}</span>)}
       {rsum("#EEEBFD","#6C5CF6","M9 4h6v2H9zM7 5H6v16h12V5h-1",`Problemas activos`,snap?.problems.length?snap.problems.map(DX_LABEL).slice(0,3).join(", "):"Sin problemas activos",sgo("Abrir →","Lista de problemas"))}
       {rsum("#E7F0FD","#1769E0","M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z","Medicamentos actuales","Revisar en el expediente",sgo("Abrir →","Medicación"))}
       {rsum("#E6F6EE","#16A66A","M14 4l6 6M6 14l4 4M16.5 6.5l-10 10","Vacunas","Revisar cartilla en el expediente",sgo("Abrir →","Vacunas"))}
      </div>
      <div style={{...sec,background:"linear-gradient(180deg,#FBFAFF,#fff)"}}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={{...sect,color:P.purple,display:"flex",alignItems:"center",gap:7}}><NavIcon k="brain"/>Clinical Intelligence (IA)</h3></div><div style={{fontSize:12,fontWeight:600,color:P.muted,marginBottom:8}}>Alertas deterministas para este caso:</div>{findings.length===0?<div style={{fontSize:12.5,lineHeight:1.5,padding:"5px 0",color:P.muted}}>Sin alertas deterministas para los datos registrados. Se recalculan al documentar signos, diagnósticos y medicación.</div>:findings.slice(0,4).map((f,i)=><div key={i} style={{fontSize:12.5,lineHeight:1.5,padding:"5px 0",display:"flex",gap:8}}>• {f.summary}</div>)}<div style={{fontSize:11,color:"#9AA0BC",background:"#F3F2FB",borderRadius:8,padding:"8px 10px",marginTop:8}}>La IA ofrece información de apoyo. La decisión final es del médico. (Determinista · sin IA generativa)</div></div>
      <div style={sec}><h3 style={{...sect,display:"flex",alignItems:"center",gap:8}}>Recordatorios y obligaciones {(gaps?.length??0)>0&&<span style={{background:"#F0455E",color:"#fff",borderRadius:999,padding:"1px 7px",fontSize:11}}>{gaps!.length}</span>}</h3>{(gaps?.length??0)===0?<div style={{fontSize:13,color:P.muted,padding:"9px 0"}}>Sin recordatorios pendientes para este paciente.</div>:gaps!.slice(0,3).map((g,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 0",fontSize:13,borderTop:i?`1px solid #F1F3F9`:"0"}}><div style={{flex:1}}>{g.label}</div><span style={{background:"#FBF0DC",color:"#B7791F",borderRadius:999,padding:"2px 9px",fontSize:10.5,fontWeight:700}}>Pendiente</span></div>)}<div style={{textAlign:"right",marginTop:6}}><span style={link} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Obligaciones de seguimiento"),0);}}>Ver todos →</span></div></div>
     </div>
    </div>)}
   </div>;
  })() : view==="agenda" ? (()=>{
   // ===== VISTA AGENDA — cableado REAL: navegación de fecha (refetch), ciclo de vida de la cita y creación =====
   const meses=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
   const dow=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
   const selDate=new Date(agendaDate+"T12:00:00");
   const dd=selDate.getDate(),mm=selDate.getMonth(),yy=selDate.getFullYear();
   const todayStr=new Date().toISOString().slice(0,10);const isTodaySel=agendaDate===todayStr;
   const fechaLarga=`${dow[selDate.getDay()]!.replace(/^\w/,c=>c.toUpperCase())}, ${dd} de ${meses[mm]} de ${yy}`;
   const firstDow=new Date(yy,mm,1).getDay();const daysInM=new Date(yy,mm+1,0).getDate();
   const nowTop=48+((Math.max(7,Math.min(18,clock.getHours()+clock.getMinutes()/60))-7)*56);
   const horaAhora=clock.toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"}).toLowerCase();
   const setDay=(iso:string)=>{setAgendaDate(iso);setApptSel(null);setApptNew(false);};
   const shiftDay=(delta:number)=>{const d=new Date(agendaDate+"T12:00:00");d.setDate(d.getDate()+delta);setDay(d.toISOString().slice(0,10));};
   const shiftMonth=(delta:number)=>{const d=new Date(agendaDate+"T12:00:00");d.setMonth(d.getMonth()+delta);setDay(d.toISOString().slice(0,10));};
   const pickDay=(day:number)=>{const d=new Date(yy,mm,day,12);setDay(d.toISOString().slice(0,10));};
   type Ap={h:number;t:string;n:string;m:string;c:"blue"|"green"|"purple"|"amber"|"red";id:string};
   const AC:Record<string,{bg:string;bd:string;fg:string}>={blue:{bg:"#EAF1FD",bd:"#1769E0",fg:"#123c73"},green:{bg:"#E7F7EE",bd:"#16A66A",fg:"#0d5c3b"},purple:{bg:"#EFEBFD",bd:"#6C5CF6",fg:"#382a8f"},amber:{bg:"#FBF2DF",bd:"#E5983B",fg:"#8a5a12"},red:{bg:"#FDEBEE",bd:"#F0455E",fg:"#9c1f34"}};
   const ST:Record<string,[string,string,string]>={SCHEDULED:["Programada","#EAF1FD","#1769E0"],CHECKED_IN:["En espera","#FBF0DC","#B7791F"],COMPLETED:["Atendida","#E6F6EE","#16A66A"],CANCELLED:["Cancelada","#F0F1F4","#8A8FA3"],NO_SHOW:["Inasistencia","#FDE7EA","#D23651"]};
   const stLabel=(s:string)=>ST[s]?.[0]??s;
   const TYPE_COLOR:Record<string,"blue"|"green"|"purple"|"amber"|"red">={CONSULTA_GENERAL:"blue",RESULTADOS:"blue",CONTROL:"green",PRIMERA_VEZ:"purple",VACUNACION:"purple",PROCEDIMIENTO:"amber",URGENCIA:"red"};
   const tHM=(iso:string)=>{const d=new Date(iso);const h=d.getUTCHours();const mn=d.getUTCMinutes().toString().padStart(2,"0");const ap=h<12?"a.m.":"p.m.";const h12=h%12||12;return `${h12}:${mn} ${ap}`;};
   const toAp=(a:AgendaAppt):Ap=>({h:new Date(a.startAt).getUTCHours(),t:`${tHM(a.startAt)}${a.endAt?"–"+tHM(a.endAt):""}`,n:a.patientName,m:a.reason,c:TYPE_COLOR[a.apptType??""]??"blue",id:a.appointmentId});
   const realAppts=agenda?.appointments??[];const agLoaded=!!agenda;
   const byCons=(pred:(c:string|null)=>boolean)=>realAppts.filter(a=>pred(a.consultorio)).map(toAp);
   const col1=byCons(c=>!c||/1/.test(c));
   const col2=byCons(c=>!!c&&/2/.test(c));
   const col3=byCons(c=>!!c&&/3/.test(c));
   const hours=[7,8,9,10,11,12,13,14,15,16,17,18];
   const hLabel=(h:number)=>h<12?`${h}:00 a.m.`:h===12?"12:00 p.m.":`${h-12}:00 p.m.`;
   const apAt=(col:Ap[],h:number)=>col.find(a=>a.h===h);
   const card2:React.CSSProperties={...card,marginTop:0};
   const sect:React.CSSProperties={fontSize:15,fontWeight:700};
   const link:React.CSSProperties={color:P.blue,fontSize:13,fontWeight:600,cursor:"pointer"};
   const selAppt=realAppts.find(a=>a.appointmentId===apptSel)??null;
   const openAppt=(a:AgendaAppt)=>openConsulta(a.patientId,a.patientName);
   const slot=(a?:Ap,last?:boolean)=>{return <div style={{borderRight:last?"0":`1px solid ${LINE}`,borderBottom:`1px solid #F2F4F9`,height:56,padding:3}}>{a&&(()=>{const c=AC[a.c]!;const on=!!a.id&&a.id===apptSel;return <div onClick={a.id?()=>setApptSel(a.id):undefined} style={{borderRadius:8,padding:"6px 9px",fontSize:11,height:"100%",overflow:"hidden",borderLeft:`3px solid ${c.bd}`,background:c.bg,color:c.fg,cursor:a.id?"pointer":"default",outline:on?`2px solid ${P.purple}`:"none"}}><div style={{fontSize:10,opacity:.85}}>{a.t}</div><div style={{fontWeight:700,fontSize:11.5}}>{a.n}</div><div style={{opacity:.8}}>{a.m}</div></div>;})()}</div>;};
   const gdot=(c:string)=><span style={{width:8,height:8,borderRadius:"50%",background:c,flex:"0 0 auto"}}/>;
   const rkico=(bg:string,fg:string,d:string)=><span style={{width:38,height:38,borderRadius:10,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"};
   const dk:React.CSSProperties={color:P.muted,width:110,flex:"0 0 auto"};
   const VPILLS:[typeof agendaView|"semana"|"mes",string][]=[["dia","Vista diaria"],["semana","Vista semanal"],["mes","Vista mensual"],["lista","Lista de citas"]];
   return <div style={{padding:"20px 24px 40px",display:"grid",gridTemplateColumns:"1fr 340px",gap:16,alignItems:"start"}} className="mos-ag">
    <div>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div><h1 style={{fontSize:29,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Agenda</h1><p style={{color:P.muted,fontSize:13.5,margin:"5px 0 0"}}>Administra tus citas: navega por fecha, registra llegada, completa o cancela, y agenda nuevas —todo en vivo.</p></div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{void reloadAgenda();setApptMsg("Agenda actualizada.");}}>↻ Actualizar</button><button style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setApptNew(v=>!v);setApptMsg(null);}}>{apptNew?"Cerrar":"+ Nueva cita"}</button></div>
     </div>
     <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>{VPILLS.map(([k,l])=>{const on=agendaView===k;const dis=k==="semana"||k==="mes";return <span key={k} onClick={dis?undefined:()=>setAgendaView(k as typeof agendaView)} title={dis?"Próximamente":undefined} style={{border:`1px solid ${on?P.purple:LINE}`,background:on?P.purple:P.white,color:on?"#fff":dis?"#C7CCE0":P.muted,borderRadius:10,padding:"9px 15px",fontSize:13.5,fontWeight:600,cursor:dis?"not-allowed":"pointer"}}>{l}</span>;})}</div>
     {apptMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:"#EEF6FF",border:"1px solid #CFE0F7",borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:P.blue,fontWeight:700}}>ℹ</span><span style={{flex:1}}>{apptMsg}</span><button onClick={()=>setApptMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
     {apptNew&&<div style={{...card2,marginTop:14,padding:18}}>
      <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>Nueva cita · {fechaLarga}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} className="mos-med2">
       <div><div style={flbl}>Paciente</div><select value={apptForm.patientId} onChange={e=>setApptForm({...apptForm,patientId:e.target.value})} style={selSty}><option value="">Selecciona un paciente…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select>{(patientList??[]).length===0&&<div style={{fontSize:11.5,color:P.muted,marginTop:5}}>No hay pacientes en el tenant. Registra uno en «Pacientes» primero.</div>}</div>
       <div><div style={flbl}>Hora (UTC)</div><input type="time" value={apptForm.time} onChange={e=>setApptForm({...apptForm,time:e.target.value})} style={selSty}/></div>
       <div><div style={flbl}>Consultorio</div><select value={apptForm.consultorio} onChange={e=>setApptForm({...apptForm,consultorio:e.target.value})} style={selSty}><option>Consultorio 1</option><option>Consultorio 2</option><option>Consultorio 3</option></select></div>
       <div><div style={flbl}>Tipo de cita</div><select value={apptForm.apptType} onChange={e=>setApptForm({...apptForm,apptType:e.target.value})} style={selSty}>{[["CONSULTA_GENERAL","Consulta general"],["CONTROL","Control / Seguimiento"],["PRIMERA_VEZ","Primera vez"],["PROCEDIMIENTO","Procedimiento"],["VACUNACION","Vacunación"],["RESULTADOS","Resultados"],["URGENCIA","Urgencia"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <div style={{marginTop:12}}><div style={flbl}>Motivo</div><input value={apptForm.reason} onChange={e=>setApptForm({...apptForm,reason:e.target.value})} placeholder="Ej. Control de diabetes" style={{...selSty,padding:"10px 11px"}}/></div>
      <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void createAppt()} disabled={apptBusy||!apptForm.patientId||!apptForm.reason.trim()} style={{border:0,background:(apptBusy||!apptForm.patientId||!apptForm.reason.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(apptBusy||!apptForm.patientId||!apptForm.reason.trim())?"default":"pointer",fontFamily:UI}}>{apptBusy?"Agendando…":"Agendar cita"}</button><button onClick={()=>setApptNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
     </div>}
     <div style={{...card2,marginTop:14,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:`1px solid ${LINE}`,flexWrap:"wrap"}}>
       <span onClick={()=>shiftDay(-1)} style={{width:30,height:30,border:`1px solid ${LINE}`,borderRadius:8,display:"grid",placeItems:"center",cursor:"pointer",color:P.muted}}>‹</span><span onClick={()=>shiftDay(1)} style={{width:30,height:30,border:`1px solid ${LINE}`,borderRadius:8,display:"grid",placeItems:"center",cursor:"pointer",color:P.muted}}>›</span>
       <b style={{fontSize:15}}>{fechaLarga}</b><span onClick={()=>setDay(todayStr)} style={{border:`1px solid ${isTodaySel?P.purple:LINE}`,color:isTodaySel?P.purple:P.ink,borderRadius:8,padding:"6px 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Hoy</span>
       <span style={{marginLeft:"auto",fontSize:12.5,color:P.muted}}>{agLoaded?`${realAppts.length} cita(s)`:"cargando…"}</span>
      </div>
      {agendaView==="lista"?(
       <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Hora","Paciente","Motivo","Consultorio","Estado"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:"#9AA0BC",fontWeight:600,padding:"11px 14px",borderBottom:`1px solid ${LINE}`}}>{h}</th>)}</tr></thead><tbody>
        {realAppts.length===0?<tr><td colSpan={5} style={{padding:"36px 14px",textAlign:"center",color:P.muted,fontSize:13}}>{agLoaded?"Sin citas para este día. Usa «+ Nueva cita» para agendar.":"Cargando agenda…"}</td></tr>:realAppts.map(a=>{const st=ST[a.status]??["",P.canvas,P.muted];const on=a.appointmentId===apptSel;return <tr key={a.appointmentId} onClick={()=>setApptSel(a.appointmentId)} style={{cursor:"pointer",background:on?"#F6F5FE":"transparent"}}>
         <td style={{padding:"10px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5}}>{tHM(a.startAt)}</td>
         <td style={{padding:"10px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,fontWeight:600}}>{a.patientName}</td>
         <td style={{padding:"10px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5}}>{a.reason}</td>
         <td style={{padding:"10px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,color:P.muted}}>{a.consultorio??"—"}</td>
         <td style={{padding:"10px 14px",borderBottom:`1px solid #F2F4F9`}}><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:st[1],color:st[2]}}>{st[0]}</span></td>
        </tr>;})}
       </tbody></table></div>
      ):(<>
      <div style={{display:"grid",gridTemplateColumns:"70px 1fr 1fr 1fr",position:"relative"}}>
       <div style={{padding:"12px 14px",borderBottom:`1px solid ${LINE}`,borderRight:`1px solid ${LINE}`,fontSize:13,fontWeight:700}}>Hora</div>
       {[["#16A66A","Consultorio 1","Consulta general"],["#1769E0","Consultorio 2","Procedimientos"],["#6C5CF6","Consultorio 3","Control y seguimiento"]].map(([c,t,s],i)=><div key={i} style={{padding:"12px 14px",borderBottom:`1px solid ${LINE}`,borderRight:i<2?`1px solid ${LINE}`:"0",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:7}}>{gdot(c as string)}<div>{t as string}<span style={{fontSize:11,color:P.muted,fontWeight:400,display:"block",marginTop:1}}>{s as string}</span></div></div>)}
       {hours.map((h,ri)=>{const last=ri===hours.length-1;return <Fragment key={h}>
        <div style={{borderRight:`1px solid ${LINE}`,borderBottom:last?"0":`1px solid #F2F4F9`,padding:"6px 8px",fontSize:11.5,color:P.muted,textAlign:"right",height:56}}>{hLabel(h)}</div>
        {slot(apAt(col1,h))}{slot(apAt(col2,h))}{slot(apAt(col3,h),true)}
       </Fragment>;})}
       {isTodaySel&&<div style={{position:"absolute",left:70,right:0,top:nowTop,height:2,background:"#F0455E",zIndex:5}}><span style={{position:"absolute",left:0,top:-9,background:"#F0455E",color:"#fff",fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:5}}>{horaAhora}</span></div>}
      </div>
      <div style={{display:"flex",gap:18,flexWrap:"wrap",padding:"14px 16px",fontSize:12,color:P.muted}}>{[["#1769E0","Consulta general"],["#16A66A","Control / Seguimiento"],["#6C5CF6","Primera vez"],["#E5983B","Procedimiento"],["#8B7DF8","Vacunación"],["#20B7D9","Resultados"],["#F0455E","Urgencia"]].map(([c,l])=><span key={l} style={{display:"flex",alignItems:"center",gap:7}}>{gdot(c as string)}{l as string}</span>)}</div>
      </>)}
     </div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:16}} className="mos-agr">
     <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,fontWeight:700}}><span>{meses[mm]!.replace(/^\w/,c=>c.toUpperCase())} {yy}</span><span style={{color:P.muted,display:"flex",gap:10}}><span onClick={()=>shiftMonth(-1)} style={{cursor:"pointer"}}>‹</span><span onClick={()=>shiftMonth(1)} style={{cursor:"pointer"}}>›</span></span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,textAlign:"center",fontSize:12}}>
       {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d=><span key={d} style={{padding:"7px 0",color:P.muted,fontWeight:600}}>{d}</span>)}
       {Array.from({length:firstDow}).map((_,i)=><span key={"e"+i}/>)}
       {Array.from({length:daysInM}).map((_,i)=>{const day=i+1;const isSel=day===dd;const isToday=new Date(yy,mm,day,12).toISOString().slice(0,10)===todayStr;return <span key={day} onClick={()=>pickDay(day)} style={{padding:"7px 0",borderRadius:7,cursor:"pointer",background:isSel?P.purple:"transparent",color:isSel?"#fff":P.ink,fontWeight:isSel||isToday?700:400,outline:isToday&&!isSel?`1px solid ${P.purple}`:"none"}}>{day}</span>;})}
      </div>
     </div>
     {selAppt&&(()=>{const st=ST[selAppt.status]??["",P.canvas,P.muted];return <div style={{...card2,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}><span style={sect}>Detalle de la cita</span><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:st[1],color:st[2]}}>{st[0]}</span></div>
      <div style={{display:"flex",gap:11,marginTop:12}}><span style={{width:40,height:40,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:13,fontWeight:700,flex:"0 0 auto"}}>{(selAppt.patientName||"P").trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()}</span><div><div style={{fontWeight:800,fontSize:14.5}}>{selAppt.patientName}</div><div style={{fontSize:12,color:P.muted}}>{tHM(selAppt.startAt)}{selAppt.endAt?"–"+tHM(selAppt.endAt):""}</div></div></div>
      <div style={{marginTop:12}}>{[["Motivo",selAppt.reason],["Consultorio",selAppt.consultorio??"—"],["Estado",stLabel(selAppt.status)]].map(([k,v])=><div key={k} style={{display:"flex",fontSize:12.5,padding:"4px 0"}}><span style={dk}>{k}</span><span style={{fontWeight:k==="Estado"?700:400}}>{v}</span></div>)}</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>
       {selAppt.status==="SCHEDULED"&&<button onClick={()=>void apptTransition(selAppt.appointmentId,selAppt.version,"check-in","Llegada registrada.")} disabled={apptBusy} style={{border:0,background:apptBusy?"#C7CCE0":P.blue,color:"#fff",borderRadius:9,padding:10,fontWeight:700,fontSize:13,cursor:apptBusy?"default":"pointer",fontFamily:UI}}>Registrar llegada</button>}
       {selAppt.status==="CHECKED_IN"&&<button onClick={()=>void apptTransition(selAppt.appointmentId,selAppt.version,"completion","Cita completada.")} disabled={apptBusy} style={{border:0,background:apptBusy?"#C7CCE0":P.green,color:"#fff",borderRadius:9,padding:10,fontWeight:700,fontSize:13,cursor:apptBusy?"default":"pointer",fontFamily:UI}}>Marcar atendida ✓</button>}
       <button onClick={()=>openAppt(selAppt)} style={{border:"1px solid #CFE0F7",background:P.white,color:P.blue,borderRadius:9,padding:9,fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>Abrir consulta →</button>
       {(selAppt.status==="SCHEDULED"||selAppt.status==="CHECKED_IN")&&<div style={{display:"flex",gap:8}}><button onClick={()=>void apptTransition(selAppt.appointmentId,selAppt.version,"cancellation","Cita cancelada.")} disabled={apptBusy} style={{flex:1,border:"1px solid #F3C9C9",background:P.white,color:"#D23651",borderRadius:9,padding:9,fontWeight:600,fontSize:12.5,cursor:apptBusy?"default":"pointer",fontFamily:UI}}>Cancelar</button>{selAppt.status==="SCHEDULED"&&<button onClick={()=>void apptTransition(selAppt.appointmentId,selAppt.version,"no-show","Marcada como inasistencia.")} disabled={apptBusy} style={{flex:1,border:`1px solid ${LINE}`,background:P.white,color:P.muted,borderRadius:9,padding:9,fontWeight:600,fontSize:12.5,cursor:apptBusy?"default":"pointer",fontFamily:UI}}>Inasistencia</button>}</div>}
      </div>
     </div>;})()}
     <div style={card2}><div style={{display:"flex",justifyContent:"space-between",padding:"16px 16px 10px"}}><span style={sect}>Resumen del día</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"0 16px 16px"}}>
       {([["#EEEBFD","#6C5CF6","M4 5h16v16H4zM8 3v4M16 3v4",agLoaded?agenda!.counts.programadas:0,"Programadas"],["#E6F6EE","#16A66A","M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z",agLoaded?agenda!.counts.atendidas:0,"Atendidas"],["#FBF0DC","#B7791F","M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0",agLoaded?agenda!.counts.enEspera:0,"En espera"],["#FDECEE","#F0455E","M9 9l6 6M15 9l-6 6M21 12a9 9 0 11-18 0 9 9 0 0118 0",agLoaded?agenda!.counts.canceladas:0,"Canc./Inasist."]] as const).map(([bg,fg,d,v,l])=><div key={l} style={{display:"flex",gap:11,alignItems:"center",padding:12,border:`1px solid ${LINE}`,borderRadius:12}}>{rkico(bg,fg,d)}<div><div style={{fontSize:20,fontWeight:800}}>{v}</div><div style={{fontSize:11,color:P.muted}}>{l}</div></div></div>)}
      </div>
     </div>
     {(()=>{const prox=realAppts.filter(a=>a.status==="SCHEDULED"||a.status==="CHECKED_IN");return <div style={card2}><div style={{display:"flex",justifyContent:"space-between",padding:"16px 16px 6px"}}><span style={sect}>Próximas citas</span>{prox.length>0&&<span style={link} onClick={()=>setAgendaView("lista")}>Ver lista →</span>}</div>
      {prox.slice(0,5).map(a=><div key={a.appointmentId} onClick={()=>setApptSel(a.appointmentId)} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 16px",borderTop:`1px solid #F1F3F9`,cursor:"pointer",background:a.appointmentId===apptSel?"#F6F5FE":"transparent"}}><span style={{fontSize:13,color:P.muted,width:64,flex:"0 0 auto"}}>{tHM(a.startAt)}</span><span style={{width:34,height:34,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,flex:"0 0 auto"}}>{(a.patientName||"P").trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()}</span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13}}>{a.patientName}</div><div style={{fontSize:11.5,color:P.muted}}>{a.reason}</div></div><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",...(a.status==="CHECKED_IN"?{background:"#FBF0DC",color:"#B7791F"}:{background:"#EAF1FD",color:"#1769E0"})}}>{stLabel(a.status)}</span></div>)}
      {prox.length===0&&<div style={{padding:"14px 16px",fontSize:12.5,color:P.muted,borderTop:`1px solid #F1F3F9`}}>{agLoaded?"Sin próximas citas para este día. Agenda una con «+ Nueva cita».":"Cargando agenda…"}</div>}</div>;})()}
    </div>
   </div>;
  })() : view==="resultados" ? (()=>{
   // ===== MÓDULO RESULTADOS — S7 (5 pestañas) =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const link:React.CSSProperties={color:P.blue,fontSize:12.5,fontWeight:600,cursor:"pointer"};
   const RTABS:[typeof resTab,string,string][]=[["resultados","Resultados","M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"],["solicitudes","Solicitudes","M7 3h10v18H7zM10 8h4M10 12h4"],["seguimiento","Panel de seguimiento","M4 5h16v16H4zM8 3v4M16 3v4"],["referencia","Valores de referencia","M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"],["alertas","Alertas","M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6"]];
   const kico=(bg:string,fg:string,d:string)=><span style={{width:40,height:40,borderRadius:11,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:15,display:"flex",gap:12,alignItems:"center"};
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"14px 0 6px"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const rb=(s:string):[string,string]=>s==="Hallazgos"?["#FBEEDF","#B7791F"]:s==="En seguimiento"?["#EAF1FD","#1769E0"]:s==="En revisión"?["#FBF0DC","#B7791F"]:["#E6F6EE","#16A66A"];
   const resLoaded=!!resReg;
   const fmtResD=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const allItems=resReg?.items??[];
   // Navegador de resultados: filtros REALES (búsqueda + tipo + estado) sobre los items del registro
   const filteredItems=allItems.filter(it=>{const q=resQ.trim().toLowerCase();const okQ=!q||it.analyte.toLowerCase().includes(q)||it.patientName.toLowerCase().includes(q);const okT=resTypeF==="Todos"||it.tipo===resTypeF;const okE=resEstadoF==="Todos"||it.estado===resEstadoF;return okQ&&okT&&okE;});
   const selItem=filteredItems.find(it=>it.resultId===resSel)??filteredItems[0]??null;
   const kTot=resReg?.total??0,kAbn=resReg?.abnormal??0,kSeg=resReg?.enSeguimiento??0,kPen=resReg?.pendientes??0;
   const ricoPath:Record<string,string>={flask:"M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3",clip:"M9 4h6v2H9zM7 5H6v16h12V5h-1M8 11h8M8 15h6",img:"M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6"};
   const pill=(bg:string,fg:string,t:string)=><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:bg,color:fg}}>{t}</span>;
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Resultados</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Consulta, analiza y da seguimiento a estudios de laboratorio, imagenología y otros resultados.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 16px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setResNew(v=>!v);setResMsg2(null);}}>{resNew?"Cerrar":"+ Registrar resultado"}</button><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>setView("ordenes")}>Solicitar estudio</button></div>
    </div>
    <div style={{display:"flex",gap:2,marginTop:14,borderBottom:`1px solid ${LINE}`,overflowX:"auto"}}>{RTABS.map(([k,l,d])=><button key={k} onClick={()=>setResTab(k)} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",fontSize:13.5,fontWeight:resTab===k?700:500,color:resTab===k?P.purple:P.muted,cursor:"pointer",borderBottom:resTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,fontFamily:UI,whiteSpace:"nowrap"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={d}/></svg>{l}</button>)}</div>
    {resMsg2&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:resMsg2.includes("CRÍTICO")?"#FDECEE":resMsg2.includes("✓")?"#F0FBF4":"#EEF6FF",border:`1px solid ${resMsg2.includes("CRÍTICO")?"#F3C9C9":resMsg2.includes("✓")?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:resMsg2.includes("CRÍTICO")?P.red:resMsg2.includes("✓")?P.green:P.blue,fontWeight:700}}>{resMsg2.includes("CRÍTICO")?"⚠":resMsg2.includes("✓")?"✓":"ℹ"}</span><span style={{flex:1}}>{resMsg2}</span><button onClick={()=>setResMsg2(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {resNew&&<div style={{...card,marginTop:14,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:4}}>Registrar resultado</div>
     <div style={{fontSize:12.5,color:P.muted,marginBottom:12}}>La interpretación (normal / crítico) la <b style={{color:P.ink}}>deriva el motor CDS</b> del valor; un crítico sin cerrar bloquea la firma.</div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 140px",gap:14}} className="mos-med2">
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Paciente</div><select value={resForm.patientId} onChange={e=>setResForm({...resForm,patientId:e.target.value})} style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink}}><option value="">Selecciona…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select></div>
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Analito</div><select value={resForm.analyte} onChange={e=>setResForm({...resForm,analyte:e.target.value})} style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink}}>{labReferenceRanges().map(a=><option key={a.analyte} value={a.analyte}>{a.analyte}</option>)}</select></div>
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Valor</div><input value={resForm.value} onChange={e=>setResForm({...resForm,value:e.target.value})} placeholder="Ej. 520" style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink}}/></div>
     </div>
     {(()=>{const rng=labReferenceRanges().find(a=>a.analyte===resForm.analyte);return rng?<div style={{fontSize:11.5,color:P.muted,marginTop:8}}>Rango normal {resForm.analyte}: {rng.normalLow}–{rng.normalHigh}{rng.criticalLow!=null||rng.criticalHigh!=null?` · crítico <${rng.criticalLow??"—"} o >${rng.criticalHigh??"—"}`:""}</div>:null;})()}
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void createResult()} disabled={resBusy2||!resForm.patientId||!resForm.value.trim()} style={{border:0,background:(resBusy2||!resForm.patientId||!resForm.value.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(resBusy2||!resForm.patientId||!resForm.value.trim())?"default":"pointer",fontFamily:UI}}>{resBusy2?"Registrando…":"Registrar resultado"}</button><button onClick={()=>setResNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#EEEBFD",P.purple,"M4 4h16v16H4zM8 9h8M8 13h5")}<div><div style={{fontSize:22,fontWeight:800}}>{kTot}</div><div style={{fontSize:11.5,color:P.muted}}>Resultados totales</div></div></div>
     <div style={kcard}>{kico("#FDECEE",P.red,"M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3")}<div><div style={{fontSize:22,fontWeight:800}}>{kAbn}</div><div style={{fontSize:11.5,color:P.muted}}>Con hallazgos anormales</div></div></div>
     <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0")}<div><div style={{fontSize:22,fontWeight:800}}>{kSeg}</div><div style={{fontSize:11.5,color:P.muted}}>En seguimiento</div></div></div>
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M7 3h10v18H7zM10 8h4")}<div><div style={{fontSize:22,fontWeight:800}}>{kPen}</div><div style={{fontSize:11.5,color:P.muted}}>Pendientes de revisión</div></div></div>
    </div>
    {resTab!=="resultados"?(
     (()=>{
      const th2:React.CSSProperties={textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
      const td2:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,whiteSpace:"nowrap"};
      if(resTab==="alertas"){
       const rows=(resReg?.items??[]).filter(i=>i.estado==="Hallazgos"||i.critical);
       return <div style={{...card2,marginTop:16,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:16,fontWeight:800}}>Alertas de resultados ({rows.length})</div><span style={{fontSize:12,color:P.muted}}>Valores críticos y hallazgos anormales (motor CDS determinista)</span></div>{rows.map((a,i)=><div key={a.resultId} style={{display:"flex",gap:11,alignItems:"center",padding:"12px 14px",borderRadius:11,background:"#FDECEE",border:"1px solid #F6C9D0",marginBottom:i<rows.length-1?10:0}}><span style={{color:P.red,flex:"0 0 auto"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:700}}>{a.analyte} = {a.value} <span style={{color:"#9c1f34"}}>· {a.patientName}</span></div><div style={{fontSize:12,color:"#7A2531"}}>{a.interpretation||"Hallazgo anormal"}</div></div><button onClick={()=>{setResTab("resultados");setResSel(a.resultId);setResQ("");setResTypeF("Todos");setResEstadoF("Todos");}} style={{border:`1px solid ${P.red}`,background:P.white,color:P.red,borderRadius:8,padding:"6px 12px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:UI}}>Revisar</button></div>)}{rows.length===0&&<div style={{padding:"40px",textAlign:"center",color:P.muted}}>Sin alertas de resultados. Todos los valores están en rango.</div>}</div>;
      }
      if(resTab==="seguimiento"){
       const rows=(resReg?.items??[]).filter(i=>i.lifecycle==="ACTIONED");
       return <div style={{...card2,marginTop:16,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{fontSize:16,fontWeight:800}}>Panel de seguimiento ({rows.length})</div><span style={{fontSize:12,color:P.muted}}>Zero-Lost-Follow-Up: resultados con acción/obligación abierta</span></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={th2}>Estudio</th><th style={th2}>Valor</th><th style={th2}>Paciente</th><th style={th2}>Interpretación</th><th style={{...th2,textAlign:"right"}}>Estado</th></tr></thead><tbody>{rows.map(r=><tr key={r.resultId}><td style={{...td2,fontWeight:600}}>{r.analyte}</td><td style={td2}>{r.value}</td><td style={td2}>{r.patientName}</td><td style={{...td2,color:P.muted,whiteSpace:"normal"}}>{r.interpretation}</td><td style={{...td2,textAlign:"right"}}>{pill("#EAF1FD","#1769E0","En seguimiento")}</td></tr>)}{rows.length===0&&<tr><td colSpan={5} style={{...td2,textAlign:"center",color:P.muted,padding:"30px"}}>Sin resultados en seguimiento activo.</td></tr>}</tbody></table></div></div>;
      }
      if(resTab==="solicitudes"){
       const rows=(ordReg?.items??[]).slice(0,20).map(o=>({typeLabel:o.typeLabel,detail:o.detail,patientName:o.patientName,status:o.status,createdAt:fmtResD(o.createdAt)}));
       const totO=ordReg?.total??0;
       const est=(s:string):[string,string]=>s==="Completada"?["#E6F6EE","#16A66A"]:s==="Enviada"?["#EAF1FD","#1769E0"]:s==="Cancelada"?["#EEF1F7","#6B7191"]:["#FBF0DC","#B7791F"];
       return <div style={{...card2,marginTop:16,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{fontSize:16,fontWeight:800}}>Solicitudes de estudio ({totO})</div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"7px 12px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Órdenes clínicas"),0);}}>+ Nueva solicitud</button></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={th2}>Estudio</th><th style={th2}>Tipo</th><th style={th2}>Paciente</th><th style={th2}>Fecha</th><th style={{...th2,textAlign:"right"}}>Estado</th></tr></thead><tbody>{rows.map((r,i)=>{const[bg,fg]=est(r.status);return <tr key={i}><td style={{...td2,fontWeight:600}}>{r.detail}</td><td style={{...td2,color:P.muted}}>{r.typeLabel}</td><td style={td2}>{r.patientName}</td><td style={{...td2,color:P.muted}}>{r.createdAt}</td><td style={{...td2,textAlign:"right"}}>{pill(bg,fg,r.status)}</td></tr>;})}{rows.length===0&&<tr><td colSpan={5} style={{...td2,textAlign:"center",color:P.muted,padding:"30px"}}>Sin solicitudes de estudio.</td></tr>}</tbody></table></div></div>;
      }
      if(resTab==="referencia"){
       const ranges=labReferenceRanges();
       return <div style={{...card2,marginTop:16,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{fontSize:16,fontWeight:800}}>Valores de referencia ({ranges.length} analitos)</div><span style={{fontSize:12,color:P.muted}}>Rangos del motor CDS · normal y límites de pánico (adulto)</span></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={th2}>Analito</th><th style={th2}>Rango normal</th><th style={th2}>Crítico bajo</th><th style={th2}>Crítico alto</th></tr></thead><tbody>{ranges.map((r,i)=><tr key={i}><td style={{...td2,fontWeight:700,color:P.purple}}>{r.analyte}</td><td style={td2}>{r.normalLow} – {r.normalHigh}</td><td style={{...td2,color:r.criticalLow>0?P.red:P.muted}}>{r.criticalLow>0?`< ${r.criticalLow}`:"—"}</td><td style={{...td2,color:r.criticalHigh<99?P.red:P.muted}}>{r.criticalHigh<99?`> ${r.criticalHigh}`:"—"}</td></tr>)}</tbody></table></div></div>;
      }
      return <div/>;
     })()
    ):(
    <div style={{display:"grid",gridTemplateColumns:"250px 1fr 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-res3">
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:15,fontWeight:700}}>Filtros</span><span style={link} onClick={()=>{setResQ("");setResTypeF("Todos");setResEstadoF("Todos");}}>Limpiar</span></div>
      <div style={{display:"flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,borderRadius:9,padding:"8px 11px",margin:"12px 0"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input value={resQ} onChange={e=>setResQ(e.target.value)} placeholder="Buscar por estudio o paciente…" style={{border:0,outline:"none",fontSize:12.5,width:"100%",fontFamily:UI,background:"transparent",color:P.ink}}/></div>
      <div style={flbl}>Tipo de estudio</div><select value={resTypeF} onChange={e=>setResTypeF(e.target.value)} style={selSty}><option>Todos</option><option>Laboratorio</option><option>Imagenología</option></select>
      <div style={flbl}>Estado</div><select value={resEstadoF} onChange={e=>setResEstadoF(e.target.value)} style={selSty}><option>Todos</option><option>Hallazgos</option><option>Normal</option><option>En seguimiento</option><option>En revisión</option></select>
      <div style={{marginTop:14,fontSize:12,color:P.muted}}>{filteredItems.length} de {allItems.length} resultado(s)</div>
     </div>
     <div style={{...card2,padding:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px"}}><span style={{fontSize:16,fontWeight:700}}>Resultados ({filteredItems.length})</span></div>
      {filteredItems.map(it=>{const[bg,fg]=rb(it.estado);const on=selItem?.resultId===it.resultId;const ico=it.tipo==="Imagenología"?"img":"flask";return <div key={it.resultId} onClick={()=>setResSel(it.resultId)} style={{display:"flex",alignItems:"center",gap:11,padding:11,borderRadius:11,cursor:"pointer",border:on?"1px solid #E0DAFB":"1px solid transparent",background:on?"#F6F5FE":"transparent"}}><span style={{width:36,height:36,borderRadius:9,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={ricoPath[ico]??ricoPath.flask}/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13.5}}>{it.analyte}</div><div style={{fontSize:11.5,color:P.muted}}>{it.patientName} · {fmtResD(it.receivedAt)}</div></div>{pill(bg,fg,it.estado)}</div>;})}
      {filteredItems.length===0&&<div style={{padding:"30px 10px",textAlign:"center",color:P.muted,fontSize:13}}>{resLoaded?(allItems.length===0?"Sin resultados registrados. Usa «+ Registrar resultado».":"Ningún resultado coincide con los filtros."):"Cargando resultados…"}</div>}
      {filteredItems.length>0&&<div style={{padding:"12px 10px",fontSize:12.5,color:P.muted}}>Mostrando {filteredItems.length} de {allItems.length} resultado(s)</div>}
     </div>
     <div style={{...card2,padding:18}} className="mos-detail">
      {selItem?(()=>{const[bg,fg]=rb(selItem.estado);const rng=labReferenceRanges().find(a=>a.analyte===selItem.analyte);const vColor=selItem.critical?P.red:selItem.estado==="Normal"?"#16A66A":P.amber;const critical=selItem.critical;return <>
      <div style={{display:"flex",gap:11}}><span style={{width:44,height:44,borderRadius:11,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={ricoPath[selItem.tipo==="Imagenología"?"img":"flask"]??ricoPath.flask}/></svg></span><div style={{minWidth:0}}><div style={{fontSize:16,fontWeight:800,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{selItem.analyte} {pill(bg,fg,selItem.estado)}</div><div style={{fontWeight:700,fontSize:14}}>{selItem.patientName}</div><div style={{fontSize:12.5,color:P.muted}}>{selItem.tipo} · {fmtResD(selItem.receivedAt)}</div></div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,margin:"14px 0 4px"}}>
       <div style={{border:`1px solid ${LINE}`,borderRadius:10,padding:10}}><div style={{fontSize:18,fontWeight:800,color:vColor}}>{selItem.value}</div><div style={{fontSize:10.5,color:P.muted}}>Valor</div></div>
       <div style={{border:`1px solid ${LINE}`,borderRadius:10,padding:10}}><div style={{fontSize:14,fontWeight:800}}>{rng?`${rng.normalLow} – ${rng.normalHigh}`:"—"}</div><div style={{fontSize:10.5,color:P.muted}}>Rango normal</div></div>
       <div style={{border:`1px solid ${LINE}`,borderRadius:10,padding:10}}><div style={{fontSize:14,fontWeight:800,color:critical?P.red:P.ink}}>{critical?"Crítico":selItem.estado==="Normal"?"En rango":"Anormal"}</div><div style={{fontSize:10.5,color:P.muted}}>Clasificación CDS</div></div>
      </div>
      {rng&&(rng.criticalLow>0||rng.criticalHigh<99)&&<div style={{fontSize:11.5,color:P.muted,marginBottom:6}}>Límites de pánico: {rng.criticalLow>0?`< ${rng.criticalLow}`:"—"} / {rng.criticalHigh<99?`> ${rng.criticalHigh}`:"—"}</div>}
      <div style={{fontSize:14,fontWeight:700,margin:"12px 0 6px"}}>Interpretación</div>
      <div style={{background:critical?"#FDECEE":"#F3F7FF",border:`1px solid ${critical?"#F6CDD3":"#D3E2F7"}`,borderRadius:11,padding:"11px 13px",fontSize:12.5,display:"flex",gap:8,color:critical?"#9c1f34":"#1c3c66"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg><span>{selItem.interpretation||"Sin interpretación registrada."} <span style={{opacity:.7}}>(Interpretación determinista · sin IA generativa)</span></span></div>
      <div style={{fontSize:14,fontWeight:700,margin:"14px 0 6px"}}>Ciclo de vida</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{["RECEIVED","VERIFIED","ACTIONED","CLOSED"].map(ls=>{const active=selItem.lifecycle===ls;const LBL:Record<string,string>={RECEIVED:"Recibido",VERIFIED:"Verificado",ACTIONED:"Accionado",CLOSED:"Cerrado"};return <span key={ls} style={{fontSize:11,fontWeight:700,borderRadius:999,padding:"3px 10px",background:active?P.purple:"#F0F1F6",color:active?"#fff":P.muted}}>{LBL[ls]}</span>;})}</div>
      <button onClick={()=>{setResTab("seguimiento");}} style={{marginTop:16,width:"100%",border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver panel de seguimiento →</button>
      </>;})():<div style={{padding:"48px 20px",textAlign:"center",color:P.muted}}><div style={{fontSize:14,fontWeight:600,marginBottom:6}}>Sin resultado seleccionado</div><div style={{fontSize:12.5}}>{allItems.length===0?"Registra un resultado con «+ Registrar resultado».":"Elige un resultado de la lista para ver su detalle."}</div></div>}
     </div>
    </div>)}
   </div>;
  })() : view==="medicamentos" ? (()=>{
   // ===== MÓDULO MEDICAMENTOS — S8 (6 pestañas), pestaña "Catálogo" =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const MTABS:[typeof medTab,string,string][]=[["catalogo","Catálogo","M4 7h16M4 12h16M4 17h10"],["plantillas","Plantillas","M7 3h10v18H7z"],["rapidas","Prescripciones rápidas","M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z"],["interacciones","Interacciones","M8 8a4 4 0 118 0M8 16a4 4 0 108 0M12 8v8"],["alertas","Alertas","M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6"],["reportes","Reportes","M4 19V5M4 19h16M8 15l3-4 3 2 4-6"]];
   const kico=(bg:string,fg:string,d:string)=><span style={{width:40,height:40,borderRadius:11,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:15,display:"flex",gap:12,alignItems:"center"};
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"14px 0 6px"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   // ===== Catálogo REAL determinista (packages/drug-catalog) — principio activo + clases + categoría + reglas =====
   const cat=drugCatalog();
   const categories=[...new Set(cat.map(d=>d.category))].sort((a,b)=>a.localeCompare(b,"es"));
   const ixRules=interactionRules();
   const catColor=(c:string):[string,string]=>c.startsWith("Antibiótico")?["#E6F6EE","#16A66A"]:c.startsWith("AINE")||c.startsWith("Salicilato")?["#E7EEFB","#1769E0"]:c.startsWith("Analgésico")?["#EEEBFD","#6C5CF6"]:c.startsWith("Antidiabético")?["#FBF0DC","#B7791F"]:c.includes("antihipertensivo")?["#FDECEE","#F0455E"]:c.startsWith("Antidepresivo")||c.startsWith("Serotoninérgico")?["#F3EAFB","#9333EA"]:c.startsWith("Anticoagulante")?["#FCE9E4","#C2410C"]:c.startsWith("Diurético")?["#E0F7FA","#0E7490"]:c.startsWith("Opioide")?["#F1F1F4","#8A8FA3"]:["#EEF0F5","#6B7391"];
   const mq=medQuery.trim().toLowerCase();
   const catFiltered=cat.filter(d=>(!mq||d.ingredient.includes(mq)||d.category.toLowerCase().includes(mq)||d.classes.some(cl=>cl.toLowerCase().includes(mq)))&&(!medCat||d.category===medCat)&&(!medOnlyMon||d.monitoring.length>0)&&(!medOnlyRenal||!!d.renal));
   const selDrug:DrugCatalogItem|null=cat.find(d=>d.code===medSel)??null;
   const kClases=categories.length,kMon=cat.filter(d=>d.monitoring.length>0).length,kRenal=cat.filter(d=>d.renal).length;
   // Interconexión real: llevar el principio activo al formulario de prescripción del expediente (con barreras de seguridad).
   const prescribe=(ingredient:string)=>{setRxDrug(ingredient);setView("exp");setTimeout(()=>scrollToSection("Medicación"),0);};
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"12px 14px",borderBottom:`1px solid ${LINE}`};
   const td:React.CSSProperties={padding:"11px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:13,verticalAlign:"top"};
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7zM7 8l6 6"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Medicamentos</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Catálogo de principios activos con sus reglas de seguridad (monitoreo, ajuste renal, interacciones). Prescribe desde aquí con verificación en el expediente.</p></div></div>
     <button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Medicación"),0);}}>+ Prescribir en el expediente →</button>
    </div>
    <div style={{display:"flex",gap:2,marginTop:14,borderBottom:`1px solid ${LINE}`,overflowX:"auto"}}>{MTABS.map(([k,l,d])=><button key={k} onClick={()=>setMedTab(k)} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",fontSize:13.5,fontWeight:medTab===k?700:500,color:medTab===k?P.purple:P.muted,cursor:"pointer",borderBottom:medTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,fontFamily:UI,whiteSpace:"nowrap"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={d}/></svg>{l}</button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#EEEBFD",P.purple,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z")}<div><div style={{fontSize:22,fontWeight:800}}>{cat.length}</div><div style={{fontSize:11.5,color:P.muted}}>Principios activos</div></div></div>
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M4 7h16M4 12h16M4 17h10")}<div><div style={{fontSize:22,fontWeight:800}}>{kClases}</div><div style={{fontSize:11.5,color:P.muted}}>Clases terapéuticas</div></div></div>
     <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0")}<div><div style={{fontSize:22,fontWeight:800}}>{kMon}</div><div style={{fontSize:11.5,color:P.muted}}>Con monitoreo obligado</div></div></div>
     <div style={kcard}>{kico("#FDECEE",P.red,"M12 4l9 15.5H3zM12 10v4M12 17h.01")}<div><div style={{fontSize:22,fontWeight:800}}>{kRenal}</div><div style={{fontSize:11.5,color:P.muted}}>Con alerta renal por TFG</div></div></div>
     <div style={kcard}>{kico("#F3EAFB","#9333EA","M8 8a4 4 0 118 0M8 16a4 4 0 108 0M12 8v8")}<div><div style={{fontSize:22,fontWeight:800}}>{ixRules.length}</div><div style={{fontSize:11.5,color:P.muted}}>Reglas de interacción</div></div></div>
    </div>
    {medTab==="interacciones"?(()=>{
     // ===== Pestaña "Interacciones" (S8.3) — verificador de conjunto REAL cableado a POST /api/v1/interactions =====
     const IX_FACTORS=["Consumo de alcohol","Insuficiencia renal","Insuficiencia hepática","Embarazo","Adulto mayor"];
     const sevSty:Record<IxSev,{bg:string;bd:string;fg:string}>={CONTRAINDICATED:{bg:"#FBE3E6",bd:"#E79AA3",fg:"#9B1C2E"},MAJOR:{bg:"#FDECEE",bd:"#F4B5BE",fg:"#D12C41"},MODERATE:{bg:"#FBF0DC",bd:"#EBD2A0",fg:"#B7791F"},MINOR:{bg:"#E7EEFB",bd:"#C5D6F2",fg:"#1769E0"}};
     const SEV_ORDER:IxSev[]=["CONTRAINDICATED","MAJOR","MODERATE","MINOR"];const SEV_L:Record<IxSev,string>={CONTRAINDICATED:"Contraindicada",MAJOR:"Mayor",MODERATE:"Moderada",MINOR:"Menor"};
     const addDrug=()=>{const v=ixInput.trim();if(!v)return;if(!ixDrugs.some(d=>d.toLowerCase()===v.toLowerCase()))setIxDrugs([...ixDrugs,v]);setIxInput("");setIxRes(null);};
     const rmDrug=(d:string)=>{setIxDrugs(ixDrugs.filter(x=>x!==d));setIxRes(null);};
     const toggleF=(f:string)=>{setIxFactors(ixFactors.includes(f)?ixFactors.filter(x=>x!==f):[...ixFactors,f]);setIxRes(null);};
     const run=async()=>{setIxBusy(true);try{const r=await apiRequest("/api/v1/interactions",{method:"POST",body:{drugs:ixDrugs,factors:ixFactors}});if(r.status===200)setIxRes(r.body as unknown as IxResult);}finally{setIxBusy(false);}};
     const fld:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 8px",textTransform:"uppercase",letterSpacing:".03em"};
     return <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-med2">
      {/* — Columna de entrada — */}
      <div style={{...card2,padding:18,display:"flex",flexDirection:"column",gap:16}}>
       <div>
        <div style={fld}>Medicamentos a evaluar</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
         {ixDrugs.length===0&&<span style={{fontSize:13,color:P.muted}}>Agrega dos o más medicamentos.</span>}
         {ixDrugs.map(d=><span key={d} style={{display:"inline-flex",alignItems:"center",gap:7,background:"#EEEBFD",color:P.purple,borderRadius:8,padding:"6px 10px",fontSize:13,fontWeight:600}}>{d}<button onClick={()=>rmDrug(d)} aria-label={`Quitar ${d}`} style={{border:0,background:"transparent",color:P.purple,cursor:"pointer",fontSize:14,lineHeight:1,padding:0,fontFamily:UI}}>×</button></span>)}
        </div>
        <div style={{display:"flex",gap:8}}>
         <input value={ixInput} onChange={e=>setIxInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addDrug();}} placeholder="Ej. Sertralina, Ibuprofeno…" style={{flex:1,border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,fontFamily:UI,color:P.ink}}/>
         <button onClick={addDrug} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:9,padding:"9px 14px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Agregar</button>
        </div>
       </div>
       <div>
        <div style={fld}>Factores del paciente</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
         {IX_FACTORS.map(f=>{const on=ixFactors.includes(f);return <button key={f} onClick={()=>toggleF(f)} style={{display:"inline-flex",alignItems:"center",gap:6,border:on?`1px solid ${P.purple}`:`1px solid ${LINE}`,background:on?"#EEEBFD":P.white,color:on?P.purple:P.muted,borderRadius:20,padding:"7px 12px",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:UI}}><span style={{width:14,height:14,borderRadius:4,border:on?"0":"1.5px solid #C7CCE0",background:on?P.purple:"transparent",color:"#fff",display:"grid",placeItems:"center",fontSize:9}}>{on?"✓":""}</span>{f}</button>;})}
        </div>
       </div>
       <button onClick={run} disabled={ixBusy||ixDrugs.length<1} style={{border:0,background:ixDrugs.length<1?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"12px 16px",fontWeight:700,fontSize:14,cursor:ixDrugs.length<1?"default":"pointer",fontFamily:UI,opacity:ixBusy?.7:1}}>{ixBusy?"Analizando…":"Verificar interacciones"}</button>
       <div style={{fontSize:11.5,color:P.muted,lineHeight:1.5}}>Motor determinista por clase farmacológica y factores del paciente. Sin IA. La verificación no bloquea la prescripción; es una consulta previa.</div>
      </div>
      {/* — Columna de resultados — */}
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{padding:"14px 18px",borderBottom:`1px solid ${LINE}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{fontWeight:700,fontSize:15}}>Resultado del análisis</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{SEV_ORDER.map(s=><span key={s} style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11.5,color:P.muted}}><span style={{width:10,height:10,borderRadius:3,background:sevSty[s].fg}}/>{SEV_L[s]}{ixRes?` · ${ixRes.counts[s]}`:""}</span>)}</div>
       </div>
       <div style={{padding:18}}>
        {!ixRes&&!ixBusy&&<div style={{padding:"48px 20px",textAlign:"center",color:P.muted}}><div style={{fontSize:32,marginBottom:8}}>🔎</div><div style={{fontSize:14,fontWeight:600,color:P.ink}}>Sin análisis todavía</div><p style={{fontSize:13,maxWidth:360,margin:"6px auto 0"}}>Agrega los medicamentos (y factores del paciente) y pulsa «Verificar interacciones».</p></div>}
        {ixBusy&&<div style={{padding:"48px 20px",textAlign:"center",color:P.muted,fontSize:14}}>Analizando el conjunto…</div>}
        {ixRes&&!ixBusy&&<>
         {ixRes.findings.length===0?(
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 18px",borderRadius:12,background:"#E6F6EE",border:"1px solid #BFE6CF"}}><span style={{width:38,height:38,borderRadius:"50%",background:"#16A66A",color:"#fff",display:"grid",placeItems:"center",flex:"0 0 auto"}}>✓</span><div><div style={{fontWeight:700,fontSize:14}}>Sin interacciones detectadas</div><div style={{fontSize:13,color:P.muted}}>No se encontraron interacciones ni conflictos por factores para este conjunto.</div></div></div>
         ):(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
           {ixRes.highestSeverity&&<div style={{fontSize:13,color:P.muted}}><b style={{color:P.ink}}>{ixRes.findings.length}</b> hallazgo(s) · severidad máxima <b style={{color:sevSty[ixRes.highestSeverity].fg}}>{ixRes.highestSeverityLabel}</b></div>}
           {ixRes.findings.map((f,i)=>{const st=sevSty[f.severity];return <div key={i} style={{border:`1px solid ${st.bd}`,background:st.bg,borderRadius:12,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
             <div style={{fontWeight:700,fontSize:14,color:P.ink}}>{f.a} <span style={{color:st.fg}}>{f.kind==="factor"?"×":"↔"}</span> {f.b}</div>
             <span style={{background:st.fg,color:"#fff",borderRadius:20,padding:"3px 11px",fontSize:11.5,fontWeight:700,whiteSpace:"nowrap"}}>{f.severityLabel}</span>
            </div>
            <div style={{fontSize:12.5,color:"#4B5168",marginTop:8,lineHeight:1.5}}><b style={{color:P.ink}}>Mecanismo.</b> {f.mechanism}</div>
            <div style={{fontSize:12.5,color:"#4B5168",marginTop:5,lineHeight:1.5}}><b style={{color:P.ink}}>Recomendación.</b> {f.recommendation}</div>
           </div>;})}
          </div>
         )}
         {(ixRes.unresolvedDrugs.length>0||ixRes.unresolvedFactors.length>0)&&<div style={{marginTop:14,padding:"11px 14px",borderRadius:10,background:"#FDF4E6",border:"1px solid #F2E1C0",fontSize:12.5,color:"#7A5A16"}}>No reconocidos en el catálogo de demostración (verificación limitada): {[...ixRes.unresolvedDrugs,...ixRes.unresolvedFactors].join(", ")}.</div>}
        </>}
       </div>
      </div>
     </div>;
    })():medTab==="alertas"?(()=>{
     // ===== Pestaña "Alertas" — motor determinista de seguridad (reglas REALES del catálogo), sin IA =====
     const sev=(s:string):[string,string]=>s==="MAJOR"?["#FDECEE","#D12C41"]:["#FBF0DC","#B7791F"];
     const monDrugs=cat.filter(d=>d.monitoring.length>0);
     const renalDrugs=cat.filter(d=>d.renal);
     return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-med2">
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{padding:"14px 16px",borderBottom:`1px solid ${LINE}`,fontWeight:700,fontSize:15}}>Interacciones por clase ({ixRules.length})</div>
       <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Clase A","Clase B","Severidad","Efecto"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
        {ixRules.map((r,i)=>{const[bg,fg]=sev(r.severity);return <tr key={i}><td style={{...td,fontWeight:600}}>{r.classA}</td><td style={{...td,fontWeight:600}}>{r.classB}</td><td style={td}><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:bg,color:fg}}>{r.severity==="MAJOR"?"Mayor (bloquea)":"Moderada"}</span></td><td style={{...td,color:P.muted}}>{r.note}</td></tr>;})}
       </tbody></table></div>
       <div style={{padding:"12px 16px",fontSize:11.5,color:P.muted,borderTop:`1px solid ${LINE}`}}>Estas reglas alimentan las barreras de prescripción del expediente (verificación previa a recetar). Motor determinista por clase farmacológica; sin IA.</div>
      </div>
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{padding:"14px 16px",borderBottom:`1px solid ${LINE}`,fontWeight:700,fontSize:15}}>Vigilancia obligada</div>
       <div style={{padding:"6px 16px 14px"}}>
        <div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"10px 0 6px"}}>Requieren monitoreo ({monDrugs.length})</div>
        {monDrugs.map(d=><div key={d.code} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:`1px solid #F2F4F9`,fontSize:12.5}}><span style={{width:8,height:8,borderRadius:"50%",background:P.amber,flex:"0 0 auto"}}/><b style={{textTransform:"capitalize",minWidth:110}}>{d.ingredient}</b><span style={{color:P.muted}}>{d.monitoring.map(m=>m.test).join(", ")} · c/{d.monitoring[0]!.dueInDays} d</span></div>)}
        <div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"14px 0 6px"}}>Contraindicación / precaución renal por TFG ({renalDrugs.length})</div>
        {renalDrugs.map(d=><div key={d.code} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:`1px solid #F2F4F9`,fontSize:12.5}}><span style={{width:8,height:8,borderRadius:"50%",background:P.red,flex:"0 0 auto"}}/><b style={{textTransform:"capitalize",minWidth:110}}>{d.ingredient}</b><span style={{color:P.muted}}>{d.renal!.blockBelow?`Contraindicada si TFG<${d.renal!.blockBelow}`:""}{d.renal!.cautionBelow?` · precaución <${d.renal!.cautionBelow}`:""}</span></div>)}
       </div>
      </div>
     </div>;
    })():medTab!=="catalogo"?(
     <div style={{...card2,marginTop:16,padding:"48px 20px",textAlign:"center"}}><div style={{fontSize:16,fontWeight:700}}>{MTABS.find(t=>t[0]===medTab)?.[1]}</div><p style={{color:P.muted,fontSize:14,maxWidth:560,margin:"8px auto 0"}}>{medTab==="reportes"?"Los reportes de prescripción requieren un registro de medicamentos por consultorio (agregado por clase/fármaco). El motor de prescripción y sus barreras ya son reales en el expediente; el tablero analítico se conecta cuando exista ese registro clínica-wide.":"Las plantillas y prescripciones rápidas necesitan un almacén de plantillas por médico (aún no implementado). Hoy la prescripción real —con verificación de alergia, duplicidad, interacción, contraindicación y dosis— se hace en el expediente del paciente."}</p><button style={{marginTop:14,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Medicación"),0);}}>Ir a prescribir en el expediente →</button></div>
    ):(
    <div style={{display:"grid",gridTemplateColumns:"250px 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-med2">
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:15,fontWeight:700}}>Filtros</span><span style={{color:P.blue,fontSize:12.5,fontWeight:600,cursor:"pointer"}} onClick={()=>{setMedQuery("");setMedCat("");setMedOnlyMon(false);setMedOnlyRenal(false);}}>Limpiar</span></div>
      <div style={{display:"flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,borderRadius:9,padding:"8px 11px",margin:"12px 0"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input value={medQuery} onChange={e=>setMedQuery(e.target.value)} placeholder="Buscar principio activo o clase…" style={{border:0,outline:"none",fontSize:12.5,fontFamily:UI,color:P.ink,width:"100%",background:"transparent"}}/></div>
      <div style={flbl}>Categoría terapéutica</div><select value={medCat} onChange={e=>setMedCat(e.target.value)} style={selSty}><option value="">Todas</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
      <div style={{...flbl,marginTop:14}}>Seguridad</div>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,padding:"5px 0",cursor:"pointer"}} onClick={()=>setMedOnlyMon(v=>!v)}><span style={{width:16,height:16,borderRadius:4,border:medOnlyMon?"0":"1.6px solid #C7CCE0",background:medOnlyMon?P.purple:"transparent",display:"grid",placeItems:"center",color:"#fff",fontSize:10,flex:"0 0 auto"}}>{medOnlyMon?"✓":""}</span>Solo con monitoreo obligado</label>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,padding:"5px 0",cursor:"pointer"}} onClick={()=>setMedOnlyRenal(v=>!v)}><span style={{width:16,height:16,borderRadius:4,border:medOnlyRenal?"0":"1.6px solid #C7CCE0",background:medOnlyRenal?P.purple:"transparent",display:"grid",placeItems:"center",color:"#fff",fontSize:10,flex:"0 0 auto"}}>{medOnlyRenal?"✓":""}</span>Solo con alerta renal por TFG</label>
      <div style={{marginTop:14,padding:"11px 12px",borderRadius:10,background:"#F7F6FE",fontSize:12,color:P.muted,lineHeight:1.5}}><b style={{color:P.ink}}>Catálogo determinista.</b> Principio activo, clases y reglas de seguridad reales (packages/drug-catalog). Subconjunto de demostración; el vademécum oficial (RxNorm/COFEPRIS) se cargaría de la fuente autorizada.</div>
     </div>
     <div>
      <div style={{...card2,overflow:"hidden"}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 16px 10px"}}><span style={{fontSize:17,fontWeight:700}}>Principios activos ({catFiltered.length})</span></div>
       <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["Principio activo","Clases","Categoría","Seguridad","Acción"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{catFiltered.length===0?(
         <tr><td colSpan={5} style={{...td,textAlign:"center",color:P.muted,padding:"36px 14px"}}>Ningún principio activo coincide con el filtro.</td></tr>
        ):catFiltered.map(d=>{const[bg,fg]=catColor(d.category);const on=medSel===d.code;return <tr key={d.code} style={{cursor:"pointer",background:on?"#F6F5FE":"transparent"}} onClick={()=>setMedSel(on?null:d.code)}>
         <td style={td}><div style={{fontWeight:700,textTransform:"capitalize"}}>{d.ingredient}</div></td>
         <td style={td}><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{d.classes.map(cl=><span key={cl} style={{fontSize:10,fontWeight:600,borderRadius:6,padding:"2px 6px",background:"#EEF0F5",color:P.muted}}>{cl}</span>)}</div></td>
         <td style={td}><span style={{fontSize:11.5,fontWeight:600,borderRadius:999,padding:"3px 11px",background:bg,color:fg}}>{d.category}</span></td>
         <td style={td}><div style={{display:"flex",gap:6}}>{d.monitoring.length>0&&<span title="Requiere monitoreo" style={{fontSize:14}}>🔬</span>}{d.renal&&<span title="Alerta renal por TFG" style={{fontSize:14}}>⚠️</span>}{d.monitoring.length===0&&!d.renal&&<span style={{color:"#C7CCE0"}}>—</span>}</div></td>
         <td style={td}><span style={{color:P.purple,fontWeight:700,fontSize:12,cursor:"pointer"}} onClick={ev=>{ev.stopPropagation();prescribe(d.ingredient);}}>Prescribir →</span></td>
        </tr>;})}</tbody>
       </table></div>
      </div>
      {selDrug&&<div style={{...card2,marginTop:14,padding:16}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontSize:16,fontWeight:800,textTransform:"capitalize"}}>{selDrug.ingredient}</div><div style={{fontSize:12.5,color:P.muted}}>{selDrug.category}</div></div><button style={{border:0,background:P.purple,color:"#fff",borderRadius:9,padding:"8px 14px",fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:UI}} onClick={()=>prescribe(selDrug.ingredient)}>Prescribir →</button></div>
       <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>{selDrug.classes.map(cl=><span key={cl} style={{fontSize:11,fontWeight:600,borderRadius:7,padding:"3px 9px",background:"#EEEBFD",color:P.purple}}>{cl}</span>)}</div>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}} className="mos-med2">
        <div><div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Monitoreo obligado</div>{selDrug.monitoring.length===0?<div style={{fontSize:12.5,color:P.muted}}>Sin regla de monitoreo conocida.</div>:selDrug.monitoring.map((m,i)=><div key={i} style={{fontSize:12.5,padding:"5px 0",borderBottom:i<selDrug.monitoring.length-1?`1px solid #F2F4F9`:"0"}}><b>{m.test}</b> · cada {m.dueInDays} días<div style={{color:P.muted}}>{m.note}</div></div>)}</div>
        <div><div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Función renal (TFG)</div>{!selDrug.renal?<div style={{fontSize:12.5,color:P.muted}}>Sin ajuste renal conocido.</div>:<div style={{fontSize:12.5}}>{selDrug.renal.blockBelow&&<div style={{color:P.red,fontWeight:600}}>Contraindicada si TFG &lt; {selDrug.renal.blockBelow}</div>}{selDrug.renal.cautionBelow&&<div style={{color:P.amber,fontWeight:600}}>Precaución si TFG &lt; {selDrug.renal.cautionBelow}</div>}<div style={{color:P.muted,marginTop:4}}>{selDrug.renal.note}</div></div>}</div>
       </div>
       {(()=>{const rel=ixRules.filter(r=>selDrug.classes.includes(r.classA)||selDrug.classes.includes(r.classB));return rel.length>0&&<div style={{marginTop:14}}><div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Interacciones de sus clases ({rel.length})</div>{rel.map((r,i)=><div key={i} style={{fontSize:12.5,padding:"5px 0",color:"#4B5168"}}><b>{r.classA} ↔ {r.classB}</b> <span style={{color:r.severity==="MAJOR"?P.red:P.amber,fontWeight:700}}>{r.severity==="MAJOR"?"Mayor":"Moderada"}</span> — {r.note}</div>)}</div>;})()}
       <div style={{marginTop:12,fontSize:11.5,color:P.muted}}>La verificación completa (contra las alergias, medicación activa y problemas del paciente) se ejecuta al prescribir en el expediente.</div>
      </div>}
     </div>
    </div>)}
   </div>;
  })() : view==="ordenes" ? (()=>{
   // ===== MÓDULO ÓRDENES — cableado REAL de punta a punta (crear + ciclo de vida + navegación) =====
   // Fuente única: ordersRegistry (GET /api/v1/orders). Acciones: POST create / placement / fulfillment / cancellation.
   // Todo interconectado: seleccionar una orden actualiza el detalle; abrir lleva al expediente del paciente en Consulta.
   const card2:React.CSSProperties={...card,marginTop:0};
   const OTABS:[typeof ordTab,string,string][]=[["todas","Todas las órdenes","M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"],["laboratorio","Laboratorio","M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"],["imagenologia","Imagenología","M3 5h18v14H3zM3 15l5-5 4 4"],["gabinete","Gabinete","M7 3h10v18H7z"],["interconsultas","Interconsultas","M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M16 4.5a3 3 0 010 6M22 20a6 6 0 00-5-5.9"],["procedimientos","Procedimientos","M14 4l6 6M6 14l4 4M16.5 6.5l-10 10"],["otros","Otros","M4 5h16v14H4z"]];
   const kico=(bg:string,fg:string,d:string)=><span style={{width:40,height:40,borderRadius:11,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:15,display:"flex",gap:12,alignItems:"center"};
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const th:React.CSSProperties={textAlign:"left",fontSize:11,color:"#9AA0BC",fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`};
   const td:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,verticalAlign:"top"};
   const dk:React.CSSProperties={color:P.muted,width:130,flex:"0 0 auto"};
   const chip:React.CSSProperties={border:`1px solid ${LINE}`,background:P.white,color:P.ink,borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:UI};
   const initials=(n:string)=>n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const TYPE_ICO:Record<string,string>={LAB:"🧪",IMAGING:"🩻",PROCEDURE:"🫀",REFERRAL:"👥",PATHOLOGY:"🔬"};
   const TYPE_LBL:Record<string,string>={LAB:"Laboratorio",IMAGING:"Imagenología",PROCEDURE:"Procedimiento",REFERRAL:"Interconsulta",PATHOLOGY:"Patología"};
   const SUGG:Record<string,string[]>={LAB:["Biometría hemática completa","Química sanguínea (6 elementos)","Perfil lipídico","HbA1c","Examen general de orina","TSH y T4 libre"],IMAGING:["Radiografía de tórax PA","Ultrasonido abdominal","Tomografía simple de cráneo","Mastografía"],PROCEDURE:["Electrocardiograma","Espirometría","Endoscopia","Prueba de esfuerzo"],REFERRAL:["Cardiología","Endocrinología","Nefrología","Oftalmología"],PATHOLOGY:["Biopsia","Citología cervical","Estudio histopatológico"]};
   const stx=(s:string):[string,string]=>s==="Completada"?["#E6F6EE","#16A66A"]:s==="Enviada"?["#EAF1FD","#1769E0"]:s==="Cancelada"?["#F0F1F4","#8A8FA3"]:["#FBF0DC","#B7791F"];
   const fmtDT=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});};
   const items=ordReg?.items??[];
   const ordLoaded=!!ordReg;
   const KNOWN=["LAB","IMAGING","PROCEDURE","REFERRAL"];
   const TAB_TYPES:Record<string,string[]>={laboratorio:["LAB"],imagenologia:["IMAGING"],gabinete:["PROCEDURE"],interconsultas:["REFERRAL"],procedimientos:["PROCEDURE"]};
   const byTab=ordTab==="todas"?items:ordTab==="otros"?items.filter(o=>!KNOWN.includes(o.orderType)):items.filter(o=>(TAB_TYPES[ordTab]??[]).includes(o.orderType));
   const q=ordQuery.trim().toLowerCase();
   const filtered=byTab.filter(o=>(!q||o.patientName.toLowerCase().includes(q)||o.detail.toLowerCase().includes(q))&&(!ordStatus||o.status===ordStatus));
   const kTot=ordReg?.total??0,kSol=items.filter(o=>o.status==="Solicitada").length,kEnv=items.filter(o=>o.status==="Enviada").length,kCom=items.filter(o=>o.status==="Completada").length,kCan=items.filter(o=>o.status==="Cancelada").length;
   const selected=items.find(o=>o.orderId===ordSel)??items[0]??null;
   const openInRecord=(pid:string,name:string)=>openConsulta(pid,name,"ordenes");
   const donutDefs:[string,string,string][]=[["LAB","Laboratorio","#E5983B"],["IMAGING","Imagenología","#F0455E"],["PROCEDURE","Procedimiento","#20B7D9"],["REFERRAL","Interconsulta","#6C5CF6"],["PATHOLOGY","Patología","#9AA0BC"]];
   const donut=donutDefs.map(([t,l,c])=>({t,l,c,n:items.filter(o=>o.orderType===t).length}));
   const donTot=donut.reduce((a,b)=>a+b.n,0)||1;
   let acc=0;const stops=donut.filter(d=>d.n>0).map(d=>{const from=(acc/donTot*100).toFixed(2);acc+=d.n;const to=(acc/donTot*100).toFixed(2);return `${d.c} ${from}% ${to}%`;}).join(",");
   const donCount=donut.reduce((a,b)=>a+b.n,0);
   const conic=stops?`conic-gradient(${stops})`:"conic-gradient(#EEF0F5 0 100%)";
   const timeline=(s:string):[string,string,boolean][]=>{
    if(s==="Cancelada")return[["Orden creada","Solicitud registrada en el expediente",true],["Orden cancelada","Cancelada por el médico",true]];
    return[["Orden creada","Solicitud registrada en el expediente",true],["Enviada al laboratorio",s==="Enviada"||s==="Completada"?"Estudio en proceso":"Pendiente de envío",s==="Enviada"||s==="Completada"],["Resultado / cumplida",s==="Completada"?"Orden completada":"Se notificará al registrar el resultado",s==="Completada"]];
   };
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M7 3h10v18H7zM10 8h4M10 12h4"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Órdenes</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Solicita, envía y da seguimiento a estudios de laboratorio, imagenología, gabinete e interconsultas. Cada orden se registra en el expediente y avanza por su ciclo de vida.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{void reloadOrders();setOrdMsg("Lista actualizada.");}}>↻ Actualizar</button><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setOrdNew(v=>!v);setOrdMsg(null);}}>{ordNew?"Cerrar":"+ Nueva orden"}</button></div>
    </div>
    <div style={{display:"flex",alignItems:"center",marginTop:14,borderBottom:`1px solid ${LINE}`,gap:2,overflowX:"auto"}}>{OTABS.map(([k,l,d])=><button key={k} onClick={()=>setOrdTab(k)} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 15px",fontSize:13.5,fontWeight:ordTab===k?700:500,color:ordTab===k?P.purple:P.muted,cursor:"pointer",borderBottom:ordTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,fontFamily:UI,whiteSpace:"nowrap"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={d}/></svg>{l}{k!=="todas"&&<span style={{fontSize:10.5,fontWeight:700,background:"#EEF0F5",color:P.muted,borderRadius:999,padding:"1px 7px"}}>{ordTab==="otros"?items.filter(o=>!KNOWN.includes(o.orderType)).length:items.filter(o=>(TAB_TYPES[k]??[]).includes(o.orderType)).length}</span>}</button>)}<span style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:7,paddingRight:4,fontSize:11.5,color:P.muted}}><span style={{width:8,height:8,borderRadius:"50%",background:P.green}}/>Registro en vivo · {kTot} órdenes</span></div>
    {ordMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:"#EEF6FF",border:"1px solid #CFE0F7",borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:P.blue,fontWeight:700}}>ℹ</span><span style={{flex:1}}>{ordMsg}</span><button onClick={()=>setOrdMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {ordNew&&<div style={{...card2,marginTop:16,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>Nueva orden clínica</div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} className="mos-med2">
      <div><div style={flbl}>Paciente</div><select value={ordForm.patientId} onChange={e=>setOrdForm({...ordForm,patientId:e.target.value})} style={selSty}><option value="">Selecciona un paciente…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select>{(patientList??[]).length===0&&<div style={{fontSize:11.5,color:P.muted,marginTop:5}}>No hay pacientes en el tenant. Registra uno en «Pacientes» primero.</div>}</div>
      <div><div style={flbl}>Tipo de estudio</div><select value={ordForm.orderType} onChange={e=>setOrdForm({...ordForm,orderType:e.target.value,detail:""})} style={selSty}>{[["LAB","Laboratorio"],["IMAGING","Imagenología"],["PROCEDURE","Procedimiento / Gabinete"],["REFERRAL","Interconsulta"],["PATHOLOGY","Patología"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
     </div>
     <div style={{marginTop:12}}><div style={flbl}>Estudio / indicación</div><input value={ordForm.detail} onChange={e=>setOrdForm({...ordForm,detail:e.target.value})} placeholder="Escribe o elige una sugerencia" style={{...selSty,padding:"10px 11px"}}/></div>
     <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>{(SUGG[ordForm.orderType]??[]).map(s=><button key={s} onClick={()=>setOrdForm(f=>({...f,detail:s}))} style={ordForm.detail===s?{...chip,borderColor:P.purple,background:"#EEEBFD",color:P.purple}:chip}>{s}</button>)}</div>
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void submitOrder()} disabled={ordBusy||!ordForm.patientId||!ordForm.detail.trim()} style={{border:0,background:(ordBusy||!ordForm.patientId||!ordForm.detail.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(ordBusy||!ordForm.patientId||!ordForm.detail.trim())?"default":"pointer",fontFamily:UI}}>{ordBusy?"Creando…":"Crear orden"}</button><button onClick={()=>setOrdNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#EEEBFD",P.purple,"M7 3h10v18H7z")}<div><div style={{fontSize:22,fontWeight:800}}>{kTot}</div><div style={{fontSize:11.5,color:P.muted}}>Órdenes totales</div></div></div>
     <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0")}<div><div style={{fontSize:22,fontWeight:800}}>{kSol}</div><div style={{fontSize:11.5,color:P.muted}}>Solicitadas</div></div></div>
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M12 15V4m0 0l-4 4m4-4l4 4M4 20h16")}<div><div style={{fontSize:22,fontWeight:800}}>{kEnv}</div><div style={{fontSize:11.5,color:P.muted}}>Enviadas</div></div></div>
     <div style={kcard}>{kico("#E6F6EE",P.green,"M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z")}<div><div style={{fontSize:22,fontWeight:800}}>{kCom}</div><div style={{fontSize:11.5,color:P.muted}}>Completadas</div></div></div>
     <div style={kcard}>{kico("#F0F1F4","#8A8FA3","M6 6l12 12M6 18L18 6")}<div><div style={{fontSize:22,fontWeight:800,color:"#8A8FA3"}}>{kCan}</div><div style={{fontSize:11.5,color:P.muted}}>Canceladas</div></div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"230px 1fr 320px",gap:14,marginTop:16,alignItems:"start"}} className="mos-ord3">
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:15,fontWeight:700}}>Filtros</span><span style={{color:P.blue,fontSize:12.5,fontWeight:600,cursor:"pointer"}} onClick={()=>{setOrdQuery("");setOrdStatus("");setOrdTab("todas");}}>Limpiar</span></div>
      <div style={{display:"flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,borderRadius:9,padding:"8px 11px",margin:"12px 0"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input value={ordQuery} onChange={e=>setOrdQuery(e.target.value)} placeholder="Buscar paciente o estudio…" style={{border:0,outline:"none",fontSize:12.5,fontFamily:UI,color:P.ink,width:"100%",background:"transparent"}}/></div>
      <div style={flbl}>Tipo de orden</div><select value={ordTab} onChange={e=>setOrdTab(e.target.value as typeof ordTab)} style={selSty}><option value="todas">Todos</option><option value="laboratorio">Laboratorio</option><option value="imagenologia">Imagenología</option><option value="gabinete">Gabinete</option><option value="interconsultas">Interconsultas</option><option value="procedimientos">Procedimientos</option><option value="otros">Otros</option></select>
      <div style={{...flbl,marginTop:14}}>Estado</div><select value={ordStatus} onChange={e=>setOrdStatus(e.target.value)} style={selSty}><option value="">Todos</option><option value="Solicitada">Solicitada</option><option value="Enviada">Enviada</option><option value="Completada">Completada</option><option value="Cancelada">Cancelada</option></select>
      <div style={{...flbl,marginTop:14}}>Solicitado por</div><div style={{...selSty,color:P.muted,fontSize:12}}>Yo ({docDisplay})</div>
      <button style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI,marginTop:14}} onClick={()=>{setOrdNew(true);window.scrollTo({top:0,behavior:"smooth"});}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 5v14M5 12h14"/></svg>Nueva orden</button>
     </div>
     <div style={{...card2,padding:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 12px 8px"}}><span style={{fontSize:16,fontWeight:700}}>Órdenes ({filtered.length})</span><span style={{fontSize:12,color:P.muted}}>{ordTab==="todas"?"Todas":OTABS.find(t=>t[0]===ordTab)?.[1]}{ordStatus?` · ${ordStatus}`:""}</span></div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr>{["Fecha","Paciente","Estudio / Orden","Estado","Acciones"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
       <tbody>{items.length===0?(
        <tr><td colSpan={5} style={{...td,textAlign:"center",color:P.muted,padding:"40px 12px"}}>{ordLoaded?"Aún no hay órdenes en el registro. Usa «+ Nueva orden» para crear la primera.":"Cargando órdenes…"}</td></tr>
       ):filtered.length===0?(
        <tr><td colSpan={5} style={{...td,textAlign:"center",color:P.muted,padding:"40px 12px"}}>Ninguna orden coincide con el filtro.</td></tr>
       ):filtered.map(o=>{const[bg,fg]=stx(o.status);const on=(selected?.orderId===o.orderId);return <tr key={o.orderId} style={{background:on?"#F6F5FE":"transparent",cursor:"pointer"}} onClick={()=>setOrdSel(o.orderId)}>
        <td style={td}>{fmtDT(o.createdAt).split(",")[0]}<div style={{color:"#9AA0BC"}}>{(fmtDT(o.createdAt).split(",")[1]??"").trim()}</div></td>
        <td style={td}><div style={{display:"flex",alignItems:"center",gap:9}}><span style={{width:30,height:30,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>{initials(o.patientName)}</span><div style={{fontWeight:600}}>{o.patientName}</div></div></td>
        <td style={td}><div style={{fontWeight:600}}>{o.detail}</div><div style={{color:P.purple,fontSize:11}}>{TYPE_ICO[o.orderType]??"📄"} {o.typeLabel}</div></td>
        <td style={td}><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:bg,color:fg}}>{o.status}</span></td>
        <td style={td}><span style={{color:P.blue,fontWeight:600,fontSize:12,cursor:"pointer"}} onClick={ev=>{ev.stopPropagation();openInRecord(o.patientId,o.patientName);}}>Abrir →</span></td>
       </tr>;})}</tbody>
      </table></div>
     </div>
     <div style={{...card2,padding:16}} className="mos-detail">
      <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Detalle de la orden</div>
      {!selected?(
       <div style={{padding:"40px 8px",textAlign:"center",color:P.muted}}><div style={{fontSize:30,marginBottom:8}}>📋</div><div style={{fontSize:13.5,fontWeight:600,color:P.ink}}>Selecciona una orden</div><p style={{fontSize:12.5,margin:"6px 0 0"}}>Elige una fila de la lista para ver su detalle, seguimiento y acciones.</p></div>
      ):(<>
       <div style={{display:"flex",gap:11,marginTop:2}}><span style={{width:44,height:44,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:14,fontWeight:700,flex:"0 0 auto"}}>{initials(selected.patientName)}</span><div><div style={{fontWeight:800,fontSize:15}}>{selected.patientName}</div><div style={{fontSize:11.5,color:P.muted}}>Expediente: {selected.patientId.slice(0,8).toUpperCase()}</div></div></div>
       <div style={{display:"flex",gap:10,alignItems:"center",marginTop:14}}><span style={{width:36,height:36,borderRadius:9,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}>{TYPE_ICO[selected.orderType]??"📄"}</span><div><div style={{fontWeight:700,fontSize:13.5}}>Estudio</div><div style={{fontSize:12.5}}>{selected.detail}</div></div></div>
       <div style={{marginTop:12}}>{[["Tipo",TYPE_LBL[selected.orderType]??selected.typeLabel],["Fecha de solicitud",fmtDT(selected.createdAt)],["Estado",selected.status],["Solicitado por",docDisplay]].map(([k,v])=><div key={k} style={{display:"flex",fontSize:12.5,padding:"4px 0"}}><span style={dk}>{k}</span><span style={{fontWeight:k==="Estado"?700:400}}>{v}</span></div>)}</div>
       <div style={{display:"flex",flexDirection:"column",gap:8,margin:"14px 0"}}>
        {selected.status==="Solicitada"&&<button onClick={()=>void orderTransition(selected.orderId,selected.version,"placement","Orden enviada al laboratorio.")} disabled={ordBusy} style={{justifyContent:"center",display:"flex",alignItems:"center",gap:6,border:0,background:ordBusy?"#C7CCE0":P.blue,color:"#fff",borderRadius:9,padding:10,fontWeight:700,fontSize:13,cursor:ordBusy?"default":"pointer",fontFamily:UI}}>Enviar al laboratorio →</button>}
        {selected.status==="Enviada"&&<button onClick={()=>void orderTransition(selected.orderId,selected.version,"fulfillment","Orden marcada como completada.")} disabled={ordBusy} style={{justifyContent:"center",display:"flex",alignItems:"center",gap:6,border:0,background:ordBusy?"#C7CCE0":P.green,color:"#fff",borderRadius:9,padding:10,fontWeight:700,fontSize:13,cursor:ordBusy?"default":"pointer",fontFamily:UI}}>Marcar completada ✓</button>}
        <button onClick={()=>openInRecord(selected.patientId,selected.patientName)} style={{justifyContent:"center",display:"flex",alignItems:"center",gap:6,border:"1px solid #CFE0F7",background:P.white,color:P.blue,borderRadius:9,padding:9,fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>Abrir en el expediente →</button>
        {(selected.status==="Solicitada"||selected.status==="Enviada")&&<button onClick={()=>void orderTransition(selected.orderId,selected.version,"cancellation","Orden cancelada.")} disabled={ordBusy} style={{border:"1px solid #F3C9C9",background:P.white,color:"#D23651",borderRadius:9,padding:9,fontWeight:600,fontSize:12.5,cursor:ordBusy?"default":"pointer",fontFamily:UI}}>Cancelar orden</button>}
       </div>
       <div style={{fontSize:13,fontWeight:700,margin:"6px 0 6px"}}>Seguimiento</div>
       <div style={{position:"relative",paddingLeft:20,marginTop:8}}>
        <div style={{position:"absolute",left:5,top:4,bottom:4,width:2,background:"#EDEFF6"}}/>
        {timeline(selected.status).map(([t,s,done],i)=><div key={i} style={{position:"relative",padding:"6px 0",fontSize:12}}><span style={{position:"absolute",left:-19,top:9,width:11,height:11,borderRadius:"50%",background:"#fff",border:`2px solid ${done?(selected.status==="Cancelada"?"#8A8FA3":P.purple):"#C7CCE0"}`}}/><b style={{color:done?P.ink:P.muted}}>{t}</b><br/><span style={{color:P.muted}}>{s}</span></div>)}
       </div>
      </>)}
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"340px 1fr",gap:14,marginTop:16,alignItems:"start"}} className="mos-ord2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Órdenes por tipo</div><div style={{display:"flex",gap:16,alignItems:"center"}}><div style={{width:96,height:96,borderRadius:"50%",flex:"0 0 auto",display:"grid",placeItems:"center",background:conic}}><div style={{width:62,height:62,borderRadius:"50%",background:P.white,display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:16,fontWeight:800}}>{donCount}</div><div style={{fontSize:9,color:P.muted}}>Órdenes</div></div></div></div><div style={{flex:1}}>{donCount===0?<div style={{fontSize:12.5,color:P.muted}}>Sin órdenes registradas. La distribución por tipo aparece al crear órdenes.</div>:donut.filter(d=>d.n>0).map(d=><div key={d.t} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,padding:"3px 0"}}><span style={{width:8,height:8,borderRadius:"50%",background:d.c}}/>{d.l}<b style={{marginLeft:"auto"}}>{d.n} ({Math.round(d.n/donTot*100)}%)</b></div>)}</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:12,alignItems:"flex-start"}}><span style={{width:34,height:34,borderRadius:"50%",background:"#E6F6EE",color:P.green,display:"grid",placeItems:"center",flex:"0 0 auto"}}>✓</span><div><div style={{fontWeight:700,fontSize:14}}>Registro de órdenes en vivo</div><div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Cada orden se persiste como evento clínico y avanza por su ciclo de vida (Solicitada → Enviada → Completada, o Cancelada) con concurrencia optimista y auditoría. La integración con laboratorio externo (envío automático de folios) es representativa en esta versión: el envío se registra como transición interna, no se transmite a un laboratorio real.</div></div></div>
    </div>
   </div>;
  })() : view==="alergias" ? (()=>{
   // ===== MÓDULO ALERGIAS (S-ALERGIAS) — registro clínica-wide cableado a GET /api/v1/allergies =====
   const card2:React.CSSProperties={...card,marginTop:0};
   type ARow={id:string;pid:string;name:string;age:string;substance:string;type:AllergenType;reaction:string;sevKey:"Grave"|"Moderada"|"Leve"|"Incierta";estado:string;active:boolean;severe:boolean;exp:string;date:string;by:string;notes:string};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const SEV_KEY:Record<string,"Grave"|"Moderada"|"Leve">={SEVERE:"Grave",MODERATE:"Moderada",MILD:"Leve"};
   const fmtDate=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"})+", "+d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});};
   const alergLoaded=!!alergReg;
   // Registro clínica-wide REAL (GET /api/v1/allergies); sin datos de ejemplo.
   const allRows:ARow[]=(alergReg?.items??[]).map((it,i)=>({id:it.allergyId||`a${i}`,pid:it.patientId,name:it.patientName,age:"",substance:it.substance,type:it.type,reaction:it.reaction,sevKey:SEV_KEY[it.severity]??"Leve",estado:it.statusLabel,active:it.status==="ACTIVE",severe:it.severity==="SEVERE",exp:it.patientId.slice(0,8).toUpperCase(),date:fmtDate(it.recordedAt),by:it.registeredBy?"Médico tratante":"—",notes:it.reaction}));
   // Filtros (cliente): búsqueda, tipo, solo activas, solo graves
   const rows=allRows.filter(r=>(!alergOnlyActive||r.active)&&(!alergOnlySevere||r.severe)&&(alergType==="Todos"||r.type===alergType)&&(!alergSearch||`${r.name} ${r.substance}`.toLowerCase().includes(alergSearch.toLowerCase())));
   const sel:ARow|null=rows[alergSel]??rows[0]??null;
   // KPIs + gráficas desde datos reales (0 si el registro está vacío).
   const total=alergReg?.total??0;
   const patients=alergReg?.patientsWithAllergies??0;
   const cGrave=alergReg?.bySeverity.grave??0,cMod=alergReg?.bySeverity.moderada??0,cLeve=alergReg?.bySeverity.leve??0,cInc=alergReg?.bySeverity.incierta??0;
   const pct=(n:number)=>total?Math.round(n/total*100):0;
   const T=alergReg?.byType??{Medicamento:0,Alimento:0,Ambiental:0,Contraste:0,Otros:0};
   const typeSegs:[AllergenType,string,number][]=[["Medicamento","#F0455E",T.Medicamento],["Alimento","#6C5CF6",T.Alimento],["Ambiental","#E5983B",T.Ambiental],["Contraste","#20B7D9",T.Contraste],["Otros","#9AA0BC",T.Otros]];
   let acc=0;const stops=typeSegs.map(([,c,n])=>{const a=total?acc/total*100:0;acc+=n;const b=total?acc/total*100:0;return `${c} ${a}% ${b}%`;}).join(",");
   const sevBadge=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={Grave:["#FDECEE","#C9364A"],Moderada:["#FBF0DC","#B7791F"],Leve:["#E6F6EE","#16A66A"],Incierta:["#EEF1F7","#6B7191"]};const[bg,fg]=m[k]??m.Leve!;return{background:bg,color:fg,borderRadius:16,padding:"3px 11px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"};};
   const estadoBadge=(active:boolean):React.CSSProperties=>({background:active?"#E6F6EE":"#EEF1F7",color:active?"#16A66A":"#6B7191",borderRadius:16,padding:"3px 11px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"});
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`};
   const td:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:13,verticalAlign:"middle"};
   const kico=(bg:string,fg:string,d:string)=><span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:16,display:"flex",gap:13,alignItems:"center"};
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"14px 0 6px"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const chk=(on:boolean,l:string,tog:()=>void)=><label key={l} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,padding:"5px 0",cursor:"pointer"}} onClick={tog}><span style={{width:16,height:16,borderRadius:4,border:on?"0":"1.6px solid #C7CCE0",background:on?P.purple:"transparent",display:"grid",placeItems:"center",color:"#fff",fontSize:10,flex:"0 0 auto"}}>{on?"✓":""}</span>{l}</label>;
   const alertBeta=!!sel&&/penicil|amoxi|betalact|cefal|sulfa|aine|ibuprof/i.test(sel.substance);
   return <div style={{padding:"18px 24px 40px"}}>
    {/* Encabezado */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Alergias</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Gestiona y da seguimiento a las alergias de tus pacientes. Mejor seguridad, mejores decisiones.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setAlgNew(v=>!v);setAlgMsg(null);}}>{algNew?"Cerrar":"+ Nueva alergia"}</button>
     </div>
    </div>
    {algMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:algMsg.includes("registrada")?"#F0FBF4":"#EEF6FF",border:`1px solid ${algMsg.includes("registrada")?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:algMsg.includes("registrada")?P.green:P.blue,fontWeight:700}}>{algMsg.includes("registrada")?"✓":"ℹ"}</span><span style={{flex:1}}>{algMsg}</span><button onClick={()=>setAlgMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {algNew&&<div style={{...card2,marginTop:14,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>Nueva alergia</div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}} className="mos-med2">
      <div><div style={flbl}>Paciente</div><select value={algForm.patientId} onChange={e=>setAlgForm({...algForm,patientId:e.target.value})} style={selSty}><option value="">Selecciona…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select></div>
      <div><div style={flbl}>Sustancia</div><input value={algForm.substance} onChange={e=>setAlgForm({...algForm,substance:e.target.value})} placeholder="Ej. Penicilina, Mariscos, Látex" style={selSty}/></div>
      <div><div style={flbl}>Severidad</div><select value={algForm.severity} onChange={e=>setAlgForm({...algForm,severity:e.target.value})} style={selSty}>{[["SEVERE","Grave"],["MODERATE","Moderada"],["MILD","Leve"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
     </div>
     <div style={{marginTop:12}}><div style={flbl}>Reacción</div><input value={algForm.reaction} onChange={e=>setAlgForm({...algForm,reaction:e.target.value})} placeholder="Ej. Urticaria, Anafilaxia, Broncoespasmo" style={selSty}/></div>
     <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>{["Urticaria","Exantema","Broncoespasmo","Anafilaxia","Rinitis","Prurito"].map(rx=><button key={rx} onClick={()=>setAlgForm(f=>({...f,reaction:rx}))} style={algForm.reaction===rx?{border:`1px solid ${P.purple}`,background:"#EEEBFD",color:P.purple,borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:UI}:{border:`1px solid ${LINE}`,background:P.white,color:P.ink,borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:UI}}>{rx}</button>)}</div>
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void createAllergyInline()} disabled={algBusy||!algForm.patientId||!algForm.substance.trim()} style={{border:0,background:(algBusy||!algForm.patientId||!algForm.substance.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(algBusy||!algForm.patientId||!algForm.substance.trim())?"default":"pointer",fontFamily:UI}}>{algBusy?"Registrando…":"Registrar alergia"}</button><button onClick={()=>setAlgNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    {/* KPIs */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z")}<div><div style={{fontSize:24,fontWeight:800}}>{patients}</div><div style={{fontSize:11.5,color:P.muted}}>Pacientes con alergias registradas</div></div></div>
     <div style={kcard}>{kico("#FDECEE",P.red,"M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01")}<div><div style={{fontSize:24,fontWeight:800}}>{cGrave}</div><div style={{fontSize:11.5,color:P.muted}}>Alergias graves ({pct(cGrave)}%)</div></div></div>
     <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 9v4M12 17h.01M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{cMod}</div><div style={{fontSize:11.5,color:P.muted}}>Con reacción moderada ({pct(cMod)}%)</div></div></div>
     <div style={kcard}>{kico("#E6F6EE","#16A66A","M20 6L9 17l-5-5")}<div><div style={{fontSize:24,fontWeight:800}}>{cLeve}</div><div style={{fontSize:11.5,color:P.muted}}>Con reacción leve ({pct(cLeve)}%)</div></div></div>
     <div style={kcard}>{kico("#EEF1F7","#6B7191","M9.1 9a3 3 0 115.8 1c0 2-3 2-3 4M12 17h.01M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{cInc}</div><div style={{fontSize:11.5,color:P.muted}}>Alergias inciertas ({pct(cInc)}%)</div></div></div>
    </div>
    {/* Tres columnas: filtros · tabla · detalle */}
    <div style={{display:"grid",gridTemplateColumns:"240px 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-alerg">
     {/* Filtros */}
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:15,fontWeight:700}}>Filtros</div><button onClick={()=>{setAlergSearch("");setAlergType("Todos");setAlergOnlySevere(false);setAlergOnlyActive(false);}} style={{border:0,background:"transparent",color:P.blue,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:UI}}>Limpiar</button></div>
      <div style={{position:"relative",marginTop:10}}><input value={alergSearch} onChange={e=>{setAlergSearch(e.target.value);setAlergSel(0);}} placeholder="Buscar paciente o alérgeno..." style={{...selSty,padding:"9px 11px 9px 32px"}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" style={{position:"absolute",left:10,top:11}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div>
      <div style={flbl}>Tipo de alérgeno</div>
      <select value={alergType} onChange={e=>{setAlergType(e.target.value);setAlergSel(0);}} style={selSty}>{["Todos","Medicamento","Alimento","Ambiental","Contraste","Otros"].map(o=><option key={o}>{o}</option>)}</select>
      <div style={{marginTop:14,borderTop:`1px solid ${LINE}`,paddingTop:10}}>
       {chk(alergOnlySevere,"Solo graves",()=>{setAlergOnlySevere(!alergOnlySevere);setAlergSel(0);})}
       {chk(alergOnlyActive,"Solo activas",()=>{setAlergOnlyActive(!alergOnlyActive);setAlergSel(0);})}
      </div>
      <div style={{marginTop:14,fontSize:12,color:P.muted}}>{rows.length} de {allRows.length} alergia(s)</div>
     </div>
     {/* Tabla */}
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",flexWrap:"wrap",gap:10}}>
       <div style={{fontSize:16,fontWeight:800}}>Alergias ({rows.length})</div>
      </div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr><th style={th}>Paciente</th><th style={th}>Alérgeno</th><th style={th}>Tipo</th><th style={th}>Reacción</th><th style={th}>Gravedad</th><th style={th}>Estado</th></tr></thead>
       <tbody>{rows.map((r,i)=>{const on=i===alergSel;return <tr key={r.id} onClick={()=>setAlergSel(i)} style={{cursor:"pointer",background:on?"#F7F6FE":"transparent"}}>
        <td style={td}><div style={{display:"flex",alignItems:"center",gap:9}}><span style={{width:30,height:30,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,flex:"0 0 auto"}}>{initials(r.name)}</span><div style={{minWidth:0}}><div style={{fontWeight:600,fontSize:13,whiteSpace:"nowrap"}}>{r.name}</div>{r.age&&<div style={{fontSize:11,color:P.muted}}>{r.age}</div>}</div></div></td>
        <td style={{...td,fontWeight:600}}>{r.substance}</td>
        <td style={{...td,color:P.muted}}>{r.type}</td>
        <td style={td}>{r.reaction}</td>
        <td style={td}><span style={sevBadge(r.sevKey)}>{r.sevKey}</span></td>
        <td style={td}><span style={estadoBadge(r.active)}>{r.estado}</span></td>
       </tr>;})}
       {rows.length===0&&<tr><td colSpan={6} style={{...td,textAlign:"center",color:P.muted,padding:"30px"}}>{alergLoaded?(allRows.length===0?"Sin alergias registradas. Usa «+ Nueva alergia».":"Ninguna alergia coincide con los filtros."):"Cargando registro…"}</td></tr>}
       </tbody>
      </table></div>
      {rows.length>0&&<div style={{padding:"13px 16px",fontSize:13,color:P.muted}}>Mostrando {rows.length} de {allRows.length} alergia(s) del registro</div>}
     </div>
     {/* Detalle */}
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:`1px solid ${LINE}`}}><div style={{fontSize:15,fontWeight:800}}>Detalle de la alergia</div></div>
      {!sel?<div style={{padding:"40px 16px",textAlign:"center",color:P.muted,fontSize:13}}>{allRows.length===0?"Registra una alergia con «+ Nueva alergia».":"Selecciona una alergia de la lista para ver su detalle."}</div>:<div style={{padding:"14px 16px"}}>
       <div style={{display:"flex",gap:11,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:14,fontWeight:700,flex:"0 0 auto"}}>{initials(sel.name)}</span><div><div style={{fontWeight:700,fontSize:14.5}}>{sel.name}</div><div style={{fontSize:11.5,color:P.muted}}>{sel.age||"Paciente"}</div><div style={{fontSize:11.5,color:P.muted}}>Expediente: {sel.exp}</div></div></div>
       <div style={{display:"flex",gap:10,alignItems:"center",marginTop:14}}><span style={{width:38,height:38,borderRadius:10,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7zM7 8l6 6"/></svg></span><div><div style={{fontWeight:700,fontSize:14}}>{sel.substance}</div><div style={{fontSize:12,color:P.muted}}>{sel.type}</div></div></div>
       <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:9}}>
        {[["Fecha de registro",sel.date],["Reacción",sel.reaction]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12.5}}><span style={{color:P.muted}}>{k}</span><span style={{fontWeight:600,textAlign:"right"}}>{v}</span></div>)}
        <div style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12.5,alignItems:"center"}}><span style={{color:P.muted}}>Gravedad</span><span style={sevBadge(sel.sevKey)}>{sel.sevKey}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12.5,alignItems:"center"}}><span style={{color:P.muted}}>Estado</span><span style={estadoBadge(sel.active)}>{sel.estado}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12.5}}><span style={{color:P.muted}}>Registrado por</span><span style={{fontWeight:600,textAlign:"right"}}>{sel.by}</span></div>
        <div style={{fontSize:12.5}}><div style={{color:P.muted,marginBottom:3}}>Notas</div><div style={{lineHeight:1.5}}>{sel.notes}</div></div>
       </div>
       {alertBeta&&<div style={{marginTop:12,display:"flex",gap:9,padding:"11px 13px",borderRadius:11,background:"#FDECEE",border:"1px solid #F6C9D0"}}><span style={{color:P.red,flex:"0 0 auto"}}>⚠</span><div><div style={{fontWeight:700,fontSize:12.5,color:"#9B1C2E"}}>Alerta clínica</div><div style={{fontSize:12,color:"#7A2531",marginTop:2}}>Evitar {sel.substance.toLowerCase().includes("sulfa")?"sulfonamidas":sel.substance.toLowerCase().includes("aine")||sel.substance.toLowerCase().includes("ibuprof")?"AINE":"penicilinas"} y considerar reactividad cruzada con otros de su familia.</div></div></div>}
       <div style={{display:"flex",gap:10,marginTop:14}}>
        <button onClick={()=>{selectPatientRaw(sel.pid,sel.name);setView("exp");setTimeout(()=>scrollToSection("Alergias"),0);}} style={{flex:1,border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"9px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver en el expediente →</button>
       </div>
      </div>}
     </div>
    </div>
    {/* Fila inferior: gráficas + recomendaciones + accesos */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginTop:16,alignItems:"start"}} className="mos-alerg2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Alergias por tipo de alérgeno</div><div style={{display:"flex",gap:14,alignItems:"center"}}><div style={{width:100,height:100,borderRadius:"50%",flex:"0 0 auto",display:"grid",placeItems:"center",background:total>0?`conic-gradient(${stops})`:"#EEF0F5"}}><div style={{width:64,height:64,borderRadius:"50%",background:P.white,display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:16,fontWeight:800}}>{total}</div><div style={{fontSize:9,color:P.muted}}>Alergias</div></div></div></div><div style={{flex:1}}>{total===0?<div style={{fontSize:12.5,color:P.muted}}>Sin alergias registradas.</div>:typeSegs.map(([l,c,n])=><div key={l} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,padding:"3px 0"}}><span style={{width:8,height:8,borderRadius:"50%",background:c}}/>{l==="Medicamento"?"Medicamentos":l==="Alimento"?"Alimentos":l==="Ambiental"?"Ambientales":l==="Contraste"?"Contrastes":"Otros"}<b style={{marginLeft:"auto"}}>{n} ({pct(n)}%)</b></div>)}</div></div></div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Alergias por gravedad</div>{([["Graves",cGrave,"#F0455E"],["Moderadas",cMod,"#E5983B"],["Leves",cLeve,"#16A66A"],["Inciertas",cInc,"#9AA0BC"]] as [string,number,string][]).map(([l,n,c])=><div key={l} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:4}}><span>{l}</span><b>{n} ({pct(n)}%)</b></div><div style={{height:8,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${pct(n)}%`,background:c,borderRadius:6}}/></div></div>)}</div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:10}}>Recomendaciones</div>{["Verificar alergias antes de prescribir.","Usar alertas en recetas y procedimientos.","Registrar reacciones con el mayor detalle posible.","Educar al paciente sobre signos de alarma.","Revisar historial en cada consulta."].map((r,i)=><div key={i} style={{display:"flex",gap:9,alignItems:"flex-start",padding:"7px 0",fontSize:12.5}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.9" style={{flex:"0 0 auto",marginTop:1}}><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>{r}</div>)}</div>
    </div>
   </div>;
  })() : view==="problemas" ? (()=>{
   // ===== MÓDULO PROBLEMAS (S-PROBLEMAS) — lista clínica-wide cableada + form Nuevo problema + Plantillas =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"14px 0 6px"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const estSty=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={Activo:["#FDECEE","#C9364A"],["En seguimiento"]:["#FBF0DC","#B7791F"],Resuelto:["#E6F6EE","#16A66A"],Inactivo:["#EEF1F7","#6B7191"]};const[bg,fg]=m[k]??m.Activo!;return{background:bg,color:fg,borderRadius:16,padding:"3px 11px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"};};

   // ---------- PANTALLA: NUEVO PROBLEMA (form cableado a CIE-10 + POST /problems) ----------
   if(probScreen==="nuevo"){
    const seg=(on:boolean):React.CSSProperties=>({padding:"9px 14px",fontSize:13,fontWeight:on?700:500,color:on?P.purple:P.muted,background:on?"#EEEBFD":P.white,border:`1px solid ${on?P.purple:LINE}`,borderRadius:9,cursor:"pointer",fontFamily:UI});
    const searchCie=async(q:string)=>{setPfName(q);setPfCode("");if(q.trim().length>=2){try{const r=await apiRequest(`/api/v1/terminology/icd10?q=${encodeURIComponent(q)}`,{method:"GET"});if(r.status===200)setPfResults(((r.body["results"] as IcdEntry[])??[]).slice(0,6));}catch{/* búsqueda no disponible */}}else setPfResults([]);};
    const pick=(e:IcdEntry)=>{setPfName(`${e.code} · ${e.description}`);setPfCode(e.code);setPfResults([]);};
    const savePf=async()=>{
     if(!pfCode){setPfMsg("Selecciona un diagnóstico CIE-10 válido de la lista.");return;}
     if(!patientId){setPfMsg("Selecciona un paciente en el buscador superior para guardar el problema.");return;}
     setPfBusy(true);setPfMsg("");
     try{const r=await apiRequest("/api/v1/problems",{method:"POST",body:{problemId:crypto.randomUUID(),patientId,code:pfCode,...(pfDesc?{description:pfDesc}:{}),occurredAt:new Date().toISOString()}});
      if(r.status===201||r.status===200){setProbReg(null);setProbScreen("lista");setPfName("");setPfCode("");setPfDesc("");setPfNotes("");}
      else setPfMsg("No se pudo guardar (estado "+r.status+").");
     }catch{setPfMsg("Error al guardar el problema.");}finally{setPfBusy(false);}
    };
    const COMMON:[string,string][]=[["E11.9","Diabetes mellitus tipo 2"],["I10","Hipertensión esencial (primaria)"],["J06.9","Infección aguda de vías respiratorias superiores"],["J45.909","Asma, no especificada"],["K29.70","Gastritis, no especificada"],["F41.9","Trastorno de ansiedad generalizada"],["M54.5","Lumbalgia no especificada"],["N39.0","Infección de vías urinarias, sitio no especificado"]];
    return <div style={{padding:"18px 24px 40px"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}><button onClick={()=>setProbScreen("lista")} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI,display:"flex",alignItems:"center",gap:6}}>← Volver</button><div><h1 style={{fontSize:26,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Nuevo problema</h1><p style={{color:P.muted,fontSize:13,margin:"3px 0 0"}}>Registra un nuevo problema de salud en el expediente del paciente.</p></div></div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button onClick={savePf} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Guardar y añadir otro</button><button onClick={savePf} disabled={pfBusy} style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>{pfBusy?"Guardando…":"✓ Guardar problema"}</button></div>
     </div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:16,marginTop:16,alignItems:"start"}} className="mos-prob-new">
      <div style={{...card2,padding:22}}>
       <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>1. Información del problema</div>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div>
         <div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Nombre del problema / Diagnóstico <span style={{color:P.red}}>*</span></div>
         <div style={{position:"relative"}}>
          <div style={{display:"flex",gap:8}}><input value={pfName} onChange={e=>searchCie(e.target.value)} placeholder="Buscar en CIE-10 o escribir diagnóstico..." style={{...selSty,flex:1}}/><button onClick={()=>searchCie(pfName)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px 12px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>⊟ Buscar en CIE-10</button></div>
          {pfResults.length>0&&<div style={{position:"absolute",top:"110%",left:0,right:0,zIndex:5,background:P.white,border:`1px solid ${LINE}`,borderRadius:11,boxShadow:"0 12px 32px rgba(20,30,60,.14)",overflow:"hidden"}}>{pfResults.map(e=><div key={e.code} onClick={()=>pick(e)} style={{display:"flex",gap:12,padding:"11px 14px",cursor:"pointer",borderBottom:`1px solid #F2F4F9`,alignItems:"center"}}><span style={{fontWeight:700,color:P.purple,fontSize:13,minWidth:56}}>{e.code}</span><span style={{fontSize:13}}>{e.description}</span></div>)}</div>}
         </div>
         {pfCode&&<div style={{marginTop:8,fontSize:12,color:"#16A66A",fontWeight:600}}>✓ CIE-10 {pfCode} seleccionado</div>}
         <div style={{fontSize:12.5,fontWeight:700,margin:"18px 0 6px"}}>Descripción clínica</div>
         <textarea value={pfDesc} onChange={e=>setPfDesc(e.target.value.slice(0,1000))} placeholder="Describe el problema, síntomas, evolución, hallazgos relevantes..." style={{...selSty,minHeight:120,resize:"vertical"}}/>
         <div style={{textAlign:"right",fontSize:11,color:P.muted}}>{pfDesc.length}/1000</div>
        </div>
        <div>
         <div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Tipo de problema <span style={{color:P.red}}>*</span></div>
         <div style={{display:"flex",gap:8}}>{(["Agudo","Crónico","Recurrente"] as const).map(t=><button key={t} onClick={()=>setPfType(t)} style={seg(pfType===t)}>{t}</button>)}</div>
         <div style={{fontSize:12.5,fontWeight:700,margin:"18px 0 6px"}}>Fecha de inicio <span style={{color:P.red}}>*</span></div>
         <div style={{display:"flex",gap:10,alignItems:"center"}}><input type="date" defaultValue="2026-09-17" style={{...selSty,flex:1}}/><label style={{display:"flex",alignItems:"center",gap:6,fontSize:12.5,color:P.muted,whiteSpace:"nowrap"}}><span style={{width:15,height:15,borderRadius:4,border:"1.6px solid #C7CCE0",display:"inline-block"}}/>Fecha aproximada</label></div>
         <div style={{fontSize:12.5,fontWeight:700,margin:"18px 0 6px"}}>Estado actual <span style={{color:P.red}}>*</span></div>
         <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["Activo","En seguimiento","Resuelto","Inactivo"].map(s=><button key={s} onClick={()=>setPfEstado(s)} style={seg(pfEstado===s)}>{s}</button>)}</div>
        </div>
       </div>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginTop:20}}>
        <div><div style={flbl}>Gravedad</div><select value={pfSev} onChange={e=>setPfSev(e.target.value)} style={selSty}>{["Leve","Moderada","Grave"].map(o=><option key={o}>{o}</option>)}</select></div>
        <div><div style={flbl}>Prioridad</div><select style={selSty} defaultValue="Normal">{["Normal","Alta","Urgente"].map(o=><option key={o}>{o}</option>)}</select></div>
        <div><div style={flbl}>Categoría</div><select style={selSty} defaultValue=""><option value="">Selecciona una categoría</option>{["Endocrinológicas","Cardiovasculares","Respiratorias","Psiquiátricas","Digestivas"].map(o=><option key={o}>{o}</option>)}</select></div>
       </div>
       <div style={{marginTop:20}}><div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Etiquetas / Palabras clave</div><input placeholder="Agregar etiqueta (presiona Enter)" style={selSty}/><div style={{display:"flex",gap:8,marginTop:8}}>{["síntomas","control","seguimiento"].map(t=><span key={t} style={{display:"inline-flex",alignItems:"center",gap:6,background:"#EEEBFD",color:P.purple,borderRadius:8,padding:"5px 10px",fontSize:12.5,fontWeight:600}}>{t}<span style={{cursor:"pointer"}}>×</span></span>)}</div></div>
       <div style={{marginTop:20}}><div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Notas adicionales</div><textarea value={pfNotes} onChange={e=>setPfNotes(e.target.value.slice(0,500))} placeholder="Información adicional, contexto, observaciones..." style={{...selSty,minHeight:90,resize:"vertical"}}/><div style={{textAlign:"right",fontSize:11,color:P.muted}}>{pfNotes.length}/500</div></div>
       {pfMsg&&<div style={{marginTop:14,padding:"11px 14px",borderRadius:10,background:"#FDF4E6",border:"1px solid #F2E1C0",fontSize:13,color:"#7A5A16"}}>{pfMsg}</div>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
       <div style={{...card2,padding:16}}>
        <div style={{fontSize:15,fontWeight:800,marginBottom:10}}>Sugerencias de diagnósticos</div>
        <input onChange={e=>searchCie(e.target.value)} placeholder="Buscar en CIE-10..." style={selSty}/>
        <div style={{display:"flex",gap:14,marginTop:12,borderBottom:`1px solid ${LINE}`,fontSize:12.5}}>{["Más comunes","Recientes","Favoritos"].map((t,i)=><span key={t} style={{padding:"6px 0",fontWeight:i===0?700:500,color:i===0?P.purple:P.muted,borderBottom:i===0?`2px solid ${P.purple}`:"2px solid transparent",cursor:"pointer"}}>{t}</span>)}</div>
        <div style={{marginTop:8}}>{COMMON.map(([c,d])=><div key={c} onClick={()=>pick({code:c,description:d,category:""})} style={{display:"flex",gap:10,padding:"9px 6px",cursor:"pointer",alignItems:"center",borderRadius:8}}><span style={{fontWeight:700,color:P.purple,fontSize:12.5,minWidth:52}}>{c}</span><span style={{fontSize:12.5}}>{d}</span></div>)}</div>
        <button style={{marginTop:10,width:"100%",border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>⧉ Explorar catálogo CIE-10</button>
       </div>
       <div style={{...card2,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:15,fontWeight:800}}>Problemas recientes en el registro</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}} onClick={()=>setProbScreen("lista")}>Ver todos</span></div>
        {(()=>{const fD=(iso:string)=>{const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};const recent=(probReg?.items??[]).slice(0,5);if(recent.length===0)return <div style={{fontSize:12.5,color:P.muted,padding:"8px 0"}}>Aún no hay problemas registrados en el consultorio.</div>;return recent.map(it=><div key={it.problemId} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid #F2F4F9`}}><span style={{width:8,height:8,borderRadius:"50%",background:it.status==="RESOLVED"?"#16A66A":it.statusLabel==="En seguimiento"?"#B7791F":"#C9364A",flex:"0 0 auto"}}/><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13}}>{it.description||it.code}</div><div style={{fontSize:11.5,color:P.muted}}>{it.code} · {it.patientName} · {fD(it.recordedAt)}</div></div><span style={estSty(it.statusLabel)}>{it.statusLabel}</span></div>);})()}
       </div>
       <div style={{...card2,padding:16,background:"#F7F6FE",borderColor:"#E2DEFB"}}><div style={{display:"flex",gap:10}}><span style={{color:P.purple}}>💡</span><div><div style={{fontWeight:700,fontSize:13}}>Tip</div><div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Usa diagnósticos específicos con código CIE-10 para un mejor seguimiento, estadísticas y generación de reportes.</div></div></div></div>
      </div>
     </div>
    </div>;
   }

   // ---------- PANTALLA: PLANTILLAS DE PROBLEMAS (catálogo) ----------
   if(probScreen==="plantillas"){
    const CATS:[string,number][]=[["Todas las plantillas",154],["Cardiovasculares",18],["Endocrinológicas",16],["Respiratorias",14],["Digestivas",12],["Neurológicas",11],["Psiquiátricas",10],["Ginecológicas",10],["Pediátricas",12],["Infecciosas",15],["Dermatológicas",9],["Musculoesqueléticas",9],["Genitourinarias",8],["Oncológicas",6],["Oftalmológicas",5],["Otorrinolaringológicas",6],["Hematológicas",4],["Otros",19]];
    type Tpl={name:string;code:string;desc:string;cat:string;fav:boolean};
    const TPLS:Tpl[]=[
     {name:"Diabetes mellitus tipo 2",code:"E11.9",desc:"Enfermedad crónica metabólica con hiperglucemia.",cat:"Endocrinológicas",fav:true},
     {name:"Hipertensión arterial",code:"I10",desc:"Elevación persistente de la presión arterial.",cat:"Cardiovasculares",fav:true},
     {name:"Asma",code:"J45.9",desc:"Enfermedad inflamatoria crónica de la vía aérea.",cat:"Respiratorias",fav:false},
     {name:"Depresión",code:"F32.9",desc:"Trastorno del estado de ánimo.",cat:"Psiquiátricas",fav:false},
     {name:"Ansiedad generalizada",code:"F41.1",desc:"Trastorno de ansiedad crónica.",cat:"Psiquiátricas",fav:false},
     {name:"Gastritis",code:"K29.7",desc:"Inflamación de la mucosa gástrica.",cat:"Digestivas",fav:false},
     {name:"IVU (cistitis)",code:"N30.0",desc:"Infección del tracto urinario no complicada.",cat:"Genitourinarias",fav:false},
     {name:"Rinitis alérgica",code:"J30.9",desc:"Inflamación nasal por alérgenos.",cat:"Respiratorias",fav:false},
     {name:"Dermatitis atópica",code:"L20.9",desc:"Enfermedad inflamatoria crónica de la piel.",cat:"Dermatológicas",fav:false},
     {name:"SOP",code:"E28.2",desc:"Síndrome de ovario poliquístico.",cat:"Ginecológicas",fav:false},
     {name:"Hipercolesterolemia",code:"E78.0",desc:"Elevación del colesterol total en sangre.",cat:"Cardiovasculares",fav:false},
     {name:"Obesidad",code:"E66.9",desc:"Exceso de grasa corporal (IMC ≥ 30).",cat:"Endocrinológicas",fav:false},
    ];
    const tpls=TPLS.filter(t=>probPlantCat==="Todas las plantillas"||t.cat===probPlantCat);
    const selT=tpls[0]??TPLS[0]!;
    const useTpl=(t:Tpl)=>{setPfName(`${t.code} · ${t.name}`);setPfCode(t.code);setPfType("Crónico");setProbScreen("nuevo");};
    return <div style={{padding:"18px 24px 40px"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}><button onClick={()=>setProbScreen("lista")} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>← Volver</button><div><h1 style={{fontSize:26,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Plantillas de problemas</h1><p style={{color:P.muted,fontSize:13,margin:"3px 0 0"}}>Utiliza plantillas predefinidas para registrar problemas de salud de forma rápida y estandarizada.</p></div></div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 16px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>+ Nueva plantilla</button><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>↥ Importar/Exportar ▾</button></div>
     </div>
     <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap",alignItems:"center"}}><input placeholder="Buscar plantilla por nombre, CIE-10 o palabra clave..." style={{...selSty,flex:1,minWidth:220}}/><select style={{...selSty,width:"auto"}} defaultValue="Todas las categorías"><option>Todas las categorías</option></select><select style={{...selSty,width:"auto"}} defaultValue="Todos los grupos de edad"><option>Todos los grupos de edad</option></select><span style={{fontSize:12.5,color:P.blue,cursor:"pointer"}}>Limpiar</span></div>
     <div style={{display:"grid",gridTemplateColumns:"220px 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-prob-tpl">
      <div style={{...card2,padding:14}}><div style={{fontSize:14,fontWeight:800,marginBottom:8}}>Categorías</div>{CATS.map(([c,n])=>{const on=c===probPlantCat;return <div key={c} onClick={()=>setProbPlantCat(c)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 10px",borderRadius:9,cursor:"pointer",background:on?"#EEEBFD":"transparent",color:on?P.purple:P.ink,fontWeight:on?700:500,fontSize:13}}><span>{c}</span><span style={{fontSize:11.5,color:on?P.purple:P.muted}}>{n}</span></div>;})}</div>
      <div style={{...card2,padding:16}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:16,fontWeight:800}}>Plantillas ({tpls.length})</div><select style={{...selSty,width:"auto",padding:"7px 10px"}} defaultValue="Más utilizadas"><option>Más utilizadas</option></select></div>
       <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12}}>{tpls.map(t=><div key={t.code} style={{border:`1px solid ${LINE}`,borderRadius:12,padding:14,display:"flex",flexDirection:"column",gap:8}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{width:40,height:40,borderRadius:11,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3h6l1 4H8zM7 7h10l1 13H6z"/></svg></span><span style={{color:t.fav?P.purple:"#C7CCE0"}}>{t.fav?"★":"☆"}</span></div><div><div style={{fontWeight:700,fontSize:14}}>{t.name}</div><div style={{fontSize:12,color:P.purple,fontWeight:600}}>{t.code}</div></div><div style={{fontSize:12,color:P.muted,lineHeight:1.4,minHeight:32}}>{t.desc}</div><button onClick={()=>useTpl(t)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"8px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>Usar plantilla</button></div>)}</div>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14,fontSize:13,color:P.muted}}><span>Mostrando 1–{tpls.length} de 154 plantillas</span><div style={{display:"flex",gap:5}}>{["‹","1","2","3","4","5","›"].map((p,i)=><span key={i} style={{minWidth:30,height:30,border:`1px solid ${LINE}`,background:p==="1"?P.purple:P.white,color:p==="1"?"#fff":P.ink,borderRadius:8,display:"grid",placeItems:"center",fontSize:12.5,cursor:"pointer"}}>{p}</span>)}</div></div>
      </div>
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:`1px solid ${LINE}`}}><div style={{fontSize:15,fontWeight:800}}>Detalle de la plantilla</div><span style={{color:P.muted,cursor:"pointer"}}>✕</span></div>
       <div style={{padding:16}}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3h6l1 4H8zM7 7h10l1 13H6z"/></svg></span><div><div style={{fontWeight:700,fontSize:15}}>{selT.name}</div><div style={{fontSize:12.5,color:P.purple,fontWeight:600}}>{selT.code}</div></div></div>
        <div style={{display:"flex",gap:14,marginTop:12,borderBottom:`1px solid ${LINE}`,fontSize:12.5}}>{["Información","Campos","Notas","Vista previa"].map((t,i)=><span key={t} style={{padding:"6px 0",fontWeight:i===0?700:500,color:i===0?P.purple:P.muted,borderBottom:i===0?`2px solid ${P.purple}`:"2px solid transparent",cursor:"pointer"}}>{t}</span>)}</div>
        <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:11,fontSize:12.5}}>
         <div><div style={{color:P.muted,marginBottom:3}}>Categoría</div><span style={{background:"#EEEBFD",color:P.purple,borderRadius:8,padding:"3px 9px",fontWeight:600}}>{selT.cat}</span></div>
         <div><div style={{color:P.muted,marginBottom:3}}>Descripción</div><div style={{lineHeight:1.5}}>{selT.desc}</div></div>
         <div><div style={{color:P.muted,marginBottom:3}}>CIE-10</div><b>{selT.code}</b></div>
         <div><div style={{color:P.muted,marginBottom:5}}>Palabras clave</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{["diabetes","hiperglucemia","crónica","control"].map(k=><span key={k} style={{background:"#F2F4F9",color:P.muted,borderRadius:7,padding:"3px 8px",fontSize:11.5}}>{k}</span>)}</div></div>
         <div><div style={{color:P.muted,marginBottom:5}}>Incluye campos</div>{["Fecha de diagnóstico","Control (activo/inactivo)","Gravedad","Notas clínicas","Plan de manejo","Alertas y recordatorios"].map(f=><div key={f} style={{display:"flex",gap:8,alignItems:"center",padding:"3px 0"}}><span style={{color:"#16A66A"}}>✓</span>{f}</div>)}</div>
         <div><div style={{color:P.muted,marginBottom:3}}>Usada en</div><b>234 pacientes</b> <span style={{color:P.muted}}>· Última vez: 15 sep 2026</span></div>
        </div>
        <button onClick={()=>useTpl(selT)} style={{marginTop:14,width:"100%",border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"11px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Usar plantilla</button>
        <button style={{marginTop:8,width:"100%",border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>✎ Editar plantilla</button>
       </div>
      </div>
     </div>
    </div>;
   }

   // ---------- PANTALLA: LISTA DE PROBLEMAS (registro clínica-wide cableado) ----------
   const probLoaded=!!probReg;
   type PRow={id:string;pid:string;name:string;type:string;patient:string;age:string;code:string;estado:string;date:string;active:boolean};
   const fmtD=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   // Registro clínica-wide REAL (GET /api/v1/problems); sin datos de ejemplo.
   const allRows:PRow[]=(probReg?.items??[]).map((it,i)=>({id:it.problemId||`x${i}`,pid:it.patientId,name:it.description||it.code,type:it.chronic?"Crónico":"Agudo",patient:it.patientName,age:"",code:it.code,estado:it.statusLabel,date:fmtD(it.recordedAt),active:it.status==="ACTIVE"||it.status==="CHRONIC"}));
   const rows=allRows.filter(r=>(probStatusF==="Todos"||r.estado===probStatusF)&&(!probSearch||`${r.name} ${r.patient} ${r.code}`.toLowerCase().includes(probSearch.toLowerCase())));
   const selp:PRow|null=rows[probSel]??rows[0]??null;
   const total=probReg?.total??0;
   const cAct=probReg?.byStatus.activos??0,cSeg=probReg?.byStatus.enSeguimiento??0,cRes=probReg?.byStatus.resueltos??0,cIna=probReg?.byStatus.inactivos??0;
   const pct=(n:number)=>total?Math.round(n/total*100):0;
   const catEntries:[string,number][]=probReg?Object.entries(probReg.byCategory).sort((a,b)=>b[1]-a[1]):[];
   const CATC=["#16A66A","#6C5CF6","#F0455E","#20B7D9","#E5983B","#6B7191","#B7791F","#0E7490"];
   let cAcc=0;const catStops=catEntries.map(([,n],i)=>{const a=total?cAcc/total*100:0;cAcc+=n;const b=total?cAcc/total*100:0;return `${CATC[i%CATC.length]} ${a}% ${b}%`;}).join(",");
   const topP=probReg?.topPatients??[];
   const kico=(bg:string,fg:string,d:string)=><span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:16,display:"flex",gap:13,alignItems:"center"};
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`};
   const tdc:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:13,verticalAlign:"middle"};
   const chk2=(on:boolean,l:string,tog:()=>void)=><label key={l} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,padding:"5px 0",cursor:"pointer"}} onClick={tog}><span style={{width:16,height:16,borderRadius:4,border:on?"0":"1.6px solid #C7CCE0",background:on?P.purple:"transparent",display:"grid",placeItems:"center",color:"#fff",fontSize:10,flex:"0 0 auto"}}>{on?"✓":""}</span>{l}</label>;
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1zM9 12l2 2 4-4"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Problemas</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Gestiona los problemas de salud de tus pacientes (diagnósticos, condiciones crónicas y antecedentes relevantes).</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button onClick={()=>setProbScreen("plantillas")} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>⊟ Plantillas</button>
      <button onClick={()=>setProbScreen("nuevo")} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>⚡ Problema rápido</button>
      <button onClick={()=>setProbScreen("nuevo")} style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>+ Nuevo problema ▾</button>
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#EEEBFD",P.purple,"M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z")}<div><div style={{fontSize:24,fontWeight:800}}>{total}</div><div style={{fontSize:11.5,color:P.muted}}>Problemas registrados<br/>En todos los pacientes</div></div></div>
     <div style={kcard}>{kico("#FDECEE",P.red,"M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01")}<div><div style={{fontSize:24,fontWeight:800}}>{cAct}</div><div style={{fontSize:11.5,color:P.muted}}>Activos ({pct(cAct)}%)</div></div></div>
     <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 9v4M12 17h.01M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{cSeg}</div><div style={{fontSize:11.5,color:P.muted}}>En seguimiento ({pct(cSeg)}%)</div></div></div>
     <div style={kcard}>{kico("#E6F6EE","#16A66A","M20 6L9 17l-5-5")}<div><div style={{fontSize:24,fontWeight:800}}>{cRes}</div><div style={{fontSize:11.5,color:P.muted}}>Resueltos ({pct(cRes)}%)</div></div></div>
     <div style={kcard}>{kico("#EEF1F7","#6B7191","M12 9v4M12 17h.01M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{cIna}</div><div style={{fontSize:11.5,color:P.muted}}>Inactivos ({pct(cIna)}%)</div></div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"240px 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-prob">
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:15,fontWeight:700}}>Filtros</div><button onClick={()=>{setProbSearch("");setProbStatusF("Todos");}} style={{border:0,background:"transparent",color:P.blue,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:UI}}>Limpiar</button></div>
      <div style={{position:"relative",marginTop:10}}><input value={probSearch} onChange={e=>{setProbSearch(e.target.value);setProbSel(0);}} placeholder="Buscar problema, diagnóstico o CI..." style={{...selSty,padding:"9px 11px 9px 32px"}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" style={{position:"absolute",left:10,top:11}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div>
      <div style={flbl}>Estado</div><select value={probStatusF} onChange={e=>{setProbStatusF(e.target.value);setProbSel(0);}} style={selSty}>{["Todos","Activo","En seguimiento","Resuelto","Inactivo"].map(o=><option key={o}>{o}</option>)}</select>
      <div style={{marginTop:14,borderTop:`1px solid ${LINE}`,paddingTop:10}}>{chk2(probStatusF==="Activo","Solo activos",()=>{setProbStatusF(probStatusF==="Activo"?"Todos":"Activo");setProbSel(0);})}{chk2(probStatusF==="En seguimiento","Solo en seguimiento",()=>{setProbStatusF(probStatusF==="En seguimiento"?"Todos":"En seguimiento");setProbSel(0);})}</div>
      <div style={{marginTop:14,fontSize:12,color:P.muted}}>{rows.length} de {allRows.length} problema(s)</div>
     </div>
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px"}}><div style={{fontSize:16,fontWeight:800}}>Problemas ({rows.length})</div></div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr><th style={th}>Problema / Diagnóstico</th><th style={th}>Paciente</th><th style={th}>Código CIE-10</th><th style={th}>Estado</th><th style={th}>Fecha de registro</th></tr></thead>
       <tbody>{rows.map((r,i)=>{const on=i===probSel;return <tr key={r.id} onClick={()=>setProbSel(i)} style={{cursor:"pointer",background:on?"#F7F6FE":"transparent"}}>
        <td style={tdc}><div style={{fontWeight:600}}>{r.name}</div><div style={{fontSize:11,color:P.muted}}>{r.type}</div></td>
        <td style={tdc}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:26,height:26,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>{initials(r.patient)}</span><div style={{minWidth:0}}><div style={{fontSize:12.5,fontWeight:600,whiteSpace:"nowrap"}}>{r.patient}</div>{r.age&&<div style={{fontSize:10.5,color:P.muted}}>{r.age}</div>}</div></div></td>
        <td style={{...tdc,fontWeight:600}}>{r.code}</td>
        <td style={tdc}><span style={estSty(r.estado)}>{r.estado}</span></td>
        <td style={{...tdc,color:P.muted}}>{r.date}</td>
       </tr>;})}
       {rows.length===0&&<tr><td colSpan={5} style={{...tdc,textAlign:"center",color:P.muted,padding:"30px"}}>{probLoaded?(allRows.length===0?"Sin problemas registrados. Usa «+ Nuevo problema».":"Ningún problema coincide con los filtros."):"Cargando registro…"}</td></tr>}
       </tbody></table></div>
      {rows.length>0&&<div style={{padding:"13px 16px",fontSize:13,color:P.muted}}>Mostrando {rows.length} de {allRows.length} problema(s) del registro</div>}
     </div>
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:`1px solid ${LINE}`}}><div style={{fontSize:15,fontWeight:800}}>Detalle del problema</div></div>
      {!selp?<div style={{padding:"40px 16px",textAlign:"center",color:P.muted,fontSize:13}}>{allRows.length===0?"Registra un problema con «+ Nuevo problema».":"Selecciona un problema de la lista para ver su detalle."}</div>:<div style={{padding:"14px 16px"}}>
       <div style={{display:"flex",gap:11,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:14,fontWeight:700,flex:"0 0 auto"}}>{initials(selp.patient)}</span><div><div style={{fontWeight:700,fontSize:14.5}}>{selp.patient}</div><div style={{fontSize:11.5,color:P.muted}}>Expediente: {selp.pid.slice(0,8).toUpperCase()}</div></div></div>
       <div style={{display:"flex",gap:10,alignItems:"center",marginTop:14,justifyContent:"space-between"}}><div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{width:38,height:38,borderRadius:10,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3h6l1 4H8zM7 7h10l1 13H6z"/></svg></span><div><div style={{fontWeight:700,fontSize:14}}>{selp.name}</div><div style={{fontSize:12,color:P.muted}}>{selp.code}</div></div></div><span style={estSty(selp.estado)}>{selp.estado}</span></div>
       <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:9,fontSize:12.5}}>
        {[["Código CIE-10",selp.code],["Fecha de registro",selp.date],["Tipo",selp.type],["Estado",selp.estado]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",gap:10}}><span style={{color:P.muted}}>{k}</span><span style={{fontWeight:600,textAlign:"right"}}>{v}</span></div>)}
       </div>
       <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>{selectPatientRaw(selp.pid,selp.patient);setView("exp");setTimeout(()=>scrollToSection("Lista de problemas"),0);}} style={{flex:1,border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"9px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver en el expediente →</button></div>
      </div>}
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginTop:16,alignItems:"start"}} className="mos-prob2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Problemas por categoría (CIE-10)</div><div style={{display:"flex",gap:14,alignItems:"center"}}><div style={{width:100,height:100,borderRadius:"50%",flex:"0 0 auto",display:"grid",placeItems:"center",background:total>0&&catStops?`conic-gradient(${catStops})`:"#EEF0F5"}}><div style={{width:64,height:64,borderRadius:"50%",background:P.white,display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:16,fontWeight:800}}>{total}</div><div style={{fontSize:9,color:P.muted}}>Problemas</div></div></div></div><div style={{flex:1}}>{catEntries.length===0?<div style={{fontSize:12.5,color:P.muted}}>Sin problemas registrados.</div>:catEntries.map(([l,n],i)=><div key={l} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,padding:"3px 0"}}><span style={{width:8,height:8,borderRadius:"50%",background:CATC[i%CATC.length]}}/>{l}<b style={{marginLeft:"auto"}}>{n} ({pct(n)}%)</b></div>)}</div></div></div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Estado de problemas</div>{([["Activos",cAct,"#F0455E"],["En seguimiento",cSeg,"#E5983B"],["Resueltos",cRes,"#16A66A"],["Inactivos",cIna,"#9AA0BC"]] as [string,number,string][]).map(([l,n,c])=><div key={l} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:4}}><span>{l}</span><b>{n} ({pct(n)}%)</b></div><div style={{height:8,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${pct(n)}%`,background:c,borderRadius:6}}/></div></div>)}</div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:10}}>Pacientes con más problemas</div>{topP.length===0?<div style={{fontSize:12.5,color:P.muted}}>Sin problemas registrados.</div>:topP.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",borderBottom:i<topP.length-1?`1px solid #F2F4F9`:"0"}}><span style={{width:28,height:28,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>{initials(p.name)}</span><span style={{flex:1,fontSize:12.5,fontWeight:600}}>{p.name}</span><b style={{fontSize:13}}>{p.count}</b></div>)}</div>
    </div>
   </div>;
  })() : view==="vacunas" ? (()=>{
   // ===== MÓDULO VACUNAS (S-VACUNAS) — registro clínica-wide cableado a GET /api/v1/immunizations =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"14px 0 6px"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const fmtD=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const estSty=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={Completa:["#E6F6EE","#16A66A"],Pendiente:["#FBF0DC","#B7791F"],Rechazada:["#FDECEE","#C9364A"],["Evento adverso"]:["#FDECEE","#C9364A"]};const[bg,fg]=m[k]??m.Pendiente!;return{background:bg,color:fg,borderRadius:16,padding:"3px 11px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"};};
   const immLoaded=!!immReg;
   type VRow={id:string;pid:string;date:string;patient:string;age:string;vaccine:string;dose:string;lot:string;estado:string;site:string};
   const allRows:VRow[]=(immReg?.items??[]).map((it,i)=>({id:it.immunizationId||`v${i}`,pid:it.patientId,date:fmtD(it.appliedAt),patient:it.patientName,age:"",vaccine:it.vaccine,dose:it.dose,lot:it.lot||"—",estado:it.statusLabel,site:it.site||"—"}));
   const rows=allRows.filter(r=>(immStatusF==="Todos"||r.estado===immStatusF)&&(!immSearch||`${r.patient} ${r.vaccine} ${r.lot}`.toLowerCase().includes(immSearch.toLowerCase())));
   const selv:VRow|null=rows[immSel]??rows[0]??null;
   const total=immReg?.total??0;
   const kVac=immReg?.vaccinatedPatients??0,kPend=immReg?.pendingCount??0,kApl=immReg?.appliedCount??0,kInc=immReg?.incompleteSchemes??0;
   const pendientes=allRows.filter(r=>r.estado==="Pendiente");
   const covEntries:[string,number][]=immReg?Object.entries(immReg.byVaccine).sort((a,b)=>b[1]-a[1]).slice(0,7):[];
   const covTotal=covEntries.reduce((s,[,n])=>s+n,0)||1;
   const COVC=["#F0455E","#6C5CF6","#1769E0","#E5983B","#20B7D9","#16A66A","#6B7191"];
   let cAcc=0;const covStops=covEntries.map(([,n],i)=>{const a=cAcc/covTotal*100;cAcc+=n;const b=cAcc/covTotal*100;return `${COVC[i%COVC.length]} ${a}% ${b}%`;}).join(",");
   const complete=selv?.estado==="Completa";
   const kico=(bg:string,fg:string,d:string)=><span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:16,display:"flex",gap:13,alignItems:"center"};
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"11px 10px",borderBottom:`1px solid ${LINE}`};
   const tdc:React.CSSProperties={padding:"10px 10px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,verticalAlign:"middle"};
   const chk2=(on:boolean,l:string,tog:()=>void)=><label key={l} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,padding:"5px 0",cursor:"pointer"}} onClick={tog}><span style={{width:16,height:16,borderRadius:4,border:on?"0":"1.6px solid #C7CCE0",background:on?P.purple:"transparent",display:"grid",placeItems:"center",color:"#fff",fontSize:10,flex:"0 0 auto"}}>{on?"✓":""}</span>{l}</label>;
   const syringe="M14 4l6 6M17 7l-9 9-4 1 1-4 9-9zM3 21l3-1";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={syringe}/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Vacunas</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Registra, consulta y da seguimiento al esquema de vacunación de tus pacientes.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setVacNew(v=>!v);setVacMsg(null);}}>{vacNew?"Cerrar":"+ Registrar vacuna"}</button>
     </div>
    </div>
    {vacMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:vacMsg.includes("✓")?"#F0FBF4":"#EEF6FF",border:`1px solid ${vacMsg.includes("✓")?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:vacMsg.includes("✓")?P.green:P.blue,fontWeight:700}}>{vacMsg.includes("✓")?"✓":"ℹ"}</span><span style={{flex:1}}>{vacMsg}</span><button onClick={()=>setVacMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {vacNew&&<div style={{...card2,marginTop:14,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>Registrar vacuna</div>
     <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:14}} className="mos-med2">
      <div><div style={{...flbl,margin:"0 0 6px"}}>Paciente</div><select value={vacForm.patientId} onChange={e=>setVacForm({...vacForm,patientId:e.target.value})} style={selSty}><option value="">Selecciona…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select></div>
      <div><div style={{...flbl,margin:"0 0 6px"}}>Vacuna</div><input value={vacForm.vaccineCode} onChange={e=>setVacForm({...vacForm,vaccineCode:e.target.value})} placeholder="Ej. Influenza" style={selSty}/></div>
      <div><div style={{...flbl,margin:"0 0 6px"}}>Dosis</div><input value={vacForm.dose} onChange={e=>setVacForm({...vacForm,dose:e.target.value})} placeholder="1/1" style={selSty}/></div>
     </div>
     <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>{["Influenza","SRP","Neumococo 13V","Hexavalente","Hepatitis B","Tdap","COVID-19","Herpes zóster"].map(v=><button key={v} onClick={()=>setVacForm(f=>({...f,vaccineCode:v}))} style={vacForm.vaccineCode===v?{border:`1px solid ${P.purple}`,background:"#EEEBFD",color:P.purple,borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:UI}:{border:`1px solid ${LINE}`,background:P.white,color:P.ink,borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:UI}}>{v}</button>)}</div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:12}}>
      <div><div style={{...flbl,margin:"0 0 6px"}}>Lote (opcional — para aplicar ya)</div><input value={vacForm.lot} onChange={e=>setVacForm({...vacForm,lot:e.target.value})} placeholder="Ej. A3F2K" style={selSty}/></div>
      <div><div style={{...flbl,margin:"0 0 6px"}}>Sitio de aplicación</div><select value={vacForm.site} onChange={e=>setVacForm({...vacForm,site:e.target.value})} style={selSty}><option>Brazo izquierdo</option><option>Brazo derecho</option><option>Muslo izquierdo</option><option>Muslo derecho</option><option>Glúteo</option></select></div>
     </div>
     <div style={{fontSize:11.5,color:P.muted,marginTop:8}}>Sin lote se registra como <b>pendiente</b>; con lote y sitio se marca <b>aplicada</b> en el acto.</div>
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void createImmunizationInline()} disabled={vacBusy||!vacForm.patientId||!vacForm.vaccineCode.trim()} style={{border:0,background:(vacBusy||!vacForm.patientId||!vacForm.vaccineCode.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(vacBusy||!vacForm.patientId||!vacForm.vaccineCode.trim())?"default":"pointer",fontFamily:UI}}>{vacBusy?"Registrando…":"Registrar vacuna"}</button><button onClick={()=>setVacNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z")}<div><div style={{fontSize:24,fontWeight:800}}>{kVac}</div><div style={{fontSize:11.5,color:P.muted}}>Pacientes vacunados (en control)</div></div></div>
     <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{kPend}</div><div style={{fontSize:11.5,color:P.muted}}>Dosis pendientes</div></div></div>
     <div style={kcard}>{kico("#E6F6EE","#16A66A","M20 6L9 17l-5-5")}<div><div style={{fontSize:24,fontWeight:800}}>{kApl}</div><div style={{fontSize:11.5,color:P.muted}}>Dosis aplicadas (total)</div></div></div>
     <div style={kcard}>{kico("#FDECEE",P.red,"M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01")}<div><div style={{fontSize:24,fontWeight:800}}>{kInc}</div><div style={{fontSize:11.5,color:P.muted}}>Esquemas incompletos</div></div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"240px 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-vac">
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:15,fontWeight:700}}>Filtros</div><button onClick={()=>{setImmSearch("");setImmStatusF("Todos");}} style={{border:0,background:"transparent",color:P.blue,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:UI}}>Limpiar</button></div>
      <div style={{position:"relative",marginTop:10}}><input value={immSearch} onChange={e=>{setImmSearch(e.target.value);setImmSel(0);}} placeholder="Buscar paciente, vacuna o lote..." style={{...selSty,padding:"9px 11px 9px 32px"}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" style={{position:"absolute",left:10,top:11}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div>
      <div style={flbl}>Estado</div><select value={immStatusF} onChange={e=>{setImmStatusF(e.target.value);setImmSel(0);}} style={selSty}>{["Todos","Completa","Pendiente","Rechazada"].map(o=><option key={o}>{o}</option>)}</select>
      <div style={{marginTop:14,borderTop:`1px solid ${LINE}`,paddingTop:10}}>{chk2(immStatusF==="Pendiente","Solo esquemas incompletos",()=>{setImmStatusF(immStatusF==="Pendiente"?"Todos":"Pendiente");setImmSel(0);})}</div>
      <div style={{marginTop:14,fontSize:12,color:P.muted}}>{rows.length} de {allRows.length} registro(s)</div>
     </div>
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px"}}><div style={{fontSize:16,fontWeight:800}}>Vacunación ({rows.length})</div></div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr><th style={th}>Fecha</th><th style={th}>Paciente</th><th style={th}>Vacuna</th><th style={th}>Dosis</th><th style={th}>Lote</th><th style={th}>Estado</th></tr></thead>
       <tbody>{rows.map((r,i)=>{const on=i===immSel;return <tr key={r.id} onClick={()=>setImmSel(i)} style={{cursor:"pointer",background:on?"#F7F6FE":"transparent"}}>
        <td style={{...tdc,color:P.muted,whiteSpace:"nowrap"}}>{r.date}</td>
        <td style={tdc}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:26,height:26,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>{initials(r.patient)}</span><div style={{minWidth:0}}><div style={{fontSize:12.5,fontWeight:600,whiteSpace:"nowrap"}}>{r.patient}</div>{r.age&&<div style={{fontSize:10.5,color:P.muted}}>{r.age}</div>}</div></div></td>
        <td style={{...tdc,fontWeight:600}}>{r.vaccine}</td>
        <td style={tdc}>{r.dose}</td>
        <td style={{...tdc,color:P.muted}}>{r.lot}</td>
        <td style={tdc}><span style={estSty(r.estado)}>{r.estado}</span></td>
       </tr>;})}
       {rows.length===0&&<tr><td colSpan={6} style={{...tdc,textAlign:"center",color:P.muted,padding:"30px"}}>{immLoaded?(allRows.length===0?"Sin vacunas registradas. Usa «+ Registrar vacuna».":"Ninguna vacuna coincide con los filtros."):"Cargando registro…"}</td></tr>}
       </tbody></table></div>
      {rows.length>0&&<div style={{padding:"13px 16px",fontSize:13,color:P.muted}}>Mostrando {rows.length} de {allRows.length} registro(s)</div>}
     </div>
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:`1px solid ${LINE}`}}><div style={{fontSize:15,fontWeight:800}}>Detalle de la vacuna</div></div>
      {!selv?<div style={{padding:"40px 16px",textAlign:"center",color:P.muted,fontSize:13}}>{allRows.length===0?"Registra una vacuna con «+ Registrar vacuna».":"Selecciona un registro de la lista para ver su detalle."}</div>:<div style={{padding:"14px 16px"}}>
       <div style={{display:"flex",gap:11,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:14,fontWeight:700,flex:"0 0 auto"}}>{initials(selv.patient)}</span><div><div style={{fontWeight:700,fontSize:14.5}}>{selv.patient}</div><div style={{fontSize:11.5,color:P.muted}}>Expediente: {selv.pid.slice(0,8).toUpperCase()}</div></div></div>
       <div style={{display:"flex",gap:10,alignItems:"center",marginTop:14,justifyContent:"space-between"}}><div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{width:38,height:38,borderRadius:10,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={syringe}/></svg></span><div><div style={{fontWeight:700,fontSize:14}}>{selv.vaccine}</div></div></div><span style={estSty(selv.estado)}>{selv.estado}</span></div>
       <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:9,fontSize:12.5}}>
        {[["Fecha de aplicación",selv.date],["Dosis",selv.dose],["Lote",selv.lot],["Sitio de aplicación",selv.site],["Estado",selv.estado]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",gap:10}}><span style={{color:P.muted}}>{k}</span><span style={{fontWeight:600,textAlign:"right"}}>{v}</span></div>)}
       </div>
       {complete&&<div style={{marginTop:12,display:"flex",gap:9,padding:"11px 13px",borderRadius:11,background:"#EEF4FF",border:"1px solid #D3E1FB"}}><span style={{color:P.blue}}>✓</span><div><div style={{fontWeight:700,fontSize:12.5}}>Dosis aplicada</div><div style={{fontSize:12,color:P.muted,marginTop:2}}>{selv.vaccine} · dosis {selv.dose} registrada como aplicada.</div></div></div>}
       <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>{selectPatientRaw(selv.pid,selv.patient);setView("exp");setTimeout(()=>scrollToSection("Vacunas"),0);}} style={{flex:1,border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"9px",fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>Ver en el expediente →</button></div>
      </div>}
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginTop:16,alignItems:"start"}} className="mos-vac2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Dosis por vacuna</div><div style={{display:"flex",gap:14,alignItems:"center"}}><div style={{width:100,height:100,borderRadius:"50%",flex:"0 0 auto",display:"grid",placeItems:"center",background:kApl>0&&covStops?`conic-gradient(${covStops})`:"#EEF0F5"}}><div style={{width:64,height:64,borderRadius:"50%",background:P.white,display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:16,fontWeight:800}}>{kApl}</div><div style={{fontSize:9,color:P.muted}}>dosis aplicadas</div></div></div></div><div style={{flex:1}}>{covEntries.length===0?<div style={{fontSize:12.5,color:P.muted}}>Sin vacunas registradas.</div>:covEntries.map(([l,n],i)=><div key={l} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,padding:"3px 0"}}><span style={{width:8,height:8,borderRadius:"50%",background:COVC[i%COVC.length]}}/>{l}<b style={{marginLeft:"auto"}}>{Math.round(n/covTotal*100)}%</b></div>)}</div></div></div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Estado de vacunación</div>{([["Completa",allRows.filter(r=>r.estado==="Completa").length,"#16A66A"],["Pendiente",allRows.filter(r=>r.estado==="Pendiente").length,"#E5983B"],["Rechazada",allRows.filter(r=>r.estado==="Rechazada").length,"#C9364A"]] as [string,number,string][]).map(([l,n,c])=>{const p=allRows.length?Math.round(n/allRows.length*100):0;return <div key={l} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:4}}><span>{l}</span><b>{n} ({p}%)</b></div><div style={{height:8,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${p}%`,background:c,borderRadius:6}}/></div></div>;})}{allRows.length===0&&<div style={{fontSize:12.5,color:P.muted}}>Sin registros.</div>}</div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:10}}>Dosis pendientes ({pendientes.length})</div>{pendientes.length===0?<div style={{fontSize:12.5,color:P.muted}}>Sin dosis pendientes en el registro.</div>:pendientes.slice(0,6).map(r=><div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid #F2F4F9`}}><span style={{width:30,height:30,borderRadius:9,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={syringe}/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:12.5}}>{r.vaccine} · {r.dose}</div><div style={{fontSize:11,color:P.muted}}>{r.patient}</div></div></div>)}</div>
    </div>
   </div>;
  })() : view==="signos" ? (()=>{
   // ===== MÓDULO SIGNOS VITALES (S-SIGNOS) — form cableado a POST /vitals + historial/tendencias por paciente =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"10px 12px",fontSize:14,background:P.white,fontFamily:UI,color:P.ink};
   const flbl:React.CSSProperties={fontSize:12.5,fontWeight:700,margin:"0 0 6px"};
   const fmtDT=(iso:string)=>{if(!iso)return["—",""];const d=new Date(iso);if(isNaN(d.getTime()))return["—",""];return[d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"}),d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})];};
   const imcCalc=svPeso&&svTalla&&Number(svTalla)>0?(Number(svPeso)/Math.pow(Number(svTalla)/100,2)).toFixed(1):"";
   const saveVitals=async()=>{
    if(!patientId){setSvMsg("Selecciona un paciente en el buscador superior para guardar los signos vitales.");return;}
    const at=new Date().toISOString();const toSave:[string,string,string][]=[];
    if(svBpS&&svBpD)toSave.push(["BP",`${svBpS}/${svBpD}`,"mmHg"]);
    if(svFc)toSave.push(["HR",svFc,"lpm"]);if(svFr)toSave.push(["RESP",svFr,"rpm"]);
    if(svTemp)toSave.push(["TEMP",svTemp,"°C"]);if(svSpo2)toSave.push(["SPO2",svSpo2,"%"]);
    if(svPeso)toSave.push(["WEIGHT",svPeso,"kg"]);if(svTalla)toSave.push(["HEIGHT",svTalla,"cm"]);
    if(!toSave.length){setSvMsg("Captura al menos un signo vital.");return;}
    setSvBusy(true);setSvMsg("");
    try{for(const[vt,val,u]of toSave){await apiRequest("/api/v1/vitals",{method:"POST",body:{vitalId:crypto.randomUUID(),patientId,vitalType:vt,value:val,unit:u,occurredAt:at}});}
     const r=await apiRequest(`/api/v1/patients/${patientId}/vitals`,{method:"GET"});if(r.status===200)setVitHist(r.body as unknown as VitalHistory);
     setSvMsg("Signos vitales guardados ✓");setSvTemp("");setSvFc("");setSvFr("");setSvBpS("");setSvBpD("");setSvSpo2("");setSvPeso("");setSvPab("");setSvObs("");
    }catch{setSvMsg("Error al guardar los signos vitales.");}finally{setSvBusy(false);}
   };
   const clearForm=()=>{setSvTemp("");setSvFc("");setSvFr("");setSvBpS("");setSvBpD("");setSvSpo2("");setSvPeso("");setSvTalla("");setSvPab("");setSvPain("0");setSvObs("");setSvMsg("");};
   const svHist=!!vitHist;
   const records:VitalRecord[]=vitHist?.records??[];
   const sys=(ta:string)=>{const m=/^(\d+)/.exec(ta);return m?Number(m[1]):0;};
   const sBP=vitHist?.series.BP.map(p=>p.value)??[];
   const sHR=vitHist?.series.HR.map(p=>p.value)??[];
   const sWT=vitHist?.series.WEIGHT.map(p=>p.value)??[];
   const sIMC=vitHist?.series.IMC.map(p=>p.value)??[];
   const latest=records[0];
   const spark=(vals:number[],color:string)=>{if(!vals.length)return null;const w=150,h=44,pad=4;const mn=Math.min(...vals),mx=Math.max(...vals),rng=(mx-mn)||1;const step=vals.length>1?(w-pad*2)/(vals.length-1):0;
    const pt=(v:number,i:number)=>[pad+i*step,h-pad-((v-mn)/rng)*(h-pad*2)];
    const d=vals.map((v,i)=>{const[x,y]=pt(v,i);return `${i===0?"M":"L"}${x.toFixed(1)} ${y.toFixed(1)}`;}).join(" ");
    const[lx,ly]=pt(vals[vals.length-1]!,vals.length-1);
    return <svg width={w} height={h} style={{display:"block"}} aria-hidden><path d={`${d} L${(pad+(vals.length-1)*step).toFixed(1)} ${h} L${pad} ${h} Z`} fill={color} opacity={.09}/><path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><circle cx={lx} cy={ly} r={3} fill={color}/></svg>;};
   // Referencias y alertas deterministas (adultos)
   const alerts:string[]=[];
   if(latest){const s=sys(latest.ta),fc=Number(latest.fc),fr=Number(latest.fr),tp=Number(latest.temp),sp=Number(latest.spo2);
    if(s&&(s<90||s>139))alerts.push(`Presión arterial fuera de rango (${latest.ta} mmHg)`);
    if(fc&&(fc<60||fc>100))alerts.push(`Frecuencia cardíaca fuera de rango (${fc} lpm)`);
    if(fr&&(fr<12||fr>20))alerts.push(`Frecuencia respiratoria fuera de rango (${fr} rpm)`);
    if(tp&&(tp<36||tp>37.5))alerts.push(`Temperatura fuera de rango (${tp} °C)`);
    if(sp&&sp<95)alerts.push(`Saturación de O₂ baja (${sp}%)`);}
   const trendCard=(ico:string,c:string,title:string,unit:string,vals:number[],last:string)=><div style={{border:`1px solid ${LINE}`,borderRadius:12,padding:13}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{width:26,height:26,borderRadius:7,background:c+"22",color:c,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d={ico}/></svg></span><div style={{fontSize:12,fontWeight:700,lineHeight:1.1}}>{title}<div style={{fontSize:10.5,color:P.muted,fontWeight:500}}>{unit}</div></div></div>{spark(vals,c)}<div style={{fontSize:20,fontWeight:800,marginTop:6}}>{last}</div><div style={{fontSize:11.5,color:P.muted,display:"flex",justifyContent:"space-between"}}>Último registro <span>›</span></div></div>;
   const th:React.CSSProperties={textAlign:"left",fontSize:11,color:"#9AA0BC",fontWeight:600,padding:"9px 8px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
   const tdc:React.CSSProperties={padding:"9px 8px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,whiteSpace:"nowrap"};
   const num:React.CSSProperties={...selSty};
   const heartIco="M12 21C12 21 4 13.5 4 8.5A4 4 0 0112 6a4 4 0 018 2.5C20 13.5 12 21 12 21z";
   const actIco="M3 12h4l3 8 4-16 3 8h4";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden><path d={actIco}/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Signos vitales</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Registra, visualiza y da seguimiento a los signos vitales de tus pacientes.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button onClick={saveVitals} style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>+ Registrar signos vitales</button>
     </div>
    </div>
    <div style={{...card2,marginTop:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"center",gap:13,minWidth:0,flexWrap:"wrap"}}><span style={{width:48,height:48,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:15,fontWeight:700,flex:"0 0 auto"}}>{initials(patientName||"—")}</span><div style={{minWidth:0}}><select value={(patientList??[]).some(p=>p.patientId===patientId)?patientId:""} onChange={e=>{const pp=(patientList??[]).find(x=>x.patientId===e.target.value);if(pp)selectPatientRaw(pp.patientId,pp.name);}} style={{border:`1px solid ${LINE}`,borderRadius:8,padding:"7px 10px",fontSize:15,fontWeight:700,fontFamily:UI,color:P.ink,background:P.white}}><option value="">Selecciona un paciente…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select><div style={{fontSize:12.5,color:P.muted,marginTop:4}}>{patientName?"Registro e historial de signos vitales del paciente":"Elige un paciente para registrar y ver su historial"}</div></div></div>
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><button onClick={()=>{setView("exp");}} disabled={!patientId} style={{border:`1px solid ${patientId?P.purple:LINE}`,background:P.white,color:patientId?P.purple:"#C7CCE0",borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13,cursor:patientId?"pointer":"default",fontFamily:UI}}>Ver expediente →</button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-signos">
     {/* Form */}
     <div style={{...card2,padding:20}}>
      <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>Registrar signos vitales</div>
      <div style={{fontSize:12,color:P.muted,marginBottom:14}}>Se registra con la fecha y hora actuales.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
       <div><div style={flbl}>Temperatura (°C)</div><input value={svTemp} onChange={e=>setSvTemp(e.target.value)} placeholder="36.5" style={num}/></div>
       <div><div style={flbl}>Frecuencia cardíaca (lpm)</div><input value={svFc} onChange={e=>setSvFc(e.target.value)} placeholder="72" style={num}/></div>
       <div><div style={flbl}>Frecuencia respiratoria (rpm)</div><input value={svFr} onChange={e=>setSvFr(e.target.value)} placeholder="16" style={num}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:12}}>
       <div><div style={flbl}>Presión arterial (mmHg)</div><div style={{display:"flex",alignItems:"center",gap:6}}><input value={svBpS} onChange={e=>setSvBpS(e.target.value)} placeholder="120" style={{...num,textAlign:"center"}}/><span style={{color:P.muted}}>/</span><input value={svBpD} onChange={e=>setSvBpD(e.target.value)} placeholder="80" style={{...num,textAlign:"center"}}/></div></div>
       <div><div style={flbl}>Saturación O₂ (%)</div><input value={svSpo2} onChange={e=>setSvSpo2(e.target.value)} placeholder="98" style={num}/></div>
       <div><div style={flbl}>Peso (kg)</div><input value={svPeso} onChange={e=>setSvPeso(e.target.value)} placeholder="65.7" style={num}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:12}}>
       <div><div style={flbl}>Talla (cm)</div><input value={svTalla} onChange={e=>setSvTalla(e.target.value)} placeholder="149" style={num}/></div>
       <div><div style={flbl}>IMC (kg/m²)</div><input value={imcCalc} readOnly placeholder="—" style={{...num,background:"#F2F4F9",color:P.muted}}/></div>
       <div/>
      </div>
      {svMsg&&<div style={{marginTop:10,padding:"10px 13px",borderRadius:10,background:svMsg.includes("✓")?"#E6F6EE":"#FDF4E6",border:`1px solid ${svMsg.includes("✓")?"#BFE6CF":"#F2E1C0"}`,fontSize:13,color:svMsg.includes("✓")?"#166534":"#7A5A16"}}>{svMsg}</div>}
      <div style={{display:"flex",gap:12,marginTop:14}}><button onClick={clearForm} style={{flex:"0 0 34%",border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"12px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Limpiar</button><button onClick={saveVitals} disabled={svBusy} style={{flex:1,border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:UI}}>{svBusy?"Guardando…":"✓ Guardar signos vitales"}</button></div>
     </div>
     {/* Últimos registros + Tendencias */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px"}}><div style={{fontSize:16,fontWeight:800}}>Últimos registros{records.length>0?` (${records.length})`:""}</div></div>
       <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><th style={th}>Fecha y hora</th><th style={th}>TA (mmHg)</th><th style={th}>FC (lpm)</th><th style={th}>FR (rpm)</th><th style={th}>Temp (°C)</th><th style={th}>SpO₂ (%)</th><th style={th}>Peso (kg)</th><th style={th}>IMC</th></tr></thead>
        <tbody>{records.slice(0,6).map((r,i)=>{const[d,t]=fmtDT(r.at);return <tr key={i}><td style={tdc}><div style={{fontWeight:600}}>{d}</div><div style={{fontSize:11,color:P.muted}}>{t}</div></td><td style={tdc}>{r.ta||"—"}</td><td style={tdc}>{r.fc||"—"}</td><td style={tdc}>{r.fr||"—"}</td><td style={tdc}>{r.temp||"—"}</td><td style={tdc}>{r.spo2||"—"}</td><td style={tdc}>{r.peso||"—"}</td><td style={tdc}>{r.imc||"—"}</td></tr>;})}
        {records.length===0&&<tr><td colSpan={8} style={{...tdc,textAlign:"center",color:P.muted,padding:"24px"}}>{patientId?(svHist?"Sin registros de signos vitales para este paciente.":"Cargando historial…"):"Selecciona un paciente para ver su historial."}</td></tr>}
        </tbody></table></div>
      </div>
      <div style={{...card2,padding:16}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:16,fontWeight:800}}>Tendencias</div></div>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {trendCard("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",P.blue,"Presión arterial","(mmHg)",sBP,latest?.ta||"—")}
        {trendCard(heartIco,P.red,"Frecuencia cardíaca","(lpm)",sHR,latest?.fc||"—")}
        {trendCard("M20 7h-9M14 17H5M17 3l3 4-3 4M7 21l-3-4 3-4",P.green,"Peso","(kg)",sWT,latest?.peso||"—")}
        {trendCard("M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v8",P.purple,"IMC","(kg/m²)",sIMC,latest?.imc||"—")}
       </div>
      </div>
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:14,marginTop:16,alignItems:"start"}} className="mos-signos2">
     <div style={{...card2,padding:16}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{color:P.purple}}>▦</span><div style={{fontSize:15,fontWeight:700}}>Referencia de valores normales (adultos)</div></div><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>{[["TA","90/60 – 120/80","mmHg"],["FC","60 – 100","lpm"],["FR","12 – 20","rpm"],["Temperatura","36.0 – 37.5","°C"],["SpO₂","≥ 95","%"]].map(([k,v,u])=><div key={k}><div style={{fontSize:12,fontWeight:700,color:P.purple}}>{k}</div><div style={{fontSize:13,fontWeight:600,marginTop:3}}>{v}</div><div style={{fontSize:11,color:P.muted}}>{u}</div></div>)}</div></div>
     <div style={{...card2,padding:16}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{color:alerts.length?P.red:P.amber}}>⚠</span><div style={{fontSize:15,fontWeight:700}}>Alertas clínicas</div></div>{alerts.length===0?<div style={{fontSize:13,color:P.muted,lineHeight:1.6}}>{records.length?"Los signos vitales se encuentran en rangos normales.":"Registra signos vitales para evaluar alertas."}</div>:<div style={{display:"flex",flexDirection:"column",gap:8}}>{alerts.map((a,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"8px 11px",borderRadius:9,background:"#FDECEE",fontSize:12.5,color:"#9B1C2E"}}><span>⚠</span>{a}</div>)}</div>}</div>
    </div>
   </div>;
  })() : view==="planCuidado" ? (()=>{
   // ===== MÓDULO PLAN DE CUIDADO (S-PLANCUIDADO) — snapshot compuesto cableado a GET /patients/:id/care-plan =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const useReal=!!cpSnap;
   const counts=cpSnap?cpSnap.counts:{problems:3,medications:2,allergies:1};
   type PA={code:string;description:string;statusLabel:string};
   const REP_PROB:PA[]=[{code:"E11.9",description:"Diabetes mellitus tipo 2",statusLabel:"Activo"},{code:"I10",description:"Hipertensión arterial",statusLabel:"En seguimiento"},{code:"E66.9",description:"Obesidad",statusLabel:"En seguimiento"}];
   const problems:PA[]=(useReal&&cpSnap!.problems.length)?cpSnap!.problems:REP_PROB;
   const REP_GOALS=[{goal:"Lograr HbA1c < 7% en 3 meses",statusLabel:"Activa"},{goal:"Mantener TA < 130/80 mmHg",statusLabel:"Activa"},{goal:"Reducir 5–10% del peso corporal en 6 meses",statusLabel:"Lograda"},{goal:"Mejorar adherencia al tratamiento",statusLabel:"Propuesta"},{goal:"Prevenir complicaciones a largo plazo",statusLabel:"Propuesta"}];
   const goals=(useReal&&cpSnap!.goals.length)?cpSnap!.goals.map(g=>({goal:g.goal,statusLabel:g.statusLabel})):REP_GOALS;
   const m=cpSnap?cpSnap.metrics:{hba1c:null,bp:null,weight:null,imc:null};
   const hba1c=m.hba1c??"8.1",bp=m.bp??"138/86",weight=m.weight??"78",imc=m.imc??"30.2";
   const dot=(c:string)=><span style={{width:9,height:9,borderRadius:"50%",background:c,flex:"0 0 auto"}}/>;
   const estSty=(k:string):React.CSSProperties=>{const mm:Record<string,[string,string]>={Activo:["#FDECEE","#C9364A"],["En seguimiento"]:["#FBF0DC","#B7791F"],Resuelto:["#E6F6EE","#16A66A"],["En curso"]:["#E6F6EE","#16A66A"],Pendiente:["#FBF0DC","#B7791F"],Programado:["#E7EEFB","#1769E0"]};const[b,f]=mm[k]??mm.Activo!;return{background:b,color:f,borderRadius:16,padding:"3px 11px",fontSize:11.5,fontWeight:700,whiteSpace:"nowrap"};};
   const cico=(c:string,d:string)=><span style={{width:34,height:34,borderRadius:9,background:c+"22",color:c,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={d}/></svg></span>;
   const sec:React.CSSProperties={fontSize:15.5,fontWeight:800,display:"flex",alignItems:"center",gap:9,marginBottom:14};
   const secIco=(c:string,d:string)=><span style={{width:28,height:28,borderRadius:8,background:c+"22",color:c,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={d}/></svg></span>;
   const metric=(name:string,target:string,val:string,unit:string,good:boolean)=><div style={{marginBottom:13}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}><div><div style={{fontSize:13,fontWeight:700}}>{name}</div><div style={{fontSize:11,color:P.muted}}>{target}</div></div><div style={{fontSize:12,color:P.muted}}>Último: <b style={{color:P.ink}}>{val}{unit}</b></div></div><div style={{height:6,borderRadius:6,background:"#EEF1F7",overflow:"hidden",marginTop:5}}><div style={{height:"100%",width:good?"85%":"55%",background:good?"#16A66A":"#E5983B",borderRadius:6}}/></div></div>;
   const PLAN_TABS:[typeof cpPlanTab,string][]=[["plan","Plan actual"],["historial","Historial de planes"],["objetivos","Objetivos"],["educacion","Educación"],["notas","Notas"]];
   const clip="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={clip}/><path d="M9 12l2 2 4-4"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Plan de cuidado</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Define, organiza y da seguimiento al plan de cuidado integral del paciente.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>⊟ Plantillas</button>
      <button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>⎙ Imprimir plan</button>
      <button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setCpNew(v=>!v);setCpMsg(null);}}>{cpNew?"Cerrar":"+ Nueva meta"}</button>
     </div>
    </div>
    {cpMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:cpMsg.includes("✓")?"#F0FBF4":"#EEF6FF",border:`1px solid ${cpMsg.includes("✓")?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:cpMsg.includes("✓")?P.green:P.blue,fontWeight:700}}>{cpMsg.includes("✓")?"✓":"ℹ"}</span><span style={{flex:1}}>{cpMsg}</span><button onClick={()=>setCpMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {cpNew&&<div style={{...card2,marginTop:14,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:4}}>Nueva meta del plan de cuidado</div>
     <div style={{fontSize:12.5,color:P.muted,marginBottom:12}}>Para <b style={{color:P.ink}}>{patientName||"el paciente en contexto"}</b>{!patientId?" — selecciona un paciente primero":""}.</div>
     <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:14}} className="mos-med2">
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Categoría</div><select value={cpForm.category} onChange={e=>setCpForm({...cpForm,category:e.target.value})} style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink}}>{[["DIABETES","Diabetes"],["HYPERTENSION","Hipertensión"],["OBESITY","Obesidad"],["CARDIOVASCULAR","Cardiovascular"],["MENTAL_HEALTH","Salud mental"],["PRENATAL","Prenatal"],["OTHER","Otro"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Objetivo / meta</div><input value={cpForm.goal} onChange={e=>setCpForm({...cpForm,goal:e.target.value})} placeholder="Ej. Lograr HbA1c < 7% en 3 meses" style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink}}/></div>
     </div>
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void addCarePlanGoal()} disabled={cpBusy||!patientId||!cpForm.goal.trim()} style={{border:0,background:(cpBusy||!patientId||!cpForm.goal.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(cpBusy||!patientId||!cpForm.goal.trim())?"default":"pointer",fontFamily:UI}}>{cpBusy?"Agregando…":"Agregar meta"}</button><button onClick={()=>setCpNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    <div style={{...card2,marginTop:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"center",gap:13,minWidth:0}}><span style={{width:48,height:48,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:15,fontWeight:700,flex:"0 0 auto"}}>{initials(patientName||"Ana López García")}</span><div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:16}}>{patientName||"Ana López García"}</div><div style={{fontSize:12.5,color:P.muted}}>Femenino, 34 años&nbsp;&nbsp;|&nbsp;&nbsp;Expediente: LC260917-0042&nbsp;&nbsp;|&nbsp;&nbsp;CURP: LOGA900101MCHPRN09</div></div></div>
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}>{cico(P.blue,clip)}<div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{counts.problems}</div><div style={{fontSize:11,color:P.muted}}>Problemas activos</div></div></div>
      <div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}>{cico(P.green,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z")}<div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{counts.medications}</div><div style={{fontSize:11,color:P.muted}}>Medicamentos</div></div></div>
      <div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}>{cico(P.red,"M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z")}<div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{counts.allergies}</div><div style={{fontSize:11,color:P.muted}}>{counts.allergies===1?"Alergia":"Alergias"}</div></div></div>
      <button onClick={()=>{setView("exp");}} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver expediente →</button>
     </div>
    </div>
    <div style={{...card2,marginTop:16,padding:"0 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
     <div style={{display:"flex",gap:4,overflowX:"auto"}}>{PLAN_TABS.map(([k,l])=><button key={k} onClick={()=>setCpPlanTab(k)} style={{padding:"14px 12px",fontSize:13.5,fontWeight:cpPlanTab===k?700:500,color:cpPlanTab===k?P.purple:P.muted,borderBottom:cpPlanTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>{l}</button>)}</div>
     <div style={{display:"flex",gap:16,alignItems:"center",fontSize:12.5,color:P.muted,flexWrap:"wrap",padding:"8px 0"}}><span>Fecha de elaboración: <b style={{color:P.ink}}>17 sep 2026</b></span><span>Próxima revisión: <b style={{color:P.ink}}>15 oct 2026</b></span><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"8px 13px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>✎ Editar plan</button></div>
    </div>
    {/* Fila superior: problemas / objetivos / resumen */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-cp">
     <div style={{...card2,padding:18}}><div style={sec}>{secIco(P.purple,clip)}Diagnósticos / Problemas asociados</div>{problems.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<problems.length-1?`1px solid #F2F4F9`:"0"}}>{dot(["#F0455E","#E5983B","#1769E0","#6C5CF6"][i%4]!)}<div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:600}}>{p.description}</div></div><span style={{fontSize:12,color:P.muted,fontWeight:600}}>{p.code}</span><span style={estSty(p.statusLabel)}>{p.statusLabel}</span></div>)}</div>
     <div style={{...card2,padding:18}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={sec}>{secIco(P.green,"M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11")}Objetivos del plan</div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:8,padding:"5px 10px",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:UI}}>✎ Editar</button></div>{goals.map((g,i)=>{const done=g.statusLabel==="Lograda";return <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0"}}><span style={{width:18,height:18,borderRadius:"50%",border:done?"0":"1.8px solid #C7CCE0",background:done?"#16A66A":"transparent",color:"#fff",display:"grid",placeItems:"center",fontSize:11,flex:"0 0 auto"}}>{done?"✓":""}</span><span style={{fontSize:13.5,color:done?P.muted:P.ink,textDecoration:done?"line-through":"none"}}>{g.goal}</span></div>;})}</div>
     <div style={{...card2,padding:18}}><div style={sec}>{secIco(P.blue,"M4 19V5M4 19h16M8 15l3-4 3 2 4-6")}Resumen</div><div style={{display:"flex",flexDirection:"column",gap:11,fontSize:12.5}}>{[["Fecha de inicio","17 sep 2026"],["Próxima revisión","15 oct 2026"]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between"}}><span style={{color:P.muted}}>{k}</span><b>{v}</b></div>)}<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:P.muted}}>Estado</span><span style={estSty("En curso")}>Activo</span></div>{[["Responsable","Dr. Luis Godinez"],["Tipo de plan","Integral"]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between"}}><span style={{color:P.muted}}>{k}</span><b>{v}</b></div>)}<div style={{fontSize:11.5,color:P.muted,marginTop:2}}>17 sep 2026, 10:24</div></div></div>
    </div>
    {/* Fila media: intervenciones / cronograma+métricas / educación+notas+documentos */}
    <div style={{display:"grid",gridTemplateColumns:"1.3fr 0.9fr 0.9fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-cp2">
     <div style={{...card2,padding:18}}><div style={sec}>{secIco(P.purple,"M4 6h16M4 12h16M4 18h10")}Intervenciones y recomendaciones</div>
      {[["Tratamiento farmacológico","Ajuste y adherencia a medicamentos","En curso","M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z"],["Plan nutricional","Dieta mediterránea, control de porciones","En curso","M12 3a5 5 0 015 5c0 4-5 13-5 13S7 12 7 8a5 5 0 015-5z"],["Actividad física","150 min/semana + fuerza 2 días/semana","En curso","M6 12h12M9 8v8M15 8v8"],["Monitoreo en casa","TA, glucosa capilar, peso","En curso","M3 12l9-9 9 9M5 10v10h14V10"],["Educación al paciente","Enfermedad, autocuidado, signos de alarma","Pendiente","M4 6h16v10H4zM8 20h8"],["Estudios de seguimiento","Laboratorios y gabinete","Programado","M9 3h6l1 4H8z"],["Interconsultas","Nutrición, Endocrinología (según evolución)","Pendiente","M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"]].map(([t,d,st,ic],i)=><div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:i<6?`1px solid #F2F4F9`:"0"}}>{cico(P.purple,ic as string)}<div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:700}}>{t}</div><div style={{fontSize:12,color:P.muted}}>{d}</div></div><span style={estSty(st as string)}>{st}</span><span style={{color:P.muted,fontWeight:700,cursor:"pointer"}}>⋯</span></div>)}
      <button style={{marginTop:14,border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px 16px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>+ Agregar intervención</button>
     </div>
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:18}}><div style={sec}>{secIco(P.blue,"M8 2v4M16 2v4M4 8h16M5 6h14v14H5z")}Cronograma de seguimiento</div>
       {[["17 sep 2026","Plan de cuidado iniciado","done"],["01 oct 2026","Revisión de TA y glucosa (virtual)","curr"],["15 oct 2026","Consulta de seguimiento",""],["15 dic 2026","Laboratorios de control",""],["17 mar 2027","Evaluación de objetivos",""]].map(([d,t,s],i,arr)=><div key={i} style={{display:"flex",gap:11}}><div style={{display:"flex",flexDirection:"column",alignItems:"center"}}><span style={{width:16,height:16,borderRadius:"50%",border:s==="curr"?`2px solid ${P.blue}`:s==="done"?"0":"2px solid #C7CCE0",background:s==="done"?"#16A66A":s==="curr"?P.blue:"transparent",color:"#fff",display:"grid",placeItems:"center",fontSize:9,flex:"0 0 auto"}}>{s==="done"?"✓":""}</span>{i<arr.length-1&&<span style={{width:2,flex:1,background:"#E7E9F2",minHeight:22}}/>}</div><div style={{paddingBottom:14}}><div style={{fontSize:13,fontWeight:700}}>{d}</div><div style={{fontSize:12,color:P.muted}}>{t}</div></div></div>)}
      </div>
      <div style={{...card2,padding:18}}><div style={sec}>{secIco(P.purple,"M4 19V5M4 19h16M8 15l3-4 3 2 4-6")}Metas y métricas</div>
       {metric("HbA1c","< 7%",hba1c,"%",Number(hba1c)<7)}
       {metric("Presión arterial","< 130/80",bp,"",Number((bp.split("/")[0])||0)<130)}
       {metric("Peso","-5 a 10%",weight," kg",false)}
       {metric("IMC","< 25",imc,"",Number(imc)<25)}
      </div>
     </div>
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:18}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={sec}>{secIco(P.purple,"M12 14l9-5-9-5-9 5 9 5zM12 14v7")}Educación para el paciente</div><span style={{color:P.purple,fontWeight:700,cursor:"pointer"}}>+</span></div>{["Guía de alimentación en diabetes","Ejercicios recomendados","Técnica correcta de medición de TA","Signos de alarma","Cuidado de pies en diabetes"].map((e,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<4?`1px solid #F2F4F9`:"0",fontSize:13,color:P.blue,fontWeight:500,cursor:"pointer"}}><span style={{display:"flex",alignItems:"center",gap:8}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h12v14H4zM8 3h12v12"/></svg>{e}</span><span>⧉</span></div>)}</div>
      <div style={{...card2,padding:18}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:15.5,fontWeight:800}}>Notas del plan</div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:8,padding:"5px 11px",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:UI}}>Agregar</button></div><div style={{fontSize:12.5,lineHeight:1.5}}><div style={{color:P.muted,marginBottom:4}}>17 sep 2026, 10:24</div>Se inicia plan integral. Paciente motivada. Se entrega material educativo y se programa seguimiento en 2 semanas.<div style={{color:P.muted,textAlign:"right",marginTop:6}}>Dr. Luis Godinez</div></div></div>
      <div style={{...card2,padding:18}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:15.5,fontWeight:800}}>Documentos relacionados</div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:8,padding:"5px 11px",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:UI}}>Agregar</button></div>{["Plan de alimentación.pdf","Rutina de ejercicios.pdf","Consentimiento plan de cuidado.pdf"].map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:i<2?`1px solid #F2F4F9`:"0",fontSize:12.5}}><span style={{color:P.red}}>▤</span><span style={{flex:1,color:P.blue,fontWeight:500}}>{f}</span><span style={{color:P.muted,fontSize:11}}>17 sep 2026</span><span style={{color:P.muted,fontWeight:700,cursor:"pointer"}}>⋯</span></div>)}</div>
     </div>
    </div>
   </div>;
  })() : view==="interconsulta" ? (()=>{
   // ===== MÓDULO INTERCONSULTAS (S-INTERCONSULTA) — form Nueva interconsulta; panel derecho cableado a referral-context =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"10px 12px",fontSize:14,background:P.white,fontFamily:UI,color:P.ink};
   const flbl:React.CSSProperties={fontSize:12.5,fontWeight:700,marginBottom:6};
   const SHORT:Record<string,string>={E11:"DM2",I10:"HTA",E66:"Obesidad",E78:"Dislipidemia",F41:"Ansiedad",F32:"Depresión",J45:"Asma"};
   const shortOf=(code:string)=>SHORT[code.slice(0,3)]??code;
   const hasCtx=!!refCtx;
   const cAllergies=hasCtx&&refCtx!.allergies.length?refCtx!.allergies.join(", "):"Amoxicilina (rash)";
   const cMeds=hasCtx&&refCtx!.medications.length?refCtx!.medications.map(m=>m.charAt(0).toUpperCase()+m.slice(1)).join(", "):"Metformina, Losartán";
   const ctxProblems=hasCtx&&refCtx!.problems.length?refCtx!.problems:[{code:"E11.9",description:"Diabetes mellitus tipo 2"},{code:"E66.9",description:"Obesidad"},{code:"I10",description:"Hipertensión arterial"}];
   const cProblems=ctxProblems.map(p=>shortOf(p.code)).join(", ");
   const cHba1c=(hasCtx&&refCtx!.labs.hba1c)?`HbA1c ${refCtx!.labs.hba1c}% (17 sep 2026)`:"HbA1c 8.1% (17 sep 2026)";
   const cVit=hasCtx&&(refCtx!.vitals.bp||refCtx!.vitals.imc)?`TA ${refCtx!.vitals.bp??"—"}  FC ${refCtx!.vitals.hr??"—"}  IMC ${refCtx!.vitals.imc??"—"}`:"TA 124/82  FC 76  IMC 30.2";
   const icBillTo=icPatientId||patientId;
   const send=async()=>{
    if(!icBillTo){setIcMsg("Selecciona un paciente para enviar la interconsulta.");return;}
    if(!icMotivo.trim()){setIcMsg("El motivo de interconsulta es obligatorio.");return;}
    setIcBusy(true);setIcMsg("");
    try{const r=await apiRequest("/api/v1/referrals",{method:"POST",body:{referralId:crypto.randomUUID(),patientId:icBillTo,specialty:icSpecialty,reason:icMotivo,occurredAt:new Date().toISOString()}});
     if(r.status===201||r.status===200){setIcMsg("Interconsulta enviada ✓");setIcMotivo("");setIcResumen("");}
     else setIcMsg("No se pudo enviar (estado "+r.status+").");
    }catch{setIcMsg("Error al enviar la interconsulta.");}finally{setIcBusy(false);}
   };
   const infoRow=(c:string,d:string,l:string,v:string)=><div style={{display:"flex",alignItems:"center",gap:11,padding:"11px 0",borderBottom:`1px solid #F2F4F9`,cursor:"pointer"}}><span style={{width:32,height:32,borderRadius:9,background:c+"22",color:c,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={d}/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontSize:12.5,fontWeight:700}}>{l}</div><div style={{fontSize:12,color:P.muted}}>{v}</div></div><span style={{color:P.muted}}>›</span></div>;
   const clip="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z";
   const IC_TABS:[typeof icTab,string][]=[["datos","Datos de la interconsulta"],["resumen","Resumen clínico"],["documentos","Documentos y estudios"],["indicaciones","Indicaciones"]];
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"center",gap:14}}><button onClick={()=>setView("exp")} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>← Volver</button><div><h1 style={{fontSize:26,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Nueva interconsulta</h1><p style={{color:P.muted,fontSize:13,margin:"3px 0 0"}}>Solicita una valoración por otra especialidad y da seguimiento al proceso.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>⊟ Plantillas</button><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>◉ Vista previa</button><button onClick={send} disabled={icBusy} style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>{icBusy?"Enviando…":"➤ Enviar interconsulta"}</button></div>
    </div>
    <div style={{...card2,marginTop:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
     {(()=>{const bp=(patientList??[]).find(p=>p.patientId===icBillTo);const bname=bp?bp.name:patientName;return <div style={{display:"flex",alignItems:"center",gap:13,minWidth:0,flexWrap:"wrap"}}><span style={{width:48,height:48,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:15,fontWeight:700,flex:"0 0 auto"}}>{initials(bname||"—")}</span><div style={{minWidth:0}}><select value={icPatientId||(bp?patientId:"")} onChange={e=>setIcPatientId(e.target.value)} style={{border:`1px solid ${LINE}`,borderRadius:8,padding:"7px 10px",fontSize:15,fontWeight:700,fontFamily:UI,color:P.ink,background:P.white}}><option value="">Selecciona un paciente…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select><div style={{fontSize:12.5,color:P.muted,marginTop:4}}>{bp?(bp.curp?`CURP: ${bp.curp}`:"Paciente del tenant"):"Elige a quién se solicita la interconsulta"}</div></div></div>;})()}
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}><span style={{width:32,height:32,borderRadius:9,background:P.blue+"22",color:P.blue,display:"grid",placeItems:"center"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={clip}/></svg></span><div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{ctxProblems.length}</div><div style={{fontSize:11,color:P.muted}}>Problemas activos</div></div></div>
      <div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}><span style={{width:32,height:32,borderRadius:9,background:P.green+"22",color:P.green,display:"grid",placeItems:"center"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z"/></svg></span><div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{hasCtx&&refCtx!.medications.length?refCtx!.medications.length:2}</div><div style={{fontSize:11,color:P.muted}}>Medicamentos</div></div></div>
      <div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}><span style={{width:32,height:32,borderRadius:9,background:P.red+"22",color:P.red,display:"grid",placeItems:"center"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg></span><div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{hasCtx?refCtx!.allergies.length:1}</div><div style={{fontSize:11,color:P.muted}}>{(hasCtx?refCtx!.allergies.length:1)===1?"Alergia":"Alergias"}</div></div></div>
      <button onClick={()=>setView("exp")} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver expediente →</button>
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 330px",gap:16,marginTop:16,alignItems:"start"}} className="mos-ic">
     {/* Columna principal: form */}
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",gap:4,padding:"0 18px",borderBottom:`1px solid ${LINE}`,overflowX:"auto"}}>{IC_TABS.map(([k,l])=><button key={k} onClick={()=>setIcTab(k)} style={{padding:"14px 8px",fontSize:13.5,fontWeight:icTab===k?700:500,color:icTab===k?P.purple:P.muted,borderBottom:icTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>{l}</button>)}</div>
      <div style={{padding:22}}>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
        <div><div style={flbl}>Especialidad <span style={{color:P.red}}>*</span></div><select value={icSpecialty} onChange={e=>setIcSpecialty(e.target.value)} style={selSty}>{["Endocrinología","Cardiología","Nutrición","Ginecología","Psiquiatría","Dermatología","Nefrología","Neurología"].map(o=><option key={o}>{o}</option>)}</select></div>
        <div><div style={flbl}>Prioridad <span style={{color:P.red}}>*</span></div><select value={icPriority} onChange={e=>setIcPriority(e.target.value)} style={selSty}>{["Preferente (2–4 semanas)","Urgente (48–72 h)","Rutina (4–8 semanas)"].map(o=><option key={o}>{o}</option>)}</select></div>
        <div><div style={flbl}>Tipo de interconsulta <span style={{color:P.red}}>*</span></div><select value={icType} onChange={e=>setIcType(e.target.value)} style={selSty}>{["Primera vez","Subsecuente","Segunda opinión"].map(o=><option key={o}>{o}</option>)}</select></div>
       </div>
       <div style={{marginTop:16}}><div style={flbl}>Médico o institución (opcional)</div><div style={{position:"relative"}}><input placeholder="Buscar por nombre o institución..." style={{...selSty,paddingLeft:34}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" style={{position:"absolute",left:11,top:12}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div></div>
       <div style={{marginTop:16}}><div style={flbl}>Motivo de interconsulta <span style={{color:P.red}}>*</span></div><textarea value={icMotivo} onChange={e=>setIcMotivo(e.target.value.slice(0,500))} placeholder="Describe el motivo de la valoración solicitada..." style={{...selSty,minHeight:84,resize:"vertical"}}/><div style={{textAlign:"right",fontSize:11,color:P.muted}}>{icMotivo.length}/500</div></div>
       <div style={{marginTop:12}}><div style={flbl}>Resumen clínico <span style={{color:P.red}}>*</span></div>
        <div style={{border:`1px solid ${LINE}`,borderRadius:9,overflow:"hidden"}}><div style={{display:"flex",gap:2,padding:"8px 10px",borderBottom:`1px solid ${LINE}`,color:P.muted}}>{["B","I","U"].map(b=><span key={b} style={{width:26,height:26,display:"grid",placeItems:"center",fontWeight:800,fontStyle:b==="I"?"italic":"normal",textDecoration:b==="U"?"underline":"none",cursor:"pointer",fontSize:13}}>{b}</span>)}<span style={{width:26,height:26,display:"grid",placeItems:"center",cursor:"pointer"}}>☰</span><span style={{width:26,height:26,display:"grid",placeItems:"center",cursor:"pointer"}}>⁝☰</span><span style={{width:26,height:26,display:"grid",placeItems:"center",cursor:"pointer"}}>🔗</span></div><textarea value={icResumen} onChange={e=>setIcResumen(e.target.value.slice(0,1000))} placeholder="Resumen del cuadro clínico, tratamiento actual y evolución..." style={{width:"100%",border:0,padding:"12px 14px",fontSize:13.5,fontFamily:UI,minHeight:110,resize:"vertical",color:P.ink,lineHeight:1.5}}/></div>
        <div style={{textAlign:"right",fontSize:11,color:P.muted}}>{icResumen.length}/1000</div>
       </div>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginTop:12}}>
        <div><div style={flbl}>Diagnósticos relacionados</div><div style={{position:"relative"}}><input placeholder="Buscar y agregar diagnósticos..." style={{...selSty,paddingLeft:34}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" style={{position:"absolute",left:11,top:12}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div><div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>{ctxProblems.map((p,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:7,background:"#EEEBFD",color:P.purple,borderRadius:8,padding:"6px 10px",fontSize:12.5,fontWeight:600}}><b style={{fontWeight:700}}>{p.code}</b>{p.description}<span style={{cursor:"pointer"}}>×</span></span>)}</div></div>
        <div><div style={flbl}>Estudios anexos</div><div style={{border:`1.6px dashed ${LINE}`,borderRadius:11,padding:"20px",textAlign:"center",color:P.muted}}><div style={{fontSize:22}}>⤒</div><div style={{fontSize:12.5,marginTop:4}}>Arrastra archivos aquí o <span style={{color:P.blue,fontWeight:600}}>haz clic para seleccionar</span></div><div style={{fontSize:11,marginTop:2}}>PDF, imágenes, laboratorios (máx. 10 MB c/u)</div></div>
         {[["Laboratorios_17092026.pdf","245 KB"],["USG_abdomen.pdf","1.2 MB"]].map(([f,s])=><div key={f} style={{display:"flex",alignItems:"center",gap:9,marginTop:8,padding:"9px 11px",border:`1px solid ${LINE}`,borderRadius:9,fontSize:12.5}}><span style={{color:P.red}}>▤</span><span style={{flex:1}}>{f}</span><span style={{color:P.muted,fontSize:11}}>{s}</span><span style={{color:P.muted,cursor:"pointer"}}>×</span></div>)}
        </div>
       </div>
       {icMsg&&<div style={{marginTop:14,padding:"10px 13px",borderRadius:10,background:icMsg.includes("✓")?"#E6F6EE":"#FDF4E6",border:`1px solid ${icMsg.includes("✓")?"#BFE6CF":"#F2E1C0"}`,fontSize:13,color:icMsg.includes("✓")?"#166534":"#7A5A16"}}>{icMsg}</div>}
      </div>
     </div>
     {/* Columna derecha: contexto real del paciente */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:6}}>Información relevante del paciente</div>
       {infoRow(P.red,"M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z","Alergias",cAllergies)}
       {infoRow(P.green,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z","Medicamentos actuales",cMeds)}
       {infoRow(P.blue,clip,"Problemas activos",cProblems)}
       {infoRow(P.amber,"M9 3h6l1 4H8zM7 7h10l1 13H6z","Últimos laboratorios",cHba1c)}
       {infoRow(P.red,"M12 21C12 21 4 13.5 4 8.5A4 4 0 0112 6a4 4 0 018 2.5C20 13.5 12 21 12 21z","Signos vitales (última)",cVit)}
      </div>
      <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:10}}>Antecedentes relevantes</div>{[["#F0455E","Diagnóstico de DM2 en 2023"],["#E5983B","Resistencia a la insulina"],["#6C5CF6","Obesidad (IMC 30.2 kg/m²)"],["#1769E0","Hipertensión arterial controlada"],["#16A66A","Sin datos de nefropatía, retinopatía ni neuropatía"]].map(([c,t],i)=><div key={i} style={{display:"flex",gap:9,alignItems:"flex-start",padding:"6px 0",fontSize:12.5}}><span style={{width:7,height:7,borderRadius:"50%",background:c,flex:"0 0 auto",marginTop:5}}/>{t}</div>)}<button style={{marginTop:10,width:"100%",border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>✎ Editar antecedentes</button></div>
      <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:8}}>Plantillas rápidas</div>{[["Endocrinología – DM2","Endocrinología","Valoración y manejo integral de diabetes mellitus tipo 2 con resistencia a la insulina."],["Cardiología – HTA","Cardiología","Valoración de hipertensión arterial y riesgo cardiovascular."],["Ginecología – SOP","Ginecología","Valoración por síndrome de ovario poliquístico."],["Nutrición – Obesidad","Nutrición","Valoración nutricional y plan de manejo de obesidad."],["Psiquiatría – Ansiedad/Depresión","Psiquiatría","Valoración por síntomas ansioso-depresivos."],["Dermatología – Acné","Dermatología","Valoración dermatológica por acné."]].map(([l,sp,mo],i)=><div key={i} onClick={()=>{setIcSpecialty(sp as string);setIcMotivo(mo as string);}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<5?`1px solid #F2F4F9`:"0",fontSize:13,color:P.ink,fontWeight:500,cursor:"pointer"}}><span style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:P.blue}}>▤</span>{l}</span><span style={{color:P.muted}}>›</span></div>)}</div>
      <div style={{...card2,padding:16,background:"#F7F6FE",borderColor:"#E2DEFB"}}><div style={{display:"flex",gap:10}}><span style={{color:P.purple}}>💡</span><div><div style={{fontWeight:700,fontSize:13}}>Tip</div><div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Incluye laboratorios, estudios de imagen y un resumen clínico claro para una mejor y más rápida atención.</div></div></div></div>
     </div>
    </div>
   </div>;
  })() : view==="seguimiento" ? (()=>{
   // ===== MÓDULO SEGUIMIENTO (S-SEGUIMIENTO) — snapshot compuesto cableado a GET /patients/:id/follow-up =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const clip="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z";
   const useReal=!!fuSnap;
   const counts=fuSnap?fuSnap.counts:{problems:3,medications:2,allergies:1};
   const fmtDue=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?iso:d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const spark=(vals:number[],color:string)=>{if(!vals.length)return null;const w=140,h=40,pad=4;const mn=Math.min(...vals),mx=Math.max(...vals),rng=(mx-mn)||1;const step=vals.length>1?(w-pad*2)/(vals.length-1):0;
    const pt=(v:number,i:number)=>[pad+i*step,h-pad-((v-mn)/rng)*(h-pad*2)];
    const d=vals.map((v,i)=>{const[x,y]=pt(v,i);return `${i===0?"M":"L"}${x.toFixed(1)} ${y.toFixed(1)}`;}).join(" ");
    return <svg width={w} height={h} style={{display:"block"}} aria-hidden><path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>{vals.map((v,i)=>{const[x,y]=pt(v,i);return <circle key={i} cx={x} cy={y} r={2.5} fill="#fff" stroke={color} strokeWidth={1.5}/>;})}</svg>;};
   // Tendencia de signos vitales (real o representativa)
   const sBP=useReal&&fuSnap!.vitalsTrend.series.BP.length?fuSnap!.vitalsTrend.series.BP:[120,122,123,122,124,124];
   const sHR=useReal&&fuSnap!.vitalsTrend.series.HR.length?fuSnap!.vitalsTrend.series.HR:[74,75,75,76,76,76];
   const sWT=useReal&&fuSnap!.vitalsTrend.series.WEIGHT.length?fuSnap!.vitalsTrend.series.WEIGHT:[69.4,68.8,68.1,67.7,67.4,67.3];
   const sIMC=useReal&&fuSnap!.vitalsTrend.series.IMC.length?fuSnap!.vitalsTrend.series.IMC:[31.2,30.9,30.6,30.5,30.4,30.3];
   const av=fuSnap?fuSnap.vitalsTrend.avg:{ta:"124/82",bp:124,hr:76,weight:67.3,imc:30.3};
   const trend=(title:string,unit:string,vals:number[],val:string,foot:string,c:string)=><div style={{border:`1px solid ${LINE}`,borderRadius:12,padding:13}}><div style={{fontSize:12.5,fontWeight:700,lineHeight:1.1}}>{title}<div style={{fontSize:10.5,color:P.muted,fontWeight:500}}>{unit}</div></div><div style={{marginTop:8}}>{spark(vals,c)}</div><div style={{fontSize:21,fontWeight:800,marginTop:6}}>{val}</div><div style={{fontSize:11.5,color:P.muted}}>{foot}</div></div>;
   // Indicadores clave
   const ind=fuSnap?fuSnap.indicators:null;
   const iv=(d:{first:number;last:number}|null,rf:[number,number])=>d?[d.first,d.last]:rf;
   const[a1f,a1l]=iv(ind?.hba1c??null,[8.1,7.2]);const[ldlf,ldll]=iv(ind?.ldl??null,[142,110]);const[wf,wl]=iv(ind?.weight??null,[69.4,67.3]);const[if_,il]=iv(ind?.imc??null,[31.2,30.3]);
   const kpiRow=(ico:string,c:string,l:string,f:string,x:string,down:boolean)=><div style={{display:"flex",alignItems:"center",gap:11,padding:"11px 0",borderBottom:`1px solid #F2F4F9`}}><span style={{width:30,height:30,borderRadius:8,background:c+"22",color:c,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={ico}/></svg></span><div style={{width:52,fontSize:13,fontWeight:700}}>{l}</div><div style={{flex:1,height:6,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:"62%",background:c,borderRadius:6}}/></div><div style={{fontSize:12.5,fontWeight:600,whiteSpace:"nowrap"}}>{f} <span style={{color:P.muted}}>›</span> {x}</div><span style={{color:down?"#16A66A":"#C9364A",fontWeight:800}}>{down?"↓":"↑"}</span></div>;
   // Tareas de seguimiento
   const REP_TASKS=[{task:"Solicitar HbA1c en 3 meses",dueAt:"2026-10-15",done:false},{task:"Reforzar plan nutricional",dueAt:"2026-09-17",done:true},{task:"Valorar ajuste de metformina",dueAt:"2026-10-15",done:false},{task:"Revisión de TA en domicilio",dueAt:"2026-10-01",done:false},{task:"Programar evaluación de retina",dueAt:"2026-11-15",done:false}];
   const tasks=(useReal&&fuSnap!.tasks.length)?fuSnap!.tasks:REP_TASKS;
   const badge=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={["Control rutinario"]:["#E6F6EE","#16A66A"],Seguimiento:["#EEEBFD","#6C5CF6"],Resultados:["#E7EEFB","#1769E0"],Inicio:["#EEF1F7","#6B7191"]};const[b,f]=m[k]??m.Seguimiento!;return{background:b,color:f,borderRadius:16,padding:"3px 11px",fontSize:11.5,fontWeight:700,whiteSpace:"nowrap"};};
   const HIST=[["17 sep 2026","10:24","Control de DM2","Refiere mejoría en glucemias. Se ajusta metformina a 850 mg c/12 h. Se solicita HbA1c en 3 meses.","Control rutinario",true],["15 ago 2026","09:10","Seguimiento – Hipertensión","TA en metas. Se mantiene losartán 50 mg c/24 h.","Seguimiento",false],["20 jun 2026","11:40","Resultados de laboratorio","HbA1c 8.1%. Se refuerza plan nutricional y actividad física.","Resultados",false],["18 may 2026","10:15","Seguimiento – Obesidad","Peso -2.1 kg. Buena adherencia al plan.","Seguimiento",false],["10 mar 2026","09:30","Inicio de tratamiento","Diagnóstico de DM2. Se inicia metformina 500 mg c/12 h.","Inicio",false]];
   const chipCard=(c:string,d:string,n:number,l:string)=><div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}><span style={{width:32,height:32,borderRadius:9,background:c+"22",color:c,display:"grid",placeItems:"center"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={d}/></svg></span><div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{n}</div><div style={{fontSize:11,color:P.muted}}>{l}</div></div></div>;
   const SEG_TABS:[typeof segTab,string][]=[["seguimiento","Seguimiento"],["evolucion","Evolución"],["graficas","Gráficas"],["metas","Metas"],["recordatorios","Recordatorios"],["alertas","Alertas"]];
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={clip}/><path d="M9 13l2 2 4-4"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Seguimiento</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Da seguimiento continuo a la evolución clínica de tus pacientes.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 16px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setView("consulta");setCTab("seguimiento");}}>+ Nuevo seguimiento</button>
      <button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>▭ Registro rápido</button>
      <button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>▨ Gráficas</button>
      <button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Más opciones ▾</button>
     </div>
    </div>
    <div style={{...card2,marginTop:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"center",gap:13,minWidth:0}}><span style={{width:48,height:48,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:15,fontWeight:700,flex:"0 0 auto"}}>{initials(patientName||"Ana López García")}</span><div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:16}}>{patientName||"Ana López García"}</div><div style={{fontSize:12.5,color:P.muted}}>Femenino, 34 años&nbsp;&nbsp;|&nbsp;&nbsp;Expediente: LC260917-0042&nbsp;&nbsp;|&nbsp;&nbsp;CURP: LOGA900101MCHPRN09</div></div></div>
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>{chipCard(P.blue,clip,counts.problems,"Problemas activos")}{chipCard(P.green,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z",counts.medications,"Medicamentos")}{chipCard(P.red,"M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",counts.allergies,counts.allergies===1?"Alergia":"Alergias")}<button onClick={()=>setView("exp")} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver expediente →</button></div>
    </div>
    <div style={{...card2,marginTop:16,padding:"0 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
     <div style={{display:"flex",gap:4,overflowX:"auto"}}>{SEG_TABS.map(([k,l])=><button key={k} onClick={()=>setSegTab(k)} style={{padding:"14px 12px",fontSize:13.5,fontWeight:segTab===k?700:500,color:segTab===k?P.purple:P.muted,borderBottom:segTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>{l}</button>)}</div>
     <select style={{border:`1px solid ${LINE}`,borderRadius:9,padding:"7px 10px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink,margin:"8px 0"}} defaultValue="Últimos 12 meses"><option>Últimos 12 meses</option></select>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:16,marginTop:16,alignItems:"start"}} className="mos-seg">
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:18}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}><div style={{fontSize:16.5,fontWeight:800}}>Historia de seguimiento</div><div style={{display:"flex",gap:8}}><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"8px 12px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>⚟ Filtrar</button><div style={{position:"relative"}}><input placeholder="Buscar en seguimientos..." style={{border:`1px solid ${LINE}`,borderRadius:9,padding:"8px 11px 8px 30px",fontSize:12.5,fontFamily:UI,width:200}}/><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" style={{position:"absolute",left:9,top:9}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div></div></div>
       <div style={{marginTop:16}}>{HIST.map(([d,t,title,note,bdg,done],i,arr)=><div key={i} style={{display:"flex",gap:13}}><div style={{display:"flex",flexDirection:"column",alignItems:"center"}}><span style={{width:20,height:20,borderRadius:"50%",border:done?"0":`2px solid ${P.blue}`,background:done?"#16A66A":P.white,color:"#fff",display:"grid",placeItems:"center",fontSize:11,flex:"0 0 auto"}}>{done?"✓":""}</span>{i<arr.length-1&&<span style={{width:2,flex:1,background:"#E7E9F2",minHeight:40}}/>}</div><div style={{flex:1,paddingBottom:18,minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}><div><span style={{fontSize:13.5,fontWeight:700}}>{d}</span> <span style={{fontSize:11.5,color:P.muted}}>{t}</span><div style={{fontSize:14,fontWeight:700,marginTop:2}}>{title as string}</div><div style={{fontSize:12,color:P.muted}}>Dr. Luis Godinez</div></div><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={badge(bdg as string)}>{bdg as string}</span><span style={{width:30,height:30,border:`1px solid ${LINE}`,borderRadius:8,display:"grid",placeItems:"center",color:P.muted,cursor:"pointer"}}>✎</span><span style={{color:P.muted,cursor:"pointer"}}>›</span></div></div><div style={{fontSize:12.5,color:"#4B5168",marginTop:5,lineHeight:1.5}}>{note as string}</div></div></div>)}</div>
       <button style={{width:"100%",border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI,color:P.muted}}>⌄ Cargar más seguimientos</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.15fr 1fr",gap:16,alignItems:"start"}} className="mos-seg2">
       <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:15.5,fontWeight:800}}>Tendencia de signos vitales</div><select style={{border:`1px solid ${LINE}`,borderRadius:9,padding:"6px 9px",fontSize:12,background:P.white,fontFamily:UI}} defaultValue="Últimos 6 meses"><option>Últimos 6 meses</option></select></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{trend("Presión arterial","(mmHg)",sBP,av.ta??"—","Promedio",P.blue)}{trend("Frecuencia cardíaca","(lpm)",sHR,String(av.hr??"—"),"Promedio",P.red)}{trend("Peso","(kg)",sWT,String(av.weight??"—"),`Último: ${wl<wf?"-":"+"}${Math.abs(Math.round((wl-wf)*10)/10)} kg`,P.green)}{trend("IMC","(kg/m²)",sIMC,String(av.imc??"—"),`Último: ${il<if_?"-":"+"}${Math.abs(Math.round((il-if_)*10)/10)}`,P.purple)}</div></div>
       <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{fontSize:15.5,fontWeight:800}}>Indicadores clave</div><select style={{border:`1px solid ${LINE}`,borderRadius:9,padding:"6px 9px",fontSize:12,background:P.white,fontFamily:UI}} defaultValue="Últimos 12 meses"><option>Últimos 12 meses</option></select></div>{kpiRow("M9 3h6l1 4H8zM7 7h10l1 13H6z",P.red,"HbA1c",`${a1f}%`,`${a1l}%`,a1l<a1f)}{kpiRow("M12 3v18M3 12h18",P.amber,"LDL",String(ldlf),String(ldll),ldll<ldlf)}{kpiRow("M20 7h-9M14 17H5",P.green,"Peso",String(wf),`${wl} kg`,wl<wf)}{kpiRow("M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v8",P.blue,"IMC",String(if_),String(il),il<if_)}</div>
      </div>
     </div>
     {/* Columna derecha */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8}}>📅 Próxima cita de seguimiento</div><span style={{fontSize:12.5,color:P.blue,cursor:"pointer"}}>Cambiar</span></div>
       <div style={{display:"flex",gap:12,alignItems:"center"}}><span style={{width:46,height:46,borderRadius:11,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 2v4M16 2v4M4 8h16M5 6h14v14H5z"/></svg></span><div style={{flex:1}}><div style={{fontSize:16,fontWeight:800}}>15 oct 2026</div><div style={{fontSize:12,color:P.muted}}>10:00 - 10:30 (30 min)</div></div><span style={{background:"#E6F6EE",color:"#16A66A",borderRadius:16,padding:"3px 11px",fontSize:11.5,fontWeight:700}}>Confirmada</span></div>
       <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8,fontSize:12.5}}>{[["Motivo","Control de DM2 e hipertensión"],["Tipo","Consulta de seguimiento"],["Recordatorio","1 día antes (correo o WhatsApp)"]].map(([k,v])=><div key={k} style={{display:"flex",gap:8}}><span style={{color:P.muted,minWidth:80}}>{k}</span><span style={{fontWeight:600}}>{v}</span></div>)}</div>
       <div style={{display:"flex",gap:8,marginTop:14}}><button style={{flex:1,border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>↻ Reprogramar</button><button style={{flex:1,border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:9,padding:"9px",fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>➤ Enviar recordatorio</button></div>
      </div>
      <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8}}>✔ Tareas de seguimiento</div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:8,padding:"5px 11px",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:UI}}>+ Agregar</button></div>{tasks.map((t,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<tasks.length-1?`1px solid #F2F4F9`:"0"}}><span style={{width:17,height:17,borderRadius:5,border:t.done?"0":"1.7px solid #C7CCE0",background:t.done?P.purple:"transparent",color:"#fff",display:"grid",placeItems:"center",fontSize:10,flex:"0 0 auto"}}>{t.done?"✓":""}</span><span style={{flex:1,fontSize:13,color:t.done?P.muted:P.ink,textDecoration:t.done?"line-through":"none"}}>{t.task}</span><span style={{fontSize:11.5,color:P.muted,textDecoration:t.done?"line-through":"none",whiteSpace:"nowrap"}}>📅 {fmtDue(t.dueAt)}</span></div>)}</div>
      <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8}}>▤ Notas del seguimiento</div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:8,padding:"5px 11px",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:UI}}>+ Agregar</button></div>{[["17 sep 2026, 10:24","Paciente motivada, buena adherencia. Se refuerza seguimiento en 4 semanas."],["15 ago 2026, 09:10","TA en metas. Continúa tratamiento sin cambios."]].map(([d,n],i)=><div key={i} style={{padding:"9px 0",borderBottom:i<1?`1px solid #F2F4F9`:"0"}}><div style={{fontSize:11.5,color:P.muted,display:"flex",justifyContent:"space-between"}}>{d}<span style={{cursor:"pointer"}}>⋯</span></div><div style={{fontSize:12.5,lineHeight:1.5,marginTop:3}}>{n}</div><div style={{fontSize:11,color:P.muted,textAlign:"right",marginTop:3}}>Dr. Luis Godinez</div></div>)}</div>
     </div>
    </div>
   </div>;
  })() : view==="facturacion" ? (()=>{
   // ===== MÓDULO FACTURACIÓN (S-FACTURACION) — registro clínica-wide cableado a GET /claims; emisión -> POST /claims =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const money=(n:number)=>"$"+n.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});
   const fmtD=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const useReal=!!claimsReg&&claimsReg.total>0;
   type FRow={folio:string;date:string;patient:string;rfc:string;concept:string;total:number;estado:string};
   const REP_CONCEPTS=["Consulta médica","Consulta + estudios","Consulta de control","Procedimiento","Consulta médica","Paquete de control","Certificado médico","Consulta + receta","Control crónico","Procedimiento"];
   const REP:FRow[]=[
    {folio:"F-000245",date:"17 sep 2026",patient:"Ana López García",rfc:"LOGA900101...",concept:"Consulta médica",total:500,estado:"Pagada"},
    {folio:"F-000244",date:"16 sep 2026",patient:"Mateo Ramírez",rfc:"RAMA850101...",concept:"Consulta + estudios",total:1200,estado:"Pagada"},
    {folio:"F-000243",date:"15 sep 2026",patient:"Carlos Mendoza",rfc:"MECG781231...",concept:"Consulta de control",total:500,estado:"Pendiente"},
    {folio:"F-000242",date:"14 sep 2026",patient:"María Torres",rfc:"TOMM920202...",concept:"Procedimiento",total:1800,estado:"Pagada"},
    {folio:"F-000241",date:"12 sep 2026",patient:"Diego Salas",rfc:"SADD890512...",concept:"Consulta médica",total:500,estado:"Pagada"},
    {folio:"F-000240",date:"10 sep 2026",patient:"Laura Fernández",rfc:"FEGL880321...",concept:"Paquete de control",total:1000,estado:"Pendiente"},
    {folio:"F-000239",date:"08 sep 2026",patient:"José Ramírez",rfc:"RAJJ750909...",concept:"Certificado médico",total:350,estado:"Pagada"},
    {folio:"F-000238",date:"05 sep 2026",patient:"Daniel Cruz",rfc:"CUDA900707...",concept:"Consulta + receta",total:500,estado:"Pagada"},
    {folio:"F-000237",date:"01 sep 2026",patient:"Sofía Hernández",rfc:"HERS860420...",concept:"Control crónico",total:500,estado:"Pagada"},
    {folio:"F-000236",date:"28 ago 2026",patient:"Ricardo Villegas",rfc:"VIRR801015...",concept:"Procedimiento",total:1500,estado:"Pendiente"},
   ];
   const rows:FRow[]=useReal?claimsReg!.items.slice(0,10).map((it,i)=>({folio:it.folio,date:fmtD(it.recordedAt),patient:it.patientName,rfc:"—",concept:REP_CONCEPTS[i%REP_CONCEPTS.length]!,total:it.amount,estado:it.statusLabel})):REP;
   const kIngresos=useReal?claimsReg!.incomeThisMonth:24680;
   const kEmitidas=useReal?claimsReg!.issuedCount:48;
   const kPend=useReal?claimsReg!.pendingCount:6,kPendAmt=useReal?claimsReg!.pendingAmount:3950;
   const kCanc=useReal?claimsReg!.cancellations:0;
   const nfTotal=nfConcepts.reduce((s,c)=>s+c.qty*c.price,0);
   const setConcept=(i:number,patch:Partial<{desc:string;qty:number;price:number}>)=>setNfConcepts(nfConcepts.map((c,j)=>j===i?{...c,...patch}:c));
   const billTo=nfPatientId||patientId;
   const emit=async()=>{
    if(!billTo){setNfMsg("Selecciona un paciente para emitir la factura.");return;}
    if(nfTotal<=0){setNfMsg("Agrega al menos un concepto con importe.");return;}
    setNfBusy(true);setNfMsg("");
    try{const r=await apiRequest("/api/v1/claims",{method:"POST",body:{claimId:crypto.randomUUID(),patientId:billTo,amount:String(nfTotal),currency:"MXN",occurredAt:new Date().toISOString()}});
     if(r.status===201||r.status===200){setNfMsg("Factura emitida ✓");const g=await apiRequest("/api/v1/claims",{method:"GET"});if(g.status===200)setClaimsReg(g.body as unknown as ClaimsRegistry);}
     else setNfMsg("No se pudo emitir (estado "+r.status+").");
    }catch{setNfMsg("Error al emitir la factura.");}finally{setNfBusy(false);}
   };
   const estSty=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={Pagada:["#E6F6EE","#16A66A"],Pendiente:["#FBF0DC","#B7791F"],Cancelada:["#EEF1F7","#6B7191"],Rechazada:["#FDECEE","#C9364A"]};const[b,f]=m[k]??m.Pendiente!;return{background:b,color:f,borderRadius:16,padding:"3px 12px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"};};
   const kico=(bg:string,fg:string,d:string)=><span style={{width:48,height:48,borderRadius:"50%",background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
   const tdc:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,whiteSpace:"nowrap"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const stepN=(n:number)=><span style={{width:20,height:20,borderRadius:"50%",background:P.purple,color:"#fff",display:"grid",placeItems:"center",fontSize:11,fontWeight:700,flex:"0 0 auto"}}>{n}</span>;
   const FAC_TABS:[typeof facTab,string][]=[["facturas","Facturas"],["recibos","Recibos de pago"],["notas","Notas de crédito"],["cotizaciones","Cotizaciones"]];
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1zM9 12h6M9 16h4"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Facturación</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Emite facturas, controla pagos y administra tus ingresos.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>⚙ Configuración fiscal</button><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>◔ Reportes</button><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setNfConcepts([{desc:"Consulta médica",qty:1,price:500}]);setNfPatientId("");setNfMsg("");}}>+ Nueva factura</button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#E6F6EE","#16A66A","M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6")}<div><div style={{fontSize:24,fontWeight:800}}>{money(kIngresos)}</div><div style={{fontSize:11.5,color:P.muted}}>Ingresos este mes</div><div style={{fontSize:11.5,color:"#16A66A",fontWeight:700,marginTop:2}}>↑ +18% vs. mes anterior</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#E7EEFB",P.blue,"M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z")}<div><div style={{fontSize:24,fontWeight:800}}>{kEmitidas}</div><div style={{fontSize:11.5,color:P.muted}}>Facturas emitidas</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#FBF0DC",P.amber,"M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{kPend}</div><div style={{fontSize:11.5,color:P.muted}}>Pendientes de pago</div><div style={{fontSize:11.5,color:P.amber,fontWeight:700,marginTop:2}}>{money(kPendAmt)}</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#FDECEE",P.red,"M18 6L6 18M6 6l12 12")}<div><div style={{fontSize:24,fontWeight:800}}>{kCanc}</div><div style={{fontSize:11.5,color:P.muted}}>Cancelaciones</div></div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 380px",gap:16,marginTop:16,alignItems:"start"}} className="mos-fac">
     {/* Columna izquierda: tabla + gráficas */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px 0",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",gap:4}}>{FAC_TABS.map(([k,l])=><button key={k} onClick={()=>setFacTab(k)} style={{padding:"10px 12px",fontSize:13.5,fontWeight:facTab===k?700:500,color:facTab===k?P.purple:P.muted,borderBottom:facTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>{l}</button>)}</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><select style={{...selSty,width:"auto",padding:"7px 10px"}} defaultValue="Más filtros"><option>Más filtros</option></select><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"7px 12px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>↧ Exportar</button></div>
       </div>
       <div style={{borderTop:`1px solid ${LINE}`,display:"flex",gap:10,padding:"12px 16px",flexWrap:"wrap"}}><div style={{position:"relative",flex:1,minWidth:180}}><input placeholder="Buscar por folio, paciente, RFC..." style={{...selSty,paddingLeft:32}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" style={{position:"absolute",left:10,top:11}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div><select style={{...selSty,width:"auto"}} defaultValue="Todas las fechas"><option>📅 Todas las fechas</option></select><select style={{...selSty,width:"auto"}} defaultValue="Todos los estados"><option>Todos los estados</option></select></div>
       <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><th style={{...th,width:30}}></th><th style={th}>Folio</th><th style={th}>Fecha</th><th style={th}>Paciente</th><th style={th}>RFC</th><th style={th}>Concepto</th><th style={{...th,textAlign:"right"}}>Total</th><th style={th}>Estado</th><th style={{...th,textAlign:"right"}}>Acc.</th></tr></thead>
        <tbody>{rows.map((r,i)=><tr key={i}><td style={tdc}><span style={{width:15,height:15,borderRadius:4,border:"1.6px solid #C7CCE0",display:"inline-block"}}/></td><td style={{...tdc,fontWeight:700,color:P.ink}}>{r.folio}</td><td style={{...tdc,color:P.muted}}>{r.date}</td><td style={tdc}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:26,height:26,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>{initials(r.patient)}</span><span style={{fontWeight:600}}>{r.patient}</span></div></td><td style={{...tdc,color:P.muted,fontFamily:"monospace",fontSize:11.5}}>{r.rfc}</td><td style={tdc}>{r.concept}</td><td style={{...tdc,textAlign:"right",fontWeight:700}}>{money(r.total)}</td><td style={tdc}><span style={estSty(r.estado)}>{r.estado}</span></td><td style={{...tdc,textAlign:"right",color:P.muted,fontWeight:700}}>⋯</td></tr>)}</tbody>
       </table></div>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",fontSize:13,color:P.muted,flexWrap:"wrap",gap:10}}><span>Mostrando 1–{rows.length} de {kEmitidas} facturas</span><div style={{display:"flex",gap:5}}>{["‹","1","2","3","4","5","›"].map((p,i)=><span key={i} style={{minWidth:32,height:32,border:`1px solid ${LINE}`,background:p==="1"?P.purple:P.white,color:p==="1"?"#fff":P.ink,borderRadius:8,display:"grid",placeItems:"center",fontSize:13,cursor:"pointer"}}>{p}</span>)}</div><span style={{border:`1px solid ${LINE}`,borderRadius:8,padding:"6px 11px",fontSize:12}}>10 ▾</span></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1.1fr 1fr",gap:14,alignItems:"start"}} className="mos-fac2">
       <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:14.5,fontWeight:800}}>Métodos de pago</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>⚙ Configurar</span></div>{[["Efectivo",true],["Tarjeta de crédito/débito",true],["Transferencia bancaria",true],["Mercado Pago / CoDi",false]].map(([l,on],i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<3?`1px solid #F2F4F9`:"0"}}><span style={{width:30,height:30,borderRadius:8,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h18v10H3zM3 11h18"/></svg></span><span style={{flex:1,fontSize:13,fontWeight:500}}>{l as string}</span><span style={{width:36,height:20,borderRadius:12,background:on?"#16A66A":"#D5D9E6",position:"relative",cursor:"pointer"}}><span style={{position:"absolute",top:2,left:on?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .15s"}}/></span></div>)}</div>
       <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:14.5,fontWeight:800}}>Ingresos mensuales</div><select style={{...selSty,width:"auto",padding:"5px 8px",fontSize:12}} defaultValue="Este año"><option>Este año</option></select></div><div style={{display:"flex",alignItems:"flex-end",gap:5,height:120,position:"relative"}}>{[[ "Ene",8],["Feb",10],["Mar",13],["Abr",11],["May",15],["Jun",14],["Jul",16],["Ago",18],["Sep",30],["Oct",13],["Nov",12],["Dic",11]].map(([m,h],i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{position:"relative",width:"100%",display:"flex",justifyContent:"center"}}>{(m as string)==="Sep"&&<span style={{position:"absolute",bottom:"100%",marginBottom:4,background:P.purple,color:"#fff",fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 6px",whiteSpace:"nowrap"}}>$24,680</span>}<div style={{width:"70%",height:(h as number)*3.6,background:(m as string)==="Sep"?P.purple:"#C9D0E8",borderRadius:"4px 4px 0 0"}}/></div><span style={{fontSize:9.5,color:P.muted}}>{m as string}</span></div>)}</div></div>
       <div style={{...card2,padding:16}}><div style={{fontSize:14.5,fontWeight:800,marginBottom:10}}>Top servicios facturados</div>{[["Consulta médica",42,42],["Procedimientos",18,18],["Vacunas",15,15],["Certificados",12,12],["Estudios",8,8],["Otros",5,5]].map(([l,n,pc],i)=><div key={i} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span>{l as string}</span><span style={{color:P.muted}}><b style={{color:P.ink}}>{n as number}</b> {pc as number}%</span></div><div style={{height:6,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${(pc as number)*2}%`,maxWidth:"100%",background:P.purple,borderRadius:6}}/></div></div>)}</div>
      </div>
     </div>
     {/* Columna derecha: Nueva factura */}
     <div style={{...card2,padding:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontSize:17,fontWeight:800}}>Nueva factura</div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"7px 12px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>⊟ Usar plantilla</button></div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>{stepN(1)}<span style={{fontSize:13.5,fontWeight:700}}>Paciente</span></div>
      {(()=>{const bill=nfPatientId||patientId;const bp=(patientList??[]).find(p=>p.patientId===bill);const bname=bp?bp.name:(nfPatientId?"":patientName);return <>
       <select value={nfPatientId||(patientId&&bp?patientId:"")} onChange={e=>setNfPatientId(e.target.value)} style={{...selSty,marginBottom:8}}><option value="">Selecciona un paciente…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select>
       {bname?<div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:`1px solid ${LINE}`,borderRadius:10,marginBottom:16}}><span style={{width:34,height:34,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:12,fontWeight:700}}>{initials(bname)}</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700}}>{bname}</div><div style={{fontSize:11,color:P.muted,fontFamily:"monospace"}}>{bp?.curp?`CURP: ${bp.curp}`:"Paciente del tenant"}</div></div></div>:<div style={{fontSize:12,color:P.muted,marginBottom:16}}>Elige el paciente al que se emitirá la factura.</div>}
      </>;})()}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:8}}>{stepN(2)}<span style={{fontSize:13.5,fontWeight:700}}>Conceptos</span></div><button onClick={()=>setNfConcepts([...nfConcepts,{desc:"Nuevo concepto",qty:1,price:0}])} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:8,padding:"6px 11px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:UI}}>+ Agregar concepto</button></div>
      <div style={{fontSize:11,color:"#9AA0BC",display:"grid",gridTemplateColumns:"1fr 46px 62px 62px 20px",gap:6,padding:"0 2px 4px",fontWeight:600}}><span>Descripción</span><span>Cant.</span><span style={{textAlign:"right"}}>Precio</span><span style={{textAlign:"right"}}>Importe</span><span/></div>
      {nfConcepts.map((c,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 46px 62px 62px 20px",gap:6,alignItems:"center",padding:"4px 0"}}><input value={c.desc} onChange={e=>setConcept(i,{desc:e.target.value})} style={{...selSty,padding:"7px 8px",fontSize:12.5}}/><input value={c.qty} onChange={e=>setConcept(i,{qty:Number(e.target.value)||0})} style={{...selSty,padding:"7px 4px",fontSize:12.5,textAlign:"center"}}/><input value={c.price} onChange={e=>setConcept(i,{price:Number(e.target.value)||0})} style={{...selSty,padding:"7px 6px",fontSize:12.5,textAlign:"right"}}/><span style={{fontSize:12.5,fontWeight:600,textAlign:"right"}}>{money(c.qty*c.price)}</span><span onClick={()=>setNfConcepts(nfConcepts.filter((_,j)=>j!==i))} style={{color:P.red,cursor:"pointer",textAlign:"center"}}>🗑</span></div>)}
      <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${LINE}`,display:"flex",flexDirection:"column",gap:6,fontSize:13}}>
       <div style={{display:"flex",justifyContent:"space-between",color:P.muted}}><span>Subtotal</span><span style={{fontWeight:600,color:P.ink}}>{money(nfTotal)}</span></div>
       <div style={{display:"flex",justifyContent:"space-between",color:P.muted}}><span>IVA (0%)</span><span style={{fontWeight:600,color:P.ink}}>{money(0)}</span></div>
       <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800}}><span>Total</span><span>{money(nfTotal)}</span></div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,margin:"16px 0 8px"}}>{stepN(3)}<span style={{fontSize:13.5,fontWeight:700}}>Forma de pago</span></div>
      <div style={{display:"flex",gap:8}}><select style={{...selSty,flex:1}} defaultValue="Transferencia bancaria"><option>Transferencia bancaria</option><option>Efectivo</option><option>Tarjeta</option></select><input type="date" defaultValue="2026-09-17" style={{...selSty,width:"auto"}}/></div>
      <div style={{display:"flex",alignItems:"center",gap:8,margin:"16px 0 8px"}}>{stepN(4)}<span style={{fontSize:13.5,fontWeight:700}}>Datos fiscales</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><div style={{fontSize:11,fontWeight:700,color:P.muted,marginBottom:4}}>Uso CFDI</div><select style={{...selSty,padding:"8px 8px",fontSize:12}} defaultValue="G03"><option>G03 - Gastos en general</option></select></div><div><div style={{fontSize:11,fontWeight:700,color:P.muted,marginBottom:4}}>Régimen fiscal</div><select style={{...selSty,padding:"8px 8px",fontSize:12}} defaultValue="612"><option>612 - Personas Físicas con Actividades E…</option></select></div></div>
      <div style={{marginTop:10}}><div style={{fontSize:11,fontWeight:700,color:P.muted,marginBottom:4}}>Método de pago</div><select style={{...selSty,padding:"8px 8px",fontSize:12}} defaultValue="PUE"><option>PUE - Pago en una sola exhibición</option></select></div>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,margin:"12px 0",cursor:"pointer"}}><span style={{width:16,height:16,borderRadius:4,background:P.purple,color:"#fff",display:"grid",placeItems:"center",fontSize:10}}>✓</span>Enviar por correo al paciente</label>
      {nfMsg&&<div style={{marginBottom:10,padding:"9px 12px",borderRadius:9,background:nfMsg.includes("✓")?"#E6F6EE":"#FDF4E6",border:`1px solid ${nfMsg.includes("✓")?"#BFE6CF":"#F2E1C0"}`,fontSize:12.5,color:nfMsg.includes("✓")?"#166534":"#7A5A16"}}>{nfMsg}</div>}
      <div style={{display:"flex",gap:10}}><button style={{flex:1,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>◉ Vista previa</button><button onClick={emit} disabled={nfBusy} style={{flex:1,border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>{nfBusy?"Emitiendo…":"➤ Emitir factura ▾"}</button></div>
     </div>
    </div>
   </div>;
  })() : view==="documentos" ? (()=>{
   // ===== MÓDULO DOCUMENTOS (S-DOCUMENTOS) — lista por paciente cableada a GET /patients/:id/documents =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const fmtD=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const useReal=!!docsSnap&&docsSnap.total>0;
   type DRow={title:string;type:string;date:string;by:string;size:string};
   const REP:DRow[]=[
    {title:"Resultados_Laboratorio_17092026.pdf",type:"Laboratorio",date:"17 sep 2026",by:"Dr. Luis Godinez",size:"245 KB"},
    {title:"USG_abdomen.pdf",type:"Imagenología",date:"12 sep 2026",by:"Dr. Pérez (RAD)",size:"1.2 MB"},
    {title:"Consentimiento_procedimiento.pdf",type:"Consentimiento",date:"10 sep 2026",by:"Dr. Luis Godinez",size:"180 KB"},
    {title:"Interconsulta_Endocrinología.pdf",type:"Interconsulta",date:"08 sep 2026",by:"Dra. Martínez",size:"320 KB"},
    {title:"Receta_25082026.pdf",type:"Receta",date:"25 ago 2026",by:"Dr. Luis Godinez",size:"95 KB"},
    {title:"Nota_consulta_15082026.pdf",type:"Nota médica",date:"15 ago 2026",by:"Dr. Luis Godinez",size:"210 KB"},
    {title:"TC_torax.pdf",type:"Imagenología",date:"01 ago 2026",by:"Dr. Sánchez (RAD)",size:"4.8 MB"},
    {title:"Carnet_vacunacion.pdf",type:"Vacunas",date:"20 jul 2026",by:"Enfermería",size:"120 KB"},
    {title:"Identificación_INE.pdf",type:"Administrativo",date:"10 jul 2026",by:"Recepción",size:"600 KB"},
    {title:"Comprobante_domicilio.pdf",type:"Administrativo",date:"10 jul 2026",by:"Recepción",size:"350 KB"},
   ];
   const rows:DRow[]=useReal?docsSnap!.items.map(it=>({title:it.title,type:it.typeLabel,date:fmtD(it.createdAt),by:"Médico tratante",size:"—"})):REP;
   const total=useReal?docsSnap!.total:24;
   const chips=docsSnap?docsSnap.chips:{clinical:3,consents:2,studies:1};
   const sel=rows[docSel]??rows[0]??REP[0]!;
   const REP_FOLDERS:[string,number][]=[["Todos los documentos",24],["Consultas",8],["Estudios de laboratorio",5],["Estudios de imagen",3],["Consentimientos",4],["Recetas",3],["Notas médicas",4],["Interconsultas",2],["Administrativos",2],["Otros",1]];
   const folders:[string,number][]=useReal?[["Todos los documentos",total],...Object.entries(docsSnap!.byType)]:REP_FOLDERS;
   const genDoc=async()=>{
    if(!patientId){setDocMsg("Selecciona un paciente para generar un documento.");return;}
    setDocMsg("");
    try{const r=await apiRequest("/api/v1/documents",{method:"POST",body:{documentId:crypto.randomUUID(),patientId,docType:"PROGRESS_NOTE",title:`Nota_${new Date().toISOString().slice(0,10)}.pdf`,content:"Documento generado desde plantilla.",occurredAt:new Date().toISOString()}});
     if(r.status===201||r.status===200){setDocMsg("Documento generado ✓");const g=await apiRequest(`/api/v1/patients/${patientId}/documents`,{method:"GET"});if(g.status===200)setDocsSnap(g.body as unknown as DocsSnap);}
     else setDocMsg("No se pudo generar (estado "+r.status+").");
    }catch{setDocMsg("Error al generar el documento.");}
   };
   const typeSty=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={Laboratorio:["#EEEBFD","#6C5CF6"],["Imagenología"]:["#E7EEFB","#1769E0"],Consentimiento:["#FBF0DC","#B7791F"],Interconsulta:["#E0F7FA","#0E7490"],Receta:["#E6F6EE","#16A66A"],["Nota médica"]:["#EEF1FB","#4653C4"],Vacunas:["#E6F6EE","#16A66A"],Administrativo:["#EEF1F7","#6B7191"],Procedimiento:["#EEEBFD","#6C5CF6"],Otro:["#EEF1F7","#6B7191"]};const[b,f]=m[k]??m.Otro!;return{background:b,color:f,borderRadius:8,padding:"3px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"};};
   const folderIco=["#6C5CF6","#1769E0","#16A66A","#E5983B","#0E7490","#C9364A","#4653C4","#6B7191"];
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
   const tdc:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,whiteSpace:"nowrap"};
   const chipC=(c:string,d:string,n:number,l:string)=><div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}><span style={{width:34,height:34,borderRadius:9,background:c+"22",color:c,display:"grid",placeItems:"center"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={d}/></svg></span><div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{n}</div><div style={{fontSize:11,color:P.muted}}>{l}</div></div></div>;
   const DOCS_TABS:[typeof docsTab,string][]=[["todos","Todos"],["clinicos","Clínicos"],["administrativos","Administrativos"],["consentimientos","Consentimientos"],["estudios","Estudios"],["recetas","Recetas"],["notas","Notas"],["otros","Otros"]];
   const pdfIco="M6 2h9l5 5v15H6zM14 2v6h6";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Documentos</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Gestiona, organiza y comparte todos los documentos clínicos y administrativos de tus pacientes.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>⊟ Plantillas</button><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>⇪ Carga masiva</button><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setDocNew(v=>!v);setDocMsg("");}}>{docNew?"Cerrar":"+ Nuevo documento"}</button></div>
    </div>
    {docNew&&<div style={{...card2,marginTop:16,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:4}}>Nuevo documento clínico</div>
     <div style={{fontSize:12.5,color:P.muted,marginBottom:12}}>Para <b style={{color:P.ink}}>{patientName||"el paciente en contexto"}</b>{!patientId?" — selecciona un paciente primero":""}. Documento de texto firmable (no carga de archivos).</div>
     <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:14}} className="mos-med2">
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Tipo</div><select value={docForm.docType} onChange={e=>setDocForm({...docForm,docType:e.target.value})} style={selSty}>{[["PROGRESS_NOTE","Nota de evolución"],["DISCHARGE_SUMMARY","Resumen de alta"],["REFERRAL","Interconsulta"],["PROCEDURE_NOTE","Nota de procedimiento"],["OTHER","Otro"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Título</div><input value={docForm.title} onChange={e=>setDocForm({...docForm,title:e.target.value})} placeholder="Ej. Nota de evolución 19/09/2026" style={selSty}/></div>
     </div>
     <div style={{marginTop:12}}><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Contenido</div><textarea value={docForm.content} onChange={e=>setDocForm({...docForm,content:e.target.value})} placeholder="Contenido del documento…" style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"10px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink,minHeight:100,resize:"vertical",boxSizing:"border-box"}}/></div>
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void createDocument()} disabled={docBusy||!patientId||!docForm.title.trim()||!docForm.content.trim()} style={{border:0,background:(docBusy||!patientId||!docForm.title.trim()||!docForm.content.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(docBusy||!patientId||!docForm.title.trim()||!docForm.content.trim())?"default":"pointer",fontFamily:UI}}>{docBusy?"Creando…":"Crear documento"}</button><button onClick={()=>setDocNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    <div style={{...card2,marginTop:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"center",gap:13,minWidth:0}}><span style={{width:48,height:48,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:15,fontWeight:700,flex:"0 0 auto"}}>{initials(patientName||"Ana López García")}</span><div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:16}}>{patientName||"Ana López García"}</div><div style={{fontSize:12.5,color:P.muted}}>Femenino, 34 años&nbsp;&nbsp;|&nbsp;&nbsp;Expediente: LC260917-0042&nbsp;&nbsp;|&nbsp;&nbsp;CURP: LOGA900101MCHPRN09</div></div></div>
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>{chipC(P.blue,pdfIco,chips.clinical,"Documentos clínicos")}{chipC(P.green,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z",chips.consents,"Consentimientos")}{chipC(P.purple,"M4 5h16v14H4zM4 15l4-4 3 3 5-5 4 4",chips.studies,"Estudios de imagen")}<button onClick={()=>setView("exp")} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver expediente →</button></div>
    </div>
    <div style={{...card2,marginTop:16,padding:"0 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
     <div style={{display:"flex",gap:4,overflowX:"auto"}}>{DOCS_TABS.map(([k,l])=><button key={k} onClick={()=>setDocsTab(k)} style={{padding:"14px 12px",fontSize:13.5,fontWeight:docsTab===k?700:500,color:docsTab===k?P.purple:P.muted,borderBottom:docsTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>{l}</button>)}</div>
     <div style={{display:"flex",gap:8,alignItems:"center",padding:"8px 0",flexWrap:"wrap"}}><div style={{position:"relative"}}><input placeholder="Buscar documentos..." style={{...selSty,paddingLeft:32,width:220}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" style={{position:"absolute",left:10,top:11}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px 13px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>⚟ Filtrar</button><select style={{...selSty,width:"auto"}} defaultValue="Ordenar: Más reciente"><option>Ordenar: Más reciente</option></select></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"250px 1fr 380px",gap:16,marginTop:16,alignItems:"start"}} className="mos-doc">
     {/* Carpetas */}
     <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:15,fontWeight:800}}>Carpetas</div><span style={{width:26,height:26,border:`1px solid ${LINE}`,borderRadius:8,display:"grid",placeItems:"center",color:P.purple,cursor:"pointer",fontWeight:700}}>+</span></div>{folders.map(([f,n],i)=>{const on=f===docFolder;return <div key={i} onClick={()=>setDocFolder(f)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:9,cursor:"pointer",background:on?"#EEEBFD":"transparent"}}><span style={{color:i===0?P.purple:folderIco[i%folderIco.length]}}><svg width="17" height="17" viewBox="0 0 24 24" fill={on||i>0?"currentColor":"none"} stroke="currentColor" strokeWidth="1.6" opacity={i===0?1:.9}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></span><span style={{flex:1,fontSize:13,fontWeight:on?700:500,color:on?P.purple:P.ink}}>{f}</span><span style={{fontSize:12,color:P.muted}}>{n}</span></div>;})}</div>
     {/* Tabla */}
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{padding:"14px 16px",fontSize:16,fontWeight:800}}>Documentos ({total})</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr><th style={{...th,width:30}}></th><th style={th}>Nombre</th><th style={th}>Tipo</th><th style={th}>Fecha</th><th style={th}>Subido por</th><th style={{...th,textAlign:"right"}}>Tamaño</th><th style={{...th,textAlign:"right"}}>Acc.</th></tr></thead>
       <tbody>{rows.slice(0,10).map((r,i)=>{const on=i===docSel;return <tr key={i} onClick={()=>setDocSel(i)} style={{cursor:"pointer",background:on?"#F7F6FE":"transparent"}}>
        <td style={tdc}><span style={{width:16,height:16,borderRadius:4,border:on?"0":"1.6px solid #C7CCE0",background:on?P.purple:"transparent",display:"grid",placeItems:"center",color:"#fff",fontSize:10}}>{on?"✓":""}</span></td>
        <td style={tdc}><div style={{display:"flex",alignItems:"center",gap:9}}><span style={{color:P.red,flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={pdfIco}/></svg></span><span style={{fontWeight:600,color:P.ink}}>{r.title}</span></div></td>
        <td style={tdc}><span style={typeSty(r.type)}>{r.type}</span></td>
        <td style={{...tdc,color:P.muted}}>{r.date}</td>
        <td style={tdc}>{r.by}</td>
        <td style={{...tdc,textAlign:"right",color:P.muted}}>{r.size}</td>
        <td style={{...tdc,textAlign:"right",color:P.muted,fontWeight:700}}>⋯</td>
       </tr>;})}</tbody>
      </table></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",fontSize:13,color:P.muted,flexWrap:"wrap",gap:10}}><span>Mostrando 1-{Math.min(rows.length,10)} de {total} documentos</span><div style={{display:"flex",gap:5}}>{["‹","1","2","3","›"].map((p,i)=><span key={i} style={{minWidth:32,height:32,border:`1px solid ${LINE}`,background:p==="1"?P.purple:P.white,color:p==="1"?"#fff":P.ink,borderRadius:8,display:"grid",placeItems:"center",fontSize:13,cursor:"pointer"}}>{p}</span>)}</div></div>
     </div>
     {/* Vista previa */}
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:`1px solid ${LINE}`}}><div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}><span style={{color:P.red,flex:"0 0 auto"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={pdfIco}/></svg></span><div style={{fontSize:13.5,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sel.title}</div></div><span style={{color:P.muted,cursor:"pointer"}}>✕</span></div>
      <div style={{display:"flex",gap:14,padding:"0 16px",borderBottom:`1px solid ${LINE}`}}>{["Vista previa","Detalles","Historial"].map((t,i)=><span key={t} style={{padding:"12px 4px",fontSize:13,fontWeight:i===0?700:500,color:i===0?P.purple:P.muted,borderBottom:i===0?`2px solid ${P.purple}`:"2px solid transparent",cursor:"pointer"}}>{t}</span>)}</div>
      <div style={{padding:14,background:"#F1F4FA"}}>
       <div style={{background:P.white,border:`1px solid ${LINE}`,borderRadius:8,padding:14,fontSize:10.5,color:P.ink,minHeight:340}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",borderBottom:`1px solid ${LINE}`,paddingBottom:8}}><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{color:P.blue}}>🧪</span><b style={{fontSize:11}}>LABORATORIOS DEL NORTE</b></div><b style={{fontSize:10}}>RESULTADOS DE LABORATORIO</b></div>
        <div style={{display:"grid",gridTemplateColumns:"70px 1fr",gap:"2px 8px",margin:"8px 0",fontSize:10}}><span style={{color:P.muted}}>Paciente:</span><b>{patientName||"Ana López García"}</b><span style={{color:P.muted}}>Edad:</span><span>34 años</span><span style={{color:P.muted}}>Sexo:</span><span>Femenino</span><span style={{color:P.muted}}>Expediente:</span><span>LC260917-0042</span><span style={{color:P.muted}}>Fecha:</span><span>17/09/2026</span></div>
        <div style={{fontWeight:700,margin:"6px 0 2px"}}>Biometría hemática</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:9.5}}><thead><tr>{["Estudio","Resultado","Unidad","Referencia"].map(h=><th key={h} style={{textAlign:"left",borderBottom:`1px solid ${LINE}`,padding:"3px 4px",color:P.muted}}>{h}</th>)}</tr></thead><tbody>{[["Hemoglobina","13.2","g/dL","12.0 - 16.0"],["Hematocrito","39.8","%","36 - 46"],["Leucocitos","6,800","/µL","4,000 - 11,000"],["Plaquetas","285,000","/µL","150,000 - 450,000"]].map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} style={{padding:"3px 4px",borderBottom:`1px solid #F2F4F9`,fontWeight:j===0?600:400}}>{c}</td>)}</tr>)}</tbody></table>
        <div style={{fontWeight:700,margin:"8px 0 2px"}}>Química sanguínea</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:9.5}}><tbody>{[["Glucosa","98","mg/dL","70 - 99"],["Urea","28","mg/dL","10 - 50"],["Creatinina","0.8","mg/dL","0.6 - 1.2"],["TGO (AST)","24","U/L","< 40"],["TGP (ALT)","26","U/L","< 41"]].map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} style={{padding:"3px 4px",borderBottom:`1px solid #F2F4F9`,fontWeight:j===0?600:400}}>{c}</td>)}</tr>)}</tbody></table>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:14}}><div style={{width:48,height:48,background:"#111",borderRadius:3}}/><div style={{textAlign:"right",fontSize:9}}><div style={{borderTop:"1px solid #333",paddingTop:2,fontWeight:700}}>Q.B. Mariana Torres</div><div style={{color:P.muted}}>Responsable sanitario</div><div style={{color:P.muted}}>Céd. Prof. 12345678</div></div></div>
       </div>
      </div>
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1.1fr 1.2fr 1fr",gap:14,marginTop:16,alignItems:"start"}} className="mos-doc2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:12}}>⚡ Acciones rápidas</div>{docMsg&&<div style={{marginBottom:10,padding:"8px 11px",borderRadius:8,background:docMsg.includes("✓")?"#E6F6EE":"#FDF4E6",fontSize:12,color:docMsg.includes("✓")?"#166534":"#7A5A16"}}>{docMsg}</div>}<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["⤒","Nuevo documento",()=>{setDocNew(true);setDocMsg("");}],["◉","Escanear con cámara",()=>setDocMsg("Escaneo con cámara: próximamente (requiere captura/almacenamiento de archivos).")],["▤","Generar desde plantilla",genDoc],["➤","Solicitar al paciente",()=>setDocMsg("Solicitud al portal del paciente: próximamente.")]].map(([ic,l,fn],i)=><button key={i} onClick={fn as ()=>void} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:11,padding:"16px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,cursor:"pointer",fontFamily:UI}}><span style={{width:38,height:38,borderRadius:10,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:16}}>{ic as string}</span><span style={{fontSize:12.5,fontWeight:600}}>{l as string}</span></button>)}</div></div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:12}}>▤ Tipos de archivo permitidos</div><div style={{display:"flex",gap:10,justifyContent:"space-between",flexWrap:"wrap"}}>{[["PDF",P.red],["JPG/PNG",P.amber],["DICOM",P.blue],["DOC/DOCX",P.blue],["XLS/XLSX",P.green]].map(([l,c],i)=><div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flex:1}}><span style={{width:44,height:44,borderRadius:10,background:(c as string)+"22",color:c as string,display:"grid",placeItems:"center"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 2h9l5 5v15H6z"/></svg></span><span style={{fontSize:11.5,fontWeight:600,textAlign:"center"}}>{l as string}</span></div>)}</div><div style={{fontSize:11.5,color:P.muted,marginTop:12}}>Tamaño máximo: 10 MB por archivo</div></div>
     <div style={{...card2,padding:16,background:"#F7F6FE",borderColor:"#E2DEFB"}}><div style={{display:"flex",gap:10}}><span style={{color:P.purple}}>ⓘ</span><div><div style={{fontWeight:700,fontSize:13.5}}>Nota</div><div style={{fontSize:12.5,color:P.muted,marginTop:2,lineHeight:1.5}}>Los documentos se almacenan de forma segura y cifrada, cumpliendo con la NOM-024-SSA3-2012.</div></div></div></div>
    </div>
   </div>;
  })() : view==="obligaciones" ? (()=>{
   // ===== MÓDULO OBLIGACIONES (S-OBLIGACIONES) — obligaciones regulatorias del consultorio cableadas a GET /regulatory-obligations =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const fmtD=(iso:string|null)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const useReal=!!regObSnap&&regObSnap.total>0;
   type ORow={name:string;category:string;periodicity:string;date:string;estado:string};
   const REP:ORow[]=[
    {name:"Declaración mensual de IVA",category:"Fiscal (SAT)",periodicity:"Mensual",date:"17 sep 2026",estado:"Al día"},
    {name:"Declaración mensual de ISR",category:"Fiscal (SAT)",periodicity:"Mensual",date:"17 sep 2026",estado:"Al día"},
    {name:"Pago de IMSS (si aplica)",category:"Laboral",periodicity:"Mensual",date:"20 sep 2026",estado:"Próxima"},
    {name:"Aviso de funcionamiento COFEPRIS",category:"Salud (COFEPRIS)",periodicity:"Única",date:"—",estado:"Vigente"},
    {name:"Renovación de aviso de funcionamiento",category:"Salud (COFEPRIS)",periodicity:"Cada 5 años",date:"12 ene 2028",estado:"Al día"},
    {name:"Manejo de RPBI (manifiesto)",category:"Salud (COFEPRIS)",periodicity:"Trimestral",date:"30 sep 2026",estado:"Próxima"},
    {name:"Capacitación en RPBI",category:"Salud (COFEPRIS)",periodicity:"Anual",date:"15 nov 2026",estado:"Al día"},
    {name:"Extintores (mantenimiento)",category:"Protección civil",periodicity:"Semestral",date:"10 oct 2026",estado:"Próxima"},
    {name:"Revisión eléctrica",category:"Protección civil",periodicity:"Anual",date:"22 may 2027",estado:"Al día"},
    {name:"Declaración anual de personas físicas",category:"Fiscal (SAT)",periodicity:"Anual",date:"30 abr 2027",estado:"Próxima"},
   ];
   const allRows:ORow[]=useReal?regObSnap!.items.map(it=>({name:it.name,category:it.category,periodicity:it.periodicity,date:fmtD(it.dueDate),estado:it.estado})):REP;
   const CATMAP:Record<string,string>={fiscales:"Fiscal (SAT)",salud:"Salud (COFEPRIS)",laborales:"Laboral",proteccion:"Protección civil",administrativas:"Administrativa",otros:"Otros"};
   const rows=allRows.filter(r=>oblTab==="todas"||r.category===CATMAP[oblTab]);
   const total=useReal?regObSnap!.total:21;
   const kAl=useReal?regObSnap!.alDia:12,kProx=useReal?regObSnap!.proximas:6,kVenc=useReal?regObSnap!.vencidas:3;
   const pct=(n:number)=>total?Math.round(n/total*100):0;
   const compRep:[string,number][]=[["Fiscal (SAT)",80],["Salud (COFEPRIS)",60],["Laboral",50],["Protección civil",50],["Administrativa",100]];
   const compliance:[string,number][]=useReal?Object.entries(regObSnap!.compliance):compRep;
   const estSty=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={["Al día"]:["#E6F6EE","#16A66A"],["Próxima"]:["#FBF0DC","#B7791F"],Vencida:["#FDECEE","#C9364A"],Vigente:["#E7EEFB","#1769E0"]};const[b,f]=m[k]??m["Al día"]!;return{background:b,color:f,borderRadius:8,padding:"4px 12px",fontSize:12.5,fontWeight:700,whiteSpace:"nowrap"};};
   const kico=(bg:string,fg:string,d:string)=><span style={{width:48,height:48,borderRadius:"50%",background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
   const tdc:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,whiteSpace:"nowrap"};
   const CAL=[["17","SEP","Declaración mensual de IVA","Fiscal (SAT)","En 2 días","#16A66A"],["17","SEP","Declaración mensual de ISR","Fiscal (SAT)","En 2 días","#16A66A"],["20","SEP","Pago de IMSS","Laboral","En 5 días","#E5983B"],["30","SEP","Manifiesto de RPBI","Salud (COFEPRIS)","En 15 días","#16A66A"],["10","OCT","Mantenimiento de extintores","Protección civil","En 25 días","#16A66A"]];
   const OBL_TABS:[typeof oblTab,string][]=[["todas","Todas"],["fiscales","Fiscales (SAT)"],["salud","Salud (COFEPRIS)"],["laborales","Laborales"],["proteccion","Protección civil"],["administrativas","Administrativas"],["otros","Otros"]];
   const fileIco="M6 2h9l5 5v15H6zM14 2v6h6";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 5h14v14H5zM9 12l2 2 4-4"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Obligaciones</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Cumple y da seguimiento a las obligaciones legales, fiscales y normativas de tu consultorio.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>⚙ Configuración</button><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>↧ Exportar reporte</button><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setOblNew(v=>!v);setOblMsg(null);}}>{oblNew?"Cerrar":"+ Agregar obligación"}</button></div>
    </div>
    {oblMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:oblMsg.includes("✓")?"#F0FBF4":"#EEF6FF",border:`1px solid ${oblMsg.includes("✓")?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:oblMsg.includes("✓")?P.green:P.blue,fontWeight:700}}>{oblMsg.includes("✓")?"✓":"ℹ"}</span><span style={{flex:1}}>{oblMsg}</span><button onClick={()=>setOblMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {oblNew&&<div style={{...card2,marginTop:14,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>Nueva obligación del consultorio</div>
     <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14}} className="mos-med2">
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Nombre</div><input value={oblForm.name} onChange={e=>setOblForm({...oblForm,name:e.target.value})} placeholder="Ej. Declaración mensual de IVA" style={selSty}/></div>
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Categoría</div><select value={oblForm.category} onChange={e=>setOblForm({...oblForm,category:e.target.value})} style={selSty}>{["Fiscal (SAT)","Salud (COFEPRIS)","Laboral","Protección civil","Administrativa","Otros"].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
     </div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:12}}>
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Periodicidad</div><select value={oblForm.periodicity} onChange={e=>setOblForm({...oblForm,periodicity:e.target.value})} style={selSty}>{["Mensual","Trimestral","Semestral","Anual","Cada 5 años","Única"].map(p=><option key={p} value={p}>{p}</option>)}</select></div>
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Fecha límite (opcional)</div><input type="date" value={oblForm.dueDate} onChange={e=>setOblForm({...oblForm,dueDate:e.target.value})} style={selSty}/></div>
     </div>
     <div style={{fontSize:11.5,color:P.muted,marginTop:8}}>El estado (Al día / Próxima / Vencida) se <b>computa</b> de la fecha límite; sin fecha se marca <b>Vigente</b>.</div>
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void createRegObligation()} disabled={oblBusy||!oblForm.name.trim()} style={{border:0,background:(oblBusy||!oblForm.name.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(oblBusy||!oblForm.name.trim())?"default":"pointer",fontFamily:UI}}>{oblBusy?"Agregando…":"Agregar obligación"}</button><button onClick={()=>setOblNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#E6F6EE","#16A66A","M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{kAl}</div><div style={{fontSize:11.5,color:P.muted}}>Al día</div><div style={{fontSize:11,color:P.muted,fontWeight:600}}>{pct(kAl)}% del total</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#FBF0DC",P.amber,"M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{kProx}</div><div style={{fontSize:11.5,color:P.muted}}>Próximas a vencer</div><div style={{fontSize:11,color:P.muted,fontWeight:600}}>{pct(kProx)}% del total</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#FDECEE",P.red,"M12 9v4M12 17h.01M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{kVenc}</div><div style={{fontSize:11.5,color:P.muted}}>Vencidas</div><div style={{fontSize:11,color:P.muted,fontWeight:600}}>{pct(kVenc)}% del total</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#E7EEFB",P.blue,"M8 2v4M16 2v4M4 8h16M5 6h14v14H5z")}<div><div style={{fontSize:24,fontWeight:800}}>{total}</div><div style={{fontSize:11.5,color:P.muted}}>Total de obligaciones</div></div></div>
    </div>
    <div style={{...card2,marginTop:16,padding:"0 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
     <div style={{display:"flex",gap:4,overflowX:"auto"}}>{OBL_TABS.map(([k,l])=><button key={k} onClick={()=>setOblTab(k)} style={{padding:"14px 12px",fontSize:13.5,fontWeight:oblTab===k?700:500,color:oblTab===k?P.purple:P.muted,borderBottom:oblTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>{l}</button>)}</div>
     <div style={{display:"flex",gap:8,alignItems:"center",padding:"8px 0",flexWrap:"wrap"}}><div style={{position:"relative"}}><input placeholder="Buscar obligación..." style={{...selSty,paddingLeft:32,width:200}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" style={{position:"absolute",left:10,top:11}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div><select style={{...selSty,width:"auto"}} defaultValue="Todas las categorías"><option>Todas las categorías</option></select><select style={{...selSty,width:"auto"}} defaultValue="Todos los estados"><option>Todos los estados</option></select></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:16,marginTop:16,alignItems:"start"}} className="mos-obl">
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{padding:"14px 16px",fontSize:16,fontWeight:800}}>Obligaciones ({rows.length})</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr><th style={{...th,width:30}}></th><th style={th}>Nombre</th><th style={th}>Categoría</th><th style={th}>Periodicidad</th><th style={th}>Próxima fecha</th><th style={th}>Estado</th><th style={{...th,textAlign:"right"}}>Acc.</th></tr></thead>
       <tbody>{rows.slice(0,10).map((r,i)=>{const c=r.estado==="Vencida"?P.red:r.estado==="Próxima"?P.amber:P.green;return <tr key={i}><td style={tdc}><span style={{width:15,height:15,borderRadius:4,border:"1.6px solid #C7CCE0",display:"inline-block"}}/></td><td style={tdc}><div style={{display:"flex",alignItems:"center",gap:9}}><span style={{color:c,flex:"0 0 auto"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={fileIco}/></svg></span><span style={{fontWeight:600,color:P.ink}}>{r.name}</span></div></td><td style={{...tdc,color:P.muted}}>{r.category}</td><td style={{...tdc,color:P.muted}}>{r.periodicity}</td><td style={{...tdc,color:P.muted}}>{r.date}</td><td style={tdc}><span style={estSty(r.estado)}>{r.estado}</span></td><td style={{...tdc,textAlign:"right",color:P.muted,fontWeight:700}}>⋯</td></tr>;})}
       {rows.length===0&&<tr><td colSpan={7} style={{...tdc,textAlign:"center",color:P.muted,padding:"30px"}}>Sin obligaciones en esta categoría.</td></tr>}
       </tbody></table></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",fontSize:13,color:P.muted,flexWrap:"wrap",gap:10}}><span>Mostrando 1-{Math.min(rows.length,10)} de {total} obligaciones</span><div style={{display:"flex",gap:5}}>{["‹","1","2","3","›"].map((p,i)=><span key={i} style={{minWidth:32,height:32,border:`1px solid ${LINE}`,background:p==="1"?P.purple:P.white,color:p==="1"?"#fff":P.ink,borderRadius:8,display:"grid",placeItems:"center",fontSize:13,cursor:"pointer"}}>{p}</span>)}</div></div>
     </div>
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8}}>📅 Calendario de próximas obligaciones</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver calendario</span></div>{CAL.map(([d,mo,name,cat,badge,bc],i)=><div key={i} style={{display:"flex",alignItems:"center",gap:11,padding:"9px 0",borderBottom:i<CAL.length-1?`1px solid #F2F4F9`:"0"}}><div style={{width:38,textAlign:"center",flex:"0 0 auto"}}><div style={{fontSize:16,fontWeight:800,lineHeight:1}}>{d}</div><div style={{fontSize:9.5,color:P.muted,fontWeight:700}}>{mo}</div></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:12.5,fontWeight:700}}>{name}</div><div style={{fontSize:11,color:P.muted}}>{cat}</div></div><span style={{background:(bc as string)+"22",color:bc as string,borderRadius:16,padding:"3px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{badge}</span></div>)}</div>
      <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8}}>▤ Documentos relacionados</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver todos</span></div>{[["Constancia de situación fiscal.pdf","12 ene 2026"],["Aviso de funcionamiento.pdf","10 feb 2023"],["Constancia RPBI 2025.pdf","15 ene 2025"],["Póliza de seguro responsabilidad civil.pdf","01 mar 2026"],["Dictamen eléctrico.pdf","22 may 2026"]].map(([f,d],i)=><div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:i<4?`1px solid #F2F4F9`:"0",fontSize:12.5}}><span style={{color:P.red}}>▤</span><span style={{flex:1,fontWeight:500}}>{f}</span><span style={{color:P.muted,fontSize:11}}>{d}</span><span style={{color:P.muted,fontWeight:700,cursor:"pointer"}}>⋯</span></div>)}</div>
      <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8,marginBottom:10}}>▣ Ayuda y normatividad</div>{["Guía COFEPRIS para consultorios","Manual de RPBI (NOM-087)","Obligaciones fiscales (SAT)","Protección civil en establecimientos","Checklist de cumplimiento"].map((l,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<4?`1px solid #F2F4F9`:"0",fontSize:13,color:P.blue,fontWeight:500,cursor:"pointer"}}><span style={{display:"flex",alignItems:"center",gap:8}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h12v14H4z"/></svg>{l}</span><span>⧉</span></div>)}</div>
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1.1fr 1fr 1fr",gap:14,marginTop:16,alignItems:"start"}} className="mos-obl2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8,marginBottom:12}}>▨ Cumplimiento por categoría</div>{compliance.map(([l,n],i)=>{const c=n>=80?"#16A66A":n>=50?"#E5983B":"#C9364A";return <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><span style={{width:110,fontSize:12,color:P.ink}}>{l==="Fiscal (SAT)"?"Fiscal (SAT)":l==="Salud (COFEPRIS)"?"Salud (COFEPRIS)":l==="Protección civil"?"Protección civil":l==="Administrativa"?"Administrativa":l}</span><div style={{flex:1,height:7,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${n}%`,background:c,borderRadius:6}}/></div><span style={{fontSize:12,fontWeight:700,width:36,textAlign:"right"}}>{n}%</span></div>;})}</div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8,marginBottom:10}}>✉ Recordatorios automáticos</div><div style={{fontSize:12.5,color:P.muted,lineHeight:1.5,marginBottom:12}}>Recibe alertas por correo y en el sistema antes de tus vencimientos.</div><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><span style={{width:40,height:22,borderRadius:14,background:"#16A66A",position:"relative"}}><span style={{position:"absolute",top:2,left:20,width:18,height:18,borderRadius:"50%",background:"#fff"}}/></span><span style={{fontSize:13,fontWeight:600}}>Activar recordatorios</span></div><button style={{width:"100%",border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>⚙ Configurar recordatorios</button></div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8,marginBottom:10}}>✔ Tareas pendientes</div>{[["Subir manifiesto de RPBI Q3",false],["Renovar póliza de seguro",true],["Programar capacitación RPBI",false],["Actualizar botiquín",false],["Revisar señalización",false]].map(([t,done],i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0"}}><span style={{width:17,height:17,borderRadius:5,border:done?"0":"1.7px solid #C7CCE0",background:done?P.purple:"transparent",color:"#fff",display:"grid",placeItems:"center",fontSize:10,flex:"0 0 auto"}}>{done?"✓":""}</span><span style={{fontSize:13,color:done?P.muted:P.ink,textDecoration:done?"line-through":"none"}}>{t as string}</span></div>)}</div>
    </div>
   </div>;
  })() : view==="clinicalIntel" ? (()=>{
   // ===== MÓDULO CLINICAL INTELLIGENCE (S-CLINICALINTEL) =====
   // Alertas clínicas y calculadoras DETERMINISTAS (motor CDS real). El asistente de IA generativa y el
   // diagnóstico diferencial probabilístico se muestran a fidelidad pero son REPRESENTATIVOS: R6 (IA generativa)
   // está en pausa intencional por la regla del proyecto (r6-paused). No hay LLM en producción.
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const clip="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z";
   // Alertas: findings deterministas del snapshot (reales) o representativas de la imagen.
   const SEVC:Record<string,string>={CRITICAL:P.red,WARNING:P.red,INFO:P.amber};
   type Alert={title:string;detail:string;color:string};
   const realFindings=ciSnap?.findings??[];
   const alerts:Alert[]=realFindings.length?realFindings.map(f=>({title:f.summary,detail:f.domain,color:SEVC[f.severity]??P.amber})):[
    {title:"HbA1c 8.1% (fuera de meta)",detail:"Meta recomendada: < 7%",color:P.red},
    {title:"IMC 30.2 kg/m² (obesidad)",detail:"Considerar intervención intensiva",color:P.red},
   ];
   const chipCard=(c:string,d:string,n:number|string,l:string)=><div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}><span style={{width:32,height:32,borderRadius:9,background:c+"22",color:c,display:"grid",placeItems:"center"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={d}/></svg></span><div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{n}</div><div style={{fontSize:11,color:P.muted}}>{l}</div></div></div>;
   const nProblems=ciSnap?.problems?.length??3,nAllergies=ciSnap?.allergies?.length??1;
   const CI_TABS:[typeof ciTab,string][]=[["asistente","Asistente clínico"],["diferencial","Diagnóstico diferencial"],["guias","Guías de práctica clínica"],["interacciones","Interacciones"],["calculadoras","Calculadoras"],["alertas","Alertas"],["educacion","Educación al paciente"]];
   const dxDiff:[number,string,number,string][]=[[1,"Diabetes mellitus tipo 2 (confirmado)",95,"#16A66A"],[2,"Resistencia a la insulina",78,"#1769E0"],[3,"Síndrome metabólico",68,"#1769E0"],[4,"Hipotiroidismo (descartar)",22,"#E5983B"],[5,"Cushing exógeno (menos probable)",12,"#9AA0BC"]];
   const calcs:[string,string][]=[["IMC","M8 3h8M12 3v6M6 9h12l-1 12H7z"],["FG (CKD-EPI)","M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v4l3 2"],["Dosis pediátricas","M12 2v20M2 12h20"],["CHA₂DS₂-VASc","M12 21C12 21 4 13.5 4 8.5A4 4 0 0112 6a4 4 0 018 2.5C20 13.5 12 21 12 21z"],["Score NEWS2","M3 12h4l3 8 4-16 3 8h4"]];
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="M9 3a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 001 5 3 3 0 004 2 3 3 0 006 0 3 3 0 004-2 3 3 0 001-5 3 3 0 00-2-5 3 3 0 00-3-3 3 3 0 00-6 0zM12 6v13"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Clinical Intelligence</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Apoyo clínico con IA, guías de práctica clínica y alertas inteligentes para una mejor toma de decisiones.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>⚙ Configuración de IA</button><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>✦ Nueva consulta con IA ▾</button></div>
    </div>
    <div style={{...card2,marginTop:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"center",gap:13,minWidth:0}}><span style={{width:48,height:48,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:15,fontWeight:700,flex:"0 0 auto"}}>{initials(patientName||"Ana López García")}</span><div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:16}}>{patientName||"Ana López García"}</div><div style={{fontSize:12.5,color:P.muted}}>Femenino, 34 años&nbsp;&nbsp;|&nbsp;&nbsp;Expediente: LC260917-0042&nbsp;&nbsp;|&nbsp;&nbsp;CURP: LOGA900101MCHPRN09</div></div></div>
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>{chipCard(P.blue,clip,nProblems,"Problemas activos")}{chipCard(P.green,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z",2,"Medicamentos")}{chipCard(P.red,"M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",nAllergies,nAllergies===1?"Alergia":"Alergias")}{chipCard(P.purple,"M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9 8a3 3 0 100-6 3 3 0 000 6z",3,"Interconsultas")}<button onClick={()=>setView("exp")} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver expediente →</button></div>
    </div>
    <div style={{...card2,marginTop:16,padding:"0 16px",display:"flex",gap:4,overflowX:"auto"}}>{CI_TABS.map(([k,l])=><button key={k} onClick={()=>setCiTab(k)} style={{padding:"14px 12px",fontSize:13.5,fontWeight:ciTab===k?700:500,color:ciTab===k?P.purple:P.muted,borderBottom:ciTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>{l}</button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:16,marginTop:16,alignItems:"start"}} className="mos-ci">
     {/* Asistente clínico (representativo — R6 en pausa) */}
     <div style={{...card2,padding:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
       <div style={{display:"flex",gap:12,alignItems:"flex-start"}}><span style={{width:40,height:40,borderRadius:11,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></svg></span><div><div style={{fontSize:18,fontWeight:800,display:"flex",alignItems:"center",gap:8}}>Asistente clínico con IA <span style={{background:"#E6F6EE",color:"#16A66A",borderRadius:16,padding:"2px 9px",fontSize:11,fontWeight:700}}>En línea ✦</span></div><div style={{fontSize:12.5,color:P.muted}}>Basado en guías actualizadas (GPC), evidencia científica y contexto del paciente.</div></div></div>
       <select style={{border:`1px solid ${LINE}`,borderRadius:9,padding:"8px 10px",fontSize:13,background:P.white,fontFamily:UI}} defaultValue="GPT Clínico"><option>GPT Clínico</option></select>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><div style={{maxWidth:520,background:"#EEF1FB",borderRadius:"14px 14px 4px 14px",padding:"12px 15px",fontSize:13.5,lineHeight:1.5}}>Paciente femenino de 34 años con DM2, HbA1c 8.1%, IMC 30.2 kg/m², hipertensión controlada con losartán. ¿Qué ajustes de tratamiento recomiendas?<div style={{fontSize:11,color:P.muted,textAlign:"right",marginTop:4}}>09:24</div></div></div>
      <div style={{display:"flex",gap:12,alignItems:"flex-start",marginTop:14}}><span style={{width:34,height:34,borderRadius:10,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></svg></span>
       <div style={{flex:1,border:`1px solid ${LINE}`,borderRadius:14,padding:16,fontSize:13,lineHeight:1.55}}>
        <div style={{fontWeight:700,marginBottom:6}}>Recomendaciones clínicas</div>
        <div style={{color:P.muted,marginBottom:8}}>Con base en las GPC de ADA 2024, AHA 2023 y el contexto del paciente:</div>
        {[["1. Optimización de tratamiento para DM2:",["Aumentar metformina a 850–1,000 mg c/12 h (si tolera).","Considerar añadir un agonista GLP-1 (semaglutida o tirzepatida) por beneficio en control glucémico, reducción de peso y protección cardiovascular.","Evaluar iSGLT2 (empagliflozina) si no hay contraindicación y función renal adecuada."]],["2. Metas de control:",["HbA1c < 7% (individualizar), TA < 130/80 mmHg, pérdida de peso 5–10%."]],["3. Estudios de seguimiento:",["EGO, microalbuminuria, perfil renal, perfil lipídico, fondo de ojo, EKG anual."]],["4. Intervenciones no farmacológicas:",["Plan nutricional, ejercicio ≥ 150 min/sem, abordaje de sueño y estrés."]]].map(([h,items],i)=><div key={i} style={{marginTop:i?8:0}}><div style={{fontWeight:700}}>{h as string}</div><ul style={{margin:"3px 0 0",paddingLeft:18}}>{(items as string[]).map((it,j)=><li key={j} style={{marginBottom:2}}>{it}</li>)}</ul></div>)}
        <div style={{marginTop:10,color:P.muted,fontSize:12.5}}>Evidencia: ADA Standards of Care 2024, AHA/ACC HTA 2023, GPC IMSS 2023.</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"7px 12px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>↔ Ver referencias (5)</button><div style={{display:"flex",gap:8,color:P.muted}}><span style={{cursor:"pointer"}}>⧉</span><span style={{cursor:"pointer"}}>👍</span><span style={{cursor:"pointer"}}>👎</span></div></div>
       </div>
      </div>
      <div style={{marginTop:16,border:`1px solid ${LINE}`,borderRadius:12,padding:"6px 8px",display:"flex",alignItems:"center",gap:8}}><input placeholder="Haz una pregunta clínica, solicita un resumen o pide opciones de manejo..." style={{flex:1,border:0,padding:"9px 8px",fontSize:13,fontFamily:UI,color:P.ink}} disabled/></div>
      <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap",alignItems:"center"}}><span style={{color:P.muted}}>📎</span>{["Resumir este caso","Generar plan de tratamiento","Solicitar estudios","Educación al paciente"].map(a=><button key={a} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:20,padding:"7px 13px",fontWeight:500,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>{a}</button>)}<button style={{marginLeft:"auto",border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"9px 18px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>➤ Enviar</button></div>
      <div style={{marginTop:14,fontSize:11.5,color:"#7A5A16",background:"#FDF4E6",border:"1px solid #F2E1C0",borderRadius:9,padding:"8px 11px"}}>Nota de gobernanza: el asistente generativo y el diagnóstico diferencial probabilístico son <b>representativos</b> — la IA generativa (R6) está en pausa intencional. Las <b>Alertas clínicas</b> y las <b>Calculadoras</b> son deterministas y reales (motor CDS).</div>
      <div style={{marginTop:16}}><div style={{fontSize:14,fontWeight:800,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>❔ Preguntas frecuentes</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["¿Qué estudio solicito primero?","¿Cuál es la dosis recomendada?","¿Qué educación doy al paciente?","¿Cuándo interconsultar?","¿Qué signos de alarma vigilo?"].map(q=><button key={q} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:20,padding:"7px 13px",fontWeight:500,fontSize:12.5,cursor:"pointer",fontFamily:UI,color:P.ink}}>{q}</button>)}</div></div>
     </div>
     {/* Columna derecha: alertas (reales) + diferencial + guías + calculadoras */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8}}><span style={{color:P.red}}>⚠</span>Alertas clínicas <span style={{background:P.red,color:"#fff",borderRadius:"50%",width:18,height:18,display:"grid",placeItems:"center",fontSize:11,fontWeight:700}}>{alerts.length}</span></div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver todas</span></div>{alerts.map((a,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"11px 12px",borderRadius:11,background:"#FDECEE",marginBottom:i<alerts.length-1?8:0}}><span style={{color:a.color,flex:"0 0 auto"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 2h9l5 5v15H6z"/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700}}>{a.title}</div><div style={{fontSize:11.5,color:P.muted}}>{a.detail}</div></div><span style={{color:P.muted}}>›</span></div>)}</div>
      <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8}}>🧠 Diagnóstico diferencial (IA)</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver más</span></div>{dxDiff.map(([n,name,pct,c])=><div key={n} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:n<5?`1px solid #F2F4F9`:"0"}}><span style={{width:22,height:22,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,flex:"0 0 auto"}}>{n}</span><span style={{flex:1,fontSize:12.5}}>{name}</span><div style={{width:56,height:6,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:c as string,borderRadius:6}}/></div><span style={{fontSize:12,fontWeight:700,width:34,textAlign:"right"}}>{pct}%</span></div>)}</div>
      <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8}}>▤ Guías de práctica clínica</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver todas</span></div>{["ADA 2024 – Diabetes mellitus tipo 2","AHA 2023 – Hipertensión arterial","GPC IMSS 2023 – Obesidad","GPC CENETEC – Dislipidemia","GPC – Enfermedad renal diabética"].map((g,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",border:`1px solid ${LINE}`,borderRadius:9,marginBottom:6,fontSize:12.5,fontWeight:500,cursor:"pointer"}}>{g}<span style={{color:P.muted}}>›</span></div>)}</div>
      <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8}}>▦ Calculadoras clínicas</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver todas</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>{calcs.map(([l,d],i)=><div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer"}}><span style={{width:40,height:40,borderRadius:11,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={d}/></svg></span><span style={{fontSize:10,fontWeight:600,textAlign:"center",lineHeight:1.1}}>{l}</span></div>)}</div><div style={{fontSize:11,color:P.muted,marginTop:10}}>Cálculos deterministas (motor CDS real): eGFR CKD-EPI, IMC, CHA₂DS₂-VASc, NEWS2.</div></div>
     </div>
    </div>
   </div>;
  })() : view==="reportes" ? (()=>{
   // ===== MÓDULO REPORTES (S-REPORTES) — tablero analítico; KPIs de pacientes/ingresos y diagnósticos cableados a GET /reports =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const money=(n:number)=>"$"+n.toLocaleString("es-MX",{maximumFractionDigits:0});
   const useReal=!!repSnap;
   const kPac=useReal?repSnap!.patientsAttended:248;
   const kIng=useReal?repSnap!.income:124680;
   const REP_DX:[string,string,number,number][]=[["E11.9","Diabetes mellitus tipo 2",42,13],["I10","Hipertensión esencial",38,12],["J06.9","Infección aguda de vías respiratorias",35,11],["E66.9","Obesidad, no especificada",28,9],["K52.9","Gastroenteritis, no especificada",18,6]];
   const topDx:[string,string,number,number][]=(useReal&&repSnap!.topDiagnoses.length)?repSnap!.topDiagnoses.map(d=>[d.code,d.description,d.count,d.pct] as [string,string,number,number]):REP_DX;
   const REP_TABS=["Resumen","Pacientes","Consultas","Diagnósticos","Procedimientos","Medicamentos","Finanzas","Calidad","Operación","Personalizados"];
   const kico=(bg:string,fg:string,d:string)=><span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:16,display:"flex",gap:13,alignItems:"center"};
   const barRow=(name:string,sub:string,n:number,pct:number,w:number)=><div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0"}}><div style={{width:sub?150:120,minWidth:0}}><div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name}</div>{sub&&<div style={{fontSize:11,color:P.muted}}>{sub}</div>}</div><div style={{flex:1,height:8,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${w}%`,background:P.purple,borderRadius:6,opacity:.85}}/></div><span style={{fontSize:12.5,fontWeight:700,width:26,textAlign:"right"}}>{n}</span><span style={{fontSize:12,color:P.muted,width:32,textAlign:"right"}}>{pct}%</span></div>;
   const donut=(stops:string,center:string,sub:string,legend:[string,string,string,string][])=><div style={{display:"flex",gap:16,alignItems:"center"}}><div style={{width:120,height:120,borderRadius:"50%",flex:"0 0 auto",display:"grid",placeItems:"center",background:`conic-gradient(${stops})`}}><div style={{width:78,height:78,borderRadius:"50%",background:P.white,display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:18,fontWeight:800}}>{center}</div><div style={{fontSize:10,color:P.muted}}>{sub}</div></div></div></div><div style={{flex:1}}>{legend.map(([c,l,n,pc],i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,padding:"3px 0"}}><span style={{width:9,height:9,borderRadius:"50%",background:c}}/>{l}<b style={{marginLeft:"auto"}}>{pc}</b><span style={{color:P.muted,width:28,textAlign:"right"}}>{n}</span></div>)}</div></div>;
   const ring=(pct:number,label:string,c:string)=><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}><div style={{width:78,height:78,borderRadius:"50%",display:"grid",placeItems:"center",background:`conic-gradient(${c} ${pct}%, #EEF1F7 0)`}}><div style={{width:58,height:58,borderRadius:"50%",background:P.white,display:"grid",placeItems:"center",fontSize:16,fontWeight:800}}>{pct}%</div></div><div style={{fontSize:12,fontWeight:600,textAlign:"center",lineHeight:1.15}}>{label}</div><span style={{color:P.muted,fontSize:11}}>ⓘ</span></div>;
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Reportes</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Analiza el desempeño de tu consulta con información clara y útil para la toma de decisiones.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>▤ Exportar PDF</button><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>◉ Programar envío</button><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>+ Nuevo reporte ▾</button></div>
    </div>
    <div style={{...card2,marginTop:16,padding:"0 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
     <div style={{display:"flex",gap:4,overflowX:"auto"}}>{REP_TABS.map(t=><button key={t} onClick={()=>setRepTab(t)} style={{padding:"13px 11px",fontSize:13,fontWeight:repTab===t?700:500,color:repTab===t?P.purple:P.muted,borderBottom:repTab===t?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>{t}</button>)}</div>
     <select style={{border:`1px solid ${LINE}`,borderRadius:9,padding:"7px 10px",fontSize:13,background:P.white,fontFamily:UI,margin:"8px 0"}} defaultValue="rango"><option value="rango">📅 01 sep 2026 - 17 sep 2026</option></select>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9 8a3 3 0 100-6 3 3 0 000 6z")}<div><div style={{fontSize:23,fontWeight:800}}>{kPac}</div><div style={{fontSize:11.5,color:P.muted}}>Pacientes atendidos</div><div style={{fontSize:11,color:"#16A66A",fontWeight:700}}>↑ 12% vs. mes anterior</div></div></div>
     <div style={kcard}>{kico("#EEEBFD",P.purple,"M8 3v4M16 3v4M4 11a8 8 0 0016 0")}<div><div style={{fontSize:23,fontWeight:800}}>312</div><div style={{fontSize:11.5,color:P.muted}}>Consultas realizadas</div><div style={{fontSize:11,color:"#16A66A",fontWeight:700}}>↑ 8% vs. mes anterior</div></div></div>
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z")}<div><div style={{fontSize:23,fontWeight:800}}>1,024</div><div style={{fontSize:11.5,color:P.muted}}>Órdenes y estudios</div><div style={{fontSize:11,color:"#16A66A",fontWeight:700}}>↑ 18% vs. mes anterior</div></div></div>
     <div style={kcard}>{kico("#E6F6EE","#16A66A","M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6")}<div><div style={{fontSize:23,fontWeight:800}}>{money(kIng)}</div><div style={{fontSize:11.5,color:P.muted}}>Ingresos totales</div><div style={{fontSize:11,color:"#16A66A",fontWeight:700}}>↑ 22% vs. mes anterior</div></div></div>
     <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19l1-5.8L3.5 9.2l5.9-.9z")}<div><div style={{fontSize:23,fontWeight:800}}>4.8</div><div style={{fontSize:11.5,color:P.muted}}>Satisfacción del paciente</div><div style={{fontSize:11,color:"#16A66A",fontWeight:700}}>↑ 0.3 vs. mes anterior</div></div></div>
    </div>
    {/* Fila 1: consultas por día · tipos de consulta · pacientes por edad */}
    <div style={{display:"grid",gridTemplateColumns:"1.1fr 1fr 1fr",gap:14,marginTop:16,alignItems:"start"}} className="mos-rep">
     <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:15,fontWeight:800}}>Consultas por día <span style={{fontSize:12,color:P.muted,fontWeight:500}}>Total: 312</span></div><select style={{border:`1px solid ${LINE}`,borderRadius:8,padding:"5px 8px",fontSize:12,background:P.white,fontFamily:UI}}><option>Últimos 30 días</option></select></div><div style={{display:"flex",alignItems:"flex-end",gap:3,height:130}}>{[10,14,8,17,11,15,20,13,22,24,26,16,30,38,26,30,25,28].map((h,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><div style={{width:"66%",height:h*3,background:i===13?P.purple:"#C9B8FA",borderRadius:"3px 3px 0 0"}}/><span style={{fontSize:8,color:P.muted}}>{i%2===0?`${i+1} sep`:""}</span></div>)}</div></div>
     <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:15,fontWeight:800}}>Tipos de consulta</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver todos</span></div>{donut("#6C5CF6 0 68%,#16A66A 68% 86%,#E5983B 86% 93%,#F0455E 93% 97%,#9AA0BC 97% 100%","312","consultas",[["#6C5CF6","Consulta general","212","68%"],["#16A66A","Control","56","18%"],["#E5983B","Procedimiento","22","7%"],["#F0455E","Vacunación","12","4%"],["#9AA0BC","Otros","10","3%"]])}</div>
     <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:15,fontWeight:800}}>Pacientes por grupo de edad</div><select style={{border:`1px solid ${LINE}`,borderRadius:8,padding:"5px 8px",fontSize:12,background:P.white,fontFamily:UI}}><option>Últimos 30 días</option></select></div><div style={{display:"flex",alignItems:"flex-end",gap:8,height:130}}>{([["< 1",8],["1-4",18],["5-12",26],["13-17",28],["18-39",88],["40-59",70],["≥ 60",44]] as [string,number][]).map(([l,h],i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{width:"60%",height:h,background:"#C9B8FA",borderRadius:"3px 3px 0 0"}}/><span style={{fontSize:9,color:P.muted}}>{l}</span></div>)}</div></div>
    </div>
    {/* Fila 2: diagnósticos (real) · medicamentos · procedimientos */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginTop:16,alignItems:"start"}} className="mos-rep2">
     <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:15,fontWeight:800}}>Diagnósticos principales (CIE-10)</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver todos</span></div>{topDx.map(([code,desc,n,pct],i)=>{const w=topDx[0]?Math.round(n/topDx[0][2]*100):0;return <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0"}}><span style={{fontSize:12,fontWeight:700,color:P.purple,width:46}}>{code}</span><span style={{flex:1,fontSize:12.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{desc}</span><div style={{width:70,height:8,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${w}%`,background:P.purple,borderRadius:6,opacity:.85}}/></div><span style={{fontSize:12.5,fontWeight:700,width:24,textAlign:"right"}}>{n}</span><span style={{fontSize:12,color:P.muted,width:30,textAlign:"right"}}>{pct}%</span></div>;})}</div>
     <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:15,fontWeight:800}}>Medicamentos más prescritos</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver todos</span></div>{([["Metformina",62,20,100],["Losartán",48,15,77],["Paracetamol",45,14,73],["Amoxicilina/Ácido clavulánico",38,12,61],["Omeprazol",32,10,52]] as [string,number,number,number][]).map(([n,c,pc,w])=>barRow(n,"",c,pc,w))}</div>
     <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:15,fontWeight:800}}>Procedimientos más realizados</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver todos</span></div>{([["Aplicación de vacuna",28,18,100],["Curación simple",26,17,93],["Sutura de herida",18,12,64],["Nebulización",15,10,54],["Lavado de oído",12,8,43]] as [string,number,number,number][]).map(([n,c,pc,w])=>barRow(n,"",c,pc,w))}</div>
    </div>
    {/* Fila 3: calidad · origen · comparativo */}
    <div style={{display:"grid",gridTemplateColumns:"1.1fr 1fr 1.1fr",gap:14,marginTop:16,alignItems:"start"}} className="mos-rep3">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:14}}>Indicadores de calidad</div><div style={{display:"flex",justifyContent:"space-around"}}>{ring(92,"Notas completas",P.purple)}{ring(88,"Seguimiento adecuado",P.blue)}{ring(96,"Firma electrónica",P.green)}{ring(85,"Estudios con resultado",P.amber)}</div></div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:12}}>Origen de pacientes</div>{donut("#6C5CF6 0 52%,#1769E0 52% 70%,#E5983B 70% 85%,#F0455E 85% 95%,#9AA0BC 95% 100%",String(kPac),"pacientes",[["#6C5CF6","Consulta directa","129","52%"],["#1769E0","Referido","45","18%"],["#E5983B","Redes sociales","37","15%"],["#F0455E","Seguro médico","25","10%"],["#9AA0BC","Otros","12","5%"]])}</div>
     <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:15,fontWeight:800}}>Comparativo mensual</div><select style={{border:`1px solid ${LINE}`,borderRadius:8,padding:"5px 8px",fontSize:12,background:P.white,fontFamily:UI}}><option>Últimos 6 meses</option></select></div><div style={{display:"flex",gap:14,fontSize:11.5,color:P.muted,marginBottom:8}}><span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:9,height:9,borderRadius:2,background:"#C9B8FA"}}/>Pacientes</span><span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:9,height:9,borderRadius:"50%",background:P.blue}}/>Ingresos (MXN)</span></div><div style={{position:"relative",height:120,display:"flex",alignItems:"flex-end",gap:12}}>{([["Abr",150,120],["May",180,150],["Jun",220,180],["Jul",280,220],["Ago",330,260],["Sep",360,300]] as [string,number,number][]).map(([m,inc,pat],i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,position:"relative"}}><div style={{width:"50%",height:pat/3.2,background:"#C9B8FA",borderRadius:"3px 3px 0 0"}}/><span style={{fontSize:9.5,color:P.muted}}>{m}</span></div>)}<svg width="100%" height="120" viewBox="0 0 300 120" preserveAspectRatio="none" style={{position:"absolute",left:0,top:0,pointerEvents:"none"}}><polyline points="25,70 75,58 125,44 175,30 225,20 275,12" fill="none" stroke={P.blue} strokeWidth="2.5"/>{[[25,70],[75,58],[125,44],[175,30],[225,20],[275,12]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3.5" fill={P.white} stroke={P.blue} strokeWidth="2"/>)}</svg></div></div>
    </div>
    {/* Fila 4: reportes rápidos · programados */}
    <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:14,marginTop:16,alignItems:"start"}} className="mos-rep4">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:12}}>▣ Reportes rápidos</div><div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>{[["◈","Resumen ejecutivo"],["◉","Listado de pacientes"],["▤","Consultas por diagnóstico"],["➤","Ingresos y egresos"],["◐","Uso de medicamentos"],["▨","Productividad médica"]].map(([ic,l],i)=><button key={i} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:11,padding:"14px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,cursor:"pointer",fontFamily:UI}}><span style={{width:34,height:34,borderRadius:9,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center"}}>{ic}</span><span style={{fontSize:11,fontWeight:600,textAlign:"center",lineHeight:1.15}}>{l}</span></button>)}</div></div>
     <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:15,fontWeight:800}}>▣ Reportes programados</div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"6px 11px",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:UI}}>⚙ Configurar</button></div>{[["Reporte semanal","Todos los lunes, 8:00 am",true],["Reporte mensual","Día 1 de cada mes",true],["Reporte de calidad","Cada 3 meses",false]].map(([n,d,on],i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<2?`1px solid #F2F4F9`:"0"}}><span style={{color:P.blue}}>▤</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{n as string}</div><div style={{fontSize:11,color:P.muted}}>{d as string}</div></div><span style={{width:36,height:20,borderRadius:12,background:on?"#16A66A":"#D5D9E6",position:"relative"}}><span style={{position:"absolute",top:2,left:on?18:2,width:16,height:16,borderRadius:"50%",background:"#fff"}}/></span><span style={{color:P.muted}}>›</span></div>)}</div>
    </div>
   </div>;
  })() : view==="biblioteca" ? (()=>{
   // ===== MÓDULO BIBLIOTECA CLÍNICA (S-BIBLIOTECA) — repositorio de conocimiento curado (referencia) =====
   // Contenido de referencia (guías GPC, protocolos, artículos, fuentes externas): presentacional. Las herramientas
   // enlazadas que SÍ son deterministas y reales: Interacciones (verificador cableado), calculadoras (eGFR/IMC/CHA2DS2-VASc/NEWS2).
   const card2:React.CSSProperties={...card,marginTop:0};
   const selSty:React.CSSProperties={border:`1px solid ${LINE}`,borderRadius:9,padding:"8px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const BIB_TABS=["Todo","Guías (GPC)","Protocolos","Calculadoras","Escalas","Artículos","Medicamentos","Videos","Infografías","Plantillas"];
   const ESP:[string,string,number,string][]=[["Medicina general","M12 3a4 4 0 00-4 4c0 3 4 6 4 6s4-3 4-6a4 4 0 00-4-4z",245,P.purple],["Pediatría","M9 8a3 3 0 106 0 3 3 0 00-6 0zM6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2",180,P.blue],["Ginecología","M12 3a4 4 0 100 8 4 4 0 000-8zM12 11v9M9 17h6",120,P.red],["Medicina interna","M12 21C12 21 4 13.5 4 8.5A4 4 0 0112 6a4 4 0 018 2.5C20 13.5 12 21 12 21z",210,P.red],["Urgencias","M12 5v14M5 12h14",95,P.red],["Dermatología","M4 4h16v16H4zM8 8h8v8H8z",80,P.amber],["Psiquiatría","M9 3a3 3 0 00-3 6 3 3 0 001 5 3 3 0 004 2 3 3 0 006 0 3 3 0 004-2 3 3 0 001-5 3 3 0 00-3-6",75,P.purple],["Nutrición","M12 3a5 5 0 015 5c0 4-5 13-5 13S7 12 7 8a5 5 0 015-5z",60,"#16A66A"],["Todas","M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",1250,P.muted]];
   type Feat={badge:string;bc:string;title:string;sub:string;desc:string;src:string;action:string;fav:boolean};
   const FEAT:Feat[]=[
    {badge:"GPC",bc:P.purple,title:"Diabetes mellitus tipo 2",sub:"GPC México 2024",desc:"Diagnóstico, tratamiento y seguimiento del paciente con DM2.",src:"CENETEC | 2024",action:"⤓ Descargar",fav:true},
    {badge:"Protocolo",bc:P.blue,title:"Manejo de la hipertensión arterial",sub:"GPC México 2023",desc:"Abordaje integral y metas de control.",src:"CENETEC | 2023",action:"⤓ Descargar",fav:false},
    {badge:"Calculadora",bc:"#16A66A",title:"Dosis pediátricas",sub:"Calculadora interactiva",desc:"Cálculo de dosis por peso, edad y medicamento.",src:"Medical OS | 2026",action:"▦ Abrir",fav:false},
    {badge:"Escala",bc:P.red,title:"Escala de Glasgow",sub:"Valoración neurológica",desc:"Evaluación del estado de conciencia en adultos y pediátricos.",src:"GPC Internacional | 2023",action:"⊟ Ver",fav:false},
   ];
   const badgeSty=(c:string):React.CSSProperties=>({background:c+"22",color:c,borderRadius:8,padding:"3px 10px",fontSize:11.5,fontWeight:700});
   const FAV=[["Antibióticos en IVU no complicada","GPC México 2024",P.blue],["Vacunación en el adulto","Esquema actualizado 2024",P.red],["Interpretación de EKG","Guía práctica",P.purple],["Dosis pediátricas","Calculadora","#16A66A"],["Manejo de asma","GPC México 2023",P.blue]];
   const REC=[["Colecistitis aguda","Protocolo | hace 2 horas",P.blue],["Insuficiencia renal aguda","GPC | hace 5 horas",P.red],["Anticonceptivos hormonales","Guía | hace 1 día","#16A66A"],["Crisis de ansiedad","Protocolo | hace 2 días",P.purple],["Interpretación de laboratorios","Guía | hace 3 días",P.blue]];
   const UPD=[["GPC Obesidad 2024","Hace 1 semana"],["Calendario de vacunación 2024","Hace 2 semanas"],["Manejo de dengue","Hace 3 semanas"]];
   const SRC=[["CENETEC","México"],["OMS","Internacional"],["PubMed","Artículos"],["AHA","Cardiología"],["ADA","Diabetes"]];
   const listItem=(t:string,s:string,c:string,i:number,last:number)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<last?`1px solid #F2F4F9`:"0"}}><span style={{width:26,height:26,borderRadius:7,background:c+"22",color:c,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2h9l5 5v15H6z"/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontSize:12.5,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t}</div><div style={{fontSize:11,color:P.muted}}>{s}</div></div><span style={{color:P.muted,fontWeight:700,cursor:"pointer"}}>⋯</span></div>;
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="M4 5a2 2 0 012-2h6v18H6a2 2 0 01-2-2zM20 5a2 2 0 00-2-2h-6v18h6a2 2 0 002-2z"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Biblioteca Clínica</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Guías, protocolos, calculadoras, escalas y recursos médicos en un solo lugar.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>↻ Actualizar contenido</button><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>★ Mis favoritos</button><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>+ Subir documento ▾</button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     {([["#EEEBFD",P.purple,"M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2z","1,250+","Guías y protocolos","Nacionales e internacionales"],["#E6F6EE","#16A66A","M4 4h16v16H4zM8 8h8M8 12h8M8 16h4","120+","Calculadoras médicas","Dosis, escalas y más"],["#E7EEFB",P.blue,"M9 3h6l1 4H8zM7 7h10l1 13H6z","500+","Artículos científicos","Acceso a PubMed y revistas"],["#FBF0DC",P.amber,"M12 3a9 9 0 100 18 9 9 0 000-18zM10 8l6 4-6 4z","200+","Recursos educativos","Vídeos, infografías y casos"]] as [string,string,string,string,string,string][]).map(([bg,fg,d,v,l,s])=><div key={l} style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8"><path d={d}/></svg></span><div><div style={{fontSize:22,fontWeight:800}}>{v}</div><div style={{fontSize:12,fontWeight:700}}>{l}</div><div style={{fontSize:11,color:P.muted}}>{s}</div></div></div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16,marginTop:16,alignItems:"start"}} className="mos-bib">
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:16}}>
       <div style={{display:"flex",gap:4,borderBottom:`1px solid ${LINE}`,overflowX:"auto",marginBottom:14}}>{BIB_TABS.map(t=><button key={t} onClick={()=>setBibTab(t)} style={{padding:"10px 11px",fontSize:13,fontWeight:bibTab===t?700:500,color:bibTab===t?P.purple:P.muted,borderBottom:bibTab===t?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>{t}</button>)}</div>
       <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><div style={{position:"relative",flex:1,minWidth:200}}><input placeholder="Buscar en la biblioteca clínica..." style={{...selSty,width:"100%",paddingLeft:32}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" style={{position:"absolute",left:10,top:10}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div><div style={{...selSty,minWidth:120}}><div style={{fontSize:10,color:P.muted}}>Especialidad</div>Todas ▾</div><div style={{...selSty,minWidth:110}}><div style={{fontSize:10,color:P.muted}}>Tipo de recurso</div>Todos ▾</div><div style={{...selSty,minWidth:100}}><div style={{fontSize:10,color:P.muted}}>Fuente</div>Todas ▾</div><button style={{...selSty,cursor:"pointer",fontWeight:600}}>⚟ Más filtros</button></div>
       <div style={{fontSize:16,fontWeight:800,margin:"18px 0 10px"}}>Especialidades</div>
       <div style={{display:"grid",gridTemplateColumns:"repeat(9,1fr)",gap:8}}>{ESP.map(([l,d,n,c])=>{const on=l===bibEsp;return <div key={l} onClick={()=>setBibEsp(l)} style={{border:on?`1.5px solid ${P.purple}`:`1px solid ${LINE}`,borderRadius:11,padding:"12px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer",background:on?"#F7F6FE":P.white}}><span style={{color:c as string}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={d as string}/></svg></span><span style={{fontSize:10.5,fontWeight:700,textAlign:"center",lineHeight:1.1}}>{l}</span><span style={{fontSize:10,color:P.muted}}>({(n as number).toLocaleString("es-MX")})</span></div>;})}</div>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"18px 0 10px"}}><div style={{fontSize:16,fontWeight:800}}>Contenido destacado</div><span style={{fontSize:12.5,color:P.blue,cursor:"pointer"}}>Ver todos</span></div>
       <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>{FEAT.map((f,i)=><div key={i} style={{border:`1px solid ${LINE}`,borderRadius:12,padding:14,display:"flex",flexDirection:"column"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={badgeSty(f.bc)}>{f.badge}</span><span style={{color:f.fav?P.amber:"#C7CCE0",fontSize:15}}>{f.fav?"★":"☆"}</span></div><div style={{fontSize:14.5,fontWeight:700,marginTop:10,lineHeight:1.2}}>{f.title}</div><div style={{fontSize:11.5,color:P.muted,marginTop:2}}>{f.sub}</div><div style={{fontSize:12,color:"#4B5168",marginTop:8,lineHeight:1.4,flex:1,minHeight:48}}>{f.desc}</div><div style={{fontSize:11,color:P.muted,marginTop:8}}>{f.src}</div><button style={{marginTop:10,border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>{f.action}</button></div>)}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}} className="mos-bib2">
       <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:12}}>Herramientas rápidas</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["Calculadora de dosis","Pediátrica y adultos","#16A66A"],["Escalas clínicas","Glasgow, CURB-65, etc.",P.blue],["INTERACCIONES","Interacciones farmacológicas",P.purple],["IMC y superficie corporal","Cálculos antropométricos",P.amber]].map(([t,s,c],i)=><div key={i} onClick={()=>{if((t as string)==="INTERACCIONES"){setView("medicamentos");setMedTab("interacciones");}}} style={{border:`1px solid ${LINE}`,borderRadius:11,padding:12,display:"flex",gap:10,alignItems:"center",cursor:"pointer"}}><span style={{width:34,height:34,borderRadius:9,background:(c as string)+"22",color:c as string,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16v16H4zM8 8h8"/></svg></span><div><div style={{fontSize:12.5,fontWeight:700}}>{t}</div><div style={{fontSize:11,color:P.muted}}>{s}</div></div></div>)}</div></div>
       <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:12}}>Fuentes confiables</div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{SRC.map(([n,s],i)=><div key={i} style={{flex:"1 0 80px",border:`1px solid ${LINE}`,borderRadius:11,padding:"12px 6px",display:"flex",flexDirection:"column",alignItems:"center",gap:5,textAlign:"center"}}><span style={{width:32,height:32,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:800}}>{n.slice(0,2)}</span><span style={{fontSize:11.5,fontWeight:700}}>{n}</span><span style={{fontSize:10,color:P.muted}}>{s}</span></div>)}<div style={{flex:"1 0 80px",border:`1px solid ${LINE}`,borderRadius:11,display:"grid",placeItems:"center",color:P.muted}}>⋯</div></div></div>
      </div>
     </div>
     {/* Columna derecha */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8}}><span style={{color:P.amber}}>★</span>Mis favoritos</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver todos</span></div>{FAV.map(([t,s,c],i)=>listItem(t as string,s as string,c as string,i,FAV.length-1))}</div>
      <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8}}>◔ Recientes</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver todos</span></div>{REC.map(([t,s,c],i)=>listItem(t as string,s as string,c as string,i,REC.length-1))}</div>
      <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8}}>🔔 Actualizaciones</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}}>Ver todos</span></div>{UPD.map(([t,s],i)=><div key={i} style={{display:"flex",gap:9,alignItems:"center",padding:"8px 0",borderBottom:i<UPD.length-1?`1px solid #F2F4F9`:"0"}}><span style={{background:"#E6F6EE",color:"#16A66A",borderRadius:6,padding:"2px 8px",fontSize:10.5,fontWeight:700}}>Nuevo</span><div style={{flex:1}}><div style={{fontSize:12.5,fontWeight:700}}>{t}</div><div style={{fontSize:11,color:P.muted}}>{s}</div></div></div>)}</div>
     </div>
    </div>
    <div style={{...card2,marginTop:16,padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16,background:"linear-gradient(90deg,#F3F0FF,#EEF4FF)"}}>
     <div style={{display:"flex",alignItems:"center",gap:16}}><span style={{fontSize:34}}>📖</span><div><div style={{fontSize:18,fontWeight:800,color:P.purple}}>Conocimiento que mejora vidas</div><div style={{fontSize:13,color:P.muted,marginTop:2}}>Accede a la mejor evidencia científica, siempre actualizada, integrada en tu práctica clínica.</div></div></div>
     <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:UI}}>Explorar biblioteca →</button><div style={{fontSize:12.5,color:P.muted,fontStyle:"italic",maxWidth:240}}>"La buena medicina se basa en el mejor conocimiento disponible."</div></div>
    </div>
   </div>;
  })() : view==="configuracion" ? (()=>{
   // ===== MÓDULO CONFIGURACIÓN (S-CONFIG) — ajustes/preferencias del consultorio (presentacional) =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const lbl:React.CSSProperties={fontSize:12,color:P.muted,fontWeight:600,margin:"0 0 5px"};
   const sec=(ico:string,t:string)=><div style={{fontSize:16,fontWeight:800,display:"flex",alignItems:"center",gap:9,marginBottom:16}}><span style={{width:28,height:28,borderRadius:8,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={ico}/></svg></span>{t}</div>;
   const tog=(on:boolean)=><span style={{width:38,height:22,borderRadius:12,background:on?P.purple:"#D5D9E6",position:"relative",flex:"0 0 auto",cursor:"pointer"}}><span style={{position:"absolute",top:2,left:on?18:2,width:18,height:18,borderRadius:"50%",background:"#fff"}}/></span>;
   const CFG_TABS=["General","Consultorio","Usuarios y permisos","Plantillas","Integraciones","Notificaciones","Seguridad","Respaldo","Suscripción","Avanzado"];
   const clip="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
     <span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.4 2h-4L10 3.9a7 7 0 00-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.4 2.4h4l.4-2.4a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6a7 7 0 00.1-1z"/></svg></span>
     <div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Configuración</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Personaliza tu espacio de trabajo, preferencias y módulos del sistema.</p></div>
    </div>
    <div style={{...card2,marginTop:16,padding:"0 16px",display:"flex",gap:2,overflowX:"auto"}}>{CFG_TABS.map(t=><button key={t} onClick={()=>setCfgTab(t)} style={{padding:"14px 12px",fontSize:13.5,fontWeight:cfgTab===t?700:500,color:cfgTab===t?P.purple:P.muted,borderBottom:cfgTab===t?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>{t}</button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"1.15fr 1fr 0.95fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-cfg">
     {/* Col 1 */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:18}}>{sec(clip,"Información del consultorio")}
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{display:"flex",gap:12,alignItems:"center"}}><span style={{width:52,height:52,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={clip}/></svg></span><div><div style={{fontSize:17,fontWeight:800}}>Clínica Medical OS</div><div style={{fontSize:12,color:P.muted}}>Medicina general y atención integral</div></div></div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"8px 12px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>◉ Cambiar logo</button></div>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><div style={lbl}>Nombre del consultorio</div><input defaultValue="Clínica Medical OS" style={selSty}/></div>
        <div><div style={lbl}>Especialidad principal</div><select style={selSty} defaultValue="Medicina General"><option>Medicina General</option></select></div>
        <div><div style={lbl}>RFC</div><input defaultValue="XAXX010101000" style={selSty}/></div>
        <div><div style={lbl}>Cédula profesional</div><input defaultValue="12345678" style={selSty}/></div>
        <div><div style={lbl}>Dirección</div><input defaultValue="Av. Teófilo Borunda 11811, Chihuahua, Chih." style={selSty}/></div>
        <div><div style={lbl}>Cédula de especialidad (opcional)</div><input placeholder="Ej. 87654321" style={selSty}/></div>
        <div><div style={lbl}>Teléfono</div><input defaultValue="614 123 4567" style={selSty}/></div>
        <div><div style={lbl}>Zona horaria</div><select style={selSty} defaultValue="tz"><option value="tz">(GMT-06:00) Chihuahua</option></select></div>
        <div><div style={lbl}>Correo electrónico</div><input defaultValue="contacto@medicalos.mx" style={selSty}/></div>
        <div><div style={lbl}>Idioma</div><select style={selSty} defaultValue="es"><option value="es">Español (México)</option></select></div>
       </div>
      </div>
      <div style={{...card2,padding:18}}>{sec("M8 2v4M16 2v4M4 8h16M5 6h14v14H5z","Horarios de atención")}
       {([["Lunes","08:00","15:00",true],["Martes","08:00","15:00",true],["Miércoles","08:00","15:00",true],["Jueves","08:00","15:00",true],["Viernes","08:00","15:00",true],["Sábado","08:00","13:00",true],["Domingo","Cerrado","",false]] as [string,string,string,boolean][]).map(([d,a,b,on])=><div key={d} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0"}}><span style={{width:74,fontSize:13,fontWeight:600}}>{d}</span>{on?<><input defaultValue={a} style={{...selSty,width:76,padding:"7px 8px",textAlign:"center"}}/><span style={{color:P.muted}}>–</span><input defaultValue={b} style={{...selSty,width:76,padding:"7px 8px",textAlign:"center"}}/></>:<div style={{...selSty,flex:1,color:P.muted,display:"flex",alignItems:"center",gap:6}}>Cerrado ⏱</div>}<span style={{flex:1}}/>{tog(on)}<span style={{color:P.purple,fontWeight:700,cursor:"pointer",marginLeft:6}}>+</span></div>)}
      </div>
      <div style={{...card2,padding:18}}>{sec("M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7z","Apariencia del sistema")}
       <div style={{display:"flex",gap:24,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div><div style={lbl}>Color principal</div><div style={{display:"flex",gap:8}}>{["#4653C4","#6C5CF6","#1769E0","#20B7D9","#16A66A","#E5983B","#F0455E"].map(c=><span key={c} onClick={()=>setCfgColor(c)} style={{width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",boxShadow:cfgColor===c?`0 0 0 3px ${c}44`:"none",border:cfgColor===c?"2px solid #fff":"none"}}/>)}</div></div>
        <div><div style={lbl}>Tema</div><select style={{...selSty,width:120}} defaultValue="Claro"><option>Claro</option><option>Oscuro</option></select></div>
        <div><div style={lbl}>Tamaño de fuente</div><select style={{...selSty,width:120}} defaultValue="Normal"><option>Normal</option><option>Grande</option></select></div>
       </div>
      </div>
     </div>
     {/* Col 2 */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:18}}>{sec("M9 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z","Preferencias de consulta")}
       {[["Vista por defecto del expediente","Resumen clínico"],["Plantilla de nota médica por defecto","Consulta general (SOAP)"],["Sistema de unidades","Métrico (kg, cm)"],["Calculadora de dosis","Pediátrica y adultos"]].map(([l,v],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:11}}><span style={{fontSize:12.5,color:P.muted}}>{l}</span><select style={{...selSty,width:200}} defaultValue={v as string}><option>{v as string}</option></select></div>)}
       <div style={{borderTop:`1px solid ${LINE}`,marginTop:6,paddingTop:12}}>{[["Mostrar alertas clínicas en tiempo real",true],["Sugerencias de diagnóstico con IA",true],["Recordatorios de estudios y seguimiento",true],["Mostrar interacciones medicamentosas",true],["Modo oscuro (solo para tu cuenta)",false]].map(([l,on],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0"}}><span style={{fontSize:13}}>{l as string}</span>{tog(on as boolean)}</div>)}</div>
      </div>
      <div style={{...card2,padding:18}}>{sec("M8 2v4M16 2v4M4 8h16M5 6h14v14H5z","Configuraciones regionales")}
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><div style={lbl}>País</div><select style={selSty} defaultValue="México"><option>México</option></select></div>
        <div><div style={lbl}>Estado</div><select style={selSty} defaultValue="Chihuahua"><option>Chihuahua</option></select></div>
        <div><div style={lbl}>Ciudad</div><select style={selSty} defaultValue="Chihuahua"><option>Chihuahua</option></select></div>
        <div><div style={lbl}>Código postal</div><input defaultValue="31223" style={selSty}/></div>
        <div><div style={lbl}>Formato de fecha</div><select style={selSty} defaultValue="d"><option value="d">dd/mm/aaaa (17/09/2026)</option></select></div>
        <div><div style={lbl}>Formato de hora</div><select style={selSty} defaultValue="h"><option value="h">24 horas (13:45)</option></select></div>
        <div><div style={lbl}>Moneda</div><select style={selSty} defaultValue="MXN"><option value="MXN">MXN - Peso Mexicano</option></select></div>
        <div><div style={lbl}>Impuestos (IVA)</div><select style={selSty} defaultValue="16"><option value="16">16%</option></select></div>
       </div>
      </div>
      <div style={{...card2,padding:18}}>{sec("M18 3a3 3 0 00-3 3M6 21a3 3 0 003-3M4 7h16v10H4z","Datos y seguridad")}
       <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{flex:1,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>↧ Exportar mis datos</button><button style={{flex:1,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>↻ Respaldar ahora</button><button style={{flex:1,border:"1px solid #F6C9D0",background:"#FDECEE",color:P.red,borderRadius:10,padding:"11px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>🗑 Eliminar mi cuenta</button></div>
       <div style={{fontSize:12,color:P.muted,marginTop:12,display:"flex",gap:7,alignItems:"center"}}><span style={{color:"#16A66A"}}>🛡</span>Tus datos están cifrados y protegidos conforme a la NOM-024-SSA3-2012.</div>
      </div>
     </div>
     {/* Col 3 */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:18}}>{sec("M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9 8a3 3 0 100-6 3 3 0 000 6z","Tu cuenta")}
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{display:"flex",gap:11,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:14,fontWeight:700}}>LG</span><div><div style={{fontSize:14,fontWeight:700}}>Dr. Luis Godinez</div><div style={{fontSize:11.5,color:P.muted}}>Médico General · Cédula: 12345678</div></div></div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"7px 11px",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:UI}}>Cambiar foto</button></div>
       {[["Nombre completo","Dr. Luis Godinez"],["Correo electrónico","luis@medicalos.mx"],["Teléfono","614 123 4567"]].map(([l,v])=><div key={l} style={{marginBottom:11}}><div style={lbl}>{l}</div><input defaultValue={v} style={selSty}/></div>)}
       <div><div style={lbl}>Contraseña</div><div style={{display:"flex",gap:8}}><input type="password" defaultValue="password" style={{...selSty,flex:1}}/><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"0 14px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>Cambiar</button></div></div>
      </div>
      <div style={{...card2,padding:18}}>{sec("M3 17l6-6 4 4 8-8","Firma y sello")}
       <div style={{border:`1px solid ${LINE}`,borderRadius:11,padding:18,textAlign:"center"}}><svg width="120" height="40" viewBox="0 0 120 40" style={{margin:"0 auto"}}><path d="M8 28 Q20 8 32 24 T56 20 Q70 12 78 26" fill="none" stroke={P.ink} strokeWidth="1.6"/></svg><div style={{fontWeight:700,fontSize:13,marginTop:6}}>Dr. Luis Godinez</div><div style={{fontSize:11,color:P.muted}}>Médico General</div><div style={{fontSize:11,color:P.muted}}>Ced. Prof. 12345678</div></div>
       <div style={{display:"flex",gap:10,marginTop:12}}><button style={{flex:1,border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>↥ Subir firma</button><button style={{flex:1,border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>◉ Configurar sello</button></div>
      </div>
      <div style={{...card2,padding:18}}>{sec("M13 7l-6 6a3 3 0 004 4l6-6M11 17l6-6a3 3 0 00-4-4l-6 6","Integraciones rápidas")}
       {[["Correo (SMTP)"],["WhatsApp Business"],["Laboratorio"],["PACS / Imagenología"],["EMR externo (HL7/FHIR)"]].map(([n],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<4?`1px solid #F2F4F9`:"0"}}><span style={{display:"flex",alignItems:"center",gap:9,fontSize:13,fontWeight:500}}><span style={{width:26,height:26,borderRadius:7,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center"}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16v16H4z"/></svg></span>{n}</span><button style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:8,padding:"5px 13px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:UI}}>Conectar</button></div>)}
      </div>
     </div>
    </div>
    {/* Módulos activos + Guardar */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 380px",gap:16,marginTop:16,alignItems:"start"}} className="mos-cfg2">
     <div style={{...card2,padding:18}}>{sec("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z","Módulos activos")}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 24px"}}>{["Pacientes","Agenda","Consulta","Resultados","Órdenes","Interconsultas","Seguimiento","Facturación","Documentos","Obligaciones","Clinical Intelligence","Reportes","Biblioteca clínica"].map((m,i)=><div key={m} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid #F6F7FB`}}><span style={{display:"flex",alignItems:"center",gap:9,fontSize:13}}><span style={{color:P.purple}}>▤</span>{m}</span>{tog(true)}</div>)}</div>
     </div>
     <div style={{...card2,padding:18,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:14,fontWeight:700}}>Guardar configuración</div>
      <div style={{fontSize:12.5,color:P.muted,lineHeight:1.5}}>Los cambios se aplican a tu espacio de trabajo. Algunas preferencias son por cuenta y otras a nivel del consultorio.</div>
      {cfgSaved&&<div style={{padding:"9px 12px",borderRadius:9,background:"#E6F6EE",fontSize:12.5,color:"#166534",fontWeight:600}}>Cambios guardados ✓ <span style={{color:P.muted,fontWeight:400}}>(preferencia local; sin backend de settings)</span></div>}
      <button onClick={()=>{setCfgSaved(true);}} style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:UI}}>✓ Guardar cambios</button>
     </div>
    </div>
   </div>;
  })() : (<>
  {/* PATIENT HEADER — contexto del paciente SIEMPRE visible (design-contract) */}
  <div style={patientBar}>
   <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
    <span style={{width:38,height:38,borderRadius:"50%",background:patientName?"#E7EEFB":"#EFF1F5",color:patientName?P.blue:P.muted,display:"grid",placeItems:"center",fontWeight:700,fontSize:14,flex:"0 0 auto"}}>{patientName?patientName.trim().slice(0,2).toUpperCase():"—"}</span>
    <div style={{minWidth:0}}>
     <div style={{fontSize:15,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{patientName||"Paciente anónimo"}</div>
     <div style={{fontSize:12,color:P.muted,marginTop:1}}>ID <span style={mono}>{patientId.slice(0,8)}</span> · paciente activo del expediente</div>
    </div>
   </div>
   <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",justifyContent:"flex-end"}}>
    {summary&&(anyAlert
     ? <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        {highGaps>0&&safetyChip(highGaps,"críticos","crit",alertGlyph)}
        {summary.activeAllergies>0&&safetyChip(summary.activeAllergies,"alergias","warn")}
        {summary.openResults>0&&safetyChip(summary.openResults,"result. abiertos","warn")}
        {summary.openObligations>0&&safetyChip(summary.openObligations,"obligaciones","warn")}
       </div>
     : <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#EAF7EF",color:"#1A7F43",border:"1px solid #CDEBD8",borderRadius:999,padding:"4px 12px",fontSize:12.5,fontWeight:600,whiteSpace:"nowrap"}}>✓ Sin alertas de seguridad</span>
    )}
    <button style={{...ghost,padding:"7px 12px",fontSize:13,flex:"0 0 auto"}} onClick={reset}>+ Paciente anónimo</button>
   </div>
  </div>
  <main className="mos-grid">
  {/* HERO — Vista principal · Durante la consulta (panel 1, snapshot determinista) */}
  {snap&&(()=>{
   const d=snap.demographics;
   const dx=[...new Set(snap.problems.map(DX_LABEL))].slice(0,6);
   const bp=snap.vitals["BP"],hr=snap.vitals["HR"];
   const vcard=(label:string,value:string|number|undefined,unit:string,sub:string,warn?:boolean)=>(
    <div style={{minWidth:0,background:"#fff",border:`1px solid ${warn?"#F0DBB8":LINE}`,borderRadius:14,padding:"14px 16px"}}>
     <div style={{fontSize:12,color:P.muted,marginBottom:4}}>{label}</div>
     <div style={{fontSize:24,fontWeight:800,letterSpacing:"-.01em",color:warn?"#A15C00":P.ink}}>{value??"—"} <span style={{fontSize:13,fontWeight:600,color:P.muted}}>{value!==undefined?unit:""}</span></div>
     <div style={{fontSize:11.5,color:P.muted,marginTop:2}}>{sub||" "}</div>
    </div>);
   const tabs:[string,string?][]=[["Resumen"],["Historia","Timeline del paciente"],["Medicamentos","Medicación"],["Resultados","Resultados diagnósticos"],["Problemas","Lista de problemas"],["Plan","Plan de cuidados"],["Seguimiento","Obligaciones de seguimiento"]];
   return <section className="span2" style={{...card,marginTop:0,padding:0,overflow:"hidden"}}>
    <div style={{padding:"18px 22px",borderBottom:`1px solid ${LINE}`,background:"linear-gradient(180deg,#FBFCFE,#fff)"}}>
     <div style={{fontSize:17,fontWeight:800,letterSpacing:"-.01em"}}>Vista principal · Durante la consulta</div>
     <div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Toda la información crítica, en el momento correcto.</div>
    </div>
    <div className="mos-hero-grid">
     <div style={{padding:22,borderRight:`1px solid ${LINE}`}}>
      <div style={{display:"flex",gap:14,alignItems:"center"}}>
       <span style={{width:52,height:52,borderRadius:"50%",background:"#E7EEFB",color:P.blue,display:"grid",placeItems:"center",fontWeight:800,fontSize:18,flex:"0 0 auto"}}>{(patientName||"P").trim().slice(0,2).toUpperCase()}</span>
       <div style={{minWidth:0}}>
        <div style={{fontSize:19,fontWeight:800}}>{patientName||"Paciente"}</div>
        <div style={{fontSize:13,color:P.muted}}>{d.age} años · {SEX_ES[d.sex]??d.sex} · ID <span style={mono}>{patientId.slice(0,8)}</span></div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>{dx.length?dx.map(x=><span key={x} style={{background:"#EEF3FB",color:"#2C5AA6",border:"1px solid #D3E0F5",borderRadius:8,padding:"2px 9px",fontSize:12,fontWeight:600}}>{x}</span>):<span style={{fontSize:12,color:P.muted}}>Sin diagnósticos activos</span>}</div>
       </div>
      </div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:16,borderBottom:`1px solid ${LINE}`}}>
       {tabs.map(([t,h2],i)=><button key={t} onClick={()=>h2&&scrollToSection(h2)} style={{background:"transparent",border:0,borderBottom:i===0?`2px solid ${P.blue}`:"2px solid transparent",color:i===0?P.blue:P.muted,fontWeight:i===0?700:500,fontSize:13,fontFamily:UI,padding:"7px 10px",cursor:"pointer"}}>{t}</button>)}
      </div>
      <div style={{fontSize:13,fontWeight:700,margin:"16px 0 10px"}}>Estado clínico actual</div>
      <div className="mos-vitals">
       {vcard("Presión arterial",bp,"mmHg",hr?`FC ${hr} lpm`:"")}
       {vcard("Glucosa",snap.labs.glucose,"mg/dL","")}
       {vcard("HbA1c",snap.labs.hba1c,"%",snap.labs.hba1c!==undefined?(snap.labs.hba1c<7?"En meta (<7%)":"Sobre meta"):"",snap.labs.hba1c!==undefined&&snap.labs.hba1c>=7)}
       {vcard("TFG (eGFR)",snap.labs.egfr,"mL/min",snap.labs.egfrStage?`ERC ${snap.labs.egfrStage}`:"",!!snap.labs.egfrStage&&snap.labs.egfrStage!=="G1"&&snap.labs.egfrStage!=="G2")}
      </div>
      <div style={{fontSize:13,fontWeight:700,margin:"18px 0 8px"}}>Problemas activos</div>
      {snap.problems.length?<div style={{display:"flex",flexDirection:"column",gap:6}}>{snap.problems.slice(0,6).map(c=><div key={c} style={{display:"flex",alignItems:"center",gap:10,fontSize:13.5}}><span style={{width:7,height:7,borderRadius:"50%",background:P.blue,flex:"0 0 auto"}}/>{DX_LABEL(c)} <span style={mono}>{c}</span></div>)}</div>:<div style={{fontSize:13,color:P.muted}}>Sin problemas activos.</div>}
     </div>
     <div style={{padding:22,display:"flex",flexDirection:"column",gap:18,background:"#FCFDFF"}}>
      <div>
       <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Alergias y seguridad</div>
       {snap.allergies.length?<div style={{display:"flex",flexDirection:"column",gap:6}}>{snap.allergies.slice(0,5).map(a=><div key={a} style={{display:"flex",alignItems:"center",gap:8,fontSize:13.5,color:"#B3261E",fontWeight:600}}><span style={{width:8,height:8,borderRadius:"50%",background:"#B3261E",flex:"0 0 auto"}}/>{a}</div>)}</div>:<div style={{display:"flex",alignItems:"center",gap:8,fontSize:13.5,color:"#1A7F43",fontWeight:600}}>✓ Sin alergias conocidas</div>}
      </div>
      <div style={{borderTop:`1px solid ${LINE}`,paddingTop:16}}>
       <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Alertas y sugerencias</div>
       <div style={{fontSize:11.5,color:P.muted,marginBottom:10}}>Reglas + guías · determinista, sin IA generativa</div>
       {snap.findings.length?<div style={{display:"flex",flexDirection:"column",gap:8}}>{snap.findings.slice(0,6).map((f,i)=>{const s=SEV[f.severity]??SEV.INFO;return <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"9px 11px",borderRadius:10,background:s.bg,border:`1px solid ${s.bd}`}}>
        <span style={{background:"#fff",color:s.fg,border:`1px solid ${s.bd}`,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:800,letterSpacing:".03em",whiteSpace:"nowrap",marginTop:1}}>{s.label}</span>
        <span style={{fontSize:13,color:"#33383F",lineHeight:1.4}}>{f.summary}</span>
       </div>;})}</div>:<div style={{fontSize:13,color:"#1A7F43",fontWeight:600}}>✓ Sin alertas clínicas.</div>}
      </div>
     </div>
    </div>
   </section>;
  })()}
  {/* SEGUIMIENTO AUTOMÁTICO (panel 5) — Zero-Lost-Follow-Up desde timeline + care-gaps */}
  <section style={card}>
   <div><h2 style={{fontSize:18,margin:0}}>Seguimiento automático</h2><p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Nada se pierde. Todo se coordina. Obligaciones e interconsultas con owner y cierre.</p></div>
   {(()=>{
    const fromTl=(tl??[]).filter(t=>FOLLOW_TYPES.has(t.aggregateType)).map(t=>({label:TYPE_LABEL[t.aggregateType]??t.aggregateType,kind:t.latestKind,at:t.lastAt,status:followState(t.latestKind),type:t.aggregateType}));
    const fromGaps=(gaps??[]).map(g=>({label:g.label,kind:g.priority,at:"",status:"pend" as const,type:g.aggregateType}));
    const all=[...fromTl.filter(x=>x.status!=="skip"),...fromGaps];
    const counts={pend:all.filter(x=>x.status==="pend").length,prog:all.filter(x=>x.status==="prog").length,done:all.filter(x=>x.status==="done").length,all:all.length};
    const shown=followTab==="all"?all:all.filter(x=>x.status===followTab);
    const tabs:[typeof followTab,string,number][]=[["pend","Pendientes",counts.pend],["prog","Programados",counts.prog],["done","Completados",counts.done],["all","Todos",counts.all]];
    const sb=(s:string)=>s==="pend"?{bg:"#FFF4E5",fg:"#A15C00",t:"Pendiente"}:s==="prog"?{bg:"#EAF3FF",fg:"#1F5FB0",t:"Programado"}:{bg:"#EAF7EF",fg:"#1A7F43",t:"Completado"};
    return <>
     <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:12,borderBottom:`1px solid ${LINE}`}}>
      {tabs.map(([k,l,n])=><button key={k} onClick={()=>setFollowTab(k)} style={{background:"transparent",border:0,borderBottom:followTab===k?`2px solid ${P.blue}`:"2px solid transparent",color:followTab===k?P.blue:P.muted,fontWeight:followTab===k?700:500,fontSize:13,fontFamily:UI,padding:"7px 10px",cursor:"pointer"}}>{l} {n>0&&<span style={{fontVariantNumeric:"tabular-nums"}}>({n})</span>}</button>)}
     </div>
     {shown.length?<div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>{shown.slice(0,8).map((x,i)=>{const s=sb(x.status);const stripe=x.status==="pend"?"#C87B12":x.status==="prog"?"#1769E0":"#168B5B";return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px 10px 14px",border:`1px solid ${LINE}`,borderLeft:`3px solid ${stripe}`,borderRadius:10}}>
      <div style={{minWidth:0}}><div style={{fontSize:13.5,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{x.label}</div><div style={{fontSize:11.5,color:P.muted}}>{x.at?relTime(x.at):"seguimiento clínico"}</div></div>
      <span style={{background:s.bg,color:s.fg,fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap"}}>{s.t}</span>
     </div>;})}</div>:<div style={{marginTop:12,padding:"12px 14px",borderRadius:12,background:"#f4faf6",border:"1px solid #d6ecdd",fontSize:13,color:"#1a7f43"}}>✓ Sin seguimientos {followTab==="pend"?"pendientes":followTab==="prog"?"programados":followTab==="done"?"completados":"registrados"}.</div>}
     <div style={{display:"flex",alignItems:"center",gap:8,marginTop:14,padding:"10px 14px",borderRadius:12,background:"#EAF7EF",border:"1px solid #CDEBD8",fontSize:12.5,color:"#1A7F43",fontWeight:600}}>✓ Seguimiento activo — el sistema mantiene owner, estado y cierre de cada obligación (Zero-Lost-Follow-Up).</div>
    </>;
   })()}
  </section>

  {/* SEGURIDAD Y AUDITORÍA (panel 7) — estado del sistema + actividad desde la cadena de auditoría */}
  <section className="span2" style={card}>
   <div><h2 style={{fontSize:18,margin:0}}>Seguridad y auditoría</h2><p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Confianza por diseño. Cada acción clínica queda registrada.</p></div>
   <div className="mos-rx-grid">
    <div style={{background:"linear-gradient(160deg,#0C2148,#15346B)",borderRadius:14,padding:"16px 18px",color:"#EAF0FA"}}>
     <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{width:22,height:22,borderRadius:"50%",background:"#1A7F43",display:"grid",placeItems:"center",fontSize:13}}>✓</span><b style={{fontSize:14}}>Estado del sistema</b></div>
     {[["Cifrado de datos","En tránsito y en reposo"],["Control de acceso","Por roles y aislamiento por tenant (RLS)"],["Auditoría","Cadena hash inmutable · todas las acciones"],["Recuperabilidad","Replay determinista + idempotencia"],["Cumplimiento","NOM-004 · NOM-024 · LFPDPPP"]].map(([t,d])=><div key={t} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"7px 0",borderTop:"1px solid #ffffff14"}}>
      <span style={{color:"#5FD08C",marginTop:1,flex:"0 0 auto"}}>●</span><div><div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{t}</div><div style={{fontSize:11.5,color:"#9DB2D4"}}>{d}</div></div>
     </div>)}
    </div>
    <div>
     <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Actividad reciente</div>
     {tl&&tl.length?<div style={{display:"flex",flexDirection:"column",gap:2}}>{tl.slice(0,7).map((t,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderBottom:i<6?`1px solid ${LINE}`:"0"}}>
      <span style={{width:26,height:26,borderRadius:8,background:"#EEF3FB",color:P.blue,display:"grid",placeItems:"center",fontSize:11,fontWeight:800,flex:"0 0 auto"}}>{(TYPE_LABEL[t.aggregateType]??t.aggregateType).slice(0,1)}</span>
      <div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{TYPE_LABEL[t.aggregateType]??t.aggregateType} · <span style={{color:P.muted,fontWeight:500}}>{t.latestKind}</span></div><div style={{fontSize:11.5,color:P.muted}}>{relTime(t.lastAt)}</div></div>
     </div>)}</div>:<div style={{fontSize:13,color:P.muted,padding:"12px 0"}}>Sin actividad registrada para este paciente todavía.</div>}
    </div>
   </div>
  </section>

  {/* PORTAL DEL PACIENTE (panel 6) — vista previa (solo lectura) del app del paciente, desde datos reales */}
  <section style={card}>
   <div><h2 style={{fontSize:18,margin:0}}>Portal del paciente</h2><p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Informado. Involucrado. Vista previa (solo lectura) de lo que ve el paciente en su app.</p></div>
   {(()=>{
    const t=tl??[];
    const appts=t.filter(x=>x.aggregateType==="Appointment");
    const nextAppt=appts.find(x=>x.latestKind==="SCHEDULED"||x.latestKind==="CHECKED_IN");
    const resultsN=t.filter(x=>x.aggregateType==="DiagnosticResult").length;
    const medsN=t.filter(x=>x.aggregateType==="Medication"&&!CANCEL_KINDS.has(x.latestKind)).length;
    const followN=(gaps?.length??0)+t.filter(x=>x.aggregateType==="ClinicalObligation"&&followState(x.latestKind)==="pend").length;
    const first=(patientName||"Paciente").trim().split(/\s+/)[0];
    const row=(icon:React.ReactNode,title:string,sub:string,badge?:number,soon?:boolean)=>(
     <div style={{display:"flex",alignItems:"center",gap:11,padding:"11px 13px",background:"#fff",borderBottom:`1px solid ${LINE}`}}>
      <span style={{width:30,height:30,borderRadius:9,background:soon?"#F1F4F9":"#E7EEFB",color:soon?P.muted:P.blue,display:"grid",placeItems:"center",flex:"0 0 auto"}}>{icon}</span>
      <div style={{minWidth:0,flex:1}}><div style={{fontSize:12.5,fontWeight:700}}>{title}</div><div style={{fontSize:10.5,color:P.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sub}</div></div>
      {soon?<span style={{fontSize:9,fontWeight:700,color:P.muted,background:"#F1F4F9",borderRadius:999,padding:"2px 7px",flex:"0 0 auto"}}>Próximamente</span>
       :badge!==undefined&&badge>0?<span style={{fontSize:10,fontWeight:800,color:"#fff",background:"#C9364A",borderRadius:999,minWidth:17,height:17,display:"grid",placeItems:"center",padding:"0 4px",flex:"0 0 auto"}}>{badge}</span>
       :<span style={{color:"#C3CAD6",flex:"0 0 auto"}}>›</span>}
     </div>);
    const pIcon=(d:string)=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d}/></svg>;
    return <div className="mos-phone">
     <div className="screen">
      <div style={{background:"linear-gradient(150deg,#1769E0,#20B7D9)",padding:"16px 16px 18px",color:"#fff"}}>
       <div style={{fontSize:10,fontWeight:800,letterSpacing:".12em",opacity:.9}}>MEDICAL OS</div>
       <div style={{display:"flex",alignItems:"center",gap:10,marginTop:12}}>
        <span style={{width:40,height:40,borderRadius:"50%",background:"#ffffff2e",display:"grid",placeItems:"center",fontWeight:700,fontSize:15}}>{(patientName||"P").trim().slice(0,2).toUpperCase()}</span>
        <div><div style={{fontSize:16,fontWeight:800}}>Hola, {first}</div><div style={{fontSize:11.5,opacity:.9}}>Tu salud en tus manos</div></div>
       </div>
      </div>
      <div>
       {row(pIcon("M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"),"Mis citas",nextAppt?`Próxima cita agendada`:appts.length?"Citas registradas":"Sin citas próximas")}
       {row(pIcon("M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"),"Mis resultados",resultsN?`${resultsN} estudio(s) · laboratorios e imágenes`:"Sin resultados aún")}
       {row(pIcon("M10 4l10 10-6 6L4 10z"),"Mis medicamentos",medsN?`${medsN} tratamiento(s) actual(es)`:"Sin medicamentos activos")}
       {row(pIcon("M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6"),"Mi seguimiento","Pendientes y recordatorios",followN)}
       {row(pIcon("M4 5h16v11H8l-4 4z"),"Mensajes","Comunicación con tu equipo",undefined,true)}
       {row(pIcon("M4 5h11v14H4zM15 5h5v14h-5"),"Educación para mi salud","Artículos y recomendaciones",undefined,true)}
      </div>
      <div className="mos-pnav">
       <div><span style={{color:P.blue}}>{pIcon("M4 11l8-6 8 6M6 10v9h12v-9")}</span><span style={{color:P.blue,fontWeight:700}}>Inicio</span></div>
       <div>{pIcon("M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3")}<span>Resultados</span></div>
       <div>{pIcon("M4 5h16v11H8l-4 4z")}<span>Mensajes</span></div>
       <div>{pIcon("M4 6h16M4 12h16M4 18h16")}<span>Más</span></div>
      </div>
     </div>
    </div>;
   })()}
   <p style={{fontSize:11,color:P.muted,textAlign:"center",marginTop:12}}>Espejo de solo lectura del expediente. El paciente no edita el registro clínico.</p>
  </section>

  {/* PANEL / WORKLIST POBLACIONAL */}
  <section style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <h2 style={{fontSize:18,margin:0}}>Panel del clínico</h2>
    <button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={loadPanel}>{busy==="panel"?"Cargando…":"Cargar worklist"}</button>
   </div>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Pendientes clínicos accionables de TODO el panel (todos los pacientes del tenant), priorizados. Inteligencia por reglas, sin IA.</p>
   {panel&&<div style={{marginTop:12}}>
    {panel.gaps.length===0?<div style={{padding:"10px 14px",borderRadius:12,background:"#f4faf6",border:"1px solid #d6ecdd",fontSize:13,color:"#1a7f43"}}>✓ Sin pendientes accionables en el panel.</div>
     :<div><div style={{fontSize:12,color:"#6d6e80",marginBottom:8}}>{panel.gaps.length} pendientes · {panel.patientCount} pacientes</div>
     <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:280,overflowY:"auto"}}>{panel.gaps.map(g=>{const col=g.priority==="HIGH"?["#fdeaea","#b3261e"]:g.priority==="MEDIUM"?["#fff4e5","#a15c00"]:["#eef0ff","#3f3aa0"];return <div key={g.patientId+g.aggregateId+g.code} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 12px",border:"1px solid #eceafb",borderRadius:10}}>
      <div style={{minWidth:0}}><span style={{...mono,marginRight:8}}>{g.patientId.slice(0,8)}</span><span style={{fontSize:13}}>{g.label}</span></div>
      <div style={{display:"flex",gap:8,alignItems:"center",whiteSpace:"nowrap"}}><span style={{display:"inline-block",background:col[0],color:col[1],fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:999}}>{g.priority}</span><button style={{...ghost,padding:"5px 10px",fontSize:12}} onClick={()=>selectPatientRaw(g.patientId,"")}>Abrir</button></div>
     </div>;})}</div></div>}
   </div>}
  </section>

  {/* PACIENTE (registro / selección) */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Paciente</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Registra un paciente o selecciónalo de la lista. El chart de abajo es del paciente activo.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 160px 150px auto",gap:10,marginTop:12,alignItems:"center"}}>
    <input style={input} value={regName} onChange={e=>setRegName(e.target.value)} placeholder="Nombre completo" />
    <input style={input} type="date" value={regDob} onChange={e=>setRegDob(e.target.value)} />
    <select style={input} value={regSex} onChange={e=>setRegSex(e.target.value)}><option value="FEMALE">Femenino</option><option value="MALE">Masculino</option><option value="INTERSEX">Intersexual</option><option value="UNKNOWN">Sin especificar</option></select>
    <button style={btn} disabled={busy!==""||!regName} onClick={()=>registerPatient()}>{busy==="pt-reg"?"Registrando…":"Registrar"}</button>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:10}}>
    <input style={input} value={regExtra.curp} onChange={e=>setRegExtra(x=>({...x,curp:e.target.value.toUpperCase()}))} placeholder="CURP" maxLength={18} />
    <input style={input} value={regExtra.phone} onChange={e=>setRegExtra(x=>({...x,phone:e.target.value}))} placeholder="Teléfono" />
    <input style={input} value={regExtra.email} onChange={e=>setRegExtra(x=>({...x,email:e.target.value}))} placeholder="Correo electrónico" />
    <input style={input} value={regExtra.address} onChange={e=>setRegExtra(x=>({...x,address:e.target.value}))} placeholder="Dirección (ciudad, estado)" />
    <input style={input} value={regExtra.occupation} onChange={e=>setRegExtra(x=>({...x,occupation:e.target.value}))} placeholder="Ocupación" />
    <select style={input} value={regExtra.maritalStatus} onChange={e=>setRegExtra(x=>({...x,maritalStatus:e.target.value}))}><option value="">Estado civil…</option><option>Soltero(a)</option><option>Casado(a)</option><option>Unión libre</option><option>Divorciado(a)</option><option>Viudo(a)</option></select>
   </div>
   <div style={{marginTop:10}}><button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={loadPatients}>{busy==="pt-list"?"Cargando…":"Cargar / buscar pacientes"}</button></div>
   {patientList&&<div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6,maxHeight:220,overflowY:"auto"}}>
    {patientList.length===0?<p style={{color:"#8a8b9a",fontSize:13}}>No hay pacientes registrados en este tenant.</p>
     :patientList.map(p=><div key={p.patientId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",border:"1px solid #eceafb",borderRadius:10,background:p.patientId===patientId?"#f4f3fb":"white"}}>
      <div><b style={{fontSize:14}}>{p.name}</b> <span style={stateBadge(p.status==="ACTIVE"?"ACTIVE":p.status==="INACTIVE"?"INACTIVE":"CANCELLED")}>{p.status}</span></div>
      <button style={{...ghost,padding:"6px 12px"}} onClick={()=>selectPatientRaw(p.patientId,p.name)}>{p.patientId===patientId?"Activo":"Seleccionar"}</button>
     </div>)}
   </div>}
  </section>

  {/* TIMELINE DEL PACIENTE */}
  <section style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <h2 style={{fontSize:18,margin:0}}>Timeline del paciente</h2>
    <div style={{display:"flex",gap:8}}>
     <button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={exportRecord}>{busy==="exp"?"Exportando…":"Exportar expediente"}</button>
     <button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={loadTimeline}>{busy==="tl"?"Cargando…":"Actualizar"}</button>
    </div>
   </div>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Vista longitudinal de los items clínicos de este paciente (metadatos, sin contenido).</p>
   {exportInfo&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:12,background:"#f4f3fb",border:"1px solid #e0ddf3",fontSize:12}}>
    <b style={{color:"#3f3aa0"}}>Expediente exportado (NOM-024)</b> · {exportInfo.aggregateCount} agregados · {exportInfo.eventCount} eventos<br/>
    <span style={{color:"#6d6e80"}}>hash reproducible del contenido: </span><span style={mono}>{exportInfo.contentHash}</span>
   </div>}
   {tl===null?<p style={{color:"#8a8b9a",fontSize:13,marginTop:12}}>Pulsa “Actualizar” para cargar el historial de este paciente.</p>
    :tl.length===0?<p style={{color:"#8a8b9a",fontSize:13,marginTop:12}}>Sin items registrados para este paciente todavía.</p>
    :<div>
     {(()=>{const s=summarizePatient(tl);const stat=(n:number,l:string,warn=false)=>(<div style={{flex:"1 1 90px",minWidth:90,textAlign:"center",padding:"10px 8px",borderRadius:12,background:warn&&n>0?"#fff4e5":"#f6f6fb",border:"1px solid #eceafb"}}><div style={{fontSize:22,fontWeight:800,color:warn&&n>0?"#a15c00":"#3f3aa0"}}>{n}</div><div style={{fontSize:11,color:"#6d6e80"}}>{l}</div></div>);
      return <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>{stat(s.activeAllergies,"Alergias activas",true)}{stat(s.activeProblems,"Problemas activos")}{stat(s.signedEncounters,"Encuentros firmados")}{stat(s.activeMedications,"Medicación activa")}{stat(s.openResults,"Resultados abiertos",true)}{stat(s.openOrders,"Órdenes pendientes")}{stat(s.openObligations,"Obligaciones abiertas",true)}{stat(s.openReferrals,"Interconsultas abiertas")}{stat(s.upcomingAppointments,"Citas próximas")}{stat(s.pendingImmunizations,"Vacunas pendientes",true)}{stat(s.activeCarePlans,"Metas activas")}{stat(s.openClaims,"Facturas abiertas")}{stat(s.grantedConsents,"Consentimientos vigentes")}{stat(s.activeAdmissions,"Internamientos activos",true)}</div>;})()}
     {gaps&&gaps.length>0&&<div style={{marginTop:16,padding:14,borderRadius:12,background:"#fbf7f2",border:"1px solid #f0e2cf"}}>
      <div style={{fontSize:13,fontWeight:700,color:"#8a5a12",marginBottom:8}}>⚑ Pendientes clínicos (care gaps) · {gaps.length}</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>{gaps.map(g=>{const col=g.priority==="HIGH"?["#fdeaea","#b3261e"]:g.priority==="MEDIUM"?["#fff4e5","#a15c00"]:["#eef0ff","#3f3aa0"];return <div key={g.aggregateId+g.code} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 12px",background:"white",border:"1px solid #eceafb",borderRadius:10}}>
       <span style={{fontSize:13}}>{g.label}</span>
       <span style={{display:"inline-block",background:col[0],color:col[1],fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap"}}>{g.priority}</span>
      </div>;})}</div>
     </div>}
     {gaps&&gaps.length===0&&<div style={{marginTop:16,padding:"10px 14px",borderRadius:12,background:"#f4faf6",border:"1px solid #d6ecdd",fontSize:13,color:"#1a7f43"}}>✓ Sin pendientes clínicos accionables para este paciente.</div>}
     <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
     {tl.map(x=><div key={x.aggregateId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",border:"1px solid #eceafb",borderRadius:10}}>
      <div><b style={{fontSize:14}}>{TYPE_LABEL[x.aggregateType]??x.aggregateType}</b> <span style={{...mono,marginLeft:6}}>{x.aggregateId.slice(0,8)}</span></div>
      <div style={{display:"flex",gap:10,alignItems:"center"}}><span style={stateBadge(x.latestKind)}>{x.latestKind}</span><span style={{fontSize:12,color:"#8a8b9a"}}>v{x.version}</span></div>
     </div>)}
    </div></div>}
  </section>

  {/* ENCUENTRO */}
  <section style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <h2 style={{fontSize:18,margin:0}}>Encuentro</h2>{enc&&<span style={stateBadge(enc.state)}>{enc.state}</span>}
   </div>
   {!enc?<div style={{marginTop:14}}>
    <label style={lbl}>ID de paciente</label><input style={input} value={patientId} onChange={e=>setPatientId(e.target.value)} />
    <div style={{marginTop:14}}><button style={btn} disabled={busy!==""||!patientId} onClick={openEncounter}>{busy==="open"?"Abriendo…":"Abrir encuentro"}</button></div>
   </div>:<div>
    <p style={{color:"#6d6e80",fontSize:13}}>Encuentro <span style={mono}>{enc.id.slice(0,8)}</span> · versión {enc.version}</p>
    <label style={lbl}>Valoración (assessment)</label>
    <textarea style={{...input,minHeight:64,resize:"vertical"}} value={assessment} disabled={enc.state!=="OPEN"} onChange={e=>setAssessment(e.target.value)} placeholder="Impresión diagnóstica…" />
    <label style={lbl}>Plan</label>
    <textarea style={{...input,minHeight:64,resize:"vertical"}} value={plan} disabled={enc.state!=="OPEN"} onChange={e=>setPlan(e.target.value)} placeholder="Plan de manejo…" />
    <div style={{display:"flex",gap:10,marginTop:14}}>
     {enc.state==="OPEN"&&<button style={btn} disabled={busy!==""||!assessment||!plan} onClick={saveAssessment}>{busy==="assess"?"Guardando…":"Guardar valoración"}</button>}
     {enc.state==="READY_TO_SIGN"&&<button style={btn} disabled={busy!==""} onClick={signEncounter}>{busy==="sign"?"Firmando…":"Firmar encuentro"}</button>}
    </div>
    {enc.state==="SIGNED"&&<div style={{marginTop:14,padding:12,background:"#f6fbf7",borderRadius:12,border:"1px solid #d6ecdd"}}>
     <b style={{color:"#1a7f43"}}>✓ Encuentro firmado (registro inmutable)</b>
     <p style={{margin:"6px 0 0",fontSize:12,color:"#4b4c5e"}}>Firma: <span style={mono}>{enc.signatureDigest?.slice(0,32)}…</span></p>
    </div>}
   </div>}
  </section>

  {/* MEDICACIÓN */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Medicación</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Proponer una medicación no exige ser médico; sólo un médico puede prescribirla (Physician Control).</p>
   <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 90px 1fr",gap:10,marginTop:12}}>
    <input style={input} value={drug} onChange={e=>setDrug(e.target.value)} placeholder="Fármaco (ej. Amoxicilina)" />
    <input style={input} value={dose} onChange={e=>setDose(e.target.value)} placeholder="Dosis (500mg)" />
    <input style={input} value={route} onChange={e=>setRoute(e.target.value)} placeholder="Vía" />
    <input style={input} value={freq} onChange={e=>setFreq(e.target.value)} placeholder="Frecuencia (c/8h)" />
   </div>
   <div style={{marginTop:12}}><button style={btn} disabled={busy!==""||!drug||!dose||!route||!freq} onClick={proposeMed}>{busy==="med-new"?"Proponiendo…":"Proponer medicación"}</button></div>

   {meds.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {meds.map(m=>{const n=medNext(m);return <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{m.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{m.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(m.state)}>{m.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceMed(m)}>{busy==="med-"+m.id?"…":n.label}</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* PRESCRIPCIÓN SEGURA (panel 3) — dry-run de las barreras antes de prescribir */}
  <section className="span2" style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
    <div><h2 style={{fontSize:18,margin:0}}>Prescripción segura</h2><p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Verifica antes de prescribir. Previene errores, protege al paciente. Determinista, sin IA generativa.</p></div>
    {snap?.labs.egfr!==undefined&&<span style={{fontSize:12,color:P.muted}}>eGFR paciente: <b>{snap?.labs.egfr} mL/min</b>{snap?.labs.egfrStage?` · ERC ${snap.labs.egfrStage}`:""}</span>}
   </div>
   <div className="mos-rx-form">
    <input style={input} value={rxDrug} onChange={e=>setRxDrug(e.target.value)} placeholder="Buscar medicamento (ej. metformina, losartan)" />
    <input style={input} value={rxDose} onChange={e=>setRxDose(e.target.value)} placeholder="Dosis (500mg)" />
    <select style={input} value={rxRoute} onChange={e=>setRxRoute(e.target.value)}><option>Oral</option><option>IV</option><option>IM</option><option>SC</option><option>Tópica</option></select>
    <input style={input} value={rxFreq} onChange={e=>setRxFreq(e.target.value)} placeholder="Frecuencia (c/12h)" />
    <button style={btn} disabled={busy!==""||!rxDrug||!rxDose||!rxFreq} onClick={verifyRx}>{busy==="rxcheck"?"Verificando…":"Verificar"}</button>
   </div>
   {rxMsg&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:12,background:"#EAF7EF",border:"1px solid #CDEBD8",color:"#1A7F43",fontSize:13,fontWeight:600}}>{rxMsg}</div>}
   {rxCheck&&(()=>{
    const v=rxCheck.verdict;
    const vm=v==="OK"?{bg:"#EAF7EF",bd:"#CDEBD8",fg:"#1A7F43",txt:"Verificación superada — dosis y seguridad adecuadas"}:v==="WARN"?{bg:"#FFF7EC",bd:"#F0DBB8",fg:"#A15C00",txt:"Requiere criterio clínico — revisa las advertencias"}:{bg:"#FDEEEE",bd:"#F3C9C9",fg:"#B3261E",txt:"Prescripción bloqueada — corrige antes de enviar"};
    const ic=(s:string)=>s==="OK"?"✓":s==="WARN"?"⚠":"✕";const icc=(s:string)=>s==="OK"?"#1A7F43":s==="WARN"?"#A15C00":"#B3261E";
    return <div style={{marginTop:14}}>
     <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:12,background:vm.bg,border:`1px solid ${vm.bd}`,color:vm.fg,fontWeight:700,fontSize:14,flexWrap:"wrap"}}>
      <span style={{fontSize:16}}>{ic(v)}</span>{vm.txt}
      {rxCheck.drug.resolved&&<span style={{marginLeft:"auto",fontSize:12,fontWeight:600,color:P.muted}}>{rxCheck.drug.resolved.ingredient} · {rxCheck.drug.resolved.classes.join(", ")}</span>}
     </div>
     <div className="mos-rx-grid">
      <div>
       <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Barreras de seguridad</div>
       <div style={{display:"flex",flexDirection:"column",gap:7}}>{rxCheck.checks.map(c=><div key={c.id} style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:13}}>
        <span style={{color:icc(c.status),fontWeight:800,flex:"0 0 auto",width:14}}>{ic(c.status)}</span>
        <span><b style={{fontWeight:600}}>{c.label}</b><span style={{color:P.muted}}> — {c.detail}</span></span>
       </div>)}</div>
      </div>
      <div>
       <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Monitorización / advertencias</div>
       {rxCheck.monitoring.length?<div style={{display:"flex",flexDirection:"column",gap:6}}>{rxCheck.monitoring.map((m,i)=><div key={i} style={{fontSize:12.5,color:"#7a3b34"}}>• {m.test}: {m.note} <span style={{color:P.muted}}>(en {m.dueInDays} d)</span></div>)}</div>:<div style={{fontSize:12.5,color:P.muted}}>Sin monitorización específica.</div>}
       {rxCheck.indications&&<div style={{marginTop:12}}><div style={{fontSize:12,fontWeight:700,color:P.muted}}>Indicaciones para el paciente</div><div style={{fontSize:13,marginTop:2}}>{rxCheck.indications}</div></div>}
      </div>
     </div>
     <div style={{display:"flex",gap:10,marginTop:16,justifyContent:"flex-end"}}>
      <button style={{...ghost,padding:"9px 16px"}} onClick={()=>setRxCheck(null)}>Cancelar</button>
      <button style={{...btn,opacity:v==="BLOCK"?.5:1}} disabled={busy!==""||v==="BLOCK"} onClick={sendRx} title={v==="BLOCK"?"Corrige los bloqueos para enviar":""}>{busy==="rxsend"?"Enviando…":"Guardar y enviar"}</button>
     </div>
    </div>;
   })()}
  </section>

  {/* RESULTADOS DIAGNÓSTICOS */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Resultados diagnósticos</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Closed-loop: un resultado <b>crítico</b> que requirió acción y no se ha cerrado <b>bloquea la firma</b> del encuentro (Zero Lost Follow-Up).</p>
   <div style={{display:"flex",gap:10,marginTop:12,alignItems:"center",flexWrap:"wrap"}}>
    <input style={{...input,maxWidth:340}} value={resName} onChange={e=>setResName(e.target.value)} placeholder="Estudio (ej. Hemograma, Rx tórax)" />
    <label style={{fontSize:13,color:"#4b4c5e",display:"flex",alignItems:"center",gap:6}}><input type="checkbox" checked={resCritical} onChange={e=>setResCritical(e.target.checked)} /> Crítico</label>
    <button style={btn} disabled={busy!==""} onClick={receiveResult}>{busy==="res-new"?"Registrando…":"Registrar resultado"}</button>
   </div>
   {results.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {results.map(res=>{const n=resNext(res);return <div key={res.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{res.label}{res.critical&&<span style={{...stateBadge("ACTIONED"),marginLeft:8,fontSize:11}}>CRÍTICO</span>}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{res.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(res.state)}>{res.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceResult(res)}>{busy==="res-"+res.id?"…":n.label}</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* EVOLUCIÓN LONGITUDINAL (panel 4) */}
  <section className="span2" style={card}>
   <div><h2 style={{fontSize:18,margin:0}}>Evolución longitudinal</h2><p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Tendencias que cuentan la historia completa. Valores medidos, sin proyección.</p></div>
   <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}}>
    {(["HBA1C","GLUCOSE","LDL","CREATININE"] as TrendKey[]).map(k=><button key={k} onClick={()=>setTrendKey(k)} style={{background:trendKey===k?"#E7EEFB":"transparent",color:trendKey===k?P.blue:P.muted,border:`1px solid ${trendKey===k?"#CFE0F7":LINE}`,borderRadius:999,padding:"6px 14px",fontSize:13,fontWeight:trendKey===k?700:500,fontFamily:UI,cursor:"pointer"}}>{CHART[k].label}</button>)}
   </div>
   <div style={{marginTop:14,border:`1px solid ${LINE}`,borderRadius:14,padding:"14px 16px",background:"#fff"}}>
    <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>{CHART[trendKey].label} <span style={{color:P.muted,fontWeight:500}}>({CHART[trendKey].unit})</span></div>
    {trends?trendChart(trends.series[trendKey]??[],trendKey):<div style={{padding:"28px 0",textAlign:"center",color:"#8a8b9a",fontSize:13}}>Selecciona un paciente para ver sus tendencias.</div>}
   </div>
   {trends&&(()=>{
    const rc=(label:string,v:number|null,unit:string,warn:boolean)=>(<div style={{minWidth:0,background:"#fff",border:`1px solid ${warn?"#F0DBB8":LINE}`,borderRadius:14,padding:"14px 16px"}}><div style={{fontSize:12,color:P.muted,marginBottom:4}}>{label}</div><div style={{fontSize:22,fontWeight:800,color:warn?"#A15C00":P.ink}}>{v??"—"} <span style={{fontSize:12,fontWeight:600,color:P.muted}}>{v!==null?unit:""}</span></div></div>);
    const L=trends.latest;
    return <><div style={{fontSize:13,fontWeight:700,margin:"18px 0 10px"}}>Otros resultados relevantes</div>
     <div className="mos-vitals">
      {rc("Colesterol LDL",L.LDL,"mg/dL",L.LDL!==null&&L.LDL>=100)}
      {rc("Creatinina",L.CREATININE,"mg/dL",L.CREATININE!==null&&L.CREATININE>1.3)}
      {rc("TFG (eGFR)",L.EGFR,"mL/min",L.EGFR!==null&&L.EGFR<60)}
      {rc("UACR",L.UACR,"mg/g",L.UACR!==null&&L.UACR>=30)}
     </div></>;
   })()}
  </section>

  {/* ALERGIAS */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Alergias</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Una alergia <b>activa</b> bloquea la prescripción de un fármaco que la contenga (gate de seguridad).</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 150px 1fr",gap:10,marginTop:12}}>
    <input style={input} value={alSub} onChange={e=>setAlSub(e.target.value)} placeholder="Sustancia (ej. amoxicilina)" />
    <select style={input} value={alSev} onChange={e=>setAlSev(e.target.value)}><option value="MILD">Leve</option><option value="MODERATE">Moderada</option><option value="SEVERE">Grave</option></select>
    <input style={input} value={alReac} onChange={e=>setAlReac(e.target.value)} placeholder="Reacción (ej. anafilaxia)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!alSub} onClick={createAllergy}>{busy==="al-new"?"Registrando…":"Registrar alergia"}</button></div>
   {allergies.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {allergies.map(a=><div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{a.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{a.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={stateBadge(a.state)}>{a.state}</span>{alActions(a).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>doAllergyAction(a,act)}>{busy==="al-"+a.id?"…":act.label}</button>)}</div>
    </div>)}
   </div>}
  </section>

  {/* LISTA DE PROBLEMAS */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Lista de problemas</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Diagnósticos codificados en <b>CIE-10</b> (validados contra el catálogo; la descripción es canónica). PROD-011 + interoperabilidad NOM-024.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginTop:12}}>
    <input style={input} list="icd10-list" value={probCode} onChange={e=>setProbCode(e.target.value.toUpperCase())} placeholder="Código CIE-10 (ej. E11, I10, J45.909)" />
    <button style={btn} disabled={busy!==""||!probCode} onClick={createProblem}>{busy==="pb-new"?"Añadiendo…":"Añadir problema"}</button>
   </div>
   <datalist id="icd10-list">
    <option value="E11">Diabetes mellitus tipo 2</option><option value="I10">Hipertensión esencial</option><option value="E66.9">Obesidad</option>
    <option value="J45.909">Asma</option><option value="J44.9">EPOC</option><option value="N18.3">ERC estadio 3</option>
    <option value="F41.9">Ansiedad</option><option value="F32.9">Depresión</option><option value="M54.5">Lumbalgia</option><option value="I50.9">Insuficiencia cardíaca</option>
   </datalist>
   {problems.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {problems.map(p=><div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{p.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{p.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={stateBadge(p.state)}>{p.state}</span>{probActions(p).map(a=><button key={a.label} style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>doProblemAction(p,a)}>{busy==="pb-"+p.id?"…":a.label}</button>)}</div>
    </div>)}
   </div>}
  </section>

  {/* ÓRDENES CLÍNICAS */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Órdenes clínicas</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Lab, imagen, patología, procedimiento o referencia. Colocar/cumplir una orden exige médico.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginTop:12}}>
    <select style={input} value={orderType} onChange={e=>setOrderType(e.target.value)}>
     <option value="LAB">Laboratorio</option><option value="IMAGING">Imagen</option><option value="PATHOLOGY">Patología</option><option value="PROCEDURE">Procedimiento</option><option value="REFERRAL">Referencia</option>
    </select>
    <input style={input} value={orderDetail} onChange={e=>setOrderDetail(e.target.value)} placeholder="Detalle (ej. Hemograma completo)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!orderDetail} onClick={createOrder}>{busy==="ord-new"?"Creando…":"Crear orden"}</button></div>
   {orders.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {orders.map(o=>{const n=orderNext(o);return <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{o.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{o.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(o.state)}>{o.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceOrder(o)}>{busy==="ord-"+o.id?"…":n.label}</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* INTERCONSULTAS / REFERENCIAS */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Interconsultas</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Referencia a especialista: solicitar → aceptar → completar (o declinar/cancelar). Agregado propio con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:10,marginTop:12}}>
    <input style={input} value={refSpecialty} onChange={e=>setRefSpecialty(e.target.value)} placeholder="Especialidad (ej. Cardiología)" />
    <input style={input} value={refReason} onChange={e=>setRefReason(e.target.value)} placeholder="Motivo (ej. Soplo sistólico)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!refSpecialty||!refReason} onClick={createReferral}>{busy==="ref-new"?"Solicitando…":"Solicitar interconsulta"}</button></div>
   {referrals.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {referrals.map(rr=>{const n=referralNext(rr);const closable=rr.state==="REQUESTED"||rr.state==="ACCEPTED";return <div key={rr.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{rr.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{rr.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(rr.state)}>{rr.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceReferral(rr)}>{busy==="ref-"+rr.id?"…":n.label}</button>}
      {closable&&<button style={{...ghost,padding:"7px 12px",color:"#a15c00",borderColor:"#f0d9b8"}} disabled={busy!==""} onClick={()=>cancelReferral(rr)}>{rr.state==="REQUESTED"?"Declinar":"Cancelar"}</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* AGENDA / CITAS */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Agenda</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Cita del paciente: agendar → registrar llegada → completar (o no-show/cancelar). Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:10,marginTop:12}}>
    <input style={input} type="datetime-local" value={apptStart} onChange={e=>setApptStart(e.target.value)} />
    <input style={input} value={apptReason} onChange={e=>setApptReason(e.target.value)} placeholder="Motivo (ej. Control anual)" />
    <select style={input} value={apptCons} onChange={e=>setApptCons(e.target.value)}><option>Consultorio 1</option><option>Consultorio 2</option><option>Consultorio 3</option></select>
    <select style={input} value={apptType} onChange={e=>setApptType(e.target.value)}><option value="CONSULTA_GENERAL">Consulta general</option><option value="CONTROL">Control / Seguimiento</option><option value="PRIMERA_VEZ">Primera vez</option><option value="PROCEDIMIENTO">Procedimiento</option><option value="VACUNACION">Vacunación</option><option value="RESULTADOS">Resultados</option><option value="URGENCIA">Urgencia</option></select>
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!apptReason} onClick={createAppointment}>{busy==="apt-new"?"Agendando…":"Agendar cita"}</button></div>
   {appts.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {appts.map(a=>{const n=apptNext(a);const open=a.state==="SCHEDULED"||a.state==="CHECKED_IN";return <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{a.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{a.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(a.state)}>{a.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceAppt(a)}>{busy==="apt-"+a.id?"…":n.label}</button>}
      {a.state==="SCHEDULED"&&<button style={{...ghost,padding:"7px 12px",color:"#a15c00",borderColor:"#f0d9b8"}} disabled={busy!==""} onClick={()=>closeAppt(a,"noshow")}>No-show</button>}
      {open&&<button style={{...ghost,padding:"7px 12px",color:"#a15c00",borderColor:"#f0d9b8"}} disabled={busy!==""} onClick={()=>closeAppt(a,"cancel")}>Cancelar</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* VACUNAS / CARTILLA */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Vacunas</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Cartilla longitudinal: indicar → aplicar (o rechazar); tras aplicar puede registrarse un evento adverso (farmacovigilancia). Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:10,marginTop:12}}>
    <input style={input} value={immCode} onChange={e=>setImmCode(e.target.value)} placeholder="Vacuna (ej. SRP, Hexavalente, Influenza)" />
    <input style={input} value={immDose} onChange={e=>setImmDose(e.target.value)} placeholder="Dosis" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!immCode} onClick={createImmunization}>{busy==="imm-new"?"Indicando…":"Indicar vacuna"}</button></div>
   {imms.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {imms.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{i.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{i.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(i.state)}>{i.state}</span>
      {immActions(i).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="ADVERSE_EVENT"||act.to==="REFUSED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doImmAction(i,act)}>{busy==="imm-"+i.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* SIGNOS VITALES */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Signos vitales</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Observaciones append-only: el valor histórico nunca se sobrescribe; cada corrección es una enmienda con motivo. Se puede marcar una toma como capturada por error.</p>
   <div style={{display:"grid",gridTemplateColumns:"150px 1fr 120px",gap:10,marginTop:12}}>
    <select style={input} value={vitType} onChange={e=>setVitType(e.target.value)}>
     <option value="BP">Presión (BP)</option><option value="HR">Frec. cardíaca</option><option value="TEMP">Temperatura</option><option value="SPO2">SpO₂</option><option value="RESP">Frec. respiratoria</option><option value="WEIGHT">Peso</option><option value="HEIGHT">Talla</option>
    </select>
    <input style={input} value={vitValue} onChange={e=>setVitValue(e.target.value)} placeholder="Valor (ej. 120/80)" />
    <input style={input} value={vitUnit} onChange={e=>setVitUnit(e.target.value)} placeholder="Unidad" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!vitValue} onClick={createVital}>{busy==="vit-new"?"Registrando…":"Registrar signo vital"}</button></div>
   {vitals.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {vitals.map(v=><div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{v.vitalType}: {v.value} {v.unit}</b>{v.vstatus&&v.vstatus!=="UNKNOWN"&&<span style={{...(v.vstatus==="CRITICAL"?{background:"#fdeaea",color:"#b3261e"}:v.vstatus==="ABNORMAL"?{background:"#fff4e5",color:"#a15c00"}:{background:"#e8f7ee",color:"#1a7f43"}),marginLeft:8,fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:999}}>{v.interp}</span>}<div style={{fontSize:12,color:"#8a8b9a"}}>v{v.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(v.state)}>{v.state}</span>
      {vitActions(v).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="ENTERED_IN_ERROR"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doVitAction(v,act)}>{busy==="vit-"+v.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* PLAN DE CUIDADOS / METAS */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Plan de cuidados</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Metas longitudinales de crónicos: proponer → activar → lograr, con pausa/reanudación. Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginTop:12}}>
    <select style={input} value={planCat} onChange={e=>setPlanCat(e.target.value)}>
     <option value="DIABETES">Diabetes</option><option value="HYPERTENSION">Hipertensión</option><option value="OBESITY">Obesidad</option><option value="CARDIOVASCULAR">Cardiovascular</option><option value="MENTAL_HEALTH">Salud mental</option><option value="PRENATAL">Prenatal</option><option value="OTHER">Otro</option>
    </select>
    <input style={input} value={planGoal} onChange={e=>setPlanGoal(e.target.value)} placeholder="Meta (ej. HbA1c < 7% en 6 meses)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!planGoal} onClick={createPlan}>{busy==="cp-new"?"Proponiendo…":"Proponer meta"}</button></div>
   {plans.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {plans.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{c.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{c.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(c.state)}>{c.state}</span>
      {cpActions(c).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="CANCELLED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doPlanAction(c,act)}>{busy==="cp-"+c.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* FACTURACIÓN / RECLAMACIONES */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Facturación</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Ciclo de ingresos (seguimiento de estado, no mueve dinero): borrador → codificar → enviar → pagada/rechazada, con reenvío. Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:10,marginTop:12}}>
    <input style={input} value={clmAmount} onChange={e=>setClmAmount(e.target.value)} placeholder="Monto (ej. 1500.00)" />
    <select style={input} value={clmCurrency} onChange={e=>setClmCurrency(e.target.value)}><option value="MXN">MXN</option><option value="USD">USD</option></select>
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!clmAmount} onClick={createClaim}>{busy==="clm-new"?"Creando…":"Crear reclamación"}</button></div>
   {claims.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {claims.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{c.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{c.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(c.state)}>{c.state}</span>
      {clmActions(c).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="VOIDED"||act.to==="REJECTED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doClaimAction(c,act)}>{busy==="clm-"+c.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* CONSENTIMIENTO INFORMADO */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Consentimiento informado</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Registro clínico-legal (NOM-004 / aviso de privacidad): redactar → presentar → otorgar/rechazar; un consentimiento otorgado puede revocarse. Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginTop:12}}>
    <select style={input} value={csType} onChange={e=>setCsType(e.target.value)}>
     <option value="PROCEDURE">Procedimiento</option><option value="TREATMENT">Tratamiento</option><option value="ANESTHESIA">Anestesia</option><option value="DATA_SHARING">Compartir datos</option><option value="RESEARCH">Investigación</option>
    </select>
    <input style={input} value={csRef} onChange={e=>setCsRef(e.target.value)} placeholder="Referencia del documento (ej. CI-2026-001)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!csRef} onClick={createConsent}>{busy==="cs-new"?"Redactando…":"Redactar consentimiento"}</button></div>
   {consents.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {consents.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{c.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{c.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(c.state)}>{c.state}</span>
      {csActions(c).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="DECLINED"||act.to==="REVOKED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doConsentAction(c,act)}>{busy==="cs-"+c.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* INTERNAMIENTO / HOSPITALIZACIÓN */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Internamiento</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Episodio de hospitalización: admitir → trasladar (unidad) → dar de alta; cancelable si fue admisión por error. Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:10,marginTop:12}}>
    <select style={input} value={admUnit} onChange={e=>setAdmUnit(e.target.value)}>
     <option value="ER">Urgencias</option><option value="WARD">Hospitalización</option><option value="ICU">UCI</option><option value="OR">Quirófano</option><option value="MATERNITY">Maternidad</option><option value="PEDIATRICS">Pediatría</option>
    </select>
    <input style={input} value={admReason} onChange={e=>setAdmReason(e.target.value)} placeholder="Motivo (ej. Dolor torácico)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!admReason} onClick={createAdmission}>{busy==="adm-new"?"Admitiendo…":"Admitir paciente"}</button></div>
   {adms.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {adms.map(a=><div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>Unidad: {a.unit}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{a.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(a.state)}>{a.state}</span>
      {admActions(a).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="CANCELLED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doAdmAction(a,act)}>{busy==="adm-"+a.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* MUESTRAS / CADENA DE CUSTODIA */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Muestras de laboratorio</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Cadena de custodia pre-analítica: recolectar → enviar → recibir → resultar; rechazable en cualquier etapa. Una muestra rechazada aparece como pendiente HIGH en care gaps.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginTop:12}}>
    <select style={input} value={specType} onChange={e=>setSpecType(e.target.value)}>
     <option value="BLOOD">Sangre</option><option value="URINE">Orina</option><option value="TISSUE">Tejido</option><option value="SWAB">Hisopado</option><option value="CSF">LCR</option><option value="STOOL">Heces</option>
    </select>
    <button style={btn} disabled={busy!==""} onClick={createSpecimen}>{busy==="sp-new"?"Recolectando…":"Recolectar muestra"}</button>
   </div>
   {specs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {specs.map(s=>{const n=spNext(s);const open=s.state!=="RESULTED"&&s.state!=="REJECTED";return <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{s.specimenType}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{s.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(s.state)}>{s.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceSpecimen(s)}>{busy==="sp-"+s.id?"…":n.label}</button>}
      {open&&<button style={{...ghost,padding:"7px 12px",color:"#a15c00",borderColor:"#f0d9b8"}} disabled={busy!==""} onClick={()=>rejectSpecimen(s)}>Rechazar</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* INCIDENTES / SEGURIDAD DEL PACIENTE */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Incidentes de seguridad</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Reporte de eventos adversos (farmacovigilancia): reportar → revisar → escalar/resolver. Un incidente abierto aparece como pendiente HIGH en care gaps. Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 150px 1fr",gap:10,marginTop:12}}>
    <select style={input} value={incCat} onChange={e=>setIncCat(e.target.value)}>
     <option value="MEDICATION_ERROR">Error de medicación</option><option value="FALL">Caída</option><option value="EQUIPMENT">Equipo</option><option value="ADVERSE_DRUG_REACTION">RAM</option><option value="INFECTION">Infección</option><option value="OTHER">Otro</option>
    </select>
    <select style={input} value={incSev} onChange={e=>setIncSev(e.target.value)}><option value="LOW">Leve</option><option value="MODERATE">Moderado</option><option value="SEVERE">Grave</option></select>
    <input style={input} value={incDesc} onChange={e=>setIncDesc(e.target.value)} placeholder="Descripción del incidente" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!incDesc} onClick={createIncident}>{busy==="inc-new"?"Reportando…":"Reportar incidente"}</button></div>
   {incs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {incs.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{i.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{i.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(i.state)}>{i.state}</span>
      {incActions(i).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="ESCALATED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doIncAction(i,act)}>{busy==="inc-"+i.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* TRIAGE / CLASIFICACIÓN DE ACUIDAD */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Triage</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Clasificación de acuidad (urgencias): arribar → iniciar → clasificar ESI (re-evaluable) → cerrar, o LWBS. Un paciente sin triage completado es un pendiente HIGH en care gaps.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginTop:12}}>
    <input style={input} value={trComplaint} onChange={e=>setTrComplaint(e.target.value)} placeholder="Motivo de consulta (ej. Dolor torácico)" />
    <button style={btn} disabled={busy!==""||!trComplaint} onClick={createTriage}>{busy==="tr-new"?"Registrando…":"Registrar arribo"}</button>
   </div>
   {triages.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {triages.map(t=><div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{t.chiefComplaint}{t.acuity>0&&<span style={{...stateBadge(t.acuity<=2?"ESCALATED":"TRIAGED"),marginLeft:8,fontSize:11}}>ESI-{t.acuity}</span>}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{t.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(t.state)}>{t.state}</span>
      {trActions(t).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="LWBS"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doTriageAction(t,act)}>{busy==="tr-"+t.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* HERIDAS / LESIONES POR PRESIÓN */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Cuidado de heridas</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Lesión por presión (UPP) longitudinal: documentar estadio → re-valorar (append-only) → cicatrizar/escalar. Métrica de calidad. Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"180px 180px auto",gap:10,marginTop:12}}>
    <select style={input} value={wnLoc} onChange={e=>setWnLoc(e.target.value)}>
     <option value="SACRUM">Sacro</option><option value="HEEL">Talón</option><option value="ISCHIUM">Isquion</option><option value="TROCHANTER">Trocánter</option><option value="OCCIPUT">Occipucio</option><option value="ELBOW">Codo</option><option value="OTHER">Otro</option>
    </select>
    <select style={input} value={wnStage} onChange={e=>setWnStage(e.target.value)}>
     <option value="STAGE_1">Estadio 1</option><option value="STAGE_2">Estadio 2</option><option value="STAGE_3">Estadio 3</option><option value="STAGE_4">Estadio 4</option><option value="UNSTAGEABLE">No estadiable</option><option value="DTI">LTP profunda</option>
    </select>
    <button style={btn} disabled={busy!==""} onClick={createWound}>{busy==="wn-new"?"Documentando…":"Documentar herida"}</button>
   </div>
   {wounds.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {wounds.map(w=><div key={w.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{w.location} · {w.stage}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{w.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(w.state)}>{w.state}</span>
      {wnActions(w).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="ESCALATED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doWoundAction(w,act)}>{busy==="wn-"+w.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* TRANSFUSIONES */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Transfusiones</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Medicina transfusional con verificación pre-transfusional: ordenar → cruzar (crossmatch) → iniciar → completar; una reacción se registra como pendiente HIGH (hemovigilancia). Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 120px auto",gap:10,marginTop:12}}>
    <select style={input} value={tfProduct} onChange={e=>setTfProduct(e.target.value)}>
     <option value="PRBC">Concentrado eritrocitario</option><option value="PLATELETS">Plaquetas</option><option value="FFP">Plasma fresco</option><option value="CRYO">Crioprecipitados</option><option value="WHOLE_BLOOD">Sangre total</option>
    </select>
    <input style={input} value={tfUnits} onChange={e=>setTfUnits(e.target.value)} placeholder="Unidades" />
    <button style={btn} disabled={busy!==""} onClick={createTransfusion}>{busy==="tf-new"?"Ordenando…":"Ordenar transfusión"}</button>
   </div>
   {transfs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {transfs.map(t=>{const n=tfNext(t);return <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{t.product} · {t.units} U</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{t.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(t.state)}>{t.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceTransfusion(t)}>{busy==="tf-"+t.id?"…":n.label}</button>}
      {t.state==="TRANSFUSING"&&<button style={{...ghost,padding:"7px 12px",color:"#b3261e",borderColor:"#f0c9c9"}} disabled={busy!==""} onClick={()=>transfusionReaction(t)}>Reacción</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* CIRUGÍA / QUIRÓFANO */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Cirugía</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Caso quirúrgico con barrera de seguridad: agendar → time-out OMS (checklist) → iniciar → completar. No se puede iniciar sin el time-out. Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 150px auto",gap:10,marginTop:12}}>
    <input style={input} value={sgProc} onChange={e=>setSgProc(e.target.value)} placeholder="Procedimiento (ej. Colecistectomía)" />
    <select style={input} value={sgLat} onChange={e=>setSgLat(e.target.value)}><option value="NA">Sin lateralidad</option><option value="LEFT">Izquierdo</option><option value="RIGHT">Derecho</option><option value="BILATERAL">Bilateral</option></select>
    <button style={btn} disabled={busy!==""||!sgProc} onClick={createSurgery}>{busy==="sg-new"?"Agendando…":"Agendar cirugía"}</button>
   </div>
   {surgs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {surgs.map(s=>{const n=sgNext(s);const open=s.state==="SCHEDULED"||s.state==="TIMED_OUT";return <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{s.procedure}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{s.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(s.state)}>{s.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceSurgery(s)}>{busy==="sg-"+s.id?"…":n.label}</button>}
      {open&&<button style={{...ghost,padding:"7px 12px",color:"#a15c00",borderColor:"#f0d9b8"}} disabled={busy!==""} onClick={()=>cancelSurgery(s)}>Cancelar</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* DIÁLISIS */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Diálisis</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Terapia de reemplazo renal: agendar → iniciar → completar; una interrupción por complicación se registra como pendiente HIGH y puede reanudarse. Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 200px auto",gap:10,marginTop:12}}>
    <select style={input} value={dzMod} onChange={e=>setDzMod(e.target.value)}>
     <option value="HEMODIALYSIS">Hemodiálisis</option><option value="PERITONEAL">Peritoneal</option><option value="HEMOFILTRATION">Hemofiltración</option>
    </select>
    <select style={input} value={dzAcc} onChange={e=>setDzAcc(e.target.value)}>
     <option value="FISTULA">Fístula</option><option value="GRAFT">Injerto</option><option value="CATHETER">Catéter</option><option value="PERITONEAL_CATHETER">Catéter peritoneal</option>
    </select>
    <button style={btn} disabled={busy!==""} onClick={createDialysis}>{busy==="dz-new"?"Agendando…":"Agendar sesión"}</button>
   </div>
   {dialz.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {dialz.map(d=><div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{d.modality}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{d.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(d.state)}>{d.state}</span>
      {dzActions(d).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="INTERRUPTED"||act.to==="NO_SHOW"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doDialysisAction(d,act)}>{busy==="dz-"+d.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* DOCUMENTOS CLÍNICOS */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Documentos clínicos</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>La firma produce un snapshot reproducible e inmutable; toda corrección posterior es un addendum append-only (PROD-014-R022).</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 200px",gap:10,marginTop:12}}>
    <input style={input} value={docTitle} onChange={e=>setDocTitle(e.target.value)} placeholder="Título (ej. Nota de evolución)" />
    <select style={input} value={docType} onChange={e=>setDocType(e.target.value)}>
     <option value="PROGRESS_NOTE">Nota de evolución</option><option value="DISCHARGE_SUMMARY">Alta</option>
     <option value="REFERRAL">Referencia</option><option value="PROCEDURE_NOTE">Nota de procedimiento</option><option value="OTHER">Otro</option>
    </select>
   </div>
   <textarea style={{...input,minHeight:64,resize:"vertical",marginTop:10}} value={docContent} onChange={e=>setDocContent(e.target.value)} placeholder="Contenido clínico…" />
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!docContent} onClick={createDoc}>{busy==="doc-new"?"Creando…":"Crear documento"}</button></div>
   {docs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {docs.map(d=>{const n=docNext(d);return <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{d.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{d.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(d.state)}>{d.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceDoc(d)}>{busy==="doc-"+d.id?"…":n.label}</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* OBLIGACIONES / SEGUIMIENTO */}
  <section style={card}>
   <h2 style={{fontSize:18,margin:0}}>Obligaciones de seguimiento</h2>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Care gaps / follow-up. Completar exige evidencia (Zero Lost Follow-Up: nada se cierra sin constancia).</p>
   <div style={{display:"flex",gap:10,marginTop:12,alignItems:"center"}}>
    <input style={{...input,maxWidth:420}} value={obKind} onChange={e=>setObKind(e.target.value)} placeholder="Tipo (ej. Contactar por resultado crítico)" />
    <button style={btn} disabled={busy!==""||!obKind} onClick={createObligation}>{busy==="ob-new"?"Creando…":"Crear obligación"}</button>
   </div>
   {obligations.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {obligations.map(o=>{const n=obNext(o);return <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{o.label}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{o.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}><span style={stateBadge(o.state)}>{o.state}</span>{n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceObligation(o)}>{busy==="ob-"+o.id?"…":n.label}</button>}</div>
    </div>;})}
   </div>}
  </section>

  {error&&<div className="span2" style={{...card,borderColor:"#f0c6c0",background:"#fdf3f2"}}><b style={{color:"#c0392b"}}>Error</b><p style={{margin:"6px 0 0",color:"#7a3b34",wordBreak:"break-word"}}>{error}</p>{error.includes("SAFETY_BLOCKED")&&<p style={{margin:"6px 0 0",fontSize:12,color:"#a15c00"}}>💡 ¿Hay un resultado crítico sin cerrar para este paciente? Ciérralo abajo y vuelve a firmar.</p>}</div>}
  </main>
  </>)}
  </div>
 </div>;
}
