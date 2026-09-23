"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "obligaciones" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.

import{card,LINE,P,UI}from"../shared";
import{useWorkspace}from"../context";
export default function ObligacionesView(){
 const{regObSnap,oblTab,setOblNew,setOblMsg,oblNew,oblMsg,oblForm,setOblForm,createRegObligation,oblBusy,setOblTab}=useWorkspace();

   // ===== MÓDULO OBLIGACIONES (S-OBLIGACIONES) — obligaciones regulatorias del consultorio cableadas a GET /regulatory-obligations =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const fmtD=(iso:string|null)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const oblLoaded=!!regObSnap;
   type ORow={name:string;category:string;periodicity:string;date:string;estado:string};
   const allRows:ORow[]=(regObSnap?.items??[]).map(it=>({name:it.name,category:it.category,periodicity:it.periodicity,date:fmtD(it.dueDate),estado:it.estado}));
   const CATMAP:Record<string,string>={fiscales:"Fiscal (SAT)",salud:"Salud (COFEPRIS)",laborales:"Laboral",proteccion:"Protección civil",administrativas:"Administrativa",otros:"Otros"};
   const rows=allRows.filter(r=>oblTab==="todas"||r.category===CATMAP[oblTab]);
   const total=regObSnap?.total??0;
   const kAl=regObSnap?.alDia??0,kProx=regObSnap?.proximas??0,kVenc=regObSnap?.vencidas??0;
   const pct=(n:number)=>total?Math.round(n/total*100):0;
   const compliance:[string,number][]=regObSnap?Object.entries(regObSnap.compliance):[];
   const estSty=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={["Al día"]:["#E6F6EE","#16A66A"],["Próxima"]:["#FBF0DC","#B7791F"],Vencida:["#FDECEE","#C9364A"],Vigente:["#E7EEFB","#1769E0"]};const[b,f]=m[k]??m["Al día"]!;return{background:b,color:f,borderRadius:8,padding:"4px 12px",fontSize:12.5,fontWeight:700,whiteSpace:"nowrap"};};
   const kico=(bg:string,fg:string,d:string)=><span style={{width:48,height:48,borderRadius:"50%",background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:P.muted,fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
   const tdc:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,whiteSpace:"nowrap"};
   const OBL_TABS:[typeof oblTab,string][]=[["todas","Todas"],["fiscales","Fiscales (SAT)"],["salud","Salud (COFEPRIS)"],["laborales","Laborales"],["proteccion","Protección civil"],["administrativas","Administrativas"],["otros","Otros"]];
   const fileIco="M6 2h9l5 5v15H6zM14 2v6h6";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 5h14v14H5zM9 12l2 2 4-4"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Obligaciones</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Cumple y da seguimiento a las obligaciones legales, fiscales y normativas de tu consultorio.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setOblNew(v=>!v);setOblMsg(null);}}>{oblNew?"Cerrar":"+ Agregar obligación"}</button></div>
    </div>
    {oblMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:oblMsg.includes("✓")?"#F0FBF4":"#EEF6FF",border:`1px solid ${oblMsg.includes("✓")?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:oblMsg.includes("✓")?P.green:P.blue,fontWeight:700}}>{oblMsg.includes("✓")?"✓":"ℹ"}</span><span style={{flex:1}}>{oblMsg}</span><button onClick={()=>setOblMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {oblNew&&<div style={{...card2,marginTop:14,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>Nueva obligación del consultorio</div>
     <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14}} className="mos-med2">
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Nombre</div><input value={oblForm.name} onChange={e=>setOblForm({...oblForm,name:e.target.value})} placeholder="Ej. Declaración mensual de IVA" style={selSty}/></div>
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Categoría</div><select value={oblForm.category} onChange={e=>setOblForm({...oblForm,category:e.target.value})} style={selSty}>{["Fiscal (SAT)","Salud (COFEPRIS)","Laboral","Protección civil","Administrativa","Otros"].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
     </div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:12}}>
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Periodicidad</div><select value={oblForm.periodicity} onChange={e=>setOblForm({...oblForm,periodicity:e.target.value})} style={selSty}>{["Mensual","Trimestral","Semestral","Anual","Cada 5 años","Única"].map(p=><option key={p} value={p}>{p}</option>)}</select></div>
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Fecha límite (opcional)</div><input type="date" value={oblForm.dueDate} onChange={e=>setOblForm({...oblForm,dueDate:e.target.value})} style={selSty}/></div>
     </div>
     <div style={{fontSize:11.5,color:P.muted,marginTop:8}}>El estado (Al día / Próxima / Vencida) se <b>computa</b> de la fecha límite; sin fecha se marca <b>Vigente</b>.</div>
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void createRegObligation()} disabled={oblBusy||!oblForm.name.trim()} style={{border:0,background:(oblBusy||!oblForm.name.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(oblBusy||!oblForm.name.trim())?"default":"pointer",fontFamily:UI}}>{oblBusy?"Agregando…":"Agregar obligación"}</button><button onClick={()=>setOblNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#E6F6EE","#16A66A","M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{kAl}</div><div style={{fontSize:11.5,color:P.muted}}>Al día</div><div style={{fontSize:11,color:P.muted,fontWeight:600}}>{pct(kAl)}% del total</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#FBF0DC",P.amber,"M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{kProx}</div><div style={{fontSize:11.5,color:P.muted}}>Próximas a vencer</div><div style={{fontSize:11,color:P.muted,fontWeight:600}}>{pct(kProx)}% del total</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#FDECEE",P.red,"M12 9v4M12 17h.01M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{kVenc}</div><div style={{fontSize:11.5,color:P.muted}}>Vencidas</div><div style={{fontSize:11,color:P.muted,fontWeight:600}}>{pct(kVenc)}% del total</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#E7EEFB",P.blue,"M8 2v4M16 2v4M4 8h16M5 6h14v14H5z")}<div><div style={{fontSize:24,fontWeight:800}}>{total}</div><div style={{fontSize:11.5,color:P.muted}}>Total de obligaciones</div></div></div>
    </div>
    <div style={{...card2,marginTop:16,padding:"0 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
     <div style={{display:"flex",gap:4,overflowX:"auto"}}>{OBL_TABS.map(([k,l])=><button key={k} onClick={()=>setOblTab(k)} style={{padding:"14px 12px",fontSize:13.5,fontWeight:oblTab===k?700:500,color:oblTab===k?P.purple:P.muted,borderBottom:oblTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>{l}</button>)}</div>
    </div>
    <div style={{marginTop:16}} className="mos-obl">
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{padding:"14px 16px",fontSize:16,fontWeight:800}}>Obligaciones ({rows.length})</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr><th style={th}>Nombre</th><th style={th}>Categoría</th><th style={th}>Periodicidad</th><th style={th}>Próxima fecha</th><th style={{...th,textAlign:"right"}}>Estado</th></tr></thead>
       <tbody>{rows.map((r,i)=>{const c=r.estado==="Vencida"?P.red:r.estado==="Próxima"?P.amber:P.green;return <tr key={i}><td style={tdc}><div style={{display:"flex",alignItems:"center",gap:9}}><span style={{color:c,flex:"0 0 auto"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={fileIco}/></svg></span><span style={{fontWeight:600,color:P.ink}}>{r.name}</span></div></td><td style={{...tdc,color:P.muted}}>{r.category}</td><td style={{...tdc,color:P.muted}}>{r.periodicity}</td><td style={{...tdc,color:P.muted}}>{r.date}</td><td style={{...tdc,textAlign:"right"}}><span style={estSty(r.estado)}>{r.estado}</span></td></tr>;})}
       {rows.length===0&&<tr><td colSpan={5} style={{...tdc,textAlign:"center",color:P.muted,padding:"30px"}}>{oblLoaded?(allRows.length===0?"Sin obligaciones registradas. Usa «+ Agregar obligación».":"Sin obligaciones en esta categoría."):"Cargando obligaciones…"}</td></tr>}
       </tbody></table></div>
      {rows.length>0&&<div style={{padding:"13px 16px",fontSize:13,color:P.muted}}>Mostrando {rows.length} de {total} obligación(es)</div>}
     </div>
    </div>
    <div style={{marginTop:16}} className="mos-obl2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8,marginBottom:12}}>▨ Cumplimiento por categoría</div>{compliance.length===0?<div style={{fontSize:12.5,color:P.muted}}>Sin obligaciones registradas para calcular cumplimiento.</div>:compliance.map(([l,n],i)=>{const c=n>=80?"#16A66A":n>=50?"#E5983B":"#C9364A";return <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><span style={{width:130,fontSize:12,color:P.ink}}>{l}</span><div style={{flex:1,height:7,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${n}%`,background:c,borderRadius:6}}/></div><span style={{fontSize:12,fontWeight:700,width:36,textAlign:"right"}}>{n}%</span></div>;})}</div>
    </div>
   </div>;
  
}
