"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "pacientes" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import {apiRequest} from "../../../lib/session-client";
import {useState} from "react";
import{card,P,LINE,UI,errMsg,userMessage,actRow,act,DX_LABEL,scrollToSection,scrollTop,TYPE_LABEL,Skeleton}from"../shared";
import{useWorkspace}from"../context";
export default function PacientesView(){
 // Ley de Hick — divulgación progresiva del formulario de edición: la identidad (nombre, nacimiento, sexo, CURP) siempre
 // visible; el contacto y los datos socio-demográficos (teléfono, correo, dirección, ocupación, estado civil) se despliegan
 // bajo demanda, y se muestran de entrada si el paciente YA tiene alguno (editar un dato existente nunca queda oculto).
 const[moreEdit,setMoreEdit]=useState(false);
 const{patientList,topSearch,patStatus,patSex,setPatSelId,selectPatientRaw,setPatTab,setPatEdit,setPatMsg,patSelId,patientId,snap,docsSnap,setPatNew,patNew,patMsg,regName,setRegName,regDob,setRegDob,regSex,setRegSex,regExtra,setRegExtra,guardianFields,dupPanel,registerPatient,busy,gaps,setTopSearch,setPatStatus,setPatSex,patEdit,openEdit,patTab,editForm,setEditForm,amendPatient,editBusy,setView,openConsulta,setApptForm,setApptNew,setAgendaDate,tl,setDocNew}=useWorkspace();

   // ===== VISTA PACIENTES — lista real + FICHA contextual (sólo al seleccionar) con pestañas en sitio y edición real =====
   const ageOf=(bd?:string):number|null=>{if(!bd)return null;const b=new Date(bd),n=new Date();let y=n.getFullYear()-b.getFullYear();if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))y--;return y;};
   const sexAbbr=(s?:string)=>s==="FEMALE"?"F":s==="MALE"?"M":s==="INTERSEX"?"I":"—";
   const sexEs=(s?:string)=>s==="F"||s==="FEMALE"?"Femenino":s==="M"||s==="MALE"?"Masculino":s==="I"||s==="INTERSEX"?"Intersexual":"—";
   const initials=(n:string)=>n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()||"P";
   type Row={patientId:string;name:string;status:string;age:number|null;sexo:string;curp:string};
   const real=(patientList??[]).map(p=>({patientId:p.patientId,name:p.name,status:p.status,age:ageOf(p.birthDate),sexo:sexAbbr(p.sexAtBirth),curp:p.curp||"—"}));
   // Solo pacientes REALES del tenant. Sin filas de ejemplo (evita clics inertes): si no hay, estado vacío honesto.
   const loading=patientList===null;const allRows:Row[]=real;
   const total=allRows.length;const activos=allRows.filter(r=>r.status==="ACTIVE").length;
   const q=topSearch.trim().toLowerCase();
   const rows=allRows.filter(r=>(!q||r.name.toLowerCase().includes(q)||r.curp.toLowerCase().includes(q))&&(!patStatus||r.status===patStatus)&&(!patSex||r.sexo===patSex));
   const anyFilter=!!q||!!patStatus||!!patSex;
   const stTag=(s:string):[string,string,string]=>s==="ACTIVE"?["Activo","#E6F6EE",P.greenOnPale]:["Inactivo","#EEF0F5",P.muted];
   const kico=(bg:string,d:string,st:string)=>(<span style={{width:42,height:42,borderRadius:11,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={st} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d}/></svg></span>);
   const kcard:React.CSSProperties={...card,marginTop:0,padding:16,display:"flex",gap:13,alignItems:"center"};
   const selSty:React.CSSProperties={display:"inline-flex",alignItems:"center",gap:7,background:P.white,border:`1px solid ${LINE}`,borderRadius:10,padding:"9px 12px",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:UI,color:P.ink};
   const dk:React.CSSProperties={color:P.muted,width:140,flex:"0 0 auto",fontSize:12.5};
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"};
   const inp:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink,boxSizing:"border-box"};
   const selectRow=(r:Row)=>{setPatSelId(r.patientId);selectPatientRaw(r.patientId,r.name);setPatTab("resumen");setPatEdit(false);};
   const exportSelected=async(pid:string,name:string)=>{setPatMsg(`Generando export del expediente de ${name}…`);try{const resp=await apiRequest(`/api/v1/patients/${pid}/export`,{method:"GET"});if(resp.status>=400){setPatMsg(errMsg(resp));return;}const m=resp.body["manifest"] as{aggregateCount:number;eventCount:number};setPatMsg(`Export de ${name}: ${m.aggregateCount} agregados · ${m.eventCount} eventos · hash ${String(resp.body["contentHash"]??"").slice(0,12)}…`);}catch(e){setPatMsg(userMessage(e));}};
   // Paciente en foco (la ficha SÓLO existe si hay selección real):
   const fp=patSelId?(patientList??[]).find(p=>p.patientId===patSelId):undefined;
   const fAge=ageOf(fp?.birthDate);const fresh=patientId===patSelId; // snapshot/timeline/docs corresponden al paciente en foco
   const sd=fresh?snap?.demographics:undefined;
   const fmtDT=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);if(isNaN(d.getTime()))return"—";const now=Date.now(),diff=(now-d.getTime())/1000;if(diff<3600)return `hace ${Math.max(1,Math.round(diff/60))} min`;if(diff<86400)return `hace ${Math.round(diff/3600)} h`;return d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const fmtDate=(iso?:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const KIND_ES:Record<string,string>={REGISTERED:"Registrado",SIGNED:"Firmado",PROPOSED:"Propuesto",ACTIVATED:"Activado",PRESCRIBED:"Prescrito",RECEIVED:"Recibido",VERIFIED:"Verificado",ACTIONED:"En acción",CLOSED:"Cerrado",CREATED:"Creado",PLACED:"Enviado",FULFILLED:"Cumplido",CANCELLED:"Cancelado",SCHEDULED:"Agendado",CHECKED_IN:"En espera",COMPLETED:"Completado",OPEN:"Abierta",RESOLVED:"Resuelta",DUE:"Pendiente",ADMINISTERED:"Aplicada",RECORDED:"Registrado",AMENDED:"Corregido"};
   const notesDocs=(docsSnap?.items??[]).filter(d=>/nota/i.test(d.typeLabel));
   const allDocs=docsSnap?.items??[];
   return <div style={{display:"flex",minHeight:"100%",alignItems:"stretch"}}>
    <div style={{flex:1,minWidth:0,padding:"22px 24px 40px"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Pacientes</h1><p style={{color:P.muted,fontSize:13.5,margin:"6px 0 0"}}>Gestiona, busca y da seguimiento a todos tus pacientes.</p></div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
       <button style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setPatNew(v=>!v);setPatMsg(null);}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 5v14M5 12h14"/></svg>{patNew?"Cerrar":"Nuevo paciente"}</button>
      </div>
     </div>
     {patMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:patMsg.includes("✓")?"#F0FBF4":"#EEF6FF",border:`1px solid ${patMsg.includes("✓")?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:patMsg.includes("✓")?P.green:P.blue,fontWeight:700}}>{patMsg.includes("✓")?"✓":"ℹ"}</span><span style={{flex:1}}>{patMsg}</span><button onClick={()=>setPatMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
     {patNew&&<div style={{...card,marginTop:14,padding:18}}>
      <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>Nuevo paciente</div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:14}} className="mos-med2">
       <div><div style={flbl}>Nombre completo</div><input aria-label="Nombre completo" value={regName} onChange={e=>setRegName(e.target.value)} placeholder="Ej. María Fernández López" style={inp}/></div>
       <div><div style={flbl}>Fecha de nacimiento</div><input type="date" aria-label="Fecha de nacimiento" value={regDob} onChange={e=>setRegDob(e.target.value)} style={inp}/></div>
       <div><div style={flbl}>Sexo</div><select aria-label="Sexo del paciente" value={regSex} onChange={e=>setRegSex(e.target.value)} style={inp}><option value="FEMALE">Femenino</option><option value="MALE">Masculino</option><option value="INTERSEX">Intersexual</option><option value="UNKNOWN">Sin especificar</option></select></div>
      </div>
      <div style={{marginTop:12,maxWidth:360}}><div style={flbl}>CURP (opcional; se valida el dígito verificador)</div><input aria-label="CURP" value={regExtra.curp} onChange={e=>setRegExtra({...regExtra,curp:e.target.value.toUpperCase()})} placeholder="18 caracteres" maxLength={18} style={inp}/></div>
      {guardianFields(inp)}{dupPanel(true)}
      <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>registerPatient(true)} disabled={busy==="pt-reg"||!regName.trim()} style={{border:0,background:(busy==="pt-reg"||!regName.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(busy==="pt-reg"||!regName.trim())?"default":"pointer",fontFamily:UI}}>{busy==="pt-reg"?"Registrando…":"Registrar paciente"}</button><button onClick={()=>setPatNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
     </div>}
     <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:14,marginTop:18}} className="mos-kpis">
      <div style={kcard}>{kico("#EEEBFD","M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M16 4.5a3 3 0 010 6M22 20a6 6 0 00-5-5.9",P.purple)}<div><div style={{fontSize:12.5,color:P.muted}}>Total de pacientes</div><div style={{fontSize:24,fontWeight:800}}>{loading?<Skeleton w={52} h={22}/>:total.toLocaleString("es-MX")}</div></div></div>
      <div style={kcard}>{kico("#E6F6EE","M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z",P.green)}<div><div style={{fontSize:12.5,color:P.muted}}>Pacientes activos</div><div style={{fontSize:24,fontWeight:800}}>{loading?<Skeleton w={68} h={22}/>:<>{activos.toLocaleString("es-MX")} <span style={{fontSize:12,color:P.green,fontWeight:600}}>● {total?Math.round(activos/total*100):0}%</span></>}</div></div></div>
      <div style={kcard}>{kico("#E7EEFB","M6 2h12l-1 6H7zM5 8h14l-1 12H6z",P.blue)}<div><div style={{fontSize:12.5,color:P.muted}}>{anyFilter?"Coinciden con el filtro":"En el registro"}</div><div style={{fontSize:24,fontWeight:800}}>{loading?<Skeleton w={40} h={22}/>:rows.length}</div></div></div>
      <div style={kcard}>{kico("#FDECEE","M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z",P.red)}<div><div style={{fontSize:12.5,color:P.muted}}>En seguimiento</div><div style={{fontSize:24,fontWeight:800}}>{(patSelId&&patientId===patSelId)?(gaps?.length??0):"—"}</div></div></div>
     </div>
     <div style={{display:"flex",gap:10,alignItems:"center",marginTop:16,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:200,display:"flex",alignItems:"center",gap:9,background:P.white,border:`1px solid ${LINE}`,borderRadius:10,padding:"9px 13px"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" strokeLinecap="round"/></svg><input placeholder="Buscar por nombre o CURP…" aria-label="Buscar paciente" value={topSearch} onChange={e=>setTopSearch(e.target.value)} style={{border:0,outline:"none",background:"transparent",fontSize:13.5,fontFamily:UI,flex:1,color:P.ink}}/></div>
      <select aria-label="Filtrar por estado" value={patStatus} onChange={e=>setPatStatus(e.target.value)} style={selSty}><option value="">Estado: Todos</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option></select>
      <select aria-label="Filtrar por sexo" value={patSex} onChange={e=>setPatSex(e.target.value)} style={selSty}><option value="">Sexo: Todos</option><option value="F">Femenino</option><option value="M">Masculino</option></select>
      {anyFilter&&<button onClick={()=>{setTopSearch("");setPatStatus("");setPatSex("");}} style={{...selSty,color:P.blue,fontWeight:600}}>Limpiar filtros</button>}
     </div>
     <div style={{...card,marginTop:14,overflow:"hidden"}}>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr>{["Paciente","Edad","Sexo","Estado","Acciones"].map((h,i)=><th key={i} style={{textAlign:i>=3?"right":"left",fontSize:11.5,color:P.muted,fontWeight:600,padding:"12px 16px",borderBottom:`1px solid ${LINE}`,background:"#FAFBFD"}}>{h}</th>)}</tr></thead>
       <tbody>{loading?Array.from({length:6}).map((_,i)=><tr key={`sk${i}`} aria-hidden><td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`}}><div style={{display:"flex",alignItems:"center",gap:11}}><Skeleton w={38} h={38} r={99}/><div style={{flex:1}}><Skeleton w={150} h={13}/><Skeleton w={110} h={11} style={{marginTop:6}}/></div></div></td><td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`}}><Skeleton w={48} h={12}/></td><td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`}}><Skeleton w={60} h={12}/></td><td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,textAlign:"right"}}><Skeleton w={58} h={18} r={99} style={{marginLeft:"auto"}}/></td><td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,textAlign:"right"}}><Skeleton w={70} h={12} style={{marginLeft:"auto"}}/></td></tr>):rows.length===0?(
        <tr><td colSpan={5} style={{padding:"44px 16px",textAlign:"center",color:P.muted,fontSize:13.5}}>{allRows.length===0?<span>Aún no hay pacientes registrados. Usa <b style={{color:P.ink}}>«Nuevo paciente»</b> para crear el primero.</span>:"Ningún paciente coincide con la búsqueda o el filtro."}</td></tr>
       ):rows.map(r=>{const[stl,sbg,sfg]=stTag(r.status);const on=r.patientId===patSelId;return <tr key={r.patientId} {...actRow(()=>selectRow(r))} style={{background:on?"#F6F5FE":"transparent",cursor:"pointer",borderLeft:on?`3px solid ${P.purple}`:"3px solid transparent"}}>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`}}><div style={{display:"flex",alignItems:"center",gap:11}}><span style={{width:38,height:38,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:12.5,fontWeight:700,flex:"0 0 auto"}}>{initials(r.name)}</span><div><div style={{fontWeight:600,fontSize:13.5}}>{r.name}</div><div style={{fontSize:11,color:P.muted}}>CURP: {r.curp}</div></div></div></td>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,fontSize:13}}>{r.age!=null?`${r.age} años`:"—"}</td>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,fontSize:13}}>{sexEs(r.sexo)}</td>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,textAlign:"right"}}><span style={{fontSize:11.5,fontWeight:600,borderRadius:999,padding:"3px 11px",background:sbg,color:sfg}}>{stl}</span></td>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,textAlign:"right"}}><span style={{color:P.blue,fontWeight:600,fontSize:12.5,cursor:"pointer"}} onClick={e=>{e.stopPropagation();selectRow(r);}}>{on?"En ficha ›":"Abrir ficha ›"}</span></td>
       </tr>;})}</tbody>
      </table></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",fontSize:13,color:P.muted,flexWrap:"wrap",gap:10}}>
       <span>Mostrando {rows.length} de {total.toLocaleString("es-MX")} pacientes{anyFilter?" (filtrado)":""}</span>
      </div>
     </div>
    </div>
    {/* FICHA — sólo cuando hay un paciente seleccionado (real) */}
    {fp&&<aside style={{flex:"0 0 400px",borderLeft:`1px solid ${LINE}`,background:P.white,minHeight:"100%",display:"flex",flexDirection:"column"}} className="mos-detail">
     <div style={{padding:"20px 22px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
       <div style={{display:"flex",gap:13,minWidth:0}}><span style={{width:56,height:56,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontWeight:800,fontSize:20,flex:"0 0 auto"}}>{initials(fp.name)}</span><div style={{minWidth:0}}><div style={{fontSize:18,fontWeight:800,lineHeight:1.15}}>{fp.name}</div><div style={{fontSize:12.5,color:P.muted,marginTop:2}}>{fAge!=null?`${fAge} años · `:""}{sexEs(fp.sexAtBirth)}</div>{(()=>{const[stl,sbg,sfg]=stTag(fp.status);return <span style={{display:"inline-flex",alignItems:"center",gap:6,background:sbg,color:sfg,borderRadius:999,padding:"2px 10px",fontSize:11.5,fontWeight:700,marginTop:6}}>● {stl}</span>;})()}</div></div>
       <div style={{display:"flex",gap:6,flex:"0 0 auto"}}>{!patEdit&&<button onClick={()=>openEdit(fp.patientId)} title="Editar ficha" style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"7px 11px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI,display:"inline-flex",alignItems:"center",gap:6}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 20h9M16.5 3.5a2 2 0 013 3L7 19l-4 1 1-4z"/></svg>Editar</button>}<button onClick={()=>setPatSelId(null)} title="Cerrar ficha" style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,width:32,height:32,cursor:"pointer",color:P.muted,fontFamily:UI}}>×</button></div>
      </div>
      {!patEdit&&<div style={{display:"flex",gap:16,borderBottom:`1px solid ${LINE}`,marginTop:16}}>{([["resumen","Resumen"],["historial","Historial"],["notas","Notas"],["documentos","Documentos"]] as const).map(([k,l])=><span key={k} {...act(()=>setPatTab(k))} style={{fontSize:13.5,color:patTab===k?P.purple:P.muted,fontWeight:patTab===k?700:500,paddingBottom:10,borderBottom:patTab===k?`2px solid ${P.purple}`:"2px solid transparent",cursor:"pointer"}}>{l}</span>)}</div>}
     </div>
     <div style={{padding:"16px 22px 24px",overflowY:"auto",flex:1}}>
      {patEdit?(
       <div>
        <div style={{fontSize:15,fontWeight:800,marginBottom:14}}>Editar ficha del paciente</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
         <div><div style={flbl}>Nombre completo</div><input aria-label="Nombre completo" value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} style={inp}/></div>
         <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><div style={flbl}>Fecha de nacimiento</div><input type="date" aria-label="Fecha de nacimiento" value={editForm.birthDate} onChange={e=>setEditForm({...editForm,birthDate:e.target.value})} style={inp}/></div><div><div style={flbl}>Sexo</div><select aria-label="Sexo del paciente (edición)" value={editForm.sexAtBirth} onChange={e=>setEditForm({...editForm,sexAtBirth:e.target.value})} style={inp}><option value="FEMALE">Femenino</option><option value="MALE">Masculino</option><option value="INTERSEX">Intersexual</option><option value="UNKNOWN">Sin especificar</option></select></div></div>
         <div><div style={flbl}>CURP</div><input aria-label="CURP" value={editForm.curp} onChange={e=>setEditForm({...editForm,curp:e.target.value.toUpperCase()})} style={inp}/></div>
         {(()=>{const hasMore=!!(editForm.phone||editForm.email||editForm.address||editForm.occupation||editForm.maritalStatus);const show=moreEdit||hasMore;return show?<>
          <div style={{fontSize:12,fontWeight:700,color:P.muted,marginTop:2}}>Contacto y datos socio-demográficos</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><div style={flbl}>Teléfono</div><input aria-label="Teléfono" value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})} style={inp}/></div><div><div style={flbl}>Correo</div><input aria-label="Correo electrónico" value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})} style={inp}/></div></div>
          <div><div style={flbl}>Dirección</div><input aria-label="Dirección" value={editForm.address} onChange={e=>setEditForm({...editForm,address:e.target.value})} style={inp}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><div style={flbl}>Ocupación</div><input aria-label="Ocupación" value={editForm.occupation} onChange={e=>setEditForm({...editForm,occupation:e.target.value})} style={inp}/></div><div><div style={flbl}>Estado civil</div><input aria-label="Estado civil" value={editForm.maritalStatus} onChange={e=>setEditForm({...editForm,maritalStatus:e.target.value})} style={inp}/></div></div>
         </>:<button type="button" onClick={()=>setMoreEdit(true)} style={{alignSelf:"flex-start",border:`1px solid ${LINE}`,background:P.white,color:P.purple,borderRadius:9,padding:"9px 13px",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:UI}}>+ Contacto y datos socio-demográficos</button>;})()}
        </div>
        <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void amendPatient(fp.patientId)} disabled={editBusy||!editForm.name.trim()} style={{flex:1,border:0,background:(editBusy||!editForm.name.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px",fontWeight:700,fontSize:14,cursor:(editBusy||!editForm.name.trim())?"default":"pointer",fontFamily:UI}}>{editBusy?"Guardando…":"Guardar cambios"}</button><button onClick={()=>setPatEdit(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 16px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
       </div>
      ):patTab==="resumen"?(
       <div>
        <div style={{fontSize:13.5,fontWeight:800,margin:"0 0 10px"}}>Información general</div>
        {[["Fecha de nacimiento",sd?.birthDate?`${fmtDate(sd.birthDate)}${fAge!=null?` (${fAge} años)`:""}`:(fAge!=null?`${fAge} años`:"—")],["Sexo",sexEs(fp.sexAtBirth)],["CURP",fp.curp||"—"],["Teléfono",sd?.phone||"—"],["Correo",sd?.email||"—"],["Dirección",sd?.address||"—"],["Ocupación",sd?.occupation||"—"],["Estado civil",sd?.maritalStatus||"—"]].map(([k,v])=><div key={k} style={{display:"flex",fontSize:13,padding:"5px 0",borderBottom:"1px solid #F6F7FB"}}><span style={dk}>{k}</span><span style={{fontWeight:500}}>{v}</span></div>)}
        {!fresh&&<div style={{fontSize:11.5,color:P.muted,marginTop:8}}>Cargando datos del paciente…</div>}
        <div style={{fontSize:13.5,fontWeight:800,margin:"18px 0 10px"}}>Antecedentes relevantes</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
         <div style={{display:"flex",gap:10,padding:"9px 11px",borderRadius:10,background:"#FDECEE"}}><span style={{color:P.redOnPale,fontWeight:800,fontSize:12,minWidth:78}}>Alergias</span><span style={{fontSize:12.5,color:"#7a1f2b"}}>{sd&&snap?.allergies.length?snap.allergies.join(", "):"Sin alergias conocidas"}</span></div>
         <div style={{display:"flex",gap:10,padding:"9px 11px",borderRadius:10,background:"#EEEBFD"}}><span style={{color:P.purpleOnPale,fontWeight:800,fontSize:12,minWidth:78}}>Problemas</span><span style={{fontSize:12.5,color:"#3a2f7a"}}>{sd&&snap?.problems.length?snap.problems.map(DX_LABEL).slice(0,4).join(", "):"Sin problemas activos"}</span></div>
         <div style={{display:"flex",gap:8}}>{([["Medicamentos","Medicación"],["Vacunas","Vacunas"]] as const).map(([l,h2])=><button key={l} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection(h2),0);}} style={{flex:1,border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px",fontSize:12.5,fontWeight:600,color:P.ink,cursor:"pointer",fontFamily:UI}}>{l} →</button>)}</div>
        </div>
        <div style={{fontSize:13.5,fontWeight:800,margin:"18px 0 10px"}}>Acciones</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
         <button onClick={()=>openConsulta(fp.patientId,fp.name)} style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"11px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Ver consulta</button>
         <div style={{display:"flex",gap:9}}>
          <button onClick={()=>{setApptForm(f=>({...f,patientId:fp.patientId}));setApptNew(true);setAgendaDate(new Date().toISOString().slice(0,10));setView("agenda");scrollTop();}} style={{flex:1,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>Agendar cita</button>
          <button onClick={()=>void exportSelected(fp.patientId,fp.name)} style={{flex:1,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>Exportar</button>
         </div>
        </div>
       </div>
      ):patTab==="historial"?(
       <div>
        <div style={{fontSize:13.5,fontWeight:800,margin:"0 0 12px"}}>Historial del expediente</div>
        {!fresh?<div style={{fontSize:12.5,color:P.muted}}>Cargando historial…</div>:(tl&&tl.length)?<div style={{position:"relative",paddingLeft:18}}><div style={{position:"absolute",left:4,top:6,bottom:6,width:2,background:"#EDEFF6"}}/>{tl.slice(0,20).map((it,i)=><div key={i} style={{position:"relative",padding:"9px 0"}}><span style={{position:"absolute",left:-18,top:12,width:9,height:9,borderRadius:"50%",background:P.purple,border:"2px solid #fff",boxShadow:"0 0 0 1px "+P.purple}}/><div style={{display:"flex",justifyContent:"space-between",gap:8}}><span style={{fontSize:13,fontWeight:600}}>{TYPE_LABEL[it.aggregateType]??it.aggregateType}</span><span style={{fontSize:11,color:P.muted,whiteSpace:"nowrap"}}>{fmtDT(it.lastAt)}</span></div><div style={{fontSize:12,color:P.muted}}>{KIND_ES[it.latestKind]??it.latestKind} · v{it.version}</div></div>)}</div>:<div style={{fontSize:12.5,color:P.muted,padding:"20px 0",textAlign:"center"}}>Sin eventos en el expediente de este paciente todavía.</div>}
       </div>
      ):patTab==="notas"?(
       <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"0 0 12px"}}><div style={{fontSize:13.5,fontWeight:800}}>Notas clínicas</div><button onClick={()=>{selectPatientRaw(fp.patientId,fp.name);setView("documentos");setDocNew(true);}} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:8,padding:"5px 10px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:UI}}>+ Nueva</button></div>
        {!fresh?<div style={{fontSize:12.5,color:P.muted}}>Cargando notas…</div>:notesDocs.length?notesDocs.map((d,i)=><div key={i} style={{display:"flex",gap:10,padding:"11px 0",borderBottom:"1px solid #F2F4F9"}}><span style={{color:P.blue,flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z"/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600}}>{d.title}</div><div style={{fontSize:11.5,color:P.muted}}>{d.typeLabel} · {fmtDate(d.createdAt)}</div></div></div>):<div style={{fontSize:12.5,color:P.muted,padding:"20px 0",textAlign:"center"}}>Sin notas clínicas para este paciente.</div>}
       </div>
      ):(
       <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"0 0 12px"}}><div style={{fontSize:13.5,fontWeight:800}}>Documentos ({allDocs.length})</div><button onClick={()=>{selectPatientRaw(fp.patientId,fp.name);setView("documentos");setDocNew(true);}} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:8,padding:"5px 10px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:UI}}>+ Nuevo</button></div>
        {!fresh?<div style={{fontSize:12.5,color:P.muted}}>Cargando documentos…</div>:allDocs.length?allDocs.map((d,i)=><div key={i} style={{display:"flex",gap:10,padding:"11px 0",borderBottom:"1px solid #F2F4F9"}}><span style={{color:P.red,flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2h9l5 5v15H6zM14 2v6h6"/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600}}>{d.title}</div><div style={{fontSize:11.5,color:P.muted}}>{d.typeLabel} · {fmtDate(d.createdAt)}</div></div></div>):<div style={{fontSize:12.5,color:P.muted,padding:"20px 0",textAlign:"center"}}>Sin documentos para este paciente.</div>}
       </div>
      )}
     </div>
    </aside>}
   </div>;
  
}
