"use client";
import{useEffect,useState}from"react";
import{getStoredSession,apiRequest,clearStoredSession,type MedicalSession}from"../../lib/session-client";
// EPIC K — Espacio de trabajo clínico. Consume los endpoints ya probados con la sesión autenticada.
// Módulos: encuentro (abrir->valorar->firmar) y medicación (proponer->prescribir->activar->suspender),
// ambos para el mismo paciente, con concurrencia optimista (If-Match).

type EncState="OPEN"|"READY_TO_SIGN"|"SIGNED";
type Encounter=Readonly<{id:string;state:EncState;version:number;signatureDigest?:string}>;
type MedState="PROPOSED"|"PRESCRIBED"|"ACTIVE"|"STOPPED";
type Med=Readonly<{id:string;label:string;state:MedState;version:number}>;

const wrap:React.CSSProperties={maxWidth:900,margin:"0 auto",padding:32};
const card:React.CSSProperties={background:"white",border:"1px solid #e7e6f2",borderRadius:18,padding:24,boxShadow:"0 6px 20px #19145b0a",marginTop:20};
const btn:React.CSSProperties={background:"#6255c7",color:"white",border:0,borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontSize:14};
const ghost:React.CSSProperties={...btn,background:"transparent",color:"#6255c7",border:"1px solid #d9d6f2"};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"10px 12px",border:"1px solid #d9d6f2",borderRadius:10,fontSize:14,fontFamily:"inherit"};
const mono:React.CSSProperties={fontFamily:"ui-monospace,Menlo,monospace",fontSize:12,background:"#f4f3fb",padding:"2px 6px",borderRadius:6};
const lbl:React.CSSProperties={fontSize:13,fontWeight:600,color:"#4b4c5e",display:"block",margin:"12px 0 6px"};
function stateBadge(s:string){const m:Record<string,[string,string]>={SIGNED:["#e8f7ee","#1a7f43"],READY_TO_SIGN:["#fff4e5","#a15c00"],OPEN:["#eef0ff","#3f3aa0"],PROPOSED:["#eef0ff","#3f3aa0"],PRESCRIBED:["#eaf3ff","#1f5fb0"],ACTIVE:["#e8f7ee","#1a7f43"],STOPPED:["#f1f1f4","#5f6072"]};const c=m[s]??["#eef0ff","#3f3aa0"];return{display:"inline-block",background:c[0],color:c[1],fontWeight:700,fontSize:12,padding:"3px 10px",borderRadius:999};}
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

export default function Workspace(){
 const[session,setSession]=useState<MedicalSession|null>(null);
 const[ready,setReady]=useState(false);
 const[patientId,setPatientId]=useState("");
 const[enc,setEnc]=useState<Encounter|null>(null);
 const[assessment,setAssessment]=useState("");
 const[plan,setPlan]=useState("");
 const[meds,setMeds]=useState<Med[]>([]);
 const[drug,setDrug]=useState("");const[dose,setDose]=useState("");const[route,setRoute]=useState("VO");const[freq,setFreq]=useState("");
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
 function reset(){setEnc(null);setAssessment("");setPlan("");setMeds([]);setError("");setPatientId(uuid());}

 if(!ready)return <main style={wrap}><p>Cargando…</p></main>;
 if(!session)return <main style={wrap}>
  <div style={{fontSize:13,color:"#6255c7",fontWeight:700}}>MEDICAL OS</div><h1 style={{fontSize:32}}>Espacio clínico</h1>
  <div style={card}><p>No hay una sesión activa.</p><a href="/login" style={{...btn,display:"inline-block",textDecoration:"none"}}>Iniciar sesión</a></div>
 </main>;

 return <main style={wrap}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
   <div><div style={{fontSize:13,color:"#6255c7",fontWeight:700}}>MEDICAL OS</div><h1 style={{fontSize:32,margin:"4px 0"}}>Espacio clínico</h1></div>
   <button style={ghost} onClick={()=>{clearStoredSession();location.href="/login";}}>Cerrar sesión</button>
  </div>
  <p style={{color:"#6d6e80"}}>Sesión <span style={mono}>{session.sessionId.slice(0,8)}</span> · válida hasta {new Date(session.expiresAt*1000).toLocaleTimeString()} · paciente <span style={mono}>{patientId.slice(0,8)}</span> <button style={{...ghost,padding:"2px 10px",fontSize:12,marginLeft:8}} onClick={reset}>Nuevo paciente</button></p>

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

  {error&&<div style={{...card,borderColor:"#f0c6c0",background:"#fdf3f2"}}><b style={{color:"#c0392b"}}>Error</b><p style={{margin:"6px 0 0",color:"#7a3b34",wordBreak:"break-word"}}>{error}</p></div>}
 </main>;
}
