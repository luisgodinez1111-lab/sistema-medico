"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "consulta" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import {useEffect,useRef,useState} from "react";
import{card,P,LINE,UI,act,scrollTop,Skeleton,srOnly}from"../shared";
import{useWorkspace}from"../context";
// Unificación Consulta⟷Expediente: esta vista es SOLO el despachador del día (agenda + iniciar consulta). Abrir una
// consulta llama a openConsulta, que abre el EXPEDIENTE del paciente en la pestaña "Consulta" (ver model.tsx).
export default function ConsultaView(){
 const{consultaPid,agenda,patientList,setApptNew,setAgendaDate,setView,openConsulta,patientQuery,setPatientQuery,loadPatients,regName,setRegName,regDob,setRegDob,regSex,setRegSex,regExtra,setRegExtra,registerPatient,guardianFields,dupPanel,patMsg,regIsMinor,busy}=useWorkspace();
 const[newInline,setNewInline]=useState(false); // Lote C: alta de paciente inline dentro de Nueva consulta
 // Lote C: buscador incremental de paciente en Nueva consulta (server ?q=), con debounce; sustituye el <select> masivo.
 // BUGFIX (parpadeo): `loadPatients` NO está memoizada, así que cambia de identidad en cada render. Tenerla en las
 // dependencias del efecto lo re-disparaba en bucle → `busy="pt-list"` encendía/apagaba sin parar y la lista de resultados
 // parpadeaba entre «Buscando…» y las coincidencias, dificultando el clic. Se guarda en un ref para llamar SIEMPRE a la
 // última versión sin depender de su identidad; el efecto solo reacciona a `patientQuery` y `consultaPid`.
 const searchDeb=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const loadPatientsRef=useRef(loadPatients);loadPatientsRef.current=loadPatients;
 useEffect(()=>{
  if(consultaPid)return; // solo en el landing (sin paciente en foco)
  const q=patientQuery;
  if(searchDeb.current)clearTimeout(searchDeb.current);
  searchDeb.current=setTimeout(()=>{void loadPatientsRef.current(q);},300);
  return()=>{if(searchDeb.current)clearTimeout(searchDeb.current);};
 },[patientQuery,consultaPid]);

   // ===== PANEL DE CONSULTAS (landing) — sin paciente en foco: citas de hoy + iniciar nueva consulta =====
   if(!consultaPid){
    const card2:React.CSSProperties={...card,marginTop:0};
    const ini=(n:string)=>n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()||"P";
    const tHM=(iso:string)=>{const d=new Date(iso);if(isNaN(d.getTime()))return"—";const h=d.getUTCHours();const mn=d.getUTCMinutes().toString().padStart(2,"0");const ap=h<12?"a.m.":"p.m.";const h12=h%12||12;return `${h12}:${mn} ${ap}`;};
    const ST:Record<string,[string,string,string]>={SCHEDULED:["Programada","#EAF1FD",P.blueOnPale],CHECKED_IN:["En espera","#FBF0DC",P.amberOnPale],COMPLETED:["Atendida","#E6F6EE",P.greenOnPale],CANCELLED:["Cancelada","#F0F1F4",P.muted],NO_SHOW:["Inasistencia","#FDE7EA",P.redOnPale]};
    const appts=(agenda?.appointments??[]).slice().sort((a,b)=>a.startAt.localeCompare(b.startAt));
    const pend=appts.filter(a=>a.status==="SCHEDULED"||a.status==="CHECKED_IN");
    const cnt=agenda?.counts??{programadas:appts.length,atendidas:0,enEspera:0,canceladas:0};
    const kc=(bg:string,fg:string,d:string,n:number|string,l:string)=><div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span><div><div style={{fontSize:24,fontWeight:800}}>{n}</div><div style={{fontSize:11.5,color:P.muted}}>{l}</div></div></div>;
    const matches=(patientList??[]).slice(0,8);const q=patientQuery.trim();
    return <div style={{padding:"22px clamp(20px,2.4vw,56px) 40px",maxWidth:1500,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M6 4v5a5 5 0 0010 0V4M11 14v2a4 4 0 008 0M19 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Consultas</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Panel del día. Inicia una nueva consulta o abre la de una cita agendada.</p></div></div>
      <button style={{display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setApptNew(true);setAgendaDate(new Date().toISOString().slice(0,10));setView("agenda");scrollTop();}}>+ Agendar consulta</button>
     </div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginTop:18}} className="mos-kpis">
      {kc("#EEEBFD",P.purple,"M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",cnt.programadas,"Citas de hoy")}
      {kc("#FBF0DC",P.amber,"M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0",cnt.enEspera,"En espera")}
      {kc("#E6F6EE",P.green,"M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z",cnt.atendidas,"Atendidas hoy")}
     </div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-mid">
      <div style={{...card2,padding:18}}>
       <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>Iniciar nueva consulta</div>
       <div style={{fontSize:12.5,color:P.muted,marginBottom:14}}>Busca al paciente por nombre, CURP o teléfono, o registra uno nuevo.</div>
       <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:P.muted}} aria-hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></span>
        <input value={patientQuery} onChange={e=>setPatientQuery(e.target.value)} placeholder="Buscar por nombre, CURP o teléfono…" aria-label="Buscar paciente" style={{width:"100%",boxSizing:"border-box",border:`1px solid ${LINE}`,borderRadius:9,padding:"10px 11px 10px 34px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink}}/>
       </div>
       <div style={{marginTop:10,minHeight:52}}>
        {!q
         ?<div style={{fontSize:12,color:P.muted,padding:"8px 2px"}}>Escribe para buscar un paciente. También puedes abrir una <b>cita de hoy →</b></div>
         :matches.length===0
          /* Sin resultados aún: «Buscando…» solo mientras carga; si ya hay coincidencias se conservan durante la
             re-búsqueda para no parpadear (no se reemplaza la lista por «Buscando…» en cada tecla). */
          ?(busy==="pt-list"
            ?<div style={{fontSize:12,color:P.muted,padding:"8px 2px"}}>Buscando…</div>
            :<div style={{fontSize:12,color:P.muted,padding:"8px 2px"}}>Sin coincidencias para «{q}». Registra un paciente nuevo abajo.</div>)
          :<div style={{display:"flex",flexDirection:"column",gap:4}}>{matches.map(p=><button key={p.patientId} onClick={()=>openConsulta(p.patientId,p.name)} style={{display:"flex",alignItems:"center",gap:10,textAlign:"left",width:"100%",border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px 11px",cursor:"pointer",fontFamily:UI}}><span style={{width:30,height:30,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,flex:"0 0 auto"}}>{ini(p.name)}</span><span style={{flex:1,minWidth:0}}><span style={{display:"block",fontSize:13,fontWeight:600}}>{p.name}</span>{p.curp&&<span style={{display:"block",fontSize:11,color:P.muted}}>{p.curp}</span>}</span><span style={{fontSize:12,fontWeight:700,color:P.purple,flex:"0 0 auto"}}>Abrir →</span></button>)}</div>}
       </div>
       {!newInline
        ?<button onClick={()=>setNewInline(true)} style={{marginTop:12,width:"100%",justifyContent:"center",display:"flex",alignItems:"center",gap:8,border:`1px dashed ${P.purple}`,background:"#F7F6FE",color:P.purple,borderRadius:10,padding:"11px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>+ Registrar paciente nuevo</button>
        :(()=>{const inSty:React.CSSProperties={width:"100%",boxSizing:"border-box",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};const canReg=busy===""&&!!regName.trim()&&!!regDob;return <div style={{marginTop:12,border:`1px solid ${LINE}`,borderRadius:11,padding:14,background:"#FBFBFE"}}>
          <div style={{fontSize:13.5,fontWeight:800,marginBottom:10}}>Registrar paciente nuevo</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
           <input style={inSty} value={regName} onChange={e=>setRegName(e.target.value)} placeholder="Nombre completo" aria-label="Nombre del paciente nuevo"/>
           <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <input style={inSty} type="date" value={regDob} onChange={e=>setRegDob(e.target.value)} aria-label="Fecha de nacimiento"/>
            <select style={inSty} value={regSex} onChange={e=>setRegSex(e.target.value)} aria-label="Sexo al nacer"><option value="UNKNOWN">Sexo (sin especificar)</option><option value="FEMALE">Femenino</option><option value="MALE">Masculino</option></select>
           </div>
           <input style={inSty} value={regExtra.curp} onChange={e=>setRegExtra({...regExtra,curp:e.target.value.toUpperCase()})} placeholder="CURP (opcional)" aria-label="CURP"/>
           {guardianFields(inSty)}
          </div>
          {dupPanel(true)}
          {patMsg&&<div style={{marginTop:10,padding:"8px 11px",borderRadius:8,background:patMsg.includes("registrad")?"#E6F6EE":"#FDF4E6",fontSize:12,color:patMsg.includes("registrad")?"#166534":"#7A5A16"}}>{patMsg}</div>}
          <div style={{display:"flex",gap:8,marginTop:12}}>
           <button onClick={()=>void registerPatient(true,false,true)} disabled={!canReg} style={{flex:1,justifyContent:"center",display:"flex",border:0,background:canReg?P.purple:"#C7CCE0",color:"#fff",borderRadius:9,padding:"10px",fontWeight:700,fontSize:13,cursor:canReg?"pointer":"default",fontFamily:UI}}>{busy==="pt-reg"?"Registrando…":"Registrar y abrir consulta"}</button>
           <button onClick={()=>setNewInline(false)} style={{border:`1px solid ${LINE}`,background:P.white,color:P.muted,borderRadius:9,padding:"10px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>Cancelar</button>
          </div>
          {regIsMinor&&<div style={{fontSize:11,color:P.muted,marginTop:8}}>Menor de edad: registra al tutor o representante legal.</div>}
         </div>;})()}
      </div>
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px 10px"}}><div style={{fontSize:16,fontWeight:800}}>Citas de hoy ({pend.length} por atender)</div><span style={{color:P.blue,fontSize:13,fontWeight:600,cursor:"pointer"}} {...act(()=>setView("agenda"))}>Ver agenda →</span></div>
       {agenda===null?<div role="status" aria-busy="true">{[0,1,2,3].map(i=><div key={i} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 18px",borderTop:`1px solid #F1F3F9`}}><Skeleton w={54} h={12}/><Skeleton w={34} h={34} r={99}/><div style={{flex:1}}><Skeleton w="40%" h={13}/><Skeleton w="65%" h={11} style={{marginTop:5}}/></div><Skeleton w={62} h={26} r={8}/></div>)}<span style={srOnly}>Cargando citas de hoy…</span></div>:appts.length===0?<div style={{padding:"28px 18px",textAlign:"center",color:P.muted,fontSize:13}}>No hay citas para hoy. Usa «+ Agendar consulta».</div>:appts.slice(0,8).map(a=>{const st=ST[a.status]??["",P.canvas,P.muted];const canOpen=a.status==="SCHEDULED"||a.status==="CHECKED_IN";return <div key={a.appointmentId} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 18px",borderTop:`1px solid #F1F3F9`}}><span style={{fontSize:12.5,color:P.muted,width:64,flex:"0 0 auto"}}>{tHM(a.startAt)}</span><span style={{width:34,height:34,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,flex:"0 0 auto"}}>{ini(a.patientName)}</span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13}}>{a.patientName}</div><div style={{fontSize:11.5,color:P.muted}}>{a.reason}</div></div><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:st[1],color:st[2]}}>{st[0]}</span><button disabled={!canOpen} onClick={()=>openConsulta(a.patientId,a.patientName)} style={{border:0,background:canOpen?P.purple:"#EEF0F5",color:canOpen?"#fff":P.muted,borderRadius:8,padding:"7px 12px",fontWeight:700,fontSize:12,cursor:canOpen?"pointer":"default",fontFamily:UI}}>Abrir</button></div>;})}
      </div>
     </div>
    </div>;
   }
   // Unificación Consulta⟷Expediente: abrir una consulta ahora abre el EXPEDIENTE (openConsulta→exp, pestaña «Consulta»).
   // Esta vista es SOLO el despachador del día (landing sin paciente): ya no hay pantalla-paciente gemela aquí.
   return null;
}