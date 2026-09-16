"use client";
import{useEffect,useState}from"react";
import{getStoredSession,apiRequest,clearStoredSession,type MedicalSession}from"../../lib/session-client";
// EPIC K — Espacio de trabajo clínico. Consume los endpoints ya probados con la sesión autenticada.
// Vertical estrella: encuentro (abrir -> valorar -> firmar), con concurrencia optimista (If-Match).

type EncounterState="OPEN"|"READY_TO_SIGN"|"SIGNED";
type Encounter=Readonly<{id:string;patientId:string;state:EncounterState;version:number;signatureDigest?:string}>;
const wrap:React.CSSProperties={maxWidth:900,margin:"0 auto",padding:32};
const card:React.CSSProperties={background:"white",border:"1px solid #e7e6f2",borderRadius:18,padding:24,boxShadow:"0 6px 20px #19145b0a",marginTop:20};
const btn:React.CSSProperties={background:"#6255c7",color:"white",border:0,borderRadius:10,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontSize:14};
const ghost:React.CSSProperties={...btn,background:"transparent",color:"#6255c7",border:"1px solid #d9d6f2"};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"10px 12px",border:"1px solid #d9d6f2",borderRadius:10,fontSize:14,fontFamily:"inherit"};
const mono:React.CSSProperties={fontFamily:"ui-monospace,Menlo,monospace",fontSize:12,background:"#f4f3fb",padding:"2px 6px",borderRadius:6};
const label:React.CSSProperties={fontSize:13,fontWeight:600,color:"#4b4c5e",display:"block",margin:"12px 0 6px"};
function badge(s:EncounterState){const c=s==="SIGNED"?["#e8f7ee","#1a7f43"]:s==="READY_TO_SIGN"?["#fff4e5","#a15c00"]:["#eef0ff","#3f3aa0"];return{display:"inline-block",background:c[0],color:c[1],fontWeight:700,fontSize:12,padding:"3px 10px",borderRadius:999};}
const uuid=()=>globalThis.crypto.randomUUID();
const nowIso=()=>new Date().toISOString();
function errMsg(r:{status:number;body:Record<string,unknown>}):string{const e=r.body["error"] as{code?:string;message?:string}|undefined;return `${r.status} ${e?.code??""} ${e?.message??""}`.trim();}

export default function Workspace(){
 const[session,setSession]=useState<MedicalSession|null>(null);
 const[ready,setReady]=useState(false);
 const[patientId,setPatientId]=useState("");
 const[enc,setEnc]=useState<Encounter|null>(null);
 const[assessment,setAssessment]=useState("");
 const[plan,setPlan]=useState("");
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState("");

 useEffect(()=>{setSession(getStoredSession());setPatientId(uuid());setReady(true);},[]);

 async function openEncounter(){
  setBusy(true);setError("");
  try{
   const id=uuid();
   const r=await apiRequest("/api/v1/encounters",{method:"POST",body:{encounterId:id,patientId,occurredAt:nowIso()}});
   if(r.status!==201&&r.status!==200){setError(errMsg(r));return;}
   setEnc({id,patientId,state:"OPEN",version:Number(r.body["version"]??1)});
  }finally{setBusy(false);}
 }
 async function saveAssessment(){
  if(!enc)return;setBusy(true);setError("");
  try{
   const r=await apiRequest(`/api/v1/encounters/${enc.id}/assessment`,{method:"POST",body:{assessment,plan,occurredAt:nowIso()},ifMatch:enc.version});
   if(r.status!==201&&r.status!==200){setError(errMsg(r));return;}
   setEnc({...enc,state:"READY_TO_SIGN",version:Number(r.body["version"]??enc.version+1)});
  }finally{setBusy(false);}
 }
 async function signEncounter(){
  if(!enc)return;setBusy(true);setError("");
  try{
   const r=await apiRequest(`/api/v1/encounters/${enc.id}/signature`,{method:"POST",body:{occurredAt:nowIso()},ifMatch:enc.version});
   if(r.status!==201&&r.status!==200){setError(errMsg(r));return;}
   setEnc({...enc,state:"SIGNED",version:Number(r.body["version"]??enc.version+1),signatureDigest:String(r.body["signatureDigest"]??"")});
  }finally{setBusy(false);}
 }
 function reset(){setEnc(null);setAssessment("");setPlan("");setError("");setPatientId(uuid());}

 if(!ready)return <main style={wrap}><p>Cargando…</p></main>;
 if(!session)return <main style={wrap}>
  <div style={{fontSize:13,color:"#6255c7",fontWeight:700}}>MEDICAL OS</div>
  <h1 style={{fontSize:32}}>Espacio clínico</h1>
  <div style={card}><p>No hay una sesión activa.</p><a href="/login" style={{...btn,display:"inline-block",textDecoration:"none"}}>Iniciar sesión</a></div>
 </main>;

 return <main style={wrap}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
   <div><div style={{fontSize:13,color:"#6255c7",fontWeight:700}}>MEDICAL OS</div><h1 style={{fontSize:32,margin:"4px 0"}}>Espacio clínico</h1></div>
   <button style={ghost} onClick={()=>{clearStoredSession();location.href="/login";}}>Cerrar sesión</button>
  </div>
  <p style={{color:"#6d6e80"}}>Identidad <span style={mono}>{session.sessionId.slice(0,8)}</span> · sesión válida hasta {new Date(session.expiresAt*1000).toLocaleTimeString()}</p>

  {!enc&&<section style={card}>
   <h2 style={{fontSize:18,marginTop:0}}>Nuevo encuentro</h2>
   <label style={label}>ID de paciente</label>
   <input style={input} value={patientId} onChange={e=>setPatientId(e.target.value)} />
   <p style={{fontSize:12,color:"#8a8b9a",margin:"6px 0 0"}}>Se prellenó un identificador de paciente de prueba; puedes cambiarlo.</p>
   <div style={{marginTop:16}}><button style={btn} disabled={busy||!patientId} onClick={openEncounter}>{busy?"Abriendo…":"Abrir encuentro"}</button></div>
  </section>}

  {enc&&<section style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <h2 style={{fontSize:18,margin:0}}>Encuentro</h2>
    <span style={badge(enc.state)}>{enc.state}</span>
   </div>
   <p style={{color:"#6d6e80",fontSize:13}}>Encuentro <span style={mono}>{enc.id.slice(0,8)}</span> · paciente <span style={mono}>{enc.patientId.slice(0,8)}</span> · versión {enc.version}</p>

   <label style={label}>Valoración (assessment)</label>
   <textarea style={{...input,minHeight:70,resize:"vertical"}} value={assessment} disabled={enc.state!=="OPEN"} onChange={e=>setAssessment(e.target.value)} placeholder="Impresión diagnóstica…" />
   <label style={label}>Plan</label>
   <textarea style={{...input,minHeight:70,resize:"vertical"}} value={plan} disabled={enc.state!=="OPEN"} onChange={e=>setPlan(e.target.value)} placeholder="Plan de manejo…" />

   <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
    {enc.state==="OPEN"&&<button style={btn} disabled={busy||!assessment||!plan} onClick={saveAssessment}>{busy?"Guardando…":"Guardar valoración"}</button>}
    {enc.state==="READY_TO_SIGN"&&<button style={btn} disabled={busy} onClick={signEncounter}>{busy?"Firmando…":"Firmar encuentro"}</button>}
    <button style={ghost} onClick={reset}>Nuevo</button>
   </div>

   {enc.state==="SIGNED"&&<div style={{marginTop:16,padding:14,background:"#f6fbf7",borderRadius:12,border:"1px solid #d6ecdd"}}>
    <b style={{color:"#1a7f43"}}>✓ Encuentro firmado (registro inmutable)</b>
    <p style={{margin:"6px 0 0",fontSize:12,color:"#4b4c5e"}}>Firma: <span style={mono}>{enc.signatureDigest?.slice(0,32)}…</span></p>
   </div>}
  </section>}

  {error&&<div style={{...card,borderColor:"#f0c6c0",background:"#fdf3f2"}}><b style={{color:"#c0392b"}}>Error</b><p style={{margin:"6px 0 0",color:"#7a3b34",wordBreak:"break-word"}}>{error}</p></div>}
 </main>;
}
