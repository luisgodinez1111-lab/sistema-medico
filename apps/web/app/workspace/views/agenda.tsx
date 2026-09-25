"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "agenda" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import {Fragment} from "react";
import{card,P,LINE,act,UI,actRow,type AgendaAppt}from"../shared";
import{useWorkspace}from"../context";
export default function AgendaView(){
 const{agendaDate,clock,setAgendaDate,setApptSel,setApptNew,agenda,agendaErr,apptSel,openConsulta,reloadAgenda,setApptMsg,apptNew,agendaView,setAgendaView,apptMsg,apptForm,setApptForm,patientList,createAppt,apptBusy,apptTransition}=useWorkspace();

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
   const AC:Record<string,{bg:string;bd:string;fg:string}>={blue:{bg:"#EAF1FD",bd:P.blueOnPale,fg:"#123c73"},green:{bg:"#E7F7EE",bd:P.greenOnPale,fg:"#0d5c3b"},purple:{bg:"#EFEBFD",bd:P.purpleOnPale,fg:"#382a8f"},amber:{bg:"#FBF2DF",bd:P.amberOnPale,fg:P.amberOnPale},red:{bg:"#FDEBEE",bd:P.redOnPale,fg:"#9c1f34"}};
   const ST:Record<string,[string,string,string]>={SCHEDULED:["Programada","#EAF1FD",P.blueOnPale],CHECKED_IN:["En espera","#FBF0DC",P.amberOnPale],COMPLETED:["Atendida","#E6F6EE",P.greenOnPale],CANCELLED:["Cancelada","#F0F1F4","#8A8FA3"],NO_SHOW:["Inasistencia","#FDE7EA",P.redOnPale]};
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
   const slot=(a?:Ap,last?:boolean)=>{return <div style={{borderRight:last?"0":`1px solid ${LINE}`,borderBottom:`1px solid #F2F4F9`,height:56,padding:3}}>{a&&(()=>{const c=AC[a.c]!;const on=!!a.id&&a.id===apptSel;return <div {...act(a.id?()=>setApptSel(a.id):undefined)} style={{borderRadius:8,padding:"6px 9px",fontSize:11,height:"100%",overflow:"hidden",borderLeft:`3px solid ${c.bd}`,background:c.bg,color:c.fg,cursor:a.id?"pointer":"default",outline:on?`2px solid ${P.purple}`:"none"}}><div style={{fontSize:10,opacity:.85}}>{a.t}</div><div style={{fontWeight:700,fontSize:11.5}}>{a.n}</div><div style={{opacity:.8}}>{a.m}</div></div>;})()}</div>;};
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
     <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>{VPILLS.map(([k,l])=>{const on=agendaView===k;const dis=k==="semana"||k==="mes";return <span key={k} {...act(dis?undefined:()=>setAgendaView(k as typeof agendaView))} title={dis?"Próximamente":undefined} style={{border:`1px solid ${on?P.purple:LINE}`,background:on?P.purple:P.white,color:on?"#fff":dis?"#C7CCE0":P.muted,borderRadius:10,padding:"9px 15px",fontSize:13.5,fontWeight:600,cursor:dis?"not-allowed":"pointer"}}>{l}</span>;})}</div>
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
       <span {...act(()=>shiftDay(-1))} style={{width:30,height:30,border:`1px solid ${LINE}`,borderRadius:8,display:"grid",placeItems:"center",cursor:"pointer",color:P.muted}}>‹</span><span {...act(()=>shiftDay(1))} style={{width:30,height:30,border:`1px solid ${LINE}`,borderRadius:8,display:"grid",placeItems:"center",cursor:"pointer",color:P.muted}}>›</span>
       <b style={{fontSize:15}}>{fechaLarga}</b><span {...act(()=>setDay(todayStr))} style={{border:`1px solid ${isTodaySel?P.purple:LINE}`,color:isTodaySel?P.purple:P.ink,borderRadius:8,padding:"6px 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Hoy</span>
       <span style={{marginLeft:"auto",fontSize:12.5,color:P.muted}}>{agLoaded?`${realAppts.length} cita(s)`:"cargando…"}</span>
      </div>
      {agendaView==="lista"?(
       <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Hora","Paciente","Motivo","Consultorio","Estado"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:P.muted,fontWeight:600,padding:"11px 14px",borderBottom:`1px solid ${LINE}`}}>{h}</th>)}</tr></thead><tbody>
        {realAppts.length===0?<tr><td colSpan={5} style={{padding:"36px 14px",textAlign:"center",color:P.muted,fontSize:13}}>{agendaErr?<span>No se pudo cargar la agenda. <button onClick={()=>void reloadAgenda()} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:8,padding:"5px 12px",fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:UI,marginLeft:6}}>Reintentar</button></span>:agLoaded?"Sin citas para este día. Usa «+ Nueva cita» para agendar.":"Cargando agenda…"}</td></tr>:realAppts.map(a=>{const st=ST[a.status]??["",P.canvas,P.muted];const on=a.appointmentId===apptSel;return <tr key={a.appointmentId} {...actRow(()=>setApptSel(a.appointmentId))} style={{cursor:"pointer",background:on?"#F6F5FE":"transparent"}}>
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
       {[[P.greenOnPale,"Consultorio 1","Consulta general"],["#1769E0","Consultorio 2","Procedimientos"],["#6C5CF6","Consultorio 3","Control y seguimiento"]].map(([c,t,s],i)=><div key={i} style={{padding:"12px 14px",borderBottom:`1px solid ${LINE}`,borderRight:i<2?`1px solid ${LINE}`:"0",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:7}}>{gdot(c as string)}<div>{t as string}<span style={{fontSize:11,color:P.muted,fontWeight:400,display:"block",marginTop:1}}>{s as string}</span></div></div>)}
       {hours.map((h,ri)=>{const last=ri===hours.length-1;return <Fragment key={h}>
        <div style={{borderRight:`1px solid ${LINE}`,borderBottom:last?"0":`1px solid #F2F4F9`,padding:"6px 8px",fontSize:11.5,color:P.muted,textAlign:"right",height:56}}>{hLabel(h)}</div>
        {slot(apAt(col1,h))}{slot(apAt(col2,h))}{slot(apAt(col3,h),true)}
       </Fragment>;})}
       {isTodaySel&&<div style={{position:"absolute",left:70,right:0,top:nowTop,height:2,background:P.redOnPale,zIndex:5}}><span style={{position:"absolute",left:0,top:-9,background:P.redOnPale,color:"#fff",fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:5}}>{horaAhora}</span></div>}
      </div>
      <div style={{display:"flex",gap:18,flexWrap:"wrap",padding:"14px 16px",fontSize:12,color:P.muted}}>{[["#1769E0","Consulta general"],[P.greenOnPale,"Control / Seguimiento"],["#6C5CF6","Primera vez"],[P.amberOnPale,"Procedimiento"],["#8B7DF8","Vacunación"],[P.cyan,"Resultados"],["#F0455E","Urgencia"]].map(([c,l])=><span key={l} style={{display:"flex",alignItems:"center",gap:7}}>{gdot(c as string)}{l as string}</span>)}</div>
      </>)}
     </div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:16}} className="mos-agr">
     <div style={{...card2,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,fontWeight:700}}><span>{meses[mm]!.replace(/^\w/,c=>c.toUpperCase())} {yy}</span><span style={{color:P.muted,display:"flex",gap:10}}><span {...act(()=>shiftMonth(-1))} style={{cursor:"pointer"}}>‹</span><span {...act(()=>shiftMonth(1))} style={{cursor:"pointer"}}>›</span></span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,textAlign:"center",fontSize:12}}>
       {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d=><span key={d} style={{padding:"7px 0",color:P.muted,fontWeight:600}}>{d}</span>)}
       {Array.from({length:firstDow}).map((_,i)=><span key={"e"+i}/>)}
       {Array.from({length:daysInM}).map((_,i)=>{const day=i+1;const isSel=day===dd;const isToday=new Date(yy,mm,day,12).toISOString().slice(0,10)===todayStr;return <span key={day} {...act(()=>pickDay(day))} style={{padding:"7px 0",borderRadius:7,cursor:"pointer",background:isSel?P.purple:"transparent",color:isSel?"#fff":P.ink,fontWeight:isSel||isToday?700:400,outline:isToday&&!isSel?`1px solid ${P.purple}`:"none"}}>{day}</span>;})}
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
       {(selAppt.status==="SCHEDULED"||selAppt.status==="CHECKED_IN")&&<div style={{display:"flex",gap:8}}><button onClick={()=>void apptTransition(selAppt.appointmentId,selAppt.version,"cancellation","Cita cancelada.")} disabled={apptBusy} style={{flex:1,border:"1px solid #F3C9C9",background:P.white,color:P.redOnPale,borderRadius:9,padding:9,fontWeight:600,fontSize:12.5,cursor:apptBusy?"default":"pointer",fontFamily:UI}}>Cancelar</button>{selAppt.status==="SCHEDULED"&&<button onClick={()=>void apptTransition(selAppt.appointmentId,selAppt.version,"no-show","Marcada como inasistencia.")} disabled={apptBusy} style={{flex:1,border:`1px solid ${LINE}`,background:P.white,color:P.muted,borderRadius:9,padding:9,fontWeight:600,fontSize:12.5,cursor:apptBusy?"default":"pointer",fontFamily:UI}}>Inasistencia</button>}</div>}
      </div>
     </div>;})()}
     <div style={card2}><div style={{display:"flex",justifyContent:"space-between",padding:"16px 16px 10px"}}><span style={sect}>Resumen del día</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"0 16px 16px"}}>
       {([["#EEEBFD",P.purpleOnPale,"M4 5h16v16H4zM8 3v4M16 3v4",agLoaded?agenda!.counts.programadas:0,"Programadas"],["#E6F6EE",P.greenOnPale,"M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z",agLoaded?agenda!.counts.atendidas:0,"Atendidas"],["#FBF0DC",P.amberOnPale,"M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0",agLoaded?agenda!.counts.enEspera:0,"En espera"],["#FDECEE",P.redOnPale,"M9 9l6 6M15 9l-6 6M21 12a9 9 0 11-18 0 9 9 0 0118 0",agLoaded?agenda!.counts.canceladas:0,"Canc./Inasist."]] as const).map(([bg,fg,d,v,l])=><div key={l} style={{display:"flex",gap:11,alignItems:"center",padding:12,border:`1px solid ${LINE}`,borderRadius:12}}>{rkico(bg,fg,d)}<div><div style={{fontSize:20,fontWeight:800}}>{v}</div><div style={{fontSize:11,color:P.muted}}>{l}</div></div></div>)}
      </div>
     </div>
     {(()=>{const prox=realAppts.filter(a=>a.status==="SCHEDULED"||a.status==="CHECKED_IN");return <div style={card2}><div style={{display:"flex",justifyContent:"space-between",padding:"16px 16px 6px"}}><span style={sect}>Próximas citas</span>{prox.length>0&&<span style={link} {...act(()=>setAgendaView("lista"))}>Ver lista →</span>}</div>
      {prox.slice(0,5).map(a=><div key={a.appointmentId} {...act(()=>setApptSel(a.appointmentId))} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 16px",borderTop:`1px solid #F1F3F9`,cursor:"pointer",background:a.appointmentId===apptSel?"#F6F5FE":"transparent"}}><span style={{fontSize:13,color:P.muted,width:64,flex:"0 0 auto"}}>{tHM(a.startAt)}</span><span style={{width:34,height:34,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,flex:"0 0 auto"}}>{(a.patientName||"P").trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()}</span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13}}>{a.patientName}</div><div style={{fontSize:11.5,color:P.muted}}>{a.reason}</div></div><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",...(a.status==="CHECKED_IN"?{background:"#FBF0DC",color:P.amberOnPale}:{background:"#EAF1FD",color:P.blueOnPale})}}>{stLabel(a.status)}</span></div>)}
      {prox.length===0&&<div style={{padding:"14px 16px",fontSize:12.5,color:P.muted,borderTop:`1px solid #F1F3F9`}}>{agendaErr?"No se pudo cargar la agenda.":agLoaded?"Sin próximas citas para este día. Agenda una con «+ Nueva cita».":"Cargando agenda…"}</div>}</div>;})()}
    </div>
   </div>;
  
}
