"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "vacunas" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.

import{edadDe,card,P,LINE,UI,actRow,scrollToSection}from"../shared";
import{useWorkspace}from"../context";
export default function VacunasView(){
 const{immReg,immStatusF,immSearch,immSel,setVacNew,setVacMsg,vacNew,vacMsg,vacForm,setVacForm,patientList,createImmunizationInline,vacBusy,setImmSearch,setImmStatusF,setImmSel,selectPatientRaw,setView}=useWorkspace();

   // ===== MÓDULO VACUNAS (S-VACUNAS) — registro clínica-wide cableado a GET /api/v1/immunizations =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"14px 0 6px"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const fmtD=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const estSty=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={Completa:["#E6F6EE","#16A66A"],Pendiente:["#FBF0DC","#B7791F"],Rechazada:["#FDECEE","#C9364A"],["Evento adverso"]:["#FDECEE","#C9364A"]};const[bg,fg]=m[k]??m.Pendiente!;return{background:bg,color:fg,borderRadius:16,padding:"3px 11px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"};};
   const immLoaded=!!immReg;
   type VRow={id:string;pid:string;date:string;patient:string;age:string;vaccine:string;dose:string;lot:string;estado:string;site:string};
   const allRows:VRow[]=(immReg?.items??[]).map((it,i)=>({id:it.immunizationId||`v${i}`,pid:it.patientId,date:fmtD(it.appliedAt),patient:it.patientName,age:edadDe(patientList,it.patientId),vaccine:it.vaccine,dose:it.dose,lot:it.lot||"—",estado:it.statusLabel,site:it.site||"—"}));
   const rows=allRows.filter(r=>(immStatusF==="Todos"||r.estado===immStatusF)&&(!immSearch||`${r.patient} ${r.vaccine} ${r.lot}`.toLowerCase().includes(immSearch.toLowerCase())));
   const selv:VRow|null=rows[immSel]??rows[0]??null;
   const total=immReg?.total??0;
   const kVac=immReg?.vaccinatedPatients??0,kPend=immReg?.pendingCount??0,kApl=immReg?.appliedCount??0,kInc=immReg?.incompleteSchemes??0;
   const pendientes=allRows.filter(r=>r.estado==="Pendiente");
   const covEntries:[string,number][]=immReg?Object.entries(immReg.byVaccine).sort((a,b)=>b[1]-a[1]).slice(0,7):[];
   const covTotal=covEntries.reduce((s,[,n])=>s+n,0)||1;
   const COVC=["#F0455E","#6C5CF6","#1769E0","#E5983B","#20B7D9","#16A66A","#6B7191"];
   let cAcc=0;const covStops=covEntries.map(([,n],i)=>{const a=cAcc/covTotal*100;cAcc+=n;const b=cAcc/covTotal*100;return `${COVC[i%COVC.length]} ${a}% ${b}%`;}).join(",");
   const complete=selv?.estado==="Completa";
   const kico=(bg:string,fg:string,d:string)=><span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:16,display:"flex",gap:13,alignItems:"center"};
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:P.muted,fontWeight:600,padding:"11px 10px",borderBottom:`1px solid ${LINE}`};
   const tdc:React.CSSProperties={padding:"10px 10px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,verticalAlign:"middle"};
   const chk2=(on:boolean,l:string,tog:()=>void)=><label key={l} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,padding:"5px 0",cursor:"pointer"}} onClick={tog}><span style={{width:16,height:16,borderRadius:4,border:on?"0":"1.6px solid #C7CCE0",background:on?P.purple:"transparent",display:"grid",placeItems:"center",color:"#fff",fontSize:10,flex:"0 0 auto"}}>{on?"✓":""}</span>{l}</label>;
   const syringe="M14 4l6 6M17 7l-9 9-4 1 1-4 9-9zM3 21l3-1";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={syringe}/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Vacunas</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Registra, consulta y da seguimiento al esquema de vacunación de tus pacientes.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setVacNew(v=>!v);setVacMsg(null);}}>{vacNew?"Cerrar":"+ Registrar vacuna"}</button>
     </div>
    </div>
    {vacMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:vacMsg.includes("✓")?"#F0FBF4":"#EEF6FF",border:`1px solid ${vacMsg.includes("✓")?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:vacMsg.includes("✓")?P.green:P.blue,fontWeight:700}}>{vacMsg.includes("✓")?"✓":"ℹ"}</span><span style={{flex:1}}>{vacMsg}</span><button onClick={()=>setVacMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {vacNew&&<div style={{...card2,marginTop:14,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>Registrar vacuna</div>
     <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:14}} className="mos-med2">
      <div><div style={{...flbl,margin:"0 0 6px"}}>Paciente</div><select value={vacForm.patientId} onChange={e=>setVacForm({...vacForm,patientId:e.target.value})} style={selSty}><option value="">Selecciona…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select></div>
      <div><div style={{...flbl,margin:"0 0 6px"}}>Vacuna</div><input value={vacForm.vaccineCode} onChange={e=>setVacForm({...vacForm,vaccineCode:e.target.value})} placeholder="Ej. Influenza" style={selSty}/></div>
      <div><div style={{...flbl,margin:"0 0 6px"}}>Dosis</div><input value={vacForm.dose} onChange={e=>setVacForm({...vacForm,dose:e.target.value})} placeholder="1/1" style={selSty}/></div>
     </div>
     <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>{["Influenza","SRP","Neumococo 13V","Hexavalente","Hepatitis B","Tdap","COVID-19","Herpes zóster"].map(v=><button key={v} onClick={()=>setVacForm(f=>({...f,vaccineCode:v}))} style={vacForm.vaccineCode===v?{border:`1px solid ${P.purple}`,background:"#EEEBFD",color:P.purple,borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:UI}:{border:`1px solid ${LINE}`,background:P.white,color:P.ink,borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:UI}}>{v}</button>)}</div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:12}}>
      <div><div style={{...flbl,margin:"0 0 6px"}}>Lote (opcional — para aplicar ya)</div><input value={vacForm.lot} onChange={e=>setVacForm({...vacForm,lot:e.target.value})} placeholder="Ej. A3F2K" style={selSty}/></div>
      <div><div style={{...flbl,margin:"0 0 6px"}}>Sitio de aplicación</div><select value={vacForm.site} onChange={e=>setVacForm({...vacForm,site:e.target.value})} style={selSty}><option>Brazo izquierdo</option><option>Brazo derecho</option><option>Muslo izquierdo</option><option>Muslo derecho</option><option>Glúteo</option></select></div>
     </div>
     <div style={{fontSize:11.5,color:P.muted,marginTop:8}}>Sin lote se registra como <b>pendiente</b>; con lote y sitio se marca <b>aplicada</b> en el acto.</div>
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void createImmunizationInline()} disabled={vacBusy||!vacForm.patientId||!vacForm.vaccineCode.trim()} style={{border:0,background:(vacBusy||!vacForm.patientId||!vacForm.vaccineCode.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(vacBusy||!vacForm.patientId||!vacForm.vaccineCode.trim())?"default":"pointer",fontFamily:UI}}>{vacBusy?"Registrando…":"Registrar vacuna"}</button><button onClick={()=>setVacNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z")}<div><div style={{fontSize:24,fontWeight:800}}>{kVac}</div><div style={{fontSize:11.5,color:P.muted}}>Pacientes vacunados (en control)</div></div></div>
     <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{kPend}</div><div style={{fontSize:11.5,color:P.muted}}>Dosis pendientes</div></div></div>
     <div style={kcard}>{kico("#E6F6EE","#16A66A","M20 6L9 17l-5-5")}<div><div style={{fontSize:24,fontWeight:800}}>{kApl}</div><div style={{fontSize:11.5,color:P.muted}}>Dosis aplicadas (total)</div></div></div>
     <div style={kcard}>{kico("#FDECEE",P.red,"M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01")}<div><div style={{fontSize:24,fontWeight:800}}>{kInc}</div><div style={{fontSize:11.5,color:P.muted}}>Esquemas incompletos</div></div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"240px 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-vac">
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:15,fontWeight:700}}>Filtros</div><button onClick={()=>{setImmSearch("");setImmStatusF("Todos");}} style={{border:0,background:"transparent",color:P.blue,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:UI}}>Limpiar</button></div>
      <div style={{position:"relative",marginTop:10}}><input value={immSearch} onChange={e=>{setImmSearch(e.target.value);setImmSel(0);}} placeholder="Buscar paciente, vacuna o lote..." style={{...selSty,padding:"9px 11px 9px 32px"}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" style={{position:"absolute",left:10,top:11}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div>
      <div style={flbl}>Estado</div><select value={immStatusF} onChange={e=>{setImmStatusF(e.target.value);setImmSel(0);}} style={selSty}>{["Todos","Completa","Pendiente","Rechazada"].map(o=><option key={o}>{o}</option>)}</select>
      <div style={{marginTop:14,borderTop:`1px solid ${LINE}`,paddingTop:10}}>{chk2(immStatusF==="Pendiente","Solo esquemas incompletos",()=>{setImmStatusF(immStatusF==="Pendiente"?"Todos":"Pendiente");setImmSel(0);})}</div>
      <div style={{marginTop:14,fontSize:12,color:P.muted}}>{rows.length} de {allRows.length} registro(s)</div>
     </div>
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px"}}><div style={{fontSize:16,fontWeight:800}}>Vacunación ({rows.length})</div></div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr><th style={th}>Fecha</th><th style={th}>Paciente</th><th style={th}>Vacuna</th><th style={th}>Dosis</th><th style={th}>Lote</th><th style={th}>Estado</th></tr></thead>
       <tbody>{rows.map((r,i)=>{const on=i===immSel;return <tr key={r.id} {...actRow(()=>setImmSel(i))} style={{cursor:"pointer",background:on?"#F7F6FE":"transparent"}}>
        <td style={{...tdc,color:P.muted,whiteSpace:"nowrap"}}>{r.date}</td>
        <td style={tdc}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:26,height:26,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>{initials(r.patient)}</span><div style={{minWidth:0}}><div style={{fontSize:12.5,fontWeight:600,whiteSpace:"nowrap"}}>{r.patient}</div>{r.age&&<div style={{fontSize:10.5,color:P.muted}}>{r.age}</div>}</div></div></td>
        <td style={{...tdc,fontWeight:600}}>{r.vaccine}</td>
        <td style={tdc}>{r.dose}</td>
        <td style={{...tdc,color:P.muted}}>{r.lot}</td>
        <td style={tdc}><span style={estSty(r.estado)}>{r.estado}</span></td>
       </tr>;})}
       {rows.length===0&&<tr><td colSpan={6} style={{...tdc,textAlign:"center",color:P.muted,padding:"30px"}}>{immLoaded?(allRows.length===0?"Sin vacunas registradas. Usa «+ Registrar vacuna».":"Ninguna vacuna coincide con los filtros."):"Cargando registro…"}</td></tr>}
       </tbody></table></div>
      {rows.length>0&&<div style={{padding:"13px 16px",fontSize:13,color:P.muted}}>Mostrando {rows.length} de {allRows.length} registro(s)</div>}
     </div>
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:`1px solid ${LINE}`}}><div style={{fontSize:15,fontWeight:800}}>Detalle de la vacuna</div></div>
      {!selv?<div style={{padding:"40px 16px",textAlign:"center",color:P.muted,fontSize:13}}>{allRows.length===0?"Registra una vacuna con «+ Registrar vacuna».":"Selecciona un registro de la lista para ver su detalle."}</div>:<div style={{padding:"14px 16px"}}>
       <div style={{display:"flex",gap:11,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:14,fontWeight:700,flex:"0 0 auto"}}>{initials(selv.patient)}</span><div><div style={{fontWeight:700,fontSize:14.5}}>{selv.patient}</div><div style={{fontSize:11.5,color:P.muted}}>Expediente: {selv.pid.slice(0,8).toUpperCase()}</div></div></div>
       <div style={{display:"flex",gap:10,alignItems:"center",marginTop:14,justifyContent:"space-between"}}><div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{width:38,height:38,borderRadius:10,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={syringe}/></svg></span><div><div style={{fontWeight:700,fontSize:14}}>{selv.vaccine}</div></div></div><span style={estSty(selv.estado)}>{selv.estado}</span></div>
       <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:9,fontSize:12.5}}>
        {[["Fecha de aplicación",selv.date],["Dosis",selv.dose],["Lote",selv.lot],["Sitio de aplicación",selv.site],["Estado",selv.estado]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",gap:10}}><span style={{color:P.muted}}>{k}</span><span style={{fontWeight:600,textAlign:"right"}}>{v}</span></div>)}
       </div>
       {complete&&<div style={{marginTop:12,display:"flex",gap:9,padding:"11px 13px",borderRadius:11,background:"#EEF4FF",border:"1px solid #D3E1FB"}}><span style={{color:P.blue}}>✓</span><div><div style={{fontWeight:700,fontSize:12.5}}>Dosis aplicada</div><div style={{fontSize:12,color:P.muted,marginTop:2}}>{selv.vaccine} · dosis {selv.dose} registrada como aplicada.</div></div></div>}
       <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>{selectPatientRaw(selv.pid,selv.patient);setView("exp");setTimeout(()=>scrollToSection("Vacunas"),0);}} style={{flex:1,border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"9px",fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>Ver en el expediente →</button></div>
      </div>}
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginTop:16,alignItems:"start"}} className="mos-vac2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Dosis por vacuna</div><div style={{display:"flex",gap:14,alignItems:"center"}}><div style={{width:100,height:100,borderRadius:"50%",flex:"0 0 auto",display:"grid",placeItems:"center",background:kApl>0&&covStops?`conic-gradient(${covStops})`:"#EEF0F5"}}><div style={{width:64,height:64,borderRadius:"50%",background:P.white,display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:16,fontWeight:800}}>{kApl}</div><div style={{fontSize:9,color:P.muted}}>dosis aplicadas</div></div></div></div><div style={{flex:1}}>{covEntries.length===0?<div style={{fontSize:12.5,color:P.muted}}>Sin vacunas registradas.</div>:covEntries.map(([l,n],i)=><div key={l} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,padding:"3px 0"}}><span style={{width:8,height:8,borderRadius:"50%",background:COVC[i%COVC.length]}}/>{l}<b style={{marginLeft:"auto"}}>{Math.round(n/covTotal*100)}%</b></div>)}</div></div></div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Estado de vacunación</div>{([["Completa",allRows.filter(r=>r.estado==="Completa").length,"#16A66A"],["Pendiente",allRows.filter(r=>r.estado==="Pendiente").length,"#E5983B"],["Rechazada",allRows.filter(r=>r.estado==="Rechazada").length,"#C9364A"]] as [string,number,string][]).map(([l,n,c])=>{const p=allRows.length?Math.round(n/allRows.length*100):0;return <div key={l} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:4}}><span>{l}</span><b>{n} ({p}%)</b></div><div style={{height:8,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${p}%`,background:c,borderRadius:6}}/></div></div>;})}{allRows.length===0&&<div style={{fontSize:12.5,color:P.muted}}>Sin registros.</div>}</div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:10}}>Dosis pendientes ({pendientes.length})</div>{pendientes.length===0?<div style={{fontSize:12.5,color:P.muted}}>Sin dosis pendientes en el registro.</div>:pendientes.slice(0,6).map(r=><div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid #F2F4F9`}}><span style={{width:30,height:30,borderRadius:9,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={syringe}/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:12.5}}>{r.vaccine} · {r.dose}</div><div style={{fontSize:11,color:P.muted}}>{r.patient}</div></div></div>)}</div>
    </div>
   </div>;
  
}
