"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "interconsulta" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import {apiRequest} from "../../../lib/session-client";
import{card,LINE,P,UI,act,Skeleton}from"../shared";
import{useWorkspace}from"../context";
export default function InterconsultaView(){
 const{refCtx,icPatientId,patientId,setIcMsg,icMotivo,setIcBusy,icResumen,icSpecialty,setIcMotivo,setIcResumen,setView,icBusy,patientList,patientName,setIcPatientId,setIcSpecialty,icPriority,setIcPriority,icType,setIcType,icMsg,icRecipient,setIcRecipient,icReg,icRegErr,selectPatientRaw}=useWorkspace();

   // ===== MÓDULO INTERCONSULTAS (S-INTERCONSULTA) — form Nueva interconsulta; panel derecho cableado a referral-context =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"10px 12px",fontSize:14,background:P.white,fontFamily:UI,color:P.ink};
   const flbl:React.CSSProperties={fontSize:12.5,fontWeight:700,marginBottom:6};
   const SHORT:Record<string,string>={E11:"DM2",I10:"HTA",E66:"Obesidad",E78:"Dislipidemia",F41:"Ansiedad",F32:"Depresión",J45:"Asma"};
   const shortOf=(code:string)=>SHORT[code.slice(0,3)]??code;
   const hasCtx=!!refCtx;
   // Sin contexto clínico cargado no se afirma "sin alergias" ni "sin medicación" (estado prohibido UNKNOWN+NORMAL).
   const cAllergies=!refCtx?"No evaluadas: contexto no cargado":refCtx.allergies.length?refCtx.allergies.join(", "):"Sin alergias documentadas";
   const cMeds=!refCtx?"No evaluada: contexto no cargado":refCtx.medications.length?refCtx.medications.map(m=>m.charAt(0).toUpperCase()+m.slice(1)).join(", "):"Sin medicación activa documentada";
   const ctxProblems=hasCtx?refCtx!.problems:[];
  // Auditoría 2026-09-19, anexo R05a (R05a-F08): «Sin problemas activos» afirmaba una AUSENCIA sin saber si el contexto
  // llegó a cargar. En una interconsulta eso es grave: quien la recibe lee «sin problemas» y entiende que el paciente no
  // los tiene, cuando puede ser que el expediente no se cargó. «No evaluado» y «confirmado vacío» son cosas distintas y la
  // pantalla tiene que decir cuál es. Once de los catorce indicadores ya lo distinguían; éste era uno de los tres que no.
   const cProblems=!hasCtx?"No evaluados: contexto del expediente no cargado":(ctxProblems.length?ctxProblems.map(p=>shortOf(p.code)).join(", "):"Sin problemas activos");
   const cHba1c=(hasCtx&&refCtx!.labs.hba1c)?`HbA1c ${refCtx!.labs.hba1c}%`:"Sin laboratorios recientes";
   const cVit=hasCtx&&(refCtx!.vitals.bp||refCtx!.vitals.imc)?`TA ${refCtx!.vitals.bp??"—"}  FC ${refCtx!.vitals.hr??"—"}  IMC ${refCtx!.vitals.imc??"—"}`:"Sin signos vitales recientes";
   const icBillTo=icPatientId||patientId;
   const send=async()=>{
    if(!icBillTo){setIcMsg("Selecciona un paciente para enviar la interconsulta.");return;}
    if(!icMotivo.trim()){setIcMsg("El motivo de interconsulta es obligatorio.");return;}
    setIcBusy(true);setIcMsg("");
    const reason=icResumen.trim()?`${icMotivo.trim()}\n\nResumen clínico: ${icResumen.trim()}`:icMotivo.trim();
    // Lote G — la interconsulta viaja con su destinatario (directorio), prioridad y tipo: ya no se descartan en la UI.
    const rec=icRecipient.trim();
    try{const r=await apiRequest("/api/v1/referrals",{method:"POST",body:{referralId:crypto.randomUUID(),patientId:icBillTo,specialty:icSpecialty,reason,...(rec?{recipientName:rec}:{}),priority:icPriority,referralType:icType,occurredAt:new Date().toISOString()}});
     if(r.status===201||r.status===200){setIcMsg("Interconsulta enviada ✓");setIcMotivo("");setIcResumen("");setIcRecipient("");}
     else setIcMsg("No se pudo enviar (estado "+r.status+").");
    }catch{setIcMsg("Error al enviar la interconsulta.");}finally{setIcBusy(false);}
   };
   const infoRow=(c:string,d:string,l:string,v:string)=><div style={{display:"flex",alignItems:"center",gap:11,padding:"11px 0",borderBottom:`1px solid #F2F4F9`,cursor:"pointer"}}><span style={{width:32,height:32,borderRadius:9,background:c+"22",color:c,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={d}/></svg></span><div style={{flex:1,minWidth:0}}><div style={{fontSize:12.5,fontWeight:700}}>{l}</div><div style={{fontSize:12,color:P.muted}}>{v}</div></div><span style={{color:P.muted}}>›</span></div>;
   const clip="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"center",gap:14}}><button onClick={()=>setView("exp")} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>← Volver</button><div><h1 style={{fontSize:26,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Nueva interconsulta</h1><p style={{color:P.muted,fontSize:13,margin:"3px 0 0"}}>Solicita una valoración por otra especialidad y da seguimiento al proceso.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button onClick={send} disabled={icBusy} style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>{icBusy?"Enviando…":"➤ Enviar interconsulta"}</button></div>
    </div>
    <div style={{...card2,marginTop:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
     {(()=>{const bp=(patientList??[]).find(p=>p.patientId===icBillTo);const bname=bp?bp.name:patientName;return <div style={{display:"flex",alignItems:"center",gap:13,minWidth:0,flexWrap:"wrap"}}><span style={{width:48,height:48,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:15,fontWeight:700,flex:"0 0 auto"}}>{initials(bname||"—")}</span><div style={{minWidth:0}}><select aria-label="Paciente de la interconsulta" value={icPatientId||(bp?patientId:"")} onChange={e=>setIcPatientId(e.target.value)} style={{border:`1px solid ${LINE}`,borderRadius:8,padding:"7px 10px",fontSize:15,fontWeight:700,fontFamily:UI,color:P.ink,background:P.white}}><option value="">Selecciona un paciente…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select><div style={{fontSize:12.5,color:P.muted,marginTop:4}}>{bp?(bp.curp?`CURP: ${bp.curp}`:"Paciente del tenant"):"Elige a quién se solicita la interconsulta"}</div></div></div>;})()}
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}><span style={{width:32,height:32,borderRadius:9,background:P.blue+"22",color:P.blue,display:"grid",placeItems:"center"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={clip}/></svg></span><div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{ctxProblems.length}</div><div style={{fontSize:11,color:P.muted}}>Problemas activos</div></div></div>
      <div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}><span style={{width:32,height:32,borderRadius:9,background:P.green+"22",color:P.green,display:"grid",placeItems:"center"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z"/></svg></span><div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{hasCtx?refCtx!.medications.length:0}</div><div style={{fontSize:11,color:P.muted}}>Medicamentos</div></div></div>
      <div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}><span style={{width:32,height:32,borderRadius:9,background:P.red+"22",color:P.red,display:"grid",placeItems:"center"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg></span><div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{hasCtx?refCtx!.allergies.length:0}</div><div style={{fontSize:11,color:P.muted}}>{(hasCtx?refCtx!.allergies.length:0)===1?"Alergia":"Alergias"}</div></div></div>
      <button onClick={()=>setView("exp")} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver expediente →</button>
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 330px",gap:16,marginTop:16,alignItems:"start"}} className="mos-ic">
     {/* Columna principal: form */}
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{padding:"16px 22px 0",fontSize:16,fontWeight:800}}>Datos de la interconsulta</div>
      <div style={{padding:22}}>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
        <div><div style={flbl}>Especialidad <span style={{color:P.red}}>*</span></div><select aria-label="Especialidad" value={icSpecialty} onChange={e=>setIcSpecialty(e.target.value)} style={selSty}>{["Endocrinología","Cardiología","Nutrición","Ginecología","Psiquiatría","Dermatología","Nefrología","Neurología"].map(o=><option key={o}>{o}</option>)}</select></div>
        <div><div style={flbl}>Prioridad <span style={{color:P.red}}>*</span></div><select aria-label="Prioridad" value={icPriority} onChange={e=>setIcPriority(e.target.value)} style={selSty}>{["Preferente (2–4 semanas)","Urgente (48–72 h)","Rutina (4–8 semanas)"].map(o=><option key={o}>{o}</option>)}</select></div>
        <div><div style={flbl}>Tipo de interconsulta <span style={{color:P.red}}>*</span></div><select aria-label="Tipo de interconsulta" value={icType} onChange={e=>setIcType(e.target.value)} style={selSty}>{["Primera vez","Subsecuente","Segunda opinión"].map(o=><option key={o}>{o}</option>)}</select></div>
       </div>
       <div style={{marginTop:16}}><div style={flbl}>Médico o institución (opcional)</div><div style={{position:"relative"}}><input list="ic-directory" value={icRecipient} onChange={e=>setIcRecipient(e.target.value)} placeholder="Nombre del especialista o institución…" style={{...selSty,paddingLeft:34}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="1.9" style={{position:"absolute",left:11,top:12}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
        {/* Lote G — directorio auto-formado con los destinatarios ya usados (sin backend de CRUD): sugerencias reales. */}
        <datalist id="ic-directory">{(icReg?.directory??[]).map(d=><option key={d.name} value={d.name}>{d.specialty}{d.institution?` · ${d.institution}`:""}</option>)}</datalist>
       </div></div>
       <div style={{marginTop:16}}><div style={flbl}>Motivo de interconsulta <span style={{color:P.red}}>*</span></div><textarea value={icMotivo} onChange={e=>setIcMotivo(e.target.value.slice(0,500))} placeholder="Describe el motivo de la valoración solicitada..." style={{...selSty,minHeight:84,resize:"vertical"}}/><div style={{textAlign:"right",fontSize:11,color:P.muted}}>{icMotivo.length}/500</div></div>
       <div style={{marginTop:12}}><div style={flbl}>Resumen clínico <span style={{color:P.red}}>*</span></div>
        <textarea value={icResumen} onChange={e=>setIcResumen(e.target.value.slice(0,1000))} placeholder="Resumen del cuadro clínico, tratamiento actual y evolución..." style={{...selSty,minHeight:110,resize:"vertical",lineHeight:1.5}}/>
        <div style={{textAlign:"right",fontSize:11,color:P.muted}}>{icResumen.length}/1000</div>
       </div>
       <div style={{marginTop:12}}><div style={flbl}>Diagnósticos del expediente (contexto)</div>{!hasCtx?<div style={{fontSize:12.5,color:P.muted}}>No evaluados: el contexto del expediente no cargó.</div>:ctxProblems.length===0?<div style={{fontSize:12.5,color:P.muted}}>Sin problemas activos en el expediente del paciente.</div>:<div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:4}}>{ctxProblems.map((p,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:7,background:"#EEEBFD",color:P.purple,borderRadius:8,padding:"6px 10px",fontSize:12.5,fontWeight:600}}><b style={{fontWeight:700}}>{p.code}</b>{p.description}</span>)}</div>}<div style={{fontSize:11.5,color:P.muted,marginTop:6}}>Se toman del expediente; edítalos en el módulo «Problemas».</div></div>
       {icMsg&&<div style={{marginTop:14,padding:"10px 13px",borderRadius:10,background:icMsg.includes("✓")?"#E6F6EE":"#FDF4E6",border:`1px solid ${icMsg.includes("✓")?"#BFE6CF":"#F2E1C0"}`,fontSize:13,color:icMsg.includes("✓")?"#166534":"#7A5A16"}}>{icMsg}</div>}
      </div>
     </div>
     {/* Columna derecha: contexto real del paciente */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:6}}>Información relevante del paciente</div>
       {infoRow(P.red,"M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z","Alergias",cAllergies)}
       {infoRow(P.green,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z","Medicamentos actuales",cMeds)}
       {infoRow(P.blue,clip,"Problemas activos",cProblems)}
       {infoRow(P.amber,"M9 3h6l1 4H8zM7 7h10l1 13H6z","Últimos laboratorios",cHba1c)}
       {infoRow(P.red,"M12 21C12 21 4 13.5 4 8.5A4 4 0 0112 6a4 4 0 018 2.5C20 13.5 12 21 12 21z","Signos vitales (última)",cVit)}
      </div>
      <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:8}}>Plantillas rápidas</div>{[["Endocrinología – DM2","Endocrinología","Valoración y manejo integral de diabetes mellitus tipo 2 con resistencia a la insulina."],["Cardiología – HTA","Cardiología","Valoración de hipertensión arterial y riesgo cardiovascular."],["Ginecología – SOP","Ginecología","Valoración por síndrome de ovario poliquístico."],["Nutrición – Obesidad","Nutrición","Valoración nutricional y plan de manejo de obesidad."],["Psiquiatría – Ansiedad/Depresión","Psiquiatría","Valoración por síntomas ansioso-depresivos."],["Dermatología – Acné","Dermatología","Valoración dermatológica por acné."]].map(([l,sp,mo],i)=><div key={i} {...act(()=>{setIcSpecialty(sp as string);setIcMotivo(mo as string);})} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<5?`1px solid #F2F4F9`:"0",fontSize:13,color:P.ink,fontWeight:500,cursor:"pointer"}}><span style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:P.blue}}>▤</span>{l}</span><span style={{color:P.muted}}>›</span></div>)}</div>
      <div style={{...card2,padding:16,background:"#F7F6FE",borderColor:"#E2DEFB"}}><div style={{display:"flex",gap:10}}><span style={{color:P.purple}}>💡</span><div><div style={{fontWeight:700,fontSize:13}}>Tip</div><div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Incluye laboratorios, estudios de imagen y un resumen clínico claro para una mejor y más rápida atención.</div></div></div></div>
     </div>
    </div>
    {/* Lote G — directorio de destinatarios + registro POBLACIONAL de interconsultas (GET /api/v1/referrals). */}
    {(()=>{
     const th:React.CSSProperties={textAlign:"left",fontSize:11,color:P.muted,fontWeight:600,padding:"9px 12px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
     const tdc:React.CSSProperties={padding:"9px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,verticalAlign:"middle"};
     const fmtD=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
     const stSty=(st:string):React.CSSProperties=>{const m:Record<string,[string,string]>={REQUESTED:["#E7EEFB",P.blueOnPale],ACCEPTED:["#EEEBFD",P.purple],COMPLETED:["#E6F6EE",P.greenOnPale],DECLINED:["#FBF0DC",P.amberOnPale],CANCELLED:["#FDECEE",P.redOnPale]};const[b,f]=m[st]??m.REQUESTED!;return{background:b,color:f,borderRadius:16,padding:"3px 11px",fontSize:11.5,fontWeight:700,whiteSpace:"nowrap"};};
     const dir=icReg?.directory??[];
     return <div style={{...card2,marginTop:16,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",borderBottom:`1px solid ${LINE}`,flexWrap:"wrap",gap:10}}>
       <div><div style={{fontSize:16,fontWeight:800}}>Interconsultas · Toda la clínica</div><div style={{fontSize:12,color:P.muted}}>Directorio de destinatarios (se forma con los que ya usaste) e interconsultas de todos los pacientes.</div></div>
       {icReg&&<div style={{display:"flex",gap:18,flexWrap:"wrap"}}>{([["Interconsultas",icReg.total,P.ink],["Abiertas",icReg.openCount,P.blueOnPale],["Completadas",icReg.completedCount,P.greenOnPale],["Destinatarios",icReg.recipientsCount,P.purple]] as [string,number,string][]).map(([l,n,c])=><div key={l} style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:800,color:c,fontVariantNumeric:"tabular-nums"}}>{n}</div><div style={{fontSize:11,color:P.muted}}>{l}</div></div>)}</div>}
      </div>
      <div style={{padding:"12px 18px 0"}}>
       <div style={{fontSize:12.5,fontWeight:700,color:P.muted,marginBottom:8}}>Directorio de profesionales{dir.length?` (${dir.length})`:""}</div>
       {dir.length===0?<div style={{fontSize:12.5,color:P.muted,paddingBottom:12}}>Aún no hay destinatarios. El primero que nombres en una interconsulta se guardará aquí para reutilizarlo.</div>
        :<div style={{display:"flex",flexWrap:"wrap",gap:8,paddingBottom:12}}>{dir.map(d=><button key={d.name} onClick={()=>{setIcRecipient(d.name);if(d.specialty)setIcSpecialty(d.specialty);}} title="Usar este destinatario en la nueva interconsulta" style={{display:"flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,background:P.white,borderRadius:999,padding:"6px 12px",cursor:"pointer",fontFamily:UI}}><span style={{width:24,height:24,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700}}>{initials(d.name)}</span><span style={{fontSize:12.5,fontWeight:600}}>{d.name}</span><span style={{fontSize:11,color:P.muted}}>{d.specialty}{d.institution?` · ${d.institution}`:""}</span><span style={{fontSize:11,fontWeight:700,color:P.purple}}>{d.count}</span></button>)}</div>}
      </div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr>{["Paciente","Especialidad","Destinatario","Estado","Fecha",""].map((h,i)=><th key={i} style={th}>{h}</th>)}</tr></thead>
       <tbody>
        {(icReg?.items??[]).slice(0,20).map(it=><tr key={it.referralId}>
         <td style={tdc}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:26,height:26,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>{initials(it.patientName)}</span><span style={{fontWeight:600}}>{it.patientName}</span></div></td>
         <td style={tdc}>{it.specialty}</td>
         <td style={tdc}>{it.recipientName||<span style={{color:P.muted}}>—</span>}{it.recipientInstitution?<div style={{fontSize:11,color:P.muted}}>{it.recipientInstitution}</div>:null}</td>
         <td style={tdc}><span style={stSty(it.status)}>{it.statusLabel}</span></td>
         <td style={{...tdc,color:P.muted}}>{fmtD(it.requestedAt)}</td>
         <td style={tdc}><button onClick={()=>{selectPatientRaw(it.patientId,it.patientName);setView("exp");}} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:8,padding:"5px 10px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:UI}}>Abrir expediente →</button></td>
        </tr>)}
        {icReg&&icReg.items.length===0&&<tr><td colSpan={6} style={{...tdc,textAlign:"center",color:P.muted,padding:"24px"}}>Aún no hay interconsultas registradas en el consultorio.</td></tr>}
        {!icReg&&(icRegErr?<tr><td colSpan={6} style={{...tdc,textAlign:"center",color:P.muted,padding:"24px"}}>No se pudo cargar el registro de la clínica.</td></tr>:Array.from({length:6}).map((_,i)=><tr key={"sk"+i} aria-hidden><td style={tdc}><div style={{display:"flex",alignItems:"center",gap:8}}><Skeleton w={26} h={26} r={13}/><Skeleton w={"60%"} h={12}/></div></td><td style={tdc}><Skeleton w={"70%"} h={12}/></td><td style={tdc}><Skeleton w={"70%"} h={12}/></td><td style={tdc}><Skeleton w={70} h={20} r={16}/></td><td style={tdc}><Skeleton w={80} h={12}/></td><td style={tdc}><Skeleton w={128} h={26} r={8}/></td></tr>))}
       </tbody></table></div>
     </div>;
    })()}
   </div>;

}
