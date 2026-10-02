"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "consulta" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import {useEffect,useRef,useState} from "react";
import {searchIcd10} from "../../../../../packages/terminology/src";
import{Check,card,P,LINE,UI,act,scrollTop,goExpSection,mono,DX_LABEL,NavIcon,Skeleton,srOnly,relTime}from"../shared";
import{useWorkspace}from"../context";
export default function ConsultaView(){
 const{consultaPid,agenda,patientList,consultaNewPid,setApptNew,setAgendaDate,setView,setConsultaNewPid,openConsulta,patientName,snap,antSnap,setConsultaPid,setExpTab,enc,gaps,patientId,busy,setCPreview,cPreview,consultaAdvance,cMsg,setCMsg,composeNote,cForm,docDisplay,chartState,setChartReload,setCTab,cTab,consTabs,setCForm,clock,cVit,setCVit,saveConsultaVitals,cVitBusy,cVitMsg,cDxQuery,setCDxQuery,setCDxMsg,addConsultaProblem,cDxBusy,cDxMsg,cOrdCat,setCOrdSel,setCOrdCat,setCOrdMsg,cOrdSel,createConsultaOrders,cOrdBusy,cOrdMsg,patientQuery,setPatientQuery,loadPatients,regName,setRegName,regDob,setRegDob,regSex,setRegSex,regExtra,setRegExtra,registerPatient,guardianFields,dupPanel,patMsg,regIsMinor}=useWorkspace();
 const[newInline,setNewInline]=useState(false); // Lote C: alta de paciente inline dentro de Nueva consulta
 const[dxType,setDxType]=useState<"PROBABLE"|"CONFIRMED"|"POSSIBLE">("PROBABLE"); // Lote D: tipo de la impresión diagnóstica
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
   // ===== VISTA CONSULTA (workspace clínico) — S4.png, pestaña "Consulta actual" =====
   // Verdad clínica (auditoría 2026-09-19, U-01): SIN valores de maqueta. Lo que no se ha cargado se muestra
   // como desconocido ("—"), nunca como una paciente inventada con alergias y problemas ficticios.
   const pName=patientName||"";
   const age:number|null=snap?.demographics.age??null;
   const sexo=snap?.demographics.sex;
   const sexoEs=sexo==="FEMALE"?"Femenino":sexo==="MALE"?"Masculino":"—";
   const alN:number|null=snap?snap.allergies.length:null,prN:number|null=snap?snap.problems.length:null;
   const findings=snap?.findings??[];
   const V=snap?.vitals??{};
   const initials=pName.trim()?pName.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase():"—";
   const card2:React.CSSProperties={...card,marginTop:0};
   const sec:React.CSSProperties={...card2,padding:18};
   const sect:React.CSSProperties={fontSize:15,fontWeight:700,margin:"0 0 12px"};
   const ta:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:11,padding:"12px 14px",fontSize:13.5,fontFamily:UI,resize:"vertical",minHeight:64,color:P.ink,boxSizing:"border-box"};
   const cc:React.CSSProperties={fontSize:11,color:P.muted,textAlign:"right",marginTop:5};
   const antp=(bg:string,fg:string,label:string,d:string)=>(<div style={{display:"flex",alignItems:"center",gap:7,borderRadius:10,padding:"8px 12px",fontSize:12.5,fontWeight:600,whiteSpace:"nowrap",background:bg,color:fg,cursor:"pointer"}} {...act(()=>{goExpSection(label==="Alergias"?"Alergias":label==="Problemas"?"Lista de problemas":label==="Medicamentos"?"Medicación":"Vacunas",setView,setExpTab);})}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={d}/></svg>{label}</div>);
   const link:React.CSSProperties={color:P.blue,fontSize:13,fontWeight:600,cursor:"pointer"};
   // Botón real que abre la sección correspondiente del expediente (antes era un chip decorativo "+ Agregar" sin acción).
   const sgo=(label:string,section:string)=><button onClick={()=>{goExpSection(section,setView,setExpTab);}} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:600,color:P.purple,cursor:"pointer",whiteSpace:"nowrap",fontFamily:UI}}>{label}</button>;
   const CTABS:[typeof cTab,string][]=[["actual","Consulta actual"],["antecedentes","Antecedentes"],["resultados","Resultados"],["ordenes","Órdenes"],["medicamentos","Medicamentos"],["plan","Plan de cuidados"],["documentos","Documentos"],["seguimiento","Seguimiento"]];
   const rsum=(bg:string,fg:string,d:string,title:string,sub:string,right:React.ReactNode)=>(<div style={{display:"flex",gap:11,padding:"12px 0",borderTop:`1px solid #F1F3F9`,alignItems:"flex-start"}}><span style={{width:34,height:34,borderRadius:9,background:bg,color:fg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={d}/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13.5}}>{title}</div><div style={{fontSize:12.5,color:P.muted}}>{sub}</div></div>{right}</div>);
   return <div style={{padding:"20px clamp(20px,2.4vw,64px) 40px",maxWidth:2100,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
     <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{width:34,height:34,borderRadius:9,border:`1px solid ${LINE}`,background:P.white,display:"grid",placeItems:"center",cursor:"pointer",color:P.muted}} title="Volver al panel de consultas" {...act(()=>setConsultaPid(null))}>←</span><div><div style={{display:"flex",alignItems:"center",gap:10}}><h1 style={{fontSize:27,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Consulta</h1>{enc&&(()=>{const m=enc.state==="SIGNED"?["#E6F6EE",P.greenOnPale,"Firmada"]:enc.state==="READY_TO_SIGN"?["#FBF0DC",P.amberOnPale,"Lista para firmar"]:["#EAF1FD",P.blueOnPale,"Abierta"];return <span style={{fontSize:11,fontWeight:700,borderRadius:999,padding:"3px 10px",background:m[0],color:m[1]}}>Encuentro · {m[2]}</span>;})()}</div><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Registro y gestión de la consulta médica</p></div></div>
     {(()=>{
      // U-17 (CRITICAL_OPEN+SIGN_READY): con pendientes críticos abiertos la firma se presenta BLOQUEADA, no "lista"; el servidor
      // la rechazaría igual (Zero Lost Follow-Up), pero la interfaz no debe ofrecer como disponible lo que no lo está.
      const criticalOpen=(gaps??[]).filter(g=>g.priority==="HIGH"&&(g.code==="CRITICAL_RESULT_OPEN"||g.code==="VITAL_CRITICAL"||g.code==="FOLLOWUP_OPEN")).length;
      const st=enc?.state;const label=!patientId?"Selecciona un paciente":!enc?"Abrir encuentro":st==="OPEN"?"Guardar valoración":st==="READY_TO_SIGN"?(criticalOpen?`Firma bloqueada: ${criticalOpen} pendiente(s) crítico(s)`:"Firmar consulta"):"✓ Consulta firmada";
      const disabled=busy!==""||!patientId||st==="SIGNED"||(st==="READY_TO_SIGN"&&criticalOpen>0);
      const primaryBg=st==="READY_TO_SIGN"?"linear-gradient(90deg,#16A66A,#12905c)":`linear-gradient(90deg,${P.purpleOnPale},#5B6BF0)`;
      return <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
       <button onClick={()=>setCPreview(v=>!v)} style={{display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:cPreview?"#EEEBFD":P.white,color:cPreview?P.purple:P.ink,borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Vista previa</button>
       <button onClick={consultaAdvance} disabled={disabled} style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:disabled?"#C7CCE0":primaryBg,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:disabled?"default":"pointer",fontFamily:UI,boxShadow:disabled?"none":`0 6px 16px ${P.purpleOnPale}40`}}>{busy==="cadv"?"Procesando…":label}</button>
      </div>;
     })()}
    </div>
    {cMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:enc?.state==="SIGNED"?"#F0FBF4":"#EEF6FF",border:`1px solid ${enc?.state==="SIGNED"?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:enc?.state==="SIGNED"?P.green:P.blue,fontWeight:700}}>{enc?.state==="SIGNED"?"✓":"ℹ"}</span><span style={{flex:1}}>{cMsg}{enc?.signatureDigest?<> Firma: <span style={mono}>{enc.signatureDigest.slice(0,24)}…</span></>:null}</span><button onClick={()=>setCMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {cPreview&&<div style={{...card,marginTop:14,padding:18}}><div style={{fontWeight:800,fontSize:15,marginBottom:10}}>Vista previa de la nota clínica</div><pre style={{whiteSpace:"pre-wrap",fontFamily:UI,fontSize:13,color:P.ink,margin:0,lineHeight:1.6}}>{composeNote()}{"\n\nPLAN DE MANEJO: "+(cForm.plan.trim()||"—")}</pre><div style={{fontSize:11.5,color:P.muted,marginTop:10}}>Así se guardará la valoración del encuentro al firmar. Médico: {docDisplay}.</div></div>}
    <div style={{...card2,display:"flex",alignItems:"center",gap:18,padding:"16px 20px",marginTop:16,flexWrap:"wrap"}}>
     <span style={{width:66,height:66,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontWeight:800,fontSize:22,flex:"0 0 auto"}}>{initials}</span>
     <div style={{flex:1,minWidth:180}}><div><span style={{fontSize:21,fontWeight:800}}>{pName||"Sin paciente seleccionado"}</span>{snap?<span style={{background:"#E6F6EE",color:"#0F7A4D",borderRadius:999,padding:"3px 11px",fontSize:12,fontWeight:600,marginLeft:10}}>Paciente activo</span>:chartState==="error"?<span role="alert" style={{background:"#FDEEEE",color:P.redOnPale,borderRadius:999,padding:"3px 11px",fontSize:12,fontWeight:700,marginLeft:10}}>Expediente no disponible · <button onClick={()=>setChartReload(n=>n+1)} style={{border:0,background:"transparent",color:P.redOnPale,textDecoration:"underline",cursor:"pointer",font:"inherit",padding:0}}>Reintentar</button></span>:<span style={{background:"#EEF0F6",color:"#4A5568",borderRadius:999,padding:"3px 11px",fontSize:12,fontWeight:600,marginLeft:10}}>{chartState==="loading"?"Cargando expediente…":"Paciente sin registrar"}</span>}</div><div style={{fontSize:13,color:P.muted,marginTop:3}}>{age===null?"Edad —":`${age} años`} · {sexoEs}{snap?.demographics.birthDate?` · ${new Date(snap.demographics.birthDate).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"})}`:""}</div><div style={{fontSize:13,color:P.muted}}>{snap?.demographics.curp?<>CURP: <span style={mono}>{snap.demographics.curp}</span></>:<>ID <span style={mono}>{patientId.slice(0,8)}</span></>}</div></div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,flex:"0 0 auto"}}>
      {antp("#FDECEE",P.redOnPale,`Alergias (${alN??"—"})`,"M12 4l9 15.5H3zM12 10v4M12 17h.01")}
      {antp("#EEEBFD",P.purpleOnPale,`Problemas (${prN??"—"})`,"M9 4h6v2H9zM7 5H6v16h12V5h-1")}
      {antp("#E7F0FD",P.blueOnPale,"Medicamentos","M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z")}
      {antp("#E6F6EE",P.greenOnPale,"Vacunas","M14 4l6 6M6 14l4 4M16.5 6.5l-10 10")}
     </div>
     <div style={{borderLeft:`1px solid ${LINE}`,paddingLeft:18,fontSize:12.5,color:P.muted}}>Última consulta<div style={{color:P.ink,marginTop:5}}>{docDisplay}</div><span style={link} {...act(()=>{goExpSection("Timeline del paciente",setView,setExpTab);})}>Ver historial →</span></div>
    </div>
    <div style={{display:"flex",gap:4,marginTop:16,borderBottom:`1px solid ${LINE}`,overflowX:"auto"}}>
     {CTABS.map(([k,l])=><button key={k} onClick={()=>setCTab(k)} style={{padding:"12px 16px",fontSize:13.5,fontWeight:cTab===k?700:500,color:cTab===k?P.purple:P.muted,cursor:"pointer",borderBottom:cTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:"0",borderBottomWidth:2,fontFamily:UI,whiteSpace:"nowrap"}}>{l}</button>)}
    </div>
    {cTab!=="actual"?(
     (()=>{
      const cc:React.CSSProperties={...card2,marginTop:16,padding:0,overflow:"hidden"};
      const tth:React.CSSProperties={textAlign:"left",fontSize:11.5,color:P.muted,fontWeight:600,padding:"11px 14px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
      const ttd:React.CSSProperties={padding:"10px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,whiteSpace:"nowrap"};
      const pilr=(bg:string,fg:string,t:string)=><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:bg,color:fg}}>{t}</span>;
      const fmtC=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
      const head=(title:string,n:number,section:string,cta:string)=><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px"}}><div style={{fontSize:16,fontWeight:800}}>{title} ({n})</div><button style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:9,padding:"7px 12px",fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{goExpSection(section,setView,setExpTab);}}>{cta} →</button></div>;
      const empty=(t:string)=><div style={{padding:"40px",textAlign:"center",color:P.muted,fontSize:13}}>{patientId?t:"Selecciona un paciente para ver esta información."}</div>;
      // Skeleton mientras carga el snapshot del expediente (chartState==="loading"): reserva el layout de la pestaña.
      if(chartState==="loading")return <div style={cc} role="status" aria-busy="true"><div style={{padding:"14px 16px"}}><Skeleton w={190} h={16}/></div>{Array.from({length:5}).map((_,i)=><div key={i} style={{display:"flex",gap:12,alignItems:"center",padding:"11px 16px",borderTop:`1px solid #F2F4F9`}}><Skeleton w={34} h={34} r={9}/><div style={{flex:1}}><Skeleton w="45%" h={13}/><Skeleton w="70%" h={11} style={{marginTop:5}}/></div><Skeleton w={70} h={18} r={99}/></div>)}<span style={srOnly}>Cargando expediente…</span></div>;
      if(cTab==="resultados"){const rows=consTabs?.results??[];const est=(e:string):[string,string]=>e==="Hallazgos"?["#FDE7EA",P.redOnPale]:e==="En seguimiento"?["#EAF1FD",P.blueOnPale]:e==="En revisión"?["#FBF0DC",P.amberOnPale]:["#E6F6EE",P.greenOnPale];
       return <div style={cc}>{head("Resultados del paciente",rows.length,"Resultados diagnósticos","Abrir en el expediente")}{rows.length?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={tth}>Analito</th><th style={tth}>Valor</th><th style={tth}>Fecha</th><th style={{...tth,textAlign:"right"}}>Estado</th></tr></thead><tbody>{rows.map((r,i)=>{const[bg,fg]=est(r.estado);return <tr key={i}><td style={{...ttd,fontWeight:600}}>{r.analyte}</td><td style={{...ttd,color:r.critical?"#D23651":P.ink,fontWeight:r.critical?700:400}}>{r.value}</td><td style={{...ttd,color:P.muted}}>{fmtC(r.receivedAt)}</td><td style={{...ttd,textAlign:"right"}}>{pilr(bg,fg,r.estado)}</td></tr>;})}</tbody></table></div>:empty("Sin resultados diagnósticos para este paciente.")}</div>;
      }
      if(cTab==="ordenes"){const rows=consTabs?.orders??[];const est=(s:string):[string,string]=>s==="Completada"?["#E6F6EE",P.greenOnPale]:s==="Enviada"?["#EAF1FD",P.blueOnPale]:s==="Cancelada"?["#EEF1F7",P.muted]:["#FBF0DC",P.amberOnPale];
       return <div style={cc}>{head("Órdenes del paciente",rows.length,"Órdenes clínicas","Abrir en el expediente")}{rows.length?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={tth}>Estudio</th><th style={tth}>Tipo</th><th style={tth}>Fecha</th><th style={{...tth,textAlign:"right"}}>Estado</th></tr></thead><tbody>{rows.map((r,i)=>{const[bg,fg]=est(r.status);return <tr key={i}><td style={{...ttd,fontWeight:600}}>{r.detail}</td><td style={{...ttd,color:P.muted}}>{r.typeLabel}</td><td style={{...ttd,color:P.muted}}>{fmtC(r.createdAt)}</td><td style={{...ttd,textAlign:"right"}}>{pilr(bg,fg,r.status)}</td></tr>;})}</tbody></table></div>:empty("Sin órdenes de estudio para este paciente.")}</div>;
      }
      if(cTab==="medicamentos"){const rows=consTabs?.medications??[];
       return <div style={cc}>{head("Medicamentos activos",rows.length,"Medicación","Abrir en el expediente")}{rows.length?<div style={{padding:"4px 16px 16px"}}>{rows.map((m,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 0",borderBottom:i<rows.length-1?`1px solid #F2F4F9`:"0"}}><span style={{width:34,height:34,borderRadius:9,background:"#E6F6EE",color:P.green,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z"/></svg></span><span style={{flex:1,fontSize:13.5,fontWeight:600,textTransform:"capitalize"}}>{m}</span>{pilr("#E6F6EE",P.greenOnPale,"Activo")}</div>)}</div>:empty(consTabs?"Sin medicamentos activos para este paciente.":"No evaluados: las pestañas de consulta no cargaron.")}</div>;
      }
      if(cTab==="plan"){const rows=consTabs?.planGoals??[];const done=(s:string)=>s==="Lograda";
       return <div style={cc}>{head("Metas del plan de cuidado",rows.length,"Plan de cuidados","Abrir en el expediente")}{rows.length?<div style={{padding:"4px 16px 16px"}}>{rows.map((g,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 0",borderBottom:i<rows.length-1?`1px solid #F2F4F9`:"0"}}><span style={{width:18,height:18,borderRadius:"50%",border:done(g.statusLabel)?"0":"1.8px solid #C7CCE0",background:done(g.statusLabel)?P.greenOnPale:"transparent",color:"#fff",display:"grid",placeItems:"center",fontSize:11,flex:"0 0 auto"}}>{done(g.statusLabel)?"✓":""}</span><span style={{flex:1,fontSize:13.5,color:done(g.statusLabel)?P.muted:P.ink,textDecoration:done(g.statusLabel)?"line-through":"none"}}>{g.goal}</span>{pilr("#EEEBFD",P.purple,g.statusLabel)}</div>)}</div>:empty("Sin metas de plan de cuidado para este paciente.")}</div>;
      }
      if(cTab==="documentos"){const rows=consTabs?.documents??[];
       return <div style={cc}>{head("Documentos del paciente",rows.length,"Documentos clínicos","Abrir en el expediente")}{rows.length?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={tth}>Nombre</th><th style={tth}>Tipo</th><th style={{...tth,textAlign:"right"}}>Fecha</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td style={ttd}><span style={{display:"flex",alignItems:"center",gap:9}}><span style={{color:P.red}}>▤</span>{r.title}</span></td><td style={{...ttd,color:P.muted}}>{r.typeLabel}</td><td style={{...ttd,textAlign:"right",color:P.muted}}>{fmtC(r.createdAt)}</td></tr>)}</tbody></table></div>:empty("Sin documentos para este paciente.")}</div>;
      }
      if(cTab==="seguimiento"){const rows=consTabs?.obligations??[];
       return <div style={cc}>{head("Tareas de seguimiento",rows.length,"Obligaciones de seguimiento","Abrir en el expediente")}{rows.length?<div style={{padding:"4px 16px 16px"}}>{rows.map((o,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 0",borderBottom:i<rows.length-1?`1px solid #F2F4F9`:"0"}}><span style={{width:17,height:17,borderRadius:5,border:o.done?"0":"1.7px solid #C7CCE0",background:o.done?P.purple:"transparent",color:"#fff",display:"grid",placeItems:"center",fontSize:10,flex:"0 0 auto"}}>{o.done?"✓":""}</span><span style={{flex:1,fontSize:13.5,color:o.done?P.muted:P.ink,textDecoration:o.done?"line-through":"none"}}>{o.task}</span><span style={{fontSize:11.5,color:P.muted}}>📅 {fmtC(o.dueAt)}</span></div>)}</div>:empty("Sin tareas de seguimiento para este paciente.")}</div>;
      }
      if(cTab==="antecedentes"){
       // Matriz fundacional READ-ONLY (se captura/edita en el expediente; aquí es contexto de la visita). Desde antSnap.
       const c=antSnap?.content;const hab=c?.noPatologicos;const rows:[string,string][]=[];
       if(antSnap?.recorded){
        const her=[(c?.heredofamiliares?.flags??[]).join(", "),c?.heredofamiliares?.notas].filter(Boolean).join(" · ");if(her)rows.push(["Heredofamiliares",her]);
        const pat=[(c?.patologicos?.cronicos??[]).join(", "),c?.patologicos?.cirugias?"cirugías":"",c?.patologicos?.hospitalizaciones?"hospitalizaciones":"",c?.patologicos?.transfusiones?"transfusiones":"",c?.patologicos?.notas].filter(Boolean).join(" · ");if(pat)rows.push(["Personales patológicos",pat]);
        rows.push(["No patológicos (hábitos)",[`Tabaquismo: ${hab?.tabaquismo?"Sí":"No"}`,`Alcoholismo: ${hab?.alcoholismo?"Sí":"No"}`,`Toxicomanías: ${hab?.toxicomanias?"Sí":"No"}`,hab?.actividadFisica?`Act. física: ${hab.actividadFisica}`:"",hab?.alimentacion?`Alimentación: ${hab.alimentacion}`:"",hab?.notas??""].filter(Boolean).join(" · ")]);
        if(c?.quirurgicos?.notas)rows.push(["Quirúrgicos",c.quirurgicos.notas]);
        if(c?.ginecoObstetricos?.notas)rows.push(["Gineco-obstétricos",c.ginecoObstetricos.notas]);
       }
       return <div style={cc}>{head("Antecedentes (historia basal)",rows.length,"Antecedentes",antSnap?.recorded?"Editar en el expediente":"Capturar en el expediente")}{antSnap?.recorded
        ?<div style={{padding:"4px 16px 16px",display:"flex",flexDirection:"column",gap:9}}>{rows.map(([k,v])=><div key={k} style={{display:"flex",gap:12,fontSize:13,padding:"9px 11px",borderRadius:10,background:"#f7f8fc"}}><span style={{fontWeight:800,color:P.purpleOnPale,minWidth:170,flex:"0 0 auto"}}>{k}</span><span style={{minWidth:0,color:"#33383F"}}>{v}</span></div>)}{antSnap.updatedAt&&<div style={{fontSize:11.5,color:P.muted,marginTop:2}}>Actualizado {relTime(antSnap.updatedAt)}</div>}</div>
        :empty("Sin antecedentes capturados. Captúralos una vez en el expediente del paciente.")}</div>;
      }
      return <div/>;
     })()
    ):(
    // Rediseño: documentación clínica en UNA columna ancha (orden clínico) + contexto (resumen/IA/recordatorios) lateral sticky.
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.75fr) minmax(300px,1fr)",gap:18,marginTop:16,alignItems:"start"}} className="mos-consulta">
     <div style={{display:"flex",flexDirection:"column",gap:16,minWidth:0}}>
      <div style={sec}><h3 style={sect}>1. Motivo de consulta</h3><textarea style={ta} disabled={!!enc&&enc.state!=="OPEN"} aria-label="Motivo de consulta" value={cForm.motivo} onChange={e=>setCForm(f=>({...f,motivo:e.target.value.slice(0,500)}))} placeholder="Motivo de la consulta…"/><div style={cc}>{cForm.motivo.length}/500</div></div>
      <div style={sec}><h3 style={sect}>2. Historia de la enfermedad actual</h3><textarea style={{...ta,minHeight:90}} disabled={!!enc&&enc.state!=="OPEN"} aria-label="Historia de la enfermedad actual" value={cForm.historia} onChange={e=>setCForm(f=>({...f,historia:e.target.value.slice(0,2000)}))} placeholder="Padecimiento actual…"/><div style={cc}>{cForm.historia.length}/2000</div></div>
      {/* 3. Antecedentes — READ-ONLY desde el expediente. La historia clínica basal se captura UNA vez en el expediente
          (antecedentes/hábitos no se re-preguntan en cada consulta): aquí solo se muestra para dar contexto. */}
      {(()=>{
       const c=antSnap?.content;const hab=c?.noPatologicos;const rows:[string,string][]=[];
       if(antSnap?.recorded){
        const her=[(c?.heredofamiliares?.flags??[]).join(", "),c?.heredofamiliares?.notas].filter(Boolean).join(" · ");if(her)rows.push(["Heredofamiliares",her]);
        const pat=[(c?.patologicos?.cronicos??[]).join(", "),c?.patologicos?.cirugias?"cirugías":"",c?.patologicos?.hospitalizaciones?"hospitalizaciones":"",c?.patologicos?.transfusiones?"transfusiones":"",c?.patologicos?.notas].filter(Boolean).join(" · ");if(pat)rows.push(["Patológicos",pat]);
        rows.push(["Hábitos",`Tabaquismo: ${hab?.tabaquismo?"Sí":"No"} · Alcoholismo: ${hab?.alcoholismo?"Sí":"No"} · Toxicomanías: ${hab?.toxicomanias?"Sí":"No"}`]);
        if(c?.quirurgicos?.notas)rows.push(["Quirúrgicos",c.quirurgicos.notas]);
        if(c?.ginecoObstetricos?.notas)rows.push(["Gineco-obstétricos",c.ginecoObstetricos.notas]);
       }
       return <div style={sec}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
         <h3 style={sect}>3. Antecedentes</h3>
         <button onClick={()=>goExpSection("Antecedentes",setView,setExpTab)} style={{border:0,background:"transparent",color:P.purple,fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>{antSnap?.recorded?"Editar en el expediente →":"Capturar en el expediente →"}</button>
        </div>
        <p style={{fontSize:11.5,color:P.muted,margin:"2px 0 10px"}}>Historia clínica basal (se registra una vez en el expediente, no en cada consulta).</p>
        {antSnap?.recorded
         ? <div style={{display:"flex",flexDirection:"column",gap:7}}>{rows.map(([k,v])=><div key={k} style={{display:"flex",gap:10,fontSize:12.5,padding:"7px 10px",borderRadius:9,background:"#f7f8fc"}}><span style={{fontWeight:800,color:P.purpleOnPale,minWidth:120,flex:"0 0 auto"}}>{k}</span><span style={{minWidth:0,color:"#33383F"}}>{v}</span></div>)}</div>
         : <div style={{fontSize:12.5,color:P.muted,padding:"10px 12px",borderRadius:9,background:"#f6f6fb",border:`1px dashed ${LINE}`}}>Sin antecedentes capturados para este paciente. Captúralos una vez en el expediente.</div>}
       </div>;
      })()}
      <div style={sec}><h3 style={sect}>4. Interrogatorio por aparatos y sistemas</h3>
       {(()=>{const dis=!!enc&&enc.state!=="OPEN";const chip=(hi:boolean):React.CSSProperties=>({border:`1px solid ${hi?P.purple:LINE}`,background:hi?"#F1EFFE":P.white,color:P.purple,borderRadius:999,padding:"4px 11px",fontSize:11.5,fontWeight:600,cursor:dis?"default":"pointer",fontFamily:UI,opacity:dis?.5:1});const add=(txt:string,asLine:boolean)=>setCForm(f=>{if(asLine&&new RegExp("(^|\\n)"+txt.split(":")[0]+":").test(f.interrog))return f;const sep=f.interrog.trim()?"\n":"";return{...f,interrog:(f.interrog+sep+txt).slice(0,2000)};});return <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}><button disabled={dis} onClick={()=>add("Negado por aparatos y sistemas, salvo lo referido en el padecimiento actual.",false)} style={chip(true)}>Negativo por aparatos</button>{["GENERAL","CARDIOVASCULAR","RESPIRATORIO","DIGESTIVO","GENITOURINARIO","NEUROLÓGICO","MUSCULOESQUELÉTICO","PIEL"].map(tag=><button key={tag} disabled={dis} onClick={()=>add(tag+": ",true)} style={chip(false)}>+ {tag.charAt(0)+tag.slice(1).toLowerCase()}</button>)}</div>;})()}
       <textarea style={{...ta,minHeight:90}} disabled={!!enc&&enc.state!=="OPEN"} aria-label="Interrogatorio por aparatos y sistemas" value={cForm.interrog} onChange={e=>setCForm(f=>({...f,interrog:e.target.value.slice(0,2000)}))} placeholder="Interrogatorio por aparatos y sistemas… usa los botones para estructurar o marcar negativo por aparatos."/><div style={cc}>{cForm.interrog.length}/2000</div></div>
      <div style={sec}><h3 style={sect}>5. Exploración física</h3>
       {(()=>{const dis=!!enc&&enc.state!=="OPEN";const chip=(hi:boolean):React.CSSProperties=>({border:`1px solid ${hi?P.purple:LINE}`,background:hi?"#F1EFFE":P.white,color:P.purple,borderRadius:999,padding:"4px 11px",fontSize:11.5,fontWeight:600,cursor:dis?"default":"pointer",fontFamily:UI,opacity:dis?.5:1});const add=(txt:string,asLine:boolean)=>setCForm(f=>{if(asLine&&new RegExp("(^|\\n)"+txt.split(":")[0]+":").test(f.explor))return f;const sep=f.explor.trim()?"\n":"";return{...f,explor:(f.explor+sep+txt).slice(0,2000)};});return <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}><button disabled={dis} onClick={()=>add("Sin alteraciones aparentes salvo lo descrito; paciente estable, consciente y orientado.",false)} style={chip(true)}>Sin alteraciones</button>{["GENERAL","CABEZA Y CUELLO","CARDIOPULMONAR","ABDOMEN","NEUROLÓGICO","EXTREMIDADES","PIEL"].map(tag=><button key={tag} disabled={dis} onClick={()=>add(tag+": ",true)} style={chip(false)}>+ {tag.charAt(0)+tag.slice(1).toLowerCase()}</button>)}</div>;})()}
       <textarea style={{...ta,minHeight:90}} disabled={!!enc&&enc.state!=="OPEN"} aria-label="Exploración física" value={cForm.explor} onChange={e=>setCForm(f=>({...f,explor:e.target.value.slice(0,2000)}))} placeholder="Exploración física por regiones… usa los botones para estructurar o marcar sin alteraciones."/><div style={cc}>{cForm.explor.length}/2000</div></div>
      <div style={card2}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px 8px",fontSize:15,fontWeight:700}}>6. Impresión diagnóstica<span style={{fontSize:11.5,fontWeight:600,color:P.muted}}>Se gestiona en «Diagnósticos / Problemas» →</span></div><div style={{padding:"0 18px 18px",display:"flex",gap:10,flexWrap:"wrap"}}>{(snap?.problems??[]).length===0?<span style={{fontSize:12.5,color:P.muted}}>Sin diagnósticos registrados. Añádelos en el panel «Diagnósticos / Problemas».</span>:(snap?.problems??[]).slice(0,6).map(c=><span key={c} style={{display:"inline-flex",alignItems:"center",gap:8,background:"#F3F5FA",border:`1px solid ${LINE}`,borderRadius:9,padding:"6px 11px",fontSize:12.5,fontWeight:600}}>{c} {DX_LABEL(c)}</span>)}</div></div>
      <div style={sec}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={sect}>Signos vitales</h3><span style={{fontSize:12,color:P.muted}}>{clock.toLocaleDateString("es-MX",{day:"numeric",month:"short"})} · {clock.toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"})}</span></div>
       <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>{([["TA","ta",V["BP"]??"120/80","mmHg"],["FC","fc",V["HR"]??"72","lpm"],["FR","fr",V["RESP"]??"16","rpm"],["Temp.","temp",V["TEMP"]??"36.5","°C"],["SpO₂","spo2",V["SPO2"]??"98","%"]] as const).map(([l,k,ph,u])=><div key={l}><label htmlFor={`cvit-${k}`} style={{fontSize:11.5,color:P.muted,display:"block",marginBottom:5,fontWeight:600}}>{l}</label><input id={`cvit-${k}`} aria-label={`${l} (${u})`} value={cVit[k]} onChange={e=>setCVit(s=>({...s,[k]:e.target.value}))} placeholder={ph} style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 6px",fontSize:15,fontWeight:700,textAlign:"center",fontFamily:UI,boxSizing:"border-box",color:P.ink}}/><div style={{fontSize:10.5,color:P.muted,textAlign:"center",marginTop:3}}>{u}</div></div>)}</div>
       <div style={{display:"flex",alignItems:"center",gap:10,marginTop:12,flexWrap:"wrap"}}><button onClick={()=>void saveConsultaVitals()} disabled={cVitBusy} style={{border:0,background:cVitBusy?"#C7CCE0":P.purple,color:"#fff",borderRadius:9,padding:"9px 16px",fontWeight:700,fontSize:13,cursor:cVitBusy?"default":"pointer",fontFamily:UI}}>{cVitBusy?"Guardando…":"Guardar signos vitales"}</button><span style={link} {...act(()=>{if(patientId){setView("signos");}})}>Ver historial →</span></div>
       {cVitMsg&&<div style={{marginTop:10,fontSize:12.5,color:cVitMsg.includes("⚠")?"#B3261E":cVitMsg.includes("✓")?P.greenOnPale:P.muted,fontWeight:600}}>{cVitMsg}</div>}
      </div>
      <div style={sec}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={sect}>Diagnósticos / Problemas</h3><span style={link} {...act(()=>setView("problemas"))}>Ver historial →</span></div>
       <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}><span style={{fontSize:12,color:P.muted,fontWeight:600}}>Tipo:</span>{([["PROBABLE","Presuntivo"],["CONFIRMED","Confirmado"],["POSSIBLE","Diferencial"]] as ["PROBABLE"|"CONFIRMED"|"POSSIBLE",string][]).map(([v,l])=>{const on=dxType===v;return <button key={v} onClick={()=>setDxType(v)} style={{border:`1px solid ${on?P.purple:LINE}`,background:on?"#F1EFFE":P.white,color:on?P.purple:P.muted,borderRadius:999,padding:"5px 13px",fontSize:12,fontWeight:on?700:500,cursor:"pointer",fontFamily:UI}}>{l}</button>;})}<span style={{fontSize:11,color:P.muted}}>· se aplica al diagnóstico que agregues</span></div>
       <div style={{position:"relative"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 12px"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input aria-label="Buscar diagnóstico CIE-10" value={cDxQuery} onChange={e=>{setCDxQuery(e.target.value);setCDxMsg(null);}} placeholder="Buscar CIE-10 o descripción…" style={{border:0,outline:"none",fontSize:13,fontFamily:UI,color:P.ink,width:"100%",background:"transparent"}}/></div>
        {cDxQuery.trim().length>=2&&(()=>{const res=searchIcd10(cDxQuery.trim(),10);return <div style={{position:"absolute",left:0,right:0,top:"calc(100% + 4px)",background:P.white,border:`1px solid ${LINE}`,borderRadius:10,boxShadow:"0 8px 24px #1a1d2914",zIndex:20,overflow:"hidden"}}>{res.length?res.map(e=><div key={e.code} {...act(()=>{if(cDxBusy)return;void addConsultaProblem(e.code,dxType);})} aria-disabled={cDxBusy||undefined} style={{display:"flex",gap:8,padding:"9px 12px",fontSize:12.5,opacity:cDxBusy?.55:1,cursor:cDxBusy?"default":"pointer",borderBottom:`1px solid #F4F6FB`,alignItems:"baseline"}}><b style={{color:P.purple,flex:"0 0 auto"}}>{e.code}</b><span style={{color:P.ink}}>{e.description}</span></div>):<div style={{padding:"10px 12px",fontSize:12.5,color:P.muted}}>Sin coincidencias en el catálogo CIE-10.</div>}</div>;})()}
       </div>
       {cDxMsg&&<div style={{marginTop:10,fontSize:12.5,color:cDxMsg.includes("✓")?P.greenOnPale:P.muted,fontWeight:600}}>{cDxMsg}</div>}
       <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>{(snap?.problems??[]).slice(0,4).map((c,i)=><span key={c} style={{display:"inline-flex",alignItems:"center",gap:8,background:"#F3F5FA",border:`1px solid ${LINE}`,borderRadius:9,padding:"6px 11px",fontSize:12.5,fontWeight:600}}>{c} {DX_LABEL(c)}{i===0&&<span style={{background:"#EEEBFD",color:P.purpleOnPale,borderRadius:6,padding:"1px 7px",fontSize:10.5,fontWeight:700}}>Principal</span>}</span>)}{(snap?.problems??[]).length===0&&<span style={{fontSize:12.5,color:P.muted}}>Sin problemas activos. Busca un CIE-10 para agregar.</span>}</div>
      </div>
      {(()=>{
       const CORD:[typeof cOrdCat,string,string[]][]=[["LAB","Laboratorio",["Biometría hemática completa","Química sanguínea (6 elementos)","Perfil lipídico","Examen general de orina","Proteína C reactiva","Exudado faríngeo (cultivo)"]],["IMAGING","Imagen",["Radiografía de tórax PA","Ultrasonido abdominal","Tomografía simple de cráneo","Mastografía"]],["PROCEDURE","Procedimiento",["Electrocardiograma","Espirometría","Prueba de esfuerzo"]],["REFERRAL","Interconsulta",["Cardiología","Endocrinología","Nefrología","Oftalmología"]]];
       const studies=CORD.find(c=>c[0]===cOrdCat)?.[2]??[];
       const toggle=(o:string)=>setCOrdSel(s=>s.includes(o)?s.filter(x=>x!==o):[...s,o]);
       return <div style={sec}><h3 style={sect}>Órdenes clínicas</h3>
        <div style={{display:"flex",gap:16,borderBottom:`1px solid ${LINE}`,fontSize:13}}>{CORD.map(([k,l])=><span key={k} {...act(()=>{setCOrdCat(k);setCOrdSel([]);setCOrdMsg(null);})} style={{paddingBottom:8,color:cOrdCat===k?P.purple:P.muted,fontWeight:cOrdCat===k?700:400,borderBottom:cOrdCat===k?`2px solid ${P.purple}`:"0",cursor:"pointer"}}>{l}</span>)}</div>
        <div style={{marginTop:12}}>{studies.map(o=>{const on=cOrdSel.includes(o);return <Check key={o} checked={on} label={o} onChange={()=>toggle(o)} size={17}/>;})}</div>
        <div style={{display:"flex",gap:10,alignItems:"center",marginTop:8,flexWrap:"wrap"}}><button onClick={()=>void createConsultaOrders()} disabled={cOrdBusy||cOrdSel.length===0} style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:(cOrdBusy||cOrdSel.length===0)?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"9px 16px",fontWeight:700,fontSize:13,cursor:(cOrdBusy||cOrdSel.length===0)?"default":"pointer",fontFamily:UI}}>{cOrdBusy?"Creando…":`Crear ${cOrdSel.length||""} orden${cOrdSel.length===1?"":"es"}`.replace("  "," ")}</button><span style={link} {...act(()=>setView("ordenes"))}>Abrir en Órdenes →</span></div>
        {cOrdMsg&&<div style={{marginTop:10,fontSize:12.5,color:cOrdMsg.includes("✓")?P.greenOnPale:P.muted,fontWeight:600}}>{cOrdMsg}</div>}
       </div>;
      })()}
      <div style={sec}><h3 style={sect}>Plan de manejo</h3>
       {(()=>{const dis=!!enc&&enc.state!=="OPEN";return <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>{["FARMACOLÓGICO","NO FARMACOLÓGICO","ESTUDIOS","INTERCONSULTA","SEGUIMIENTO","SIGNOS DE ALARMA"].map(tag=><button key={tag} disabled={dis} onClick={()=>setCForm(f=>{if(new RegExp("(^|\\n)"+tag+":").test(f.plan))return f;const sep=f.plan.trim()?"\n":"";return{...f,plan:f.plan+sep+tag+": "};})} style={{border:`1px solid ${LINE}`,background:P.white,color:P.purple,borderRadius:999,padding:"4px 11px",fontSize:11.5,fontWeight:600,cursor:dis?"default":"pointer",fontFamily:UI,opacity:dis?.5:1}}>+ {tag.charAt(0)+tag.slice(1).toLowerCase()}</button>)}</div>;})()}
       <textarea style={{...ta,minHeight:120}} disabled={!!enc&&enc.state!=="OPEN"} aria-label="Plan y tratamiento" value={cForm.plan} onChange={e=>setCForm(f=>({...f,plan:e.target.value}))} placeholder="Plan de manejo… usa los botones para estructurar por secciones (farmacológico, estudios, seguimiento, signos de alarma…)."/></div>
     </div>
     <div className="mos-consulta-side" style={{display:"flex",flexDirection:"column",gap:16,position:"sticky",top:12,alignSelf:"start"}}>
      <div style={sec}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={sect}>Resumen clínico</h3><span style={{fontSize:11.5,color:P.muted}}>Derivado del expediente</span></div>
       {rsum("#FDECEE",P.redOnPale,"M12 4l9 15.5H3zM12 10v4M12 17h.01","Alergias",!snap?"No evaluadas: expediente no cargado":snap.allergies.length?snap.allergies.join(", "):"Sin alergias documentadas",<span style={{background:"#FDE7EA",color:P.redOnPale,borderRadius:999,padding:"2px 9px",fontSize:10.5,fontWeight:700}}>{snap?.allergies.length?"Alta":"—"}</span>)}
       {rsum("#EEEBFD",P.purpleOnPale,"M9 4h6v2H9zM7 5H6v16h12V5h-1",`Problemas activos`,snap?.problems.length?snap.problems.map(DX_LABEL).slice(0,3).join(", "):"Sin problemas activos",sgo("Abrir →","Lista de problemas"))}
       {rsum("#E7F0FD",P.blueOnPale,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z","Medicamentos actuales","Revisar en el expediente",sgo("Abrir →","Medicación"))}
       {rsum("#E6F6EE",P.greenOnPale,"M14 4l6 6M6 14l4 4M16.5 6.5l-10 10","Vacunas","Revisar cartilla en el expediente",sgo("Abrir →","Vacunas"))}
      </div>
      <div style={{...sec,background:"linear-gradient(180deg,#FBFAFF,#fff)"}}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={{...sect,color:P.purple,display:"flex",alignItems:"center",gap:7}}><NavIcon k="brain"/>Clinical Intelligence (IA)</h3></div><div style={{fontSize:12,fontWeight:600,color:P.muted,marginBottom:8}}>Alertas deterministas para este caso:</div>{findings.length===0?<div style={{fontSize:12.5,lineHeight:1.5,padding:"5px 0",color:P.muted}}>Sin alertas deterministas para los datos registrados. Se recalculan al documentar signos, diagnósticos y medicación.</div>:findings.slice(0,4).map((f,i)=><div key={i} style={{fontSize:12.5,lineHeight:1.5,padding:"5px 0",display:"flex",gap:8}}>• {f.summary}</div>)}<div style={{fontSize:11,color:P.muted,background:"#F3F2FB",borderRadius:8,padding:"8px 10px",marginTop:8}}>La IA ofrece información de apoyo. La decisión final es del médico. (Determinista · sin IA generativa)</div></div>
      <div style={sec}><h3 style={{...sect,display:"flex",alignItems:"center",gap:8}}>Recordatorios y obligaciones {(gaps?.length??0)>0&&<span style={{background:P.redOnPale,color:"#fff",borderRadius:999,padding:"1px 7px",fontSize:11}}>{gaps!.length}</span>}</h3>{gaps===null?<div style={{fontSize:13,color:P.amberOnPale,padding:"9px 0"}}>No evaluados: los recordatorios del paciente no cargaron. Revíselos en el expediente antes de cerrar la consulta.</div>:gaps.length===0?<div style={{fontSize:13,color:P.muted,padding:"9px 0"}}>Sin recordatorios pendientes para este paciente.</div>:gaps!.slice(0,3).map((g,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 0",fontSize:13,borderTop:i?`1px solid #F1F3F9`:"0"}}><div style={{flex:1}}>{g.label}</div><span style={{background:"#FBF0DC",color:P.amberOnPale,borderRadius:999,padding:"2px 9px",fontSize:10.5,fontWeight:700}}>Pendiente</span></div>)}<div style={{textAlign:"right",marginTop:6}}><span style={link} {...act(()=>{goExpSection("Obligaciones de seguimiento",setView,setExpTab);})}>Ver todos →</span></div></div>
     </div>
    </div>)}
   </div>;
  
}
