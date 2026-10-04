"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "inicio" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.

import{card,P,UI,scrollToSection,LINE,act,NavIcon,Skeleton,srOnly}from"../shared";
import{useWorkspace}from"../context";
export default function InicioView(){
 const{clock,patientList,panel,notifCount,setView,setExpTab,openConsulta,agenda,docDisplay,setMedTab,reset,setOrdNew,setApptNew}=useWorkspace();
 // Fusión Pacientes⟷Expediente: ir a la LISTA de pacientes = limpiar el paciente activo y abrir la vista del expediente
 // (que sin paciente ES la lista). `reset()` deja patientId vacío; `exp` muestra entonces la lista de pacientes.
 const irAPacientes=()=>{reset();setView("exp");};

   // ===== DASHBOARD INICIO (consultorio) — S2.png =====
   const fecha=clock.toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).replace(/^\w/,c=>c.toUpperCase());
   const hora=clock.toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"}).toLowerCase();
   const nameOf=(pid:string)=>patientList?.find(p=>p.patientId===pid)?.name||`Paciente ${pid.slice(0,8)}`;
   const prTag=(pr:string):[string,string,string]=>pr==="HIGH"?["Crítico","var(--c-red-bg)",P.redOnPale]:pr==="MEDIUM"?["Seguimiento","var(--c-purple-bg)",P.purpleOnPale]:["Administrativo","var(--c-line)","#6B7391"];
   // Tareas: worklist real (tenant-wide) si hay; si no, ejemplo pulido.
   // WS1-01: los avisos del consultorio son los pendientes REALES del worklist, urgentes primero.
   const avisos=[...(panel?.gaps??[])].sort((a,b)=>(a.priority==="HIGH"?0:1)-(b.priority==="HIGH"?0:1)).slice(0,4);
   const realTasks=(panel?.gaps??[]).slice(0,6).map(g=>({title:g.label,who:nameOf(g.patientId),pr:g.priority as string,pid:g.patientId}));
   // Verdad clínica (U-02): SOLO tareas reales. Antes, sin datos se pintaban tareas inventadas ("Potasio 6.2 mmol/L").
   const tasks=realTasks;
   // Pacientes recientes: lista real si hay; si no, ejemplo.
   const stEs=(s:string):[string,string,string]=>s==="ACTIVE"?["Activo","var(--c-green-bg)",P.greenOnPale]:s==="INACTIVE"?["Inactivo","var(--c-line)","#6B7391"]:["Pendiente","var(--c-amber-bg)",P.amberOnPale];
   const realPts=(patientList??[]).slice(0,5).map(p=>({name:p.name,status:p.status,patientId:p.patientId}));
   // (U-02) Sin pacientes de ejemplo: si no hay registros, la tabla lo dice.
   const usingRealPts=realPts.length>0;
   const initials=(n:string)=>n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const critCount=notifCount??0;
   const kico=(bg:string,ic:React.ReactNode)=>(<span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}>{ic}</span>);
   const svg=(d:string,st:string,w="1.8")=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{stroke:st}} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d}/></svg>;
   const kpiCard:React.CSSProperties={...card,marginTop:0,padding:18,display:"flex",gap:14,alignItems:"flex-start"};
   const h2row:React.CSSProperties={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px 10px"};
   const h2s:React.CSSProperties={fontSize:16.5,fontWeight:700,margin:0,display:"flex",alignItems:"center",gap:9};
   const link:React.CSSProperties={color:P.blue,fontSize:13,fontWeight:600,cursor:"pointer"};
   const cardP:React.CSSProperties={...card,marginTop:0};
   const qbtn:React.CSSProperties={display:"flex",alignItems:"center",gap:11,width:"100%",textAlign:"left",border:0,background:"transparent",padding:"11px 12px",borderRadius:10,fontSize:13.5,fontWeight:500,color:P.ink,cursor:"pointer",fontFamily:UI};
   const qa=(label:string,d:string,onClick:()=>void)=>(<button style={qbtn} onClick={onClick}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{stroke:P.purple}} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d}/></svg>{label}</button>);
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
     {agenda===null?<>{Array.from({length:4}).map((_,i)=><div key={i} style={kpiCard}><Skeleton w={44} h={44} r={12}/><div style={{flex:1}}><Skeleton w="55%" h={12}/><Skeleton w={64} h={24} style={{margin:"6px 0"}}/><Skeleton w="72%" h={10}/></div></div>)}<span style={srOnly}>Cargando indicadores de hoy…</span></>:<>
     <div style={kpiCard}>{kico("var(--c-purple-bg)",svg("M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",P.purple))}<div style={{flex:1}}><div style={{fontSize:13,color:P.muted}}>Citas de hoy</div><div style={{fontSize:26,fontWeight:800,margin:"2px 0"}}>{citasHoy}</div><div style={{height:6,borderRadius:99,background:"var(--c-line)",overflow:"hidden"}}><i style={{display:"block",height:"100%",width:`${citasHoy?Math.round(atendidasHoy/citasHoy*100):0}%`,background:P.purple,borderRadius:99}}/></div><div style={{fontSize:11.5,marginTop:5}}><span style={link} {...act(()=>setView("agenda"))}>Ver agenda →</span></div></div></div>
     <div style={kpiCard}>{kico("var(--c-green-bg)",svg("M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z",P.green))}<div style={{flex:1}}><div style={{fontSize:13,color:P.muted}}>Consultas atendidas</div><div style={{fontSize:26,fontWeight:800,margin:"2px 0"}}>{atendidasHoy}</div><div style={{fontSize:11.5,color:P.muted,marginTop:5}}>de {citasHoy} citas de hoy</div></div></div>
     <div style={kpiCard}>{kico("var(--c-red-bg)",svg("M7 3h7l4 4v14H7zM14 3v4h4M10 13h5M10 16h3",P.red))}<div style={{flex:1}}><div style={{fontSize:13,color:P.muted}}>Pendientes críticos</div><div style={{fontSize:26,fontWeight:800,margin:"2px 0"}}>{critCount}</div><div style={{fontSize:11.5,marginTop:5}}><span style={link} {...act(()=>setView("seguimiento"))}>Ver pendientes →</span></div></div></div>
     <div style={kpiCard}>{kico("var(--c-blue-bg)",svg("M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",P.blue))}<div style={{flex:1,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div>{(()=>{const nx=agenda?.appointments.find(a=>a.status==="SCHEDULED"||a.status==="CHECKED_IN");return <><div style={{fontSize:13,color:P.muted}}>Próxima cita</div><div style={{fontSize:22,fontWeight:800,margin:"2px 0"}}>{nx?new Date(nx.startAt).toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"}).toLowerCase():"—"}</div><div style={{fontSize:11.5,color:P.muted}}>{nx?nx.patientName:"Sin citas próximas"}</div></>;})()}</div><span style={{width:30,height:30,borderRadius:"50%",background:"var(--c-blue-bg)",color:P.blue,display:"grid",placeItems:"center",cursor:"pointer"}} {...act(()=>setView("agenda"))}>→</span></div></div>
     </>}
    </div>
    {/* Banners */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16}} className="mos-banners">
     {critCount>0
      ?<div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:14,background:"var(--c-red-bg)",border:"1px solid var(--c-red-bd)"}}>{svg("M12 4l9 15.5H3zM12 10v4M12 17h.01",P.red)}<div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{critCount} {critCount===1?"pendiente crítico sin resolver":"pendientes críticos sin resolver"}</div><div style={{fontSize:12.5,color:P.muted}}>Pendientes prioritarios del consultorio; algunos bloquean la firma.</div></div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"8px 14px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}} onClick={()=>setView("seguimiento")}>Ver pendientes</button></div>
      :<div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:14,background:"var(--c-green-bg)",border:"1px solid var(--c-green-bd)"}}>{svg("M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z",P.green)}<div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:"var(--c-green-fg)"}}>Sin pendientes críticos</div><div style={{fontSize:12.5,color:P.muted}}>No hay pendientes prioritarios en el consultorio.</div></div></div>}
     <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:14,background:"var(--c-amber-bg)",border:"1px solid var(--c-amber-bd)"}}>{svg("M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7zM7 8l6 6",P.amber)}<div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>Verificador de interacciones</div><div style={{fontSize:12.5,color:P.muted}}>Revisa el conjunto de fármacos del paciente (motor determinista).</div></div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"8px 14px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}} onClick={()=>{setView("medicamentos");setMedTab("interacciones");}}>Revisar</button></div>
    </div>
    {/* Mid: tareas | agenda | (CI + acciones) */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-mid">
     <div style={cardP}><div style={h2row}><h2 style={h2s}>Tareas clínicas prioritarias <span style={{background:P.purple,color:"#fff",fontSize:11,fontWeight:800,borderRadius:999,minWidth:20,height:20,display:"grid",placeItems:"center",padding:"0 5px"}}>{tasks.length}</span></h2><span style={link} {...act(()=>go("Panel del clínico"))}>Ver todas →</span></div>
      {panel===null?<div role="status" aria-busy="true" style={{borderTop:`1px solid ${LINE}`}}>{[0,1,2].map(i=><div key={i} style={{display:"flex",gap:12,padding:"12px 18px",alignItems:"center"}}><Skeleton w={34} h={34} r={9}/><div style={{flex:1}}><Skeleton w="70%" h={13}/><Skeleton w="40%" h={11} style={{marginTop:6}}/></div><Skeleton w={64} h={18} r={6}/></div>)}<span style={srOnly}>Cargando tareas…</span></div>
       :tasks.length===0?<div style={{padding:"18px",fontSize:13,color:P.muted,borderTop:`1px solid ${LINE}`}}>Sin tareas clínicas prioritarias.</div>:null}
      {tasks.map((t,i)=>{const[tag,tbg,tfg]=prTag(t.pr);return <div key={i} title={t.pid?"Abrir consulta del paciente":undefined} style={{display:"flex",gap:12,padding:"12px 18px",borderTop:`1px solid var(--c-wash)`,cursor:"pointer"}} {...act(()=>openPatientCtx(t.pid,t.who))}>
       <span style={{width:34,height:34,borderRadius:9,background:tbg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><span style={{width:8,height:8,borderRadius:"50%",background:tfg}}/></span>
       <div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:600}}>{t.title}</div><div style={{fontSize:12,color:P.muted}}>{t.who}</div></div>
       <span style={{fontSize:10.5,fontWeight:700,borderRadius:6,padding:"3px 8px",background:tbg,color:tfg,whiteSpace:"nowrap",alignSelf:"flex-start"}}>{tag}</span>
      </div>;})}
     </div>
     <div style={cardP}><div style={h2row}><h2 style={h2s}>Agenda de hoy</h2><span style={link} {...act(()=>setView("agenda"))}>Ver agenda →</span></div>
      <div style={{padding:"4px 18px 14px",position:"relative"}}>
       <div style={{position:"absolute",left:73,top:8,bottom:14,width:2,background:"var(--c-line)"}}/>
       {agenda===null?<div role="status" aria-busy="true" style={{paddingLeft:84}}>{[0,1,2].map(i=><div key={i} style={{display:"flex",gap:14,padding:"9px 0",alignItems:"center"}}><Skeleton w={54} h={11}/><Skeleton w={11} h={11} r={99}/><div style={{flex:1}}><Skeleton w="40%" h={12}/><Skeleton w="72%" h={11} style={{marginTop:5}}/></div></div>)}<span style={srOnly}>Cargando agenda…</span></div>
       :!agenda.appointments.length?<div style={{padding:"10px 0 10px 84px",fontSize:13,color:P.muted}}>Sin citas registradas para hoy.</div>:null}
       {(agenda?.appointments.length?agenda.appointments.slice(0,8).map(a=>({tm:new Date(a.startAt).toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"}).toLowerCase(),txt:`${a.patientName} · ${a.reason}`,on:a.status==="CHECKED_IN",pid:a.patientId,name:a.patientName})):([] as {tm:string;txt:string;on:boolean;pid:string;name:string}[])).map((it,i)=>(
        <div key={i} {...act(()=>openPatientCtx(it.pid,it.name))} title={it.pid?"Abrir consulta del paciente":undefined} style={{display:"flex",gap:14,padding:it.on?"9px 12px":"9px 0",position:"relative",cursor:it.pid?"pointer":"default",...(it.on?{background:"var(--c-purple-bg)",border:"1px solid var(--c-purple-bd)",borderRadius:12,margin:"2px -12px"}:{})}}>
         <span style={{fontSize:12,color:P.muted,width:62,flex:"0 0 auto",textAlign:"right",paddingTop:1}}>{it.tm}</span>
         <span style={{width:11,height:11,borderRadius:"50%",background:it.on?P.purple:"#fff",border:`2px solid ${it.on?P.purple:"var(--c-blue-bd)"}`,flex:"0 0 auto",marginTop:3,zIndex:1}}/>
         <div><div style={{fontSize:13,fontWeight:600,color:it.on?P.purple:P.ink}}>Consulta</div><div style={{fontSize:12,color:P.muted}}>{it.txt}</div></div>
        </div>))}
      </div>
     </div>
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={cardP}><div style={h2row}><h2 style={{...h2s,color:P.purple}}><NavIcon k="brain"/>Clinical Intelligence (IA)</h2></div>
       <div style={{padding:"4px 18px 16px"}}>
        <div style={{fontSize:13,color:P.muted,lineHeight:1.45,padding:"6px 0 12px"}}>El tablero poblacional por cohorte (tamizajes pendientes, control glucémico, posibles duplicidades) se conecta al <b>motor determinista</b> de Clinical Intelligence; a nivel de consultorio aún no está cableado. Abre el módulo para las herramientas ya disponibles.</div>
        <button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px 14px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI,width:"100%",marginTop:10}} onClick={()=>{setView("exp");setExpTab("intel");}}>Ver Clinical Intelligence →</button>
       </div>
      </div>
      <div style={cardP}><div style={h2row}><h2 style={h2s}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{stroke:P.purple}} strokeWidth="1.9" aria-hidden><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>Acciones rápidas</h2></div>
       <div style={{padding:8}}>
        {qa("Nueva consulta","M12 5v14M5 12h14",()=>irAPacientes())}
        {qa("Registrar resultado","M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3",()=>setView("resultados"))}
        {qa("Crear orden clínica","M8 4h8v3H8zM6 5H5v16h14V5h-1M8 12h8M8 16h5",()=>{setView("ordenes");setOrdNew(true);})}
        {qa("Prescribir medicamento","M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7zM7 8l6 6",()=>setView("medicamentos"))}
        {qa("Agendar cita","M4 6h16v14H4zM8 3v4M16 3v4",()=>{setView("agenda");setApptNew(true);})}
        {qa("Subir documento","M12 16V4m0 0l-4 4m4-4l4 4M4 20h16",()=>{setView("exp");setExpTab("documentos");})}
        {qa("Solicitar interconsulta","M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M16 4.5a3 3 0 010 6M22 20a6 6 0 00-5-5.9",()=>setView("interconsulta"))}
       </div>
      </div>
     </div>
    </div>
    {/* Pacientes recientes | recursos */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-low">
     <div style={cardP}><div style={h2row}><h2 style={h2s}>Pacientes recientes</h2><span style={link} {...act(()=>irAPacientes())}>Ver todas →</span></div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr>{["Nombre","Estado"].map(h=><th key={h} style={{textAlign:"left",fontSize:11.5,color:P.muted,fontWeight:600,padding:"8px 18px",borderBottom:`1px solid ${LINE}`}}>{h}</th>)}</tr></thead>
       <tbody>{patientList===null?[0,1,2,3].map(i=><tr key={`sk${i}`} aria-hidden><td style={{padding:"11px 18px",borderBottom:`1px solid var(--c-wash)`}}><div style={{display:"flex",alignItems:"center",gap:10}}><Skeleton w={30} h={30} r={99}/><Skeleton w={140} h={13}/></div></td><td style={{padding:"11px 18px",borderBottom:`1px solid var(--c-wash)`}}><Skeleton w={56} h={18} r={99}/></td></tr>):(!usingRealPts?<tr><td colSpan={2} style={{padding:"22px 14px",textAlign:"center",color:P.muted,fontSize:13}}>Aún no hay pacientes registrados.</td></tr>:null)}{realPts.map((p,i)=>{const[stl,sbg,sfg]=stEs(p.status);const d=p as{name:string;status:string;patientId?:string};return <tr key={i}>
        <td style={{padding:"11px 18px",borderBottom:`1px solid var(--c-wash)`,fontSize:13}}><span style={{display:"flex",alignItems:"center",gap:10,fontWeight:600,cursor:"pointer"}} {...act(()=>d.patientId?openPatientCtx(d.patientId,p.name):irAPacientes())}><span style={{width:30,height:30,borderRadius:"50%",background:"var(--c-purple-bg)",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700}}>{initials(p.name)}</span>{p.name}</span></td>
        <td style={{padding:"11px 18px",borderBottom:`1px solid var(--c-wash)`}}><span style={{fontSize:11,fontWeight:700,borderRadius:999,padding:"3px 10px",background:sbg,color:sfg,whiteSpace:"nowrap"}}>{stl}</span></td>
       </tr>;})}</tbody>
      </table></div>
     </div>
     <div style={cardP}><div style={h2row}><h2 style={h2s}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{stroke:P.purple}} strokeWidth="1.8" aria-hidden><path d="M4 5a2 2 0 012-2h9v18H6a2 2 0 01-2-2zM15 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3"/></svg>Recursos clínicos</h2></div>
      <div style={{padding:"6px 8px"}}>{([["Calculadoras médicas",()=>setView("biblioteca")],["Interacciones medicamentosas",()=>{setView("medicamentos");setMedTab("interacciones");}],["CIE-10 / CUPS",()=>setView("biblioteca")],["Protocolos del consultorio",()=>setView("biblioteca")],["Guías de práctica clínica",()=>setView("biblioteca")]] as const).map(([r,fn])=><div key={r} {...act(fn)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:9,color:P.blue,fontSize:13.5,fontWeight:500,cursor:"pointer"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="M8 6h9M8 12h9M8 18h6M4 6h.01M4 12h.01M4 18h.01"/></svg>{r}</div>)}</div>
     </div>
    </div>
    {/* Indicadores | donut | mensajes */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 340px",gap:16,marginTop:16,alignItems:"start"}} className="mos-low2">
     <div style={cardP}><div style={h2row}><h2 style={{...h2s,fontSize:15}}>Indicadores del consultorio</h2><span style={link} {...act(()=>setView("reportes"))}>Ver Reportes →</span></div>
      <div style={{padding:"4px 18px 18px",fontSize:13,color:P.muted,lineHeight:1.5}}>Los indicadores del consultorio —consultas, ingresos, tipos de consulta y calidad— se calculan con <b>dato real</b> en <b>Reportes</b>, con su rango del periodo.</div>
     </div>
     <div style={{...cardP,padding:"16px 18px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><h2 style={{...h2s,fontSize:15}}>Distribución de motivos de consulta</h2><span style={link} {...act(()=>setView("reportes"))}>Ver Reportes →</span></div>
      <div style={{fontSize:13,color:P.muted,lineHeight:1.5}}>La distribución real por <b>tipo de consulta</b> está en <b>Reportes</b>, calculada desde la agenda del consultorio.</div>
     </div>
     {/* Auditoría 2026-09-19, anexo R05a (WS1-01) — AVISOS REALES DEL CONSULTORIO, no tres ejemplos con hora inventada.
         Este widget mostraba una insignia roja fija con un «3» y tres mensajes escritos a mano («Nuevo resultado de
         laboratorio · Hoy 12:45 p.m.», «Interconsulta aceptada», «Documento pendiente por firmar») indistinguibles de
         avisos verdaderos: el médico podía buscar un resultado que nadie había recibido. Ahora sale del worklist —los
         pendientes REALES del consultorio, que esta misma pantalla ya carga— con su prioridad y el paciente al que
         pertenecen. No se inventa la hora: el worklist no la trae, y una hora falsa es lo que hacía creíble el widget. */}
     <div style={cardP}><div style={h2row}><h2 style={{...h2s,fontSize:15}}>Avisos del consultorio {panel===null
       ?<span title="Sin dato: no se pudo cargar el worklist" style={{background:"var(--c-amber-bg)",color:P.amberOnPale,fontSize:11,fontWeight:800,borderRadius:999,minWidth:20,height:20,display:"grid",placeItems:"center",padding:"0 5px"}}>—</span>
       :avisos.length>0&&<span style={{background:P.red,color:"#fff",fontSize:11,fontWeight:800,borderRadius:999,minWidth:20,height:20,display:"grid",placeItems:"center",padding:"0 5px"}}>{avisos.length}</span>}</h2>
      {avisos.length>0&&<span style={link} {...act(()=>setView("obligaciones"))}>Ver todos →</span>}</div>
      {panel===null
       ?<div style={{padding:"14px 18px",fontSize:13,color:P.amberOnPale,borderTop:`1px solid var(--c-wash)`}}>No evaluados: los avisos del consultorio no cargaron. Ábralos en Obligaciones para revisarlos.</div>
       :avisos.length===0
        ?<div style={{padding:"14px 18px",fontSize:13,color:P.muted,borderTop:`1px solid var(--c-wash)`}}>Sin avisos pendientes en el consultorio.</div>
        :avisos.map((g,i)=><div key={`${g.aggregateId}-${i}`} style={{display:"flex",gap:11,padding:"10px 18px",borderTop:`1px solid var(--c-wash)`,alignItems:"flex-start"}}><span style={{width:8,height:8,borderRadius:"50%",background:g.priority==="HIGH"?P.red:P.purple,marginTop:5,flex:"0 0 auto"}}/><div style={{flex:1,fontSize:13,fontWeight:600}}>{g.label}<div style={{fontSize:11.5,fontWeight:500,color:P.muted}}>{nameOf(g.patientId)}</div></div><span style={{fontSize:10.5,fontWeight:700,color:g.priority==="HIGH"?"var(--c-red-fg)":P.muted,whiteSpace:"nowrap"}}>{g.priority==="HIGH"?"Urgente":"Pendiente"}</span></div>)}
     </div>
    </div>
   </div>;
  
}
