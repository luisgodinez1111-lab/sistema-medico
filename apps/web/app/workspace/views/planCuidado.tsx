"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "planCuidado" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import {parseBp} from "../../../../../packages/bp-staging/src";
import{card,P,UI,LINE}from"../shared";
import{useWorkspace}from"../context";
export default function PlanCuidadoView(){
 const{cpSnap,setCpNew,setCpMsg,cpNew,cpMsg,patientName,patientId,cpForm,setCpForm,addCarePlanGoal,cpBusy,patientSelector,setView}=useWorkspace();

   // ===== MÓDULO PLAN DE CUIDADO (S-PLANCUIDADO) — snapshot compuesto cableado a GET /patients/:id/care-plan =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const cpLoaded=!!cpSnap;
   const counts=cpSnap?cpSnap.counts:{problems:0,medications:0,allergies:0};
   type PA={code:string;description:string;statusLabel:string};
   const problems:PA[]=cpSnap?.problems??[];
   const goals=(cpSnap?.goals??[]).map(g=>({goal:g.goal,statusLabel:g.statusLabel}));
   const m=cpSnap?cpSnap.metrics:{hba1c:null,bp:null,weight:null,imc:null};
   const hba1c=m.hba1c??"",bp=m.bp??"",weight=m.weight??"",imc=m.imc??"";
   const dot=(c:string)=><span style={{width:9,height:9,borderRadius:"50%",background:c,flex:"0 0 auto"}}/>;
   const estSty=(k:string):React.CSSProperties=>{const mm:Record<string,[string,string]>={Activo:["#FDECEE","#C9364A"],["En seguimiento"]:["#FBF0DC","#B7791F"],Resuelto:["#E6F6EE","#16A66A"],["En curso"]:["#E6F6EE","#16A66A"],Pendiente:["#FBF0DC","#B7791F"],Programado:["#E7EEFB","#1769E0"]};const[b,f]=mm[k]??mm.Activo!;return{background:b,color:f,borderRadius:16,padding:"3px 11px",fontSize:11.5,fontWeight:700,whiteSpace:"nowrap"};};
   const cico=(c:string,d:string)=><span style={{width:34,height:34,borderRadius:9,background:c+"22",color:c,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={d}/></svg></span>;
   const sec:React.CSSProperties={fontSize:15.5,fontWeight:800,display:"flex",alignItems:"center",gap:9,marginBottom:14};
   const secIco=(c:string,d:string)=><span style={{width:28,height:28,borderRadius:8,background:c+"22",color:c,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={d}/></svg></span>;
   const metric=(name:string,target:string,val:string,unit:string,good:boolean)=><div style={{marginBottom:13}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}><div><div style={{fontSize:13,fontWeight:700}}>{name}</div><div style={{fontSize:11,color:P.muted}}>{target}</div></div><div style={{fontSize:12,color:P.muted}}>Último: <b style={{color:P.ink}}>{val}{unit}</b></div></div><div style={{height:6,borderRadius:6,background:"#EEF1F7",overflow:"hidden",marginTop:5}}><div style={{height:"100%",width:good?"85%":"55%",background:good?"#16A66A":"#E5983B",borderRadius:6}}/></div></div>;
   const clip="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={clip}/><path d="M9 12l2 2 4-4"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Plan de cuidado</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Define, organiza y da seguimiento al plan de cuidado integral del paciente.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setCpNew(v=>!v);setCpMsg(null);}}>{cpNew?"Cerrar":"+ Nueva meta"}</button>
     </div>
    </div>
    {cpMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:cpMsg.includes("✓")?"#F0FBF4":"#EEF6FF",border:`1px solid ${cpMsg.includes("✓")?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:cpMsg.includes("✓")?P.green:P.blue,fontWeight:700}}>{cpMsg.includes("✓")?"✓":"ℹ"}</span><span style={{flex:1}}>{cpMsg}</span><button onClick={()=>setCpMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {cpNew&&<div style={{...card2,marginTop:14,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:4}}>Nueva meta del plan de cuidado</div>
     <div style={{fontSize:12.5,color:P.muted,marginBottom:12}}>Para <b style={{color:P.ink}}>{patientName||"el paciente en contexto"}</b>{!patientId?" — selecciona un paciente primero":""}.</div>
     <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:14}} className="mos-med2">
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Categoría</div><select value={cpForm.category} onChange={e=>setCpForm({...cpForm,category:e.target.value})} style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink}}>{[["DIABETES","Diabetes"],["HYPERTENSION","Hipertensión"],["OBESITY","Obesidad"],["CARDIOVASCULAR","Cardiovascular"],["MENTAL_HEALTH","Salud mental"],["PRENATAL","Prenatal"],["OTHER","Otro"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Objetivo / meta</div><input value={cpForm.goal} onChange={e=>setCpForm({...cpForm,goal:e.target.value})} placeholder="Ej. Lograr HbA1c < 7% en 3 meses" style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink}}/></div>
     </div>
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void addCarePlanGoal()} disabled={cpBusy||!patientId||!cpForm.goal.trim()} style={{border:0,background:(cpBusy||!patientId||!cpForm.goal.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(cpBusy||!patientId||!cpForm.goal.trim())?"default":"pointer",fontFamily:UI}}>{cpBusy?"Agregando…":"Agregar meta"}</button><button onClick={()=>setCpNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    <div style={{...card2,marginTop:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"center",gap:13,minWidth:0}}><span style={{width:48,height:48,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:15,fontWeight:700,flex:"0 0 auto"}}>{initials(patientName||"—")}</span><div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:16}}>{patientSelector}</div><div style={{fontSize:12.5,color:P.muted}}>{patientId?"Plan de cuidado del paciente en contexto":"Selecciona un paciente en el buscador superior para ver y editar su plan"}</div></div></div>
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}>{cico(P.blue,clip)}<div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{counts.problems}</div><div style={{fontSize:11,color:P.muted}}>Problemas activos</div></div></div>
      <div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}>{cico(P.green,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z")}<div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{counts.medications}</div><div style={{fontSize:11,color:P.muted}}>Medicamentos</div></div></div>
      <div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}>{cico(P.red,"M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z")}<div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{counts.allergies}</div><div style={{fontSize:11,color:P.muted}}>{counts.allergies===1?"Alergia":"Alergias"}</div></div></div>
      <button onClick={()=>{setView("exp");}} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver expediente →</button>
     </div>
    </div>
    {/* Fila real: problemas / objetivos / metas y métricas (todo desde el snapshot real del plan) */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-cp">
     <div style={{...card2,padding:18}}><div style={sec}>{secIco(P.purple,clip)}Diagnósticos / Problemas asociados</div>{problems.length===0?<div style={{fontSize:12.5,color:P.muted}}>{cpLoaded?"Sin problemas en el expediente.":patientId?"Cargando…":"Selecciona un paciente."}</div>:problems.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<problems.length-1?`1px solid #F2F4F9`:"0"}}>{dot(["#F0455E","#E5983B","#1769E0","#6C5CF6"][i%4]!)}<div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:600}}>{p.description}</div></div><span style={{fontSize:12,color:P.muted,fontWeight:600}}>{p.code}</span><span style={estSty(p.statusLabel)}>{p.statusLabel}</span></div>)}</div>
     <div style={{...card2,padding:18}}><div style={sec}>{secIco(P.green,"M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11")}Objetivos del plan</div>{goals.length===0?<div style={{fontSize:12.5,color:P.muted}}>{cpLoaded?"Sin metas registradas. Usa «+ Nueva meta».":patientId?"Cargando…":"Selecciona un paciente."}</div>:goals.map((g,i)=>{const done=g.statusLabel==="Lograda";return <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0"}}><span style={{width:18,height:18,borderRadius:"50%",border:done?"0":"1.8px solid #C7CCE0",background:done?"#16A66A":"transparent",color:"#fff",display:"grid",placeItems:"center",fontSize:11,flex:"0 0 auto"}}>{done?"✓":""}</span><span style={{flex:1,fontSize:13.5,color:done?P.muted:P.ink,textDecoration:done?"line-through":"none"}}>{g.goal}</span><span style={estSty(g.statusLabel)}>{g.statusLabel}</span></div>;})}</div>
     <div style={{...card2,padding:18}}><div style={sec}>{secIco(P.blue,"M4 19V5M4 19h16M8 15l3-4 3 2 4-6")}Metas y métricas</div>{(!hba1c&&!bp&&!weight&&!imc)?<div style={{fontSize:12.5,color:P.muted}}>Sin métricas registradas para este paciente. Se derivan de resultados y signos vitales.</div>:<>
      {hba1c&&metric("HbA1c","Meta < 7%",hba1c,"%",Number(hba1c)<7)}
      {bp&&metric("Presión arterial","Meta < 130/80",bp,"",(parseBp(bp)?.systolic??999)<130)}
      {weight&&metric("Peso","Seguimiento",weight," kg",false)}
      {imc&&metric("IMC","Meta < 25",imc,"",Number(imc)<25)}
     </>}</div>
    </div>
   </div>;
  
}
