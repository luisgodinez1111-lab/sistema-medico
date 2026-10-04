"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "ordenes" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.

import{scrollTop,card,P,LINE,UI,act,actRow,Skeleton,cargaFallida}from"../shared";
import{useWorkspace}from"../context";
export default function OrdenesView(){
 const{ordReg,ordTab,ordQuery,ordStatus,ordSel,openConsulta,reloadOrders,setOrdMsg,setOrdNew,ordNew,setOrdTab,ordMsg,ordForm,setOrdForm,patientList,submitOrder,ordBusy,setOrdQuery,setOrdStatus,docDisplay,setOrdSel,orderTransition,loadErr,retryLoad}=useWorkspace();

   // ===== MÓDULO ÓRDENES — cableado REAL de punta a punta (crear + ciclo de vida + navegación) =====
   // Fuente única: ordersRegistry (GET /api/v1/orders). Acciones: POST create / placement / fulfillment / cancellation.
   // Todo interconectado: seleccionar una orden actualiza el detalle; abrir lleva al expediente del paciente en Consulta.
   const card2:React.CSSProperties={...card,marginTop:0};
   const OTABS:[typeof ordTab,string,string][]=[["todas","Todas las órdenes","M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"],["laboratorio","Laboratorio","M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"],["imagenologia","Imagenología","M3 5h18v14H3zM3 15l5-5 4 4"],["interconsultas","Interconsultas","M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M16 4.5a3 3 0 010 6M22 20a6 6 0 00-5-5.9"],["procedimientos","Procedimientos","M14 4l6 6M6 14l4 4M16.5 6.5l-10 10"],["otros","Otros","M4 5h16v14H4z"]];
   const kico=(bg:string,fg:string,d:string)=><span style={{width:40,height:40,borderRadius:11,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:15,display:"flex",gap:12,alignItems:"center"};
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const th:React.CSSProperties={textAlign:"left",fontSize:11,color:P.muted,fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`};
   const td:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,verticalAlign:"top"};
   const dk:React.CSSProperties={color:P.muted,width:130,flex:"0 0 auto"};
   const chip:React.CSSProperties={border:`1px solid ${LINE}`,background:P.white,color:P.ink,borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:UI};
   const initials=(n:string)=>n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const TYPE_ICO:Record<string,string>={LAB:"🧪",IMAGING:"🩻",PROCEDURE:"🫀",REFERRAL:"👥",PATHOLOGY:"🔬"};
   const TYPE_LBL:Record<string,string>={LAB:"Laboratorio",IMAGING:"Imagenología",PROCEDURE:"Procedimiento",REFERRAL:"Interconsulta",PATHOLOGY:"Patología"};
   const SUGG:Record<string,string[]>={LAB:["Biometría hemática completa","Química sanguínea (6 elementos)","Perfil lipídico","HbA1c","Examen general de orina","TSH y T4 libre"],IMAGING:["Radiografía de tórax PA","Ultrasonido abdominal","Tomografía simple de cráneo","Mastografía"],PROCEDURE:["Electrocardiograma","Espirometría","Endoscopia","Prueba de esfuerzo"],REFERRAL:["Cardiología","Endocrinología","Nefrología","Oftalmología"],PATHOLOGY:["Biopsia","Citología cervical","Estudio histopatológico"]};
   const stx=(s:string):[string,string]=>s==="Completada"?["#E6F6EE",P.greenOnPale]:s==="Enviada"?["#EAF1FD",P.blueOnPale]:s==="Cancelada"?["#F0F1F4",P.muted]:["#FBF0DC",P.amberOnPale];
   const fmtDT=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});};
   const items=ordReg?.items??[];
   const ordLoaded=!!ordReg;
   const KNOWN=["LAB","IMAGING","PROCEDURE","REFERRAL"];
   // Auditoría R05b-11: «Gabinete» y «Procedimientos» filtraban EXACTAMENTE el mismo tipo (PROCEDURE). Quien pulsaba
   // «Gabinete» esperaba estudios de gabinete y obtenía todos los procedimientos: dos pestañas, un solo filtro. No existe un
   // tipo de orden «gabinete» en el dominio, así que la pestaña se retira en vez de inventarle un tipo al servidor.
   const TAB_TYPES:Record<string,string[]>={laboratorio:["LAB"],imagenologia:["IMAGING"],interconsultas:["REFERRAL"],procedimientos:["PROCEDURE"]};
   const byTab=ordTab==="todas"?items:ordTab==="otros"?items.filter(o=>!KNOWN.includes(o.orderType)):items.filter(o=>(TAB_TYPES[ordTab]??[]).includes(o.orderType));
   const q=ordQuery.trim().toLowerCase();
   const filtered=byTab.filter(o=>(!q||o.patientName.toLowerCase().includes(q)||o.detail.toLowerCase().includes(q))&&(!ordStatus||o.status===ordStatus));
   const kTot=ordReg?.total??0,kSol=items.filter(o=>o.status==="Solicitada").length,kEnv=items.filter(o=>o.status==="Enviada").length,kCom=items.filter(o=>o.status==="Completada").length,kCan=items.filter(o=>o.status==="Cancelada").length;
   const selected=items.find(o=>o.orderId===ordSel)??items[0]??null;
   const openInRecord=(pid:string,name:string)=>openConsulta(pid,name);
   const donutDefs:[string,string,string][]=[["LAB","Laboratorio",P.amberOnPale],["IMAGING","Imagenología",P.redOnPale],["PROCEDURE","Procedimiento",P.cyan],["REFERRAL","Interconsulta",P.purpleOnPale],["PATHOLOGY","Patología",P.muted]];
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
    {loadErr.ord&&!ordReg&&cargaFallida(()=>retryLoad("ord"))}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M7 3h10v18H7zM10 8h4M10 12h4"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Órdenes</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Solicita, envía y da seguimiento a estudios de laboratorio, imagenología, gabinete e interconsultas. Cada orden se registra en el expediente y avanza por su ciclo de vida.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={async()=>{setOrdMsg("Actualizando…");await reloadOrders();setOrdMsg(null);}}>↻ Actualizar</button><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setOrdNew(v=>!v);setOrdMsg(null);}}>{ordNew?"Cerrar":"+ Nueva orden"}</button></div>
    </div>
    <div style={{display:"flex",alignItems:"center",marginTop:14,borderBottom:`1px solid ${LINE}`,gap:2,overflowX:"auto"}}>{OTABS.map(([k,l,d])=><button key={k} onClick={()=>setOrdTab(k)} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 15px",fontSize:13.5,fontWeight:ordTab===k?700:500,color:ordTab===k?P.purple:P.muted,cursor:"pointer",borderBottom:ordTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,fontFamily:UI,whiteSpace:"nowrap"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={d}/></svg>{l}{k!=="todas"&&<span style={{fontSize:10.5,fontWeight:700,background:"#EEF0F5",color:P.muted,borderRadius:999,padding:"1px 7px"}}>{ordTab==="otros"?items.filter(o=>!KNOWN.includes(o.orderType)).length:items.filter(o=>(TAB_TYPES[k]??[]).includes(o.orderType)).length}</span>}</button>)}<span style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:7,paddingRight:4,fontSize:11.5,color:P.muted}}><span style={{width:8,height:8,borderRadius:"50%",background:P.green}}/>Registro en vivo · {kTot} órdenes</span></div>
    {ordMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:"#EEF6FF",border:"1px solid #CFE0F7",borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:P.blue,fontWeight:700}}>ℹ</span><span style={{flex:1}}>{ordMsg}</span><button onClick={()=>setOrdMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {ordNew&&<div style={{...card2,marginTop:16,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>Nueva orden clínica</div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} className="mos-med2">
      <div><div style={flbl}>Paciente</div><select aria-label="Paciente" value={ordForm.patientId} onChange={e=>setOrdForm({...ordForm,patientId:e.target.value})} style={selSty}><option value="">Selecciona un paciente…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select>{(patientList??[]).length===0&&<div style={{fontSize:11.5,color:P.muted,marginTop:5}}>No hay pacientes en el tenant. Registra uno en «Pacientes» primero.</div>}</div>
      <div><div style={flbl}>Tipo de estudio</div><select aria-label="Tipo de orden" value={ordForm.orderType} onChange={e=>setOrdForm({...ordForm,orderType:e.target.value,detail:""})} style={selSty}>{[["LAB","Laboratorio"],["IMAGING","Imagenología"],["PROCEDURE","Procedimiento / Gabinete"],["REFERRAL","Interconsulta"],["PATHOLOGY","Patología"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
     </div>
     <div style={{marginTop:12}}><div style={flbl}>Estudio / indicación</div><input aria-label="Detalle de la orden" value={ordForm.detail} onChange={e=>setOrdForm({...ordForm,detail:e.target.value})} placeholder="Escribe o elige una sugerencia" style={{...selSty,padding:"10px 11px"}}/></div>
     <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>{(SUGG[ordForm.orderType]??[]).map(s=><button key={s} onClick={()=>setOrdForm(f=>({...f,detail:s}))} style={ordForm.detail===s?{...chip,borderColor:P.purple,background:"#EEEBFD",color:P.purple}:chip}>{s}</button>)}</div>
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void submitOrder()} disabled={ordBusy||!ordForm.patientId||!ordForm.detail.trim()} style={{border:0,background:(ordBusy||!ordForm.patientId||!ordForm.detail.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(ordBusy||!ordForm.patientId||!ordForm.detail.trim())?"default":"pointer",fontFamily:UI}}>{ordBusy?"Creando…":"Crear orden"}</button><button onClick={()=>setOrdNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#EEEBFD",P.purple,"M7 3h10v18H7z")}<div><div style={{fontSize:22,fontWeight:800}}>{ordLoaded?kTot:<Skeleton w={40} h={20}/>}</div><div style={{fontSize:11.5,color:P.muted}}>Órdenes totales</div></div></div>
     <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0")}<div><div style={{fontSize:22,fontWeight:800}}>{ordLoaded?kSol:<Skeleton w={40} h={20}/>}</div><div style={{fontSize:11.5,color:P.muted}}>Solicitadas</div></div></div>
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M12 15V4m0 0l-4 4m4-4l4 4M4 20h16")}<div><div style={{fontSize:22,fontWeight:800}}>{ordLoaded?kEnv:<Skeleton w={40} h={20}/>}</div><div style={{fontSize:11.5,color:P.muted}}>Enviadas</div></div></div>
     <div style={kcard}>{kico("#E6F6EE",P.green,"M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z")}<div><div style={{fontSize:22,fontWeight:800}}>{ordLoaded?kCom:<Skeleton w={40} h={20}/>}</div><div style={{fontSize:11.5,color:P.muted}}>Completadas</div></div></div>
     <div style={kcard}>{kico("#F0F1F4",P.muted,"M6 6l12 12M6 18L18 6")}<div><div style={{fontSize:22,fontWeight:800,color:P.muted}}>{ordLoaded?kCan:<Skeleton w={40} h={20}/>}</div><div style={{fontSize:11.5,color:P.muted}}>Canceladas</div></div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"230px 1fr 320px",gap:14,marginTop:16,alignItems:"start"}} className="mos-ord3">
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:15,fontWeight:700}}>Filtros</span><span style={{color:P.blue,fontSize:12.5,fontWeight:600,cursor:"pointer"}} {...act(()=>{setOrdQuery("");setOrdStatus("");setOrdTab("todas");})}>Limpiar</span></div>
      <div style={{display:"flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,borderRadius:9,padding:"8px 11px",margin:"12px 0"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input aria-label="Buscar orden" value={ordQuery} onChange={e=>setOrdQuery(e.target.value)} placeholder="Buscar paciente o estudio…" style={{border:0,outline:"none",fontSize:12.5,fontFamily:UI,color:P.ink,width:"100%",background:"transparent"}}/></div>
      <div style={flbl}>Tipo de orden</div><select aria-label="Categoría de orden" value={ordTab} onChange={e=>setOrdTab(e.target.value as typeof ordTab)} style={selSty}><option value="todas">Todos</option><option value="laboratorio">Laboratorio</option><option value="imagenologia">Imagenología</option><option value="interconsultas">Interconsultas</option><option value="procedimientos">Procedimientos</option><option value="otros">Otros</option></select>
      <div style={{...flbl,marginTop:14}}>Estado</div><select aria-label="Estado de la orden" value={ordStatus} onChange={e=>setOrdStatus(e.target.value)} style={selSty}><option value="">Todos</option><option value="Solicitada">Solicitada</option><option value="Enviada">Enviada</option><option value="Completada">Completada</option><option value="Cancelada">Cancelada</option></select>
      <div style={{...flbl,marginTop:14}}>Solicitado por</div><div style={{...selSty,color:P.muted,fontSize:12}}>Yo ({docDisplay})</div>
      <button style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI,marginTop:14}} onClick={()=>{setOrdNew(true);scrollTop();}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 5v14M5 12h14"/></svg>Nueva orden</button>
     </div>
     <div style={{...card2,padding:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 12px 8px"}}><span style={{fontSize:16,fontWeight:700}}>Órdenes ({filtered.length})</span><span style={{fontSize:12,color:P.muted}}>{ordTab==="todas"?"Todas":OTABS.find(t=>t[0]===ordTab)?.[1]}{ordStatus?` · ${ordStatus}`:""}</span></div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr>{["Fecha","Paciente","Estudio / Orden","Estado","Acciones"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
       <tbody>{!ordLoaded?Array.from({length:6}).map((_,i)=><tr key={`sk${i}`} aria-hidden>{Array.from({length:5}).map((__,j)=><td key={j} style={td}><Skeleton w={j===0?68:j===4?60:"80%"} h={12}/></td>)}</tr>):items.length===0?(
        <tr><td colSpan={5} style={{...td,textAlign:"center",color:P.muted,padding:"40px 12px"}}>Aún no hay órdenes en el registro. Usa «+ Nueva orden» para crear la primera.</td></tr>
       ):filtered.length===0?(
        <tr><td colSpan={5} style={{...td,textAlign:"center",color:P.muted,padding:"40px 12px"}}>Ninguna orden coincide con el filtro.</td></tr>
       ):filtered.map(o=>{const[bg,fg]=stx(o.status);const on=(selected?.orderId===o.orderId);return <tr key={o.orderId} style={{background:on?"#F6F5FE":"transparent",cursor:"pointer"}} {...actRow(()=>setOrdSel(o.orderId))}>
        <td style={td}>{fmtDT(o.createdAt).split(",")[0]}<div style={{color:P.muted}}>{(fmtDT(o.createdAt).split(",")[1]??"").trim()}</div></td>
        <td style={td}><div style={{display:"flex",alignItems:"center",gap:9}}><span style={{width:30,height:30,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>{initials(o.patientName)}</span><div style={{fontWeight:600}}>{o.patientName}</div></div></td>
        <td style={td}><div style={{fontWeight:600}}>{o.detail}</div><div style={{color:P.purple,fontSize:11}}>{TYPE_ICO[o.orderType]??"📄"} {o.typeLabel}</div></td>
        <td style={td}><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:bg,color:fg}}>{o.status}</span></td>
        <td style={td}><span style={{color:P.blue,fontWeight:600,fontSize:12,cursor:"pointer"}} {...act(ev=>{ev.stopPropagation();openInRecord(o.patientId,o.patientName);})}>Abrir →</span></td>
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
        {(selected.status==="Solicitada"||selected.status==="Enviada")&&<button onClick={()=>void orderTransition(selected.orderId,selected.version,"cancellation","Orden cancelada.")} disabled={ordBusy} style={{border:"1px solid #F3C9C9",background:P.white,color:P.redOnPale,borderRadius:9,padding:9,fontWeight:600,fontSize:12.5,cursor:ordBusy?"default":"pointer",fontFamily:UI}}>Cancelar orden</button>}
       </div>
       <div style={{fontSize:13,fontWeight:700,margin:"6px 0 6px"}}>Seguimiento</div>
       <div style={{position:"relative",paddingLeft:20,marginTop:8}}>
        <div style={{position:"absolute",left:5,top:4,bottom:4,width:2,background:"#EDEFF6"}}/>
        {timeline(selected.status).map(([t,s,done],i)=><div key={i} style={{position:"relative",padding:"6px 0",fontSize:12}}><span style={{position:"absolute",left:-19,top:9,width:11,height:11,borderRadius:"50%",background:"#fff",border:`2px solid ${done?(selected.status==="Cancelada"?P.muted:P.purple):"#C7CCE0"}`}}/><b style={{color:done?P.ink:P.muted}}>{t}</b><br/><span style={{color:P.muted}}>{s}</span></div>)}
       </div>
      </>)}
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"340px 1fr",gap:14,marginTop:16,alignItems:"start"}} className="mos-ord2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Órdenes por tipo</div><div style={{display:"flex",gap:16,alignItems:"center"}}><div style={{width:96,height:96,borderRadius:"50%",flex:"0 0 auto",display:"grid",placeItems:"center",background:conic}}><div style={{width:62,height:62,borderRadius:"50%",background:P.white,display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:16,fontWeight:800}}>{donCount}</div><div style={{fontSize:9,color:P.muted}}>Órdenes</div></div></div></div><div style={{flex:1}}>{donCount===0?<div style={{fontSize:12.5,color:P.muted}}>Sin órdenes registradas. La distribución por tipo aparece al crear órdenes.</div>:donut.filter(d=>d.n>0).map(d=><div key={d.t} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,padding:"3px 0"}}><span style={{width:8,height:8,borderRadius:"50%",background:d.c}}/>{d.l}<b style={{marginLeft:"auto"}}>{d.n} ({Math.round(d.n/donTot*100)}%)</b></div>)}</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:12,alignItems:"flex-start"}}><span style={{width:34,height:34,borderRadius:"50%",background:"#E6F6EE",color:P.green,display:"grid",placeItems:"center",flex:"0 0 auto"}}>✓</span><div><div style={{fontWeight:700,fontSize:14}}>Registro de órdenes en vivo</div><div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Cada orden se persiste como evento clínico y avanza por su ciclo de vida (Solicitada → Enviada → Completada, o Cancelada) con concurrencia optimista y auditoría. La integración con laboratorio externo (envío automático de folios) es representativa en esta versión: el envío se registra como transición interna, no se transmite a un laboratorio real.</div></div></div>
    </div>
   </div>;
  
}
