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
type TL=Readonly<{aggregateType:string;aggregateId:string;latestKind:string;version:number;lastAt:string}>;
const TYPE_LABEL:Record<string,string>={Encounter:"Encuentro",ClinicalOrder:"Orden",Medication:"Medicación",DiagnosticResult:"Resultado",ClinicalDocument:"Documento",ClinicalObligation:"Obligación",ClinicalProblem:"Problema",Allergy:"Alergia"};
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
function stateBadge(s:string){const m:Record<string,[string,string]>={SIGNED:["#e8f7ee","#1a7f43"],READY_TO_SIGN:["#fff4e5","#a15c00"],OPEN:["#eef0ff","#3f3aa0"],PROPOSED:["#eef0ff","#3f3aa0"],PRESCRIBED:["#eaf3ff","#1f5fb0"],ACTIVE:["#e8f7ee","#1a7f43"],STOPPED:["#f1f1f4","#5f6072"],RECEIVED:["#eef0ff","#3f3aa0"],VERIFIED:["#eaf3ff","#1f5fb0"],ACTIONED:["#fff4e5","#a15c00"],CLOSED:["#e8f7ee","#1a7f43"],DRAFT:["#eef0ff","#3f3aa0"],FINALIZED:["#eaf3ff","#1f5fb0"],AMENDED:["#e8f7ee","#1a7f43"],ORDERED:["#eaf3ff","#1f5fb0"],FULFILLED:["#e8f7ee","#1a7f43"],CANCELLED:["#f1f1f4","#5f6072"],IN_PROGRESS:["#fff4e5","#a15c00"],COMPLETED:["#e8f7ee","#1a7f43"],ACTIVE_PROB:["#eef0ff","#3f3aa0"],RESOLVED:["#f1f1f4","#5f6072"],CHRONIC:["#fff4e5","#a15c00"],ENTERED_IN_ERROR:["#f1f1f4","#5f6072"],REFUTED:["#f1f1f4","#5f6072"],INACTIVE:["#f1f1f4","#5f6072"]};const c=m[s]??["#eef0ff","#3f3aa0"];return{display:"inline-block",background:c[0],color:c[1],fontWeight:700,fontSize:12,padding:"3px 10px",borderRadius:999};}
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
 const[tl,setTl]=useState<TL[]|null>(null);
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
  const id=uuid();const r=await apiRequest("/api/v1/problems",{method:"POST",body:{problemId:id,patientId,code:probCode||"NA",description:probDesc,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setProblems(ps=>[...ps,{id,label:`${probDesc}${probCode?` (${probCode})`:""}`,state:"ACTIVE",version:Number(r.body["version"]??1)}]);setProbCode("");setProbDesc("");
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
 function selectPatientRaw(id:string,name:string){setPatientId(id);setPatientName(name);setEnc(null);setAssessment("");setPlan("");setMeds([]);setResults([]);setDocs([]);setOrders([]);setObligations([]);setProblems([]);setAllergies([]);setTl(null);setError("");}
 const loadPatients=()=>call("pt-list",async()=>{
  const r=await apiRequest("/api/v1/patients",{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  setPatientList((r.body["patients"] as {patientId:string;name:string;status:string}[])??[]);
 });
 const registerPatient=()=>call("pt-reg",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/patients",{method:"POST",body:{patientId:id,name:regName,birthDate:regDob||"1990-01-01",sexAtBirth:regSex,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  selectPatientRaw(id,regName);setPatientList(l=>[{patientId:id,name:regName,status:"ACTIVE"},...(l??[])]);setRegName("");setRegDob("");
 });
 const loadTimeline=()=>call("tl",async()=>{
  const r=await apiRequest(`/api/v1/patients/${patientId}/timeline`,{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  setTl((r.body["items"] as TL[])??[]);
 });
 function reset(){setEnc(null);setAssessment("");setPlan("");setMeds([]);setResults([]);setDocs([]);setOrders([]);setObligations([]);setProblems([]);setAllergies([]);setTl(null);setError("");setPatientId(uuid());}

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
    <button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={loadTimeline}>{busy==="tl"?"Cargando…":"Actualizar"}</button>
   </div>
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Vista longitudinal de los items clínicos de este paciente (metadatos, sin contenido).</p>
   {tl===null?<p style={{color:"#8a8b9a",fontSize:13,marginTop:12}}>Pulsa “Actualizar” para cargar el historial de este paciente.</p>
    :tl.length===0?<p style={{color:"#8a8b9a",fontSize:13,marginTop:12}}>Sin items registrados para este paciente todavía.</p>
    :<div>
     {(()=>{const s=summarizePatient(tl);const stat=(n:number,l:string,warn=false)=>(<div style={{flex:"1 1 90px",minWidth:90,textAlign:"center",padding:"10px 8px",borderRadius:12,background:warn&&n>0?"#fff4e5":"#f6f6fb",border:"1px solid #eceafb"}}><div style={{fontSize:22,fontWeight:800,color:warn&&n>0?"#a15c00":"#3f3aa0"}}>{n}</div><div style={{fontSize:11,color:"#6d6e80"}}>{l}</div></div>);
      return <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>{stat(s.activeAllergies,"Alergias activas",true)}{stat(s.activeProblems,"Problemas activos")}{stat(s.signedEncounters,"Encuentros firmados")}{stat(s.activeMedications,"Medicación activa")}{stat(s.openResults,"Resultados abiertos",true)}{stat(s.openOrders,"Órdenes pendientes")}{stat(s.openObligations,"Obligaciones abiertas",true)}</div>;})()}
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
   <p style={{color:"#8a8b9a",fontSize:12,margin:"4px 0 0"}}>Diagnósticos/problemas activos del paciente (chart longitudinal, PROD-011).</p>
   <div style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:10,marginTop:12}}>
    <input style={input} value={probCode} onChange={e=>setProbCode(e.target.value)} placeholder="Código (J02.9)" />
    <input style={input} value={probDesc} onChange={e=>setProbDesc(e.target.value)} placeholder="Descripción (ej. Faringitis aguda)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!probDesc} onClick={createProblem}>{busy==="pb-new"?"Añadiendo…":"Añadir problema"}</button></div>
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
