"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "reportes" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.

import{card,P,LINE}from"../shared";
import{useWorkspace}from"../context";
export default function ReportesView(){
 const{repSnap,repErr,reloadReports}=useWorkspace();

   // ===== MÓDULO REPORTES (S-REPORTES) — tablero analítico; KPIs de pacientes/ingresos y diagnósticos cableados a GET /reports =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const money=(n:number)=>"$"+n.toLocaleString("es-MX",{maximumFractionDigits:0});
   const repLoaded=!!repSnap;
   const kPac=repSnap?.patientsAttended??0;
   const kIng=repSnap?.income??0;
   const topDx:[string,string,number,number][]=(repSnap?.topDiagnoses??[]).map(d=>[d.code,d.description,d.count,d.pct] as [string,string,number,number]);
   const kOrders=repSnap?.ordersTotal??0,kResults=repSnap?.resultsTotal??0,kVac=repSnap?.immunizationsApplied??0;
   const obt=repSnap?.ordersByType??[];const topProc=repSnap?.topProcedures??[];
   const encDays=repSnap?.encountersByDay??[];const encTot=repSnap?.encountersTotal??0;const encSig=repSnap?.encountersSigned??0;
   const topMeds=repSnap?.topMedications??[];const rxTot=repSnap?.prescriptionsTotal??0;
   const apptByType=repSnap?.appointmentsByType??[];const apptTot=repSnap?.appointmentsTotal??0;
   const APTC=["#6C5CF6",P.blueOnPale,P.amberOnPale,P.greenOnPale,"#E0574B",P.muted,"#0FA3B1","#B8B0DE"];
   const qInd=repSnap?.qualityIndicators??[];
   const capMonth=(iso:string):string=>{const p=iso.split("-");if(p.length<3)return iso;const md=`${p[2]}/${p[1]}`;return md;};
   const OBC=["#6C5CF6",P.blueOnPale,P.amberOnPale,P.greenOnPale,P.muted];
   const obTot=obt.reduce((a,b)=>a+b.count,0);let oacc=0;
   const obStops=obt.map((e,i)=>{const a=(oacc/(obTot||1)*100).toFixed(2);oacc+=e.count;const b=(oacc/(obTot||1)*100).toFixed(2);return `${OBC[i%OBC.length]} ${a}% ${b}%`;}).join(",");
   const kico=(bg:string,fg:string,d:string)=><span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:16,display:"flex",gap:13,alignItems:"center"};
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Reportes</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Analiza el desempeño de tu consulta con información clara y útil para la toma de decisiones.</p></div></div>
    </div>
    {repErr&&!repSnap&&<div style={{marginTop:16,padding:"12px 16px",borderRadius:12,background:"#FDECEE",border:"1px solid #F6CDD3",display:"flex",alignItems:"center",gap:12,fontSize:13,color:"#9c1f34"}}><span style={{flex:1}}>No se pudo cargar el tablero de reportes.</span><button onClick={()=>void reloadReports()} style={{border:`1px solid #E7C9C4`,background:"#fff",color:"#9c1f34",borderRadius:8,padding:"6px 14px",fontWeight:700,fontSize:12.5,cursor:"pointer"}}>Reintentar</button></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9 8a3 3 0 100-6 3 3 0 000 6z")}<div><div style={{fontSize:23,fontWeight:800}}>{kPac}</div><div style={{fontSize:11.5,color:P.muted}}>Pacientes atendidos</div></div></div>
     <div style={kcard}>{kico("#E6F6EE",P.greenOnPale,"M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6")}<div><div style={{fontSize:23,fontWeight:800}}>{money(kIng)}</div><div style={{fontSize:11.5,color:P.muted}}>Ingresos totales</div></div></div>
     <div style={kcard}>{kico("#EEEBFD",P.purple,"M7 3h10v18H7zM10 8h4")}<div><div style={{fontSize:23,fontWeight:800}}>{kOrders}</div><div style={{fontSize:11.5,color:P.muted}}>Órdenes y estudios</div></div></div>
     <div style={kcard}>{kico("#FBEEDF",P.amber,"M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3")}<div><div style={{fontSize:23,fontWeight:800}}>{kResults}</div><div style={{fontSize:11.5,color:P.muted}}>Resultados registrados</div></div></div>
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z")}<div><div style={{fontSize:23,fontWeight:800}}>{kVac}</div><div style={{fontSize:11.5,color:P.muted}}>Vacunas aplicadas</div></div></div>
    </div>
    <div style={{...card2,marginTop:16,padding:16}}>
     <div style={{fontSize:15,fontWeight:800,marginBottom:8}}>Diagnósticos principales (CIE-10)</div>
     {topDx.length===0?<div style={{fontSize:12.5,color:P.muted}}>{repLoaded?"Sin diagnósticos agregados en el periodo.":"Cargando reporte…"}</div>:topDx.map(([code,desc,n,pct],i)=>{const w=topDx[0]?Math.round(n/topDx[0][2]*100):0;return <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0"}}><span style={{fontSize:12,fontWeight:700,color:P.purple,width:46}}>{code}</span><span style={{flex:1,fontSize:12.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{desc}</span><div style={{width:70,height:8,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${w}%`,background:P.purple,borderRadius:6,opacity:.85}}/></div><span style={{fontSize:12.5,fontWeight:700,width:24,textAlign:"right"}}>{n}</span><span style={{fontSize:12,color:P.muted,width:30,textAlign:"right"}}>{pct}%</span></div>;})}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-rep2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:12}}>Órdenes por tipo</div>{obt.length===0?<div style={{fontSize:12.5,color:P.muted}}>{repLoaded?"Sin órdenes registradas.":"Cargando…"}</div>:<div style={{display:"flex",gap:16,alignItems:"center"}}><div style={{width:110,height:110,borderRadius:"50%",flex:"0 0 auto",display:"grid",placeItems:"center",background:obTot>0?`conic-gradient(${obStops})`:"#EEF0F5"}}><div style={{width:70,height:70,borderRadius:"50%",background:P.white,display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:17,fontWeight:800}}>{kOrders}</div><div style={{fontSize:9,color:P.muted}}>órdenes</div></div></div></div><div style={{flex:1}}>{obt.map((e,i)=><div key={e.type} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,padding:"3px 0"}}><span style={{width:9,height:9,borderRadius:"50%",background:OBC[i%OBC.length]}}/>{e.label}<b style={{marginLeft:"auto"}}>{e.count}</b><span style={{color:P.muted,width:34,textAlign:"right"}}>{e.pct}%</span></div>)}</div></div>}</div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:10}}>Procedimientos más realizados</div>{topProc.length===0?<div style={{fontSize:12.5,color:P.muted}}>{repLoaded?"Sin procedimientos registrados (órdenes de tipo procedimiento).":"Cargando…"}</div>:topProc.map((p,i)=>{const w=topProc[0]?Math.round(p.count/topProc[0].count*100):0;return <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0"}}><span style={{flex:1,fontSize:12.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.detail}</span><div style={{width:70,height:8,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${w}%`,background:P.purple,borderRadius:6,opacity:.85}}/></div><span style={{fontSize:12.5,fontWeight:700,width:24,textAlign:"right"}}>{p.count}</span><span style={{fontSize:12,color:P.muted,width:32,textAlign:"right"}}>{p.pct}%</span></div>;})}</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-rep2">
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:15,fontWeight:800}}>Consultas por día</div><div style={{fontSize:11.5,color:P.muted}}>{encTot} en total · {encSig} firmadas</div></div>
      {encDays.length===0?<div style={{fontSize:12.5,color:P.muted}}>{repLoaded?"Sin consultas registradas en el periodo.":"Cargando…"}</div>:<div style={{display:"flex",alignItems:"flex-end",gap:6,height:130,overflowX:"auto",paddingBottom:4}}>{encDays.map((d,i)=><div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flex:"0 0 auto",minWidth:26}} title={`${d.date}: ${d.count}`}><span style={{fontSize:11,fontWeight:700,color:P.ink}}>{d.count}</span><div style={{width:20,height:`${Math.max(6,Math.round(d.pct*0.9))}px`,minHeight:6,background:P.blue,borderRadius:5,opacity:.85}}/><span style={{fontSize:9.5,color:P.muted,whiteSpace:"nowrap"}}>{capMonth(d.date)}</span></div>)}</div>}
     </div>
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:10}}><div style={{fontSize:15,fontWeight:800}}>Medicamentos más prescritos</div><div style={{fontSize:11.5,color:P.muted}}>{rxTot} recetas</div></div>
      {topMeds.length===0?<div style={{fontSize:12.5,color:P.muted}}>{repLoaded?"Sin recetas emitidas en el periodo.":"Cargando…"}</div>:topMeds.map((m,i)=>{const w=topMeds[0]?Math.round(m.count/topMeds[0].count*100):0;return <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0"}}><span style={{flex:1,fontSize:12.5,textTransform:"capitalize",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.drugCode}</span><div style={{width:70,height:8,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${w}%`,background:P.greenOnPale,borderRadius:6,opacity:.85}}/></div><span style={{fontSize:12.5,fontWeight:700,width:24,textAlign:"right"}}>{m.count}</span><span style={{fontSize:12,color:P.muted,width:32,textAlign:"right"}}>{m.pct}%</span></div>;})}
     </div>
    </div>
    <div style={{...card2,marginTop:16,padding:16}}>
     <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:15,fontWeight:800}}>Tipos de consulta</div><div style={{fontSize:11.5,color:P.muted}}>{apptTot} citas en la agenda</div></div>
     {apptByType.length===0?<div style={{fontSize:12.5,color:P.muted}}>{repLoaded?"Sin citas agendadas en el periodo.":"Cargando…"}</div>:<div>
      <div style={{display:"flex",height:14,borderRadius:7,overflow:"hidden",background:"#EEF1F7"}}>{apptByType.map((a,i)=><div key={a.type} style={{width:`${a.pct}%`,background:APTC[i%APTC.length]}} title={`${a.label}: ${a.count} (${a.pct}%)`}/>)}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:"6px 16px",marginTop:12}}>{apptByType.map((a,i)=><div key={a.type} style={{display:"flex",alignItems:"center",gap:7,fontSize:12}}><span style={{width:9,height:9,borderRadius:"50%",background:APTC[i%APTC.length],flex:"0 0 auto"}}/><span style={{flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.label}</span><b>{a.count}</b><span style={{color:P.muted,width:34,textAlign:"right"}}>{a.pct}%</span></div>)}</div>
     </div>}
    </div>
    <div style={{...card2,marginTop:16,padding:16}}>
     <div style={{fontSize:15,fontWeight:800,marginBottom:4}}>Indicadores de calidad</div>
     <div style={{fontSize:11.5,color:P.muted,marginBottom:12}}>Cada indicador se calcula del expediente real, con su meta clínica. Los que aún no tienen datos suficientes se marcan como “sin datos”, no se inventan.</div>
     {qInd.length===0?<div style={{fontSize:12.5,color:P.muted}}>{repLoaded?"Sin indicadores disponibles.":"Cargando…"}</div>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:12}}>{qInd.map(q=>{const col=!q.computable?P.muted:q.met?P.greenOnPale:P.amber;const barBg="#EEF1F7";return <div key={q.key} style={{border:`1px solid ${LINE}`,borderRadius:11,padding:"12px 13px"}}>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:8}}><span style={{fontSize:12.5,fontWeight:700,lineHeight:1.25}}>{q.label}</span><span style={{fontSize:18,fontWeight:800,color:col,flex:"0 0 auto"}}>{q.computable?`${q.pct}%`:"—"}</span></div>
      <div style={{height:7,borderRadius:5,background:barBg,overflow:"hidden",margin:"8px 0 6px"}}><div style={{height:"100%",width:`${q.computable?q.pct:0}%`,background:col,borderRadius:5,opacity:.9}}/></div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:P.muted}}><span>{q.computable?`${q.numerator}/${q.denominator}`:"sin datos"}</span><span>Meta {q.direction==="higher"?"≥":"≤"} {q.target}%{q.computable?` · ${q.met?"cumple":"por debajo"}`:""}</span></div>
     </div>;})}</div>}
    </div>
   </div>;
  
}
