"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "exp" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import {summarizePatient} from "../../../../../packages/patient-summary/src";
import {labReferenceRanges,acceptedUnitsOf,canonicalUnitOf} from "../../../../../packages/lab-reference/src";
import{PatientHeader,AllergyBanner}from"../../../../../packages/design-system/src";
import{Check,ESI_FORM_EMPTY,unidadesDe,avisoDeZona,SOLO_ESTA_PANTALLA,anchor,P,mono,ghost,DX_LABEL,LINE,card,Skeleton,SEX_ES,scrollToSection,scrollTop,UI,SEV,FOLLOW_TYPES,TYPE_LABEL,followState,relTime,CANCEL_KINDS,input,btn,stateBadge,lbl,DOSE_UNITS,medNext,resNext,CHART,trendChart,alActions,probActions,orderNext,referralNext,apptNext,immActions,vitActions,cpActions,clmActions,csActions,admActions,spNext,incActions,trActions,wnActions,tfNext,sgNext,dzActions,docNext,obNext,BARRIER_LABEL,EXP_TABS,ANT_HEREDO,ANT_CRONICOS,ANT_PRENATAL,ANT_PERINATAL,ANT_ALIMENTACION,ANT_DESARROLLO,ANT_INMUNIZA,isPediatricAge,antFreshness,type AntContent,type ExpTab,type TrendKey}from"../shared";
import{searchIcd10}from"../../../../../packages/terminology/src";
// R2B-019: el plazo de reevaluación es de CTAS, no de ESI (ESI no publica tiempos). La pantalla lo dice para que nadie lo
// lea como un número del algoritmo ESI.
const REASSESSMENT_SOURCE_SHORT="CTAS";
import{useWorkspace}from"../context";
import{useState}from"react";
import EncounterForm from"./_encounter";
import PacientesView from"./pacientes";
export default function ExpView(){
 const{cfgSettings,consTabs,patientName,patientId,summary,anyAlert,highGaps,safetyChip,alertGlyph,reset,snap,chartState,tl,gaps,followTab,setFollowTab,busy,loadPanel,panel,selectPatientRaw,regName,setRegName,regDob,setRegDob,regSex,setRegSex,registerPatient,guardianFields,dupPanel,regExtra,setRegExtra,patientQuery,setPatientQuery,loadPatients,patientTotal,patientList,patientMore,exportRecord,loadTimeline,exportInfo,enc,setPatientId,openEncounter,assessment,setAssessment,plan,setPlan,saveAssessment,signEncounter,drug,setDrug,doseAmt,setDoseAmt,doseUnit,setDoseUnit,route,setRoute,freq,setFreq,dose,proposeMed,meds,printPrescription,advanceMed,rxDrug,setRxDrug,setRxCheck,rxDoseAmt,setRxDoseAmt,rxDoseUnit,setRxDoseUnit,rxRoute,setRxRoute,rxFreq,setRxFreq,rxDose,verifyRx,rxMsg,rxCheck,sendRx,resQuick,setResQuick,receiveResult,results,advanceResult,setTrendKey,trendKey,trends,alSub,setAlSub,alSev,setAlSev,alReac,setAlReac,createAllergy,allergies,doAllergyAction,probCode,setProbCode,createProblem,problems,doProblemAction,orderType,setOrderType,orderDetail,setOrderDetail,createOrder,orders,advanceOrder,refSpecialty,setRefSpecialty,refReason,setRefReason,createReferral,referrals,advanceReferral,cancelReferral,apptStart,setApptStart,apptReason,setApptReason,apptCons,setApptCons,apptType,setApptType,createAppointment,appts,advanceAppt,closeAppt,immCode,setImmCode,immDose,setImmDose,createImmunization,imms,doImmAction,vitType,setVitType,vitValue,setVitValue,vitUnit,setVitUnit,createVital,vitals,doVitAction,planCat,setPlanCat,planGoal,setPlanGoal,createPlan,plans,doPlanAction,clmAmount,setClmAmount,clmCurrency,setClmCurrency,createClaim,claims,doClaimAction,csType,setCsType,csRef,setCsRef,createConsent,consents,doConsentAction,hospitalOn,admUnit,setAdmUnit,admReason,setAdmReason,createAdmission,adms,doAdmAction,specType,setSpecType,createSpecimen,specs,advanceSpecimen,rejectSpecimen,incCat,setIncCat,incSev,setIncSev,incDesc,setIncDesc,createIncident,incs,doIncAction,trComplaint,setTrComplaint,createTriage,triages,doTriageAction,trEsiFor,setTrEsiFor,trEsi,setTrEsi,trEsiMsg,setTrEsiMsg,classifyTriage,wnLoc,setWnLoc,wnStage,setWnStage,createWound,wounds,doWoundAction,tfProduct,setTfProduct,tfUnits,setTfUnits,createTransfusion,transfs,advanceTransfusion,transfusionReaction,sgProc,setSgProc,sgLat,setSgLat,createSurgery,surgs,advanceSurgery,cancelSurgery,dzMod,setDzMod,dzAcc,setDzAcc,createDialysis,dialz,doDialysisAction,docTitle,setDocTitle,docType,setDocType,docContent,setDocContent,createDoc,docs,advanceDoc,obKind,setObKind,createObligation,obligations,advanceObligation,overrideMed,overrideWhy,setOverrideWhy,setOverrideMed,confirmOverrideMed,pendingIrreversible,confirmIrreversible,cancelIrreversible,ackMed,ackWhy,setAckWhy,setAckMed,confirmAckMed,error,expTab,setExpTab,setView,openConsulta,antSnap,antForm,setAntForm,antBusy,antMsg,antReason,setAntReason,antEditing,setAntEditing,saveAntecedentes,openEdit,patEdit,setPatEdit,editForm,setEditForm,amendPatient,editBusy,patMsg,setPatMsg,medProblem,setMedProblem,ordProblem,setOrdProblem,docsSnap,docDetail,docDetBusy,loadDoc,setDocDetail,attInputRef,attBusy,attMsg,ATT_MIME,onPickAttachment,viewAttachment,removeAttachment,fmtBytes}=useWorkspace();
 // Confirmación de dos pasos para quitar un adjunto (UI efímera; quitar borra el blob privado, acción registrada en bitácora).
 const[attConfirm,setAttConfirm]=useState<string|null>(null);
 // POMR: problemas ACTIVOS del paciente, para enlazar medicación/órdenes "contra qué diagnóstico". Se derivan del
 // expediente vivo (lista `problems` ya hidratada); si no hay ninguno, el selector no aparece (no se inventa un vínculo).
 const problemasActivos=problems.filter(p=>p.state==="ACTIVE"||p.state==="CHRONIC");
 // Patient 360 (Lote B): la sub-vista activa decide qué secciones se montan. La pestaña "hospital" solo existe con
 // hospitalOn; si la URL trae ?s=hospital sin las verticales encendidas, caemos a "resumen" para no dejar la vista vacía.
 const activeTab:ExpTab=(expTab==="hospital"&&!hospitalOn)?"resumen":expTab;
 const inTab=(g:ExpTab)=>activeTab===g;
 // Navegación entre sub-vistas (pestañas y accesos rápidos del hero); opcionalmente enfoca una sección tras montar.
 const goTab=(g:ExpTab,section?:string)=>{setExpTab(g);if(section)requestAnimationFrame(()=>scrollToSection(section));else scrollTop();};

 // Fusión Pacientes⟷Expediente: el expediente es longitudinal (siempre de UN paciente). Sin paciente en foco, esta
 // misma vista ES la lista de Pacientes (buscar/registrar); seleccionar uno fija patientId y abajo se monta su expediente.
 // Una sola puerta: "Pacientes → Expediente". (El menú lateral "Pacientes" apunta a esta vista y limpia el paciente.)
 if(!patientId)return <PacientesView/>;

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
     : <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"var(--c-green-bg)",color:P.greenOnPale,border:"1px solid var(--c-green-bd)",borderRadius:999,padding:"4px 12px",fontSize:12.5,fontWeight:600,whiteSpace:"nowrap"}}>✓ Sin alertas de seguridad</span>
    )}
   actions={<div style={{display:"flex",gap:8,alignItems:"center"}}>
     <button style={{...btn,padding:"7px 14px",fontSize:13,flex:"0 0 auto"}} onClick={()=>openConsulta(patientId,patientName)}>Iniciar consulta →</button>
     <button style={{...ghost,padding:"7px 12px",fontSize:13,flex:"0 0 auto"}} onClick={reset} title="Dejar de ver este paciente y volver a la lista">Cerrar paciente</button>
    </div>}/>
  <main className="mos-grid">
  {/* PATIENT 360 (Lote B) — navegación por sub-vistas: el expediente deja de ser un scroll único de ~30 secciones */}
  <nav className="span2" aria-label="Secciones del expediente" style={{position:"sticky",top:0,zIndex:5,background:"var(--c-wash)",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",padding:"2px 0 10px",marginBottom:2,borderBottom:`1px solid ${LINE}`}}>
   {EXP_TABS.filter(t=>!t.hospital||hospitalOn).map(t=>{const on=activeTab===t.key;return <button key={t.key} type="button" onClick={()=>goTab(t.key)} aria-current={on?"page":undefined} title={t.hint} style={{background:on?"var(--c-blue-bg)":"transparent",color:on?P.blue:P.muted,border:`1px solid ${on?"var(--c-blue-bd)":LINE}`,borderRadius:999,padding:"7px 16px",fontSize:13.5,fontWeight:on?700:600,fontFamily:UI,cursor:"pointer"}}>{t.label}</button>;})}
  </nav>
  {/* HERO — Vista principal · Durante la consulta (panel 1, snapshot determinista) */}
  {inTab("resumen")&&snap&&(()=>{
   const d=snap.demographics;
   const dx=[...new Set(snap.problems.map(DX_LABEL))].slice(0,6);
   const bp=snap.vitals["BP"],hr=snap.vitals["HR"];
   const vcard=(label:string,value:string|number|undefined,unit:string,sub:string,warn?:boolean)=>(
    <div style={{minWidth:0,background:"var(--c-surface)",border:`1px solid ${warn?"var(--c-amber-bd)":LINE}`,borderRadius:14,padding:"14px 16px"}}>
     <div style={{fontSize:12,color:P.muted,marginBottom:4}}>{label}</div>
     <div style={{fontSize:24,fontWeight:800,letterSpacing:"-.01em",color:warn?"var(--c-amber-fg)":P.ink}}>{value??"—"} <span style={{fontSize:13,fontWeight:600,color:P.muted}}>{value!==undefined?unit:""}</span></div>
     <div style={{fontSize:11.5,color:P.muted,marginTop:2}}>{sub||" "}</div>
    </div>);
   // [etiqueta, sub-vista destino, sección a enfocar] — accesos rápidos que navegan a la pestaña correspondiente.
   const tabs:[string,ExpTab,string?][]=[["Resumen","resumen"],["Historia","historia","Timeline del paciente"],["Medicamentos","medicacion","Medicación"],["Resultados","resultados","Resultados diagnósticos"],["Problemas","problemas","Lista de problemas"],["Plan","plan","Plan de cuidados"],["Seguimiento","coordinacion","Obligaciones de seguimiento"]];
   return <section className="span2" style={{...card,marginTop:0,padding:0,overflow:"hidden"}}>
    <div style={{padding:"18px 22px",borderBottom:`1px solid ${LINE}`,background:"linear-gradient(180deg,var(--c-wash2),#fff)"}}>
     <div style={{fontSize:17,fontWeight:800,letterSpacing:"-.01em"}}>Vista principal · Durante la consulta</div>
     <div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Toda la información crítica, en el momento correcto.</div>
    </div>
    <div className="mos-hero-grid">
     <div style={{padding:22,borderRight:`1px solid ${LINE}`}}>
      <div style={{display:"flex",gap:14,alignItems:"center"}}>
       <span style={{width:52,height:52,borderRadius:"50%",background:"var(--c-blue-bg)",color:P.blue,display:"grid",placeItems:"center",fontWeight:800,fontSize:18,flex:"0 0 auto"}}>{(patientName||"P").trim().slice(0,2).toUpperCase()}</span>
       <div style={{minWidth:0}}>
        <div style={{fontSize:19,fontWeight:800}}>{patientName||"Paciente"}</div>
        <div style={{fontSize:13,color:P.muted}}>{d.age} años · {SEX_ES[d.sex]??d.sex} · ID <span style={mono}>{patientId.slice(0,8)}</span></div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>{dx.length?dx.map(x=><span key={x} style={{background:"var(--c-blue-bg)",color:P.blueOnPale,border:"1px solid var(--c-blue-bd)",borderRadius:8,padding:"2px 9px",fontSize:12,fontWeight:600}}>{x}</span>):<span style={{fontSize:12,color:P.muted}}>Sin diagnósticos activos</span>}</div>
       </div>
      </div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:16,borderBottom:`1px solid ${LINE}`}}>
       {tabs.map(([t,g,h2],i)=><button key={t} onClick={()=>goTab(g,h2)} style={{background:"transparent",border:0,borderBottom:i===0?`2px solid ${P.blue}`:"2px solid transparent",color:i===0?P.blue:P.muted,fontWeight:i===0?700:500,fontSize:13,fontFamily:UI,padding:"7px 10px",cursor:"pointer"}}>{t}</button>)}
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
     <div style={{padding:22,display:"flex",flexDirection:"column",gap:18,background:"var(--c-wash2)"}}>
      <div>
       <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Alergias y seguridad</div>
       <AllergyBanner allergies={snap.allergies}/>
      </div>
      <div style={{borderTop:`1px solid ${LINE}`,paddingTop:16}}>
       <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Alertas y sugerencias</div>
       <div style={{fontSize:11.5,color:P.muted,marginBottom:10}}>Reglas + guías · determinista, sin IA generativa</div>
       {snap.findings.length?<div style={{display:"flex",flexDirection:"column",gap:8}}>{snap.findings.slice(0,6).map((f,i)=>{const s=SEV[f.severity]??SEV.INFO;return <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"9px 11px",borderRadius:10,background:s.bg,border:`1px solid ${s.bd}`}}>
        <span style={{background:"var(--c-surface)",color:s.fg,border:`1px solid ${s.bd}`,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:800,letterSpacing:".03em",whiteSpace:"nowrap",marginTop:1}}>{s.label}</span>
        <span style={{fontSize:13,color:"var(--c-ink)",lineHeight:1.4}}>{f.summary}</span>
       </div>;})}{snap.findings.length>6&&<div style={{fontSize:11.5,fontWeight:700,color:P.amberOnPale}}>+{snap.findings.length-6} hallazgo(s) más no mostrados aquí: ábralos en Clinical Intelligence.</div>}</div>:<div style={{fontSize:13,color:P.greenOnPale,fontWeight:600}}>✓ Sin alertas clínicas.</div>}
      </div>
     </div>
    </div>
   </section>;
  })()}
  {/* HERO skeleton — SOLO mientras el snapshot está cargando (chartState==="loading"); si ya cargó sin snapshot
      (paciente sin expediente registrado) se muestra el estado vacío honesto de abajo, nunca un skeleton perpetuo. */}
  {inTab("resumen")&&patientId&&!snap&&chartState==="loading"&&<section className="span2" aria-hidden style={{...card,marginTop:0,padding:0,overflow:"hidden"}}>
   <div style={{padding:"18px 22px",borderBottom:`1px solid ${LINE}`,background:"linear-gradient(180deg,var(--c-wash2),#fff)"}}><Skeleton w={260} h={16}/><Skeleton w={200} h={11} style={{marginTop:6}}/></div>
   <div className="mos-hero-grid">
    <div style={{padding:22,borderRight:`1px solid ${LINE}`}}>
     <div style={{display:"flex",gap:14,alignItems:"center"}}><Skeleton w={52} h={52} r={26}/><div style={{flex:1}}><Skeleton w={"55%"} h={17}/><Skeleton w={"70%"} h={12} style={{marginTop:6}}/><div style={{display:"flex",gap:6,marginTop:8}}>{Array.from({length:3}).map((_,i)=><Skeleton key={i} w={70} h={20} r={8}/>)}</div></div></div>
     <Skeleton w={140} h={12} style={{margin:"18px 0 10px"}}/>
     <div className="mos-vitals">{Array.from({length:4}).map((_,i)=><div key={i} style={{background:"var(--c-surface)",border:`1px solid ${LINE}`,borderRadius:14,padding:"14px 16px"}}><Skeleton w={"60%"} h={11}/><Skeleton w={80} h={22} style={{marginTop:6}}/><Skeleton w={"50%"} h={10} style={{marginTop:6}}/></div>)}</div>
     <Skeleton w={120} h={12} style={{margin:"18px 0 8px"}}/>
     <div style={{display:"flex",flexDirection:"column",gap:8}}>{Array.from({length:3}).map((_,i)=><Skeleton key={i} w={`${70-i*10}%`} h={13}/>)}</div>
    </div>
    <div style={{padding:22,display:"flex",flexDirection:"column",gap:18,background:"var(--c-wash2)"}}>
     <div><Skeleton w={150} h={12} style={{marginBottom:8}}/><Skeleton w={"100%"} h={44} r={10}/></div>
     <div style={{borderTop:`1px solid ${LINE}`,paddingTop:16}}><Skeleton w={160} h={12} style={{marginBottom:10}}/>{Array.from({length:3}).map((_,i)=><Skeleton key={i} w={"100%"} h={40} r={10} style={{marginBottom:8}}/>)}</div>
    </div>
   </div>
  </section>}
  {/* HERO estado vacío/honesto — snapshot ya resuelto pero sin datos (paciente sin expediente registrado) o con error de
      carga. Reemplaza al skeleton perpetuo que veía el médico cuando el snapshot nunca llegaba (p. ej. paciente sin registrar). */}
  {inTab("resumen")&&patientId&&!snap&&chartState!=="loading"&&<section className="span2" style={{...card,marginTop:0}}>
   <div style={{fontSize:17,fontWeight:800,letterSpacing:"-.01em"}}>Vista principal · Durante la consulta</div>
   {chartState==="error"
    ?<p style={{fontSize:13.5,color:P.muted,margin:"8px 0 0",maxWidth:620,lineHeight:1.5}}>No se pudo cargar el panel clínico de este paciente. Es un fallo de carga, no «sin datos»: reintenta en unos momentos.</p>
    :<p style={{fontSize:13.5,color:P.muted,margin:"8px 0 0",maxWidth:620,lineHeight:1.5}}>Este paciente aún no tiene un expediente clínico con datos para el resumen. Registra signos vitales, diagnósticos, resultados o medicación desde las pestañas del expediente y el resumen se construirá aquí automáticamente.</p>}
  </section>}
  {/* SEGUIMIENTO AUTOMÁTICO (panel 5) — Zero-Lost-Follow-Up desde timeline + care-gaps */}
  <section hidden={!inTab("resumen")} style={card}>
   <div><h2 {...anchor("Seguimiento automático")} style={{fontSize:18,margin:0}}>Seguimiento automático</h2><p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Nada se pierde. Todo se coordina. Obligaciones e interconsultas con owner y cierre.</p></div>
   {(()=>{
    const fromTl=(tl??[]).filter(t=>FOLLOW_TYPES.has(t.aggregateType)).map(t=>({label:TYPE_LABEL[t.aggregateType]??t.aggregateType,kind:t.latestKind,at:t.lastAt,status:followState(t.latestKind),type:t.aggregateType}));
    const fromGaps=(gaps??[]).map(g=>({label:g.label,kind:g.priority,at:"",status:"pend" as const,type:g.aggregateType}));
    const all=[...fromTl.filter(x=>x.status!=="skip"),...fromGaps];
    const counts={pend:all.filter(x=>x.status==="pend").length,prog:all.filter(x=>x.status==="prog").length,done:all.filter(x=>x.status==="done").length,all:all.length};
    const shown=followTab==="all"?all:all.filter(x=>x.status===followTab);
    const tabs:[typeof followTab,string,number][]=[["pend","Pendientes",counts.pend],["prog","Programados",counts.prog],["done","Completados",counts.done],["all","Todos",counts.all]];
    const sb=(s:string)=>s==="pend"?{bg:"var(--c-amber-bg)",fg:P.amberOnPale,t:"Pendiente"}:s==="prog"?{bg:"var(--c-blue-bg)",fg:"var(--c-blue-fg)",t:"Programado"}:{bg:"var(--c-green-bg)",fg:P.greenOnPale,t:"Completado"};
    return <>
     <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:12,borderBottom:`1px solid ${LINE}`}}>
      {tabs.map(([k,l,n])=><button key={k} onClick={()=>setFollowTab(k)} style={{background:"transparent",border:0,borderBottom:followTab===k?`2px solid ${P.blue}`:"2px solid transparent",color:followTab===k?P.blue:P.muted,fontWeight:followTab===k?700:500,fontSize:13,fontFamily:UI,padding:"7px 10px",cursor:"pointer"}}>{l} {n>0&&<span style={{fontVariantNumeric:"tabular-nums"}}>({n})</span>}</button>)}
     </div>
     {shown.length?<div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>{shown.slice(0,8).map((x,i)=>{const s=sb(x.status);const stripe=x.status==="pend"?"#C87B12":x.status==="prog"?"#1769E0":P.greenOnPale;return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px 10px 14px",border:`1px solid ${LINE}`,borderLeft:`3px solid ${stripe}`,borderRadius:10}}>
      <div style={{minWidth:0}}><div style={{fontSize:13.5,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{x.label}</div><div style={{fontSize:11.5,color:P.muted}}>{x.at?relTime(x.at):"seguimiento clínico"}</div></div>
      <span style={{background:s.bg,color:s.fg,fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap"}}>{s.t}</span>
     </div>;})}</div>:<div style={{marginTop:12,padding:"12px 14px",borderRadius:12,background:"var(--c-green-bg)",border:"1px solid var(--c-green-bg)",fontSize:13,color:P.greenOnPale}}>✓ Sin seguimientos {followTab==="pend"?"pendientes":followTab==="prog"?"programados":followTab==="done"?"completados":"registrados"}.</div>}
     <div style={{display:"flex",alignItems:"center",gap:8,marginTop:14,padding:"10px 14px",borderRadius:12,background:"var(--c-green-bg)",border:"1px solid var(--c-green-bd)",fontSize:12.5,color:P.greenOnPale,fontWeight:600}}>✓ Seguimiento activo — el sistema mantiene owner, estado y cierre de cada obligación (Zero-Lost-Follow-Up).</div>
    </>;
   })()}
  </section>

  {/* SEGURIDAD Y AUDITORÍA (panel 7) — estado del sistema + actividad desde la cadena de auditoría */}
  <section hidden={!inTab("admin")} className="span2" style={card}>
   <div><h2 {...anchor("Seguridad y auditoría")} style={{fontSize:18,margin:0}}>Seguridad y auditoría</h2><p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Confianza por diseño. Cada acción clínica queda registrada.</p></div>
   <div className="mos-rx-grid">
    <div style={{background:"linear-gradient(160deg,#0C2148,var(--c-blue-fg))",borderRadius:14,padding:"16px 18px",color:"var(--c-blue-bg)"}}>
     <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{width:22,height:22,borderRadius:"50%",background:P.greenOnPale,display:"grid",placeItems:"center",fontSize:13}}>✓</span><b style={{fontSize:14}}>Estado del sistema</b></div>
     {[["Cifrado de datos","En tránsito (HTTPS); en reposo, por el proveedor de base de datos"],["Control de acceso","Por rol y scope, con aislamiento por consultorio (RLS forzado)"],["Auditoría","Cadena de hash inmutable de cada comando clínico, verificable (pnpm audit:verify)"],["Recuperabilidad","Registro de eventos append-only; el cliente reintenta con la misma clave de idempotencia"],["Normativa","NOM-004 / NOM-024 / LFPDPPP: en proceso; sin certificación (ver registro normativo del proyecto)"]].map(([t,d])=><div key={t} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"7px 0",borderTop:"1px solid #ffffff14"}}>
      <span style={{color:"#5FD08C",marginTop:1,flex:"0 0 auto"}}>●</span><div><div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{t}</div><div style={{fontSize:11.5,color:"var(--c-blue-bd)"}}>{d}</div></div>
     </div>)}
    </div>
    <div>
     <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Actividad reciente</div>
     {tl&&tl.length?<div style={{display:"flex",flexDirection:"column",gap:2}}>{tl.slice(0,7).map((t,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderBottom:i<6?`1px solid ${LINE}`:"0"}}>
      <span style={{width:26,height:26,borderRadius:8,background:"var(--c-blue-bg)",color:P.blue,display:"grid",placeItems:"center",fontSize:11,fontWeight:800,flex:"0 0 auto"}}>{(TYPE_LABEL[t.aggregateType]??t.aggregateType).slice(0,1)}</span>
      <div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{TYPE_LABEL[t.aggregateType]??t.aggregateType} · <span style={{color:P.muted,fontWeight:500}}>{t.latestKind}</span></div><div style={{fontSize:11.5,color:P.muted}}>{relTime(t.lastAt)}</div></div>
     </div>)}</div>:<div style={{fontSize:13,color:P.muted,padding:"12px 0"}}>Sin actividad registrada para este paciente todavía.</div>}
    </div>
   </div>
  </section>

  {/* PORTAL DEL PACIENTE (panel 6) — vista previa (solo lectura) del app del paciente, desde datos reales */}
  <section hidden={!inTab("admin")} style={card}>
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
     <div style={{display:"flex",alignItems:"center",gap:11,padding:"11px 13px",background:"var(--c-surface)",borderBottom:`1px solid ${LINE}`}}>
      <span style={{width:30,height:30,borderRadius:9,background:soon?"var(--c-wash)":"var(--c-blue-bg)",color:soon?P.muted:P.blue,display:"grid",placeItems:"center",flex:"0 0 auto"}}>{icon}</span>
      <div style={{minWidth:0,flex:1}}><div style={{fontSize:12.5,fontWeight:700}}>{title}</div><div style={{fontSize:10.5,color:P.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sub}</div></div>
      {soon?<span style={{fontSize:9,fontWeight:700,color:P.muted,background:"var(--c-wash)",borderRadius:999,padding:"2px 7px",flex:"0 0 auto"}}>Próximamente</span>
       :badge!==undefined&&badge>0?<span style={{fontSize:10,fontWeight:800,color:"#fff",background:P.redOnPale,borderRadius:999,minWidth:17,height:17,display:"grid",placeItems:"center",padding:"0 4px",flex:"0 0 auto"}}>{badge}</span>
       :<span style={{color:"var(--c-blue-bd)",flex:"0 0 auto"}}>›</span>}
     </div>);
    const pIcon=(d:string)=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d}/></svg>;
    return <div className="mos-phone">
     <div className="screen">
      <div style={{background:`linear-gradient(150deg,${P.blueOnPale},#20B7D9)`,padding:"16px 16px 18px",color:"#fff"}}>
       <div style={{fontSize:10,fontWeight:800,letterSpacing:".12em",opacity:.9}}>MEDIC OS</div>
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
  <section hidden={!inTab("admin")} style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <h2 {...anchor("Panel del clínico")} style={{fontSize:18,margin:0}}>Panel del clínico</h2>
    <button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={loadPanel}>{busy==="panel"?"Cargando…":"Cargar worklist"}</button>
   </div>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Pendientes clínicos accionables de TODO el panel (todos los pacientes del tenant), priorizados. Inteligencia por reglas, sin IA.</p>
   {panel&&<div style={{marginTop:12}}>
    {panel.gaps.length===0?<div style={{padding:"10px 14px",borderRadius:12,background:"var(--c-green-bg)",border:"1px solid var(--c-green-bg)",fontSize:13,color:P.greenOnPale}}>✓ Sin pendientes accionables en el panel.</div>
     :<div><div style={{fontSize:12,color:P.muted,marginBottom:8}}>{panel.gaps.length} pendientes · {panel.patientCount} pacientes</div>
     <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:280,overflowY:"auto"}}>{panel.gaps.map(g=>{const col=g.priority==="HIGH"?["var(--c-red-bg)",P.redOnPale]:g.priority==="MEDIUM"?["var(--c-amber-bg)",P.amberOnPale]:["var(--c-blue-bg)","var(--c-purple-fg)"];return <div key={g.patientId+g.aggregateId+g.code} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 12px",border:"1px solid var(--c-line)",borderRadius:10}}>
      <div style={{minWidth:0}}><span style={{...mono,marginRight:8}}>{g.patientId.slice(0,8)}</span><span style={{fontSize:13}}>{g.label}</span></div>
      <div style={{display:"flex",gap:8,alignItems:"center",whiteSpace:"nowrap"}}><span style={{display:"inline-block",background:col[0],color:col[1],fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:999}}>{g.priority}</span><button style={{...ghost,padding:"5px 10px",fontSize:12}} onClick={()=>selectPatientRaw(g.patientId,"")}>Abrir</button></div>
     </div>;})}</div></div>}
   </div>}
  </section>

  {/* PACIENTE (registro / selección) */}
  <section hidden={!inTab("admin")} style={card}>
   <h2 {...anchor("Paciente")} style={{fontSize:18,margin:0}}>Paciente</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Registra un paciente o selecciónalo de la lista. El chart de abajo es del paciente activo.</p>
   {/* Edición de datos del paciente ACTIVO (vive aquí tras la fusión Pacientes⟷Expediente; antes estaba en la ficha). */}
   {patientId&&<div style={{marginTop:12,padding:14,border:`1px solid ${LINE}`,borderRadius:12,background:"var(--c-wash2)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
     <div style={{fontSize:13.5,fontWeight:800}}>Datos del paciente activo{patientName?` · ${patientName}`:""}</div>
     {!patEdit&&<button onClick={()=>openEdit(patientId)} style={{...ghost,padding:"7px 12px",fontSize:13}}>Editar datos</button>}
    </div>
    {patMsg&&<div style={{marginTop:10,display:"flex",alignItems:"center",gap:10,background:patMsg.includes("✓")?"var(--c-green-bg)":"var(--c-blue-bg)",border:`1px solid ${patMsg.includes("✓")?"var(--c-green-bd)":"var(--c-blue-bd)"}`,borderRadius:9,padding:"8px 12px",fontSize:13}}><span style={{color:patMsg.includes("✓")?P.green:P.blue,fontWeight:700}}>{patMsg.includes("✓")?"✓":"ℹ"}</span><span style={{flex:1}}>{patMsg}</span><button onClick={()=>setPatMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {patEdit&&<div style={{marginTop:12,display:"flex",flexDirection:"column",gap:10}}>
     <div><label style={lbl}>Nombre completo</label><input aria-label="Editar nombre completo" style={input} value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})}/></div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <div><label style={lbl}>Fecha de nacimiento</label><input aria-label="Editar fecha de nacimiento" type="date" style={input} value={editForm.birthDate} onChange={e=>setEditForm({...editForm,birthDate:e.target.value})}/></div>
      <div><label style={lbl}>Sexo</label><select aria-label="Editar sexo del paciente" style={input} value={editForm.sexAtBirth} onChange={e=>setEditForm({...editForm,sexAtBirth:e.target.value})}><option value="FEMALE">Femenino</option><option value="MALE">Masculino</option><option value="INTERSEX">Intersexual</option><option value="UNKNOWN">Sin especificar</option></select></div>
     </div>
     <div><label style={lbl}>CURP</label><input aria-label="Editar CURP" style={input} value={editForm.curp} onChange={e=>setEditForm({...editForm,curp:e.target.value.toUpperCase()})}/></div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <div><label style={lbl}>Teléfono</label><input aria-label="Editar teléfono" style={input} value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})}/></div>
      <div><label style={lbl}>Correo</label><input aria-label="Editar correo electrónico" style={input} value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})}/></div>
     </div>
     <div><label style={lbl}>Dirección</label><input aria-label="Editar dirección" style={input} value={editForm.address} onChange={e=>setEditForm({...editForm,address:e.target.value})}/></div>
     <div style={{display:"flex",gap:10}}>
      <button onClick={()=>void amendPatient(patientId)} disabled={editBusy||!editForm.name.trim()} style={{...btn,padding:"9px 18px",opacity:(editBusy||!editForm.name.trim())?.6:1}}>{editBusy?"Guardando…":"Guardar cambios"}</button>
      <button onClick={()=>setPatEdit(false)} style={{...ghost,padding:"9px 16px"}}>Cancelar</button>
     </div>
    </div>}
   </div>}
   <div style={{display:"grid",gridTemplateColumns:"1fr 160px 150px auto",gap:10,marginTop:12,alignItems:"center"}}>
    <input aria-label="Nombre completo" style={input} value={regName} onChange={e=>setRegName(e.target.value)} placeholder="Nombre completo" />
    <input aria-label="Fecha de nacimiento" style={input} type="date" value={regDob} onChange={e=>setRegDob(e.target.value)} />
    <select aria-label="Sexo al nacer" style={input} value={regSex} onChange={e=>setRegSex(e.target.value)}><option value="FEMALE">Femenino</option><option value="MALE">Masculino</option><option value="INTERSEX">Intersexual</option><option value="UNKNOWN">Sin especificar</option></select>
    <button style={btn} disabled={busy!==""||!regName||!regDob} onClick={()=>registerPatient()}>{busy==="pt-reg"?"Registrando…":"Registrar"}</button>
   </div>
   {guardianFields(input)}{dupPanel(false)}
   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:10}}>
    <input aria-label="CURP" style={input} value={regExtra.curp} onChange={e=>setRegExtra(x=>({...x,curp:e.target.value.toUpperCase()}))} placeholder="CURP" maxLength={18} />
    <input aria-label="Teléfono" style={input} value={regExtra.phone} onChange={e=>setRegExtra(x=>({...x,phone:e.target.value}))} placeholder="Teléfono" />
    <input aria-label="Correo electrónico" style={input} value={regExtra.email} onChange={e=>setRegExtra(x=>({...x,email:e.target.value}))} placeholder="Correo electrónico" />
    <input aria-label="Dirección" style={input} value={regExtra.address} onChange={e=>setRegExtra(x=>({...x,address:e.target.value}))} placeholder="Dirección (ciudad, estado)" />
    <input aria-label="Ocupación" style={input} value={regExtra.occupation} onChange={e=>setRegExtra(x=>({...x,occupation:e.target.value}))} placeholder="Ocupación" />
    <select aria-label="Estado civil" style={input} value={regExtra.maritalStatus} onChange={e=>setRegExtra(x=>({...x,maritalStatus:e.target.value}))}><option value="">Estado civil…</option><option>Soltero(a)</option><option>Casado(a)</option><option>Unión libre</option><option>Divorciado(a)</option><option>Viudo(a)</option></select>
   </div>
   <div style={{marginTop:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
    <input aria-label="Buscar paciente" style={{...input,maxWidth:280}} value={patientQuery} onChange={e=>setPatientQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void loadPatients();}} placeholder="Buscar por nombre o CURP…" />
    <button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>loadPatients()}>{busy==="pt-list"?"Cargando…":"Cargar / buscar pacientes"}</button>
    {patientTotal!==null&&patientList&&<span style={{fontSize:12,color:P.muted}}>{patientMore?`Mostrando ${patientList.length} de ${patientTotal} pacientes — escriba para acotar la búsqueda`:`${patientList.length} de ${patientTotal} pacientes`}</span>}
   </div>
   {patientList&&<div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6,maxHeight:220,overflowY:"auto"}}>
    {patientList.length===0?<p style={{color:P.muted,fontSize:13}}>No hay pacientes registrados en este tenant.</p>
     :patientList.map(p=><div key={p.patientId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",border:"1px solid var(--c-line)",borderRadius:10,background:p.patientId===patientId?"var(--c-purple-bg)":"white"}}>
      <div><b style={{fontSize:14}}>{p.name}</b> <span style={stateBadge(p.status==="ACTIVE"?"ACTIVE":p.status==="INACTIVE"?"INACTIVE":"CANCELLED")}>{p.status}</span></div>
      <button style={{...ghost,padding:"6px 12px"}} onClick={()=>selectPatientRaw(p.patientId,p.name)}>{p.patientId===patientId?"Activo":"Seleccionar"}</button>
     </div>)}
   </div>}
  </section>

  {/* MATRIZ FUNDACIONAL — Antecedentes (historia clínica basal): se captura una vez (RECORDED) y se enmienda con motivo. */}
  <section hidden={!inTab("historia")} className="span2" style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
    <div style={{minWidth:0}}>
     <h2 {...anchor("Antecedentes")} style={{fontSize:18,margin:0}}>Antecedentes</h2>
     <p style={{color:P.muted,fontSize:12,margin:"4px 0 0",maxWidth:620}}>Historia clínica basal del paciente: se captura una vez y se actualiza con motivo. La consulta la muestra y ya no la vuelve a preguntar.</p>
    </div>
    {!antEditing&&(()=>{const f=antFreshness(!!antSnap?.recorded,antSnap?.updatedAt);return <div style={{display:"flex",gap:10,alignItems:"center",flex:"0 0 auto"}}>
     {f.status==="DUE"&&<span role="status" title={`Última actualización hace ${f.days} días (> 6 meses): reverifícalos`} style={{fontSize:11,fontWeight:700,borderRadius:999,padding:"3px 10px",background:"var(--c-amber-bg)",color:P.amberOnPale}}>⟳ Por verificar</span>}
     {antSnap?.recorded&&antSnap.updatedAt&&<span style={{fontSize:11.5,color:P.muted}}>Actualizado {relTime(antSnap.updatedAt)}</span>}
     <button onClick={()=>setAntEditing(true)} style={{...btn,padding:"7px 14px",fontSize:13}}>{!antSnap?.recorded?"Capturar antecedentes":f.status==="DUE"?"Verificar / actualizar":"Editar"}</button>
    </div>;})()}
   </div>
   {(()=>{
    const sex=snap?.demographics.sex;const age=snap?.demographics.age;const pediatric=isPediatricAge(age);
    // Auto-selección del formato (historia clínica adulto vs. pediátrica) por la edad. En pediátrico no hay gineco-obstétricos.
    const showGineco=!pediatric&&(sex==="FEMALE"||antForm.ginecoObstetricos?.aplica===true);
    const hab=antForm.noPatologicos;const pat=antForm.patologicos;
    const chip=(active:boolean,label:string,onClick:()=>void)=><button key={label} type="button" onClick={onClick} style={{border:`1px solid ${active?P.purple:LINE}`,background:active?"var(--c-purple-bg)":P.white,color:active?P.purple:P.ink,borderRadius:999,padding:"5px 12px",fontSize:12.5,fontWeight:active?700:500,cursor:"pointer",fontFamily:UI}}>{label}</button>;
    const ta2:React.CSSProperties={...input,minHeight:52,resize:"vertical",width:"100%"};
    const lbl2:React.CSSProperties={fontSize:12.5,fontWeight:700,color:P.ink,display:"block",margin:"2px 0 7px"};
    const toggleHeredo=(flag:string)=>setAntForm(f=>{const cur=f.heredofamiliares?.flags??[];return{...f,heredofamiliares:{...f.heredofamiliares,flags:cur.includes(flag)?cur.filter(x=>x!==flag):[...cur,flag]}};});
    const toggleCronico=(flag:string)=>setAntForm(f=>{const cur=f.patologicos?.cronicos??[];return{...f,patologicos:{...f.patologicos,cronicos:cur.includes(flag)?cur.filter(x=>x!==flag):[...cur,flag]}};});
    const setHer=(p:Partial<NonNullable<AntContent["heredofamiliares"]>>)=>setAntForm(f=>({...f,heredofamiliares:{...f.heredofamiliares,...p}}));
    const setPat=(p:Partial<NonNullable<AntContent["patologicos"]>>)=>setAntForm(f=>({...f,patologicos:{...f.patologicos,...p}}));
    const setHab=(p:Partial<NonNullable<AntContent["noPatologicos"]>>)=>setAntForm(f=>({...f,noPatologicos:{...f.noPatologicos!,...p}}));
    const setQx=(p:Partial<NonNullable<AntContent["quirurgicos"]>>)=>setAntForm(f=>({...f,quirurgicos:{...f.quirurgicos,...p}}));
    const setGO=(p:Partial<NonNullable<AntContent["ginecoObstetricos"]>>)=>setAntForm(f=>({...f,ginecoObstetricos:{...f.ginecoObstetricos,...p}}));
    const secBox:React.CSSProperties={border:`1px solid ${LINE}`,borderRadius:12,padding:"14px 16px",background:"var(--c-wash2)"};
    const secTtl:React.CSSProperties={fontSize:13.5,fontWeight:800,margin:"0 0 10px"};
    // Secciones PEDIÁTRICAS (formato II): mismo patrón que heredofamiliares (chips de catálogo + notas), genérico.
    const PEDI_SECS=["prenatales","perinatales","alimentacion","desarrollo","inmunizaciones"] as const;type PediKey=typeof PEDI_SECS[number];
    const setSec=(key:PediKey,p:{flags?:string[];notas?:string})=>setAntForm(f=>({...f,[key]:{...f[key],...p}}));
    const toggleSecFlag=(key:PediKey,flag:string)=>setAntForm(f=>{const cur=f[key]?.flags??[];return{...f,[key]:{...f[key],flags:cur.includes(flag)?cur.filter(x=>x!==flag):[...cur,flag]}};});
    const pediSec=(key:PediKey,title:string,catalog:readonly string[])=><div key={key} style={secBox}><div style={secTtl}>{title}</div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{catalog.map(fl=>chip((antForm[key]?.flags??[]).includes(fl),fl,()=>toggleSecFlag(key,fl)))}</div><textarea style={{...ta2,marginTop:10}} aria-label={title} placeholder="Detalle…" value={antForm[key]?.notas??""} onChange={e=>setSec(key,{notas:e.target.value.slice(0,2000)})}/></div>;
    const PEDI_DEFS:[PediKey,string,readonly string[]][]=[["prenatales","Antecedentes prenatales",ANT_PRENATAL],["perinatales","Antecedentes perinatales",ANT_PERINATAL],["alimentacion","Alimentación",ANT_ALIMENTACION],["desarrollo","Crecimiento y desarrollo",ANT_DESARROLLO],["inmunizaciones","Inmunizaciones",ANT_INMUNIZA]];
    const fmtBanner=<div style={{marginTop:14,display:"flex",alignItems:"center",gap:8,fontSize:12.5,color:P.muted,background:"var(--c-wash)",border:`1px solid ${LINE}`,borderRadius:10,padding:"8px 12px",flexWrap:"wrap"}}><b style={{color:P.ink}}>Formato: {pediatric?"Pediátrico":"Adulto"}</b><span>· auto-seleccionado por la edad del paciente{typeof age==="number"?` (${age} años)`:" (edad no disponible)"}.</span></div>;

    if(!antEditing){
     if(!antSnap?.recorded)return <div style={{marginTop:16,padding:"18px 16px",borderRadius:12,background:"var(--c-wash)",border:`1px dashed ${LINE}`,fontSize:13,color:P.muted}}>Este paciente aún no tiene antecedentes capturados. Pulsa «Capturar antecedentes» para registrar la historia clínica basal (heredofamiliares, patológicos, hábitos, quirúrgicos y gineco-obstétricos) una sola vez.</div>;
     const yes=(b?:boolean)=>b?"Sí":"No";
     const roItems:[string,React.ReactNode][]=[];
     if(antForm.heredofamiliares?.flags?.length||antForm.heredofamiliares?.notas)roItems.push(["Heredofamiliares",<>{(antForm.heredofamiliares.flags??[]).join(", ")}{antForm.heredofamiliares.notas?` · ${antForm.heredofamiliares.notas}`:""}</>]);
     if(pat?.cronicos?.length||pat?.cirugias||pat?.hospitalizaciones||pat?.transfusiones||pat?.notas)roItems.push(["Patológicos",<>{[(pat.cronicos??[]).join(", "),pat.cirugias?"cirugías":"",pat.hospitalizaciones?"hospitalizaciones":"",pat.transfusiones?"transfusiones":"",pat.notas].filter(Boolean).join(" · ")}</>]);
     roItems.push(["Hábitos",<>Tabaquismo: {yes(hab?.tabaquismo)} · Alcoholismo: {yes(hab?.alcoholismo)} · Toxicomanías: {yes(hab?.toxicomanias)}{hab?.actividadFisica?` · Act. física: ${hab.actividadFisica}`:""}{hab?.alimentacion?` · Alimentación: ${hab.alimentacion}`:""}{hab?.notas?` · ${hab.notas}`:""}</>]);
     if(!pediatric&&antForm.quirurgicos?.notas)roItems.push(["Quirúrgicos",antForm.quirurgicos.notas]);
     if(showGineco&&antForm.ginecoObstetricos?.notas)roItems.push(["Gineco-obstétricos",antForm.ginecoObstetricos.notas]);
     if(pediatric)for(const[key,title]of PEDI_DEFS){const s=antForm[key];if(s?.flags?.length||s?.notas)roItems.push([title,[(s.flags??[]).join(", "),s.notas].filter(Boolean).join(" · ")]);}
     // Recomendaciones del CDS que nacen de los hábitos (cesación, cribados por guías): el algoritmo lee los antecedentes.
     const habitFindings=(snap?.findings??[]).filter(f=>f.domain==="tabaquismo"||f.domain==="alcohol"||f.domain==="adicciones");
     return <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:9}}>
      {fmtBanner}
      {roItems.map(([k,v])=><div key={k} style={{display:"flex",gap:12,fontSize:13,padding:"9px 11px",borderRadius:10,background:"var(--c-wash)"}}><span style={{fontWeight:800,color:P.purpleOnPale,minWidth:140,flex:"0 0 auto"}}>{k}</span><span style={{minWidth:0,color:"var(--c-ink)"}}>{v}</span></div>)}
      {habitFindings.length>0&&<div style={{borderTop:`1px solid ${LINE}`,paddingTop:12,marginTop:3}}>
       <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Recomendaciones del sistema (por los hábitos)</div>
       <div style={{display:"flex",flexDirection:"column",gap:8}}>{habitFindings.map((f,i)=>{const s=SEV[f.severity]??SEV.INFO;return <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"9px 11px",borderRadius:10,background:s.bg,border:`1px solid ${s.bd}`}}>
        <span style={{background:"var(--c-surface)",color:s.fg,border:`1px solid ${s.bd}`,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:800,letterSpacing:".03em",whiteSpace:"nowrap",marginTop:1}}>{s.label}</span>
        <span style={{fontSize:13,color:"var(--c-ink)",lineHeight:1.4}}>{f.summary}</span></div>;})}</div>
       <div style={{fontSize:11,color:P.muted,marginTop:8}}>Apoyo determinista por guías. La decisión es del médico.</div>
      </div>}
     </div>;
    }
    // EDICIÓN de la matriz
    return <div style={{marginTop:16,display:"grid",gap:14}}>
     {fmtBanner}
     <div style={secBox}>
      <div style={secTtl}>Antecedentes heredofamiliares</div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{ANT_HEREDO.map(f=>chip((antForm.heredofamiliares?.flags??[]).includes(f),f,()=>toggleHeredo(f)))}</div>
      <textarea style={{...ta2,marginTop:10}} aria-label="Notas heredofamiliares" placeholder="Detalle (parentesco, edad de diagnóstico…)" value={antForm.heredofamiliares?.notas??""} onChange={e=>setHer({notas:e.target.value.slice(0,2000)})}/>
     </div>
     <div style={secBox}>
      <div style={secTtl}>Antecedentes personales patológicos</div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{ANT_CRONICOS.map(f=>chip((pat?.cronicos??[]).includes(f),f,()=>toggleCronico(f)))}</div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",margin:"12px 0 2px"}}>
       <Check checked={!!pat?.cirugias} label="Cirugías previas" onChange={()=>setPat({cirugias:!pat?.cirugias})}/>
       <Check checked={!!pat?.hospitalizaciones} label="Hospitalizaciones" onChange={()=>setPat({hospitalizaciones:!pat?.hospitalizaciones})}/>
       <Check checked={!!pat?.transfusiones} label="Transfusiones" onChange={()=>setPat({transfusiones:!pat?.transfusiones})}/>
      </div>
      <textarea style={{...ta2,marginTop:10}} aria-label="Notas patológicas" placeholder="Enfermedades crónicas, tratamientos, fechas…" value={pat?.notas??""} onChange={e=>setPat({notas:e.target.value.slice(0,2000)})}/>
     </div>
     <div style={secBox}>
      <div style={secTtl}>Antecedentes personales no patológicos (hábitos)</div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
       <Check checked={!!hab?.tabaquismo} label="Tabaquismo" onChange={()=>setHab({tabaquismo:!hab?.tabaquismo})}/>
       <Check checked={!!hab?.alcoholismo} label="Alcoholismo" onChange={()=>setHab({alcoholismo:!hab?.alcoholismo})}/>
       <Check checked={!!hab?.toxicomanias} label="Toxicomanías" onChange={()=>setHab({toxicomanias:!hab?.toxicomanias})}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
       <div><label style={lbl2}>Actividad física</label><input style={input} aria-label="Actividad física" placeholder="p. ej. sedentario, 3×/sem" value={hab?.actividadFisica??""} onChange={e=>setHab({actividadFisica:e.target.value.slice(0,500)})}/></div>
       <div><label style={lbl2}>Alimentación</label><input style={input} aria-label="Alimentación" placeholder="p. ej. balanceada, alta en grasas" value={hab?.alimentacion??""} onChange={e=>setHab({alimentacion:e.target.value.slice(0,500)})}/></div>
      </div>
      <textarea style={{...ta2,marginTop:10}} aria-label="Notas de hábitos" placeholder="Índice tabáquico, consumo, otras toxicomanías…" value={hab?.notas??""} onChange={e=>setHab({notas:e.target.value.slice(0,2000)})}/>
     </div>
     {pediatric
      ?PEDI_DEFS.map(([key,title,cat])=>pediSec(key,title,cat))
      :<>
       <div style={secBox}>
        <div style={secTtl}>Antecedentes quirúrgicos</div>
        <textarea style={ta2} aria-label="Antecedentes quirúrgicos" placeholder="Cirugías con fecha y motivo…" value={antForm.quirurgicos?.notas??""} onChange={e=>setQx({notas:e.target.value.slice(0,2000)})}/>
       </div>
       <div style={secBox}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
         <div style={secTtl}>Antecedentes gineco-obstétricos</div>
         {sex!=="FEMALE"&&<Check checked={!!antForm.ginecoObstetricos?.aplica} label="Aplica a este paciente" onChange={()=>setGO({aplica:!antForm.ginecoObstetricos?.aplica})}/>}
        </div>
        {showGineco?<textarea style={ta2} aria-label="Antecedentes gineco-obstétricos" placeholder="Menarca, G/P/A/C, FUM, método de planificación, citología…" value={antForm.ginecoObstetricos?.notas??""} onChange={e=>setGO({notas:e.target.value.slice(0,2000)})}/>:<p style={{fontSize:12.5,color:P.muted,margin:0}}>No aplica. Marca «Aplica a este paciente» si corresponde.</p>}
       </div>
      </>}
     {antSnap?.recorded&&<div style={secBox}>
      <label style={lbl2}>Motivo de la actualización <span style={{color:P.redOnPale}}>*</span></label>
      <input style={input} aria-label="Motivo de la actualización" placeholder="p. ej. el paciente dejó de fumar; nuevo diagnóstico" value={antReason} onChange={e=>setAntReason(e.target.value.slice(0,300))}/>
      <p style={{fontSize:11.5,color:P.muted,margin:"6px 0 0"}}>El histórico no se sobrescribe: cada actualización queda en la auditoría con su motivo.</p>
     </div>}
     {antMsg&&<div role="status" style={{fontSize:12.5,fontWeight:600,color:antMsg.includes("✓")?P.greenOnPale:P.amberOnPale}}>{antMsg}</div>}
     <div style={{display:"flex",gap:10}}>
      <button disabled={antBusy} onClick={()=>void saveAntecedentes()} style={{...btn,opacity:antBusy?.6:1}}>{antBusy?"Guardando…":antSnap?.recorded?"Guardar cambios":"Capturar antecedentes"}</button>
      <button disabled={antBusy} onClick={()=>setAntEditing(false)} style={{...ghost,padding:"9px 16px"}}>Cancelar</button>
     </div>
    </div>;
   })()}
  </section>

  {/* TIMELINE DEL PACIENTE */}
  <section hidden={!inTab("historia")} style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <h2 {...anchor("Timeline del paciente")} style={{fontSize:18,margin:0}}>Timeline del paciente</h2>
    <div style={{display:"flex",gap:8}}>
     <button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={exportRecord}>{busy==="exp"?"Exportando…":"Exportar expediente"}</button>
     <button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={loadTimeline}>{busy==="tl"?"Cargando…":"Actualizar"}</button>
    </div>
   </div>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Vista longitudinal de los items clínicos de este paciente (metadatos, sin contenido).</p>
   {exportInfo&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:12,background:"var(--c-purple-bg)",border:"1px solid var(--c-purple-bd)",fontSize:12}}>
    <b style={{color:"var(--c-purple-fg)"}}>Expediente exportado — archivo .json descargado</b> · {exportInfo.aggregateCount} agregados · {exportInfo.eventCount} eventos<br/>
    <span style={{color:P.muted}}>Manifiesto reproducible (índice de agregados y eventos + hash); no es el formato de intercambio NOM-024 ni incluye el contenido con datos personales.</span><br/>
    <span style={{color:P.muted}}>hash reproducible del contenido: </span><span style={mono}>{exportInfo.contentHash}</span>
   </div>}
   {busy==="tl"?<div aria-hidden style={{marginTop:14}}><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{Array.from({length:7}).map((_,i)=><div key={i} style={{flex:"1 1 90px",minWidth:90,padding:"10px 8px",borderRadius:12,background:"var(--c-wash)",border:"1px solid var(--c-line)",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}><Skeleton w={30} h={20}/><Skeleton w={"70%"} h={10}/></div>)}</div><div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}>{Array.from({length:4}).map((_,i)=><Skeleton key={i} w={"100%"} h={38} r={10}/>)}</div></div>
    :tl===null?<p style={{color:P.muted,fontSize:13,marginTop:12}}>Pulsa “Actualizar” para cargar el historial de este paciente.</p>
    :tl.length===0?<p style={{color:P.muted,fontSize:13,marginTop:12}}>Sin items registrados para este paciente todavía.</p>
    :<div>
     {(()=>{const s=summarizePatient(tl);const stat=(n:number,l:string,warn=false)=>(<div style={{flex:"1 1 90px",minWidth:90,textAlign:"center",padding:"10px 8px",borderRadius:12,background:warn&&n>0?"var(--c-amber-bg)":"var(--c-wash)",border:"1px solid var(--c-line)"}}><div style={{fontSize:22,fontWeight:800,color:warn&&n>0?"var(--c-amber-fg)":"var(--c-purple-fg)"}}>{n}</div><div style={{fontSize:11,color:P.muted}}>{l}</div></div>);
      return <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>{stat(s.activeAllergies,"Alergias activas",true)}{stat(s.activeProblems,"Problemas activos")}{stat(s.signedEncounters,"Encuentros firmados")}{stat(s.activeMedications,"Medicación activa")}{stat(s.openResults,"Resultados abiertos",true)}{stat(s.openOrders,"Órdenes pendientes")}{stat(s.openObligations,"Obligaciones abiertas",true)}{stat(s.openReferrals,"Interconsultas abiertas")}{stat(s.upcomingAppointments,"Citas próximas")}{stat(s.pendingImmunizations,"Vacunas pendientes",true)}{stat(s.activeCarePlans,"Metas activas")}{stat(s.openClaims,"Facturas abiertas")}{stat(s.grantedConsents,"Consentimientos vigentes")}{stat(s.activeAdmissions,"Internamientos activos",true)}</div>;})()}
     {gaps&&gaps.length>0&&<div style={{marginTop:16,padding:14,borderRadius:12,background:"var(--c-amber-bg)",border:"1px solid var(--c-amber-bg)"}}>
      <div style={{fontSize:13,fontWeight:700,color:P.amberOnPale,marginBottom:8}}>⚑ Pendientes clínicos (care gaps) · {gaps.length}</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>{gaps.map(g=>{const col=g.priority==="HIGH"?["var(--c-red-bg)",P.redOnPale]:g.priority==="MEDIUM"?["var(--c-amber-bg)",P.amberOnPale]:["var(--c-blue-bg)","var(--c-purple-fg)"];return <div key={g.aggregateId+g.code} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 12px",background:"white",border:"1px solid var(--c-line)",borderRadius:10}}>
       <span style={{fontSize:13}}>{g.label}</span>
       <span style={{display:"inline-block",background:col[0],color:col[1],fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap"}}>{g.priority}</span>
      </div>;})}</div>
     </div>}
     {gaps&&gaps.length===0&&<div style={{marginTop:16,padding:"10px 14px",borderRadius:12,background:"var(--c-green-bg)",border:"1px solid var(--c-green-bg)",fontSize:13,color:P.greenOnPale}}>✓ Sin pendientes clínicos accionables para este paciente.</div>}
     <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
     {tl.map(x=><div key={x.aggregateId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",border:"1px solid var(--c-line)",borderRadius:10}}>
      <div><b style={{fontSize:14}}>{TYPE_LABEL[x.aggregateType]??x.aggregateType}</b> <span style={{...mono,marginLeft:6}}>{x.aggregateId.slice(0,8)}</span></div>
      <div style={{display:"flex",gap:10,alignItems:"center"}}><span style={stateBadge(x.latestKind)}>{x.latestKind}</span><span style={{fontSize:12,color:P.muted}}>v{x.version}</span></div>
     </div>)}
    </div></div>}
  </section>

  {/* ENCUENTRO */}
  <section hidden={!inTab("encuentro")} className="span2" style={card}>
   {/* Unificación Consulta⟷Expediente: el encuentro ES el formulario de la consulta y vive en su PROPIA pestaña
       ("Consulta", la primera) para no quedar oculto — abrir la consulta de un paciente aterriza aquí. El `<h2 anchor>`
       se conserva para la navegación entre secciones; los controles (abrir/guardar/firmar) viven en EncounterForm. */}
   <h2 {...anchor("Encuentro")} style={{fontSize:18,margin:"0 0 2px"}}>Encuentro</h2>
   <EncounterForm/>
  </section>

  {/* MEDICACIÓN */}
  <section hidden={!inTab("medicacion")} style={card}>
   <h2 {...anchor("Medicación")} style={{fontSize:18,margin:0}}>Medicación</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Proponer una medicación no exige ser médico; sólo un médico puede prescribirla (Physician Control).</p>
   <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 90px 1fr",gap:10,marginTop:12}}>
    <input aria-label="Fármaco" style={input} value={drug} onChange={e=>setDrug(e.target.value)} placeholder="Fármaco (ej. Amoxicilina)" />
    <div style={{display:"flex",gap:6}}>
     <input style={{...input,flex:1,minWidth:0}} type="number" inputMode="decimal" min={0} step="any" value={doseAmt} onChange={e=>setDoseAmt(e.target.value)} placeholder="Dosis (500mg)" aria-label="Cantidad de la dosis" />
     <select style={{...input,width:86}} value={doseUnit} onChange={e=>setDoseUnit(e.target.value)} aria-label="Unidad de la dosis">{DOSE_UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select>
    </div>
    <input aria-label="Vía de administración" style={input} value={route} onChange={e=>setRoute(e.target.value)} placeholder="Vía" />
    <input aria-label="Frecuencia" style={input} value={freq} onChange={e=>setFreq(e.target.value)} placeholder="Frecuencia (c/8h)" />
   </div>
   {/* POMR — enlazar el fármaco al problema que trata (opcional). Solo si el paciente tiene problemas activos (no se inventa el vínculo). */}
   {problemasActivos.length>0&&<div style={{marginTop:10}}><label style={lbl}>¿Para qué problema? <span style={{color:P.muted,fontWeight:400}}>(opcional)</span></label>
    <select aria-label="Problema que trata la medicación" style={input} value={medProblem} onChange={e=>setMedProblem(e.target.value)}><option value="">— Sin enlazar a un problema —</option>{problemasActivos.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></div>}
   <div style={{marginTop:12}}><button style={btn} disabled={busy!==""||!drug||!dose||!route||!freq} onClick={proposeMed}>{busy==="med-new"?"Proponiendo…":"Proponer medicación"}</button></div>

   {/* Auditoría R05a (WS1-14) — LA MEDICACIÓN VIGENTE DEL PACIENTE, en la ventana donde se prescribe.
       Esta ventana solo mostraba lo prescrito en la sesión: abrir el expediente de alguien con cinco fármacos activos y
       prescribir un sexto se hacía A CIEGAS, aunque sus alergias y problemas sí se vean en la cabecera. Se distingue
       «no cargó» de «no toma nada», como exige R05a-F08: afirmar que no toma nada sin saberlo autoriza a prescribir. */}
   <div style={{marginTop:16,border:`1px solid ${LINE}`,borderRadius:12,padding:"12px 14px",background:"var(--c-wash2)"}}>
    <div style={{fontSize:12.5,fontWeight:700,color:P.muted,marginBottom:consTabs?.medications?.length?8:0}}>Medicación vigente del paciente</div>
    {consTabs===null
     ?<div style={{fontSize:13,color:P.amberOnPale}}>No evaluada: la medicación del paciente no cargó. Confírmela con el paciente antes de prescribir.</div>
     :consTabs.medications.length===0
      ?<div style={{fontSize:13,color:P.muted}}>Sin medicamentos activos registrados en el expediente.</div>
      :<div style={{display:"flex",flexWrap:"wrap",gap:8}}>{consTabs.medications.map((m,i)=><span key={i} style={{background:"var(--c-green-bg)",color:P.greenOnPale,border:"1px solid var(--c-green-bd)",borderRadius:8,padding:"4px 10px",fontSize:12.5,fontWeight:600}}>{m}</span>)}</div>}
   </div>

   {meds.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {meds.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {meds.map(m=>{const n=medNext(m);return <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{m.label}</b><div style={{fontSize:12,color:P.muted}}>v{m.version}{m.problemLabel?<> · <span style={{color:P.purple,fontWeight:600}}>↳ {m.problemLabel}</span></>:null}</div></div>
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
  <section hidden={!inTab("medicacion")} className="span2" style={card}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
    <div><h2 {...anchor("Prescripción segura")} style={{fontSize:18,margin:0}}>Prescripción segura</h2><p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Verifica antes de prescribir. Previene errores, protege al paciente. Determinista, sin IA generativa.</p></div>
    {snap?.labs.egfr!==undefined&&<span style={{fontSize:12,color:P.muted}}>eGFR paciente: <b>{snap?.labs.egfr} mL/min</b>{snap?.labs.egfrStage?` · categoría ${snap.labs.egfrStage} (una creatinina: no confirma ERC)`:""}</span>}
   </div>
   <div className="mos-rx-form">
    <input aria-label="Fármaco" style={input} value={rxDrug} onChange={e=>{setRxDrug(e.target.value);setRxCheck(null);}} placeholder="Buscar medicamento (ej. metformina, losartan)" />
    <div style={{display:"flex",gap:6}}>
     <input style={{...input,flex:1,minWidth:0}} type="number" inputMode="decimal" min={0} step="any" value={rxDoseAmt} onChange={e=>{setRxDoseAmt(e.target.value);setRxCheck(null);}} placeholder="Dosis" aria-label="Cantidad de la dosis" />
     <select style={{...input,width:86}} value={rxDoseUnit} onChange={e=>{setRxDoseUnit(e.target.value);setRxCheck(null);}} aria-label="Unidad de la dosis">{DOSE_UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select>
    </div>
    <select aria-label="Vía de administración" style={input} value={rxRoute} onChange={e=>{setRxRoute(e.target.value);setRxCheck(null);}}><option>Oral</option><option>IV</option><option>IM</option><option>SC</option><option>Tópica</option></select>
    <input aria-label="Frecuencia" style={input} value={rxFreq} onChange={e=>{setRxFreq(e.target.value);setRxCheck(null);}} placeholder="Frecuencia (c/12h)" />
    <button style={btn} disabled={busy!==""||!rxDrug||!rxDose||!rxFreq} onClick={verifyRx}>{busy==="rxcheck"?"Verificando…":"Verificar"}</button>
   </div>
   {rxMsg&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:12,background:"var(--c-green-bg)",border:"1px solid var(--c-green-bd)",color:P.greenOnPale,fontSize:13,fontWeight:600}}>{rxMsg}</div>}
   {rxCheck&&(()=>{
    const v=rxCheck.verdict;
    const vm=v==="OK"?{bg:"var(--c-green-bg)",bd:"var(--c-green-bd)",fg:P.greenOnPale,txt:(rxCheck.notCovered?.length??0)>0?"Sin conflictos en lo evaluado — hay barreras sin regla en el catálogo (en gris)":"Verificación superada — todas las barreras evaluadas"}:v==="WARN"?{bg:"var(--c-amber-bg)",bd:"var(--c-amber-bd)",fg:P.amberOnPale,txt:rxCheck.requiresAcknowledgement?"Verificación INCOMPLETA — hay barreras que no se pudieron evaluar; al prescribir deberás confirmarlo":"Requiere criterio clínico — revisa las advertencias"}:{bg:"var(--c-red-bg)",bd:"var(--c-red-bd)",fg:P.redOnPale,txt:(rxCheck.blockedHard?.length??0)>0?"Prescripción bloqueada — no anulable: corrige la dosis o la orden":"Prescripción bloqueada — solo anulable al prescribir, con justificación clínica que queda en el expediente"};
    const hardBlock=(rxCheck.blockedHard?.length??0)>0;
    const unev=(s:string)=>s==="NOT_EVALUATED"||s==="NOT_COVERED"||s==="NA";
    const ic=(s:string)=>s==="OK"?"✓":s==="WARN"?"⚠":s==="NA"?"–":unev(s)?"?":"✕";const icc=(s:string)=>s==="OK"?P.greenOnPale:s==="WARN"?"var(--c-amber-fg)":unev(s)?"#5F6B7A":P.redOnPale;
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
        <span><b style={{fontWeight:600}}>{c.label}</b><span style={{color:P.muted}}> — {c.detail}</span>{c.status==="BLOCK"&&<span style={{marginLeft:6,fontSize:11,fontWeight:700,color:c.overridable?"var(--c-amber-fg)":P.redOnPale}}>{c.overridable?"anulable con justificación":"no anulable"}</span>}</span>
       </div>)}</div>
      </div>
      <div>
       <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Monitorización / advertencias</div>
       {rxCheck.monitoring.length?<div style={{display:"flex",flexDirection:"column",gap:6}}>{rxCheck.monitoring.map((m,i)=><div key={i} style={{fontSize:12.5,color:"var(--c-red-fg)"}}>• {m.test}: {m.note} <span style={{color:P.muted}}>(en {m.dueInDays} d)</span></div>)}</div>:<div style={{fontSize:12.5,color:P.muted}}>Sin monitorización específica.</div>}
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
  <section hidden={!inTab("resultados")} style={card}>
   <h2 {...anchor("Resultados diagnósticos")} style={{fontSize:18,margin:0}}>Resultados diagnósticos</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Closed-loop: un resultado <b>crítico</b> que requirió acción y no se ha cerrado <b>bloquea la firma</b> del encuentro (Zero Lost Follow-Up).</p>
   <div style={{display:"flex",gap:10,marginTop:12,alignItems:"center",flexWrap:"wrap"}}>
    <select aria-label="Analito" style={{...input,maxWidth:200}} value={resQuick.analyte} onChange={e=>setResQuick({analyte:e.target.value,value:"",unit:canonicalUnitOf(e.target.value)??""})}>{labReferenceRanges().map(a=><option key={a.analyte} value={a.analyte}>{a.analyte}</option>)}</select>
    <input aria-label="Valor" inputMode="decimal" style={{...input,maxWidth:120}} value={resQuick.value} onChange={e=>setResQuick({...resQuick,value:e.target.value})} placeholder="Valor" />
    <select aria-label="Unidad" style={{...input,maxWidth:120}} value={resQuick.unit} onChange={e=>setResQuick({...resQuick,unit:e.target.value})}>{acceptedUnitsOf(resQuick.analyte).map(u=><option key={u} value={u}>{u}</option>)}</select>
    <span style={{fontSize:12,color:P.muted}}>La criticidad se deriva del valor.</span>
    <button style={btn} disabled={busy!==""} onClick={receiveResult}>{busy==="res-new"?"Registrando…":"Registrar resultado"}</button>
   </div>
   {/* RESULTADOS REALES del paciente (expediente) — distintos de los registrados en esta sesión (lista de abajo, con sus
       transiciones). Antes esta pantalla solo mostraba lo creado en la sesión; los resultados ya almacenados no se veían. */}
   <div style={{marginTop:16,border:`1px solid ${LINE}`,borderRadius:12,padding:"12px 14px",background:"var(--c-wash2)"}}>
    <div style={{fontSize:12.5,fontWeight:700,color:P.muted,marginBottom:consTabs?.results?.length?8:0}}>Resultados del paciente (expediente)</div>
    {consTabs===null
     ?<div style={{fontSize:13,color:P.amberOnPale}}>No evaluados: los resultados del paciente no cargaron.</div>
     :consTabs.results.length===0
      ?<div style={{fontSize:13,color:P.muted}}>Sin resultados registrados en el expediente.</div>
      :<div style={{display:"flex",flexDirection:"column",gap:0}}>{consTabs.results.slice(0,12).map((r,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 0",borderTop:i?"1px solid var(--c-wash)":"0"}}>
        <div style={{minWidth:0}}><span style={{fontWeight:700,fontSize:13}}>{r.analyte}</span> <span style={{fontSize:13,color:P.ink}}>{r.value}</span>{r.critical&&<span style={{marginLeft:8,background:"var(--c-red-bg)",color:P.redOnPale,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:800}}>CRÍTICO</span>}</div>
        <div style={{display:"flex",gap:8,alignItems:"center",flex:"0 0 auto"}}><span style={{fontSize:11.5,color:P.muted}}>{r.estado}</span><span style={{fontSize:11,color:P.muted}}>{r.receivedAt?new Date(r.receivedAt).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"}):""}</span></div>
       </div>)}{consTabs.results.length>12&&<div style={{fontSize:11.5,color:P.muted,paddingTop:8}}>+{consTabs.results.length-12} resultado(s) más en el expediente.</div>}</div>}
   </div>
   {results.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {results.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {results.map(res=>{const n=resNext(res);return <div key={res.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{res.label}{res.critical&&<span style={{...stateBadge("ACTIONED"),marginLeft:8,fontSize:11}}>CRÍTICO</span>}</b><div style={{fontSize:12,color:P.muted}}>v{res.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(res.state)}>{res.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceResult(res)}>{busy==="res-"+res.id?"…":n.label}</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* CLINICAL INTELLIGENCE — apoyo a la decisión DETERMINISTA del paciente (reusa snap.findings, igual que el hero). */}
  <section hidden={!inTab("intel")} className="span2" style={card}>
   <div><h2 {...anchor("Clinical Intelligence")} style={{fontSize:18,margin:0}}>Clinical Intelligence</h2><p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Apoyo a la decisión DETERMINISTA del paciente: alertas por reglas y calculadoras del motor CDS. Sin IA generativa (R6 en pausa).</p></div>
   {!snap?<div style={{marginTop:14,fontSize:13,color:P.muted}}>Expediente no cargado para este paciente.</div>
    :snap.findings.length?<div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>{snap.findings.map((f,i)=>{const s=SEV[f.severity]??SEV.INFO;return <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 12px",borderRadius:10,background:s.bg,border:`1px solid ${s.bd}`}}>
     <span style={{background:"var(--c-surface)",color:s.fg,border:`1px solid ${s.bd}`,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:800,letterSpacing:".03em",whiteSpace:"nowrap",marginTop:1}}>{s.label}</span>
     <span style={{fontSize:13,color:"var(--c-ink)",lineHeight:1.45}}>{f.summary}</span>
    </div>;})}</div>
    :<div style={{marginTop:14,fontSize:13,color:P.greenOnPale,fontWeight:600}}>✓ Sin alertas deterministas para los datos registrados.</div>}
   <div style={{marginTop:14,fontSize:11.5,color:P.muted,background:"var(--c-purple-bg)",borderRadius:8,padding:"10px 12px"}}>Apoyo a la decisión; la decisión final es del médico. El diagnóstico diferencial probabilístico requiere IA generativa (R6), en pausa intencional en este sistema.</div>
  </section>

  {/* EVOLUCIÓN LONGITUDINAL (panel 4) */}
  <section hidden={!inTab("historia")} className="span2" style={card}>
   <div><h2 {...anchor("Evolución longitudinal")} style={{fontSize:18,margin:0}}>Evolución longitudinal</h2><p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Tendencias que cuentan la historia completa. Valores medidos, sin proyección.</p></div>
   <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}}>
    {(["HBA1C","GLUCOSE","LDL","CREATININE"] as TrendKey[]).map(k=><button key={k} onClick={()=>setTrendKey(k)} style={{background:trendKey===k?"var(--c-blue-bg)":"transparent",color:trendKey===k?P.blue:P.muted,border:`1px solid ${trendKey===k?"var(--c-blue-bd)":LINE}`,borderRadius:999,padding:"6px 14px",fontSize:13,fontWeight:trendKey===k?700:500,fontFamily:UI,cursor:"pointer"}}>{CHART[k].label}</button>)}
   </div>
   <div style={{marginTop:14,border:`1px solid ${LINE}`,borderRadius:14,padding:"14px 16px",background:"var(--c-surface)"}}>
    <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>{CHART[trendKey].label} <span style={{color:P.muted,fontWeight:500}}>({CHART[trendKey].unit})</span></div>
    {trends?trendChart(trends.series[trendKey]??[],trendKey):<div style={{padding:"28px 0",textAlign:"center",color:P.muted,fontSize:13}}>Selecciona un paciente para ver sus tendencias.</div>}
   </div>
   {trends&&(()=>{
    const rc=(label:string,v:number|null,unit:string,warn:boolean)=>(<div style={{minWidth:0,background:"var(--c-surface)",border:`1px solid ${warn?"var(--c-amber-bd)":LINE}`,borderRadius:14,padding:"14px 16px"}}><div style={{fontSize:12,color:P.muted,marginBottom:4}}>{label}</div><div style={{fontSize:22,fontWeight:800,color:warn?"var(--c-amber-fg)":P.ink}}>{v??"—"} <span style={{fontSize:12,fontWeight:600,color:P.muted}}>{v!==null?unit:""}</span></div></div>);
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
  <section hidden={!inTab("alergias")} style={card}>
   <h2 {...anchor("Alergias")} style={{fontSize:18,margin:0}}>Alergias</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Una alergia <b>activa</b> bloquea la prescripción de un fármaco que la contenga (gate de seguridad).</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 150px 1fr",gap:10,marginTop:12}}>
    <input aria-label="Sustancia (alérgeno)" style={input} value={alSub} onChange={e=>setAlSub(e.target.value)} placeholder="Sustancia (ej. amoxicilina)" />
    <select aria-label="Severidad de la alergia" style={input} value={alSev} onChange={e=>setAlSev(e.target.value)}><option value="MILD">Leve</option><option value="MODERATE">Moderada</option><option value="SEVERE">Grave</option></select>
    <input aria-label="Reacción alérgica" style={input} value={alReac} onChange={e=>setAlReac(e.target.value)} placeholder="Reacción (ej. anafilaxia)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!alSub} onClick={createAllergy}>{busy==="al-new"?"Registrando…":"Registrar alergia"}</button></div>
   {allergies.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {allergies.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {allergies.map(a=><div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{a.label}</b><div style={{fontSize:12,color:P.muted}}>v{a.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={stateBadge(a.state)}>{a.state}</span>{alActions(a).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>doAllergyAction(a,act)}>{busy==="al-"+a.id?"…":act.label}</button>)}</div>
    </div>)}
   </div>}
  </section>

  {/* LISTA DE PROBLEMAS */}
  <section hidden={!inTab("problemas")} style={card}>
   <h2 {...anchor("Lista de problemas")} style={{fontSize:18,margin:0}}>Lista de problemas</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Diagnósticos codificados en <b>CIE-10</b> (validados contra el catálogo; la descripción es canónica). PROD-011 + interoperabilidad NOM-024.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginTop:12}}>
    <input aria-label="Problema o código CIE-10" style={input} list="icd10-list" value={probCode} onChange={e=>setProbCode(e.target.value.toUpperCase())} placeholder="Código CIE-10 (ej. E11, I10, J45.9)" />
    <button style={btn} disabled={busy!==""||!probCode} onClick={createProblem}>{busy==="pb-new"?"Añadiendo…":"Añadir problema"}</button>
   </div>
   {/* Auditoría R05c-17: las sugerencias salían de diez códigos escritos a mano, mientras el subtítulo prometía validación
       contra el catálogo. Ahora salen del catálogo CIE-10 real del repositorio —el mismo que valida el servidor al
       registrar el problema— buscando por lo que el médico escribe. */}
   <datalist id="icd10-list">
    {(probCode.trim().length>=2?searchIcd10(probCode.trim(),10):[]).map(e=><option key={e.code} value={e.code}>{e.description}</option>)}
   </datalist>
   {problems.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {problems.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {problems.map(p=><div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{p.label}</b><div style={{fontSize:12,color:P.muted}}>v{p.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={stateBadge(p.state)}>{p.state}</span>{probActions(p).map(a=><button key={a.label} style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>doProblemAction(p,a)}>{busy==="pb-"+p.id?"…":a.label}</button>)}</div>
    </div>)}
   </div>}
  </section>

  {/* ÓRDENES CLÍNICAS */}
  <section hidden={!inTab("ordenes")} style={card}>
   <h2 {...anchor("Órdenes clínicas")} style={{fontSize:18,margin:0}}>Órdenes clínicas</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Lab, imagen, patología, procedimiento o referencia. Colocar/cumplir una orden exige médico.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginTop:12}}>
    <select aria-label="Tipo de orden" style={input} value={orderType} onChange={e=>setOrderType(e.target.value)}>
     <option value="LAB">Laboratorio</option><option value="IMAGING">Imagen</option><option value="PATHOLOGY">Patología</option><option value="PROCEDURE">Procedimiento</option><option value="REFERRAL">Referencia</option>
    </select>
    <input aria-label="Detalle de la orden" style={input} value={orderDetail} onChange={e=>setOrderDetail(e.target.value)} placeholder="Detalle (ej. Hemograma completo)" />
   </div>
   {/* POMR — enlazar la orden al problema contra el que se pide (opcional). Solo si hay problemas activos. */}
   {problemasActivos.length>0&&<div style={{marginTop:10}}><label style={lbl}>¿Para qué problema? <span style={{color:P.muted,fontWeight:400}}>(opcional)</span></label>
    <select aria-label="Problema contra el que se solicita el estudio" style={input} value={ordProblem} onChange={e=>setOrdProblem(e.target.value)}><option value="">— Sin enlazar a un problema —</option>{problemasActivos.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></div>}
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!orderDetail} onClick={createOrder}>{busy==="ord-new"?"Creando…":"Crear orden"}</button></div>
   {orders.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {orders.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {orders.map(o=>{const n=orderNext(o);return <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{o.label}</b><div style={{fontSize:12,color:P.muted}}>v{o.version}{o.problemLabel?<> · <span style={{color:P.purple,fontWeight:600}}>↳ {o.problemLabel}</span></>:null}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(o.state)}>{o.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceOrder(o)}>{busy==="ord-"+o.id?"…":n.label}</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* INTERCONSULTAS / REFERENCIAS */}
  <section hidden={!inTab("coordinacion")} style={card}>
   <h2 {...anchor("Interconsultas")} style={{fontSize:18,margin:0}}>Interconsultas</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Referencia a especialista: solicitar → aceptar → completar (o declinar/cancelar). Agregado propio con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:10,marginTop:12}}>
    <input aria-label="Especialidad" style={input} value={refSpecialty} onChange={e=>setRefSpecialty(e.target.value)} placeholder="Especialidad (ej. Cardiología)" />
    <input aria-label="Motivo de la interconsulta" style={input} value={refReason} onChange={e=>setRefReason(e.target.value)} placeholder="Motivo (ej. Soplo sistólico)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!refSpecialty||!refReason} onClick={createReferral}>{busy==="ref-new"?"Solicitando…":"Solicitar interconsulta"}</button></div>
   {referrals.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {referrals.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {referrals.map(rr=>{const n=referralNext(rr);const closable=rr.state==="REQUESTED"||rr.state==="ACCEPTED";return <div key={rr.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{rr.label}</b><div style={{fontSize:12,color:P.muted}}>v{rr.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(rr.state)}>{rr.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceReferral(rr)}>{busy==="ref-"+rr.id?"…":n.label}</button>}
      {closable&&<button style={{...ghost,padding:"7px 12px",color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}} disabled={busy!==""} onClick={()=>cancelReferral(rr)}>{rr.state==="REQUESTED"?"Declinar":"Cancelar"}</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* AGENDA / CITAS */}
  <section hidden={!inTab("coordinacion")} style={card}>
   <h2 {...anchor("Agenda")} style={{fontSize:18,margin:0}}>Agenda</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Cita del paciente: agendar → registrar llegada → completar (o no-show/cancelar). Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:10,marginTop:12}}>
    <div><input aria-label="Fecha y hora de la cita" style={{...input,width:"100%"}} type="datetime-local" aria-describedby="mos-zona-cita" value={apptStart} onChange={e=>setApptStart(e.target.value)} />
     {/* R05b-16: la zona en la que se está agendando, dicha en la pantalla. */}
     <div id="mos-zona-cita" style={{fontSize:11,color:P.muted,marginTop:3}}>{avisoDeZona(cfgSettings.timezone)}</div></div>
    <input aria-label="Motivo de la cita" style={input} value={apptReason} onChange={e=>setApptReason(e.target.value)} placeholder="Motivo (ej. Control anual)" />
    <select aria-label="Consultorio" style={input} value={apptCons} onChange={e=>setApptCons(e.target.value)}><option>Consultorio 1</option><option>Consultorio 2</option><option>Consultorio 3</option></select>
    <select aria-label="Tipo de cita" style={input} value={apptType} onChange={e=>setApptType(e.target.value)}><option value="CONSULTA_GENERAL">Consulta general</option><option value="CONTROL">Control / Seguimiento</option><option value="PRIMERA_VEZ">Primera vez</option><option value="PROCEDIMIENTO">Procedimiento</option><option value="VACUNACION">Vacunación</option><option value="RESULTADOS">Resultados</option><option value="URGENCIA">Urgencia</option></select>
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!apptReason} onClick={createAppointment}>{busy==="apt-new"?"Agendando…":"Agendar cita"}</button></div>
   {appts.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {appts.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {appts.map(a=>{const n=apptNext(a);const open=a.state==="SCHEDULED"||a.state==="CHECKED_IN";return <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{a.label}</b><div style={{fontSize:12,color:P.muted}}>v{a.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(a.state)}>{a.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceAppt(a)}>{busy==="apt-"+a.id?"…":n.label}</button>}
      {a.state==="SCHEDULED"&&<button style={{...ghost,padding:"7px 12px",color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}} disabled={busy!==""} onClick={()=>closeAppt(a,"noshow")}>No-show</button>}
      {open&&<button style={{...ghost,padding:"7px 12px",color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}} disabled={busy!==""} onClick={()=>closeAppt(a,"cancel")}>Cancelar</button>}
     </div>
    </div>;})}
   </div>}
  </section>

  {/* VACUNAS / CARTILLA */}
  <section hidden={!inTab("vacunas")} style={card}>
   <h2 {...anchor("Vacunas")} style={{fontSize:18,margin:0}}>Vacunas</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Cartilla longitudinal: indicar → aplicar (o rechazar); tras aplicar puede registrarse un evento adverso (farmacovigilancia). Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:10,marginTop:12}}>
    <input aria-label="Vacuna" style={input} value={immCode} onChange={e=>setImmCode(e.target.value)} placeholder="Vacuna (ej. SRP, Hexavalente, Influenza)" />
    <input aria-label="Dosis de la vacuna" style={input} value={immDose} onChange={e=>setImmDose(e.target.value)} placeholder="Dosis" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!immCode} onClick={createImmunization}>{busy==="imm-new"?"Indicando…":"Indicar vacuna"}</button></div>
   {imms.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {imms.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {imms.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{i.label}</b><div style={{fontSize:12,color:P.muted}}>v{i.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(i.state)}>{i.state}</span>
      {immActions(i).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="ADVERSE_EVENT"||act.to==="REFUSED"?{color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}:{})}} disabled={busy!==""} onClick={()=>doImmAction(i,act)}>{busy==="imm-"+i.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* SIGNOS VITALES */}
  <section hidden={!inTab("signos")} style={card}>
   <h2 {...anchor("Signos vitales")} style={{fontSize:18,margin:0}}>Signos vitales</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Observaciones append-only: el valor histórico nunca se sobrescribe; cada corrección es una enmienda con motivo. Se puede marcar una toma como capturada por error.</p>
   <div style={{display:"grid",gridTemplateColumns:"150px 1fr 120px",gap:10,marginTop:12}}>
    <select id="vit-type" aria-label="Tipo de signo vital" style={input} value={vitType} onChange={e=>{setVitType(e.target.value);setVitUnit(unidadesDe(e.target.value)[0]??"");}}>
     <option value="BP">Presión (BP)</option><option value="HR">Frec. cardíaca</option><option value="TEMP">Temperatura</option><option value="SPO2">SpO₂</option><option value="RESP">Frec. respiratoria</option><option value="WEIGHT">Peso</option><option value="HEIGHT">Talla</option>
    </select>
    <div><input id="vit-value" aria-label={`Valor de ${vitType}`} style={{...input,width:"100%"}} value={vitValue} onChange={e=>setVitValue(e.target.value)} placeholder={vitType==="BP"?"Sistólica/diastólica (ej. 120/80)":"Valor numérico"} />
     <div style={{fontSize:11,color:P.muted,marginTop:3}}>{vitType==="BP"?"Dos números separados por «/»":"Un número"}</div></div>
    {/* R05c-19: la unidad NO es texto libre. Sale del catálogo de signos vitales —el mismo que convierte y valida en el
        servidor— y solo se ofrecen las que ese tipo admite: nada de «Peso: 120/80 mmHg». */}
    <select id="vit-unit" aria-label={`Unidad de ${vitType}`} style={input} value={vitUnit} onChange={e=>setVitUnit(e.target.value)}>
     {unidadesDe(vitType).map(u=><option key={u} value={u}>{u}</option>)}
    </select>
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!vitValue} onClick={createVital}>{busy==="vit-new"?"Registrando…":"Registrar signo vital"}</button></div>
   {vitals.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {vitals.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {vitals.map(v=><div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{v.vitalType}: {v.value} {v.unit}</b>{v.vstatus&&v.vstatus!=="UNKNOWN"&&<span style={{...(v.vstatus==="CRITICAL"?{background:"var(--c-red-bg)",color:P.redOnPale}:v.vstatus==="ABNORMAL"?{background:"var(--c-amber-bg)",color:P.amberOnPale}:{background:"var(--c-green-bg)",color:P.greenOnPale}),marginLeft:8,fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:999}}>{v.interp}</span>}<div style={{fontSize:12,color:P.muted}}>v{v.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(v.state)}>{v.state}</span>
      {vitActions(v).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="ENTERED_IN_ERROR"?{color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}:{})}} disabled={busy!==""} onClick={()=>doVitAction(v,act)}>{busy==="vit-"+v.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* PLAN DE CUIDADOS / METAS */}
  <section hidden={!inTab("plan")} style={card}>
   <h2 {...anchor("Plan de cuidados")} style={{fontSize:18,margin:0}}>Plan de cuidados</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Metas longitudinales de crónicos: proponer → activar → lograr, con pausa/reanudación. Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginTop:12}}>
    <select aria-label="Categoría del plan de cuidado" style={input} value={planCat} onChange={e=>setPlanCat(e.target.value)}>
     <option value="DIABETES">Diabetes</option><option value="HYPERTENSION">Hipertensión</option><option value="OBESITY">Obesidad</option><option value="CARDIOVASCULAR">Cardiovascular</option><option value="MENTAL_HEALTH">Salud mental</option><option value="PRENATAL">Prenatal</option><option value="OTHER">Otro</option>
    </select>
    <input aria-label="Meta del plan de cuidado" style={input} value={planGoal} onChange={e=>setPlanGoal(e.target.value)} placeholder="Meta (ej. HbA1c < 7% en 6 meses)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!planGoal} onClick={createPlan}>{busy==="cp-new"?"Proponiendo…":"Proponer meta"}</button></div>
   {plans.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {plans.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {plans.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{c.label}</b><div style={{fontSize:12,color:P.muted}}>v{c.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(c.state)}>{c.state}</span>
      {cpActions(c).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="CANCELLED"?{color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}:{})}} disabled={busy!==""} onClick={()=>doPlanAction(c,act)}>{busy==="cp-"+c.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* FACTURACIÓN / RECLAMACIONES */}
  <section hidden={!inTab("admin")} style={card}>
   <h2 {...anchor("Facturación")} style={{fontSize:18,margin:0}}>Facturación</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Ciclo de ingresos (seguimiento de estado, no mueve dinero): borrador → codificar → enviar → pagada/rechazada, con reenvío. Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:10,marginTop:12}}>
    <input aria-label="Importe" style={input} value={clmAmount} onChange={e=>setClmAmount(e.target.value)} placeholder="Monto (ej. 1500.00)" />
    <select aria-label="Moneda" style={input} value={clmCurrency} onChange={e=>setClmCurrency(e.target.value)}><option value="MXN">MXN</option><option value="USD">USD</option></select>
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!clmAmount} onClick={createClaim}>{busy==="clm-new"?"Creando…":"Crear reclamación"}</button></div>
   {claims.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {claims.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {claims.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{c.label}</b><div style={{fontSize:12,color:P.muted}}>v{c.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(c.state)}>{c.state}</span>
      {clmActions(c).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="VOIDED"||act.to==="REJECTED"?{color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}:{})}} disabled={busy!==""} onClick={()=>doClaimAction(c,act)}>{busy==="clm-"+c.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* CONSENTIMIENTO INFORMADO */}
  <section hidden={!inTab("coordinacion")} style={card}>
   <h2 {...anchor("Consentimiento informado")} style={{fontSize:18,margin:0}}>Consentimiento informado</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Registro clínico-legal (NOM-004 / aviso de privacidad): redactar → presentar → otorgar/rechazar; un consentimiento otorgado puede revocarse. Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginTop:12}}>
    <select aria-label="Tipo de consentimiento" style={input} value={csType} onChange={e=>setCsType(e.target.value)}>
     <option value="PROCEDURE">Procedimiento</option><option value="TREATMENT">Tratamiento</option><option value="ANESTHESIA">Anestesia</option><option value="DATA_SHARING">Compartir datos</option><option value="RESEARCH">Investigación</option>
    </select>
    <input aria-label="Referencia del consentimiento" style={input} value={csRef} onChange={e=>setCsRef(e.target.value)} placeholder="Referencia del documento (ej. CI-2026-001)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!csRef} onClick={createConsent}>{busy==="cs-new"?"Redactando…":"Redactar consentimiento"}</button></div>
   {consents.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {consents.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {consents.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{c.label}</b><div style={{fontSize:12,color:P.muted}}>v{c.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(c.state)}>{c.state}</span>
      {csActions(c).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="DECLINED"||act.to==="REVOKED"?{color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}:{})}} disabled={busy!==""} onClick={()=>doConsentAction(c,act)}>{busy==="cs-"+c.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* INTERNAMIENTO / HOSPITALIZACIÓN */}
  {hospitalOn&&<section hidden={!inTab("hospital")} style={card}>
   <h2 {...anchor("Internamiento")} style={{fontSize:18,margin:0}}>Internamiento</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Episodio de hospitalización: admitir → trasladar (unidad) → dar de alta; cancelable si fue admisión por error. Agregado con máquina de estados y aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:10,marginTop:12}}>
    <select aria-label="Unidad de internamiento" style={input} value={admUnit} onChange={e=>setAdmUnit(e.target.value)}>
     <option value="ER">Urgencias</option><option value="WARD">Hospitalización</option><option value="ICU">UCI</option><option value="OR">Quirófano</option><option value="MATERNITY">Maternidad</option><option value="PEDIATRICS">Pediatría</option>
    </select>
    <input aria-label="Motivo de internamiento" style={input} value={admReason} onChange={e=>setAdmReason(e.target.value)} placeholder="Motivo (ej. Dolor torácico)" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!admReason} onClick={createAdmission}>{busy==="adm-new"?"Admitiendo…":"Admitir paciente"}</button></div>
   {adms.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {adms.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {adms.map(a=><div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>Unidad: {a.unit}</b><div style={{fontSize:12,color:P.muted}}>v{a.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(a.state)}>{a.state}</span>
      {admActions(a).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="CANCELLED"?{color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}:{})}} disabled={busy!==""} onClick={()=>doAdmAction(a,act)}>{busy==="adm-"+a.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>}

  {/* MUESTRAS / CADENA DE CUSTODIA */}
  {hospitalOn&&<section hidden={!inTab("hospital")} style={card}>
   <h2 {...anchor("Muestras de laboratorio")} style={{fontSize:18,margin:0}}>Muestras de laboratorio</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Cadena de custodia pre-analítica: recolectar → enviar → recibir → resultar; rechazable en cualquier etapa. Una muestra rechazada aparece como pendiente HIGH en care gaps.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginTop:12}}>
    <select aria-label="Tipo de muestra" style={input} value={specType} onChange={e=>setSpecType(e.target.value)}>
     <option value="BLOOD">Sangre</option><option value="URINE">Orina</option><option value="TISSUE">Tejido</option><option value="SWAB">Hisopado</option><option value="CSF">LCR</option><option value="STOOL">Heces</option>
    </select>
    <button style={btn} disabled={busy!==""} onClick={createSpecimen}>{busy==="sp-new"?"Recolectando…":"Recolectar muestra"}</button>
   </div>
   {specs.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {specs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {specs.map(s=>{const n=spNext(s);const open=s.state!=="RESULTED"&&s.state!=="REJECTED";return <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{s.specimenType}</b><div style={{fontSize:12,color:P.muted}}>v{s.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(s.state)}>{s.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceSpecimen(s)}>{busy==="sp-"+s.id?"…":n.label}</button>}
      {open&&<button style={{...ghost,padding:"7px 12px",color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}} disabled={busy!==""} onClick={()=>rejectSpecimen(s)}>Rechazar</button>}
     </div>
    </div>;})}
   </div>}
  </section>}

  {/* INCIDENTES / SEGURIDAD DEL PACIENTE */}
  <section hidden={!inTab("hospital")} style={card}>
   <h2 {...anchor("Incidentes de seguridad")} style={{fontSize:18,margin:0}}>Incidentes de seguridad</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Reporte de eventos adversos (farmacovigilancia): reportar → revisar → escalar/resolver. Un incidente abierto aparece como pendiente HIGH en care gaps. Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 150px 1fr",gap:10,marginTop:12}}>
    <select aria-label="Categoría del incidente" style={input} value={incCat} onChange={e=>setIncCat(e.target.value)}>
     <option value="MEDICATION_ERROR">Error de medicación</option><option value="FALL">Caída</option><option value="EQUIPMENT">Equipo</option><option value="ADVERSE_DRUG_REACTION">RAM</option><option value="INFECTION">Infección</option><option value="OTHER">Otro</option>
    </select>
    <select aria-label="Severidad del incidente" style={input} value={incSev} onChange={e=>setIncSev(e.target.value)}><option value="LOW">Leve</option><option value="MODERATE">Moderado</option><option value="SEVERE">Grave</option></select>
    <input aria-label="Descripción del incidente" style={input} value={incDesc} onChange={e=>setIncDesc(e.target.value)} placeholder="Descripción del incidente" />
   </div>
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!incDesc} onClick={createIncident}>{busy==="inc-new"?"Reportando…":"Reportar incidente"}</button></div>
   {incs.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {incs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {incs.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{i.label}</b><div style={{fontSize:12,color:P.muted}}>v{i.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(i.state)}>{i.state}</span>
      {incActions(i).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="ESCALATED"?{color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}:{})}} disabled={busy!==""} onClick={()=>doIncAction(i,act)}>{busy==="inc-"+i.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>

  {/* TRIAGE / CLASIFICACIÓN DE ACUIDAD */}
  {hospitalOn&&<section hidden={!inTab("hospital")} style={card}>
   <h2 {...anchor("Triage")} style={{fontSize:18,margin:0}}>Triage</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Clasificación de acuidad (urgencias): arribar → iniciar → clasificar ESI (re-evaluable) → cerrar, o LWBS. Un paciente sin triage completado es un pendiente HIGH en care gaps.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginTop:12}}>
    <input aria-label="Motivo de consulta (triage)" style={input} value={trComplaint} onChange={e=>setTrComplaint(e.target.value)} placeholder="Motivo de consulta (ej. Dolor torácico)" />
    <button style={btn} disabled={busy!==""||!trComplaint} onClick={createTriage}>{busy==="tr-new"?"Registrando…":"Registrar arribo"}</button>
   </div>
   {triages.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {triages.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {triages.map(t=><div key={t.id} style={{padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{minWidth:0}}>
       <b style={{fontSize:14}}>{t.chiefComplaint}{t.acuity>0&&<span style={{...stateBadge(t.acuity<=2?"ESCALATED":"TRIAGED"),marginLeft:8,fontSize:11}}>ESI-{t.acuity}</span>}</b>
       {/* R2B-019: la trazabilidad de CÓMO se llegó al nivel. Antes el nivel era un entero sin origen. */}
       <div style={{fontSize:12,color:P.muted}}>
        v{t.version}
        {t.decisionPoint&&<> · punto {t.decisionPoint}</>}
        {t.reassessDueAt&&<> · reevaluar a las {new Date(t.reassessDueAt).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})} ({REASSESSMENT_SOURCE_SHORT})</>}
        {t.acuity===1&&<> · vigilancia continua</>}
       </div>
       {t.upgradeConsidered&&<div role="note" style={{fontSize:12,color:P.amberOnPale,fontWeight:600,marginTop:4}}>Signos vitales en zona de peligro: el algoritmo sugiere considerar ESI-2.</div>}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
       <span style={stateBadge(t.state)}>{t.state}</span>
       {(t.state==="IN_TRIAGE"||t.state==="TRIAGED")&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""}
        onClick={()=>{setTrEsiFor(trEsiFor===t.id?null:t.id);setTrEsi(ESI_FORM_EMPTY);setTrEsiMsg(null);}}>
        {trEsiFor===t.id?"Cancelar":t.state==="TRIAGED"?"Re-clasificar":"Clasificar (ESI)"}</button>}
       {trActions(t).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="LWBS"?{color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}:{})}} disabled={busy!==""} onClick={()=>doTriageAction(t,act)}>{busy==="tr-"+t.id?"…":act.label}</button>)}
      </div>
     </div>
     {/* Formulario de los discriminadores. El nivel NO está aquí: es una consecuencia que calcula el servidor con el
         algoritmo, y por eso el botón dice «Calcular y registrar» y no «Clasificar ESI-2». */}
     {trEsiFor===t.id&&<div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${LINE}`,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:11.5,color:P.muted,lineHeight:1.5}}>Algoritmo ESI (cuatro puntos de decisión). Los puntos A, B y C son juicio clínico: el sistema exige que consten y aplica el árbol sin saltarse pasos. El punto D —signos vitales en zona de peligro— lo calcula con la tabla por edad.</div>
      <Check checked={trEsi.requiresLifeSavingIntervention} onChange={()=>setTrEsi({...trEsi,requiresLifeSavingIntervention:!trEsi.requiresLifeSavingIntervention})} label="A · Requiere intervención inmediata para salvar la vida" />
      <Check checked={trEsi.highRiskSituation} onChange={()=>setTrEsi({...trEsi,highRiskSituation:!trEsi.highRiskSituation})} label="B · Situación de alto riesgo" />
      <Check checked={trEsi.newConfusionLethargyDisorientation} onChange={()=>setTrEsi({...trEsi,newConfusionLethargyDisorientation:!trEsi.newConfusionLethargyDisorientation})} label="B · Confusión, letargo o desorientación de nueva aparición" />
      <Check checked={trEsi.severeDistress} onChange={()=>setTrEsi({...trEsi,severeDistress:!trEsi.severeDistress})} label="B · Distrés severo" />
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
       <label style={{fontSize:12,color:P.muted}}>Dolor (0-10)<input aria-label="Escala de dolor" style={{...input,marginTop:4}} inputMode="numeric" value={trEsi.painScore} onChange={e=>setTrEsi({...trEsi,painScore:e.target.value})} placeholder="—" /></label>
       <label style={{fontSize:12,color:P.muted}}>C · Recursos previstos<input aria-label="Recursos previstos" style={{...input,marginTop:4}} inputMode="numeric" value={trEsi.predictedResources} onChange={e=>setTrEsi({...trEsi,predictedResources:e.target.value})} /></label>
       <label style={{fontSize:12,color:P.muted}}>Edad (meses)<input aria-label="Edad en meses" style={{...input,marginTop:4}} inputMode="numeric" value={trEsi.ageMonths} onChange={e=>setTrEsi({...trEsi,ageMonths:e.target.value})} /></label>
       <label style={{fontSize:12,color:P.muted}}>FC<input aria-label="Frecuencia cardíaca" style={{...input,marginTop:4}} inputMode="numeric" value={trEsi.heartRate} onChange={e=>setTrEsi({...trEsi,heartRate:e.target.value})} placeholder="—" /></label>
       <label style={{fontSize:12,color:P.muted}}>FR<input aria-label="Frecuencia respiratoria" style={{...input,marginTop:4}} inputMode="numeric" value={trEsi.respiratoryRate} onChange={e=>setTrEsi({...trEsi,respiratoryRate:e.target.value})} placeholder="—" /></label>
       <label style={{fontSize:12,color:P.muted}}>SpO₂ (%)<input aria-label="Saturación de oxígeno (SpO2)" style={{...input,marginTop:4}} inputMode="numeric" value={trEsi.spo2} onChange={e=>setTrEsi({...trEsi,spo2:e.target.value})} placeholder="—" /></label>
      </div>
      <div style={{fontSize:11.5,color:P.muted}}>Un signo vital vacío es «no se midió», no «normal»: el algoritmo lo reporta como faltante en vez de asumirlo.</div>
      {trEsiMsg&&<div role="alert" style={{padding:"10px 12px",border:"1px solid var(--c-amber-bd)",background:"var(--c-amber-bg)",color:P.amberOnPale,borderRadius:10,fontSize:12.5,fontWeight:600}}>{trEsiMsg}</div>}
      <div><button style={btn} disabled={busy!==""} onClick={()=>classifyTriage(t)}>{busy==="tr-"+t.id?"Calculando…":"Calcular y registrar nivel"}</button></div>
     </div>}
    </div>)}
   </div>}
  </section>}

  {/* HERIDAS / LESIONES POR PRESIÓN */}
  {hospitalOn&&<section hidden={!inTab("hospital")} style={card}>
   <h2 {...anchor("Cuidado de heridas")} style={{fontSize:18,margin:0}}>Cuidado de heridas</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Lesión por presión (UPP) longitudinal: documentar estadio → re-valorar (append-only) → cicatrizar/escalar. Métrica de calidad. Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"180px 180px auto",gap:10,marginTop:12}}>
    <select aria-label="Localización de la herida" style={input} value={wnLoc} onChange={e=>setWnLoc(e.target.value)}>
     <option value="SACRUM">Sacro</option><option value="HEEL">Talón</option><option value="ISCHIUM">Isquion</option><option value="TROCHANTER">Trocánter</option><option value="OCCIPUT">Occipucio</option><option value="ELBOW">Codo</option><option value="OTHER">Otro</option>
    </select>
    <select aria-label="Estadio de la herida" style={input} value={wnStage} onChange={e=>setWnStage(e.target.value)}>
     <option value="STAGE_1">Estadio 1</option><option value="STAGE_2">Estadio 2</option><option value="STAGE_3">Estadio 3</option><option value="STAGE_4">Estadio 4</option><option value="UNSTAGEABLE">No estadiable</option><option value="DTI">LTP profunda</option>
    </select>
    <button style={btn} disabled={busy!==""} onClick={createWound}>{busy==="wn-new"?"Documentando…":"Documentar herida"}</button>
   </div>
   {wounds.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {wounds.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {wounds.map(w=><div key={w.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{w.location} · {w.stage}</b><div style={{fontSize:12,color:P.muted}}>v{w.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(w.state)}>{w.state}</span>
      {wnActions(w).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="ESCALATED"?{color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}:{})}} disabled={busy!==""} onClick={()=>doWoundAction(w,act)}>{busy==="wn-"+w.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>}

  {/* TRANSFUSIONES */}
  {hospitalOn&&<section hidden={!inTab("hospital")} style={card}>
   <h2 {...anchor("Transfusiones")} style={{fontSize:18,margin:0}}>Transfusiones</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Medicina transfusional con verificación pre-transfusional: ordenar → cruzar (crossmatch) → iniciar → completar; una reacción se registra como pendiente HIGH (hemovigilancia). Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 120px auto",gap:10,marginTop:12}}>
    <select aria-label="Producto sanguíneo" style={input} value={tfProduct} onChange={e=>setTfProduct(e.target.value)}>
     <option value="PRBC">Concentrado eritrocitario</option><option value="PLATELETS">Plaquetas</option><option value="FFP">Plasma fresco</option><option value="CRYO">Crioprecipitados</option><option value="WHOLE_BLOOD">Sangre total</option>
    </select>
    <input aria-label="Unidades a transfundir" style={input} value={tfUnits} onChange={e=>setTfUnits(e.target.value)} placeholder="Unidades" />
    <button style={btn} disabled={busy!==""} onClick={createTransfusion}>{busy==="tf-new"?"Ordenando…":"Ordenar transfusión"}</button>
   </div>
   {transfs.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {transfs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {transfs.map(t=>{const n=tfNext(t);return <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{t.product} · {t.units} U</b><div style={{fontSize:12,color:P.muted}}>v{t.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(t.state)}>{t.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceTransfusion(t)}>{busy==="tf-"+t.id?"…":n.label}</button>}
      {t.state==="TRANSFUSING"&&<button style={{...ghost,padding:"7px 12px",color:P.redOnPale,borderColor:"var(--c-red-bd)"}} disabled={busy!==""} onClick={()=>transfusionReaction(t)}>Reacción</button>}
     </div>
    </div>;})}
   </div>}
  </section>}

  {/* CIRUGÍA / QUIRÓFANO */}
  {hospitalOn&&<section hidden={!inTab("hospital")} style={card}>
   <h2 {...anchor("Cirugía")} style={{fontSize:18,margin:0}}>Cirugía</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Caso quirúrgico con barrera de seguridad: agendar → time-out OMS (checklist) → iniciar → completar. No se puede iniciar sin el time-out. Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 150px auto",gap:10,marginTop:12}}>
    <input aria-label="Procedimiento quirúrgico" style={input} value={sgProc} onChange={e=>setSgProc(e.target.value)} placeholder="Procedimiento (ej. Colecistectomía)" />
    <select aria-label="Lateralidad quirúrgica" style={input} value={sgLat} onChange={e=>setSgLat(e.target.value)}><option value="NA">Sin lateralidad</option><option value="LEFT">Izquierdo</option><option value="RIGHT">Derecho</option><option value="BILATERAL">Bilateral</option></select>
    <button style={btn} disabled={busy!==""||!sgProc} onClick={createSurgery}>{busy==="sg-new"?"Agendando…":"Agendar cirugía"}</button>
   </div>
   {surgs.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {surgs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {surgs.map(s=>{const n=sgNext(s);const open=s.state==="SCHEDULED"||s.state==="TIMED_OUT";return <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{s.procedure}</b><div style={{fontSize:12,color:P.muted}}>v{s.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(s.state)}>{s.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceSurgery(s)}>{busy==="sg-"+s.id?"…":n.label}</button>}
      {open&&<button style={{...ghost,padding:"7px 12px",color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}} disabled={busy!==""} onClick={()=>cancelSurgery(s)}>Cancelar</button>}
     </div>
    </div>;})}
   </div>}
  </section>}

  {/* DIÁLISIS */}
  {hospitalOn&&<section hidden={!inTab("hospital")} style={card}>
   <h2 {...anchor("Diálisis")} style={{fontSize:18,margin:0}}>Diálisis</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Terapia de reemplazo renal: agendar → iniciar → completar; una interrupción por complicación se registra como pendiente HIGH y puede reanudarse. Aislamiento por tenant.</p>
   <div style={{display:"grid",gridTemplateColumns:"200px 200px auto",gap:10,marginTop:12}}>
    <select aria-label="Modalidad de diálisis" style={input} value={dzMod} onChange={e=>setDzMod(e.target.value)}>
     <option value="HEMODIALYSIS">Hemodiálisis</option><option value="PERITONEAL">Peritoneal</option><option value="HEMOFILTRATION">Hemofiltración</option>
    </select>
    <select aria-label="Acceso vascular de diálisis" style={input} value={dzAcc} onChange={e=>setDzAcc(e.target.value)}>
     <option value="FISTULA">Fístula</option><option value="GRAFT">Injerto</option><option value="CATHETER">Catéter</option><option value="PERITONEAL_CATHETER">Catéter peritoneal</option>
    </select>
    <button style={btn} disabled={busy!==""} onClick={createDialysis}>{busy==="dz-new"?"Agendando…":"Agendar sesión"}</button>
   </div>
   {dialz.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {dialz.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {dialz.map(d=><div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:14}}>{d.modality}</b><div style={{fontSize:12,color:P.muted}}>v{d.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <span style={stateBadge(d.state)}>{d.state}</span>
      {dzActions(d).map(act=><button key={act.label} style={{...ghost,padding:"7px 12px",...(act.to==="INTERRUPTED"||act.to==="NO_SHOW"?{color:P.amberOnPale,borderColor:"var(--c-amber-bd)"}:{})}} disabled={busy!==""} onClick={()=>doDialysisAction(d,act)}>{busy==="dz-"+d.id?"…":act.label}</button>)}
     </div>
    </div>)}
   </div>}
  </section>}

  {/* DOCUMENTOS CLÍNICOS */}
  <section hidden={!inTab("documentos")} style={card}>
   <h2 {...anchor("Documentos clínicos")} style={{fontSize:18,margin:0}}>Documentos clínicos</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>La firma produce un snapshot reproducible e inmutable; toda corrección posterior es un addendum append-only (PROD-014-R022).</p>
   <div style={{display:"grid",gridTemplateColumns:"1fr 200px",gap:10,marginTop:12}}>
    <input aria-label="Título del documento" style={input} value={docTitle} onChange={e=>setDocTitle(e.target.value)} placeholder="Título (ej. Nota de evolución)" />
    <select aria-label="Tipo de documento" style={input} value={docType} onChange={e=>setDocType(e.target.value)}>
     <option value="PROGRESS_NOTE">Nota de evolución</option><option value="DISCHARGE_SUMMARY">Alta</option>
     <option value="REFERRAL">Referencia</option><option value="PROCEDURE_NOTE">Nota de procedimiento</option><option value="OTHER">Otro</option>
    </select>
   </div>
   <textarea style={{...input,minHeight:64,resize:"vertical",marginTop:10}} aria-label="Contenido del documento" value={docContent} onChange={e=>setDocContent(e.target.value)} placeholder="Contenido clínico…" />
   <div style={{marginTop:10}}><button style={btn} disabled={busy!==""||!docContent} onClick={createDoc}>{busy==="doc-new"?"Creando…":"Crear documento"}</button></div>
   {docs.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {docs.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {docs.map(d=>{const n=docNext(d);return <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{d.label}</b><div style={{fontSize:12,color:P.muted}}>v{d.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={stateBadge(d.state)}>{d.state}</span>
      {n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceDoc(d)}>{busy==="doc-"+d.id?"…":n.label}</button>}
     </div>
    </div>;})}
   </div>}

   {/* REPOSITORIO PERSISTENTE del paciente: todos sus documentos (read-model) + adjuntos binarios (PHI en Blob privado). */}
   <div style={{marginTop:22,borderTop:`1px solid ${LINE}`,paddingTop:18}}>
    <h3 style={{fontSize:15,margin:0}}>Repositorio del paciente</h3>
    <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Todos los documentos del expediente. Abre uno para leer su contenido y su firma, y para adjuntar estudios (PDF o imagen) en el almacenamiento privado del consultorio.</p>
    {docsSnap&&docsSnap.total>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>{Object.entries(docsSnap.byType).map(([t,n])=><span key={t} style={{background:"var(--c-blue-bg)",color:P.muted,border:`1px solid ${LINE}`,borderRadius:999,padding:"3px 10px",fontSize:11.5}}>{t} · {n}</span>)}</div>}
    {!docsSnap&&<div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>{Array.from({length:3}).map((_,i)=><Skeleton key={i} h={44} r={12}/>)}</div>}
    {docsSnap&&docsSnap.total===0&&<div style={{marginTop:12,fontSize:12,color:P.muted}}>Este paciente aún no tiene documentos en el repositorio. Crea uno arriba; al guardarlo aparecerá aquí.</div>}
    {docsSnap&&docsSnap.total>0&&<div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>{docsSnap.items.map(it=>{const active=docDetail?.documentId===it.documentId;return <div key={it.documentId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"11px 14px",border:`1px solid ${active?"var(--c-blue-bd)":"var(--c-line)"}`,background:active?"#F6F9FE":"#fff",borderRadius:12}}>
     <div style={{minWidth:0}}><b style={{fontSize:13.5}}>{it.title}</b><div style={{fontSize:11.5,color:P.muted}}>{it.typeLabel} · {it.statusLabel} · {new Date(it.createdAt).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"})}</div></div>
     <button style={{...ghost,padding:"7px 14px",flex:"0 0 auto"}} disabled={docDetBusy} onClick={()=>{setAttConfirm(null);void loadDoc(it.documentId);}}>{docDetBusy&&active?"…":"Abrir"}</button>
    </div>;})}</div>}
   </div>

   {/* DETALLE del documento + ADJUNTOS (ver/subir/quitar). El binario va al Blob privado; al stream de eventos solo la referencia. */}
   {docDetBusy&&!docDetail&&<div style={{marginTop:14}}><Skeleton h={120} r={12}/></div>}
   {docDetail&&<div style={{marginTop:14,border:`1px solid ${LINE}`,borderRadius:14,padding:16,background:"var(--c-surface)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
     <div style={{minWidth:0}}><b style={{fontSize:15}}>{docDetail.title}</b><div style={{fontSize:12,color:P.muted,marginTop:2}}>{docDetail.typeLabel} · v{docDetail.version}</div></div>
     <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={stateBadge(docDetail.state)}>{docDetail.statusLabel}</span><button style={{...ghost,padding:"6px 12px"}} onClick={()=>{setDocDetail(null);setAttConfirm(null);}}>Cerrar</button></div>
    </div>
    <div style={{marginTop:12,whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.5,background:"var(--c-wash2)",border:`1px solid ${LINE}`,borderRadius:10,padding:"12px 14px"}}>{docDetail.content||<span style={{color:P.muted}}>Sin contenido.</span>}</div>
    {docDetail.addenda.length>0&&<div style={{marginTop:12}}><div style={{fontSize:12,fontWeight:700,color:P.muted}}>Addenda (append-only)</div>{docDetail.addenda.map((a,i)=><div key={i} style={{marginTop:6,fontSize:12.5,borderLeft:`2px solid ${LINE}`,paddingLeft:10}}>{a.addendum}<div style={{fontSize:11,color:P.muted}}>{new Date(a.at).toLocaleString("es-MX")}</div></div>)}</div>}
    {docDetail.signature&&<div style={{marginTop:12,fontSize:11.5,color:P.muted}}>Firmado el {new Date(docDetail.signature.signedAt).toLocaleString("es-MX")} · hash <span style={mono}>{docDetail.signature.signatureDigest.slice(0,16)}…</span></div>}
    <div style={{marginTop:16,borderTop:`1px solid ${LINE}`,paddingTop:14}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
      <div style={{fontSize:13,fontWeight:700}}>Adjuntos <span style={{color:P.muted,fontWeight:400}}>({docDetail.attachments.length})</span></div>
      <div>
       <input ref={attInputRef} type="file" accept={ATT_MIME.join(",")} style={{display:"none"}} aria-hidden onChange={e=>{const f=e.target.files?.[0];void onPickAttachment(f??undefined);e.target.value="";}}/>
       <button style={{...btn,padding:"8px 14px"}} disabled={attBusy} onClick={()=>attInputRef.current?.click()}>{attBusy?"Subiendo…":"+ Adjuntar archivo"}</button>
      </div>
     </div>
     <div style={{fontSize:11,color:P.muted,marginTop:4}}>PDF o imagen (PNG, JPG, WEBP, GIF, TIFF), máx. 25 MB. Se guarda en el almacenamiento privado del consultorio; nunca en una URL pública.</div>
     {attMsg&&<div style={{marginTop:8,fontSize:12,color:attMsg.includes("✓")?P.greenOnPale:P.redOnPale}}>{attMsg}</div>}
     {docDetail.attachments.length===0&&<div style={{marginTop:10,fontSize:12,color:P.muted}}>Sin archivos adjuntos. Usa «Adjuntar archivo» para subir un estudio o una constancia.</div>}
     {docDetail.attachments.length>0&&<div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>{docDetail.attachments.map(a=><div key={a.attachmentId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px",border:"1px solid var(--c-line)",borderRadius:10}}>
      <div style={{minWidth:0}}><span style={{fontSize:13}}>{a.filename}</span><div style={{fontSize:11,color:P.muted}}>{a.mime} · {fmtBytes(a.size)} · {new Date(a.attachedAt).toLocaleDateString("es-MX")}</div></div>
      <div style={{display:"flex",gap:8,alignItems:"center",flex:"0 0 auto"}}>
       <button style={{...ghost,padding:"6px 12px"}} onClick={()=>void viewAttachment(a)}>Ver</button>
       {attConfirm===a.attachmentId
        ? <><button style={{...ghost,padding:"6px 12px",color:P.redOnPale,borderColor:"var(--c-red-bd)"}} disabled={attBusy} onClick={async()=>{await removeAttachment(a);setAttConfirm(null);}}>Sí, quitar</button><button style={{...ghost,padding:"6px 12px"}} onClick={()=>setAttConfirm(null)}>Cancelar</button></>
        : <button style={{...ghost,padding:"6px 12px"}} disabled={attBusy} onClick={()=>setAttConfirm(a.attachmentId)}>Quitar</button>}
      </div>
     </div>)}</div>}
    </div>
   </div>}
  </section>

  {/* OBLIGACIONES / SEGUIMIENTO */}
  <section hidden={!inTab("coordinacion")} style={card}>
   <h2 {...anchor("Obligaciones de seguimiento")} style={{fontSize:18,margin:0}}>Obligaciones de seguimiento</h2>
   <p style={{color:P.muted,fontSize:12,margin:"4px 0 0"}}>Care gaps / follow-up. Completar exige evidencia (Zero Lost Follow-Up: nada se cierra sin constancia).</p>
   <div style={{display:"flex",gap:10,marginTop:12,alignItems:"center"}}>
    <input aria-label="Tipo de obligación" style={{...input,maxWidth:420}} value={obKind} onChange={e=>setObKind(e.target.value)} placeholder="Tipo (ej. Contactar por resultado crítico)" />
    <button style={btn} disabled={busy!==""||!obKind} onClick={createObligation}>{busy==="ob-new"?"Creando…":"Crear obligación"}</button>
   </div>
   {obligations.length===0&&<div style={{marginTop:14,fontSize:11.5,color:P.muted}}>{SOLO_ESTA_PANTALLA}</div>}
   {obligations.length>0&&<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
    {obligations.map(o=>{const n=obNext(o);return <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"1px solid var(--c-line)",borderRadius:12}}>
     <div><b style={{fontSize:14}}>{o.label}</b><div style={{fontSize:12,color:P.muted}}>v{o.version}</div></div>
     <div style={{display:"flex",gap:10,alignItems:"center"}}><span style={stateBadge(o.state)}>{o.state}</span>{n&&<button style={{...ghost,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>advanceObligation(o)}>{busy==="ob-"+o.id?"…":n.label}</button>}</div>
    </div>;})}
   </div>}
  </section>

  {/* Auditoría R05a-F07: anular una factura y revocar un consentimiento se disparaban con UN clic. No son reversibles: el
      registro es de solo-añadir, así que lo único posible después es anotar encima. Mismo patrón de diálogo que el bloqueo
      de seguridad, incluido `role="alertdialog"` para que un lector de pantalla lo anuncie como lo que es. */}
  {pendingIrreversible&&<div className="span2" role="alertdialog" aria-labelledby="irrev-title" data-testid="confirm-irreversible" style={{...card,borderColor:"var(--c-amber-bd)",background:"var(--c-amber-bg)"}}>
   <b id="irrev-title" style={{color:P.amberOnPale}}>Acción irreversible — {pendingIrreversible.what}</b>
   <p style={{margin:"6px 0 0",color:"var(--c-amber-fg)",wordBreak:"break-word"}}>{pendingIrreversible.detail}</p>
   <div style={{display:"flex",gap:10,marginTop:10,justifyContent:"flex-end"}}>
    <button style={{...ghost,padding:"9px 16px"}} data-testid="cancel-irreversible" onClick={cancelIrreversible}>Cancelar</button>
    <button style={{...btn,background:P.amberOnPale}} data-testid="accept-irreversible" disabled={busy!==""} onClick={confirmIrreversible}>{pendingIrreversible.what}</button>
   </div>
  </div>}
  {overrideMed&&<div className="span2" role="alertdialog" aria-labelledby="override-title" style={{...card,borderColor:"var(--c-red-bd)",background:"var(--c-red-bg)"}}>
   <b id="override-title" style={{color:P.redOnPale}}>Bloqueo de seguridad — {overrideMed.med.label}</b>
   <p style={{margin:"6px 0 0",color:"var(--c-red-fg)",wordBreak:"break-word"}}>{overrideMed.message}</p>
   <ul style={{margin:"8px 0 0",paddingLeft:18,color:"var(--c-red-fg)",fontSize:13}}>{overrideMed.barriers.map(b=><li key={b}>Vas a anular: <b>{BARRIER_LABEL[b]??b}</b></li>)}</ul>
   <label htmlFor="override-why" style={{display:"block",margin:"10px 0 4px",fontSize:12,fontWeight:700,color:"var(--c-red-fg)"}}>Justificación clínica de la anulación (queda en el expediente con tu identidad; mínimo 20 caracteres)</label>
   <textarea id="override-why" aria-label="Motivo de la anulación" value={overrideWhy} onChange={e=>setOverrideWhy(e.target.value)} rows={2} maxLength={1000} style={{...input,width:"100%",resize:"vertical"}} />
   <div style={{display:"flex",gap:10,marginTop:10,justifyContent:"flex-end"}}>
    <button style={{...ghost,padding:"9px 16px"}} onClick={()=>{setOverrideMed(null);setOverrideWhy("");}}>Cancelar</button>
    <button style={{...btn,background:P.redOnPale,opacity:overrideWhy.trim().length<20?.5:1}} disabled={busy!==""||overrideWhy.trim().length<20} onClick={confirmOverrideMed}>Anular el bloqueo bajo mi responsabilidad</button>
   </div>
  </div>}
  {ackMed&&<div className="span2" role="alertdialog" aria-labelledby="ack-title" style={{...card,borderColor:"var(--c-amber-bd)",background:"var(--c-amber-bg)"}}>
   <b id="ack-title" style={{color:"var(--c-amber-fg)"}}>Verificación automática incompleta — {ackMed.med.label}</b>
   <p style={{margin:"6px 0 0",color:"var(--c-amber-fg)",wordBreak:"break-word"}}>{ackMed.message}</p>
   <label htmlFor="ack-why" style={{display:"block",margin:"10px 0 4px",fontSize:12,fontWeight:700,color:"var(--c-amber-fg)"}}>Justificación clínica (queda en el expediente, mínimo 10 caracteres)</label>
   <textarea id="ack-why" aria-label="Motivo del reconocimiento" value={ackWhy} onChange={e=>setAckWhy(e.target.value)} rows={2} maxLength={500} style={{...input,width:"100%",resize:"vertical"}} />
   <div style={{display:"flex",gap:10,marginTop:10,justifyContent:"flex-end"}}>
    <button style={{...ghost,padding:"9px 16px"}} onClick={()=>{setAckMed(null);setAckWhy("");}}>Cancelar</button>
    <button style={{...btn,opacity:ackWhy.trim().length<10?.5:1}} disabled={busy!==""||ackWhy.trim().length<10} onClick={confirmAckMed}>Prescribir bajo mi criterio clínico</button>
   </div>
  </div>}
  {error&&<div className="span2" style={{...card,borderColor:"var(--c-red-bd)",background:"var(--c-red-bg)"}}><b style={{color:"var(--c-red-fg)"}}>Error</b><p style={{margin:"6px 0 0",color:"var(--c-red-fg)",wordBreak:"break-word"}}>{error}</p>{error.includes("SAFETY_BLOCKED")&&<p style={{margin:"6px 0 0",fontSize:12,color:P.amberOnPale}}>💡 ¿Hay un resultado crítico sin cerrar para este paciente? Ciérralo abajo y vuelve a firmar.</p>}</div>}
  </main>
  </>;

}
