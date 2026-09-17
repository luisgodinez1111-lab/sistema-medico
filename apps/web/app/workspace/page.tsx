"use client";
import{useEffect,useState}from"react";
import{getStoredSession,apiRequest,logout as sessionLogout,type MedicalSession}from"../../lib/session-client";
import{summarizePatient}from"../../../../packages/patient-summary/src";
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
type Vit=Readonly<{id:string;vitalType:string;value:string;unit:string;state:VitSt;version:number}>;
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

const wrap:React.CSSProperties={maxWidth:900,margin:"0 auto",padding:32};
const card:React.CSSProperties={background:"white",border:"1px solid #e7e6f2",borderRadius:18,padding:24,boxShadow:"0 6px 20px #19145b0a",marginTop:20};
const btn:React.CSSProperties={background:"#6255c7",color:"white",border:0,borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontSize:14};
const ghost:React.CSSProperties={...btn,background:"transparent",color:"#6255c7",border:"1px solid #d9d6f2"};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"10px 12px",border:"1px solid #d9d6f2",borderRadius:10,fontSize:14,fontFamily:"inherit"};
const mono:React.CSSProperties={fontFamily:"ui-monospace,Menlo,monospace",fontSize:12,background:"#f4f3fb",padding:"2px 6px",borderRadius:6};
const lbl:React.CSSProperties={fontSize:13,fontWeight:600,color:"#4b4c5e",display:"block",margin:"12px 0 6px"};
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
 const[patientList,setPatientList]=useState<{patientId:string;name:string;status:string}[]|null>(null);
 const[regName,setRegName]=useState("");const[regDob,setRegDob]=useState("");const[regSex,setRegSex]=useState("UNKNOWN");
 const[busy,setBusy]=useState("");
 const[error,setError]=useState("");

 useEffect(()=>{setSession(getStoredSession());setPatientId(uuid());setReady(true);},[]);

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
  setVitals(vs=>[...vs,{id,vitalType:vitType,value:vitValue,unit:vitUnit,state:"RECORDED",version:Number(r.body["version"]??1)}]);setVitValue("");
 });
 const doVitAction=(v:Vit,act:{path:string;body:Record<string,unknown>;to:VitSt})=>call("vit-"+v.id,async()=>{
  const r=await apiRequest(act.path,{method:"POST",body:act.body,ifMatch:v.version});
  if(r.status>=400){setError(errMsg(r));return;}
  const nv=act.body["value"];setVitals(vs=>vs.map(x=>x.id===v.id?{...x,state:act.to,value:typeof nv==="string"?nv:x.value,version:Number(r.body["version"]??x.version+1)}:x));
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
  setPatientList((r.body["patients"] as {patientId:string;name:string;status:string}[])??[]);
 });
 const loadPanel=()=>call("panel",async()=>{
  const r=await apiRequest("/api/v1/worklist",{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  setPanel({gaps:(r.body["gaps"] as PanelGap[])??[],patientCount:Number(r.body["patientCount"]??0)});
 });
 const registerPatient=()=>call("pt-reg",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/patients",{method:"POST",body:{patientId:id,name:regName,birthDate:regDob||"1990-01-01",sexAtBirth:regSex,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  selectPatientRaw(id,regName);setPatientList(l=>[{patientId:id,name:regName,status:"ACTIVE"},...(l??[])]);setRegName("");setRegDob("");
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

 return <main style={wrap}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
   <div><div style={{fontSize:13,color:"#6255c7",fontWeight:700}}>MEDICAL OS</div><h1 style={{fontSize:32,margin:"4px 0"}}>Espacio clínico</h1></div>
   <button style={ghost} onClick={async()=>{await sessionLogout();location.href="/login";}}>Cerrar sesión</button>
  </div>
  <p style={{color:"#6d6e80"}}>Sesión <span style={mono}>{session.sessionId.slice(0,8)}</span> · válida hasta {new Date(session.expiresAt*1000).toLocaleTimeString()} · paciente {patientName?<b>{patientName}</b>:<span style={mono}>{patientId.slice(0,8)}</span>} <button style={{...ghost,padding:"2px 10px",fontSize:12,marginLeft:8}} onClick={reset}>Anónimo nuevo</button></p>

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
     <div><b style={{fontSize:14}}>{v.vitalType}: {v.value} {v.unit}</b><div style={{fontSize:12,color:"#8a8b9a"}}>v{v.version}</div></div>
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

  {error&&<div style={{...card,borderColor:"#f0c6c0",background:"#fdf3f2"}}><b style={{color:"#c0392b"}}>Error</b><p style={{margin:"6px 0 0",color:"#7a3b34",wordBreak:"break-word"}}>{error}</p>{error.includes("SAFETY_BLOCKED")&&<p style={{margin:"6px 0 0",fontSize:12,color:"#a15c00"}}>💡 ¿Hay un resultado crítico sin cerrar para este paciente? Ciérralo abajo y vuelve a firmar.</p>}</div>}
 </main>;
}
