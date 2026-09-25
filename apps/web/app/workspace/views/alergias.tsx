"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "alergias" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.

import{Check,edadDe,card,P,LINE,UI,actRow,scrollToSection,type AllergenType}from"../shared";
import{allergyCrossReactivity}from"../../../../../packages/drug-catalog/src";
import{useWorkspace}from"../context";
export default function AlergiasView(){
 const{alergReg,alergOnlyActive,alergOnlySevere,alergType,alergSearch,alergSel,setAlgNew,setAlgMsg,algNew,algMsg,algForm,setAlgForm,patientList,createAllergyInline,algBusy,setAlergSearch,setAlergType,setAlergOnlySevere,setAlergOnlyActive,setAlergSel,selectPatientRaw,setView}=useWorkspace();

   // ===== MÓDULO ALERGIAS (S-ALERGIAS) — registro clínica-wide cableado a GET /api/v1/allergies =====
   const card2:React.CSSProperties={...card,marginTop:0};
   type ARow={id:string;pid:string;name:string;age:string;substance:string;type:AllergenType;reaction:string;sevKey:"Grave"|"Moderada"|"Leve"|"Incierta";estado:string;active:boolean;severe:boolean;exp:string;date:string;by:string;notes:string};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const SEV_KEY:Record<string,"Grave"|"Moderada"|"Leve">={SEVERE:"Grave",MODERATE:"Moderada",MILD:"Leve"};
   const fmtDate=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"})+", "+d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});};
   const alergLoaded=!!alergReg;
   // Registro clínica-wide REAL (GET /api/v1/allergies); sin datos de ejemplo.
   const allRows:ARow[]=(alergReg?.items??[]).map((it,i)=>({id:it.allergyId||`a${i}`,pid:it.patientId,name:it.patientName,age:edadDe(patientList,it.patientId),substance:it.substance,type:it.type,reaction:it.reaction,sevKey:SEV_KEY[it.severity]??"Leve",estado:it.statusLabel,active:it.status==="ACTIVE",severe:it.severity==="SEVERE",exp:it.patientId.slice(0,8).toUpperCase(),date:fmtDate(it.recordedAt),by:it.registeredBy?"Médico tratante":"—",notes:it.reaction}));
   // Filtros (cliente): búsqueda, tipo, solo activas, solo graves
   const rows=allRows.filter(r=>(!alergOnlyActive||r.active)&&(!alergOnlySevere||r.severe)&&(alergType==="Todos"||r.type===alergType)&&(!alergSearch||`${r.name} ${r.substance}`.toLowerCase().includes(alergSearch.toLowerCase())));
   const sel:ARow|null=rows[alergSel]??rows[0]??null;
   // KPIs + gráficas desde datos reales (0 si el registro está vacío).
   const total=alergReg?.total??0;
   const patients=alergReg?.patientsWithAllergies??0;
   const cGrave=alergReg?.bySeverity.grave??0,cMod=alergReg?.bySeverity.moderada??0,cLeve=alergReg?.bySeverity.leve??0,cInc=alergReg?.bySeverity.incierta??0;
   const pct=(n:number)=>total?Math.round(n/total*100):0;
   const T=alergReg?.byType??{Medicamento:0,Alimento:0,Ambiental:0,Contraste:0,Otros:0};
   const typeSegs:[AllergenType,string,number][]=[["Medicamento",P.redOnPale,T.Medicamento],["Alimento",P.purpleOnPale,T.Alimento],["Ambiental",P.amberOnPale,T.Ambiental],["Contraste",P.cyan,T.Contraste],["Otros",P.muted,T.Otros]];
   let acc=0;const stops=typeSegs.map(([,c,n])=>{const a=total?acc/total*100:0;acc+=n;const b=total?acc/total*100:0;return `${c} ${a}% ${b}%`;}).join(",");
   const sevBadge=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={Grave:["#FDECEE",P.redOnPale],Moderada:["#FBF0DC",P.amberOnPale],Leve:["#E6F6EE",P.greenOnPale],Incierta:["#EEF1F7",P.muted]};const[bg,fg]=m[k]??m.Leve!;return{background:bg,color:fg,borderRadius:16,padding:"3px 11px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"};};
   const estadoBadge=(active:boolean):React.CSSProperties=>({background:active?"#E6F6EE":"#EEF1F7",color:active?P.greenOnPale:P.muted,borderRadius:16,padding:"3px 11px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"});
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:P.muted,fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`};
   const td:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:13,verticalAlign:"middle"};
   const kico=(bg:string,fg:string,d:string)=><span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:16,display:"flex",gap:13,alignItems:"center"};
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"14px 0 6px"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   // R05b-09: casilla REAL (input type=checkbox accesible), declarada una vez en shared.
   const chk=(on:boolean,l:string,tog:()=>void)=><Check key={l} checked={on} label={l} onChange={tog}/>;
   // Auditoría R05b-07: la reactividad cruzada la determina el CATÁLOGO (el mismo motor que bloquea prescripciones), no un
   // regex de siete palabras sobre texto libre. Antes la pantalla decía «evitar sulfonamidas» y el catálogo documenta lo
   // contrario (R03-24: no se propaga a furosemida ni tiazidas); dos fuentes para el mismo hecho clínico, ya discrepando.
   const cruzada=sel?allergyCrossReactivity(sel.substance):null;
   return <div style={{padding:"18px 24px 40px"}}>
    {/* Encabezado */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Alergias</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Gestiona y da seguimiento a las alergias de tus pacientes. Mejor seguridad, mejores decisiones.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setAlgNew(v=>!v);setAlgMsg(null);}}>{algNew?"Cerrar":"+ Nueva alergia"}</button>
     </div>
    </div>
    {algMsg&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:10,background:algMsg.includes("registrada")?"#F0FBF4":"#EEF6FF",border:`1px solid ${algMsg.includes("registrada")?"#CDEBD8":"#CFE0F7"}`,borderRadius:10,padding:"10px 14px",fontSize:13}}><span style={{color:algMsg.includes("registrada")?P.green:P.blue,fontWeight:700}}>{algMsg.includes("registrada")?"✓":"ℹ"}</span><span style={{flex:1}}>{algMsg}</span><button onClick={()=>setAlgMsg(null)} style={{border:0,background:"transparent",color:P.muted,cursor:"pointer",fontFamily:UI,fontSize:14}}>×</button></div>}
    {algNew&&<div style={{...card2,marginTop:14,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>Nueva alergia</div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}} className="mos-med2">
      <div><div style={flbl}>Paciente</div><select value={algForm.patientId} onChange={e=>setAlgForm({...algForm,patientId:e.target.value})} style={selSty}><option value="">Selecciona…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select></div>
      <div><div style={flbl}>Sustancia</div><input value={algForm.substance} onChange={e=>setAlgForm({...algForm,substance:e.target.value})} placeholder="Ej. Penicilina, Mariscos, Látex" style={selSty}/></div>
      <div><div style={flbl}>Severidad</div><select value={algForm.severity} onChange={e=>setAlgForm({...algForm,severity:e.target.value})} style={selSty}>{[["SEVERE","Grave"],["MODERATE","Moderada"],["MILD","Leve"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
     </div>
     <div style={{marginTop:12}}><div style={flbl}>Reacción</div><input value={algForm.reaction} onChange={e=>setAlgForm({...algForm,reaction:e.target.value})} placeholder="Ej. Urticaria, Anafilaxia, Broncoespasmo" style={selSty}/></div>
     <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>{["Urticaria","Exantema","Broncoespasmo","Anafilaxia","Rinitis","Prurito"].map(rx=><button key={rx} onClick={()=>setAlgForm(f=>({...f,reaction:rx}))} style={algForm.reaction===rx?{border:`1px solid ${P.purple}`,background:"#EEEBFD",color:P.purple,borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:UI}:{border:`1px solid ${LINE}`,background:P.white,color:P.ink,borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:UI}}>{rx}</button>)}</div>
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void createAllergyInline()} disabled={algBusy||!algForm.patientId||!algForm.substance.trim()} style={{border:0,background:(algBusy||!algForm.patientId||!algForm.substance.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(algBusy||!algForm.patientId||!algForm.substance.trim())?"default":"pointer",fontFamily:UI}}>{algBusy?"Registrando…":"Registrar alergia"}</button><button onClick={()=>setAlgNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    {/* KPIs */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#E7EEFB",P.blue,"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z")}<div><div style={{fontSize:24,fontWeight:800}}>{patients}</div><div style={{fontSize:11.5,color:P.muted}}>Pacientes con alergias registradas</div></div></div>
     <div style={kcard}>{kico("#FDECEE",P.red,"M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01")}<div><div style={{fontSize:24,fontWeight:800}}>{cGrave}</div><div style={{fontSize:11.5,color:P.muted}}>Alergias graves ({pct(cGrave)}%)</div></div></div>
     <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 9v4M12 17h.01M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{cMod}</div><div style={{fontSize:11.5,color:P.muted}}>Con reacción moderada ({pct(cMod)}%)</div></div></div>
     <div style={kcard}>{kico("#E6F6EE",P.greenOnPale,"M20 6L9 17l-5-5")}<div><div style={{fontSize:24,fontWeight:800}}>{cLeve}</div><div style={{fontSize:11.5,color:P.muted}}>Con reacción leve ({pct(cLeve)}%)</div></div></div>
     <div style={kcard}>{kico("#EEF1F7",P.muted,"M9.1 9a3 3 0 115.8 1c0 2-3 2-3 4M12 17h.01M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{cInc}</div><div style={{fontSize:11.5,color:P.muted}}>Alergias inciertas ({pct(cInc)}%)</div></div></div>
    </div>
    {/* Tres columnas: filtros · tabla · detalle */}
    <div style={{display:"grid",gridTemplateColumns:"240px 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-alerg">
     {/* Filtros */}
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:15,fontWeight:700}}>Filtros</div><button onClick={()=>{setAlergSearch("");setAlergType("Todos");setAlergOnlySevere(false);setAlergOnlyActive(false);}} style={{border:0,background:"transparent",color:P.blue,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:UI}}>Limpiar</button></div>
      <div style={{position:"relative",marginTop:10}}><input value={alergSearch} onChange={e=>{setAlergSearch(e.target.value);setAlergSel(0);}} placeholder="Buscar paciente o alérgeno..." style={{...selSty,padding:"9px 11px 9px 32px"}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.muted} strokeWidth="1.9" style={{position:"absolute",left:10,top:11}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div>
      <div style={flbl}>Tipo de alérgeno</div>
      <select value={alergType} onChange={e=>{setAlergType(e.target.value);setAlergSel(0);}} style={selSty}>{["Todos","Medicamento","Alimento","Ambiental","Contraste","Otros"].map(o=><option key={o}>{o}</option>)}</select>
      <div style={{marginTop:14,borderTop:`1px solid ${LINE}`,paddingTop:10}}>
       {chk(alergOnlySevere,"Solo graves",()=>{setAlergOnlySevere(!alergOnlySevere);setAlergSel(0);})}
       {chk(alergOnlyActive,"Solo activas",()=>{setAlergOnlyActive(!alergOnlyActive);setAlergSel(0);})}
      </div>
      <div style={{marginTop:14,fontSize:12,color:P.muted}}>{rows.length} de {allRows.length} alergia(s)</div>
     </div>
     {/* Tabla */}
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",flexWrap:"wrap",gap:10}}>
       <div style={{fontSize:16,fontWeight:800}}>Alergias ({rows.length})</div>
      </div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr><th style={th}>Paciente</th><th style={th}>Alérgeno</th><th style={th}>Tipo</th><th style={th}>Reacción</th><th style={th}>Gravedad</th><th style={th}>Estado</th></tr></thead>
       <tbody>{rows.map((r,i)=>{const on=i===alergSel;return <tr key={r.id} {...actRow(()=>setAlergSel(i))} style={{cursor:"pointer",background:on?"#F7F6FE":"transparent"}}>
        <td style={td}><div style={{display:"flex",alignItems:"center",gap:9}}><span style={{width:30,height:30,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,flex:"0 0 auto"}}>{initials(r.name)}</span><div style={{minWidth:0}}><div style={{fontWeight:600,fontSize:13,whiteSpace:"nowrap"}}>{r.name}</div>{r.age&&<div style={{fontSize:11,color:P.muted}}>{r.age}</div>}</div></div></td>
        <td style={{...td,fontWeight:600}}>{r.substance}</td>
        <td style={{...td,color:P.muted}}>{r.type}</td>
        <td style={td}>{r.reaction}</td>
        <td style={td}><span style={sevBadge(r.sevKey)}>{r.sevKey}</span></td>
        <td style={td}><span style={estadoBadge(r.active)}>{r.estado}</span></td>
       </tr>;})}
       {rows.length===0&&<tr><td colSpan={6} style={{...td,textAlign:"center",color:P.muted,padding:"30px"}}>{alergLoaded?(allRows.length===0?"Sin alergias registradas. Usa «+ Nueva alergia».":"Ninguna alergia coincide con los filtros."):"Cargando registro…"}</td></tr>}
       </tbody>
      </table></div>
      {rows.length>0&&<div style={{padding:"13px 16px",fontSize:13,color:P.muted}}>Mostrando {rows.length} de {allRows.length} alergia(s) del registro</div>}
     </div>
     {/* Detalle */}
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:`1px solid ${LINE}`}}><div style={{fontSize:15,fontWeight:800}}>Detalle de la alergia</div></div>
      {!sel?<div style={{padding:"40px 16px",textAlign:"center",color:P.muted,fontSize:13}}>{allRows.length===0?"Registra una alergia con «+ Nueva alergia».":"Selecciona una alergia de la lista para ver su detalle."}</div>:<div style={{padding:"14px 16px"}}>
       <div style={{display:"flex",gap:11,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:14,fontWeight:700,flex:"0 0 auto"}}>{initials(sel.name)}</span><div><div style={{fontWeight:700,fontSize:14.5}}>{sel.name}</div><div style={{fontSize:11.5,color:P.muted}}>{sel.age||"Paciente"}</div><div style={{fontSize:11.5,color:P.muted}}>Expediente: {sel.exp}</div></div></div>
       <div style={{display:"flex",gap:10,alignItems:"center",marginTop:14}}><span style={{width:38,height:38,borderRadius:10,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7zM7 8l6 6"/></svg></span><div><div style={{fontWeight:700,fontSize:14}}>{sel.substance}</div><div style={{fontSize:12,color:P.muted}}>{sel.type}</div></div></div>
       <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:9}}>
        {[["Fecha de registro",sel.date],["Reacción",sel.reaction]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12.5}}><span style={{color:P.muted}}>{k}</span><span style={{fontWeight:600,textAlign:"right"}}>{v}</span></div>)}
        <div style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12.5,alignItems:"center"}}><span style={{color:P.muted}}>Gravedad</span><span style={sevBadge(sel.sevKey)}>{sel.sevKey}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12.5,alignItems:"center"}}><span style={{color:P.muted}}>Estado</span><span style={estadoBadge(sel.active)}>{sel.estado}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12.5}}><span style={{color:P.muted}}>Registrado por</span><span style={{fontWeight:600,textAlign:"right"}}>{sel.by}</span></div>
        <div style={{fontSize:12.5}}><div style={{color:P.muted,marginBottom:3}}>Notas</div><div style={{lineHeight:1.5}}>{sel.notes}</div></div>
       </div>
       {cruzada&&(cruzada.recognized
        ?<div style={{marginTop:12,display:"flex",gap:9,padding:"11px 13px",borderRadius:11,background:"#FDECEE",border:"1px solid #F6C9D0"}}><span style={{color:P.red,flex:"0 0 auto"}}>⚠</span><div><div style={{fontWeight:700,fontSize:12.5,color:P.redOnPale}}>Reactividad cruzada</div><div style={{fontSize:12,color:P.redOnPale,marginTop:2}}>Evitar {cruzada.avoid.join(", ")}.</div>{cruzada.caveats.map((c,i)=><div key={i} style={{fontSize:11.5,color:P.redOnPale,marginTop:4,opacity:.95}}>{c}</div>)}<div style={{fontSize:11,color:P.redOnPale,marginTop:4,opacity:.8}}>Del catálogo de fármacos: es la misma clasificación que bloquea la prescripción.</div></div></div>
        :<div style={{marginTop:12,display:"flex",gap:9,padding:"11px 13px",borderRadius:11,background:"#FFF4E5",border:"1px solid #F0DBB8"}}><span style={{color:P.amberOnPale,flex:"0 0 auto"}}>⚠</span><div><div style={{fontWeight:700,fontSize:12.5,color:P.amberOnPale}}>Reactividad cruzada no evaluada</div><div style={{fontSize:12,color:P.amberOnPale,marginTop:2}}>El catálogo no reconoce la clase de «{sel!.substance}»: no se puede afirmar con qué familia cruza. Codifique la sustancia o valórelo con la fuente clínica.</div></div></div>)}
       <div style={{display:"flex",gap:10,marginTop:14}}>
        <button onClick={()=>{selectPatientRaw(sel.pid,sel.name);setView("exp");setTimeout(()=>scrollToSection("Alergias"),0);}} style={{flex:1,border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"9px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver en el expediente →</button>
       </div>
      </div>}
     </div>
    </div>
    {/* Fila inferior: gráficas + recomendaciones + accesos */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginTop:16,alignItems:"start"}} className="mos-alerg2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Alergias por tipo de alérgeno</div><div style={{display:"flex",gap:14,alignItems:"center"}}><div style={{width:100,height:100,borderRadius:"50%",flex:"0 0 auto",display:"grid",placeItems:"center",background:total>0?`conic-gradient(${stops})`:"#EEF0F5"}}><div style={{width:64,height:64,borderRadius:"50%",background:P.white,display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:16,fontWeight:800}}>{total}</div><div style={{fontSize:9,color:P.muted}}>Alergias</div></div></div></div><div style={{flex:1}}>{total===0?<div style={{fontSize:12.5,color:P.muted}}>Sin alergias registradas.</div>:typeSegs.map(([l,c,n])=><div key={l} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,padding:"3px 0"}}><span style={{width:8,height:8,borderRadius:"50%",background:c}}/>{l==="Medicamento"?"Medicamentos":l==="Alimento"?"Alimentos":l==="Ambiental"?"Ambientales":l==="Contraste"?"Contrastes":"Otros"}<b style={{marginLeft:"auto"}}>{n} ({pct(n)}%)</b></div>)}</div></div></div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Alergias por gravedad</div>{([["Graves",cGrave,P.redOnPale],["Moderadas",cMod,P.amberOnPale],["Leves",cLeve,P.greenOnPale],["Inciertas",cInc,P.muted]] as [string,number,string][]).map(([l,n,c])=><div key={l} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:4}}><span>{l}</span><b>{n} ({pct(n)}%)</b></div><div style={{height:8,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${pct(n)}%`,background:c,borderRadius:6}}/></div></div>)}</div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:10}}>Recomendaciones</div>{["Verificar alergias antes de prescribir.","Usar alertas en recetas y procedimientos.","Registrar reacciones con el mayor detalle posible.","Educar al paciente sobre signos de alarma.","Revisar historial en cada consulta."].map((r,i)=><div key={i} style={{display:"flex",gap:9,alignItems:"flex-start",padding:"7px 0",fontSize:12.5}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.purple} strokeWidth="1.9" style={{flex:"0 0 auto",marginTop:1}}><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>{r}</div>)}</div>
    </div>
   </div>;
  
}
