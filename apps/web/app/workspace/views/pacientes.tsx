"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "pacientes" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import{card,P,LINE,UI,actRow,scrollTop,Skeleton}from"../shared";
import{useWorkspace}from"../context";
export default function PacientesView(){
 const{patientList,topSearch,patStatus,patSex,selectPatientRaw,setPatMsg,setPatNew,patNew,patMsg,regName,setRegName,regDob,setRegDob,regSex,setRegSex,regExtra,setRegExtra,guardianFields,dupPanel,registerPatient,busy,setTopSearch,setPatStatus,setPatSex,setExpTab,setPatientId}=useWorkspace();

   // ===== VISTA PACIENTES — lista real (+ alta). Es el estado "sin paciente" del Expediente: seleccionar abre el
   // expediente del paciente directamente (su pestaña Resumen es la ficha). La edición de datos vive en Expediente ›
   // Administración › Paciente; el seguimiento clínico, en la pestaña Seguimiento/Resumen del expediente. =====
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
   // Fusión Pacientes⟷Expediente (decisión del dueño "abrir el Expediente directo"): seleccionar un paciente abre su
   // EXPEDIENTE en la pestaña Resumen (que ES su ficha). Ya no hay ficha-preview intermedia que duplique el expediente;
   // esta vista es la LISTA (+ alta) y vive como estado "sin paciente" del expediente (ver exp.tsx). La edición de datos
   // del paciente vive ahora en el Expediente › Administración › Paciente.
   const selectRow=(r:Row)=>{selectPatientRaw(r.patientId,r.name);setExpTab("resumen");scrollTop();};
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
      <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
       {/* Flujo clínico natural: registrar al paciente y abrir de inmediato su consulta (registerPatient con openInConsulta). */}
       <button onClick={()=>registerPatient(true,false,true)} disabled={busy==="pt-reg"||!regName.trim()||!regDob} style={{border:0,background:(busy==="pt-reg"||!regName.trim()||!regDob)?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(busy==="pt-reg"||!regName.trim()||!regDob)?"default":"pointer",fontFamily:UI}}>{busy==="pt-reg"?"Registrando…":"Registrar e iniciar consulta"}</button>
       <button onClick={()=>registerPatient(true)} disabled={busy==="pt-reg"||!regName.trim()||!regDob} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:(busy==="pt-reg"||!regName.trim()||!regDob)?"default":"pointer",opacity:(busy==="pt-reg"||!regName.trim()||!regDob)?.6:1,fontFamily:UI}}>Solo registrar</button>
       <button onClick={()=>setPatNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
     </div>}
     <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:14,marginTop:18}} className="mos-kpis">
      <div style={kcard}>{kico("#EEEBFD","M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M16 4.5a3 3 0 010 6M22 20a6 6 0 00-5-5.9",P.purple)}<div><div style={{fontSize:12.5,color:P.muted}}>Total de pacientes</div><div style={{fontSize:24,fontWeight:800}}>{loading?<Skeleton w={52} h={22}/>:total.toLocaleString("es-MX")}</div></div></div>
      <div style={kcard}>{kico("#E6F6EE","M8.5 12l2.5 2.5 5-5M12 21a9 9 0 100-18 9 9 0 000 18z",P.green)}<div><div style={{fontSize:12.5,color:P.muted}}>Pacientes activos</div><div style={{fontSize:24,fontWeight:800}}>{loading?<Skeleton w={68} h={22}/>:<>{activos.toLocaleString("es-MX")} <span style={{fontSize:12,color:P.green,fontWeight:600}}>● {total?Math.round(activos/total*100):0}%</span></>}</div></div></div>
      <div style={kcard}>{kico("#E7EEFB","M6 2h12l-1 6H7zM5 8h14l-1 12H6z",P.blue)}<div><div style={{fontSize:12.5,color:P.muted}}>{anyFilter?"Coinciden con el filtro":"En el registro"}</div><div style={{fontSize:24,fontWeight:800}}>{loading?<Skeleton w={40} h={22}/>:rows.length}</div></div></div>
      <div style={kcard}>{kico("#EEF0F5","M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0",P.muted)}<div><div style={{fontSize:12.5,color:P.muted}}>Inactivos</div><div style={{fontSize:24,fontWeight:800}}>{loading?<Skeleton w={40} h={22}/>:(total-activos).toLocaleString("es-MX")}</div></div></div>
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
       ):rows.map(r=>{const[stl,sbg,sfg]=stTag(r.status);return <tr key={r.patientId} {...actRow(()=>selectRow(r))} style={{background:"transparent",cursor:"pointer",borderLeft:"3px solid transparent"}}>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`}}><div style={{display:"flex",alignItems:"center",gap:11}}><span style={{width:38,height:38,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontSize:12.5,fontWeight:700,flex:"0 0 auto"}}>{initials(r.name)}</span><div><div style={{fontWeight:600,fontSize:13.5}}>{r.name}</div><div style={{fontSize:11,color:P.muted}}>CURP: {r.curp}</div></div></div></td>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,fontSize:13}}>{r.age!=null?`${r.age} años`:"—"}</td>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,fontSize:13}}>{sexEs(r.sexo)}</td>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,textAlign:"right"}}><span style={{fontSize:11.5,fontWeight:600,borderRadius:999,padding:"3px 11px",background:sbg,color:sfg}}>{stl}</span></td>
        <td style={{padding:"12px 16px",borderBottom:`1px solid #F2F4F9`,textAlign:"right"}}><span style={{color:P.blue,fontWeight:600,fontSize:12.5,cursor:"pointer"}} onClick={e=>{e.stopPropagation();selectRow(r);}}>Abrir expediente ›</span></td>
       </tr>;})}</tbody>
      </table></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",fontSize:13,color:P.muted,flexWrap:"wrap",gap:10}}>
       <span>Mostrando {rows.length} de {total.toLocaleString("es-MX")} pacientes{anyFilter?" (filtrado)":""}</span>
      </div>
     </div>
     {/* Fallback para dependencia caída (padrón no disponible): abrir el expediente por ID. Al fijar patientId se monta el
         expediente; si la carga falla, el aviso honesto de error del layout se hace cargo (lo prueba ui-clinical-truth). */}
     <div style={{marginTop:14,padding:"12px 14px",border:`1px dashed ${LINE}`,borderRadius:12,background:"#FBFBFE",maxWidth:460}}>
      <label htmlFor="patient-id-input" style={{fontSize:12,fontWeight:700,color:P.muted,display:"block",marginBottom:6}}>¿El padrón no carga? Abre el expediente por ID de paciente</label>
      <input id="patient-id-input" aria-label="ID de paciente" defaultValue="" onChange={e=>{const v=e.target.value.trim();if(/^[0-9a-f-]{36}$/i.test(v)){selectPatientRaw(v,"");setPatientId(v);setExpTab("resumen");}}} placeholder="UUID del paciente" style={{...inp,maxWidth:360}}/>
     </div>
    </div>
   </div>;
  
}
