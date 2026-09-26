"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "medicamentos" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import {drugCatalog,interactionRules,type DrugCatalogItem} from "../../../../../packages/drug-catalog/src";
import {apiRequest} from "../../../lib/session-client";
import{Check,errMsg,userMessage,card,P,LINE,UI,scrollToSection,act,actRow,Skeleton,parseIxResult,IX_SEVERITIES,IX_SEV_LABEL,type IxSev}from"../shared";
import{useWorkspace}from"../context";
export default function MedicamentosView(){
 const{ixMsg,setIxMsg,medQuery,medCat,medOnlyMon,medOnlyRenal,medSel,setRxDrug,setView,setMedTab,medTab,ixInput,ixDrugs,setIxDrugs,setIxInput,setIxRes,setIxFactors,ixFactors,setIxBusy,ixBusy,ixRes,setMedQuery,setMedCat,setMedOnlyMon,setMedOnlyRenal,setMedSel}=useWorkspace();

   // ===== MÓDULO MEDICAMENTOS — S8 (6 pestañas), pestaña "Catálogo" =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const MTABS:[typeof medTab,string,string][]=[["catalogo","Catálogo","M4 7h16M4 12h16M4 17h10"],["plantillas","Plantillas","M7 3h10v18H7z"],["rapidas","Prescripciones rápidas","M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z"],["interacciones","Interacciones","M8 8a4 4 0 118 0M8 16a4 4 0 108 0M12 8v8"],["alertas","Alertas","M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6"],["reportes","Reportes","M4 19V5M4 19h16M8 15l3-4 3 2 4-6"]];
   const kico=(bg:string,fg:string,d:string)=><span style={{width:40,height:40,borderRadius:11,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:15,display:"flex",gap:12,alignItems:"center"};
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"14px 0 6px"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   // ===== Catálogo REAL determinista (packages/drug-catalog) — principio activo + clases + categoría + reglas =====
   const cat=drugCatalog();
   const categories=[...new Set(cat.map(d=>d.category))].sort((a,b)=>a.localeCompare(b,"es"));
   const ixRules=interactionRules();
   const catColor=(c:string):[string,string]=>c.startsWith("Antibiótico")?["#E6F6EE",P.greenOnPale]:c.startsWith("AINE")||c.startsWith("Salicilato")?["#E7EEFB",P.blueOnPale]:c.startsWith("Analgésico")?["#EEEBFD",P.purpleOnPale]:c.startsWith("Antidiabético")?["#FBF0DC",P.amberOnPale]:c.includes("antihipertensivo")?["#FDECEE",P.redOnPale]:c.startsWith("Antidepresivo")||c.startsWith("Serotoninérgico")?["#F3EAFB","#9333EA"]:c.startsWith("Anticoagulante")?["#FCE9E4","#C2410C"]:c.startsWith("Diurético")?["#E0F7FA",P.cyan]:c.startsWith("Opioide")?["#F1F1F4",P.muted]:["#EEF0F5","#6B7391"];
   const mq=medQuery.trim().toLowerCase();
   const catFiltered=cat.filter(d=>(!mq||d.ingredient.includes(mq)||d.category.toLowerCase().includes(mq)||d.classes.some(cl=>cl.toLowerCase().includes(mq)))&&(!medCat||d.category===medCat)&&(!medOnlyMon||d.monitoring.length>0)&&(!medOnlyRenal||!!d.renal));
   const selDrug:DrugCatalogItem|null=cat.find(d=>d.code===medSel)??null;
   const kClases=categories.length,kMon=cat.filter(d=>d.monitoring.length>0).length,kRenal=cat.filter(d=>d.renal).length;
   // Interconexión real: llevar el principio activo al formulario de prescripción del expediente (con barreras de seguridad).
   const prescribe=(ingredient:string)=>{setRxDrug(ingredient);setView("exp");setTimeout(()=>scrollToSection("Medicación"),0);};
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:P.muted,fontWeight:600,padding:"12px 14px",borderBottom:`1px solid ${LINE}`};
   const td:React.CSSProperties={padding:"11px 14px",borderBottom:`1px solid #F2F4F9`,fontSize:13,verticalAlign:"top"};
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7zM7 8l6 6"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Medicamentos</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Catálogo de principios activos con sus reglas de seguridad (monitoreo, ajuste renal, interacciones). Prescribe desde aquí con verificación en el expediente.</p></div></div>
     <button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Medicación"),0);}}>+ Prescribir en el expediente →</button>
    </div>
    <div style={{display:"flex",gap:2,marginTop:14,borderBottom:`1px solid ${LINE}`,overflowX:"auto"}}>{MTABS.map(([k,l,d])=><button key={k} onClick={()=>setMedTab(k)} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",fontSize:13.5,fontWeight:medTab===k?700:500,color:medTab===k?P.purple:P.muted,cursor:"pointer",borderBottom:medTab===k?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,fontFamily:UI,whiteSpace:"nowrap"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={d}/></svg>{l}</button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#EEEBFD",P.purple,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z")}<div><div style={{fontSize:22,fontWeight:800}}>{cat.length}</div><div style={{fontSize:11.5,color:P.muted}}>Principios activos</div></div></div>
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M4 7h16M4 12h16M4 17h10")}<div><div style={{fontSize:22,fontWeight:800}}>{kClases}</div><div style={{fontSize:11.5,color:P.muted}}>Clases terapéuticas</div></div></div>
     <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0")}<div><div style={{fontSize:22,fontWeight:800}}>{kMon}</div><div style={{fontSize:11.5,color:P.muted}}>Con monitoreo obligado</div></div></div>
     <div style={kcard}>{kico("#FDECEE",P.red,"M12 4l9 15.5H3zM12 10v4M12 17h.01")}<div><div style={{fontSize:22,fontWeight:800}}>{kRenal}</div><div style={{fontSize:11.5,color:P.muted}}>Con alerta renal por TFG</div></div></div>
     <div style={kcard}>{kico("#F3EAFB","#9333EA","M8 8a4 4 0 118 0M8 16a4 4 0 108 0M12 8v8")}<div><div style={{fontSize:22,fontWeight:800}}>{ixRules.length}</div><div style={{fontSize:11.5,color:P.muted}}>Reglas de interacción</div></div></div>
    </div>
    {medTab==="interacciones"?(()=>{
     // ===== Pestaña "Interacciones" (S8.3) — verificador de conjunto REAL cableado a POST /api/v1/interactions =====
     const IX_FACTORS=["Consumo de alcohol","Insuficiencia renal","Insuficiencia hepática","Embarazo","Adulto mayor"];
     const sevSty:Record<IxSev,{bg:string;bd:string;fg:string}>={CONTRAINDICATED:{bg:"#FBE3E6",bd:"#E79AA3",fg:P.redOnPale},MAJOR:{bg:"#FDECEE",bd:"#F4B5BE",fg:P.redOnPale},MODERATE:{bg:"#FBF0DC",bd:"#EBD2A0",fg:P.amberOnPale},MINOR:{bg:"#E7EEFB",bd:"#C5D6F2",fg:P.blueOnPale}};
     // El orden clínico y las etiquetas vienen de shared.tsx: son los mismos que usa `parseIxResult` para derivar el conteo.
     // Tenerlos dos veces es como tener dos parsers de presión arterial (R03-16): un día uno de los dos se queda atrás.
     const SEV_ORDER=IX_SEVERITIES,SEV_L=IX_SEV_LABEL;
     const addDrug=()=>{const v=ixInput.trim();if(!v)return;if(!ixDrugs.some(d=>d.toLowerCase()===v.toLowerCase()))setIxDrugs([...ixDrugs,v]);setIxInput("");setIxRes(null);};
     const rmDrug=(d:string)=>{setIxDrugs(ixDrugs.filter(x=>x!==d));setIxRes(null);};
     const toggleF=(f:string)=>{setIxFactors(ixFactors.includes(f)?ixFactors.filter(x=>x!==f):[...ixFactors,f]);setIxRes(null);};
     // Auditoría R05a (WS1-12): el fallo se DICE. Antes no había mensaje ni `catch`: un 400 o un fallo de red dejaban la
     // pantalla igual que un «sin interacciones», que es la lectura más peligrosa posible en un verificador de interacciones.
     const run=async()=>{setIxBusy(true);setIxMsg(null);setIxRes(null);
      try{
       const r=await apiRequest("/api/v1/interactions",{method:"POST",body:{drugs:ixDrugs,factors:ixFactors}});
       // Auditoría R05b (lote 15): esto era `r.body as unknown as IxResult`. Ver `parseIxResult` en shared.tsx: un 200 con
       // otra forma pasaba el casteo y reventaba el render al leer `ixRes.counts[s]` de un `undefined` —pantalla en blanco
       // en el verificador de interacciones—. Una respuesta que no cumple la forma es un fallo, y se dice como tal.
       if(r.status===200){
        const v=parseIxResult(r.body);
        if(v)setIxRes(v);
        else setIxMsg("No se pudo verificar: el motor respondió en un formato que esta pantalla no reconoce. No hay veredicto de interacciones para este conjunto.");
        return;
       }
       setIxMsg(`No se pudo verificar: ${errMsg(r)}. No hay veredicto de interacciones para este conjunto.`);
      }catch(e){setIxMsg(`No se pudo verificar: ${userMessage(e)}. No hay veredicto de interacciones para este conjunto.`);}
      finally{setIxBusy(false);}};
     const fld:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 8px",textTransform:"uppercase",letterSpacing:".03em"};
     return <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-med2">
      {/* — Columna de entrada — */}
      <div style={{...card2,padding:18,display:"flex",flexDirection:"column",gap:16}}>
       <div>
        <div style={fld}>Medicamentos a evaluar</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
         {ixDrugs.length===0&&<span style={{fontSize:13,color:P.muted}}>Agrega dos o más medicamentos.</span>}
         {ixDrugs.map(d=><span key={d} style={{display:"inline-flex",alignItems:"center",gap:7,background:"#EEEBFD",color:P.purple,borderRadius:8,padding:"6px 10px",fontSize:13,fontWeight:600}}>{d}<button onClick={()=>rmDrug(d)} aria-label={`Quitar ${d}`} style={{border:0,background:"transparent",color:P.purple,cursor:"pointer",fontSize:14,lineHeight:1,padding:0,fontFamily:UI}}>×</button></span>)}
        </div>
        <div style={{display:"flex",gap:8}}>
         <input value={ixInput} onChange={e=>setIxInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addDrug();}} placeholder="Ej. Sertralina, Ibuprofeno…" style={{flex:1,border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,fontFamily:UI,color:P.ink}}/>
         <button onClick={addDrug} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:9,padding:"9px 14px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Agregar</button>
        </div>
       </div>
       <div>
        <div style={fld}>Factores del paciente</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
         {IX_FACTORS.map(f=>{const on=ixFactors.includes(f);return <button key={f} onClick={()=>toggleF(f)} style={{display:"inline-flex",alignItems:"center",gap:6,border:on?`1px solid ${P.purple}`:`1px solid ${LINE}`,background:on?"#EEEBFD":P.white,color:on?P.purple:P.muted,borderRadius:20,padding:"7px 12px",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:UI}}><span style={{width:14,height:14,borderRadius:4,border:on?"0":"1.5px solid #C7CCE0",background:on?P.purple:"transparent",color:"#fff",display:"grid",placeItems:"center",fontSize:9}}>{on?"✓":""}</span>{f}</button>;})}
        </div>
       </div>
       <button onClick={run} disabled={ixBusy||ixDrugs.length<2} style={{border:0,background:ixDrugs.length<2?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"12px 16px",fontWeight:700,fontSize:14,cursor:ixDrugs.length<2?"default":"pointer",fontFamily:UI,opacity:ixBusy?.7:1}}>{ixBusy?"Analizando…":"Verificar interacciones"}</button>
       <div style={{fontSize:11.5,color:P.muted,lineHeight:1.5}}>Motor determinista por clase farmacológica y factores del paciente. Sin IA. La verificación no bloquea la prescripción; es una consulta previa.</div>
      </div>
      {/* — Columna de resultados — */}
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{padding:"14px 18px",borderBottom:`1px solid ${LINE}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{fontWeight:700,fontSize:15}}>Resultado del análisis</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{SEV_ORDER.map(s=><span key={s} style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11.5,color:P.muted}}><span style={{width:10,height:10,borderRadius:3,background:sevSty[s].fg}}/>{SEV_L[s]}{ixRes?` · ${ixRes.counts[s]}`:""}</span>)}</div>
       </div>
       <div style={{padding:18}}>
        {/* R05a/WS1-12: el fallo se distingue de «sin análisis todavía». Un verificador de interacciones que calla
            después de pulsar «Verificar» se lee como «no hay interacciones»: la lectura más peligrosa. */}
        {ixMsg&&!ixBusy&&<div role="alert" style={{margin:16,padding:"12px 14px",border:"1px solid #F0DBB8",background:"#FFF4E5",color:P.amberOnPale,borderRadius:10,fontSize:13,fontWeight:600}}>{ixMsg}</div>}
        {!ixRes&&!ixBusy&&!ixMsg&&<div style={{padding:"48px 20px",textAlign:"center",color:P.muted}}><div style={{fontSize:32,marginBottom:8}}>🔎</div><div style={{fontSize:14,fontWeight:600,color:P.ink}}>Sin análisis todavía</div><p style={{fontSize:13,maxWidth:360,margin:"6px auto 0"}}>Agrega los medicamentos (y factores del paciente) y pulsa «Verificar interacciones».</p></div>}
        {ixBusy&&<div role="status" aria-busy="true" aria-label="Analizando el conjunto" style={{display:"flex",flexDirection:"column",gap:12}}><Skeleton w={220} h={12}/>{Array.from({length:3}).map((_,i)=><div key={i} style={{border:`1px solid ${LINE}`,borderRadius:12,padding:"14px 16px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><Skeleton w={"45%"} h={14}/><Skeleton w={72} h={20} r={20}/></div><Skeleton w={"90%"} h={11} style={{marginTop:10}}/><Skeleton w={"80%"} h={11} style={{marginTop:6}}/></div>)}</div>}
        {ixRes&&!ixBusy&&<>
         {ixRes.findings.length===0?(
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 18px",borderRadius:12,background:"#E6F6EE",border:"1px solid #BFE6CF"}}><span style={{width:38,height:38,borderRadius:"50%",background:P.greenOnPale,color:"#fff",display:"grid",placeItems:"center",flex:"0 0 auto"}}>✓</span><div><div style={{fontWeight:700,fontSize:14}}>Sin interacciones detectadas</div><div style={{fontSize:13,color:P.muted}}>No se encontraron interacciones ni conflictos por factores para este conjunto.</div></div></div>
         ):(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
           {ixRes.highestSeverity&&<div style={{fontSize:13,color:P.muted}}><b style={{color:P.ink}}>{ixRes.findings.length}</b> hallazgo(s) · severidad máxima <b style={{color:sevSty[ixRes.highestSeverity].fg}}>{ixRes.highestSeverityLabel}</b></div>}
           {ixRes.findings.map((f,i)=>{const st=sevSty[f.severity];return <div key={i} style={{border:`1px solid ${st.bd}`,background:st.bg,borderRadius:12,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
             <div style={{fontWeight:700,fontSize:14,color:P.ink}}>{f.a} <span style={{color:st.fg}}>{f.kind==="factor"?"×":"↔"}</span> {f.b}</div>
             <span style={{background:st.fg,color:"#fff",borderRadius:20,padding:"3px 11px",fontSize:11.5,fontWeight:700,whiteSpace:"nowrap"}}>{f.severityLabel}</span>
            </div>
            <div style={{fontSize:12.5,color:"#4B5168",marginTop:8,lineHeight:1.5}}><b style={{color:P.ink}}>Mecanismo.</b> {f.mechanism}</div>
            <div style={{fontSize:12.5,color:"#4B5168",marginTop:5,lineHeight:1.5}}><b style={{color:P.ink}}>Recomendación.</b> {f.recommendation}</div>
           </div>;})}
          </div>
         )}
         {(ixRes.unresolvedDrugs.length>0||ixRes.unresolvedFactors.length>0)&&<div style={{marginTop:14,padding:"11px 14px",borderRadius:10,background:"#FDF4E6",border:"1px solid #F2E1C0",fontSize:12.5,color:"#7A5A16"}}>No reconocidos en el catálogo de demostración (verificación limitada): {[...ixRes.unresolvedDrugs,...ixRes.unresolvedFactors].join(", ")}.</div>}
        </>}
       </div>
      </div>
     </div>;
    })():medTab==="alertas"?(()=>{
     // ===== Pestaña "Alertas" — motor determinista de seguridad (reglas REALES del catálogo), sin IA =====
     const sev=(s:string):[string,string]=>s==="MAJOR"?["#FDECEE",P.redOnPale]:["#FBF0DC",P.amberOnPale];
     const monDrugs=cat.filter(d=>d.monitoring.length>0);
     const renalDrugs=cat.filter(d=>d.renal);
     return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-med2">
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{padding:"14px 16px",borderBottom:`1px solid ${LINE}`,fontWeight:700,fontSize:15}}>Interacciones por clase ({ixRules.length})</div>
       <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Clase A","Clase B","Severidad","Efecto"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
        {ixRules.map((r,i)=>{const[bg,fg]=sev(r.severity);return <tr key={i}><td style={{...td,fontWeight:600}}>{r.classA}</td><td style={{...td,fontWeight:600}}>{r.classB}</td><td style={td}><span style={{fontSize:10.5,fontWeight:700,borderRadius:999,padding:"2px 9px",background:bg,color:fg}}>{r.severity==="MAJOR"?"Mayor (bloquea)":"Moderada"}</span></td><td style={{...td,color:P.muted}}>{r.note}</td></tr>;})}
       </tbody></table></div>
       <div style={{padding:"12px 16px",fontSize:11.5,color:P.muted,borderTop:`1px solid ${LINE}`}}>Estas reglas alimentan las barreras de prescripción del expediente (verificación previa a recetar). Motor determinista por clase farmacológica; sin IA.</div>
      </div>
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{padding:"14px 16px",borderBottom:`1px solid ${LINE}`,fontWeight:700,fontSize:15}}>Vigilancia obligada</div>
       <div style={{padding:"6px 16px 14px"}}>
        <div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"10px 0 6px"}}>Requieren monitoreo ({monDrugs.length})</div>
        {monDrugs.map(d=><div key={d.code} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:`1px solid #F2F4F9`,fontSize:12.5}}><span style={{width:8,height:8,borderRadius:"50%",background:P.amber,flex:"0 0 auto"}}/><b style={{textTransform:"capitalize",minWidth:110}}>{d.ingredient}</b><span style={{color:P.muted}}>{d.monitoring.map(m=>m.test).join(", ")} · c/{d.monitoring[0]!.dueInDays} d</span></div>)}
        <div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"14px 0 6px"}}>Contraindicación / precaución renal por TFG ({renalDrugs.length})</div>
        {renalDrugs.map(d=><div key={d.code} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:`1px solid #F2F4F9`,fontSize:12.5}}><span style={{width:8,height:8,borderRadius:"50%",background:P.red,flex:"0 0 auto"}}/><b style={{textTransform:"capitalize",minWidth:110}}>{d.ingredient}</b><span style={{color:P.muted}}>{d.renal!.blockBelow?`Contraindicada si TFG<${d.renal!.blockBelow}`:""}{d.renal!.cautionBelow?` · precaución <${d.renal!.cautionBelow}`:""}</span></div>)}
       </div>
      </div>
     </div>;
    })():medTab!=="catalogo"?(
     <div style={{...card2,marginTop:16,padding:"48px 20px",textAlign:"center"}}><div style={{fontSize:16,fontWeight:700}}>{MTABS.find(t=>t[0]===medTab)?.[1]}</div><p style={{color:P.muted,fontSize:14,maxWidth:560,margin:"8px auto 0"}}>{medTab==="reportes"?"Los reportes de prescripción requieren un registro de medicamentos por consultorio (agregado por clase/fármaco). El motor de prescripción y sus barreras ya son reales en el expediente; el tablero analítico se conecta cuando exista ese registro clínica-wide.":"Las plantillas y prescripciones rápidas necesitan un almacén de plantillas por médico (aún no implementado). Hoy la prescripción real —con verificación de alergia, duplicidad, interacción, contraindicación y dosis— se hace en el expediente del paciente."}</p><button style={{marginTop:14,border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 16px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Medicación"),0);}}>Ir a prescribir en el expediente →</button></div>
    ):(
    <div style={{display:"grid",gridTemplateColumns:"250px 1fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-med2">
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:15,fontWeight:700}}>Filtros</span><span style={{color:P.blue,fontSize:12.5,fontWeight:600,cursor:"pointer"}} {...act(()=>{setMedQuery("");setMedCat("");setMedOnlyMon(false);setMedOnlyRenal(false);})}>Limpiar</span></div>
      <div style={{display:"flex",alignItems:"center",gap:8,border:`1px solid ${LINE}`,borderRadius:9,padding:"8px 11px",margin:"12px 0"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input value={medQuery} onChange={e=>setMedQuery(e.target.value)} placeholder="Buscar principio activo o clase…" style={{border:0,outline:"none",fontSize:12.5,fontFamily:UI,color:P.ink,width:"100%",background:"transparent"}}/></div>
      <div style={flbl}>Categoría terapéutica</div><select value={medCat} onChange={e=>setMedCat(e.target.value)} style={selSty}><option value="">Todas</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
      <div style={{...flbl,marginTop:14}}>Seguridad</div>
      <Check checked={medOnlyMon} label="Solo con monitoreo obligado" onChange={()=>setMedOnlyMon(v=>!v)}/>
      <Check checked={medOnlyRenal} label="Solo con alerta renal por TFG" onChange={()=>setMedOnlyRenal(v=>!v)}/>
      <div style={{marginTop:14,padding:"11px 12px",borderRadius:10,background:"#F7F6FE",fontSize:12,color:P.muted,lineHeight:1.5}}><b style={{color:P.ink}}>Catálogo determinista.</b> Principio activo, clases y reglas de seguridad reales (packages/drug-catalog). Subconjunto de demostración; el vademécum oficial (RxNorm/COFEPRIS) se cargaría de la fuente autorizada.</div>
     </div>
     <div>
      <div style={{...card2,overflow:"hidden"}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 16px 10px"}}><span style={{fontSize:17,fontWeight:700}}>Principios activos ({catFiltered.length})</span></div>
       <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["Principio activo","Clases","Categoría","Seguridad","Acción"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{catFiltered.length===0?(
         <tr><td colSpan={5} style={{...td,textAlign:"center",color:P.muted,padding:"36px 14px"}}>Ningún principio activo coincide con el filtro.</td></tr>
        ):catFiltered.map(d=>{const[bg,fg]=catColor(d.category);const on=medSel===d.code;return <tr key={d.code} style={{cursor:"pointer",background:on?"#F6F5FE":"transparent"}} {...actRow(()=>setMedSel(on?null:d.code))}>
         <td style={td}><div style={{fontWeight:700,textTransform:"capitalize"}}>{d.ingredient}</div></td>
         <td style={td}><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{d.classes.map(cl=><span key={cl} style={{fontSize:10,fontWeight:600,borderRadius:6,padding:"2px 6px",background:"#EEF0F5",color:P.muted}}>{cl}</span>)}</div></td>
         <td style={td}><span style={{fontSize:11.5,fontWeight:600,borderRadius:999,padding:"3px 11px",background:bg,color:fg}}>{d.category}</span></td>
         <td style={td}><div style={{display:"flex",gap:6}}>{d.monitoring.length>0&&<span title="Requiere monitoreo" style={{fontSize:14}}>🔬</span>}{d.renal&&<span title="Alerta renal por TFG" style={{fontSize:14}}>⚠️</span>}{d.monitoring.length===0&&!d.renal&&<span style={{color:"#C7CCE0"}}>—</span>}</div></td>
         <td style={td}><span style={{color:P.purple,fontWeight:700,fontSize:12,cursor:"pointer"}} {...act(ev=>{ev.stopPropagation();prescribe(d.ingredient);})}>Prescribir →</span></td>
        </tr>;})}</tbody>
       </table></div>
      </div>
      {selDrug&&<div style={{...card2,marginTop:14,padding:16}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontSize:16,fontWeight:800,textTransform:"capitalize"}}>{selDrug.ingredient}</div><div style={{fontSize:12.5,color:P.muted}}>{selDrug.category}</div></div><button style={{border:0,background:P.purple,color:"#fff",borderRadius:9,padding:"8px 14px",fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:UI}} onClick={()=>prescribe(selDrug.ingredient)}>Prescribir →</button></div>
       <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>{selDrug.classes.map(cl=><span key={cl} style={{fontSize:11,fontWeight:600,borderRadius:7,padding:"3px 9px",background:"#EEEBFD",color:P.purple}}>{cl}</span>)}</div>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}} className="mos-med2">
        <div><div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Monitoreo obligado</div>{selDrug.monitoring.length===0?<div style={{fontSize:12.5,color:P.muted}}>Sin regla de monitoreo conocida.</div>:selDrug.monitoring.map((m,i)=><div key={i} style={{fontSize:12.5,padding:"5px 0",borderBottom:i<selDrug.monitoring.length-1?`1px solid #F2F4F9`:"0"}}><b>{m.test}</b> · cada {m.dueInDays} días<div style={{color:P.muted}}>{m.note}</div></div>)}</div>
        <div><div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Función renal (TFG)</div>{!selDrug.renal?<div style={{fontSize:12.5,color:P.muted}}>Sin ajuste renal conocido.</div>:<div style={{fontSize:12.5}}>{selDrug.renal.blockBelow&&<div style={{color:P.red,fontWeight:600}}>Contraindicada si TFG &lt; {selDrug.renal.blockBelow}</div>}{selDrug.renal.cautionBelow&&<div style={{color:P.amber,fontWeight:600}}>Precaución si TFG &lt; {selDrug.renal.cautionBelow}</div>}<div style={{color:P.muted,marginTop:4}}>{selDrug.renal.note}</div></div>}</div>
       </div>
       {(()=>{const rel=ixRules.filter(r=>selDrug.classes.includes(r.classA)||selDrug.classes.includes(r.classB));return rel.length>0&&<div style={{marginTop:14}}><div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Interacciones de sus clases ({rel.length})</div>{rel.map((r,i)=><div key={i} style={{fontSize:12.5,padding:"5px 0",color:"#4B5168"}}><b>{r.classA} ↔ {r.classB}</b> <span style={{color:r.severity==="MAJOR"?P.red:P.amber,fontWeight:700}}>{r.severity==="MAJOR"?"Mayor":"Moderada"}</span> — {r.note}</div>)}</div>;})()}
       <div style={{marginTop:12,fontSize:11.5,color:P.muted}}>La verificación completa (contra las alergias, medicación activa y problemas del paciente) se ejecuta al prescribir en el expediente.</div>
      </div>}
     </div>
    </div>)}
   </div>;
  
}
