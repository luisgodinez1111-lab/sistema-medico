"use client";
import{useEffect,useState,Fragment}from"react";
import{getStoredSession,apiRequest,logout as sessionLogout,type MedicalSession}from"../../lib/session-client";
import{summarizePatient}from"../../../../packages/patient-summary/src";
import{primitive,typography}from"../../../../packages/design-system/src";
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
 const[appts,setAppts]=useState<Appt[]>([]);const[apptStart,setApptStart]=useState("");const[apptReason,setApptReason]=useState("");
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
 const[view,setView]=useState<"inicio"|"pacientes"|"consulta"|"agenda"|"resultados"|"exp">("inicio"); // vistas de nivel-sistema + exp(expediente crudo)
 const[selRow,setSelRow]=useState(0); // fila seleccionada en la lista de pacientes (panel de detalle)
 const[cTab,setCTab]=useState<"actual"|"resultados"|"ordenes"|"medicamentos"|"plan"|"documentos"|"seguimiento">("actual");
 const[cForm,setCForm]=useState({motivo:"",historia:"",antec:"",plan:""}); // borrador de la consulta actual
 const[clock,setClock]=useState<Date>(()=>new Date());
 const[topMenu,setTopMenu]=useState(false);
 const[patientList,setPatientList]=useState<{patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string}[]|null>(null);
 const[regName,setRegName]=useState("");const[regDob,setRegDob]=useState("");const[regSex,setRegSex]=useState("UNKNOWN");
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
 // Inicio y Pacientes: cargan worklist (tareas del consultorio) + lista de pacientes reales.
 useEffect(()=>{
  if((view!=="inicio"&&view!=="pacientes")||!ready||!session)return;
  let cancelled=false;
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/worklist",{method:"GET"});
    if(!cancelled&&r.status<400)setPanel({gaps:(r.body["gaps"] as PanelGap[])??[],patientCount:Number(r.body["patientCount"]??0)});
   }catch{/* worklist no disponible */}
   try{
    const r=await apiRequest("/api/v1/patients",{method:"GET"});
    if(!cancelled&&r.status<400)setPatientList((r.body["patients"] as{patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string}[])??[]);
   }catch{/* lista no disponible */}
  })();
  return()=>{cancelled=true;};
 },[view,ready,session]);

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
  const r=await apiRequest("/api/v1/appointments",{method:"POST",body:{appointmentId:id,patientId,startAt:startIso,reason:apptReason,occurredAt:nowIso()}});
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
  setPatientList((r.body["patients"] as {patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string}[])??[]);
 });
 const loadPanel=()=>call("panel",async()=>{
  const r=await apiRequest("/api/v1/worklist",{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  setPanel({gaps:(r.body["gaps"] as PanelGap[])??[],patientCount:Number(r.body["patientCount"]??0)});
 });
 const registerPatient=()=>call("pt-reg",async()=>{
  const id=uuid();const e=regExtra;
  const r=await apiRequest("/api/v1/patients",{method:"POST",body:{patientId:id,name:regName,birthDate:regDob||"1990-01-01",sexAtBirth:regSex,occurredAt:nowIso(),...(e.curp?{curp:e.curp}:{}),...(e.phone?{phone:e.phone}:{}),...(e.email?{email:e.email}:{}),...(e.address?{address:e.address}:{}),...(e.occupation?{occupation:e.occupation}:{}),...(e.maritalStatus?{maritalStatus:e.maritalStatus}:{})}});
  if(r.status>=400){setError(errMsg(r));return;}
  selectPatientRaw(id,regName);setPatientList(l=>[{patientId:id,name:regName,status:"ACTIVE",...(regDob?{birthDate:regDob}:{}),sexAtBirth:regSex,...(e.curp?{curp:e.curp}:{})},...(l??[])]);setRegName("");setRegDob("");setRegExtra({curp:"",phone:"",email:"",address:"",occupation:"",maritalStatus:""});
 });
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
    {SIDE_NAV.map(it=>{const VMAP:Record<string,typeof view>={Inicio:"inicio",Pacientes:"pacientes",Consulta:"consulta",Agenda:"agenda",Resultados:"resultados"};const vTarget=VMAP[it.label];const on=vTarget?view===vTarget:(view==="exp"&&!!it.h2&&activeH2===it.h2);const n=it.badge?navCounts[it.badge]:0;return (
     <button key={it.label} className={"mos-navi"+(on?" active":"")} aria-current={on?"true":undefined} title={sideCollapsed?it.label:undefined} onClick={()=>{if(vTarget){setView(vTarget);window.scrollTo({top:0,behavior:"smooth"});}else{setView("exp");setTimeout(()=>scrollToSection(it.h2),0);}}}>
      <NavIcon k={it.icon}/><span className="lbl">{it.label}</span>{it.badge&&n>0&&<span className={"mos-badge "+(it.badgeColor??"p")}>{n}</span>}
     </button>);})}
   </nav>
   <div className="mos-divider"/>
   <div className="mos-toolslbl">HERRAMIENTAS</div>
   {TOOLS_NAV.map(it=>(
    <button key={it.label} className="mos-navi" title={sideCollapsed?it.label:undefined} onClick={()=>{if(it.label==="Configuración")setDocMenu(m=>!m);}}>
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
   const realTasks=(panel?.gaps??[]).slice(0,6).map(g=>({title:g.label,who:nameOf(g.patientId),pr:g.priority as string}));
   const demoTasks=[{title:"Resultado crítico: Potasio 6.2 mmol/L",who:"Pérez López, Juan · 58 años",pr:"HIGH"},{title:"Signos vitales críticos (TA 190/110)",who:"Ramírez Torres, Ana · 72 años",pr:"HIGH"},{title:"Seguimiento pendiente",who:"Díaz Martínez, Carlos · 45 años",pr:"MEDIUM"},{title:"Revisar interacción medicamentosa",who:"González Ruiz, María · 66 años",pr:"MEDIUM"},{title:"Firmar consentimiento pendiente",who:"López Sánchez, Daniel · 34 años",pr:"LOW"}];
   const tasks=realTasks.length?realTasks:demoTasks;
   // Pacientes recientes: lista real si hay; si no, ejemplo.
   const stEs=(s:string):[string,string,string]=>s==="ACTIVE"?["Activo","#E6F6EE","#16A66A"]:s==="INACTIVE"?["Inactivo","#EEF0F5","#6B7391"]:["Pendiente","#FBF0DC","#B7791F"];
   const realPts=(patientList??[]).slice(0,5).map(p=>({name:p.name,status:p.status}));
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
     <div style={kpiCard}>{kico("#EEEBFD",svg("M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M16 4.5a3 3 0 010 6M22 20a6 6 0 00-5-5.9",P.purple))}<div style={{flex:1}}><div style={{fontSize:13,color:P.muted}}>Pacientes hoy</div><div style={{fontSize:26,fontWeight:800,margin:"2px 0"}}>{usingRealPts?patientList!.length:12} <span style={{fontSize:15,color:P.muted}}>/ {usingRealPts?patientList!.length:16}</span></div><div style={{height:6,borderRadius:99,background:"#EDEFF6",overflow:"hidden"}}><i style={{display:"block",height:"100%",width:"75%",background:P.purple,borderRadius:99}}/></div><div style={{fontSize:11.5,color:P.muted,marginTop:5}}>{usingRealPts?"pacientes del tenant":"4 por atender · 75%"}</div></div></div>
     <div style={kpiCard}>{kico("#E6F6EE",svg("M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z",P.green))}<div style={{flex:1}}><div style={{fontSize:13,color:P.muted}}>Consultas completadas</div><div style={{fontSize:26,fontWeight:800,margin:"2px 0"}}>8</div><div style={{fontSize:11.5,color:P.muted,marginTop:5}}><span style={{color:P.green,fontWeight:700}}>↑ +2</span> vs. ayer</div></div></div>
     <div style={kpiCard}>{kico("#FDE7EA",svg("M7 3h7l4 4v14H7zM14 3v4h4M10 13h5M10 16h3",P.red))}<div style={{flex:1}}><div style={{fontSize:13,color:P.muted}}>Pendientes críticos</div><div style={{fontSize:26,fontWeight:800,margin:"2px 0"}}>{critCount}</div><div style={{fontSize:11.5,marginTop:5}}><span style={link} onClick={()=>go("Seguridad y auditoría")}>Ver detalles →</span></div></div></div>
     <div style={kpiCard}>{kico("#E7EEFB",svg("M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",P.blue))}<div style={{flex:1,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontSize:13,color:P.muted}}>Próxima cita</div><div style={{fontSize:22,fontWeight:800,margin:"2px 0"}}>2:00 p.m.</div><div style={{fontSize:11.5,color:P.muted}}>María Fernández</div></div><span style={{width:30,height:30,borderRadius:"50%",background:"#E7EEFB",color:P.blue,display:"grid",placeItems:"center",cursor:"pointer"}} onClick={()=>go("Agenda")}>→</span></div></div>
    </div>
    {/* Banners */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16}} className="mos-banners">
     <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:14,background:"#FDECEE",border:"1px solid #F6CDD3"}}>{svg("M12 4l9 15.5H3zM12 10v4M12 17h.01",P.red)}<div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{critCount||2} resultados críticos sin resolver</div><div style={{fontSize:12.5,color:P.muted}}>Requieren acción para poder firmar consultas.</div></div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"8px 14px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}} onClick={()=>go("Resultados diagnósticos")}>Ver resultados</button></div>
     <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:14,background:"#FDF4E6",border:"1px solid #F2E1C0"}}>{svg("M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7zM7 8l6 6",P.amber)}<div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>1 interacción medicamentosa potencial</div><div style={{fontSize:12.5,color:P.muted}}>Requiere revisión.</div></div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"8px 14px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}} onClick={()=>go("Prescripción segura")}>Revisar</button></div>
    </div>
    {/* Mid: tareas | agenda | (CI + acciones) */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-mid">
     <div style={cardP}><div style={h2row}><h2 style={h2s}>Tareas clínicas prioritarias <span style={{background:P.purple,color:"#fff",fontSize:11,fontWeight:800,borderRadius:999,minWidth:20,height:20,display:"grid",placeItems:"center",padding:"0 5px"}}>{tasks.length}</span></h2><span style={link}>Ver todas →</span></div>
      {tasks.map((t,i)=>{const[tag,tbg,tfg]=prTag(t.pr);return <div key={i} style={{display:"flex",gap:12,padding:"12px 18px",borderTop:`1px solid #F1F3F9`,cursor:"pointer"}} onClick={()=>go("Panel del clínico")}>
       <span style={{width:34,height:34,borderRadius:9,background:tbg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><span style={{width:8,height:8,borderRadius:"50%",background:tfg}}/></span>
       <div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:600}}>{t.title}</div><div style={{fontSize:12,color:P.muted}}>{t.who}</div></div>
       <span style={{fontSize:10.5,fontWeight:700,borderRadius:6,padding:"3px 8px",background:tbg,color:tfg,whiteSpace:"nowrap",alignSelf:"flex-start"}}>{tag}</span>
      </div>;})}
     </div>
     <div style={cardP}><div style={h2row}><h2 style={h2s}>Agenda de hoy</h2><span style={link} onClick={()=>go("Agenda")}>Ver agenda →</span></div>
      <div style={{padding:"4px 18px 14px",position:"relative"}}>
       <div style={{position:"absolute",left:73,top:8,bottom:14,width:2,background:"#EDEFF6"}}/>
       {[["8:00 a.m.","García Herrera, Laura · Control DM2",false],["9:00 a.m.","Martínez Soto, Roberto · Infección respiratoria",false],["10:00 a.m.","Vega Ramírez, Sofía · Control prenatal",false],["11:00 a.m.","Luna Pérez, Miguel · Dolor abdominal",false],["12:00 p.m.","Torres Jiménez, Carmen · Resultados de laboratorio",false],["2:00 p.m.","María Fernández · Primera vez",true],["3:00 p.m.","Hernández Ruiz, Alfonso · Control HTA",false],["4:00 p.m.","Mesas Rodríguez, Valeria · Retiro de DIU",false]].map(([tm,txt,on],i)=>(
        <div key={i} style={{display:"flex",gap:14,padding:on?"9px 12px":"9px 0",position:"relative",...(on?{background:"#F1EFFE",border:"1px solid #D9D3FA",borderRadius:12,margin:"2px -12px"}:{})}}>
         <span style={{fontSize:12,color:P.muted,width:62,flex:"0 0 auto",textAlign:"right",paddingTop:1}}>{tm as string}</span>
         <span style={{width:11,height:11,borderRadius:"50%",background:on?P.purple:"#fff",border:`2px solid ${on?P.purple:"#C9CEE6"}`,flex:"0 0 auto",marginTop:3,zIndex:1}}/>
         <div><div style={{fontSize:13,fontWeight:600,color:on?P.purple:P.ink}}>Consulta</div><div style={{fontSize:12,color:P.muted}}>{txt as string}</div></div>
        </div>))}
      </div>
     </div>
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={cardP}><div style={h2row}><h2 style={{...h2s,color:P.purple}}><NavIcon k="brain"/>Clinical Intelligence (IA)</h2></div>
       <div style={{padding:"0 18px",fontSize:12,color:P.muted,marginBottom:6}}>Hallazgos deterministas relevantes hoy.</div>
       <div style={{padding:"4px 18px 16px"}}>
        {[["#EEEBFD",P.purple,"flask","3 pacientes","con tamizaje de depresión pendiente"],["#FDE7EA",P.red,"activity","2 pacientes","con HbA1c > 8% (sin ajuste en 3 meses)"],["#E7EEFB",P.blue,"syringe","1 paciente","con vacunas atrasadas"],["#FBF0DC",P.amber,"pill","1 posible duplicidad","terapéutica en antihipertensivos"]].map(([bg,fg,ic,b,rest],i)=>(
         <div key={i} style={{display:"flex",gap:11,alignItems:"flex-start",padding:"9px 0",borderTop:i?`1px solid #F1F3F9`:"0"}}><span style={{width:30,height:30,borderRadius:8,background:bg as string,display:"grid",placeItems:"center",flex:"0 0 auto",color:fg as string}}><NavIcon k={ic as string}/></span><div style={{fontSize:13,lineHeight:1.35}}><b>{b}</b> {rest}</div></div>))}
        <button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px 14px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI,width:"100%",marginTop:10}} onClick={()=>go("Seguridad y auditoría")}>Ver análisis completo →</button>
       </div>
      </div>
      <div style={cardP}><div style={h2row}><h2 style={h2s}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.9" aria-hidden><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>Acciones rápidas</h2></div>
       <div style={{padding:8}}>
        {qa("Nueva consulta","M12 5v14M5 12h14",()=>go("Encuentro"))}
        {qa("Registrar resultado","M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3",()=>go("Resultados diagnósticos"))}
        {qa("Crear orden clínica","M8 4h8v3H8zM6 5H5v16h14V5h-1M8 12h8M8 16h5",()=>go("Órdenes clínicas"))}
        {qa("Prescribir medicamento","M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7zM7 8l6 6",()=>go("Prescripción segura"))}
        {qa("Agendar cita","M4 6h16v14H4zM8 3v4M16 3v4",()=>go("Agenda"))}
        {qa("Subir documento","M12 16V4m0 0l-4 4m4-4l4 4M4 20h16",()=>go("Documentos clínicos"))}
        {qa("Solicitar interconsulta","M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M16 4.5a3 3 0 010 6M22 20a6 6 0 00-5-5.9",()=>go("Interconsultas"))}
       </div>
      </div>
     </div>
    </div>
    {/* Pacientes recientes | recursos */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-low">
     <div style={cardP}><div style={h2row}><h2 style={h2s}>Pacientes recientes</h2><span style={link} onClick={()=>go("Paciente")}>Ver todas →</span></div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr>{["Nombre","Edad","Última consulta","Motivo","Estado"].map(h=><th key={h} style={{textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"8px 18px",borderBottom:`1px solid ${LINE}`}}>{h}</th>)}</tr></thead>
       <tbody>{(usingRealPts?realPts:demoPts).map((p,i)=>{const[stl,sbg,sfg]=stEs(p.status);const d=p as{name:string;status:string;age?:string;last?:string;motivo?:string};return <tr key={i}>
        <td style={{padding:"11px 18px",borderBottom:`1px solid #F4F6FB`,fontSize:13}}><span style={{display:"flex",alignItems:"center",gap:10,fontWeight:600,cursor:"pointer"}} onClick={()=>go("Paciente")}><span style={{width:30,height:30,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700}}>{initials(p.name)}</span>{p.name}</span></td>
        <td style={{padding:"11px 18px",borderBottom:`1px solid #F4F6FB`,fontSize:13,color:P.muted}}>{d.age??"—"}</td>
        <td style={{padding:"11px 18px",borderBottom:`1px solid #F4F6FB`,fontSize:13,color:P.muted}}>{d.last??"—"}</td>
        <td style={{padding:"11px 18px",borderBottom:`1px solid #F4F6FB`,fontSize:13}}>{d.motivo??"—"}</td>
        <td style={{padding:"11px 18px",borderBottom:`1px solid #F4F6FB`}}><span style={{fontSize:11,fontWeight:700,borderRadius:999,padding:"3px 10px",background:sbg,color:sfg,whiteSpace:"nowrap"}}>{stl}</span></td>
       </tr>;})}</tbody>
      </table></div>
     </div>
     <div style={cardP}><div style={h2row}><h2 style={h2s}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.8" aria-hidden><path d="M4 5a2 2 0 012-2h9v18H6a2 2 0 01-2-2zM15 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3"/></svg>Recursos clínicos</h2></div>
      <div style={{padding:"6px 8px"}}>{["Calculadoras médicas","Interacciones medicamentosas","CIE-10 / CUPS","Protocolos del consultorio","Guías de práctica clínica"].map(r=><div key={r} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:9,color:P.blue,fontSize:13.5,fontWeight:500,cursor:"pointer"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="M8 6h9M8 12h9M8 18h6M4 6h.01M4 12h.01M4 18h.01"/></svg>{r}</div>)}</div>
     </div>
    </div>
    {/* Indicadores | donut | mensajes */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 340px",gap:16,marginTop:16,alignItems:"start"}} className="mos-low2">
     <div style={cardP}><div style={h2row}><h2 style={{...h2s,fontSize:15}}>Indicadores del consultorio</h2><span style={{fontSize:12,color:P.muted}}>Esta semana ▾</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",padding:"0 6px 12px"}}>
       {[["48","Consultas totales","↑ 12%",true,"#DDD8FA"],["92%","Asistencia a citas","↑ 5%",true,"#DDD8FA"],["2.3 días","Tiempo de seguimiento","↓ 18%",false,"#DDD8FA"],["4.8/5","Satisfacción pacientes","↑ 0.4",true,"#B7E7CC"]].map(([v,l,tr,up,bar],i)=>(
        <div key={i} style={{padding:"14px 16px"}}><div style={{fontSize:23,fontWeight:800}}>{v as string}</div><div style={{fontSize:11.5,color:P.muted}}>{l as string}</div>
         <div style={{display:"flex",alignItems:"flex-end",gap:3,height:32,margin:"8px 0"}}>{[40,62,48,75,88,70].map((h,j)=><span key={j} style={{flex:1,height:`${h}%`,background:bar as string,borderRadius:2}}/>)}</div>
         <div style={{fontSize:12,fontWeight:700,color:up?P.green:"#D23651"}}>{tr as string}</div></div>))}
      </div>
     </div>
     <div style={{...cardP,padding:"16px 18px"}}><h2 style={{...h2s,fontSize:15,marginBottom:12}}>Distribución de motivos de consulta</h2>
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
   // ===== VISTA PACIENTES (gestión) — S3.png =====
   const ageOf=(bd?:string):number|null=>{if(!bd)return null;const b=new Date(bd),n=new Date();let y=n.getFullYear()-b.getFullYear();if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))y--;return y;};
   const sexAbbr=(s?:string)=>s==="FEMALE"?"F":s==="MALE"?"M":s==="INTERSEX"?"I":"—";
   const initials=(n:string)=>n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()||"P";
   type Row={patientId:string;name:string;status:string;age:number|null;sexo:string;curp:string;last:string;motivo:string};
   const real=(patientList??[]).map(p=>({patientId:p.patientId,name:p.name,status:p.status,age:ageOf(p.birthDate),sexo:sexAbbr(p.sexAtBirth),curp:p.curp||"—",last:"—",motivo:"—"}));
   const demo:Row[]=[
    {patientId:"d1",name:"María Fernández López",status:"ACTIVE",age:28,sexo:"F",curp:"FEFM960812MCHRRR04",last:"Hoy 2:00 p.m.",motivo:"Primera vez"},
    {patientId:"d2",name:"Juan Pérez García",status:"ACTIVE",age:58,sexo:"M",curp:"PEGJ650320HCHRRN01",last:"Hoy 12:30 p.m.",motivo:"Control DM2"},
    {patientId:"d3",name:"Ana Ramírez Torres",status:"ACTIVE",age:72,sexo:"F",curp:"RATA720114MCHMRN05",last:"Hoy 11:00 a.m.",motivo:"Resultados"},
    {patientId:"d4",name:"Carlos Díaz Martínez",status:"ACTIVE",age:45,sexo:"M",curp:"DIMC800501HCHZRR09",last:"Hoy 9:30 a.m.",motivo:"Dolor abdominal"},
    {patientId:"d5",name:"Sofía Vega Ramírez",status:"ACTIVE",age:31,sexo:"F",curp:"VERS910223MCHGMF02",last:"Hoy 8:00 a.m.",motivo:"Control prenatal"},
    {patientId:"d6",name:"Miguel Ruiz Herrera",status:"INACTIVE",age:49,sexo:"M",curp:"RUHM760412HCHZRG03",last:"Ayer 4:15 p.m.",motivo:"HTA"},
    {patientId:"d7",name:"Laura Sánchez López",status:"ACTIVE",age:39,sexo:"F",curp:"SALL851107MCHNPR01",last:"Ayer 11:20 a.m.",motivo:"Ansiedad"},
    {patientId:"d8",name:"Oscar Reyes Morales",status:"ACTIVE",age:67,sexo:"M",curp:"REMO670905HCHYRS07",last:"15 sep 2026",motivo:"Control cardiovascular"},
   ];
   const usingReal=real.length>0;const rows:Row[]=usingReal?real:demo;
   const total=usingReal?rows.length:1482;const activos=usingReal?rows.filter(r=>r.status==="ACTIVE").length:1263;
   const sel:Row=rows[Math.min(selRow,rows.length-1)]??rows[0]??{patientId:"",name:"—",status:"ACTIVE",age:null,sexo:"—",curp:"—",last:"—",motivo:"—"};
   const stTag=(s:string):[string,string,string]=>s==="ACTIVE"?["Activo","#E6F6EE","#16A66A"]:["Inactivo","#EEF0F5","#6B7391"];
   const kico=(bg:string,d:string,st:string)=>(<span style={{width:42,height:42,borderRadius:11,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={st} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d}/></svg></span>);
   const kcard:React.CSSProperties={...card,marginTop:0,padding:16,display:"flex",gap:13,alignItems:"center"};
   const fdrop:React.CSSProperties={display:"inline-flex",alignItems:"center",gap:7,background:P.white,border:`1px solid ${LINE}`,borderRadius:10,padding:"9px 13px",fontSize:13,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"};
   const dk:React.CSSProperties={color:P.muted,width:130,flex:"0 0 auto"};
   const openExp=(r:Row)=>{if(!r.patientId.startsWith("d")){selectPatientRaw(r.patientId,r.name);setView("exp");}};
   return <div style={{display:"flex"}}>
    <div style={{flex:1,minWidth:0,padding:"22px 24px 40px"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div><h1 style={{fontSize:29,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Pacientes</h1><p style={{color:P.muted,fontSize:14,margin:"6px 0 0"}}>Gestiona, busca y da seguimiento a todos tus pacientes.</p></div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
       <button style={{display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 15V4m0 0l-4 4m4-4l4 4M4 20h16"/></svg>Importar</button>
       <button style={{display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 9v11m0 0l4-4m-4 4l-4-4M4 4h16"/></svg>Exportar</button>
       <button style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Paciente"),0);}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 5v14M5 12h14"/></svg>Nuevo paciente</button>
      </div>
     </div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:14,marginTop:18}} className="mos-kpis">
      <div style={kcard}>{kico("#EEEBFD","M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M16 4.5a3 3 0 010 6M22 20a6 6 0 00-5-5.9",P.purple)}<div><div style={{fontSize:12.5,color:P.muted}}>Total de pacientes</div><div style={{fontSize:24,fontWeight:800}}>{total.toLocaleString("es-MX")}</div></div></div>
      <div style={kcard}>{kico("#E6F6EE","M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z",P.green)}<div><div style={{fontSize:12.5,color:P.muted}}>Pacientes activos</div><div style={{fontSize:24,fontWeight:800}}>{activos.toLocaleString("es-MX")} <span style={{fontSize:12,color:P.green,fontWeight:600}}>● {total?Math.round(activos/total*100):0}%</span></div></div></div>
      <div style={kcard}>{kico("#E7EEFB","M6 2h12l-1 6H7zM5 8h14l-1 12H6z",P.blue)}<div><div style={{fontSize:12.5,color:P.muted}}>Nuevos este mes</div><div style={{fontSize:24,fontWeight:800}}>{usingReal?rows.length:48} <span style={{fontSize:12,color:P.green,fontWeight:600}}>↑ +12%</span></div></div></div>
      <div style={kcard}>{kico("#FDECEE","M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z",P.red)}<div><div style={{fontSize:12.5,color:P.muted}}>En seguimiento</div><div style={{fontSize:24,fontWeight:800}}>{usingReal?(gaps?.length??0):217}</div></div></div>
     </div>
     <div style={{display:"flex",gap:10,alignItems:"center",marginTop:16,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:200,display:"flex",alignItems:"center",gap:9,background:P.white,border:`1px solid ${LINE}`,borderRadius:10,padding:"9px 13px"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" strokeLinecap="round"/></svg><input placeholder="Buscar por nombre, CURP, teléfono, correo…" value={topSearch} onChange={e=>setTopSearch(e.target.value)} style={{border:0,outline:"none",background:"transparent",fontSize:13.5,fontFamily:UI,flex:1,color:P.ink}}/></div>
      {["Todos los filtros","Estado: Todos","Sexo: Todos","Rango de edad","Más filtros"].map(f=><span key={f} style={fdrop}>{f} ▾</span>)}
     </div>
     <div style={{...card,marginTop:14,overflow:"hidden"}}>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr>{["","Paciente","Edad","Sexo","Última consulta","Motivo","Estado","Acciones"].map((h,i)=><th key={i} style={{textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"12px 14px",borderBottom:`1px solid ${LINE}`,background:"#FAFBFD",width:i===0?36:undefined}}>{h}</th>)}</tr></thead>
       <tbody>{rows.map((r,i)=>{const[stl,sbg,sfg]=stTag(r.status);const on=i===Math.min(selRow,rows.length-1);return <tr key={r.patientId} onClick={()=>{setSelRow(i);if(!r.patientId.startsWith("d"))selectPatientRaw(r.patientId,r.name);}} style={{background:on?"#F6F5FE":"transparent",cursor:"pointer"}}>
        <td style={{padding:"11px 14px",borderBottom:`1px solid #F2F4F9`}}><span style={{width:17,height:17,borderRadius:5,border:on?"0":"1.6px solid #C7CCE0",background:on?P.purple:"transparent",display:"grid",placeItems:"center",color:"#fff",fontSize:11}}>{on?"✓":""}</span></td>
        <td style={{padding:"11px 14px",borderBottom:`1px solid #F2F4F9`}}><div style={{display:"flex",alignItems:"center",gap:11}}><span style={{width:36,height:36,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:12,fontWeight:700,flex:"0 0 auto"}}>{initials(r.name)}</span><div><div style={{fontWeight:600,fontSize:13}}>{r.name}</div><div style={{fontSize:11,color:"#9AA0BC"}}>CURP: {r.curp}</div></div></div></td>
        <td style={{padding:"11px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:13}}>{r.age!=null?`${r.age} años`:"—"}</td>
        <td style={{padding:"11px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:13}}>{r.sexo}</td>
        <td style={{padding:"11px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:13}}>{r.last}</td>
        <td style={{padding:"11px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:13}}>{r.motivo}</td>
        <td style={{padding:"11px 14px",borderBottom:`1px solid #F2F4F9`}}><span style={{fontSize:11.5,fontWeight:600,borderRadius:999,padding:"3px 11px",background:sbg,color:sfg}}>{stl}</span></td>
        <td style={{padding:"11px 14px",borderBottom:`1px solid #F2F4F9`,color:"#9AA0BC",fontWeight:800,cursor:"pointer"}} onClick={e=>{e.stopPropagation();openExp(r);}}>···</td>
       </tr>;})}</tbody>
      </table></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",fontSize:13,color:P.muted,flexWrap:"wrap",gap:10}}>
       <span>Mostrando 1–{rows.length} de {total.toLocaleString("es-MX")} pacientes</span>
       <div style={{display:"flex",gap:5}}>{["‹","1","2","3","4","5","…",String(Math.max(1,Math.ceil(total/10))),"›"].map((p,i)=><span key={i} style={{minWidth:32,height:32,border:`1px solid ${LINE}`,background:p==="1"?P.purple:P.white,color:p==="1"?"#fff":P.ink,borderRadius:8,display:"grid",placeItems:"center",fontSize:13,cursor:"pointer",padding:"0 6px"}}>{p}</span>)}</div>
       <span style={fdrop}>10 por página ▾</span>
      </div>
     </div>
    </div>
    {/* PANEL DE DETALLE del paciente seleccionado */}
    <div style={{flex:"0 0 356px",borderLeft:`1px solid ${LINE}`,background:P.white,padding:22,minHeight:"100vh"}} className="mos-detail">
     <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginBottom:8}}><button style={{display:"inline-flex",alignItems:"center",gap:7,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"7px 12px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 20h9M16.5 3.5a2 2 0 013 3L7 19l-4 1 1-4z"/></svg>Editar</button><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"7px 11px",cursor:"pointer",color:P.muted,fontWeight:800}}>···</button></div>
     <div style={{width:76,height:76,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontWeight:800,fontSize:24}}>{initials(sel.name)}</div>
     <div style={{fontSize:20,fontWeight:800,marginTop:12}}>{sel.name}</div>
     <div style={{fontSize:13,color:P.muted}}>{sel.age!=null?`${sel.age} años · `:""}{sel.sexo==="F"?"Femenino":sel.sexo==="M"?"Masculino":"—"}</div>
     <div style={{fontSize:12,color:P.muted}}>CURP: {sel.curp}</div>
     {(()=>{const[stl,sbg,sfg]=stTag(sel.status);return <span style={{display:"inline-flex",alignItems:"center",gap:6,background:sbg,color:sfg,borderRadius:999,padding:"4px 12px",fontSize:12.5,fontWeight:600,marginTop:10}}>● Paciente {stl.toLowerCase()}</span>;})()}
     <div style={{display:"flex",gap:18,borderBottom:`1px solid ${LINE}`,margin:"16px 0"}}>{["Resumen","Historial","Notas","Documentos"].map((t,i)=><span key={t} style={{fontSize:13.5,color:i===0?P.purple:P.muted,fontWeight:i===0?700:500,paddingBottom:9,borderBottom:i===0?`2px solid ${P.purple}`:"0",cursor:"pointer"}}>{t}</span>)}</div>
     <div style={{fontSize:14,fontWeight:700,margin:"4px 0 10px"}}>Información general</div>
     {(()=>{const sd=(patientId===sel.patientId?snap?.demographics:undefined);const dob=sd?.birthDate?`${new Date(sd.birthDate).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"})}${sel.age!=null?` (${sel.age} años)`:""}`:(sel.age!=null?`${sel.age} años`:"—");return [["Fecha de nacimiento",dob],["Sexo",sel.sexo==="F"?"Femenino":sel.sexo==="M"?"Masculino":"—"],["Teléfono",sd?.phone||"—"],["Correo",sd?.email||"—"],["Dirección",sd?.address||"—"],["Ocupación",sd?.occupation||"—"],["Estado civil",sd?.maritalStatus||"—"]].map(([k,v])=><div key={k} style={{display:"flex",fontSize:13,padding:"5px 0"}}><span style={dk}>{k}</span><span style={{fontWeight:500}}>{v}</span></div>);})()}
     <div style={{fontSize:14,fontWeight:700,margin:"16px 0 10px"}}>Antecedentes relevantes</div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      {([["Alergias","#FDECEE","#D23651","Alergias"],["Problemas","#EEEBFD","#6C5CF6","Lista de problemas"],["Medicamentos","#E7F0FD","#1769E0","Medicación"],["Vacunas","#E6F6EE","#16A66A","Vacunas"]] as const).map(([lbl,bg,fg,h2])=><div key={lbl} onClick={()=>openExp(sel)} style={{display:"flex",alignItems:"center",gap:8,borderRadius:11,padding:"10px 12px",fontSize:13,fontWeight:600,background:bg,color:fg,cursor:"pointer"}}>{lbl}</div>)}
     </div>
     <div style={{fontSize:14,fontWeight:700,margin:"16px 0 10px"}}>Última consulta</div>
     <div style={{background:"#F7F8FC",border:`1px solid ${LINE}`,borderRadius:12,padding:14,fontSize:13}}><b>{clock.toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</b><div style={{color:P.muted,marginTop:6}}>Motivo: <b style={{color:P.ink}}>{sel.motivo}</b><br/>Médico: {docDisplay}</div><button style={{marginTop:10,width:"100%",justifyContent:"center",display:"flex",border:0,background:P.purple,color:"#fff",borderRadius:9,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}} onClick={()=>openExp(sel)}>Ver consulta</button></div>
     <div style={{fontSize:14,fontWeight:700,margin:"16px 0 10px"}}>Próxima cita</div>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,color:P.muted,gap:10}}><span>No tiene citas programadas</span><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"7px 12px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>Agendar cita</button></div>
    </div>
   </div>;
  })() : view==="consulta" ? (()=>{
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
   const rteBar=<div style={{display:"flex",gap:2,padding:"7px 10px",borderBottom:`1px solid ${LINE}`,background:"#FAFBFD",color:P.muted}}>{["B","I","U","•","1."].map(b=><span key={b} style={{width:26,height:26,display:"grid",placeItems:"center",borderRadius:6,fontSize:13,fontWeight:700}}>{b}</span>)}</div>;
   const CTABS:[typeof cTab,string][]=[["actual","Consulta actual"],["resultados","Resultados"],["ordenes","Órdenes"],["medicamentos","Medicamentos"],["plan","Plan de cuidados"],["documentos","Documentos"],["seguimiento","Seguimiento"]];
   const rsum=(bg:string,fg:string,d:string,title:string,sub:string,right:React.ReactNode)=>(<div style={{display:"flex",gap:11,padding:"12px 0",borderTop:`1px solid #F1F3F9`,alignItems:"flex-start"}}><span style={{width:34,height:34,borderRadius:9,background:bg,color:fg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={d}/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13.5}}>{title}</div><div style={{fontSize:12.5,color:P.muted}}>{sub}</div></div>{right}</div>);
   const badd=<span style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:600,color:P.purple,cursor:"pointer",whiteSpace:"nowrap"}}>+ Agregar</span>;
   return <div style={{padding:"20px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
     <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{width:34,height:34,borderRadius:9,border:`1px solid ${LINE}`,background:P.white,display:"grid",placeItems:"center",cursor:"pointer",color:P.muted}} onClick={()=>setView("inicio")}>←</span><div><h1 style={{fontSize:27,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Consulta</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Registro y gestión de la consulta médica</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button style={{display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Guardar borrador</button>
      <button style={{display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Vista previa</button>
      <button style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:"linear-gradient(90deg,#6C5CF6,#5B6BF0)",color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI,boxShadow:"0 6px 16px #6c5cf640"}} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Encuentro"),0);}}>+ Firmar consulta</button>
     </div>
    </div>
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
     <div style={{...card2,marginTop:16,padding:"60px 20px",textAlign:"center"}}><div style={{fontSize:16,fontWeight:700}}>Pestaña «{CTABS.find(t=>t[0]===cTab)?.[1]}»</div><p style={{color:P.muted,fontSize:14,maxWidth:460,margin:"8px auto 0"}}>Se está construyendo al nivel exacto de tu diseño (S4). Próxima entrega. Mientras, el expediente completo está disponible desde el menú lateral.</p><button style={{marginTop:14,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection(cTab==="resultados"?"Resultados diagnósticos":cTab==="ordenes"?"Órdenes clínicas":cTab==="medicamentos"?"Medicación":cTab==="plan"?"Plan de cuidados":cTab==="documentos"?"Documentos clínicos":"Obligaciones de seguimiento"),0);}}>Abrir en el expediente →</button></div>
    ):(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-mid">
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={sec}><h3 style={sect}>1. Motivo de consulta</h3><textarea style={ta} value={cForm.motivo} onChange={e=>setCForm(f=>({...f,motivo:e.target.value.slice(0,500)}))} placeholder="Motivo de la consulta…"/><div style={cc}>{cForm.motivo.length}/500</div></div>
      <div style={sec}><h3 style={sect}>2. Historia de la enfermedad actual</h3><div style={{border:`1px solid ${LINE}`,borderRadius:11,overflow:"hidden"}}>{rteBar}<textarea style={{width:"100%",border:0,outline:"none",padding:"12px 14px",fontSize:13.5,fontFamily:UI,resize:"vertical",minHeight:90,boxSizing:"border-box"}} value={cForm.historia} onChange={e=>setCForm(f=>({...f,historia:e.target.value.slice(0,2000)}))} placeholder="Padecimiento actual…"/></div><div style={cc}>{cForm.historia.length}/2000</div></div>
      <div style={sec}><h3 style={sect}>3. Antecedentes relevantes</h3><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>{["HTA","DM2","Asma","Alergias","Quirúrgicos","Tabaquismo","Alcohol","Otros"].map(a=><label key={a} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}><span style={{width:17,height:17,borderRadius:5,border:a==="Alergias"?"0":"1.6px solid #C7CCE0",background:a==="Alergias"?P.purple:"transparent",display:"grid",placeItems:"center",color:"#fff",fontSize:11,flex:"0 0 auto"}}>{a==="Alergias"?"✓":""}</span>{a}</label>)}</div><textarea style={{...ta,marginTop:12}} value={cForm.antec} onChange={e=>setCForm(f=>({...f,antec:e.target.value.slice(0,1000)}))} placeholder="Detalle de antecedentes…"/><div style={cc}>{cForm.antec.length}/1000</div></div>
      {["4. Interrogatorio por aparatos y sistemas","5. Exploración física"].map(t=><div key={t} style={card2}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px",fontSize:15,fontWeight:700,cursor:"pointer"}}>{t}<span style={{color:P.muted}}>›</span></div></div>)}
      <div style={card2}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px 8px",fontSize:15,fontWeight:700}}>6. Impresión diagnóstica<span style={{color:P.muted}}>⌃</span></div><div style={{padding:"0 18px 18px",display:"flex",gap:10,flexWrap:"wrap"}}>{(snap?.problems??["J02.9","B34.9"]).slice(0,4).map(c=><span key={c} style={{display:"inline-flex",alignItems:"center",gap:8,background:"#F3F5FA",border:`1px solid ${LINE}`,borderRadius:9,padding:"6px 11px",fontSize:12.5,fontWeight:600}}>{c} {DX_LABEL(c)} <span style={{color:"#9AA0BC",cursor:"pointer"}}>✕</span></span>)}<span style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:8,padding:"6px 12px",fontSize:12.5,fontWeight:600,color:P.purple,cursor:"pointer"}}>+ Añadir</span></div></div>
     </div>
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={sec}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={sect}>Signos vitales</h3><span style={{fontSize:12,color:P.muted}}>{clock.toLocaleDateString("es-MX",{day:"numeric",month:"short"})} · {clock.toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"})}</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>{([["TA",V["BP"]??"","mmHg"],["FC",V["HR"]??"","lpm"],["FR",V["RESP"]??"","rpm"],["Temp.",V["TEMP"]??"","°C"],["SpO₂",V["SPO2"]??"","%"]] as const).map(([l,v,u])=><div key={l}><label style={{fontSize:11.5,color:P.muted,display:"block",marginBottom:5,fontWeight:600}}>{l}</label><input defaultValue={v} style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 6px",fontSize:15,fontWeight:700,textAlign:"center",fontFamily:UI,boxSizing:"border-box"}}/><div style={{fontSize:10.5,color:"#9AA0BC",textAlign:"center",marginTop:3}}>{u}</div></div>)}</div></div>
      <div style={sec}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={sect}>Diagnósticos / Problemas</h3><span style={link} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Lista de problemas"),0);}}>Ver historial →</span></div><div style={{display:"flex",alignItems:"center",gap:9,border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 12px",fontSize:13,color:P.muted}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>Buscar CIE-10 o descripción…</div><div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>{(snap?.problems??["J02.9","B34.9"]).slice(0,3).map((c,i)=><span key={c} style={{display:"inline-flex",alignItems:"center",gap:8,background:"#F3F5FA",border:`1px solid ${LINE}`,borderRadius:9,padding:"6px 11px",fontSize:12.5,fontWeight:600}}>{c} {DX_LABEL(c)}{i===0&&<span style={{background:"#EEEBFD",color:"#6C5CF6",borderRadius:6,padding:"1px 7px",fontSize:10.5,fontWeight:700}}>Principal</span>}<span style={{color:"#9AA0BC",cursor:"pointer"}}>✕</span></span>)}</div></div>
      <div style={sec}><h3 style={sect}>Órdenes clínicas</h3><div style={{display:"flex",gap:16,borderBottom:`1px solid ${LINE}`,fontSize:13}}>{["Laboratorio","Imagen","Procedimiento","Interconsulta"].map((t,i)=><span key={t} style={{paddingBottom:8,color:i===0?P.purple:P.muted,fontWeight:i===0?700:400,borderBottom:i===0?`2px solid ${P.purple}`:"0",cursor:"pointer"}}>{t}</span>)}</div><div style={{marginTop:12}}>{["Biometría hemática completa","Proteína C reactiva","Exudado faríngeo (cultivo)","Prueba rápida de antígeno estreptococo"].map(o=><label key={o} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 0",fontSize:13.5,cursor:"pointer"}}><span style={{width:17,height:17,borderRadius:5,border:"1.6px solid #C7CCE0",flex:"0 0 auto"}}/>{o}</label>)}</div><button style={{display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI,marginTop:8}} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Órdenes clínicas"),0);}}>+ Crear orden</button></div>
      <div style={sec}><h3 style={sect}>Plan de manejo</h3><div style={{border:`1px solid ${LINE}`,borderRadius:11,overflow:"hidden"}}>{rteBar}<textarea style={{width:"100%",border:0,outline:"none",padding:"12px 14px",fontSize:13.5,fontFamily:UI,resize:"vertical",minHeight:110,boxSizing:"border-box"}} value={cForm.plan} onChange={e=>setCForm(f=>({...f,plan:e.target.value}))} placeholder="Plan de manejo…"/></div></div>
     </div>
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={sec}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={sect}>Resumen clínico</h3><span style={link}>✎ Editar</span></div>
       {rsum("#FDECEE","#D23651","M12 4l9 15.5H3zM12 10v4M12 17h.01","Alergias",snap?.allergies.length?snap.allergies.join(", "):"Sin alergias conocidas",<span style={{background:"#FDE7EA",color:"#D23651",borderRadius:999,padding:"2px 9px",fontSize:10.5,fontWeight:700}}>{snap?.allergies.length?"Alta":"—"}</span>)}
       {rsum("#EEEBFD","#6C5CF6","M9 4h6v2H9zM7 5H6v16h12V5h-1",`Problemas activos`,snap?.problems.length?snap.problems.map(DX_LABEL).slice(0,3).join(", "):"Sin problemas activos",badd)}
       {rsum("#E7F0FD","#1769E0","M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z","Medicamentos actuales","Ver en el expediente",badd)}
       {rsum("#E6F6EE","#16A66A","M14 4l6 6M6 14l4 4M16.5 6.5l-10 10","Vacunas","Ver cartilla",badd)}
      </div>
      <div style={{...sec,background:"linear-gradient(180deg,#FBFAFF,#fff)"}}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={{...sect,color:P.purple,display:"flex",alignItems:"center",gap:7}}><NavIcon k="brain"/>Clinical Intelligence (IA)</h3></div><div style={{fontSize:12,fontWeight:600,color:P.muted,marginBottom:8}}>Sugerencias deterministas para este caso:</div>{(findings.length?findings.slice(0,4).map(f=>f.summary):["Considera prueba rápida de estreptococo en faringitis (Centor ≥ 2).","Analgesia con paracetamol o ibuprofeno.","Si fiebre > 72 h o empeoramiento, revalorar."]).map((s,i)=><div key={i} style={{fontSize:12.5,lineHeight:1.5,padding:"5px 0",display:"flex",gap:8}}>• {s}</div>)}<div style={{fontSize:11,color:"#9AA0BC",background:"#F3F2FB",borderRadius:8,padding:"8px 10px",marginTop:8}}>La IA ofrece información de apoyo. La decisión final es del médico. (Determinista · sin IA generativa)</div></div>
      <div style={sec}><h3 style={{...sect,display:"flex",alignItems:"center",gap:8}}>Recordatorios y obligaciones {(gaps?.length??0)>0&&<span style={{background:"#F0455E",color:"#fff",borderRadius:999,padding:"1px 7px",fontSize:11}}>{gaps!.length}</span>}</h3>{(gaps?.length?gaps.slice(0,3).map(g=>g.label):["Registrar resultado de laboratorio","Seguimiento en 72 horas"]).map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 0",fontSize:13,borderTop:i?`1px solid #F1F3F9`:"0"}}><div style={{flex:1}}>{r}</div><span style={{background:"#FBF0DC",color:"#B7791F",borderRadius:999,padding:"2px 9px",fontSize:10.5,fontWeight:700}}>Pendiente</span></div>)}<div style={{textAlign:"right",marginTop:6}}><span style={link} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Obligaciones de seguimiento"),0);}}>Ver todos →</span></div></div>
     </div>
    </div>)}
   </div>;
  })() : view==="agenda" ? (()=>{
   // ===== VISTA AGENDA (calendario / citas) — S5.png =====
   const meses=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
   const dow=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
   const dd=clock.getDate(),mm=clock.getMonth(),yy=clock.getFullYear();
   const fechaLarga=`${dow[clock.getDay()]!.replace(/^\w/,c=>c.toUpperCase())}, ${dd} de ${meses[mm]} de ${yy}`;
   const firstDow=new Date(yy,mm,1).getDay();const daysInM=new Date(yy,mm+1,0).getDate();
   const nowTop=48+((Math.max(7,Math.min(18,clock.getHours()+clock.getMinutes()/60))-7)*56);
   const horaAhora=clock.toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"}).toLowerCase();
   type Ap={h:number;t:string;n:string;m:string;c:"blue"|"green"|"purple"|"amber"|"red"};
   const AC:Record<string,{bg:string;bd:string;fg:string}>={blue:{bg:"#EAF1FD",bd:"#1769E0",fg:"#123c73"},green:{bg:"#E7F7EE",bd:"#16A66A",fg:"#0d5c3b"},purple:{bg:"#EFEBFD",bd:"#6C5CF6",fg:"#382a8f"},amber:{bg:"#FBF2DF",bd:"#E5983B",fg:"#8a5a12"},red:{bg:"#FDEBEE",bd:"#F0455E",fg:"#9c1f34"}};
   const col1:Ap[]=[{h:8,t:"8:00–8:30",n:"Juan Pérez García",m:"Control DM2",c:"blue"},{h:9,t:"9:00–9:30",n:"Ana Ramírez Torres",m:"Resultado de laboratorio",c:"green"},{h:10,t:"10:00–10:30",n:"Carlos Díaz Martínez",m:"Dolor abdominal",c:"red"},{h:11,t:"11:00–11:30",n:"Sofía Vega Ramírez",m:"Control prenatal",c:"blue"},{h:12,t:"12:00–12:30",n:"Miguel Ruiz Herrera",m:"HTA",c:"purple"},{h:14,t:"2:00–2:30",n:"María Fernández López",m:"Primera vez",c:"purple"},{h:15,t:"3:00–3:30",n:"Laura Sánchez López",m:"Ansiedad",c:"green"},{h:16,t:"4:00–4:30",n:"Daniel López Vargas",m:"Revisión postoperatoria",c:"blue"}];
   const col2:Ap[]=[{h:8,t:"8:00–9:00 a.m.",n:"Procedimiento menor",m:"Curaciones",c:"amber"},{h:10,t:"10:00–11:00",n:"Aplicación de vacuna",m:"Influenza",c:"purple"},{h:12,t:"12:00–1:00",n:"Retiro de puntos",m:"Procedimiento",c:"red"},{h:15,t:"3:00–4:00",n:"Nebulización / Terapia",m:"Paciente pediátrico",c:"amber"}];
   const col3:Ap[]=[{h:9,t:"9:00–9:30 a.m.",n:"Control pediátrico",m:"Emilio Torres (6 años)",c:"purple"},{h:10,t:"10:30–11:00",n:"Control geriátrico",m:"Rosa Méndez (68 años)",c:"green"},{h:13,t:"1:00–1:30",n:"Resultados",m:"Luis Herrera",c:"blue"},{h:14,t:"2:30–3:00",n:"Control asma",m:"Valeria Gómez (14 años)",c:"red"},{h:16,t:"4:30–5:00",n:"Seguimiento",m:"José Ramírez",c:"green"}];
   const hours=[7,8,9,10,11,12,13,14,15,16,17,18];
   const hLabel=(h:number)=>h<12?`${h}:00 a.m.`:h===12?"12:00 p.m.":`${h-12}:00 p.m.`;
   const apAt=(col:Ap[],h:number)=>col.find(a=>a.h===h);
   const card2:React.CSSProperties={...card,marginTop:0};
   const sect:React.CSSProperties={fontSize:15,fontWeight:700};
   const link:React.CSSProperties={color:P.blue,fontSize:13,fontWeight:600,cursor:"pointer"};
   const slot=(a?:Ap,last?:boolean)=>{return <div style={{borderRight:last?"0":`1px solid ${LINE}`,borderBottom:`1px solid #F2F4F9`,height:56,padding:3}}>{a&&(()=>{const c=AC[a.c]!;return <div style={{borderRadius:8,padding:"6px 9px",fontSize:11,height:"100%",overflow:"hidden",borderLeft:`3px solid ${c.bd}`,background:c.bg,color:c.fg,cursor:"pointer"}}><div style={{fontSize:10,opacity:.85}}>{a.t}</div><div style={{fontWeight:700,fontSize:11.5}}>{a.n}</div><div style={{opacity:.8}}>{a.m}</div></div>;})()}</div>;};
   const gdot=(c:string)=><span style={{width:8,height:8,borderRadius:"50%",background:c,flex:"0 0 auto"}}/>;
   const rkico=(bg:string,fg:string,d:string)=><span style={{width:38,height:38,borderRadius:10,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const nueva=()=>{setView("exp");setTimeout(()=>scrollToSection("Agenda"),0);};
   return <div style={{padding:"20px 24px 40px",display:"grid",gridTemplateColumns:"1fr 340px",gap:16,alignItems:"start"}} className="mos-ag">
    <div>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div><h1 style={{fontSize:29,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Agenda</h1><p style={{color:P.muted,fontSize:13.5,margin:"5px 0 0"}}>Administra tus citas, consultas y procedimientos.</p></div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><button style={{display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Bloques de tiempo</button><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 14px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Todos los consultorios ▾</button><button style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={nueva}>+ Nueva cita</button></div>
     </div>
     <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>{["Vista diaria","Vista semanal","Vista mensual","Lista de citas"].map((v,i)=><span key={v} style={{border:`1px solid ${i===0?P.purple:LINE}`,background:i===0?P.purple:P.white,color:i===0?"#fff":P.muted,borderRadius:10,padding:"9px 15px",fontSize:13.5,fontWeight:600,cursor:"pointer"}}>{v}</span>)}</div>
     <div style={{...card2,marginTop:14,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:`1px solid ${LINE}`,flexWrap:"wrap"}}>
       <span style={{width:30,height:30,border:`1px solid ${LINE}`,borderRadius:8,display:"grid",placeItems:"center",cursor:"pointer",color:P.muted}}>‹</span><span style={{width:30,height:30,border:`1px solid ${LINE}`,borderRadius:8,display:"grid",placeItems:"center",cursor:"pointer",color:P.muted}}>›</span>
       <b style={{fontSize:15}}>{fechaLarga}</b><span style={{border:`1px solid ${LINE}`,borderRadius:8,padding:"6px 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Hoy</span>
       <div style={{display:"flex",background:P.canvas,borderRadius:9,padding:3,marginLeft:"auto"}}>{["Día","Semana","Mes"].map((s,i)=><span key={s} style={{padding:"6px 14px",fontSize:13,fontWeight:600,borderRadius:7,cursor:"pointer",background:i===0?P.purple:"transparent",color:i===0?"#fff":P.muted}}>{s}</span>)}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"70px 1fr 1fr 1fr",position:"relative"}}>
       <div style={{padding:"12px 14px",borderBottom:`1px solid ${LINE}`,borderRight:`1px solid ${LINE}`,fontSize:13,fontWeight:700}}>Hora</div>
       {[["#16A66A","Consultorio 1","Consulta general"],["#1769E0","Consultorio 2","Procedimientos"],["#6C5CF6","Consultorio 3","Control y seguimiento"]].map(([c,t,s],i)=><div key={i} style={{padding:"12px 14px",borderBottom:`1px solid ${LINE}`,borderRight:i<2?`1px solid ${LINE}`:"0",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:7}}>{gdot(c as string)}<div>{t as string}<span style={{fontSize:11,color:P.muted,fontWeight:400,display:"block",marginTop:1}}>{s as string}</span></div></div>)}
       {hours.map((h,ri)=>{const last=ri===hours.length-1;return <Fragment key={h}>
        <div style={{borderRight:`1px solid ${LINE}`,borderBottom:last?"0":`1px solid #F2F4F9`,padding:"6px 8px",fontSize:11.5,color:P.muted,textAlign:"right",height:56}}>{hLabel(h)}</div>
        {slot(apAt(col1,h))}{slot(apAt(col2,h))}{slot(apAt(col3,h),true)}
       </Fragment>;})}
       <div style={{position:"absolute",left:70,right:0,top:nowTop,height:2,background:"#F0455E",zIndex:5}}><span style={{position:"absolute",left:0,top:-9,background:"#F0455E",color:"#fff",fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:5}}>{horaAhora}</span></div>
      </div>
      <div style={{display:"flex",gap:18,flexWrap:"wrap",padding:"14px 16px",fontSize:12,color:P.muted}}>{[["#1769E0","Consulta general"],["#16A66A","Control / Seguimiento"],["#6C5CF6","Primera vez"],["#E5983B","Procedimiento"],["#8B7DF8","Vacunación"],["#20B7D9","Resultados"],["#F0455E","Urgencia"]].map(([c,l])=><span key={l} style={{display:"flex",alignItems:"center",gap:7}}>{gdot(c as string)}{l as string}</span>)}</div>
     </div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:16}} className="mos-agr">
     <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,fontWeight:700}}><span>‹ {meses[mm]!.replace(/^\w/,c=>c.toUpperCase())} {yy}</span><span style={{color:P.muted}}>‹ ›</span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,textAlign:"center",fontSize:12}}>
       {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d=><span key={d} style={{padding:"7px 0",color:P.muted,fontWeight:600}}>{d}</span>)}
       {Array.from({length:firstDow}).map((_,i)=><span key={"e"+i}/>)}
       {Array.from({length:daysInM}).map((_,i)=>{const day=i+1;const isToday=day===dd;return <span key={day} style={{padding:"7px 0",borderRadius:7,cursor:"pointer",background:isToday?P.purple:"transparent",color:isToday?"#fff":P.ink,fontWeight:isToday?700:400}}>{day}</span>;})}
      </div>
     </div>
     <div style={card2}><div style={{display:"flex",justifyContent:"space-between",padding:"16px 16px 10px"}}><span style={sect}>Resumen del día</span><span style={link}>Ver reportes →</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"0 16px 16px"}}>
       {([["#EEEBFD","#6C5CF6","M4 5h16v16H4zM8 3v4M16 3v4","12","Citas programadas"],["#E6F6EE","#16A66A","M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z","9","Atendidas"],["#FBF0DC","#B7791F","M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0","2","En espera"],["#FDECEE","#F0455E","M9 9l6 6M15 9l-6 6M21 12a9 9 0 11-18 0 9 9 0 0118 0","1","Canceladas"]] as const).map(([bg,fg,d,v,l])=><div key={l} style={{display:"flex",gap:11,alignItems:"center",padding:12,border:`1px solid ${LINE}`,borderRadius:12}}>{rkico(bg,fg,d)}<div><div style={{fontSize:20,fontWeight:800}}>{v}</div><div style={{fontSize:11,color:P.muted}}>{l}</div></div></div>)}
      </div>
     </div>
     <div style={card2}><div style={{display:"flex",justifyContent:"space-between",padding:"16px 16px 6px"}}><span style={sect}>Próximas citas</span><span style={link}>Ver todas →</span></div>
      {[["2:00 p.m.","MF","María Fernández López","Primera vez","esp"],["2:30 p.m.","VG","Control asma","Valeria Gómez (14 años)","esp"],["3:00 p.m.","LS","Laura Sánchez López","Ansiedad","conf"],["4:00 p.m.","DL","Daniel López Vargas","Revisión postoperatoria","conf"]].map(([tm,ini,n,m,st],i)=><div key={i} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 16px",borderTop:`1px solid #F1F3F9`}}><span style={{fontSize:13,color:P.muted,width:52,flex:"0 0 auto"}}>{tm}</span><span style={{width:34,height:34,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,flex:"0 0 auto"}}>{ini}</span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13}}>{n}</div><div style={{fontSize:11.5,color:P.muted}}>{m}</div></div><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",...(st==="esp"?{background:"#FDE7EA",color:"#D23651"}:{background:"#E6F6EE",color:"#16A66A"})}}>{st==="esp"?"En espera":"Confirmada"}</span></div>)}
     </div>
     <div style={card2}><div style={{padding:"16px 16px 4px"}}><span style={sect}>Acciones rápidas</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"8px 16px 16px"}}>{["Nueva cita","Reprogramar citas","Bloque de tiempo","Ver disponibilidad","Lista de espera","Exportar agenda","Enviar recordatorios","Configuración"].map(a=><button key={a} style={{display:"flex",alignItems:"center",gap:9,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 12px",fontSize:12.5,fontWeight:600,cursor:"pointer",color:P.ink,fontFamily:UI}} onClick={nueva}><span style={{width:7,height:7,borderRadius:"50%",background:P.purple,flex:"0 0 auto"}}/>{a}</button>)}</div>
     </div>
    </div>
   </div>;
  })() : view==="resultados" ? (()=>{
   // ===== VISTA RESULTADOS (gestión global de estudios) — S6.png =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const link:React.CSSProperties={color:P.blue,fontSize:12.5,fontWeight:600,cursor:"pointer"};
   const fdrop:React.CSSProperties={display:"inline-flex",alignItems:"center",gap:7,background:P.white,border:`1px solid ${LINE}`,borderRadius:10,padding:"9px 13px",fontSize:13,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"};
   const kico=(bg:string,fg:string,d:string)=><span style={{width:42,height:42,borderRadius:11,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:16,display:"flex",gap:13,alignItems:"center"};
   const initials=(n:string)=>n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const stB=(s:string):[string,string]=>s==="Crítico"?["#FDE7EA","#D23651"]:s==="Alerta"?["#FBF0DC","#B7791F"]:["#E6F6EE","#16A66A"];
   type Res={fecha:string;hora:string;pac:string;age:string;sexo:string;estudio:string;sub:string;tipo:string;hall:string[];hallCrit:boolean;estado:string};
   const ROWS:Res[]=[
    {fecha:"16 sep 2026",hora:"1:15 p.m.",pac:"María Fernández López",age:"28 años",sexo:"F",estudio:"Biometría hemática",sub:"Completa",tipo:"Laboratorio",hall:["Leucocitos 14.8 ↑","Neutrófilos 82% ↑"],hallCrit:true,estado:"Crítico"},
    {fecha:"15 sep 2026",hora:"10:30 a.m.",pac:"Juan Pérez García",age:"58 años",sexo:"M",estudio:"Química sanguínea",sub:"Perfil completo",tipo:"Laboratorio",hall:["Glucosa 168 ↑","HbA1c 8.1% ↑"],hallCrit:true,estado:"Alerta"},
    {fecha:"14 sep 2026",hora:"9:20 a.m.",pac:"Ana Ramírez Torres",age:"72 años",sexo:"F",estudio:"Rx de tórax",sub:"PA y lateral",tipo:"Imagen",hall:["Sin datos de consolidación.","Silueta cardiaca normal."],hallCrit:false,estado:"Normal"},
    {fecha:"12 sep 2026",hora:"4:45 p.m.",pac:"Carlos Díaz Martínez",age:"45 años",sexo:"M",estudio:"Perfil lipídico",sub:"",tipo:"Laboratorio",hall:["LDL 162 ↑","Triglicéridos 281 ↑"],hallCrit:true,estado:"Alerta"},
    {fecha:"10 sep 2026",hora:"11:10 a.m.",pac:"Sofía Vega Ramírez",age:"31 años",sexo:"F",estudio:"USG obstétrico",sub:"Primer trimestre",tipo:"Imagen",hall:["Embarazo intrauterino viable","EG: 10.2 semanas"],hallCrit:false,estado:"Normal"},
    {fecha:"08 sep 2026",hora:"3:00 p.m.",pac:"Miguel Ruiz Herrera",age:"49 años",sexo:"M",estudio:"TAC de abdomen",sub:"Con contraste",tipo:"Imagen",hall:["Apendicitis aguda no complicada"],hallCrit:false,estado:"Alerta"},
    {fecha:"05 sep 2026",hora:"9:15 a.m.",pac:"Laura Sánchez López",age:"39 años",sexo:"F",estudio:"Examen general de orina",sub:"",tipo:"Laboratorio",hall:["Esterasa leucocitaria +","Nitritos +"],hallCrit:true,estado:"Alerta"},
    {fecha:"03 sep 2026",hora:"12:20 p.m.",pac:"Elena Prado Núñez",age:"47 años",sexo:"F",estudio:"Papanicolaou",sub:"",tipo:"Patología",hall:["Negativo para lesión intraepitelial o malignidad"],hallCrit:false,estado:"Normal"},
   ];
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:"#9AA0BC",fontWeight:600,padding:"12px 14px",borderBottom:`1px solid ${LINE}`};
   const td:React.CSSProperties={padding:"11px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:13,verticalAlign:"top"};
   // Gráfica de evolución (SVG hecha a mano) — valores representativos de leucocitos.
   const chart=(()=>{const pts=[7.2,7.4,7.8,8.4,7.6,14.8];const W=320,H=150,padL=34,cb=118,top=30;const dmin=0,dmax=15;const x=(i:number)=>50+i/(pts.length-1)*(296-50);const y=(v:number)=>top+(1-(v-dmin)/(dmax-dmin))*(cb-top);const line=pts.map((p,i)=>`${x(i).toFixed(0)},${y(p).toFixed(0)}`).join(" ");
    return <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}} role="img" aria-label="Evolución de leucocitos"><rect x={padL} y={y(15)} width={272} height={y(10)-y(15)} fill="#FDECEE"/><line x1={padL} y1={y(15)} x2={306} y2={y(15)} stroke="#F0455E" strokeDasharray="3 3" strokeWidth="1"/>{[15,10,5,0].map(t=><text key={t} x={30} y={y(t)+3} textAnchor="end" fontSize="9" fill="#9AA0BC">{t}</text>)}<polyline points={line} fill="none" stroke={P.purple} strokeWidth="2.2"/>{pts.map((p,i)=>i<pts.length-1?<circle key={i} cx={x(i)} cy={y(p)} r={3} fill="#fff" stroke={P.purple} strokeWidth="2"/>:<circle key={i} cx={x(i)} cy={y(p)} r={4.5} fill="#F0455E"/>)}{["Abr","May","Jun","Jul","Ago","Sep"].map((m,i)=><text key={m} x={x(i)} y={140} textAnchor="middle" fontSize="9" fill="#9AA0BC">{m}</text>)}</svg>;})();
   return <div style={{display:"grid",gridTemplateColumns:"1fr 372px",gap:0}} className="mos-res">
    <div style={{padding:"20px 24px 40px"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div><h1 style={{fontSize:29,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Resultados</h1><p style={{color:P.muted,fontSize:13.5,margin:"5px 0 0"}}>Consulta, analiza y da seguimiento a los estudios de tus pacientes.</p></div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{...fdrop,padding:"10px 16px",fontWeight:600}}>Exportar</button><button style={{...fdrop,padding:"10px 16px",fontWeight:600}}>Cargar resultado</button><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Resultados diagnósticos"),0);}}>+ Nuevo resultado</button></div>
     </div>
     <div style={{display:"flex",gap:4,marginTop:16,borderBottom:`1px solid ${LINE}`,overflowX:"auto"}}>{["Todos","Laboratorio","Imagen","Patología","Otros","Tendencias"].map((t,i)=><span key={t} style={{padding:"11px 15px",fontSize:13.5,fontWeight:i===0?700:500,color:i===0?P.purple:P.muted,cursor:"pointer",borderBottom:i===0?`2px solid ${P.purple}`:"2px solid transparent",whiteSpace:"nowrap"}}>{t}</span>)}</div>
     <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}><div style={{flex:1,minWidth:200,display:"flex",alignItems:"center",gap:9,background:P.white,border:`1px solid ${LINE}`,borderRadius:10,padding:"9px 13px",color:P.muted,fontSize:13.5}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>Buscar por paciente, estudio o hallazgo…</div><span style={fdrop}>Últimos 6 meses ▾</span><span style={fdrop}>Todos los tipos ▾</span><span style={fdrop}>Todos los estados ▾</span></div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:14,marginTop:16}} className="mos-kpis">
      <div style={kcard}>{kico("#EEEBFD",P.purple,"M7 3h10v18H7zM10 8h4M10 12h4")}<div><div style={{fontSize:12.5,color:P.muted}}>Total de resultados</div><div style={{fontSize:24,fontWeight:800}}>1,248</div></div></div>
      <div style={kcard}>{kico("#E6F6EE",P.green,"M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z")}<div><div style={{fontSize:12.5,color:P.muted}}>Resultados normales</div><div style={{fontSize:24,fontWeight:800}}>892 <span style={{fontSize:12,color:P.muted,fontWeight:600}}>(71%)</span></div></div></div>
      <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 4l9 15.5H3zM12 10v4M12 17h.01")}<div><div style={{fontSize:12.5,color:P.muted}}>Resultados con alerta</div><div style={{fontSize:24,fontWeight:800}}>284 <span style={{fontSize:12,color:P.muted,fontWeight:600}}>(23%)</span></div></div></div>
      <div style={kcard}>{kico("#FDECEE",P.red,"M7 3h10v18H7zM10 8h4")}<div><div style={{fontSize:12.5,color:P.muted}}>Resultados críticos</div><div style={{fontSize:24,fontWeight:800}}>72 <span style={{fontSize:12,color:P.muted,fontWeight:600}}>(6%)</span></div></div></div>
     </div>
     <div style={{...card2,marginTop:16,overflow:"hidden"}}>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr><th style={{...th,width:32}}></th>{["Fecha","Paciente","Estudio","Tipo","Principales hallazgos","Estado",""].map((h,i)=><th key={i} style={th}>{h}</th>)}</tr></thead>
       <tbody>{ROWS.map((r,i)=>{const[sbg,sfg]=stB(r.estado);return <tr key={i} style={{background:i===0?"#F6F5FE":"transparent",cursor:"pointer"}}>
        <td style={td}><span style={{width:16,height:16,border:"1.6px solid #C7CCE0",borderRadius:4,display:"inline-block"}}/></td>
        <td style={td}>{r.fecha}<div style={{color:"#9AA0BC",fontSize:11}}>{r.hora}</div></td>
        <td style={td}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{width:34,height:34,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,flex:"0 0 auto"}}>{initials(r.pac)}</span><div><div style={{fontWeight:600}}>{r.pac}</div><div style={{fontSize:11,color:"#9AA0BC"}}>{r.age} · {r.sexo}</div></div></div></td>
        <td style={td}>{r.estudio}{r.sub&&<div style={{color:P.muted}}>{r.sub}</div>}</td>
        <td style={{...td,color:r.tipo==="Laboratorio"?P.blue:P.ink}}>{r.tipo}</td>
        <td style={td}>{r.hall.map((h,j)=><div key={j} style={{color:r.hallCrit?"#D23651":P.ink,fontWeight:r.hallCrit?600:400}}>{h}</div>)}</td>
        <td style={td}><span style={{fontSize:11.5,fontWeight:600,borderRadius:999,padding:"3px 11px",background:sbg,color:sfg}}>{r.estado}</span></td>
        <td style={{...td,color:"#9AA0BC",fontWeight:800}}>···</td>
       </tr>;})}</tbody>
      </table></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",fontSize:13,color:P.muted,flexWrap:"wrap",gap:10}}><span>Mostrando 1–8 de 1,248 resultados</span><div style={{display:"flex",gap:5}}>{["‹","1","2","3","4","5","…","156","›"].map((p,i)=><span key={i} style={{minWidth:32,height:32,border:`1px solid ${LINE}`,background:p==="1"?P.purple:P.white,color:p==="1"?"#fff":P.ink,borderRadius:8,display:"grid",placeItems:"center",fontSize:13,cursor:"pointer",padding:"0 6px"}}>{p}</span>)}</div><span style={fdrop}>8 por página ▾</span></div>
     </div>
    </div>
    <div style={{borderLeft:`1px solid ${LINE}`,background:P.white,padding:"18px 20px",minHeight:"100vh"}} className="mos-detail">
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",color:P.muted,fontSize:13.5,fontWeight:600}}><span style={{cursor:"pointer"}}>← Volver a resultados</span><span style={{cursor:"pointer",fontWeight:800}}>···</span></div>
     <div style={{display:"flex",alignItems:"center",gap:12,marginTop:14}}><span style={{width:52,height:52,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontWeight:700,fontSize:16}}>MF</span><div style={{flex:1}}><div style={{fontWeight:800,fontSize:16}}>María Fernández López</div><div style={{fontSize:12.5,color:P.muted}}>28 años · F</div><div style={{fontSize:11,color:P.muted}}>CURP: FEFM960812MCHRRR04</div></div><span style={{fontSize:11.5,fontWeight:600,borderRadius:999,padding:"3px 11px",background:"#FDE7EA",color:"#D23651"}}>Resultado crítico</span></div>
     <div style={{display:"flex",gap:18,borderBottom:`1px solid ${LINE}`,margin:"16px 0"}}>{["Resumen","Tendencia","Interpretación","Archivo"].map((t,i)=><span key={t} style={{fontSize:13.5,color:i===0?P.purple:P.muted,fontWeight:i===0?700:500,paddingBottom:9,borderBottom:i===0?`2px solid ${P.purple}`:"0",cursor:"pointer"}}>{t}</span>)}</div>
     <div style={{display:"flex",gap:12,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:11,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/></svg></span><div><div style={{fontWeight:700,fontSize:15}}>Biometría hemática completa</div><div style={{fontSize:12,color:P.muted}}>16 de septiembre de 2026 · 1:15 p.m.</div><div style={{fontSize:12,color:P.muted}}>Laboratorio Central · Folio: LC-260916-00123</div></div></div>
     <div style={{background:"#FDECEE",border:"1px solid #F6CDD3",borderRadius:12,padding:"13px 15px",marginTop:12}}><div style={{display:"flex",gap:8,alignItems:"center",fontWeight:700,color:"#D23651",fontSize:13.5}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 4l9 15.5H3zM12 10v4M12 17h.01"/></svg>Hallazgos críticos</div><div style={{fontSize:12.5,marginTop:6}}>Leucocitos: 14.8 x10³/µL (↑)<br/>Neutrófilos: 82% (↑)</div><div style={{color:P.blue,fontSize:12.5,fontWeight:600,marginTop:6,cursor:"pointer"}}>Ver interpretación completa →</div></div>
     <div style={{fontSize:14,fontWeight:700,margin:"16px 0 8px"}}>Valores principales</div>
     <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Parámetro","Resultado","Rango de referencia","Estado"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,padding:"7px 6px",color:"#9AA0BC"}}>{h}</th>)}</tr></thead><tbody>{([["Leucocitos","14.8 x10³/µL","4.0 – 10.0","Crítico"],["Neutrófilos","82 %","40 – 70","Crítico"],["Hemoglobina","13.2 g/dL","12.0 – 16.0","Normal"],["Plaquetas","320 x10³/µL","150 – 450","Normal"]] as const).map(([p,r,rf,st])=>{const[sb,sf]=stB(st);return <tr key={p}><td style={{fontSize:12.5,padding:"8px 6px",borderBottom:`1px solid #F4F6FB`,color:st==="Crítico"?"#D23651":P.ink,fontWeight:st==="Crítico"?600:400}}>{p}</td><td style={{fontSize:12.5,padding:"8px 6px",borderBottom:`1px solid #F4F6FB`}}>{r}</td><td style={{fontSize:12.5,padding:"8px 6px",borderBottom:`1px solid #F4F6FB`}}>{rf}</td><td style={{padding:"8px 6px",borderBottom:`1px solid #F4F6FB`}}><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:sb,color:sf}}>{st}</span></td></tr>;})}</tbody></table>
     <div style={{...link,marginTop:8}}>Ver todos los parámetros (22) →</div>
     <div style={{fontSize:14,fontWeight:700,margin:"16px 0 8px"}}>Evolución de leucocitos</div>
     <div style={{border:`1px solid ${LINE}`,borderRadius:12,padding:12}}>{chart}</div>
     <div style={{display:"flex",gap:8,marginTop:14}}><button style={{...fdrop,flex:1,justifyContent:"center",padding:9}}>Descargar PDF</button><button style={{...fdrop,flex:1,justifyContent:"center",padding:9}}>Compartir</button><button style={{flex:1,border:0,background:P.purple,color:"#fff",borderRadius:10,padding:9,fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:UI}} onClick={()=>setView("consulta")}>Agregar a consulta</button></div>
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
    <button style={btn} disabled={busy!==""||!regName} onClick={registerPatient}>{busy==="pt-reg"?"Registrando…":"Registrar"}</button>
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
