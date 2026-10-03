"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "seguimiento" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.

import{card,LINE,P,UI,Skeleton}from"../shared";
import{useWorkspace}from"../context";
export default function SeguimientoView(){
 const{fuSnap,setView,openConsulta,patientName,patientSelector,patientId,panel,patientList,selectPatientRaw}=useWorkspace();

   // ===== MÓDULO SEGUIMIENTO (S-SEGUIMIENTO) — snapshot compuesto cableado a GET /patients/:id/follow-up =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const clip="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z";
   const fuLoaded=!!fuSnap;
   const counts=fuSnap?fuSnap.counts:{problems:0,medications:0,allergies:0};
   const fmtDue=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?iso:d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const spark=(vals:number[],color:string)=>{
    // Auditoría R05b-22: un valor no finito (NaN de un parseo del servidor) volvía NaN el mínimo y el máximo, y el
    // trazo salía VACÍO sin decir nada: una serie clínica ausente que parecía una serie plana. Se usan solo los
    // valores finitos y, si no queda ninguno, no se dibuja nada en vez de dibujar una línea inventada.
    const finitos=vals.filter(v=>Number.isFinite(v));if(!finitos.length)return null;vals=finitos;
    const w=140,h=40,pad=4;const mn=Math.min(...vals),mx=Math.max(...vals),rng=(mx-mn)||1;const step=vals.length>1?(w-pad*2)/(vals.length-1):0;
    const pt=(v:number,i:number):[number,number]=>[pad+i*step,h-pad-((v-mn)/rng)*(h-pad*2)];
    const d=vals.map((v,i)=>{const[x,y]=pt(v,i);return `${i===0?"M":"L"}${x.toFixed(1)} ${y.toFixed(1)}`;}).join(" ");
    return <svg width={w} height={h} style={{display:"block"}} aria-hidden><path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>{vals.map((v,i)=>{const[x,y]=pt(v,i);return <circle key={i} cx={x} cy={y} r={2.5} fill="#fff" stroke={color} strokeWidth={1.5}/>;})}</svg>;};
   // Tendencia de signos vitales (real o representativa)
   const sBP=fuSnap?.vitalsTrend.series.BP??[];
   const sHR=fuSnap?.vitalsTrend.series.HR??[];
   const sWT=fuSnap?.vitalsTrend.series.WEIGHT??[];
   const sIMC=fuSnap?.vitalsTrend.series.IMC??[];
   const av=fuSnap?fuSnap.vitalsTrend.avg:{ta:"—",bp:0,hr:0,weight:0,imc:0};
   const hasTrend=sBP.length>0||sHR.length>0||sWT.length>0||sIMC.length>0;
   const trend=(title:string,unit:string,vals:number[],val:string,foot:string,c:string)=><div style={{border:`1px solid ${LINE}`,borderRadius:12,padding:13}}><div style={{fontSize:12.5,fontWeight:700,lineHeight:1.1}}>{title}<div style={{fontSize:10.5,color:P.muted,fontWeight:500}}>{unit}</div></div><div style={{marginTop:8}}>{spark(vals,c)}</div><div style={{fontSize:21,fontWeight:800,marginTop:6}}>{val}</div><div style={{fontSize:11.5,color:P.muted}}>{foot}</div></div>;
   // Indicadores clave
   const ind=fuSnap?fuSnap.indicators:null;
   const indRows:[string,string,string,number,number,boolean][]=ind?[
    ...(ind.hba1c?[["M9 3h6l1 4H8zM7 7h10l1 13H6z",P.red,"HbA1c",ind.hba1c.first,ind.hba1c.last,ind.hba1c.last<ind.hba1c.first] as [string,string,string,number,number,boolean]]:[]),
    ...(ind.ldl?[["M12 3v18M3 12h18",P.amber,"LDL",ind.ldl.first,ind.ldl.last,ind.ldl.last<ind.ldl.first] as [string,string,string,number,number,boolean]]:[]),
    ...(ind.weight?[["M20 7h-9M14 17H5",P.green,"Peso",ind.weight.first,ind.weight.last,ind.weight.last<ind.weight.first] as [string,string,string,number,number,boolean]]:[]),
    ...(ind.imc?[["M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v8",P.blue,"IMC",ind.imc.first,ind.imc.last,ind.imc.last<ind.imc.first] as [string,string,string,number,number,boolean]]:[]),
   ]:[];
   const kpiRow=(ico:string,c:string,l:string,f:number,x:number,down:boolean)=><div key={l} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 0",borderBottom:`1px solid #F2F4F9`}}><span style={{width:30,height:30,borderRadius:8,background:c+"22",color:c,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={ico}/></svg></span><div style={{width:52,fontSize:13,fontWeight:700}}>{l}</div><div style={{flex:1,fontSize:12.5,fontWeight:600,whiteSpace:"nowrap",textAlign:"right"}}>{f} <span style={{color:P.muted}}>›</span> {x}</div><span style={{color:down?P.greenOnPale:P.redOnPale,fontWeight:800}}>{down?"↓":"↑"}</span></div>;
   // Tareas de seguimiento (reales del snapshot)
   const tasks=fuSnap?.tasks??[];
   const chipCard=(c:string,d:string,n:number,l:string)=><div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}><span style={{width:32,height:32,borderRadius:9,background:c+"22",color:c,display:"grid",placeItems:"center"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={d}/></svg></span><div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{n}</div><div style={{fontSize:11,color:P.muted}}>{l}</div></div></div>;
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={clip}/><path d="M9 13l2 2 4-4"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Seguimiento</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Da seguimiento continuo a la evolución clínica de tus pacientes.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 16px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>patientId?openConsulta(patientId,patientName):setView("exp")}>+ Nuevo seguimiento</button>
     </div>
    </div>
    <div style={{...card2,marginTop:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"center",gap:13,minWidth:0}}><span style={{width:48,height:48,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:15,fontWeight:700,flex:"0 0 auto"}}>{initials(patientName||"—")}</span><div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:16}}>{patientSelector}</div><div style={{fontSize:12.5,color:P.muted}}>{patientId?"Seguimiento clínico del paciente en contexto":"Selecciona un paciente en el buscador superior para ver su seguimiento"}</div></div></div>
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>{chipCard(P.blue,clip,counts.problems,"Problemas activos")}{chipCard(P.green,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z",counts.medications,"Medicamentos")}{chipCard(P.red,"M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",counts.allergies,counts.allergies===1?"Alergia":"Alergias")}<button onClick={()=>setView("exp")} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver expediente →</button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:16,marginTop:16,alignItems:"start"}} className="mos-seg">
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:16}}><div style={{fontSize:15.5,fontWeight:800,marginBottom:12}}>Tendencia de signos vitales</div>{patientId&&!fuLoaded?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}} aria-hidden>{Array.from({length:4}).map((_,i)=><div key={i} style={{border:`1px solid ${LINE}`,borderRadius:12,padding:13}}><Skeleton w={"55%"} h={12}/><Skeleton w={140} h={40} style={{marginTop:8}}/><Skeleton w={64} h={18} style={{marginTop:8}}/><Skeleton w={"70%"} h={10} style={{marginTop:6}}/></div>)}</div>:hasTrend?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{trend("Presión arterial","(mmHg) · promedio",sBP,av.ta||"—","Promedio del periodo",P.blue)}{trend("Frecuencia cardíaca","(lpm) · promedio",sHR,av.hr?String(av.hr):"—","Promedio del periodo",P.red)}{trend("Peso","(kg) · promedio",sWT,av.weight?String(av.weight):"—","Promedio del periodo",P.green)}{trend("IMC","(kg/m²) · promedio",sIMC,av.imc?String(av.imc):"—","Promedio del periodo",P.purple)}</div>:<div style={{fontSize:12.5,color:P.muted}}>{patientId?"Sin signos vitales registrados para graficar tendencias.":"Selecciona un paciente para ver sus tendencias."}</div>}</div>
      <div style={{...card2,padding:16}}><div style={{fontSize:15.5,fontWeight:800,marginBottom:6}}>Indicadores clave <span style={{fontSize:11.5,fontWeight:500,color:P.muted}}>(primer → último valor)</span></div>{patientId&&!fuLoaded?<div aria-hidden>{Array.from({length:4}).map((_,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 0",borderBottom:`1px solid #F2F4F9`}}><Skeleton w={30} h={30} r={8}/><Skeleton w={52} h={13}/><div style={{flex:1,textAlign:"right"}}><Skeleton w={80} h={12} style={{marginLeft:"auto"}}/></div><Skeleton w={12} h={14}/></div>)}</div>:indRows.length===0?<div style={{fontSize:12.5,color:P.muted,paddingTop:6}}>Sin indicadores con dos o más mediciones. Se derivan de resultados y signos vitales.</div>:indRows.map(([ico,c,l,f,x,down])=>kpiRow(ico,c,l,f,x,down))}</div>
     </div>
     {/* Columna derecha: tareas reales del seguimiento */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,display:"flex",alignItems:"center",gap:8,marginBottom:10}}>✔ Tareas de seguimiento{tasks.length>0?` (${tasks.length})`:""}</div>{patientId&&!fuLoaded?<div aria-hidden>{Array.from({length:4}).map((_,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<3?`1px solid #F2F4F9`:"0"}}><Skeleton w={17} h={17} r={5}/><Skeleton w={"70%"} h={12}/><Skeleton w={70} h={10} style={{marginLeft:"auto"}}/></div>)}</div>:tasks.length===0?<div style={{fontSize:12.5,color:P.muted}}>{patientId?"Sin tareas de seguimiento abiertas. Se generan desde las obligaciones del expediente.":"Selecciona un paciente."}</div>:tasks.map((t,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<tasks.length-1?`1px solid #F2F4F9`:"0"}}><span style={{width:17,height:17,borderRadius:5,border:t.done?"0":"1.7px solid #C7CCE0",background:t.done?P.purple:"transparent",color:"#fff",display:"grid",placeItems:"center",fontSize:10,flex:"0 0 auto"}}>{t.done?"✓":""}</span><span style={{flex:1,fontSize:13,color:t.done?P.muted:P.ink,textDecoration:t.done?"line-through":"none"}}>{t.task}</span>{t.blocksSignature&&<span title="Mientras esté sin resolver no se puede firmar la consulta de este paciente. Complétela con evidencia o cancélela con motivo." style={{background:"#FDEEEE",color:"#8C1D18",border:"1px solid #F3C9C9",borderRadius:999,padding:"2px 8px",fontSize:10.5,fontWeight:800,whiteSpace:"nowrap"}}>{t.blocksSignature==="URGENT"?"URGENTE":t.blocksSignature==="OVERDUE"?"VENCIDA":"SIN FECHA VÁLIDA"} · bloquea la firma</span>}<span style={{fontSize:11.5,color:P.muted,textDecoration:t.done?"line-through":"none",whiteSpace:"nowrap"}}>📅 {fmtDue(t.dueAt)}</span></div>)}</div>
     </div>
    </div>
    {/* Lote F — seguimiento POBLACIONAL: pendientes clínicos accionables de TODOS los pacientes (GET /api/v1/worklist). */}
    {(()=>{
     const th:React.CSSProperties={textAlign:"left",fontSize:11,color:P.muted,fontWeight:600,padding:"9px 12px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
     const tdc:React.CSSProperties={padding:"9px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,verticalAlign:"middle"};
     const gaps=panel?.gaps??[];
     const nameOf=(pid:string)=>patientList?.find(p=>p.patientId===pid)?.name??pid.slice(0,8).toUpperCase();
     const high=gaps.filter(g=>g.priority==="HIGH").length;
     const prSty=(pr:string):React.CSSProperties=>{const m:Record<string,[string,string]>={HIGH:["#FDECEE",P.redOnPale],MEDIUM:["#FBF0DC",P.amberOnPale],LOW:["#EEF0FF","#3f3aa0"]};const[b,f]=m[pr]??m.LOW!;return{background:b,color:f,borderRadius:999,padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"};};
     return <div style={{...card2,marginTop:16,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",borderBottom:`1px solid ${LINE}`,flexWrap:"wrap",gap:10}}>
       <div><div style={{fontSize:16,fontWeight:800}}>Seguimiento · Toda la clínica</div><div style={{fontSize:12,color:P.muted}}>Pendientes clínicos accionables de todos los pacientes del consultorio, priorizados. Reglas, sin IA.</div></div>
       {panel?<div style={{display:"flex",gap:18,flexWrap:"wrap"}}>{([["Pendientes",gaps.length,P.ink],["Prioritarios",high,P.redOnPale],["Pacientes",panel.patientCount,P.purple]] as [string,number,string][]).map(([l,n,c])=><div key={l} style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:800,color:c,fontVariantNumeric:"tabular-nums"}}>{n}</div><div style={{fontSize:11,color:P.muted}}>{l}</div></div>)}</div>:<div style={{display:"flex",gap:18,flexWrap:"wrap"}} aria-hidden>{["Pendientes","Prioritarios","Pacientes"].map(l=><div key={l} style={{textAlign:"right"}}><Skeleton w={36} h={18} style={{marginLeft:"auto"}}/><div style={{fontSize:11,color:P.muted,marginTop:4}}>{l}</div></div>)}</div>}
      </div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr>{["Paciente","Pendiente","Prioridad",""].map((h,i)=><th key={i} style={th}>{h}</th>)}</tr></thead>
       <tbody>
        {gaps.slice(0,20).map(g=><tr key={g.patientId+g.aggregateId+g.code}>
         <td style={tdc}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:26,height:26,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>{initials(nameOf(g.patientId))}</span><span style={{fontWeight:600}}>{nameOf(g.patientId)}</span></div></td>
         <td style={tdc}>{g.label}</td>
         <td style={tdc}><span style={prSty(g.priority)}>{g.priority}</span></td>
         <td style={tdc}><button onClick={()=>{selectPatientRaw(g.patientId,nameOf(g.patientId));setView("exp");}} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:8,padding:"5px 10px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:UI}}>Abrir expediente →</button></td>
        </tr>)}
        {panel&&gaps.length===0&&<tr><td colSpan={4} style={{...tdc,textAlign:"center",color:P.greenOnPale,padding:"22px",fontWeight:600}}>✓ Sin pendientes accionables en el panel del consultorio.</td></tr>}
        {!panel&&Array.from({length:6}).map((_,i)=><tr key={"sk"+i} aria-hidden><td style={tdc}><div style={{display:"flex",alignItems:"center",gap:8}}><Skeleton w={26} h={26} r={13}/><Skeleton w={"60%"} h={12}/></div></td><td style={tdc}><Skeleton w={"80%"} h={12}/></td><td style={tdc}><Skeleton w={64} h={20} r={999}/></td><td style={tdc}><Skeleton w={128} h={26} r={8}/></td></tr>)}
       </tbody></table></div>
     </div>;
    })()}
   </div>;

}
