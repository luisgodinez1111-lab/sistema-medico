"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "signos" del workspace, extraída de page.tsx. Toma del contexto
// solo lo que usa. Desde el hallazgo D11a guarda con `submitVitals`, la captura única que comparte con la Consulta.
import {apiRequest} from "../../../lib/session-client";
import {parseBp} from "../../../../../packages/bp-staging/src";
import {classifyVital} from "../../../../../packages/lab-reference/src";
import{card,LINE,P,UI,liveVitalCapture,submitVitals,vitalSubmitMessage,userMessage,type VitalHistory,type VitalRecord}from"../shared";
import{useWorkspace}from"../context";
export default function SignosView(){
 const{svCapture,isSelectedPatient,svPeso,svTalla,patientId,setSvMsg,svBpS,svBpD,svFc,svFr,svTemp,svSpo2,setSvBusy,setVitHist,setSvTemp,setSvFc,setSvFr,setSvBpS,setSvBpD,setSvSpo2,setSvPeso,setSvPab,setSvObs,setSvTalla,setSvPain,vitHist,snap,patientName,patientSelector,setView,svMsg,svBusy}=useWorkspace();

   // ===== MÓDULO SIGNOS VITALES (S-SIGNOS) — form cableado a POST /vitals + historial/tendencias por paciente =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"10px 12px",fontSize:14,background:P.white,fontFamily:UI,color:P.ink};
   const flbl:React.CSSProperties={fontSize:12.5,fontWeight:700,margin:"0 0 6px"};
   const fmtDT=(iso:string)=>{if(!iso)return["—",""];const d=new Date(iso);if(isNaN(d.getTime()))return["—",""];return[d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"}),d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})];};
   const imcCalc=svPeso&&svTalla&&Number(svTalla)>0?(Number(svPeso)/Math.pow(Number(svTalla)/100,2)).toFixed(1):"";
   const saveVitals=async()=>{
    if(!patientId){setSvMsg("Selecciona un paciente en el buscador superior para guardar los signos vitales.");return;}
    const toSave:[string,string,string][]=[];
    if(svBpS&&svBpD)toSave.push(["BP",`${svBpS}/${svBpD}`,"mmHg"]);
    if(svFc)toSave.push(["HR",svFc,"lpm"]);if(svFr)toSave.push(["RESP",svFr,"rpm"]);
    if(svTemp)toSave.push(["TEMP",svTemp,"°C"]);if(svSpo2)toSave.push(["SPO2",svSpo2,"%"]);
    if(svPeso)toSave.push(["WEIGHT",svPeso,"kg"]);if(svTalla)toSave.push(["HEIGHT",svTalla,"cm"]);
    if(!toSave.length){setSvMsg("Captura al menos un signo vital.");return;}
    setSvBusy(true);setSvMsg("");
    // D11a: antes cada clic regeneraba vitalId y llave (un reintento duplicaba) y se anunciaba «guardados ✓» aunque el servidor
    // rechazara valores. Ahora la captura es estable mientras dura y el mensaje dice exactamente qué se guardó (y los críticos).
    const capture=liveVitalCapture(svCapture.current);svCapture.current=capture;
    try{const res=await submitVitals(capture,patientId,toSave);
     // Revisión adversarial (F4): si el médico cambió de paciente durante el guardado, nada de esta respuesta se muestra ni
     // se asigna al paciente nuevo (la captura ya se descartó al cambiar).
     if(!isSelectedPatient(patientId))return;
     svCapture.current=res.capture;
     const r=await apiRequest(`/api/v1/patients/${patientId}/vitals`,{method:"GET"});if(r.status===200&&isSelectedPatient(patientId))setVitHist(r.body as unknown as VitalHistory);
     setSvMsg(vitalSubmitMessage(res));
     // F3: lo guardado sale del formulario; queda solo lo rechazado para corregirlo.
     const clearOf:Record<string,()=>void>={BP:()=>{setSvBpS("");setSvBpD("");},HR:()=>setSvFc(""),RESP:()=>setSvFr(""),TEMP:()=>setSvTemp(""),SPO2:()=>setSvSpo2(""),WEIGHT:()=>setSvPeso(""),HEIGHT:()=>setSvTalla("")};
     if(res.failed.length){for(const vt of res.saved)clearOf[vt]?.();return;}
     svCapture.current=null;
     setSvTemp("");setSvFc("");setSvFr("");setSvBpS("");setSvBpD("");setSvSpo2("");setSvPeso("");setSvPab("");setSvObs("");
    }catch(e){setSvMsg(userMessage(e));}finally{setSvBusy(false);}
   };
   // F3: limpiar el formulario termina la captura: la siguiente toma lleva su propio id y su propia hora.
   const clearForm=()=>{svCapture.current=null;setSvTemp("");setSvFc("");setSvFr("");setSvBpS("");setSvBpD("");setSvSpo2("");setSvPeso("");setSvTalla("");setSvPab("");setSvPain("0");setSvObs("");setSvMsg("");};
   const svHist=!!vitHist;
   const records:VitalRecord[]=vitHist?.records??[];
   const sys=(ta:string)=>parseBp(ta)?.systolic??0; // C-21: parser único
   const sBP=vitHist?.series.BP.map(p=>p.value)??[];
   const sHR=vitHist?.series.HR.map(p=>p.value)??[];
   const sWT=vitHist?.series.WEIGHT.map(p=>p.value)??[];
   const sIMC=vitHist?.series.IMC.map(p=>p.value)??[];
   const latest=records[0];
   const spark=(vals:number[],color:string)=>{if(!vals.length)return null;const w=150,h=44,pad=4;const mn=Math.min(...vals),mx=Math.max(...vals),rng=(mx-mn)||1;const step=vals.length>1?(w-pad*2)/(vals.length-1):0;
    const pt=(v:number,i:number):[number,number]=>[pad+i*step,h-pad-((v-mn)/rng)*(h-pad*2)];
    const d=vals.map((v,i)=>{const[x,y]=pt(v,i);return `${i===0?"M":"L"}${x.toFixed(1)} ${y.toFixed(1)}`;}).join(" ");
    const[lx,ly]=pt(vals[vals.length-1]!,vals.length-1);
    return <svg width={w} height={h} style={{display:"block"}} aria-hidden><path d={`${d} L${(pad+(vals.length-1)*step).toFixed(1)} ${h} L${pad} ${h} Z`} fill={color} opacity={.09}/><path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><circle cx={lx} cy={ly} r={3} fill={color}/></svg>;};
   // Auditoría U-10: las alertas usan la MISMA clasificación que el servidor (classifyVital, por edad), no umbrales propios.
   const alerts:string[]=[];
   if(latest){const ageYears=snap?.demographics.age??undefined;
    for(const[vt,val,unit]of[["BP",latest.ta,"mmHg"],["HR",latest.fc,"lpm"],["RESP",latest.fr,"rpm"],["TEMP",latest.temp,"°C"],["SPO2",latest.spo2,"%"]] as const){
     if(!val)continue;const a=classifyVital(vt,String(val),{ageYears});
     if(a.status==="CRITICAL"||a.status==="ABNORMAL")alerts.push(`${a.interpretation} (${val} ${unit})${a.status==="CRITICAL"?" — CRÍTICO":""}`);}}
   const trendCard=(ico:string,c:string,title:string,unit:string,vals:number[],last:string)=><div style={{border:`1px solid ${LINE}`,borderRadius:12,padding:13}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{width:26,height:26,borderRadius:7,background:c+"22",color:c,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d={ico}/></svg></span><div style={{fontSize:12,fontWeight:700,lineHeight:1.1}}>{title}<div style={{fontSize:10.5,color:P.muted,fontWeight:500}}>{unit}</div></div></div>{spark(vals,c)}<div style={{fontSize:20,fontWeight:800,marginTop:6}}>{last}</div><div style={{fontSize:11.5,color:P.muted,display:"flex",justifyContent:"space-between"}}>Último registro <span>›</span></div></div>;
   const th:React.CSSProperties={textAlign:"left",fontSize:11,color:P.muted,fontWeight:600,padding:"9px 8px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
   const tdc:React.CSSProperties={padding:"9px 8px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,whiteSpace:"nowrap"};
   const num:React.CSSProperties={...selSty};
   const heartIco="M12 21C12 21 4 13.5 4 8.5A4 4 0 0112 6a4 4 0 018 2.5C20 13.5 12 21 12 21z";
   const actIco="M3 12h4l3 8 4-16 3 8h4";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden><path d={actIco}/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Signos vitales</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Registra, visualiza y da seguimiento a los signos vitales de tus pacientes.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button onClick={saveVitals} style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>+ Registrar signos vitales</button>
     </div>
    </div>
    <div style={{...card2,marginTop:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"center",gap:13,minWidth:0,flexWrap:"wrap"}}><span style={{width:48,height:48,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:15,fontWeight:700,flex:"0 0 auto"}}>{initials(patientName||"—")}</span><div style={{minWidth:0}}>{patientSelector}<div style={{fontSize:12.5,color:P.muted,marginTop:4}}>{patientName?"Registro e historial de signos vitales del paciente":"Elige un paciente para registrar y ver su historial"}</div></div></div>
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><button onClick={()=>{setView("exp");}} style={{border:`1px solid ${patientId?P.purple:LINE}`,background:P.white,color:patientId?P.purple:"#C7CCE0",borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13,cursor:patientId?"pointer":"default",fontFamily:UI}}>Ver expediente →</button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-signos">
     {/* Form */}
     <div style={{...card2,padding:20}}>
      <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>Registrar signos vitales</div>
      <div style={{fontSize:12,color:P.muted,marginBottom:14}}>Se registra con la fecha y hora actuales.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
       <div><div style={flbl}>Temperatura (°C)</div><input value={svTemp} onChange={e=>setSvTemp(e.target.value)} placeholder="36.5" style={num}/></div>
       <div><div style={flbl}>Frecuencia cardíaca (lpm)</div><input value={svFc} onChange={e=>setSvFc(e.target.value)} placeholder="72" style={num}/></div>
       <div><div style={flbl}>Frecuencia respiratoria (rpm)</div><input value={svFr} onChange={e=>setSvFr(e.target.value)} placeholder="16" style={num}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:12}}>
       <div><div style={flbl}>Presión arterial (mmHg)</div><div style={{display:"flex",alignItems:"center",gap:6}}><input value={svBpS} onChange={e=>setSvBpS(e.target.value)} placeholder="120" style={{...num,textAlign:"center"}}/><span style={{color:P.muted}}>/</span><input value={svBpD} onChange={e=>setSvBpD(e.target.value)} placeholder="80" style={{...num,textAlign:"center"}}/></div></div>
       <div><div style={flbl}>Saturación O₂ (%)</div><input value={svSpo2} onChange={e=>setSvSpo2(e.target.value)} placeholder="98" style={num}/></div>
       <div><div style={flbl}>Peso (kg)</div><input value={svPeso} onChange={e=>setSvPeso(e.target.value)} placeholder="65.7" style={num}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:12}}>
       <div><div style={flbl}>Talla (cm)</div><input value={svTalla} onChange={e=>setSvTalla(e.target.value)} placeholder="149" style={num}/></div>
       <div><div style={flbl}>IMC (kg/m²)</div><input value={imcCalc} readOnly placeholder="—" style={{...num,background:"#F2F4F9",color:P.muted}}/></div>
       <div/>
      </div>
      {svMsg&&<div style={{marginTop:10,padding:"10px 13px",borderRadius:10,background:svMsg.includes("✓")?"#E6F6EE":"#FDF4E6",border:`1px solid ${svMsg.includes("✓")?"#BFE6CF":"#F2E1C0"}`,fontSize:13,color:svMsg.includes("✓")?"#166534":"#7A5A16"}}>{svMsg}</div>}
      <div style={{display:"flex",gap:12,marginTop:14}}><button onClick={clearForm} style={{flex:"0 0 34%",border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"12px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Limpiar</button><button onClick={saveVitals} disabled={svBusy} style={{flex:1,border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:UI}}>{svBusy?"Guardando…":"✓ Guardar signos vitales"}</button></div>
     </div>
     {/* Últimos registros + Tendencias */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px"}}><div style={{fontSize:16,fontWeight:800}}>Últimos registros{records.length>0?` (${records.length})`:""}</div></div>
       <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><th style={th}>Fecha y hora</th><th style={th}>TA (mmHg)</th><th style={th}>FC (lpm)</th><th style={th}>FR (rpm)</th><th style={th}>Temp (°C)</th><th style={th}>SpO₂ (%)</th><th style={th}>Peso (kg)</th><th style={th}>IMC</th></tr></thead>
        <tbody>{records.slice(0,6).map((r,i)=>{const[d,t]=fmtDT(r.at);return <tr key={i}><td style={tdc}><div style={{fontWeight:600}}>{d}</div><div style={{fontSize:11,color:P.muted}}>{t}</div></td><td style={tdc}>{r.ta||"—"}</td><td style={tdc}>{r.fc||"—"}</td><td style={tdc}>{r.fr||"—"}</td><td style={tdc}>{r.temp||"—"}</td><td style={tdc}>{r.spo2||"—"}</td><td style={tdc}>{r.peso||"—"}</td><td style={tdc}>{r.imc||"—"}</td></tr>;})}
        {records.length===0&&<tr><td colSpan={8} style={{...tdc,textAlign:"center",color:P.muted,padding:"24px"}}>{patientId?(svHist?"Sin registros de signos vitales para este paciente.":"Cargando historial…"):"Selecciona un paciente para ver su historial."}</td></tr>}
        </tbody></table></div>
      </div>
      <div style={{...card2,padding:16}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:16,fontWeight:800}}>Tendencias</div></div>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {trendCard("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",P.blue,"Presión arterial","(mmHg)",sBP,latest?.ta||"—")}
        {trendCard(heartIco,P.red,"Frecuencia cardíaca","(lpm)",sHR,latest?.fc||"—")}
        {trendCard("M20 7h-9M14 17H5M17 3l3 4-3 4M7 21l-3-4 3-4",P.green,"Peso","(kg)",sWT,latest?.peso||"—")}
        {trendCard("M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v8",P.purple,"IMC","(kg/m²)",sIMC,latest?.imc||"—")}
       </div>
      </div>
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:14,marginTop:16,alignItems:"start"}} className="mos-signos2">
     <div style={{...card2,padding:16}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{color:P.purple}}>▦</span><div style={{fontSize:15,fontWeight:700}}>Referencia de valores normales (adultos)</div></div><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>{[["TA","90/60 – 120/80","mmHg"],["FC","60 – 100","lpm"],["FR","12 – 20","rpm"],["Temperatura","36.0 – 37.5","°C"],["SpO₂","≥ 95","%"]].map(([k,v,u])=><div key={k}><div style={{fontSize:12,fontWeight:700,color:P.purple}}>{k}</div><div style={{fontSize:13,fontWeight:600,marginTop:3}}>{v}</div><div style={{fontSize:11,color:P.muted}}>{u}</div></div>)}</div></div>
     <div style={{...card2,padding:16}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{color:alerts.length?P.red:P.amber}}>⚠</span><div style={{fontSize:15,fontWeight:700}}>Alertas clínicas</div></div>{alerts.length===0?<div style={{fontSize:13,color:P.muted,lineHeight:1.6}}>{records.length?"Los signos vitales se encuentran en rangos normales.":"Registra signos vitales para evaluar alertas."}</div>:<div style={{display:"flex",flexDirection:"column",gap:8}}>{alerts.map((a,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"8px 11px",borderRadius:9,background:"#FDECEE",fontSize:12.5,color:"#9B1C2E"}}><span>⚠</span>{a}</div>)}</div>}</div>
    </div>
   </div>;
  
}
