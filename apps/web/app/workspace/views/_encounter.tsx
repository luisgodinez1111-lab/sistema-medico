"use client";
// ENCUENTRO — flujo de consulta SOAP en UNA pantalla, ordenado para jornadas largas (decisión del dueño "Una pantalla
// SOAP, ordenada"). Estructura clínica canónica: S·Subjetivo → O·Objetivo → A·Análisis → P·Plan. Diseño:
//   · barra de acción FIJA abajo (estado + vista previa + Guardar/Firmar siempre a la mano, sin volver arriba);
//   · lo poco usado COLAPSADO por defecto (interrogatorio por aparatos, valoración hepática Child-Pugh) → menos scroll;
//   · diagnóstico en UN solo lugar (se eliminó la sección "Impresión diagnóstica" que solo duplicaba la lista);
//   · signos vitales DENTRO de Objetivo (antes estaban sueltos entre medias).
// Reutiliza TODOS los handlers/endpoints del contexto sin cambiar su lógica ni los flujos de seguridad del encuentro.
import{useState}from"react";
import{searchIcd10}from"../../../../../packages/terminology/src";
import{Check,card,P,LINE,UI,act,goExpSection,scrollTop,DX_LABEL,NavIcon,mono,isPediatricAge,antFreshness}from"../shared";
import{useWorkspace}from"../context";

export default function EncounterForm(){
 const{enc,snap,consTabs,antSnap,clock,cForm,setCForm,cVit,setCVit,saveConsultaVitals,cVitBusy,cVitMsg,cDxQuery,setCDxQuery,setCDxMsg,addConsultaProblem,cDxBusy,cDxMsg,cOrdCat,setCOrdCat,cOrdSel,setCOrdSel,setCOrdMsg,createConsultaOrders,cOrdBusy,cOrdMsg,patientId,setView,setExpTab,gaps,busy,consultaAdvance,cPreview,setCPreview,composeNote,cMsg,setCMsg,docDisplay,reset,problems,orders,meds,vitals}=useWorkspace();
 // "El acto" = lo documentado EN ESTE encuentro: las filas del expediente vivo cuyo encounterId es el de la consulta
 // abierta. Permite reconstruir "la visita" como unidad y que la firma selle un acto coherente. Si no hay encuentro, vacío.
 const actId=enc?.id;
 const actProblems=actId?problems.filter(p=>p.encounterId===actId):[];
 const actOrders=actId?orders.filter(o=>o.encounterId===actId):[];
 const actMeds=actId?meds.filter(m=>m.encounterId===actId):[];
 const actVitals=actId?vitals.filter(v=>v.encounterId===actId):[];
 const actTotal=actProblems.length+actOrders.length+actMeds.length+actVitals.length;
 const[dxType,setDxType]=useState<"PROBABLE"|"CONFIRMED"|"POSSIBLE">("PROBABLE"); // tipo de la impresión diagnóstica
 // Lo poco usado arranca COLAPSADO; si el borrador ya trae contenido, se muestra abierto (no se esconde lo escrito).
 const[showInterrog,setShowInterrog]=useState(()=>!!cForm.interrog.trim());
 const[showHepatic,setShowHepatic]=useState(()=>!!(cForm.ascites||cForm.encef));
 const V=snap?.vitals??{};
 const findings=snap?.findings??[];
 const dis=!!enc&&enc.state!=="OPEN"; // tras firmar/listo, los campos del borrador no se editan
 const card2:React.CSSProperties={...card,marginTop:0};
 const sec:React.CSSProperties={...card2,padding:18};
 const sect:React.CSSProperties={fontSize:15,fontWeight:700,margin:"0 0 12px"};
 const ta:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:11,padding:"12px 14px",fontSize:13.5,fontFamily:UI,resize:"vertical",minHeight:64,color:P.ink,boxSizing:"border-box"};
 const cc:React.CSSProperties={fontSize:11,color:P.muted,textAlign:"right",marginTop:5};
 const link:React.CSSProperties={color:P.blue,fontSize:13,fontWeight:600,cursor:"pointer"};
 const sgo=(label:string,section:string)=><button onClick={()=>{goExpSection(section,setView,setExpTab);}} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:600,color:P.purple,cursor:"pointer",whiteSpace:"nowrap",fontFamily:UI}}>{label}</button>;
 const rsum=(bg:string,fg:string,d:string,title:string,sub:string,right:React.ReactNode)=>(<div style={{display:"flex",gap:11,padding:"12px 0",borderTop:`1px solid #F1F3F9`,alignItems:"flex-start"}}><span style={{width:34,height:34,borderRadius:9,background:bg,color:fg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={d}/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13.5}}>{title}</div><div style={{fontSize:12.5,color:P.muted}}>{sub}</div></div>{right}</div>);
 // Encabezado de paso SOAP: letra + título, para que el orden clínico se lea de un vistazo.
 const soap=(letra:string,titulo:string,sub?:string)=><div style={{display:"flex",alignItems:"center",gap:11,margin:"4px 2px 2px"}}><span style={{width:30,height:30,borderRadius:9,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontWeight:800,fontSize:14,flex:"0 0 auto"}}>{letra}</span><div><div style={{fontSize:16,fontWeight:800,letterSpacing:"-.01em"}}>{titulo}</div>{sub&&<div style={{fontSize:11.5,color:P.muted}}>{sub}</div>}</div></div>;
 const toggle=(label:string,open:boolean,onClick:()=>void)=><button onClick={onClick} aria-expanded={open} style={{display:"inline-flex",alignItems:"center",gap:7,border:`1px dashed ${LINE}`,background:open?"#F7F6FE":P.white,color:P.purple,borderRadius:9,padding:"8px 12px",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:UI}}><span style={{transition:"transform .15s",transform:open?"rotate(90deg)":"none"}}>▸</span>{label}</button>;
 const chip=(hi:boolean):React.CSSProperties=>({border:`1px solid ${hi?P.purple:LINE}`,background:hi?"#F1EFFE":P.white,color:P.purple,borderRadius:999,padding:"4px 11px",fontSize:11.5,fontWeight:600,cursor:dis?"default":"pointer",fontFamily:UI,opacity:dis?.5:1});
 const addLine=(field:"interrog"|"explor"|"plan",txt:string,asLine:boolean)=>setCForm(f=>{if(asLine&&new RegExp("(^|\\n)"+txt.split(":")[0]+":").test(f[field]))return f;const sep=f[field].trim()?"\n":"";return{...f,[field]:(f[field]+sep+txt).slice(0,2000)};});
 // Controles del encuentro (estado + acción FSM contextual). U-17: con pendientes críticos abiertos la firma se presenta
 // BLOQUEADA (el servidor la rechazaría igual — Zero Lost Follow-Up).
 const criticalOpen=(gaps??[]).filter(g=>g.priority==="HIGH"&&(g.code==="CRITICAL_RESULT_OPEN"||g.code==="VITAL_CRITICAL"||g.code==="FOLLOWUP_OPEN")).length;
 const st=enc?.state;
 const advLabel=!patientId?"Selecciona un paciente":!enc?"Abrir encuentro":st==="OPEN"?"Guardar valoración":st==="READY_TO_SIGN"?(criticalOpen?`Firma bloqueada: ${criticalOpen} pendiente(s) crítico(s)`:"Firmar consulta"):"✓ Consulta firmada";
 const advDisabled=busy!==""||!patientId||st==="SIGNED"||(st==="READY_TO_SIGN"&&criticalOpen>0);
 const advBg=st==="READY_TO_SIGN"?"linear-gradient(90deg,#16A66A,#12905c)":`linear-gradient(90deg,${P.purpleOnPale},#5B6BF0)`;
 // Throughput de jornada larga: al firmar, encadenar con el SIGUIENTE paciente sin rodeos — se limpia el paciente actual
 // y se vuelve a la Agenda del día (sala de espera / próximas citas), desde donde se abre al siguiente con un clic.
 const nextPatient=()=>{reset();setView("agenda");scrollTop();};
 const estadoChip=enc&&(()=>{const m=st==="SIGNED"?["#E6F6EE",P.greenOnPale,"Firmada"]:st==="READY_TO_SIGN"?["#FBF0DC",P.amberOnPale,"Lista para firmar"]:["#EAF1FD",P.blueOnPale,"Abierta"];return <span style={{fontSize:11,fontWeight:700,borderRadius:999,padding:"3px 10px",background:m[0],color:m[1],whiteSpace:"nowrap"}}>Encuentro · {m[2]}</span>;})();

 return <>
  {cMsg&&<div style={{marginTop:10,display:"flex",alignItems:"center",gap:10,background:st==="SIGNED"?"#F0FBF4":"#EEF6FF",border:`1px solid ${st==="SIGNED"?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:st==="SIGNED"?P.green:P.blue,fontWeight:700}}>{st==="SIGNED"?"✓":"ℹ"}</span><span style={{flex:1}}>{cMsg}{enc?.signatureDigest?<> Firma: <span style={mono}>{enc.signatureDigest.slice(0,24)}…</span></>:null}</span><button onClick={()=>setCMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
  {cPreview&&<div style={{...card,marginTop:14,padding:18}}><div style={{fontWeight:800,fontSize:15,marginBottom:10}}>Vista previa de la nota clínica</div><pre style={{whiteSpace:"pre-wrap",fontFamily:UI,fontSize:13,color:P.ink,margin:0,lineHeight:1.6}}>{composeNote()}{"\n\nPLAN DE MANEJO: "+(cForm.plan.trim()||"—")}</pre><div style={{fontSize:11.5,color:P.muted,marginTop:10}}>Así se guardará la valoración del encuentro al firmar. Médico: {docDisplay}.</div></div>}

  <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.75fr) minmax(300px,1fr)",gap:18,marginTop:14,alignItems:"start",paddingBottom:72}} className="mos-consulta">
   <div style={{display:"flex",flexDirection:"column",gap:14,minWidth:0}}>

    {/* ═══ S · SUBJETIVO ═══ */}
    {soap("S","Subjetivo","Lo que refiere el paciente")}
    <div style={sec}><h3 style={sect}>Motivo de consulta</h3><textarea style={ta} disabled={dis} aria-label="Motivo de consulta" value={cForm.motivo} onChange={e=>setCForm(f=>({...f,motivo:e.target.value.slice(0,500)}))} placeholder="Motivo de la consulta…"/><div style={cc}>{cForm.motivo.length}/500</div></div>
    <div style={sec}><h3 style={sect}>Padecimiento actual</h3><textarea style={{...ta,minHeight:90}} disabled={dis} aria-label="Historia de la enfermedad actual" value={cForm.historia} onChange={e=>setCForm(f=>({...f,historia:e.target.value.slice(0,2000)}))} placeholder="Historia de la enfermedad actual…"/><div style={cc}>{cForm.historia.length}/2000</div></div>
    {/* Interrogatorio por aparatos — COLAPSADO: solo se usa a fondo en primera vez; el control de 3 min no lo necesita. */}
    <div style={sec}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>{toggle("Interrogatorio por aparatos y sistemas",showInterrog,()=>setShowInterrog(v=>!v))}{!showInterrog&&cForm.interrog.trim()&&<span style={{fontSize:11.5,color:P.muted}}>· con contenido</span>}</div>
     {showInterrog&&<div style={{marginTop:12}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}><button disabled={dis} onClick={()=>addLine("interrog","Negado por aparatos y sistemas, salvo lo referido en el padecimiento actual.",false)} style={chip(true)}>Negativo por aparatos</button>{["GENERAL","CARDIOVASCULAR","RESPIRATORIO","DIGESTIVO","GENITOURINARIO","NEUROLÓGICO","MUSCULOESQUELÉTICO","PIEL"].map(tag=><button key={tag} disabled={dis} onClick={()=>addLine("interrog",tag+": ",true)} style={chip(false)}>+ {tag.charAt(0)+tag.slice(1).toLowerCase()}</button>)}</div>
      <textarea style={{...ta,minHeight:90}} disabled={dis} aria-label="Interrogatorio por aparatos y sistemas" value={cForm.interrog} onChange={e=>setCForm(f=>({...f,interrog:e.target.value.slice(0,2000)}))} placeholder="Interrogatorio por aparatos y sistemas… usa los botones para estructurar o marcar negativo por aparatos."/><div style={cc}>{cForm.interrog.length}/2000</div>
     </div>}
    </div>
    {/* Antecedentes — READ-ONLY desde el expediente (se capturan una vez, no se re-preguntan). */}
    {(()=>{
     const c=antSnap?.content;const hab=c?.noPatologicos;const rows:[string,string][]=[];
     const pediatric=isPediatricAge(snap?.demographics.age);const fresh=antFreshness(!!antSnap?.recorded,antSnap?.updatedAt);
     if(antSnap?.recorded){
      const her=[(c?.heredofamiliares?.flags??[]).join(", "),c?.heredofamiliares?.notas].filter(Boolean).join(" · ");if(her)rows.push(["Heredofamiliares",her]);
      const pat=[(c?.patologicos?.cronicos??[]).join(", "),c?.patologicos?.cirugias?"cirugías":"",c?.patologicos?.hospitalizaciones?"hospitalizaciones":"",c?.patologicos?.transfusiones?"transfusiones":"",c?.patologicos?.notas].filter(Boolean).join(" · ");if(pat)rows.push(["Patológicos",pat]);
      rows.push(["Hábitos",`Tabaquismo: ${hab?.tabaquismo?"Sí":"No"} · Alcoholismo: ${hab?.alcoholismo?"Sí":"No"} · Toxicomanías: ${hab?.toxicomanias?"Sí":"No"}`]);
      if(!pediatric&&c?.quirurgicos?.notas)rows.push(["Quirúrgicos",c.quirurgicos.notas]);
      if(!pediatric&&c?.ginecoObstetricos?.notas)rows.push(["Gineco-obstétricos",c.ginecoObstetricos.notas]);
      if(pediatric)for(const[k,title]of [["prenatales","Prenatales"],["perinatales","Perinatales"],["alimentacion","Alimentación"],["desarrollo","Desarrollo"],["inmunizaciones","Inmunizaciones"]] as const){const s=c?.[k];if(s?.flags?.length||s?.notas)rows.push([title,[(s.flags??[]).join(", "),s.notas].filter(Boolean).join(" · ")]);}
     }
     return <div style={sec}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
       <h3 style={{...sect,margin:0}}>Antecedentes <span style={{fontSize:11.5,fontWeight:500,color:P.muted}}>(basales, del expediente)</span></h3>
       <div style={{display:"flex",alignItems:"center",gap:8}}>
        {fresh.status==="DUE"&&<span role="status" title={`Última actualización hace ${fresh.days} días (> 6 meses)`} style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:"#FBF0DC",color:P.amberOnPale}}>⟳ Por verificar</span>}
        <button onClick={()=>goExpSection("Antecedentes",setView,setExpTab)} style={{border:0,background:"transparent",color:P.purple,fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>{!antSnap?.recorded?"Capturar en el expediente →":fresh.status==="DUE"?"Verificar en el expediente →":"Editar en el expediente →"}</button>
       </div>
      </div>
      {antSnap?.recorded
       ? <div style={{display:"flex",flexDirection:"column",gap:7,marginTop:10}}>{rows.map(([k,v])=><div key={k} style={{display:"flex",gap:10,fontSize:12.5,padding:"7px 10px",borderRadius:9,background:"#f7f8fc"}}><span style={{fontWeight:800,color:P.purpleOnPale,minWidth:120,flex:"0 0 auto"}}>{k}</span><span style={{minWidth:0,color:"#33383F"}}>{v}</span></div>)}</div>
       : <div style={{fontSize:12.5,color:P.muted,padding:"10px 12px",borderRadius:9,background:"#f6f6fb",border:`1px dashed ${LINE}`,marginTop:10}}>Sin antecedentes capturados. Captúralos una vez en el expediente.</div>}
     </div>;
    })()}

    {/* ═══ O · OBJETIVO ═══ */}
    {soap("O","Objetivo","Signos y exploración")}
    <div style={sec}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={sect}>Signos vitales</h3><span style={{fontSize:12,color:P.muted}}>{clock.toLocaleDateString("es-MX",{day:"numeric",month:"short"})} · {clock.toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"})}</span></div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>{([["TA","ta",V["BP"]??"120/80","mmHg"],["FC","fc",V["HR"]??"72","lpm"],["FR","fr",V["RESP"]??"16","rpm"],["Temp.","temp",V["TEMP"]??"36.5","°C"],["SpO₂","spo2",V["SPO2"]??"98","%"]] as const).map(([l,k,ph,u])=><div key={l}><label htmlFor={`cvit-${k}`} style={{fontSize:11.5,color:P.muted,display:"block",marginBottom:5,fontWeight:600}}>{l}</label><input id={`cvit-${k}`} aria-label={`${l} (${u})`} value={cVit[k]} onChange={e=>setCVit(s=>({...s,[k]:e.target.value}))} placeholder={ph} style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 6px",fontSize:15,fontWeight:700,textAlign:"center",fontFamily:UI,boxSizing:"border-box",color:P.ink}}/><div style={{fontSize:10.5,color:P.muted,textAlign:"center",marginTop:3}}>{u}</div></div>)}</div>
     <div style={{display:"flex",alignItems:"center",gap:10,marginTop:12,flexWrap:"wrap"}}><button onClick={()=>void saveConsultaVitals()} disabled={cVitBusy} style={{border:0,background:cVitBusy?"#C7CCE0":P.purple,color:"#fff",borderRadius:9,padding:"9px 16px",fontWeight:700,fontSize:13,cursor:cVitBusy?"default":"pointer",fontFamily:UI}}>{cVitBusy?"Guardando…":"Guardar signos vitales"}</button><span style={link} {...act(()=>{if(patientId){setExpTab("signos");}})}>Ver historial →</span></div>
     {cVitMsg&&<div style={{marginTop:10,fontSize:12.5,color:cVitMsg.includes("⚠")?"#B3261E":cVitMsg.includes("✓")?P.greenOnPale:P.muted,fontWeight:600}}>{cVitMsg}</div>}
    </div>
    <div style={sec}><h3 style={sect}>Exploración física</h3>
     <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}><button disabled={dis} onClick={()=>addLine("explor","Sin alteraciones aparentes salvo lo descrito; paciente estable, consciente y orientado.",false)} style={chip(true)}>Sin alteraciones</button>{["GENERAL","CABEZA Y CUELLO","CARDIOPULMONAR","ABDOMEN","NEUROLÓGICO","EXTREMIDADES","PIEL"].map(tag=><button key={tag} disabled={dis} onClick={()=>addLine("explor",tag+": ",true)} style={chip(false)}>+ {tag.charAt(0)+tag.slice(1).toLowerCase()}</button>)}</div>
     <textarea style={{...ta,minHeight:90}} disabled={dis} aria-label="Exploración física" value={cForm.explor} onChange={e=>setCForm(f=>({...f,explor:e.target.value.slice(0,2000)}))} placeholder="Exploración física por regiones… usa los botones para estructurar o marcar sin alteraciones."/><div style={cc}>{cForm.explor.length}/2000</div>
     {/* Valoración hepática Child-Pugh — COLAPSADA: niche (solo hepatopatía). Al graduar ascitis/encefalopatía el CDS calcula la clase exacta. */}
     <div style={{marginTop:12,borderTop:`1px solid #F1F3F9`,paddingTop:12}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>{toggle("Valoración hepática (Child-Pugh)",showHepatic,()=>setShowHepatic(v=>!v))}{!showHepatic&&(cForm.ascites||cForm.encef)&&<span style={{fontSize:11.5,color:P.muted}}>· graduada</span>}</div>
      {showHepatic&&<><p style={{fontSize:11.5,color:P.muted,margin:"10px 0"}}>Gradúa ascitis y encefalopatía si hay hepatopatía: completan el Child-Pugh exacto (los laboratorios aportan bilirrubina, albúmina e INR).</p>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
       {([["ascites","Ascitis",[["1","Ninguna"],["2","Leve / controlada"],["3","Moderada / a tensión"]]],["encef","Encefalopatía",[["1","Ninguna"],["2","Grado I–II"],["3","Grado III–IV"]]]] as const).map(([k,label,opts])=>
        <div key={k}><label htmlFor={`cp-${k}`} style={{fontSize:11.5,color:P.muted,display:"block",marginBottom:5,fontWeight:600}}>{label}</label>
         <select id={`cp-${k}`} disabled={dis} value={cForm[k]} onChange={e=>setCForm(f=>({...f,[k]:e.target.value}))} style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 10px",fontSize:13,fontFamily:UI,color:P.ink,background:P.white,boxSizing:"border-box"}}>
          <option value="">Sin valorar</option>{opts.map(([v,l])=><option key={v} value={v}>{v} — {l}</option>)}
         </select></div>)}
       </div></>}
     </div></div>

    {/* ═══ A · ANÁLISIS ═══ (diagnósticos en UN solo lugar — se eliminó la sección duplicada "Impresión diagnóstica") */}
    {soap("A","Análisis","Impresión diagnóstica")}
    <div style={sec}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={sect}>Diagnósticos / Problemas</h3><span style={link} {...act(()=>setExpTab("problemas"))}>Ver historial →</span></div>
     <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}><span style={{fontSize:12,color:P.muted,fontWeight:600}}>Tipo:</span>{([["PROBABLE","Presuntivo"],["CONFIRMED","Confirmado"],["POSSIBLE","Diferencial"]] as ["PROBABLE"|"CONFIRMED"|"POSSIBLE",string][]).map(([v,l])=>{const on=dxType===v;return <button key={v} onClick={()=>setDxType(v)} style={{border:`1px solid ${on?P.purple:LINE}`,background:on?"#F1EFFE":P.white,color:on?P.purple:P.muted,borderRadius:999,padding:"5px 13px",fontSize:12,fontWeight:on?700:500,cursor:"pointer",fontFamily:UI}}>{l}</button>;})}<span style={{fontSize:11,color:P.muted}}>· se aplica al diagnóstico que agregues</span></div>
     <div style={{position:"relative"}}>
      <div style={{display:"flex",alignItems:"center",gap:9,border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 12px"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input aria-label="Buscar diagnóstico CIE-10" value={cDxQuery} onChange={e=>{setCDxQuery(e.target.value);setCDxMsg(null);}} placeholder="Buscar CIE-10 o descripción…" style={{border:0,outline:"none",fontSize:13,fontFamily:UI,color:P.ink,width:"100%",background:"transparent"}}/></div>
      {cDxQuery.trim().length>=2&&(()=>{const res=searchIcd10(cDxQuery.trim(),10);return <div style={{position:"absolute",left:0,right:0,top:"calc(100% + 4px)",background:P.white,border:`1px solid ${LINE}`,borderRadius:10,boxShadow:"0 8px 24px #1a1d2914",zIndex:20,overflow:"hidden"}}>{res.length?res.map(e=><div key={e.code} {...act(()=>{if(cDxBusy)return;void addConsultaProblem(e.code,dxType);})} aria-disabled={cDxBusy||undefined} style={{display:"flex",gap:8,padding:"9px 12px",fontSize:12.5,opacity:cDxBusy?.55:1,cursor:cDxBusy?"default":"pointer",borderBottom:`1px solid #F4F6FB`,alignItems:"baseline"}}><b style={{color:P.purple,flex:"0 0 auto"}}>{e.code}</b><span style={{color:P.ink}}>{e.description}</span></div>):<div style={{padding:"10px 12px",fontSize:12.5,color:P.muted}}>Sin coincidencias en el catálogo CIE-10.</div>}</div>;})()}
     </div>
     {cDxMsg&&<div style={{marginTop:10,fontSize:12.5,color:cDxMsg.includes("✓")?P.greenOnPale:P.muted,fontWeight:600}}>{cDxMsg}</div>}
     <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>{(snap?.problems??[]).slice(0,6).map((c,i)=><span key={c} style={{display:"inline-flex",alignItems:"center",gap:8,background:"#F3F5FA",border:`1px solid ${LINE}`,borderRadius:9,padding:"6px 11px",fontSize:12.5,fontWeight:600}}>{c} {DX_LABEL(c)}{i===0&&<span style={{background:"#EEEBFD",color:P.purpleOnPale,borderRadius:6,padding:"1px 7px",fontSize:10.5,fontWeight:700}}>Principal</span>}</span>)}{(snap?.problems??[]).length===0&&<span style={{fontSize:12.5,color:P.muted}}>Sin problemas activos. Busca un CIE-10 para agregar.</span>}</div>
    </div>

    {/* ═══ P · PLAN ═══ */}
    {soap("P","Plan","Órdenes, tratamiento y seguimiento")}
    {(()=>{
     const CORD:[typeof cOrdCat,string,string[]][]=[["LAB","Laboratorio",["Biometría hemática completa","Química sanguínea (6 elementos)","Perfil lipídico","Examen general de orina","Proteína C reactiva","Exudado faríngeo (cultivo)"]],["IMAGING","Imagen",["Radiografía de tórax PA","Ultrasonido abdominal","Tomografía simple de cráneo","Mastografía"]],["PROCEDURE","Procedimiento",["Electrocardiograma","Espirometría","Prueba de esfuerzo"]],["REFERRAL","Interconsulta",["Cardiología","Endocrinología","Nefrología","Oftalmología"]]];
     const studies=CORD.find(c=>c[0]===cOrdCat)?.[2]??[];
     const tg=(o:string)=>setCOrdSel(s=>s.includes(o)?s.filter(x=>x!==o):[...s,o]);
     return <div style={sec}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={sect}>Órdenes clínicas</h3><span style={link} {...act(()=>setExpTab("medicacion"))}>Medicación →</span></div>
      <div style={{display:"flex",gap:16,borderBottom:`1px solid ${LINE}`,fontSize:13}}>{CORD.map(([k,l])=><span key={k} {...act(()=>{setCOrdCat(k);setCOrdSel([]);setCOrdMsg(null);})} style={{paddingBottom:8,color:cOrdCat===k?P.purple:P.muted,fontWeight:cOrdCat===k?700:400,borderBottom:cOrdCat===k?`2px solid ${P.purple}`:"0",cursor:"pointer"}}>{l}</span>)}</div>
      <div style={{marginTop:12}}>{studies.map(o=>{const on=cOrdSel.includes(o);return <Check key={o} checked={on} label={o} onChange={()=>tg(o)} size={17}/>;})}</div>
      <div style={{display:"flex",gap:10,alignItems:"center",marginTop:8,flexWrap:"wrap"}}><button onClick={()=>void createConsultaOrders()} disabled={cOrdBusy||cOrdSel.length===0} style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:(cOrdBusy||cOrdSel.length===0)?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"9px 16px",fontWeight:700,fontSize:13,cursor:(cOrdBusy||cOrdSel.length===0)?"default":"pointer",fontFamily:UI}}>{cOrdBusy?"Creando…":`Crear ${cOrdSel.length||""} orden${cOrdSel.length===1?"":"es"}`.replace("  "," ")}</button><span style={link} {...act(()=>setView("ordenes"))}>Abrir en Órdenes →</span></div>
      {cOrdMsg&&<div style={{marginTop:10,fontSize:12.5,color:cOrdMsg.includes("✓")?P.greenOnPale:P.muted,fontWeight:600}}>{cOrdMsg}</div>}
     </div>;
    })()}
    <div style={sec}><h3 style={sect}>Plan de manejo</h3>
     <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>{["FARMACOLÓGICO","NO FARMACOLÓGICO","ESTUDIOS","INTERCONSULTA","SEGUIMIENTO","SIGNOS DE ALARMA"].map(tag=><button key={tag} disabled={dis} onClick={()=>setCForm(f=>{if(new RegExp("(^|\\n)"+tag+":").test(f.plan))return f;const sep=f.plan.trim()?"\n":"";return{...f,plan:f.plan+sep+tag+": "};})} style={chip(false)}>+ {tag.charAt(0)+tag.slice(1).toLowerCase()}</button>)}</div>
     <textarea style={{...ta,minHeight:120}} disabled={dis} aria-label="Plan y tratamiento" value={cForm.plan} onChange={e=>setCForm(f=>({...f,plan:e.target.value}))} placeholder="Plan de manejo… usa los botones para estructurar por secciones (farmacológico, estudios, seguimiento, signos de alarma…)."/></div>
   </div>

   {/* Contexto lateral (sticky): resumen del expediente, CDS y recordatorios. */}
   <div className="mos-consulta-side" style={{display:"flex",flexDirection:"column",gap:16,position:"sticky",top:12,alignSelf:"start"}}>
    {/* RESUMEN DEL ACTO — lo documentado EN esta consulta (encounterId), para que la visita se lea como unidad y la firma selle un acto coherente. */}
    {enc&&<div style={{...sec,borderColor:st==="SIGNED"?"#CDEBD8":"#CFE0F7"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={{...sect,margin:0}}>Resumen del acto</h3><span style={{fontSize:11.5,color:P.muted}}>{st==="SIGNED"?"Firmado":"Esta consulta"}</span></div>
     {actTotal===0
      ? <div style={{fontSize:12.5,color:P.muted,marginTop:8}}>Aún no documentas nada en esta consulta. Lo que agregues (problemas, signos, órdenes, recetas) queda ligado a esta visita.</div>
      : <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10}}>{([["Problemas",actProblems.map(x=>x.label)],["Signos",actVitals.map(x=>`${x.vitalType} ${x.value}${x.unit}`)],["Órdenes",actOrders.map(x=>x.label)],["Recetas",actMeds.map(x=>x.label)]] as [string,string[]][]).filter(([,xs])=>xs.length).map(([k,xs])=><div key={k}><div style={{display:"flex",justifyContent:"space-between",fontSize:12.5}}><span style={{fontWeight:700}}>{k}</span><span style={{color:P.purple,fontWeight:700}}>{xs.length}</span></div><div style={{color:P.muted,fontSize:11.5}}>{xs.slice(0,4).join(" · ")}{xs.length>4?` +${xs.length-4}`:""}</div></div>)}</div>}
     <div style={{fontSize:11,color:P.muted,marginTop:10}}>{st==="SIGNED"?"Acto sellado con la firma de esta consulta.":"Al firmar se sella este acto como la visita de hoy."}</div>
    </div>}
    <div style={sec}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={sect}>Resumen clínico</h3><span style={{fontSize:11.5,color:P.muted}}>Derivado del expediente</span></div>
     {rsum("#FDECEE",P.redOnPale,"M12 4l9 15.5H3zM12 10v4M12 17h.01","Alergias",!snap?"No evaluadas: expediente no cargado":snap.allergies.length?snap.allergies.join(", "):"Sin alergias documentadas",<span style={{background:"#FDE7EA",color:P.redOnPale,borderRadius:999,padding:"2px 9px",fontSize:10.5,fontWeight:700}}>{snap?.allergies.length?"Alta":"—"}</span>)}
     {rsum("#EEEBFD",P.purpleOnPale,"M9 4h6v2H9zM7 5H6v16h12V5h-1",`Problemas activos`,snap?.problems.length?snap.problems.map(DX_LABEL).slice(0,3).join(", "):"Sin problemas activos",sgo("Abrir →","Lista de problemas"))}
     {rsum("#E7F0FD",P.blueOnPale,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z","Medicamentos actuales",consTabs===null?"No cargó: confírmelos con el paciente":(consTabs?.medications?.length??0)>0?consTabs.medications.join(", "):"Sin medicamentos activos",sgo("Abrir →","Medicación"))}
     {rsum("#E6F6EE",P.greenOnPale,"M14 4l6 6M6 14l4 4M16.5 6.5l-10 10","Vacunas",consTabs===null?"No cargó":(consTabs?.vaccines?.length??0)>0?[...new Set(consTabs.vaccines.map(v=>v.label))].join(", "):"Sin vacunas aplicadas registradas",sgo("Abrir →","Vacunas"))}
    </div>
    <div style={{...sec,background:"linear-gradient(180deg,#FBFAFF,#fff)"}}><div style={{display:"flex",justifyContent:"space-between"}}><h3 style={{...sect,color:P.purple,display:"flex",alignItems:"center",gap:7}}><NavIcon k="brain"/>Clinical Intelligence (IA)</h3></div><div style={{fontSize:12,fontWeight:600,color:P.muted,marginBottom:8}}>Alertas deterministas para este caso:</div>{findings.length===0?<div style={{fontSize:12.5,lineHeight:1.5,padding:"5px 0",color:P.muted}}>Sin alertas deterministas para los datos registrados. Se recalculan al documentar signos, diagnósticos y medicación.</div>:findings.slice(0,4).map((f,i)=><div key={i} style={{fontSize:12.5,lineHeight:1.5,padding:"5px 0",display:"flex",gap:8}}>• {f.summary}</div>)}<div style={{fontSize:11,color:P.muted,background:"#F3F2FB",borderRadius:8,padding:"8px 10px",marginTop:8}}>La IA ofrece información de apoyo. La decisión final es del médico. (Determinista · sin IA generativa)</div></div>
    <div style={sec}><h3 style={{...sect,display:"flex",alignItems:"center",gap:8}}>Recordatorios y obligaciones {(gaps?.length??0)>0&&<span style={{background:P.redOnPale,color:"#fff",borderRadius:999,padding:"1px 7px",fontSize:11}}>{gaps!.length}</span>}</h3>{gaps===null?<div style={{fontSize:13,color:P.amberOnPale,padding:"9px 0"}}>No evaluados: los recordatorios del paciente no cargaron. Revíselos en el expediente antes de cerrar la consulta.</div>:gaps.length===0?<div style={{fontSize:13,color:P.muted,padding:"9px 0"}}>Sin recordatorios pendientes para este paciente.</div>:gaps!.slice(0,3).map((g,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 0",fontSize:13,borderTop:i?`1px solid #F1F3F9`:"0"}}><div style={{flex:1}}>{g.label}</div><span style={{background:"#FBF0DC",color:P.amberOnPale,borderRadius:999,padding:"2px 9px",fontSize:10.5,fontWeight:700}}>Pendiente</span></div>)}<div style={{textAlign:"right",marginTop:6}}><span style={link} {...act(()=>{goExpSection("Obligaciones de seguimiento",setView,setExpTab);})}>Ver todos →</span></div></div>
   </div>
  </div>

  {/* BARRA DE ACCIÓN FIJA (abajo): estado + vista previa + Guardar/Firmar siempre a la mano en una consulta larga. */}
  <div style={{position:"sticky",bottom:0,zIndex:7,marginTop:4,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",justifyContent:"flex-end",padding:"12px 16px",background:"rgba(252,252,255,.92)",backdropFilter:"blur(6px)",borderTop:`1px solid ${LINE}`,borderRadius:"12px 12px 0 0",boxShadow:"0 -6px 18px rgba(16,42,86,.06)"}}>
   {estadoChip}<span style={{flex:1}}/>
   <button onClick={()=>setCPreview(v=>!v)} style={{display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:cPreview?"#EEEBFD":P.white,color:cPreview?P.purple:P.ink,borderRadius:10,padding:"10px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Vista previa</button>
   {st==="SIGNED"
    /* Firmada: la acción deja de ser "firmar" y pasa a ser "siguiente paciente" — así una jornada de 30 consultas encadena sin volver al menú. */
    ? <button onClick={nextPatient} style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:"linear-gradient(90deg,#16A66A,#12905c)",color:"#fff",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>✓ Firmada · Siguiente paciente →</button>
    : <button onClick={consultaAdvance} disabled={advDisabled} style={{display:"inline-flex",alignItems:"center",gap:8,border:0,background:advDisabled?"#C7CCE0":advBg,color:"#fff",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:13.5,cursor:advDisabled?"default":"pointer",fontFamily:UI}}>{busy==="cadv"?"Procesando…":advLabel}</button>}
  </div>
 </>;
}
