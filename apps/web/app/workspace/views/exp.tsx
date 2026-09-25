"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "exp" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import {summarizePatient} from "../../../../../packages/patient-summary/src";
import {labReferenceRanges,acceptedUnitsOf,canonicalUnitOf} from "../../../../../packages/lab-reference/src";
import{PatientHeader,AllergyBanner}from"../../../../../packages/design-system/src";
import{avisoDeZona,SOLO_ESTA_PANTALLA,anchor,P,mono,ghost,DX_LABEL,LINE,card,SEX_ES,scrollToSection,UI,SEV,FOLLOW_TYPES,TYPE_LABEL,followState,relTime,CANCEL_KINDS,input,btn,stateBadge,lbl,DOSE_UNITS,medNext,resNext,CHART,trendChart,alActions,probActions,orderNext,referralNext,apptNext,immActions,vitActions,cpActions,clmActions,csActions,admActions,spNext,incActions,trActions,wnActions,tfNext,sgNext,dzActions,docNext,obNext,BARRIER_LABEL,type TrendKey}from"../shared";
import{useWorkspace}from"../context";
export default function ExpView(){
 const{cfgSettings,consTabs,patientName,patientId,summary,anyAlert,highGaps,safetyChip,alertGlyph,reset,snap,tl,gaps,followTab,setFollowTab,busy,loadPanel,panel,selectPatientRaw,regName,setRegName,regDob,setRegDob,regSex,setRegSex,registerPatient,guardianFields,dupPanel,regExtra,setRegExtra,patientQuery,setPatientQuery,loadPatients,patientTotal,patientList,patientMore,exportRecord,loadTimeline,exportInfo,enc,setPatientId,openEncounter,assessment,setAssessment,plan,setPlan,saveAssessment,signEncounter,drug,setDrug,doseAmt,setDoseAmt,doseUnit,setDoseUnit,route,setRoute,freq,setFreq,dose,proposeMed,meds,printPrescription,advanceMed,rxDrug,setRxDrug,setRxCheck,rxDoseAmt,setRxDoseAmt,rxDoseUnit,setRxDoseUnit,rxRoute,setRxRoute,rxFreq,setRxFreq,rxDose,verifyRx,rxMsg,rxCheck,sendRx,resQuick,setResQuick,receiveResult,results,advanceResult,setTrendKey,trendKey,trends,alSub,setAlSub,alSev,setAlSev,alReac,setAlReac,createAllergy,allergies,doAllergyAction,probCode,setProbCode,createProblem,problems,doProblemAction,orderType,setOrderType,orderDetail,setOrderDetail,createOrder,orders,advanceOrder,refSpecialty,setRefSpecialty,refReason,setRefReason,createReferral,referrals,advanceReferral,cancelReferral,apptStart,setApptStart,apptReason,setApptReason,apptCons,setApptCons,apptType,setApptType,createAppointment,appts,advanceAppt,closeAppt,immCode,setImmCode,immDose,setImmDose,createImmunization,imms,doImmAction,vitType,setVitType,vitValue,setVitValue,vitUnit,setVitUnit,createVital,vitals,doVitAction,planCat,setPlanCat,planGoal,setPlanGoal,createPlan,plans,doPlanAction,clmAmount,setClmAmount,clmCurrency,setClmCurrency,createClaim,claims,doClaimAction,csType,setCsType,csRef,setCsRef,createConsent,consents,doConsentAction,hospitalOn,admUnit,setAdmUnit,admReason,setAdmReason,createAdmission,adms,doAdmAction,specType,setSpecType,createSpecimen,specs,advanceSpecimen,rejectSpecimen,incCat,setIncCat,incSev,setIncSev,incDesc,setIncDesc,createIncident,incs,doIncAction,trComplaint,setTrComplaint,createTriage,triages,doTriageAction,wnLoc,setWnLoc,wnStage,setWnStage,createWound,wounds,doWoundAction,tfProduct,setTfProduct,tfUnits,setTfUnits,createTransfusion,transfs,advanceTransfusion,transfusionReaction,sgProc,setSgProc,sgLat,setSgLat,createSurgery,surgs,advanceSurgery,cancelSurgery,dzMod,setDzMod,dzAcc,setDzAcc,createDialysis,dialz,doDialysisAction,docTitle,setDocTitle,docType,setDocType,docContent,setDocContent,createDoc,docs,advanceDoc,obKind,setObKind,createObligation,obligations,advanceObligation,overrideMed,overrideWhy,setOverrideWhy,setOverrideMed,confirmOverrideMed,pendingIrreversible,confirmIrreversible,cancelIrreversible,ackMed,ackWhy,setAckWhy,setAckMed,confirmAckMed,error}=useWorkspace();

 return <>
  {/* PATIENT HEADER — contexto del paciente SIEMPRE visible (design-contract); componente del design system (K-09) */}
  <PatientHeader name={patientName} patientId={patientId}
   status={summary&&(anyAlert
     ? <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        {highGaps>0&&safetyChip(highGaps,"críticos","crit",alertGlyph)}
        {summary.activeAllergies>0&&safetyChip(summary.activeAllergies,"alergias","warn")}
        {summary.openResults>0&&safetyChip(summary.openResults,"result. abiertos","warn")}
        {summary.openObligations>0&&safetyChip(summary.openObligations,"obligaciones","warn")}
       </div>
     : <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#EAF7EF",color:"#1A7F43",border:"1px solid #CDEBD8",borderRadius:999,padding:"4px 12px",fontSize:12.5,fontWeight:600,whiteSpace:"nowrap"}}>✓ Sin alertas de seguridad</span>
    )}
   actions={<button style={{...ghost,padding:"7px 12px",fontSize:13,flex:"0 0 auto"}} onClick={reset}>+ Paciente anónimo</button>}/>
  <main className="mos-grid">
  {/* HERO — Vista principal · Durante la consulta (panel 1, snapshot determinista) */}
  {snap&&(()=>{
   const d=snap.demographics;
   const dx=[...new Set(snap.problems.map(DX_LABEL))].slice(0,6);
   const bp=snap.vitals["BP"],hr=snap.vitals["HR"];
   const vcard=(label:string,value:string|number|undefined,unit:string,sub:string,warn?:boolean)=>(
    <div style={{minWidth:0,background:"#fff",border:`1px solid ${warn?"#F0DBB8":LINE}`,borderRadius:14,padding:"14px 16px"}}>
     <div style={{fontSize:12,color:P.muted,marginBottom:4}}>{label}</div>
     <div style={{fontSize:24,fontWeight:800,letterSpacing:"-.01em",color:warn?"#A15C00":P.ink}}>{value??"—"} <span style={{fontSize:13,fontWeight:600,color:P.muted}}>{value!==undefined?unit:""}</span></div>
     <div style={{fontSize:11.5,color:P.muted,marginTop:2}}>{sub||" "}</div>
    </div>);
   const tabs:[string,string?][]=[["Resumen"],["Historia","Timeline del paciente"],["Medicamentos","Medicación"],["Resultados","Resultados diagnósticos"],["Problemas","Lista de problemas"],["Plan","Plan de cuidados"],["Seguimiento","Obligaciones de seguimiento"]];
   return <section className="span2" style={{...card,marginTop:0,padding:0,overflow:"hidden"}}>
    <div style={{padding:"18px 22px",borderBottom:`1px solid ${LINE}`,background:"linear-gradient(180deg,#FBFCFE,#fff)"}}>
     <div style={{fontSize:17,fontWeight:800,letterSpacing:"-.01em"}}>Vista principal · Durante la consulta</div>
     <div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Toda la información crítica, en el momento correcto.</div>
    </div>
    <div className="mos-hero-grid">
     <div style={{padding:22,borderRight:`1px solid ${LINE}`}}>
      <div style={{display:"flex",gap:14,alignItems:"center"}}>
       <span style={{width:52,height:52,borderRadius:"50%",background:"#E7EEFB",color:P.blue,display:"grid",placeItems:"center",fontWeight:800,fontSize:18,flex:"0 0 auto"}}>{(patientName||"P").trim().slice(0,2).toUpperCase()}</span>
       <div style={{minWidth:0}}>
        <div style={{fontSize:19,fontWeight:800}}>{patientName||"Paciente"}</div>
        <div style={{fontSize:13,color:P.muted}}>{d.age} años · {SEX_ES[d.sex]??d.sex} · ID <span style={mono}>{patientId.slice(0,8)}</span></div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>{dx.length?dx.map(x=><span key={x} style={{background:"#EEF3FB",color:"#2C5AA6",border:"1px solid #D3E0F5",borderRadius:8,padding:"2px 9px",fontSize:12,fontWeight:600}}>{x}</span>):<span style={{fontSize:12,color:P.muted}}>Sin diagnósticos activos</span>}</div>
       </div>
      </div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:16,borderBottom:`1px solid ${LINE}`}}>
       {tabs.map(([t,h2],i)=><button key={t} onClick={()=>h2&&scrollToSection(h2)} style={{background:"transparent",border:0,borderBottom:i===0?`2px solid ${P.blue}`:"2px solid transparent",color:i===0?P.blue:P.muted,fontWeight:i===0?700:500,fontSize:13,fontFamily:UI,padding:"7px 10px",cursor:"pointer"}}>{t}</button>)}
      </div>
      <div style={{fontSize:13,fontWeight:700,margin:"16px 0 10px"}}>Estado clínico actual</div>
      <div className="mos-vitals">
       {vcard("Presión arterial",bp,"mmHg",hr?`FC ${hr} lpm`:"")}
       {vcard("Glucosa",snap.labs.glucose,"mg/dL","")}
       {vcard("HbA1c",snap.labs.hba1c,"%",snap.labs.hba1c!==undefined?(snap.labs.hba1c<7?"En meta (<7%)":"Sobre meta"):"",snap.labs.hba1c!==undefined&&snap.labs.hba1c>=7)}
       {vcard("TFG (eGFR)",snap.labs.egfr,"mL/min",snap.labs.egfrStage?`TFG ${snap.labs.egfrStage} (puntual)`:"",!!snap.labs.egfrStage&&snap.labs.egfrStage!=="G1"&&snap.labs.egfrStage!=="G2")}
      </div>
      <div style={{fontSize:13,fontWeight:700,margin:"18px 0 8px"}}>Problemas activos</div>
      {snap.problems.length?<div style={{display:"flex",flexDirection:"column",gap:6}}>{snap.problems.slice(0,6).map(c=><div key={c} style={{display:"flex",alignItems:"center",gap:10,fontSize:13.5}}><span style={{width:7,height:7,borderRadius:"50%",background:P.blue,flex:"0 0 auto"}}/>{DX_LABEL(c)} <span style={mono}>{c}</span></div>)}</div>:<div style={{fontSize:13,color:P.muted}}>Sin problemas activos.</div>}
     </div>
     <div style={{padding:22,display:"flex",flexDirection:"column",gap:18,background:"#FCFDFF"}}>
      <div>
       <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Alergias y seguridad</div>
       <AllergyBanner allergies={snap.allergies}/>
      </div>
      <div style={{borderTop:`1px solid ${LINE}`,paddingTop:16}}>
       <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Alertas y sugerencias</div>
       <div style={{fontSize:11.5,color:P.muted,marginBottom:10}}>Reglas + guías · determinista, sin IA generativa</div>
       {snap.findings.length?<div style={{display:"flex",flexDirection:"column",gap:8}}>{snap.findings.slice(0,6).map((f,i)=>{const s=SEV[f.severity]??SEV.INFO;return <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"9px 11px",borderRadius:10,background:s.bg,border:`1px solid ${s.bd}`}}>
        <span style={{background:"#fff",color:s.fg,border:`1px solid ${s.bd}`,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:800,letterSpacing:".03em",whiteSpace:"nowrap",marginTop:1}}>{s.label}</span>
        <span style={{fontSize:13,color:"#33383F",lineHeight:1.4}}>{f.summary}</span>
       </div>;})}{snap.findings.length>6&&<div style={{fontSize:11.5,fontWeight:700,color:"#A15C00"}}>+{snap.findings.length-6} hallazgo(s) más no mostrados aquí: ábralos en Clinical Intelligence.</div>}</div>:<div style={{fontSize:13,color:"#1A7F43",fontWeight:600}}>✓ Sin alertas clínicas.</div>}
      </div>
     </div>
    </div>
   </section>;
  })()}
  {/* SEGUIMIENTO AUTOMÁTICO (panel 5) — Zero-Lost-Follow-Up desde timeline + care-gaps */}
  <section style={card}>
   <div><h2 {...anchor("Seguimiento automático")} style={{fontSize:18,margin:0}}>Seguimiento automático</h2><p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Nada se pierde. Todo se coordina. Obligaciones e interconsultas con owner y cierre.</p></div>
   {(()=>{
    const fromTl=(tl??[]).filter(t=>FOLLOW_TYPES.has(t.aggregateType)).map(t=>({label:TYPE_LABEL[t.aggregateType]??t.aggregateType,kind:t.latestKind,at:t.lastAt,status:followState(t.latestKind),type:t.aggregateType}));
    const fromGaps=(gaps??[]).map(g=>({label:g.label,kind:g.priority,at:"",status:"pend" as const,type:g.aggregateType}));
    const all=[...fromTl.filter(x=>x.status!=="skip"),...fromGaps];
    const counts={pend:all.filter(x=>x.status==="pend").length,prog:all.filter(x=>x.status==="prog").length,done:all.filter(x=>x.status==="done").length,all:all.length};
    const shown=followTab==="all"?all:all.filter(x=>x.status===followTab);
    const tabs:[typeof followTab,string,number][]=[["pend","Pendientes",counts.pend],["prog","Programados",counts.prog],["done","Completados",counts.done],["all","Todos",counts.all]];
    const sb=(s:string)=>s==="pend"?{bg:"#FFF4E5",fg:"#A15C00",t:"Pendiente"}:s==="prog"?{bg:"#EAF3FF",fg:"#1F5FB0",t:"Programado"}:{bg:"#EAF7EF",fg:"#1A7F43",t:"Completado"};
    return <>
     <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:12,borderBottom:`1px solid ${LINE}`}}>
      {tabs.map(([k,l,n])=><button key={k} onClick={()=>setFollowTab(k)} style={{background:"transparent",border:0,borderBottom:followTab===k?`2px solid ${P.blue}`:"2px solid transparent",color:followTab===k?P.blue:P.muted,fontWeight:followTab===k?700:500,fontSize:13,fontFamily:UI,padding:"7px 10px",cursor:"pointer"}}>{l} {n>0&&<span style={{fontVariantNumeric:"tabular-nums"}}>({n})</span>}</button>)}
     </div>
     {shown.length?<div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>{shown.slice(0,8).map((x,i)=>{const s=sb(x.status);const stripe=x.status==="pend"?"#C87B12":x.status==="prog"?"#1769E0":"#168B5B";return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px 10px 14px",border:`1px solid ${LINE}`,borderLeft:`3px solid ${stripe}`,borderRadius:10}}>
      <div style={{minWidth:0}}><div style={{fontSize:13.5,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{x.label}</div><div style={{fontSize:11.5,color:P.muted}}>{x.at?relTime(x.at):"seguimiento clínico"}</div></div>
      <span style={{background:s.bg,color:s.fg,fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap"}}>{s.t}</span>
     </div>;})}</div>:<div style={{marginTop:12,padding:"12px 14px",borderRadius:12,background:"#f4faf6",border:"1px solid #d6ecdd",fontSize:13,color:"#1a7f43"}}>✓ Sin seguimientos {followTab==="pend"?"pendientes":followTab==="prog"?"programados":followTab==="done"?"completados":"registrados"}.</div>}
     <div style={{display:"flex",alignItems:"center",gap:8,marginTop:14,padding:"10px 14px",borderRadius:12,background:"#EAF7EF",border:"1px solid #CDEBD8",fontSize:12.5,color:"#1A7F43",fontWeight:600}}>✓ Seguimiento activo — el sistema mantiene owner, estado y cierre de cada obligación (Zero-Lost-Follow-Up).</div>
    </>;
   })()}
  </section>

  {/* SEGURIDAD Y AUDITORÍA (panel 7) — estado del sistema + actividad desde la cadena de auditoría */}
  <section className="span2" style={card}>
   <div><h2 {...anchor("Seguridad y auditoría")} style={{fontSize:18,margin:0}}>Seguridad y auditoría</h2><p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Confianza por diseño. Cada acción clínica queda registrada.</p></div>
   <div className="mos-rx-grid">
    <div style={{background:"linear-gradient(160deg,#0C2148,#15346B)",borderRadius:14,padding:"16px 18px",color:"#EAF0FA"}}>
     <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{width:22,height:22,borderRadius:"50%",background:"#1A7F43",display:"grid",placeItems:"center",fontSize:13}}>✓</span><b style={{fontSize:14}}>Estado del sistema</b></div>
     {[["Cifrado de datos","En tránsito (HTTPS); en reposo, por el proveedor de base de datos"],["Control de acceso","Por rol y scope, con aislamiento por consultorio (RLS forzado)"],["Auditoría","Cadena de hash inmutable de cada comando clínico, verificable (pnpm audit:verify)"],["Recuperabilidad","Registro de eventos append-only; el cliente reintenta con la misma clave de idempotencia"],["Normativa","NOM-004 / NOM-024 / LFPDPPP: en proceso; sin certificación (ver registro normativo del proyecto)"]].map(([t,d])=><div key={t} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"7px 0",borderTop:"1px solid #ffffff14"}}>
      <span style={{color:"#5FD08C",marginTop:1,flex:"0 0 auto"}}>●</span><div><div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{t}</div><div style={{fontSize:11.5,color:"#9DB2D4"}}>{d}</div></div>
     </div>)}
    </div>
    <div>
     <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Actividad reciente</div>
     {tl&&tl.length?<div style={{display:"flex",flexDirection:"column",gap:2}}>{tl.slice(0,7).map((t,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderBottom:i<6?`1px solid ${LINE}`:"0"}}>
      <span style={{width:26,height:26,borderRadius:8,background:"#EEF3FB",color:P.blue,display:"grid",placeItems:"center",fontSize:11,fontWeight:800,flex:"0 0 auto"}}>{(TYPE_LABEL[t.aggregateType]??t.aggregateType).slice(0,1)}</span>
      <div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{TYPE_LABEL[t.aggregateType]??t.aggregateType} · <span style={{color:P.muted,fontWeight:500}}>{t.latestKind}</span></div><div style={{fontSize:11.5,color:P.muted}}>{relTime(t.lastAt)}</div></div>
     </div>)}</div>:<div style={{fontSize:13,color:P.muted,padding:"12px 0"}}>Sin actividad registrada para este paciente todavía.</div>}
    </div>
   </div>
  </section>

  {/* PORTAL DEL PACIENTE (panel 6) — vista previa (solo lectura) del app del paciente, desde datos reales */}
  <section style={card}>
   <div><h2 {...anchor("Portal del paciente")} style={{fontSize:18,margin:0}}>Portal del paciente</h2><p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Informado. Involucrado. Vista previa (solo lectura) de lo que ve el paciente en su app.</p></div>
   {(()=>{
    const t=tl??[];
    const appts=t.filter(x=>x.aggregateType==="Appointment");
    const nextAppt=appts.find(x=>x.latestKind==="SCHEDULED"||x.latestKind==="CHECKED_IN");
    const resultsN=t.filter(x=>x.aggregateType==="DiagnosticResult").length;
    const medsN=t.filter(x=>x.aggregateType==="Medication"&&!CANCEL_KINDS.has(x.latestKind)).length;
    const followN=(gaps?.length??0)+t.filter(x=>x.aggregateType==="ClinicalObligation"&&followState(x.latestKind)==="pend").length;
    const first=(patientName||"Paciente").trim().split(/\s+/)[0];
    const row=(icon:React.ReactNode,title:string,sub:string,badge?:number,soon?:boolean)=>(
     <div style={{display:"flex",alignItems:"center",gap:11,padding:"11px 13px",background:"#fff",borderBottom:`1px solid ${LINE}`}}>
      <span style={{width:30,height:30,borderRadius:9,background:soon?"#F1F4F9":"#E7EEFB",color:soon?P.muted:P.blue,display:"grid",placeItems:"center",flex:"0 0 auto"}}>{icon}</span>
      <div style={{minWidth:0,flex:1}}><div style={{fontSize:12.5,fontWeight:700}}>{title}</div><div style={{fontSize:10.5,color:P.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sub}</div></div>
      {soon?<span style={{fontSize:9,fontWeight:700,color:P.muted,background:"#F1F4F9",borderRadius:999,padding:"2px 7px",flex:"0 0 auto"}}>Próximamente</span>
       :badge!==undefined&&badge>0?<span style={{fontSize:10,fontWeight:800,color:"#fff",background:"#C9364A",borderRadius:999,minWidth:17,height:17,display:"grid",placeItems:"center",padding:"0 4px",flex:"0 0 auto"}}>{badge}</span>
       :<span style={{color:"#C3CAD6",flex:"0 0 auto"}}>›</span>}
     </div>);
    const pIcon=(d:string)=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d}/></svg>;
    return <div className="mos-phone">
     <div className="screen">
      <div style={{background:"linear-gradient(150deg,#1769E0,#20B7D9)",padding:"16px 16px 18px",color:"#fff"}}>
       <div style={{fontSize:10,fontWeight:800,letterSpacing:".12em",opacity:.9}}>MEDICAL OS</div>
       <div style={{display:"flex",alignItems:"center",gap:10,marginTop:12}}>
        <span style={{width:40,height:40,borderRadius:"50%",background:"#ffffff2e",display:"grid",placeItems:"center",fontWeight:700,fontSize:15}}>{(patientName||"P").trim().slice(0,2).toUpperCase()}</span>
        <div><div style={{fontSize:16,fontWeight:800}}>Hola, {first}</div><div style={{fontSize:11.5,opacity:.9}}>Tu salud en tus manos</div></div>
       </div>
      </div>
      <div>
       {row(pIcon("M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"),"Mis citas",nextAppt?`Próxima cita agendada`:appts.length?"Citas registradas":"Sin citas próximas")}
       {row(pIcon("M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"),"Mis resultados",resultsN?`${resultsN} estudio(s) · laboratorios e imágenes`:"Sin resultados aún")}
       {/* R05a-F08: sin timeline cargado NO se afirma que no hay medicamentos. Es el portal del PACIENTE: leer «sin
       medicamentos» cuando la carga falló puede hacer que deje de tomar un tratamiento. */}
       {row(pIcon("M10 4l10 10-6 6L4 10z"),"Mis medicamentos",tl===undefined?"No disponible: no se pudo cargar tu expediente":(medsN?`${medsN} tratamiento(s) actual(es)`:"Sin medicamentos activos"))}
       {row(pIcon("M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6"),"Mi seguimiento","Pendientes y recordatorios",followN)}
       {row(pIcon("M4 5h16v11H8l-4 4z"),"Mensajes","Comunicación con tu equipo",undefined,true)}
       {row(pIcon("M4 5h11v14H4zM15 5h5v14h-5"),"Educación para mi salud","Artículos y recomendaciones",undefined,true)}
      </div>
      <div className="mos-pnav">
       <div><span style={{color:P.blue}}>{pIcon("M4 11l8-6 8 6M6 10v9h12v-9")}</span><span style={{color:P.blue,fontWeight:700}}>Inicio</span></div>
       <div>{pIcon("M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3")}<span>Resultados</span></div>
       <div>{pIcon("M4 5h16v11H8l-4 4z")}<span>Mensajes</span></div>
       <div>{pIcon("M4 6h16M4 12h16M4 18h16")}<span>Más</span></div>
      </div>
     </div>
    </div>;
   })()}
   <p style={{fontSize:11,color:P.muted,textAlign:"center",marginTop:12}}>Espejo de solo lectura del expediente. El paciente no edita el registro clínico.</p>
  </section>

  {/* PANEL / WORKLIST POBLACIONAL */}
  <section style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <h2 {...anchor("Panel del clínico")} style={{fontSize:18,margin:0}}>Panel del clínico</h2>
    <button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={loadPanel}>{busy==="panel"?"Cargando…":"Cargar worklist"}</button>
   </div>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Pendientes clínicos accionables de TODO el panel (todos los pacientes del tenant), priorizados. Inteligencia por reglas, sin IA.</p>
   {panel&&<div style={{marginTop:12}}>
    {panel.gaps.length===0?<div style={{padding:"10px 14px",borderRadius:12,background:"#f4faf6",border:"1px solid #d6ecdd",fontSize:13,color:"#1a7f43"}}>✓ Sin pendientes accionables en el panel.</div>
     :<div><div style={{fontSize:12,color:"#6d6e80",marginBottom:8}}>{panel.gaps.length} pendientes · {panel.patientCount} pacientes</div>
     <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:280,overflowY:"auto"}}>{panel.gaps.map(g=>{const col=g.priority==="HIGH"?["#fdeaea","#b3261e"]:g.priority==="MEDIUM"?["#fff4e5","#a15c00"]:["#eef0ff","#3f3aa0"];return <div key={g.patientId+g.aggregateId+g.code} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 12px",border:"1px solid #eceafb",borderRadius:10}}>
      <div style={{minWidth:0}}><span style={{...mono,marginRight:8}}>{g.patientId.slice(0,8)}</span><span style={{fontSize:13}}>{g.label}</span></div>
      <div style={{display:"flex",gap:8,alignItems:"center",whiteSpace:"nowrap"}}><span style={{display:"inline-block",background:col[0],color:col[1],fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:999}}>{g.priority}</span><button style={{...ghost,padding:"5px 10px",fontSize:12}} onClick={()=>selectPatientRaw(g.patientId,"")}>Abrir</button></div>
     </div>;})}</div></div>}
   </div>}
  </section>

  {/* PACIENTE (registro / selección) */}
  <section style={card}>
   <h2 {...anchor("Paciente")} style={{fontSize:18,margin:0}}>Paciente</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Registra un paciente o selecciónalo de la lista. El chart de abajo es del paciente activo.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 160px 150px auto",gap:10,marginTop:12,alignItems:"center"}}>
    <input style={input} value={regName} onChange={e=>setRegName(e.target.value)} placeholder="Nombre completo" />
    <input style={input} type="date" value={regDob} onChange={e=>setRegDob(e.target.value)} />
    <select style={input} value={regSex} onChange={e=>setRegSex(e.target.value)}><option value="FEMALE">Femenino</option><option value="MALE">Masculino</option><option value="INTERSEX">Intersexual</option><option value="UNKNOWN">Sin especificar</option></select>
    <button style={btn} disabled={busy!==""||!regName||!regDob} onClick={()=>registerPatient()}>{busy==="pt-reg"?"Registrando…":"Registrar"}</button>
   </div>
   {guardianFields(input)}{dupPanel(false)}
   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:10}}>
    <input style={input} value={regExtra.curp} onChange={e=>setRegExtra(x=>({...x,curp:e.target.value.toUpperCase()}))} placeholder="CURP" maxLength={18} />
    <input style={input} value={regExtra.phone} onChange={e=>setRegExtra(x=>({...x,phone:e.target.value}))} placeholder="Teléfono" />
    <input style={input} value={regExtra.email} onChange={e=>setRegExtra(x=>({...x,email:e.target.value}))} placeholder="Correo electrónico" />
    <input style={input} value={regExtra.address} onChange={e=>setRegExtra(x=>({...x,address:e.target.value}))} placeholder="Dirección (ciudad, estado)" />
    <input style={input} value={regExtra.occupation} onChange={e=>setRegExtra(x=>({...x,occupation:e.target.value}))} placeholder="Ocupación" />
    <select style={input} value={regExtra.maritalStatus} onChange={e=>setRegExtra(x=>({...x,maritalStatus:e.target.value}))}><option value="">Estado civil…</option><option>Soltero(a)</option><option>Casado(a)</option><option>Unión libre</option><option>Divorciado(a)</option><option>Viudo(a)</option></select>
   </div>
   <div style={{marginTop:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
    <input aria-label="Buscar paciente" style={{...input,maxWidth:280}} value={patientQuery} onChange={e=>setPatientQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void loadPatients();}} placeholder="Buscar por nombre o CURP…" />
    <button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>loadPatients()}>{busy==="pt-list"?"Cargando…":"Cargar / buscar pacientes"}</button>
    {patientTotal!==null&&patientList&&<span style={{fontSize:12,color:"#6b6c7e"}}>{patientMore?`Mostrando ${patientList.length} de ${patientTotal} pacientes — escriba para acotar la búsqueda`:`${patientList.length} de ${patientTotal} pacientes`}</span>}
   </div>
   {patientList&&<div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6,maxHeight:220,overflowY:"auto"}}>
    {patientList.length===0?<p style={{color:P.muted,fontSize:13}}>No hay pacientes registrados en este tenant.</p>
     :patientList.map(p=><div key={p.patientId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",border:"1px solid #eceafb",borderRadius:10,background:p.patientId===patientId?"#f4f3fb":"white"}}>
      <div><b style={{fontSize:14}}>{p.name}</b> <span style={stateBadge(p.status==="ACTIVE"?"ACTIVE":p.status==="INACTIVE"?"INACTIVE":"CANCELLED")}>{p.status}</span></div>
      <button style={{...ghost,padding:"6px 12px"}} onClick={()=>selectPatientRaw(p.patientId,p.name)}>{p.patientId===patientId?"Activo":"Seleccionar"}</button>
     </div>)}
   </div>}
  </section>

  {/* TIMELINE DEL PACIENTE */}
  <section style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <h2 {...anchor("Timeline del paciente")} style={{fontSize:18,margin:0}}>Timeline del paciente</h2>
    <div style={{display:"flex",gap:8}}>
     <button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={exportRecord}>{busy==="exp"?"Exportando…":"Exportar expediente"}</button>
     <button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={loadTimeline}>{busy==="tl"?"Cargando…":"Actualizar"}</button>
    </div>
   </div>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Vista longitudinal de los items clínicos de este paciente (metadatos, sin contenido).</p>
   {exportInfo&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:12,background:"#f4f3fb",border:"1px solid #e0ddf3",fontSize:12}}>
    <b style={{color:"#3f3aa0"}}>Expediente exportado (JSON de eventos; no es el formato de intercambio NOM-024)</b> · {exportInfo.aggregateCount} agregados · {exportInfo.eventCount} eventos<br/>
    <span style={{color:"#6d6e80"}}>hash reproducible del contenido: </span><span style={mono}>{exportInfo.contentHash}</span>
   </div>}
   {tl===null?<p style={{color:P.muted,fontSize:13,marginTop:12}}>Pulsa “Actualizar” para cargar el historial de este paciente.</p>
    :tl.length===0?<p style={{color:P.muted,fontSize:13,marginTop:12}}>Sin items registrados para este paciente todavía.</p>
    :<div>
     {(()=>{const s=summarizePatient(tl);const stat=(n:number,l:string,warn=false)=>(<div style={{flex:"1 1 90px",minWidth:90,textAlign:"center",padding:"10px 8px",borderRadius:12,background:warn&&n>0?"#fff4e5":"#f6f6fb",border:"1px solid #eceafb"}}><div style={{fontSize:22,fontWeight:800,color:warn&&n>0?"#a15c00":"#3f3aa0"}}>{n}</div><div style={{fontSize:11,color:"#6d6e80"}}>{l}</div></div>);
      return <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>{stat(s.activeAllergies,"Alergias activas",true)}{stat(s.activeProblems,"Problemas activos")}{stat(s.signedEncounters,"Encuentros firmados")}{stat(s.activeMedications,"Medicación activa")}{stat(s.openResults,"Resultados abiertos",true)}{stat(s.openOrders,"Órdenes pendientes")}{stat(s.openObligations,"Obligaciones abiertas",true)}{stat(s.openReferrals,"Interconsultas abiertas")}{stat(s.upcomingAppointments,"Citas próximas")}{stat(s.pendingImmunizations,"Vacunas pendientes",true)}{stat(s.activeCarePlans,"Metas activas")}{stat(s.openClaims,"Facturas abiertas")}{stat(s.grantedConsents,"Consentimientos vigentes")}{stat(s.activeAdmissions,"Internamientos activos",true)}</div>;})()}
     {gaps&&gaps.length>0&&<div style={{marginTop:16,padding:14,borderRadius:12,background:"#fbf7f2",border:"1px solid #f0e2cf"}}>
      <div style={{fontSize:13,fontWeight:700,color:"#8a5a12",marginBottom:8}}>⚑ Pendientes clínicos (care gaps) · {gaps.length}</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>{gaps.map(g=>{const col=g.priority==="HIGH"?["#fdeaea","#b3261e"]:g.priority==="MEDIUM"?["#fff4e5","#a15c00"]:["#eef0ff","#3f3aa0"];return <div key={g.aggregateId+g.code} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 12px",background:"white",border:"1px solid #eceafb",borderRadius:10}}>
       <span style={{fontSize:13}}>{g.label}</span>
       <span style={{display:"inline-block",background:col[0],color:col[1],fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap"}}>{g.priority}</span>
      </div>;})}</div>
     </div>}
     {gaps&&gaps.length===0&&<div style={{marginTop:16,padding:"10px 14px",borderRadius:12,background:"#f4faf6",border:"1px solid #d6ecdd",fontSize:13,color:"#1a7f43"}}>✓ Sin pendientes clínicos accionables para este paciente.</div>}
     <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
     {tl.map(x=><div key={x.aggregateId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",border:"1px solid #eceafb",borderRadius:10}}>
      <div><b style={{fontSize:14}}>{TYPE_LABEL[x.aggregateType]??x.aggregateType}</b> <span style={{...mono,marginLeft:6}}>{x.aggregateId.slice(0,8)}</span></div>
      <div style={{display:"flex",gap:10,alignItems:"center"}}><span style={stateBadge(x.latestKind)}>{x.latestKind}</span><span style={{fontSize:12,color:P.muted}}>v{x.version}</span></div>
     </div>)}
    </div></div>}
  </section>

  {/* ENCUENTRO */}
  <section style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <h2 {...anchor("Encuentro")} style={{fontSize:18,margin:0}}>Encuentro</h2>{enc&&<span style={stateBadge(enc.state)}>{enc.state}</span>}
   </div>
   {!enc?<div style={{marginTop:14}}>
    <label htmlFor="patient-id-input" style={lbl}>ID de paciente</label><input id="patient-id-input" style={input} value={patientId} onChange={e=>setPatientId(e.target.value)} />
    <div style={{marginTop:14}}><button style={btn} disabled={busy!==""||!patientId} onClick={openEncounter}>{busy==="open"?"Abriendo…":"Abrir encuentro"}</button></div>
   </div>:<div>
    <p style={{color:"#6d6e80",fontSize:13}}>Encuentro <span style={mono}>{enc.id.slice(0,8)}</span> · versión {enc.version}</p>
    <label style={lbl}>Valoración (assessment)</label>
    <textarea style={{...input,minHeight:64,resize:"vertical"}} value={assessment} disabled={enc.state!=="OPEN"} onChange={e=>setAssessment(e.target.value)} placeholder="Impresión diagnóstica…" />
    <label style={lbl}>Plan</label>
    <textarea style={{...input,minHeight:64,resize:"vertical"}} value={plan} disabled={enc.state!=="OPEN"} onChange={e=>setPlan(e.target.value)} placeholder="Plan de manejo…" />
    <div style={{display:"flex",gap:10,marginTop:14}}>
     {enc.state==="OPEN"&&<button style={btn} disabled={busy!==""||!assessment||!plan} onClick={saveAssessment}>{busy==="assess"?"Guardando…":"Guardar valoración"}</button>}
     {enc.state==="READY_TO_SIGN"&&<button style={btn} disabled={busy!==""} onClick={signEncounter}>{busy==="sign"?"Firmando…":"Firmar encuentro"}</button>}
    </div>
    {enc.state==="SIGNED"&&<div style={{marginTop:14,padding:12,background:"#f6fbf7",borderRadius:12,border:"1px solid #d6ecdd"}}>
     <b style={{color:"#1a7f43"}}>✓ Encuentro firmado (registro inmutable)</b>
     <p style={{margin:"6px 0 0",fontSize:12,color:"#4b4c5e"}}>Firma: <span style={mono}>{enc.signatureDigest?.slice(0,32)}…</span></p>
    </div>}
   </div>}
  </section>

  {/* MEDICACIÓN */}
  <section style={card}>
   <h2 {...anchor("Medicación")} style={{fontSize:18,margin:0}}>Medicación</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Proponer una medicación no exige ser médico; sólo un médico puede prescribirla (Physician Control).</p>
   <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 90px 1fr",gap:10,marginTop:12}}>
    <input style={input} value={drug} onChange={e=>setDrug(e.target.value)} placeholder="Fármaco (ej. Amoxicilina)" />
    <div style={{display:"flex",gap:6}}>
     <input style={{...input,flex:1,minWidth:0}} type="number" inputMode="decimal" min={0} step="any" value={doseAmt} onChange={e=>setDoseAmt(e.target.value)} placeholder="Dosis (500mg)" aria-label="Cantidad de la dosis" />
     <select style={{...input,width:86}} value={doseUnit} onChange={e=>setDoseUnit(e.target.value)} aria-label="Unidad de la dosis">{DOSE_UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select>
    </div>
    <input style={input} value={route} onChange={e=>setRoute(e.target.value)} placeholder="Vía" />
    <input style={input} value={freq} onChange={e=>setFreq(e.target.value)} placeholder="Frecuencia (c/8h)" />
   </div>
   <div style={{marginTop:12}}><button style={btn} disabled={busy!==""||!drug||!dose||!route||!freq} onClick={proposeMed}>{busy==="med-new"?"Proponiendo…":"Proponer medicación"}</button></div>

   {/* Auditoría R05a (WS1-14) — LA MEDICACIÓN VIGENTE DEL PACIENTE, en la ventana donde se prescribe.
       Esta ventana solo mostraba lo prescrito en la sesión: abrir el expediente de alguien con cinco fármacos activos y
       prescribir un sexto se hacía A CIEGAS, aunque sus alergias y problemas sí se vean en la cabecera. Se distingue
       «no cargó» de «no toma nada», como exige R05a-F08: afirmar que no toma nada sin saberlo autoriza a prescribir. */}
   <div style={{marginTop:16,border:`1px solid ${LINE}`,borderRadius:12,padding:"12px 14px",background:"#FCFDFF"}}>
    <div style={{fontSize:12.5,fontWeight:700,color:P.muted,marginBottom:consTabs?.medications?.length?8:0}}>Medicación vigente del paciente</div>
    {consTabs===null
     ?<div style={{fontSize:13,color:"#A15C00"}}>No evaluada: la medicación del paciente no cargó. Confírmela con el paciente antes de prescribir.</div>
     :consTabs.medications.length===0
      ?<div style={{fontSize:13,color:P.muted}}>Sin medicamentos activos registrados en el expediente.</div>
      :<div style={{display:"flex",flexWrap:"wrap",gap:8}}>{consTabs.medications.map((m,i)=><span key={i} style={{background:"#E6F6EE",color:"#0F6B45",border:"1px solid #BFE6D2",borderRadius:8,padding:"4px 10px",fontSize:12.5,fontWeight:600}}>{m}</span>)}</div>}
   </div>

   {meds.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {meds.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {meds.map(m=>{const n=medNext(m);return <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{m.label}</b><div style={{fontSize:12,color:P.muted}}>v{m.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(m.state)}>{m.state}</span>
      {(m.state==="PRESCRIBED"||m.state==="ACTIVE")&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>printPrescription([m.id])} title="Receta con los datos legales (cédula, institución, domicilio)">Imprimir receta</button>}
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceMed(m)}>{busy==="med-"+m.id?"…":n.label}</button>}
     </div>
    </div>;})}
    {meds.filter(m=>m.state==="PRESCRIBED"||m.state==="ACTIVE").length>1&&<div style={{display:"flex",justifyContent:"flex-end"}}><button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>printPrescription(meds.filter(m=>m.state==="PRESCRIBED"||m.state==="ACTIVE").map(m=>m.id))}>Imprimir receta con todas las prescritas</button></div>}
   </div>}
  </section>

  {/* PRESCRIPCIÓN SEGURA (panel 3) — dry-run de las barreras antes de prescribir */}
  <section className="span2" style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
    <div><h2 {...anchor("Prescripción segura")} style={{fontSize:18,margin:0}}>Prescripción segura</h2><p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Verifica antes de prescribir. Previene errores, protege al paciente. Determinista, sin IA generativa.</p></div>
    {snap?.labs.egfr!==undefined&&<span style={{fontSize:12,color:P.muted}}>eGFR paciente: <b>{snap?.labs.egfr} mL/min</b>{snap?.labs.egfrStage?` · categoría ${snap.labs.egfrStage} (una creatinina: no confirma ERC)`:""}</span>}
   </div>
   <div className="mos-rx-form">
    <input style={input} value={rxDrug} onChange={e=>{setRxDrug(e.target.value);setRxCheck(null);}} placeholder="Buscar medicamento (ej. metformina, losartan)" />
    <div style={{display:"flex",gap:6}}>
     <input style={{...input,flex:1,minWidth:0}} type="number" inputMode="decimal" min={0} step="any" value={rxDoseAmt} onChange={e=>{setRxDoseAmt(e.target.value);setRxCheck(null);}} placeholder="Dosis" aria-label="Cantidad de la dosis" />
     <select style={{...input,width:86}} value={rxDoseUnit} onChange={e=>{setRxDoseUnit(e.target.value);setRxCheck(null);}} aria-label="Unidad de la dosis">{DOSE_UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select>
    </div>
    <select style={input} value={rxRoute} onChange={e=>{setRxRoute(e.target.value);setRxCheck(null);}}><option>Oral</option><option>IV</option><option>IM</option><option>SC</option><option>Tópica</option></select>
    <input style={input} value={rxFreq} onChange={e=>{setRxFreq(e.target.value);setRxCheck(null);}} placeholder="Frecuencia (c/12h)" />
    <button style={btn} disabled={busy!==""||!rxDrug||!rxDose||!rxFreq} onClick={verifyRx}>{busy==="rxcheck"?"Verificando…":"Verificar"}</button>
   </div>
   {rxMsg&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:12,background:"#EAF7EF",border:"1px solid #CDEBD8",color:"#1A7F43",fontSize:13,fontWeight:600}}>{rxMsg}</div>}
   {rxCheck&&(()=>{
    const v=rxCheck.verdict;
    const vm=v==="OK"?{bg:"#EAF7EF",bd:"#CDEBD8",fg:"#1A7F43",txt:(rxCheck.notCovered?.length??0)>0?"Sin conflictos en lo evaluado — hay barreras sin regla en el catálogo (en gris)":"Verificación superada — todas las barreras evaluadas"}:v==="WARN"?{bg:"#FFF7EC",bd:"#F0DBB8",fg:"#A15C00",txt:rxCheck.requiresAcknowledgement?"Verificación INCOMPLETA — hay barreras que no se pudieron evaluar; al prescribir deberás confirmarlo":"Requiere criterio clínico — revisa las advertencias"}:{bg:"#FDEEEE",bd:"#F3C9C9",fg:"#B3261E",txt:(rxCheck.blockedHard?.length??0)>0?"Prescripción bloqueada — no anulable: corrige la dosis o la orden":"Prescripción bloqueada — solo anulable al prescribir, con justificación clínica que queda en el expediente"};
    const hardBlock=(rxCheck.blockedHard?.length??0)>0;
    const unev=(s:string)=>s==="NOT_EVALUATED"||s==="NOT_COVERED"||s==="NA";
    const ic=(s:string)=>s==="OK"?"✓":s==="WARN"?"⚠":s==="NA"?"–":unev(s)?"?":"✕";const icc=(s:string)=>s==="OK"?"#1A7F43":s==="WARN"?"#A15C00":unev(s)?"#5F6B7A":"#B3261E";
    return <div style={{marginTop:14}}>
     <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:12,background:vm.bg,border:`1px solid ${vm.bd}`,color:vm.fg,fontWeight:700,fontSize:14,flexWrap:"wrap"}}>
      <span style={{fontSize:16}}>{ic(v)}</span>{vm.txt}
      {rxCheck.drug.resolved&&<span style={{marginLeft:"auto",fontSize:12,fontWeight:600,color:P.muted}}>{rxCheck.drug.resolved.ingredient} · {rxCheck.drug.resolved.classes.join(", ")}</span>}
     </div>
     <div className="mos-rx-grid">
      <div>
       <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Barreras de seguridad</div>
       <div style={{display:"flex",flexDirection:"column",gap:7}}>{rxCheck.checks.map(c=><div key={c.id} style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:13}}>
        <span style={{color:icc(c.status),fontWeight:800,flex:"0 0 auto",width:14}}>{ic(c.status)}</span>
        <span><b style={{fontWeight:600}}>{c.label}</b><span style={{color:P.muted}}> — {c.detail}</span>{c.status==="BLOCK"&&<span style={{marginLeft:6,fontSize:11,fontWeight:700,color:c.overridable?"#A15C00":"#B3261E"}}>{c.overridable?"anulable con justificación":"no anulable"}</span>}</span>
       </div>)}</div>
      </div>
      <div>
       <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Monitorización / advertencias</div>
       {rxCheck.monitoring.length?<div style={{display:"flex",flexDirection:"column",gap:6}}>{rxCheck.monitoring.map((m,i)=><div key={i} style={{fontSize:12.5,color:"#7a3b34"}}>• {m.test}: {m.note} <span style={{color:P.muted}}>(en {m.dueInDays} d)</span></div>)}</div>:<div style={{fontSize:12.5,color:P.muted}}>Sin monitorización específica.</div>}
       {rxCheck.indications&&<div style={{marginTop:12}}><div style={{fontSize:12,fontWeight:700,color:P.muted}}>Indicaciones para el paciente</div><div style={{fontSize:13,marginTop:2}}>{rxCheck.indications}</div></div>}
      </div>
     </div>
     <div style={{display:"flex",gap:10,marginTop:16,justifyContent:"flex-end"}}>
      <button style={{...ghost,padding:"9px 16px"}} onClick={()=>setRxCheck(null)}>Cancelar</button>
      <button style={{...btn,opacity:hardBlock?.5:1}} disabled={busy!==""||hardBlock} onClick={sendRx} title={hardBlock?"Bloqueo no anulable: corrige la dosis o la orden":v==="BLOCK"?"Se registra como propuesta; al prescribir deberás anular el bloqueo con justificación":""}>{busy==="rxsend"?"Enviando…":v==="BLOCK"?"Guardar (anular al prescribir)":"Guardar y enviar"}</button>
     </div>
    </div>;
   })()}
  </section>

  {/* RESULTADOS DIAGNÓSTICOS */}
  <section style={card}>
   <h2 {...anchor("Resultados diagnósticos")} style={{fontSize:18,margin:0}}>Resultados diagnósticos</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Closed-loop: un resultado <b>crítico</b> que requirió acción y no se ha cerrado <b>bloquea la firma</b> del encuentro (Zero Lost Follow-Up).</p>
   <div style={{display:"flex",gap:10,marginTop:12,alignItems:"center",flexWrap:"wrap"}}>
    <select aria-label="Analito" style={{...input,maxWidth:200}} value={resQuick.analyte} onChange={e=>setResQuick({analyte:e.target.value,value:"",unit:canonicalUnitOf(e.target.value)??""})}>{labReferenceRanges().map(a=><option key={a.analyte} value={a.analyte}>{a.analyte}</option>)}</select>
    <input aria-label="Valor" inputMode="decimal" style={{...input,maxWidth:120}} value={resQuick.value} onChange={e=>setResQuick({...resQuick,value:e.target.value})} placeholder="Valor" />
    <select aria-label="Unidad" style={{...input,maxWidth:120}} value={resQuick.unit} onChange={e=>setResQuick({...resQuick,unit:e.target.value})}>{acceptedUnitsOf(resQuick.analyte).map(u=><option key={u} value={u}>{u}</option>)}</select>
    <span style={{fontSize:12,color:"#6b6c7e"}}>La criticidad se deriva del valor.</span>
    <button style={btn} disabled={busy!==""} onClick={receiveResult}>{busy==="res-new"?"Registrando…":"Registrar resultado"}</button>
   </div>
   {results.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {results.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {results.map(res=>{const n=resNext(res);return <div key={res.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{res.label}{res.critical&&<span style={{...stateBadge("ACTIONED"),marginLeft:8,fontSize:11}}>CRÍTICO</span>}</b><div style={{fontSize:12,color:P.muted}}>v{res.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(res.state)}>{res.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceResult(res)}>{busy==="res-"+res.id?"…":n.label}</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* EVOLUCIÓN LONGITUDINAL (panel 4) */}
  <section className="span2" style={card}>
   <div><h2 {...anchor("Evolución longitudinal")} style={{fontSize:18,margin:0}}>Evolución longitudinal</h2><p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Tendencias que cuentan la historia completa. Valores medidos, sin proyección.</p></div>
   <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}}>
    {(["HBA1C","GLUCOSE","LDL","CREATININE"] as TrendKey[]).map(k=><button key={k} onClick={()=>setTrendKey(k)} style={{background:trendKey===k?"#E7EEFB":"transparent",color:trendKey===k?P.blue:P.muted,border:`1px solid ${trendKey===k?"#CFE0F7":LINE}`,borderRadius:999,padding:"6px 14px",fontSize:13,fontWeight:trendKey===k?700:500,fontFamily:UI,cursor:"pointer"}}>{CHART[k].label}</button>)}
   </div>
   <div style={{marginTop:14,border:`1px solid ${LINE}`,borderRadius:14,padding:"14px 16px",background:"#fff"}}>
    <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>{CHART[trendKey].label} <span style={{color:P.muted,fontWeight:500}}>({CHART[trendKey].unit})</span></div>
    {trends?trendChart(trends.series[trendKey]??[],trendKey):<div style={{padding:"28px 0",textAlign:"center",color:P.muted,fontSize:13}}>Selecciona un paciente para ver sus tendencias.</div>}
   </div>
   {trends&&(()=>{
    const rc=(label:string,v:number|null,unit:string,warn:boolean)=>(<div style={{minWidth:0,background:"#fff",border:`1px solid ${warn?"#F0DBB8":LINE}`,borderRadius:14,padding:"14px 16px"}}><div style={{fontSize:12,color:P.muted,marginBottom:4}}>{label}</div><div style={{fontSize:22,fontWeight:800,color:warn?"#A15C00":P.ink}}>{v??"—"} <span style={{fontSize:12,fontWeight:600,color:P.muted}}>{v!==null?unit:""}</span></div></div>);
    const L=trends.latest;
    return <><div style={{fontSize:13,fontWeight:700,margin:"18px 0 10px"}}>Otros resultados relevantes</div>
     <div className="mos-vitals">
      {rc("Colesterol LDL",L.LDL,"mg/dL",L.LDL!==null&&L.LDL>=100)}
      {rc("Creatinina",L.CREATININE,"mg/dL",L.CREATININE!==null&&L.CREATININE>1.3)}
      {rc("TFG (eGFR)",L.EGFR,"mL/min",L.EGFR!==null&&L.EGFR<60)}
      {rc("UACR",L.UACR,"mg/g",L.UACR!==null&&L.UACR>=30)}
     </div></>;
   })()}
  </section>

  {/* ALERGIAS */}
  <section style={card}>
   <h2 {...anchor("Alergias")} style={{fontSize:18,margin:0}}>Alergias</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Una alergia <b>activa</b> bloquea la prescripción de un fármaco que la contenga (gate de seguridad).</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 150px 1fr",gap:10,marginTop:12}}>
    <input style={input} value={alSub} onChange={e=>setAlSub(e.target.value)} placeholder="Sustancia (ej. amoxicilina)" />
    <select style={input} value={alSev} onChange={e=>setAlSev(e.target.value)}><option value="MILD">Leve</option><option value="MODERATE">Moderada</option><option value="SEVERE">Grave</option></select>
    <input style={input} value={alReac} onChange={e=>setAlReac(e.target.value)} placeholder="Reacción (ej. anafilaxia)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!alSub} onClick={createAllergy}>{busy==="al-new"?"Registrando…":"Registrar alergia"}</button></div>
   {allergies.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {allergies.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {allergies.map(a=><div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{a.label}</b><div style={{fontSize:12,color:P.muted}}>v{a.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={stateBadge(a.state)}>{a.state}</span>{alActions(a).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>doAllergyAction(a,act)}>{busy==="al-"+a.id?"…":act.label}</button>)}</div>
    </div>)}
   </div>}
  </section>

  {/* LISTA DE PROBLEMAS */}
  <section style={card}>
   <h2 {...anchor("Lista de problemas")} style={{fontSize:18,margin:0}}>Lista de problemas</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Diagnósticos codificados en <b>CIE-10</b> (validados contra el catálogo; la descripción es canónica). PROD-011 + interoperabilidad NOM-024.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginTop:12}}>
    <input style={input} list="icd10-list" value={probCode} onChange={e=>setProbCode(e.target.value.toUpperCase())} placeholder="Código CIE-10 (ej. E11, I10, J45.9)" />
    <button style={btn} disabled={busy!==""||!probCode} onClick={createProblem}>{busy==="pb-new"?"Añadiendo…":"Añadir problema"}</button>
   </div>
   <datalist id="icd10-list">
    <option value="E11">Diabetes mellitus tipo 2</option><option value="I10">Hipertensión esencial</option><option value="E66.9">Obesidad</option>
    <option value="J45.9">Asma</option><option value="J44.9">EPOC</option><option value="N18.3">ERC estadio 3</option>
    <option value="F41.9">Ansiedad</option><option value="F32.9">Depresión</option><option value="M54.5">Lumbalgia</option><option value="I50.9">Insuficiencia cardíaca</option>
   </datalist>
   {problems.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {problems.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {problems.map(p=><div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{p.label}</b><div style={{fontSize:12,color:P.muted}}>v{p.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={stateBadge(p.state)}>{p.state}</span>{probActions(p).map(a=><button key={a.label} style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>doProblemAction(p,a)}>{busy==="pb-"+p.id?"…":a.label}</button>)}</div>
    </div>)}
   </div>}
  </section>

  {/* ÓRDENES CLÍNICAS */}
  <section style={card}>
   <h2 {...anchor("Órdenes clínicas")} style={{fontSize:18,margin:0}}>Órdenes clínicas</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Lab, imagen, patología, procedimiento o referencia. Colocar/cumplir una orden exige médico.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginTop:12}}>
    <select style={input} value={orderType} onChange={e=>setOrderType(e.target.value)}>
     <option value="LAB">Laboratorio</option><option value="IMAGING">Imagen</option><option value="PATHOLOGY">Patología</option><option value="PROCEDURE">Procedimiento</option><option value="REFERRAL">Referencia</option>
    </select>
    <input style={input} value={orderDetail} onChange={e=>setOrderDetail(e.target.value)} placeholder="Detalle (ej. Hemograma completo)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!orderDetail} onClick={createOrder}>{busy==="ord-new"?"Creando…":"Crear orden"}</button></div>
   {orders.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {orders.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {orders.map(o=>{const n=orderNext(o);return <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{o.label}</b><div style={{fontSize:12,color:P.muted}}>v{o.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(o.state)}>{o.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceOrder(o)}>{busy==="ord-"+o.id?"…":n.label}</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* INTERCONSULTAS / REFERENCIAS */}
  <section style={card}>
   <h2 {...anchor("Interconsultas")} style={{fontSize:18,margin:0}}>Interconsultas</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Referencia a especialista: solicitar → aceptar → completar (o declinar/cancelar). Agregado propio con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:10,marginTop:12}}>
    <input style={input} value={refSpecialty} onChange={e=>setRefSpecialty(e.target.value)} placeholder="Especialidad (ej. Cardiología)" />
    <input style={input} value={refReason} onChange={e=>setRefReason(e.target.value)} placeholder="Motivo (ej. Soplo sistólico)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!refSpecialty||!refReason} onClick={createReferral}>{busy==="ref-new"?"Solicitando…":"Solicitar interconsulta"}</button></div>
   {referrals.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {referrals.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {referrals.map(rr=>{const n=referralNext(rr);const closable=rr.state==="REQUESTED"||rr.state==="ACCEPTED";return <div key={rr.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{rr.label}</b><div style={{fontSize:12,color:P.muted}}>v{rr.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(rr.state)}>{rr.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceReferral(rr)}>{busy==="ref-"+rr.id?"…":n.label}</button>}
      {closable&&<button style={{...ghost,padding:"7px 12px",color:"#a15c00",borderColor:"#f0d9b8"}} disabled={busy!==""} onClick={()=>cancelReferral(rr)}>{rr.state==="REQUESTED"?"Declinar":"Cancelar"}</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* AGENDA / CITAS */}
  <section style={card}>
   <h2 {...anchor("Agenda")} style={{fontSize:18,margin:0}}>Agenda</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Cita del paciente: agendar → registrar llegada → completar (o no-show/cancelar). Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:10,marginTop:12}}>
    <div><input style={{...input,width:"100%"}} type="datetime-local" aria-describedby="mos-zona-cita" value={apptStart} onChange={e=>setApptStart(e.target.value)} />
     {/* R05b-16: la zona en la que se está agendando, dicha en la pantalla. */}
     <div id="mos-zona-cita" style={{fontSize:11,color:P.muted,marginTop:3}}>{avisoDeZona(cfgSettings.timezone)}</div></div>
    <input style={input} value={apptReason} onChange={e=>setApptReason(e.target.value)} placeholder="Motivo (ej. Control anual)" />
    <select style={input} value={apptCons} onChange={e=>setApptCons(e.target.value)}><option>Consultorio 1</option><option>Consultorio 2</option><option>Consultorio 3</option></select>
    <select style={input} value={apptType} onChange={e=>setApptType(e.target.value)}><option value="CONSULTA_GENERAL">Consulta general</option><option value="CONTROL">Control / Seguimiento</option><option value="PRIMERA_VEZ">Primera vez</option><option value="PROCEDIMIENTO">Procedimiento</option><option value="VACUNACION">Vacunación</option><option value="RESULTADOS">Resultados</option><option value="URGENCIA">Urgencia</option></select>
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!apptReason} onClick={createAppointment}>{busy==="apt-new"?"Agendando…":"Agendar cita"}</button></div>
   {appts.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {appts.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {appts.map(a=>{const n=apptNext(a);const open=a.state==="SCHEDULED"||a.state==="CHECKED_IN";return <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{a.label}</b><div style={{fontSize:12,color:P.muted}}>v{a.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(a.state)}>{a.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceAppt(a)}>{busy==="apt-"+a.id?"…":n.label}</button>}
      {a.state==="SCHEDULED"&&<button style={{...ghost,padding:"7px 12px",color:"#a15c00",borderColor:"#f0d9b8"}} disabled={busy!==""} onClick={()=>closeAppt(a,"noshow")}>No-show</button>}
      {open&&<button style={{...ghost,padding:"7px 12px",color:"#a15c00",borderColor:"#f0d9b8"}} disabled={busy!==""} onClick={()=>closeAppt(a,"cancel")}>Cancelar</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* VACUNAS / CARTILLA */}
  <section style={card}>
   <h2 {...anchor("Vacunas")} style={{fontSize:18,margin:0}}>Vacunas</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Cartilla longitudinal: indicar → aplicar (o rechazar); tras aplicar puede registrarse un evento adverso (farmacovigilancia). Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:10,marginTop:12}}>
    <input style={input} value={immCode} onChange={e=>setImmCode(e.target.value)} placeholder="Vacuna (ej. SRP, Hexavalente, Influenza)" />
    <input style={input} value={immDose} onChange={e=>setImmDose(e.target.value)} placeholder="Dosis" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!immCode} onClick={createImmunization}>{busy==="imm-new"?"Indicando…":"Indicar vacuna"}</button></div>
   {imms.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {imms.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {imms.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{i.label}</b><div style={{fontSize:12,color:P.muted}}>v{i.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(i.state)}>{i.state}</span>
      {immActions(i).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="ADVERSE_EVENT"||act.to==="REFUSED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doImmAction(i,act)}>{busy==="imm-"+i.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* SIGNOS VITALES */}
  <section style={card}>
   <h2 {...anchor("Signos vitales")} style={{fontSize:18,margin:0}}>Signos vitales</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Observaciones append-only: el valor histórico nunca se sobrescribe; cada corrección es una enmienda con motivo. Se puede marcar una toma como capturada por error.</p>
   <div style={{display:"grid",gridTemplateColumns:"150px 1fr 120px",gap:10,marginTop:12}}>
    <select style={input} value={vitType} onChange={e=>setVitType(e.target.value)}>
     <option value="BP">Presión (BP)</option><option value="HR">Frec. cardíaca</option><option value="TEMP">Temperatura</option><option value="SPO2">SpO₂</option><option value="RESP">Frec. respiratoria</option><option value="WEIGHT">Peso</option><option value="HEIGHT">Talla</option>
    </select>
    <input style={input} value={vitValue} onChange={e=>setVitValue(e.target.value)} placeholder="Valor (ej. 120/80)" />
    <input style={input} value={vitUnit} onChange={e=>setVitUnit(e.target.value)} placeholder="Unidad" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!vitValue} onClick={createVital}>{busy==="vit-new"?"Registrando…":"Registrar signo vital"}</button></div>
   {vitals.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {vitals.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {vitals.map(v=><div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{v.vitalType}: {v.value} {v.unit}</b>{v.vstatus&&v.vstatus!=="UNKNOWN"&&<span style={{...(v.vstatus==="CRITICAL"?{background:"#fdeaea",color:"#b3261e"}:v.vstatus==="ABNORMAL"?{background:"#fff4e5",color:"#a15c00"}:{background:"#e8f7ee",color:"#1a7f43"}),marginLeft:8,fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:999}}>{v.interp}</span>}<div style={{fontSize:12,color:P.muted}}>v{v.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(v.state)}>{v.state}</span>
      {vitActions(v).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="ENTERED_IN_ERROR"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doVitAction(v,act)}>{busy==="vit-"+v.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* PLAN DE CUIDADOS / METAS */}
  <section style={card}>
   <h2 {...anchor("Plan de cuidados")} style={{fontSize:18,margin:0}}>Plan de cuidados</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Metas longitudinales de crónicos: proponer → activar → lograr, con pausa/reanudación. Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginTop:12}}>
    <select style={input} value={planCat} onChange={e=>setPlanCat(e.target.value)}>
     <option value="DIABETES">Diabetes</option><option value="HYPERTENSION">Hipertensión</option><option value="OBESITY">Obesidad</option><option value="CARDIOVASCULAR">Cardiovascular</option><option value="MENTAL_HEALTH">Salud mental</option><option value="PRENATAL">Prenatal</option><option value="OTHER">Otro</option>
    </select>
    <input style={input} value={planGoal} onChange={e=>setPlanGoal(e.target.value)} placeholder="Meta (ej. HbA1c < 7% en 6 meses)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!planGoal} onClick={createPlan}>{busy==="cp-new"?"Proponiendo…":"Proponer meta"}</button></div>
   {plans.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {plans.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {plans.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{c.label}</b><div style={{fontSize:12,color:P.muted}}>v{c.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(c.state)}>{c.state}</span>
      {cpActions(c).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="CANCELLED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doPlanAction(c,act)}>{busy==="cp-"+c.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* FACTURACIÓN / RECLAMACIONES */}
  <section style={card}>
   <h2 {...anchor("Facturación")} style={{fontSize:18,margin:0}}>Facturación</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Ciclo de ingresos (seguimiento de estado, no mueve dinero): borrador → codificar → enviar → pagada/rechazada, con reenvío. Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:10,marginTop:12}}>
    <input style={input} value={clmAmount} onChange={e=>setClmAmount(e.target.value)} placeholder="Monto (ej. 1500.00)" />
    <select style={input} value={clmCurrency} onChange={e=>setClmCurrency(e.target.value)}><option value="MXN">MXN</option><option value="USD">USD</option></select>
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!clmAmount} onClick={createClaim}>{busy==="clm-new"?"Creando…":"Crear reclamación"}</button></div>
   {claims.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {claims.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {claims.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{c.label}</b><div style={{fontSize:12,color:P.muted}}>v{c.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(c.state)}>{c.state}</span>
      {clmActions(c).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="VOIDED"||act.to==="REJECTED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doClaimAction(c,act)}>{busy==="clm-"+c.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* CONSENTIMIENTO INFORMADO */}
  <section style={card}>
   <h2 {...anchor("Consentimiento informado")} style={{fontSize:18,margin:0}}>Consentimiento informado</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Registro clínico-legal (NOM-004 / aviso de privacidad): redactar → presentar → otorgar/rechazar; un consentimiento otorgado puede revocarse. Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginTop:12}}>
    <select style={input} value={csType} onChange={e=>setCsType(e.target.value)}>
     <option value="PROCEDURE">Procedimiento</option><option value="TREATMENT">Tratamiento</option><option value="ANESTHESIA">Anestesia</option><option value="DATA_SHARING">Compartir datos</option><option value="RESEARCH">Investigación</option>
    </select>
    <input style={input} value={csRef} onChange={e=>setCsRef(e.target.value)} placeholder="Referencia del documento (ej. CI-2026-001)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!csRef} onClick={createConsent}>{busy==="cs-new"?"Redactando…":"Redactar consentimiento"}</button></div>
   {consents.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {consents.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {consents.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{c.label}</b><div style={{fontSize:12,color:P.muted}}>v{c.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(c.state)}>{c.state}</span>
      {csActions(c).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="DECLINED"||act.to==="REVOKED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doConsentAction(c,act)}>{busy==="cs-"+c.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* INTERNAMIENTO / HOSPITALIZACIÓN */}
  {hospitalOn&&<section style={card}>
   <h2 {...anchor("Internamiento")} style={{fontSize:18,margin:0}}>Internamiento</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Episodio de hospitalización: admitir → trasladar (unidad) → dar de alta; cancelable si fue admisión por error. Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:10,marginTop:12}}>
    <select style={input} value={admUnit} onChange={e=>setAdmUnit(e.target.value)}>
     <option value="ER">Urgencias</option><option value="WARD">Hospitalización</option><option value="ICU">UCI</option><option value="OR">Quirófano</option><option value="MATERNITY">Maternidad</option><option value="PEDIATRICS">Pediatría</option>
    </select>
    <input style={input} value={admReason} onChange={e=>setAdmReason(e.target.value)} placeholder="Motivo (ej. Dolor torácico)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!admReason} onClick={createAdmission}>{busy==="adm-new"?"Admitiendo…":"Admitir paciente"}</button></div>
   {adms.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {adms.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {adms.map(a=><div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>Unidad: {a.unit}</b><div style={{fontSize:12,color:P.muted}}>v{a.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(a.state)}>{a.state}</span>
      {admActions(a).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="CANCELLED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doAdmAction(a,act)}>{busy==="adm-"+a.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>}

  {/* MUESTRAS / CADENA DE CUSTODIA */}
  {hospitalOn&&<section style={card}>
   <h2 {...anchor("Muestras de laboratorio")} style={{fontSize:18,margin:0}}>Muestras de laboratorio</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Cadena de custodia pre-analítica: recolectar → enviar → recibir → resultar; rechazable en cualquier etapa. Una muestra rechazada aparece como pendiente HIGH en care gaps.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginTop:12}}>
    <select style={input} value={specType} onChange={e=>setSpecType(e.target.value)}>
     <option value="BLOOD">Sangre</option><option value="URINE">Orina</option><option value="TISSUE">Tejido</option><option value="SWAB">Hisopado</option><option value="CSF">LCR</option><option value="STOOL">Heces</option>
    </select>
    <button style={btn} disabled={busy!==""} onClick={createSpecimen}>{busy==="sp-new"?"Recolectando…":"Recolectar muestra"}</button>
   </div>
   {specs.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {specs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {specs.map(s=>{const n=spNext(s);const open=s.state!=="RESULTED"&&s.state!=="REJECTED";return <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{s.specimenType}</b><div style={{fontSize:12,color:P.muted}}>v{s.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(s.state)}>{s.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceSpecimen(s)}>{busy==="sp-"+s.id?"…":n.label}</button>}
      {open&&<button style={{...ghost,padding:"7px 12px",color:"#a15c00",borderColor:"#f0d9b8"}} disabled={busy!==""} onClick={()=>rejectSpecimen(s)}>Rechazar</button>}
     </div>
    </div>;})}
   </div>}
  </section>}

  {/* INCIDENTES / SEGURIDAD DEL PACIENTE */}
  <section style={card}>
   <h2 {...anchor("Incidentes de seguridad")} style={{fontSize:18,margin:0}}>Incidentes de seguridad</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Reporte de eventos adversos (farmacovigilancia): reportar → revisar → escalar/resolver. Un incidente abierto aparece como pendiente HIGH en care gaps. Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 150px 1fr",gap:10,marginTop:12}}>
    <select style={input} value={incCat} onChange={e=>setIncCat(e.target.value)}>
     <option value="MEDICATION_ERROR">Error de medicación</option><option value="FALL">Caída</option><option value="EQUIPMENT">Equipo</option><option value="ADVERSE_DRUG_REACTION">RAM</option><option value="INFECTION">Infección</option><option value="OTHER">Otro</option>
    </select>
    <select style={input} value={incSev} onChange={e=>setIncSev(e.target.value)}><option value="LOW">Leve</option><option value="MODERATE">Moderado</option><option value="SEVERE">Grave</option></select>
    <input style={input} value={incDesc} onChange={e=>setIncDesc(e.target.value)} placeholder="Descripción del incidente" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!incDesc} onClick={createIncident}>{busy==="inc-new"?"Reportando…":"Reportar incidente"}</button></div>
   {incs.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {incs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {incs.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{i.label}</b><div style={{fontSize:12,color:P.muted}}>v{i.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(i.state)}>{i.state}</span>
      {incActions(i).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="ESCALATED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doIncAction(i,act)}>{busy==="inc-"+i.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* TRIAGE / CLASIFICACIÓN DE ACUIDAD */}
  {hospitalOn&&<section style={card}>
   <h2 {...anchor("Triage")} style={{fontSize:18,margin:0}}>Triage</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Clasificación de acuidad (urgencias): arribar → iniciar → clasificar ESI (re-evaluable) → cerrar, o LWBS. Un paciente sin triage completado es un pendiente HIGH en care gaps.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginTop:12}}>
    <input style={input} value={trComplaint} onChange={e=>setTrComplaint(e.target.value)} placeholder="Motivo de consulta (ej. Dolor torácico)" />
    <button style={btn} disabled={busy!==""||!trComplaint} onClick={createTriage}>{busy==="tr-new"?"Registrando…":"Registrar arribo"}</button>
   </div>
   {triages.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {triages.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {triages.map(t=><div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{t.chiefComplaint}{t.acuity>0&&<span style={{...stateBadge(t.acuity<=2?"ESCALATED":"TRIAGED"),marginLeft:8,fontSize:11}}>ESI-{t.acuity}</span>}</b><div style={{fontSize:12,color:P.muted}}>v{t.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(t.state)}>{t.state}</span>
      {trActions(t).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="LWBS"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doTriageAction(t,act)}>{busy==="tr-"+t.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>}

  {/* HERIDAS / LESIONES POR PRESIÓN */}
  {hospitalOn&&<section style={card}>
   <h2 {...anchor("Cuidado de heridas")} style={{fontSize:18,margin:0}}>Cuidado de heridas</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Lesión por presión (UPP) longitudinal: documentar estadio → re-valorar (append-only) → cicatrizar/escalar. Métrica de calidad. Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"180px 180px auto",gap:10,marginTop:12}}>
    <select style={input} value={wnLoc} onChange={e=>setWnLoc(e.target.value)}>
     <option value="SACRUM">Sacro</option><option value="HEEL">Talón</option><option value="ISCHIUM">Isquion</option><option value="TROCHANTER">Trocánter</option><option value="OCCIPUT">Occipucio</option><option value="ELBOW">Codo</option><option value="OTHER">Otro</option>
    </select>
    <select style={input} value={wnStage} onChange={e=>setWnStage(e.target.value)}>
     <option value="STAGE_1">Estadio 1</option><option value="STAGE_2">Estadio 2</option><option value="STAGE_3">Estadio 3</option><option value="STAGE_4">Estadio 4</option><option value="UNSTAGEABLE">No estadiable</option><option value="DTI">LTP profunda</option>
    </select>
    <button style={btn} disabled={busy!==""} onClick={createWound}>{busy==="wn-new"?"Documentando…":"Documentar herida"}</button>
   </div>
   {wounds.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {wounds.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {wounds.map(w=><div key={w.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{w.location} · {w.stage}</b><div style={{fontSize:12,color:P.muted}}>v{w.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(w.state)}>{w.state}</span>
      {wnActions(w).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="ESCALATED"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doWoundAction(w,act)}>{busy==="wn-"+w.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>}

  {/* TRANSFUSIONES */}
  {hospitalOn&&<section style={card}>
   <h2 {...anchor("Transfusiones")} style={{fontSize:18,margin:0}}>Transfusiones</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Medicina transfusional con verificación pre-transfusional: ordenar → cruzar (crossmatch) → iniciar → completar; una reacción se registra como pendiente HIGH (hemovigilancia). Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 120px auto",gap:10,marginTop:12}}>
    <select style={input} value={tfProduct} onChange={e=>setTfProduct(e.target.value)}>
     <option value="PRBC">Concentrado eritrocitario</option><option value="PLATELETS">Plaquetas</option><option value="FFP">Plasma fresco</option><option value="CRYO">Crioprecipitados</option><option value="WHOLE_BLOOD">Sangre total</option>
    </select>
    <input style={input} value={tfUnits} onChange={e=>setTfUnits(e.target.value)} placeholder="Unidades" />
    <button style={btn} disabled={busy!==""} onClick={createTransfusion}>{busy==="tf-new"?"Ordenando…":"Ordenar transfusión"}</button>
   </div>
   {transfs.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {transfs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {transfs.map(t=>{const n=tfNext(t);return <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{t.product} · {t.units} U</b><div style={{fontSize:12,color:P.muted}}>v{t.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(t.state)}>{t.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceTransfusion(t)}>{busy==="tf-"+t.id?"…":n.label}</button>}
      {t.state==="TRANSFUSING"&&<button style={{...ghost,padding:"7px 12px",color:"#b3261e",borderColor:"#f0c9c9"}} disabled={busy!==""} onClick={()=>transfusionReaction(t)}>Reacción</button>}
     </div>
    </div>;})}
   </div>}
  </section>}

  {/* CIRUGÍA / QUIRÓFANO */}
  {hospitalOn&&<section style={card}>
   <h2 {...anchor("Cirugía")} style={{fontSize:18,margin:0}}>Cirugía</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Caso quirúrgico con barrera de seguridad: agendar → time-out OMS (checklist) → iniciar → completar. No se puede iniciar sin el time-out. Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 150px auto",gap:10,marginTop:12}}>
    <input style={input} value={sgProc} onChange={e=>setSgProc(e.target.value)} placeholder="Procedimiento (ej. Colecistectomía)" />
    <select style={input} value={sgLat} onChange={e=>setSgLat(e.target.value)}><option value="NA">Sin lateralidad</option><option value="LEFT">Izquierdo</option><option value="RIGHT">Derecho</option><option value="BILATERAL">Bilateral</option></select>
    <button style={btn} disabled={busy!==""||!sgProc} onClick={createSurgery}>{busy==="sg-new"?"Agendando…":"Agendar cirugía"}</button>
   </div>
   {surgs.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {surgs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {surgs.map(s=>{const n=sgNext(s);const open=s.state==="SCHEDULED"||s.state==="TIMED_OUT";return <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{s.procedure}</b><div style={{fontSize:12,color:P.muted}}>v{s.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(s.state)}>{s.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceSurgery(s)}>{busy==="sg-"+s.id?"…":n.label}</button>}
      {open&&<button style={{...ghost,padding:"7px 12px",color:"#a15c00",borderColor:"#f0d9b8"}} disabled={busy!==""} onClick={()=>cancelSurgery(s)}>Cancelar</button>}
     </div>
    </div>;})}
   </div>}
  </section>}

  {/* DIÁLISIS */}
  {hospitalOn&&<section style={card}>
   <h2 {...anchor("Diálisis")} style={{fontSize:18,margin:0}}>Diálisis</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Terapia de reemplazo renal: agendar → iniciar → completar; una interrupción por complicación se registra como pendiente HIGH y puede reanudarse. Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 200px auto",gap:10,marginTop:12}}>
    <select style={input} value={dzMod} onChange={e=>setDzMod(e.target.value)}>
     <option value="HEMODIALYSIS">Hemodiálisis</option><option value="PERITONEAL">Peritoneal</option><option value="HEMOFILTRATION">Hemofiltración</option>
    </select>
    <select style={input} value={dzAcc} onChange={e=>setDzAcc(e.target.value)}>
     <option value="FISTULA">Fístula</option><option value="GRAFT">Injerto</option><option value="CATHETER">Catéter</option><option value="PERITONEAL_CATHETER">Catéter peritoneal</option>
    </select>
    <button style={btn} disabled={busy!==""} onClick={createDialysis}>{busy==="dz-new"?"Agendando…":"Agendar sesión"}</button>
   </div>
   {dialz.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {dialz.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {dialz.map(d=><div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{d.modality}</b><div style={{fontSize:12,color:P.muted}}>v{d.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(d.state)}>{d.state}</span>
      {dzActions(d).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="INTERRUPTED"||act.to==="NO_SHOW"?{color:"#a15c00",borderColor:"#f0d9b8"}:{})}} disabled={busy!==""} onClick={()=>doDialysisAction(d,act)}>{busy==="dz-"+d.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>}

  {/* DOCUMENTOS CLÍNICOS */}
  <section style={card}>
   <h2 {...anchor("Documentos clínicos")} style={{fontSize:18,margin:0}}>Documentos clínicos</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>La firma produce un snapshot reproducible e inmutable; toda corrección posterior es un addendum append-only (PROD-014-R022).</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 200px",gap:10,marginTop:12}}>
    <input style={input} value={docTitle} onChange={e=>setDocTitle(e.target.value)} placeholder="Título (ej. Nota de evolución)" />
    <select style={input} value={docType} onChange={e=>setDocType(e.target.value)}>
     <option value="PROGRESS_NOTE">Nota de evolución</option><option value="DISCHARGE_SUMMARY">Alta</option>
     <option value="REFERRAL">Referencia</option><option value="PROCEDURE_NOTE">Nota de procedimiento</option><option value="OTHER">Otro</option>
    </select>
   </div>
   <textarea style={{...input,minHeight:64,resize:"vertical",marginTop:10}} value={docContent} onChange={e=>setDocContent(e.target.value)} placeholder="Contenido clínico…" />
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!docContent} onClick={createDoc}>{busy==="doc-new"?"Creando…":"Crear documento"}</button></div>
   {docs.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {docs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {docs.map(d=>{const n=docNext(d);return <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{d.label}</b><div style={{fontSize:12,color:P.muted}}>v{d.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(d.state)}>{d.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceDoc(d)}>{busy==="doc-"+d.id?"…":n.label}</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* OBLIGACIONES / SEGUIMIENTO */}
  <section style={card}>
   <h2 {...anchor("Obligaciones de seguimiento")} style={{fontSize:18,margin:0}}>Obligaciones de seguimiento</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Care gaps / follow-up. Completar exige evidencia (Zero Lost Follow-Up: nada se cierra sin constancia).</p>
   <div style={{display:"flex",gap:10,marginTop:12,alignItems:"center"}}>
    <input style={{...input,maxWidth:420}} value={obKind} onChange={e=>setObKind(e.target.value)} placeholder="Tipo (ej. Contactar por resultado crítico)" />
    <button style={btn} disabled={busy!==""||!obKind} onClick={createObligation}>{busy==="ob-new"?"Creando…":"Crear obligación"}</button>
   </div>
   {obligations.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {obligations.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {obligations.map(o=>{const n=obNext(o);return <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid #eceafb",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{o.label}</b><div style={{fontSize:12,color:P.muted}}>v{o.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}><span style={stateBadge(o.state)}>{o.state}</span>{n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceObligation(o)}>{busy==="ob-"+o.id?"…":n.label}</button>}</div>
    </div>;})}
   </div>}
  </section>

  {/* Auditoría R05a-F07: anular una factura y revocar un consentimiento se disparaban con UN clic. No son reversibles: el
      registro es de solo-añadir, así que lo único posible después es anotar encima. Mismo patrón de diálogo que el bloqueo
      de seguridad, incluido `role="alertdialog"` para que un lector de pantalla lo anuncie como lo que es. */}
  {pendingIrreversible&&<div className="span2" role="alertdialog" aria-labelledby="irrev-title" data-testid="confirm-irreversible" style={{...card,borderColor:"#f0d9b8",background:"#FFF8EC"}}>
   <b id="irrev-title" style={{color:"#a15c00"}}>Acción irreversible — {pendingIrreversible.what}</b>
   <p style={{margin:"6px 0 0",color:"#7a5a1f",wordBreak:"break-word"}}>{pendingIrreversible.detail}</p>
   <div style={{display:"flex",gap:10,marginTop:10,justifyContent:"flex-end"}}>
    <button style={{...ghost,padding:"9px 16px"}} data-testid="cancel-irreversible" onClick={cancelIrreversible}>Cancelar</button>
    <button style={{...btn,background:"#a15c00"}} data-testid="accept-irreversible" disabled={busy!==""} onClick={confirmIrreversible}>{pendingIrreversible.what}</button>
   </div>
  </div>}
  {overrideMed&&<div className="span2" role="alertdialog" aria-labelledby="override-title" style={{...card,borderColor:"#F3C9C9",background:"#FDEEEE"}}>
   <b id="override-title" style={{color:"#B3261E"}}>Bloqueo de seguridad — {overrideMed.med.label}</b>
   <p style={{margin:"6px 0 0",color:"#7a3b34",wordBreak:"break-word"}}>{overrideMed.message}</p>
   <ul style={{margin:"8px 0 0",paddingLeft:18,color:"#7a3b34",fontSize:13}}>{overrideMed.barriers.map(b=><li key={b}>Vas a anular: <b>{BARRIER_LABEL[b]??b}</b></li>)}</ul>
   <label htmlFor="override-why" style={{display:"block",margin:"10px 0 4px",fontSize:12,fontWeight:700,color:"#7a3b34"}}>Justificación clínica de la anulación (queda en el expediente con tu identidad; mínimo 20 caracteres)</label>
   <textarea id="override-why" value={overrideWhy} onChange={e=>setOverrideWhy(e.target.value)} rows={2} maxLength={1000} style={{...input,width:"100%",resize:"vertical"}} />
   <div style={{display:"flex",gap:10,marginTop:10,justifyContent:"flex-end"}}>
    <button style={{...ghost,padding:"9px 16px"}} onClick={()=>{setOverrideMed(null);setOverrideWhy("");}}>Cancelar</button>
    <button style={{...btn,background:"#B3261E",opacity:overrideWhy.trim().length<20?.5:1}} disabled={busy!==""||overrideWhy.trim().length<20} onClick={confirmOverrideMed}>Anular el bloqueo bajo mi responsabilidad</button>
   </div>
  </div>}
  {ackMed&&<div className="span2" role="alertdialog" aria-labelledby="ack-title" style={{...card,borderColor:"#F0DBB8",background:"#FFF7EC"}}>
   <b id="ack-title" style={{color:"#8A4B00"}}>Verificación automática incompleta — {ackMed.med.label}</b>
   <p style={{margin:"6px 0 0",color:"#5A3A0A",wordBreak:"break-word"}}>{ackMed.message}</p>
   <label htmlFor="ack-why" style={{display:"block",margin:"10px 0 4px",fontSize:12,fontWeight:700,color:"#5A3A0A"}}>Justificación clínica (queda en el expediente, mínimo 10 caracteres)</label>
   <textarea id="ack-why" value={ackWhy} onChange={e=>setAckWhy(e.target.value)} rows={2} maxLength={500} style={{...input,width:"100%",resize:"vertical"}} />
   <div style={{display:"flex",gap:10,marginTop:10,justifyContent:"flex-end"}}>
    <button style={{...ghost,padding:"9px 16px"}} onClick={()=>{setAckMed(null);setAckWhy("");}}>Cancelar</button>
    <button style={{...btn,opacity:ackWhy.trim().length<10?.5:1}} disabled={busy!==""||ackWhy.trim().length<10} onClick={confirmAckMed}>Prescribir bajo mi criterio clínico</button>
   </div>
  </div>}
  {error&&<div className="span2" style={{...card,borderColor:"#f0c6c0",background:"#fdf3f2"}}><b style={{color:"#c0392b"}}>Error</b><p style={{margin:"6px 0 0",color:"#7a3b34",wordBreak:"break-word"}}>{error}</p>{error.includes("SAFETY_BLOCKED")&&<p style={{margin:"6px 0 0",fontSize:12,color:"#a15c00"}}>💡 ¿Hay un resultado crítico sin cerrar para este paciente? Ciérralo abajo y vuelve a firmar.</p>}</div>}
  </main>
  </>;

}
