"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "problemas" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import {apiRequest} from "../../../lib/session-client";
import{card,P,LINE,UI,errMsg,userMessage,act,actRow,scrollToSection,type IcdEntry}from"../shared";
import{useWorkspace}from"../context";
export default function ProblemasView(){
 const{probScreen,setPfName,setPfCode,setPfResults,setPfDesc,setPfNotes,setPfType,setPfEstado,setPfSev,setPfOnset,pfCode,setPfMsg,patientId,pfOnset,pfEstado,pfNotes,setPfBusy,pfDesc,pfType,pfSev,setProbReg,setProbScreen,pfBusy,pfName,pfResults,pfMsg,probReg,probPlantCat,setProbPlantCat,probStatusF,probSearch,probSel,setProbSearch,setProbStatusF,setProbSel,selectPatientRaw,setView}=useWorkspace();

   // ===== MÓDULO PROBLEMAS (S-PROBLEMAS) — lista clínica-wide cableada + form Nuevo problema + Plantillas =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const flbl:React.CSSProperties={fontSize:12,fontWeight:700,color:P.muted,margin:"14px 0 6px"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const estSty=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={Activo:["#FDECEE","#C9364A"],["En seguimiento"]:["#FBF0DC","#B7791F"],Resuelto:["#E6F6EE","#16A66A"],Inactivo:["#EEF1F7","#6B7191"]};const[bg,fg]=m[k]??m.Activo!;return{background:bg,color:fg,borderRadius:16,padding:"3px 11px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"};};

   // ---------- PANTALLA: NUEVO PROBLEMA (form cableado a CIE-10 + POST /problems) ----------
   if(probScreen==="nuevo"){
    const seg=(on:boolean):React.CSSProperties=>({padding:"9px 14px",fontSize:13,fontWeight:on?700:500,color:on?P.purple:P.muted,background:on?"#EEEBFD":P.white,border:`1px solid ${on?P.purple:LINE}`,borderRadius:9,cursor:"pointer",fontFamily:UI});
    const searchCie=async(q:string)=>{setPfName(q);setPfCode("");if(q.trim().length>=2){try{const r=await apiRequest(`/api/v1/terminology/icd10?q=${encodeURIComponent(q)}`,{method:"GET"});if(r.status===200)setPfResults(((r.body["results"] as IcdEntry[])??[]).slice(0,6));}catch{/* búsqueda no disponible */}}else setPfResults([]);};
    const pick=(e:IcdEntry)=>{setPfName(`${e.code} · ${e.description}`);setPfCode(e.code);setPfResults([]);};
    // Auditoría U-04: TODO lo capturado viaja (tipo, gravedad, fecha de inicio, notas); "Guardar y añadir otro" se queda en el
    // formulario; ambos botones se deshabilitan mientras guarda; "Crónico" y "Resuelto" se registran con sus transiciones.
    const clearPf=()=>{setPfName("");setPfCode("");setPfDesc("");setPfNotes("");setPfType("Agudo");setPfEstado("Activo");setPfSev("Leve");setPfOnset(new Date().toISOString().slice(0,10));};
    const savePf=async(stay=false)=>{
     if(!pfCode){setPfMsg("Selecciona un diagnóstico CIE-10 válido de la lista.");return;}
     if(!patientId){setPfMsg("Selecciona un paciente en el buscador superior para guardar el problema.");return;}
     if(!/^\d{4}-\d{2}-\d{2}$/.test(pfOnset)||pfOnset>new Date().toISOString().slice(0,10)){setPfMsg("La fecha de inicio es obligatoria y no puede ser futura.");return;}
     if(pfEstado==="Resuelto"&&pfNotes.trim().length<5){setPfMsg("Un problema registrado como resuelto necesita una nota que lo documente (mínimo 5 caracteres).");return;}
     setPfBusy(true);setPfMsg("");
     try{
      const problemId=crypto.randomUUID();const now=new Date().toISOString();
      const TYPE:Record<string,"ACUTE"|"CHRONIC"|"RECURRENT">={Agudo:"ACUTE",Crónico:"CHRONIC",Recurrente:"RECURRENT"};const SEV:Record<string,"MILD"|"MODERATE"|"SEVERE">={Leve:"MILD",Moderada:"MODERATE",Grave:"SEVERE"};
      const r=await apiRequest("/api/v1/problems",{method:"POST",body:{problemId,patientId,code:pfCode,...(pfDesc?{description:pfDesc}:{}),problemType:TYPE[pfType],severity:SEV[pfSev],onsetDate:pfOnset,...(pfNotes.trim()?{notes:pfNotes.trim()}:{}),occurredAt:now}});
      if(r.status>=400){setPfMsg(errMsg(r));return;}
      let version=Number(r.body["version"]??1);
      if(pfType==="Crónico"||pfEstado==="Resuelto"){
       const t=pfEstado==="Resuelto"?await apiRequest(`/api/v1/problems/${problemId}/resolution`,{method:"POST",body:{note:pfNotes.trim(),occurredAt:now},ifMatch:version})
                                   :await apiRequest(`/api/v1/problems/${problemId}/chronicity`,{method:"POST",body:{occurredAt:now},ifMatch:version});
       if(t.status>=400){setPfMsg(`El problema se guardó como ACTIVO pero no se pudo marcar como ${pfEstado==="Resuelto"?"resuelto":"crónico"}: ${errMsg(t)}`);return;}
       version=Number(t.body["version"]??version+1);
      }
      setProbReg(null);clearPf();
      if(stay)setPfMsg("Problema guardado. Puede capturar otro.");else setProbScreen("lista");
     }catch(e){setPfMsg(userMessage(e));}finally{setPfBusy(false);}
    };
    const COMMON:[string,string][]=[["E11.9","Diabetes mellitus tipo 2"],["I10","Hipertensión esencial (primaria)"],["J06.9","Infección aguda de vías respiratorias superiores"],["J45.9","Asma, no especificada"],["K29.7","Gastritis, no especificada"],["F41.9","Trastorno de ansiedad generalizada"],["M54.5","Lumbalgia no especificada"],["N39.0","Infección de vías urinarias, sitio no especificado"]];
    return <div style={{padding:"18px 24px 40px"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}><button onClick={()=>setProbScreen("lista")} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI,display:"flex",alignItems:"center",gap:6}}>← Volver</button><div><h1 style={{fontSize:26,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Nuevo problema</h1><p style={{color:P.muted,fontSize:13,margin:"3px 0 0"}}>Registra un nuevo problema de salud en el expediente del paciente.</p></div></div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button onClick={()=>savePf(true)} disabled={pfBusy} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Guardar y añadir otro</button><button onClick={()=>savePf(false)} disabled={pfBusy} style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>{pfBusy?"Guardando…":"✓ Guardar problema"}</button></div>
     </div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:16,marginTop:16,alignItems:"start"}} className="mos-prob-new">
      <div style={{...card2,padding:22}}>
       <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>1. Información del problema</div>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div>
         <div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Nombre del problema / Diagnóstico <span style={{color:P.red}}>*</span></div>
         <div style={{position:"relative"}}>
          <div style={{display:"flex",gap:8}}><input value={pfName} onChange={e=>searchCie(e.target.value)} placeholder="Buscar en CIE-10 o escribir diagnóstico..." style={{...selSty,flex:1}}/><button onClick={()=>searchCie(pfName)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"9px 12px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>⊟ Buscar en CIE-10</button></div>
          {pfResults.length>0&&<div style={{position:"absolute",top:"110%",left:0,right:0,zIndex:5,background:P.white,border:`1px solid ${LINE}`,borderRadius:11,boxShadow:"0 12px 32px rgba(20,30,60,.14)",overflow:"hidden"}}>{pfResults.map(e=><div key={e.code} {...act(()=>pick(e))} style={{display:"flex",gap:12,padding:"11px 14px",cursor:"pointer",borderBottom:`1px solid #F2F4F9`,alignItems:"center"}}><span style={{fontWeight:700,color:P.purple,fontSize:13,minWidth:56}}>{e.code}</span><span style={{fontSize:13}}>{e.description}</span></div>)}</div>}
         </div>
         {pfCode&&<div style={{marginTop:8,fontSize:12,color:P.green,fontWeight:600}}>✓ CIE-10 {pfCode} seleccionado</div>}
         <div style={{fontSize:12.5,fontWeight:700,margin:"18px 0 6px"}}>Descripción clínica</div>
         <textarea value={pfDesc} onChange={e=>setPfDesc(e.target.value.slice(0,1000))} placeholder="Describe el problema, síntomas, evolución, hallazgos relevantes..." style={{...selSty,minHeight:120,resize:"vertical"}}/>
         <div style={{textAlign:"right",fontSize:11,color:P.muted}}>{pfDesc.length}/1000</div>
        </div>
        <div>
         <div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Tipo de problema <span style={{color:P.red}}>*</span></div>
         <div style={{display:"flex",gap:8}}>{(["Agudo","Crónico","Recurrente"] as const).map(t=><button key={t} onClick={()=>setPfType(t)} style={seg(pfType===t)}>{t}</button>)}</div>
         <div style={{fontSize:12.5,fontWeight:700,margin:"18px 0 6px"}}>Fecha de inicio <span style={{color:P.red}}>*</span></div>
         <div style={{display:"flex",gap:10,alignItems:"center"}}><input type="date" aria-label="Fecha de inicio" value={pfOnset} max={new Date().toISOString().slice(0,10)} onChange={e=>setPfOnset(e.target.value)} style={{...selSty,flex:1}}/><label style={{display:"flex",alignItems:"center",gap:6,fontSize:12.5,color:P.muted,whiteSpace:"nowrap"}}><span style={{width:15,height:15,borderRadius:4,border:"1.6px solid #C7CCE0",display:"inline-block"}}/>Fecha aproximada</label></div>
         <div style={{fontSize:12.5,fontWeight:700,margin:"18px 0 6px"}}>Estado actual <span style={{color:P.red}}>*</span></div>
         <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["Activo","Resuelto"].map(s=><button key={s} onClick={()=>setPfEstado(s)} style={seg(pfEstado===s)}>{s}</button>)}</div>
        </div>
       </div>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginTop:20}}>
        <div><div style={flbl}>Gravedad</div><select value={pfSev} onChange={e=>setPfSev(e.target.value)} style={selSty}>{["Leve","Moderada","Grave"].map(o=><option key={o}>{o}</option>)}</select></div>
        <div><div style={flbl}>Prioridad</div><select style={selSty} defaultValue="Normal">{["Normal","Alta","Urgente"].map(o=><option key={o}>{o}</option>)}</select></div>
        <div><div style={flbl}>Categoría</div><select style={selSty} defaultValue=""><option value="">Selecciona una categoría</option>{["Endocrinológicas","Cardiovasculares","Respiratorias","Psiquiátricas","Digestivas"].map(o=><option key={o}>{o}</option>)}</select></div>
       </div>
       <div style={{marginTop:20}}><div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Etiquetas / Palabras clave</div><input placeholder="Agregar etiqueta (presiona Enter)" style={selSty}/><div style={{display:"flex",gap:8,marginTop:8}}>{["síntomas","control","seguimiento"].map(t=><span key={t} style={{display:"inline-flex",alignItems:"center",gap:6,background:"#EEEBFD",color:P.purple,borderRadius:8,padding:"5px 10px",fontSize:12.5,fontWeight:600}}>{t}<span style={{cursor:"pointer"}}>×</span></span>)}</div></div>
       <div style={{marginTop:20}}><div style={{fontSize:12.5,fontWeight:700,marginBottom:6}}>Notas adicionales</div><textarea value={pfNotes} onChange={e=>setPfNotes(e.target.value.slice(0,500))} placeholder="Información adicional, contexto, observaciones..." style={{...selSty,minHeight:90,resize:"vertical"}}/><div style={{textAlign:"right",fontSize:11,color:P.muted}}>{pfNotes.length}/500</div></div>
       {pfMsg&&<div style={{marginTop:14,padding:"11px 14px",borderRadius:10,background:"#FDF4E6",border:"1px solid #F2E1C0",fontSize:13,color:"#7A5A16"}}>{pfMsg}</div>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
       <div style={{...card2,padding:16}}>
        <div style={{fontSize:15,fontWeight:800,marginBottom:10}}>Sugerencias de diagnósticos</div>
        <input onChange={e=>searchCie(e.target.value)} placeholder="Buscar en CIE-10..." style={selSty}/>
        <div style={{display:"flex",gap:14,marginTop:12,borderBottom:`1px solid ${LINE}`,fontSize:12.5}}>{["Más comunes","Recientes","Favoritos"].map((t,i)=><span key={t} style={{padding:"6px 0",fontWeight:i===0?700:500,color:i===0?P.purple:P.muted,borderBottom:i===0?`2px solid ${P.purple}`:"2px solid transparent",cursor:"pointer"}}>{t}</span>)}</div>
        <div style={{marginTop:8}}>{COMMON.map(([c,d])=><div key={c} {...act(()=>pick({code:c,description:d,category:""}))} style={{display:"flex",gap:10,padding:"9px 6px",cursor:"pointer",alignItems:"center",borderRadius:8}}><span style={{fontWeight:700,color:P.purple,fontSize:12.5,minWidth:52}}>{c}</span><span style={{fontSize:12.5}}>{d}</span></div>)}</div>
        <button style={{marginTop:10,width:"100%",border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>⧉ Explorar catálogo CIE-10</button>
       </div>
       <div style={{...card2,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:15,fontWeight:800}}>Problemas recientes en el registro</div><span style={{fontSize:12,color:P.blue,cursor:"pointer"}} {...act(()=>setProbScreen("lista"))}>Ver todos</span></div>
        {(()=>{const fD=(iso:string)=>{const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};const recent=(probReg?.items??[]).slice(0,5);if(recent.length===0)return <div style={{fontSize:12.5,color:P.muted,padding:"8px 0"}}>Aún no hay problemas registrados en el consultorio.</div>;return recent.map(it=><div key={it.problemId} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid #F2F4F9`}}><span style={{width:8,height:8,borderRadius:"50%",background:it.status==="RESOLVED"?"#16A66A":it.statusLabel==="En seguimiento"?"#B7791F":"#C9364A",flex:"0 0 auto"}}/><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13}}>{it.description||it.code}</div><div style={{fontSize:11.5,color:P.muted}}>{it.code} · {it.patientName} · {fD(it.recordedAt)}</div></div><span style={estSty(it.statusLabel)}>{it.statusLabel}</span></div>);})()}
       </div>
       <div style={{...card2,padding:16,background:"#F7F6FE",borderColor:"#E2DEFB"}}><div style={{display:"flex",gap:10}}><span style={{color:P.purple}}>💡</span><div><div style={{fontWeight:700,fontSize:13}}>Tip</div><div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Usa diagnósticos específicos con código CIE-10 para un mejor seguimiento, estadísticas y generación de reportes.</div></div></div></div>
      </div>
     </div>
    </div>;
   }

   // ---------- PANTALLA: PLANTILLAS DE PROBLEMAS (catálogo) ----------
   if(probScreen==="plantillas"){
    const CAT_NAMES=["Todas las plantillas","Cardiovasculares","Endocrinológicas","Respiratorias","Digestivas","Neurológicas","Psiquiátricas","Ginecológicas","Pediátricas","Infecciosas","Dermatológicas","Musculoesqueléticas","Genitourinarias","Oncológicas","Oftalmológicas","Otorrinolaringológicas","Hematológicas","Otros"] as const;
    type Tpl={name:string;code:string;desc:string;cat:string;fav:boolean};
    const TPLS:Tpl[]=[
     {name:"Diabetes mellitus tipo 2",code:"E11.9",desc:"Enfermedad crónica metabólica con hiperglucemia.",cat:"Endocrinológicas",fav:true},
     {name:"Hipertensión arterial",code:"I10",desc:"Elevación persistente de la presión arterial.",cat:"Cardiovasculares",fav:true},
     {name:"Asma",code:"J45.9",desc:"Enfermedad inflamatoria crónica de la vía aérea.",cat:"Respiratorias",fav:false},
     {name:"Depresión",code:"F32.9",desc:"Trastorno del estado de ánimo.",cat:"Psiquiátricas",fav:false},
     {name:"Ansiedad generalizada",code:"F41.1",desc:"Trastorno de ansiedad crónica.",cat:"Psiquiátricas",fav:false},
     {name:"Gastritis",code:"K29.7",desc:"Inflamación de la mucosa gástrica.",cat:"Digestivas",fav:false},
     {name:"IVU (cistitis)",code:"N30.0",desc:"Infección del tracto urinario no complicada.",cat:"Genitourinarias",fav:false},
     {name:"Rinitis alérgica",code:"J30.9",desc:"Inflamación nasal por alérgenos.",cat:"Respiratorias",fav:false},
     {name:"Dermatitis atópica",code:"L20.9",desc:"Enfermedad inflamatoria crónica de la piel.",cat:"Dermatológicas",fav:false},
     {name:"SOP",code:"E28.2",desc:"Síndrome de ovario poliquístico.",cat:"Ginecológicas",fav:false},
     {name:"Hipercolesterolemia",code:"E78.0",desc:"Elevación del colesterol total en sangre.",cat:"Cardiovasculares",fav:false},
     {name:"Obesidad",code:"E66.9",desc:"Exceso de grasa corporal (IMC ≥ 30).",cat:"Endocrinológicas",fav:false},
    ];
    // Conteos reales por categoría, derivados de TPLS (sin cifras de maqueta; auditoría U-11).
    const CATS:[string,number][]=CAT_NAMES.map(c=>[c,c==="Todas las plantillas"?TPLS.length:TPLS.filter(x=>x.cat===c).length]);
    const tpls=TPLS.filter(t=>probPlantCat==="Todas las plantillas"||t.cat===probPlantCat);
    const selT=tpls[0]??TPLS[0]!;
    const useTpl=(t:Tpl)=>{setPfName(`${t.code} · ${t.name}`);setPfCode(t.code);setPfType("Crónico");setProbScreen("nuevo");};
    return <div style={{padding:"18px 24px 40px"}}>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}><button onClick={()=>setProbScreen("lista")} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"9px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>← Volver</button><div><h1 style={{fontSize:26,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Plantillas de problemas</h1><p style={{color:P.muted,fontSize:13,margin:"3px 0 0"}}>Utiliza plantillas predefinidas para registrar problemas de salud de forma rápida y estandarizada.</p></div></div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 16px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>+ Nueva plantilla</button><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>↥ Importar/Exportar ▾</button></div>
     </div>
     <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap",alignItems:"center"}}><input placeholder="Buscar plantilla por nombre, CIE-10 o palabra clave..." style={{...selSty,flex:1,minWidth:220}}/><select style={{...selSty,width:"auto"}} defaultValue="Todas las categorías"><option>Todas las categorías</option></select><select style={{...selSty,width:"auto"}} defaultValue="Todos los grupos de edad"><option>Todos los grupos de edad</option></select><span style={{fontSize:12.5,color:P.blue,cursor:"pointer"}}>Limpiar</span></div>
     <div style={{display:"grid",gridTemplateColumns:"220px 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-prob-tpl">
      <div style={{...card2,padding:14}}><div style={{fontSize:14,fontWeight:800,marginBottom:8}}>Categorías</div>{CATS.map(([c,n])=>{const on=c===probPlantCat;return <div key={c} {...act(()=>setProbPlantCat(c))} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 10px",borderRadius:9,cursor:"pointer",background:on?"#EEEBFD":"transparent",color:on?P.purple:P.ink,fontWeight:on?700:500,fontSize:13}}><span>{c}</span><span style={{fontSize:11.5,color:on?P.purple:P.muted}}>{n}</span></div>;})}</div>
      <div style={{...card2,padding:16}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:16,fontWeight:800}}>Plantillas ({tpls.length})</div><select style={{...selSty,width:"auto",padding:"7px 10px"}} defaultValue="Más utilizadas"><option>Más utilizadas</option></select></div>
       <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12}}>{tpls.map(t=><div key={t.code} style={{border:`1px solid ${LINE}`,borderRadius:12,padding:14,display:"flex",flexDirection:"column",gap:8}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{width:40,height:40,borderRadius:11,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3h6l1 4H8zM7 7h10l1 13H6z"/></svg></span><span style={{color:t.fav?P.purple:"#C7CCE0"}}>{t.fav?"★":"☆"}</span></div><div><div style={{fontWeight:700,fontSize:14}}>{t.name}</div><div style={{fontSize:12,color:P.purple,fontWeight:600}}>{t.code}</div></div><div style={{fontSize:12,color:P.muted,lineHeight:1.4,minHeight:32}}>{t.desc}</div><button onClick={()=>useTpl(t)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"8px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>Usar plantilla</button></div>)}</div>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14,fontSize:13,color:P.muted}}><span>Mostrando {tpls.length} de {TPLS.length} plantillas</span><div style={{display:"flex",gap:5}}>{["1"].map((p,i)=><span key={i} style={{minWidth:30,height:30,border:`1px solid ${LINE}`,background:p==="1"?P.purple:P.white,color:p==="1"?"#fff":P.ink,borderRadius:8,display:"grid",placeItems:"center",fontSize:12.5,cursor:"pointer"}}>{p}</span>)}</div></div>
      </div>
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:`1px solid ${LINE}`}}><div style={{fontSize:15,fontWeight:800}}>Detalle de la plantilla</div><span style={{color:P.muted,cursor:"pointer"}}>✕</span></div>
       <div style={{padding:16}}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3h6l1 4H8zM7 7h10l1 13H6z"/></svg></span><div><div style={{fontWeight:700,fontSize:15}}>{selT.name}</div><div style={{fontSize:12.5,color:P.purple,fontWeight:600}}>{selT.code}</div></div></div>
        <div style={{display:"flex",gap:14,marginTop:12,borderBottom:`1px solid ${LINE}`,fontSize:12.5}}>{["Información","Campos","Notas","Vista previa"].map((t,i)=><span key={t} style={{padding:"6px 0",fontWeight:i===0?700:500,color:i===0?P.purple:P.muted,borderBottom:i===0?`2px solid ${P.purple}`:"2px solid transparent",cursor:"pointer"}}>{t}</span>)}</div>
        <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:11,fontSize:12.5}}>
         <div><div style={{color:P.muted,marginBottom:3}}>Categoría</div><span style={{background:"#EEEBFD",color:P.purple,borderRadius:8,padding:"3px 9px",fontWeight:600}}>{selT.cat}</span></div>
         <div><div style={{color:P.muted,marginBottom:3}}>Descripción</div><div style={{lineHeight:1.5}}>{selT.desc}</div></div>
         <div><div style={{color:P.muted,marginBottom:3}}>CIE-10</div><b>{selT.code}</b></div>
         <div><div style={{color:P.muted,marginBottom:5}}>Palabras clave</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{["diabetes","hiperglucemia","crónica","control"].map(k=><span key={k} style={{background:"#F2F4F9",color:P.muted,borderRadius:7,padding:"3px 8px",fontSize:11.5}}>{k}</span>)}</div></div>
         <div><div style={{color:P.muted,marginBottom:5}}>Incluye campos</div>{["Fecha de diagnóstico","Control (activo/inactivo)","Gravedad","Notas clínicas","Plan de manejo","Alertas y recordatorios"].map(f=><div key={f} style={{display:"flex",gap:8,alignItems:"center",padding:"3px 0"}}><span style={{color:P.green}}>✓</span>{f}</div>)}</div>
         {/* (U-11) Sin estadísticas de uso: esa medición no existe; no se inventa. */}
        </div>
        <button onClick={()=>useTpl(selT)} style={{marginTop:14,width:"100%",border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"11px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Usar plantilla</button>
        <button style={{marginTop:8,width:"100%",border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:UI}}>✎ Editar plantilla</button>
       </div>
      </div>
     </div>
    </div>;
   }

   // ---------- PANTALLA: LISTA DE PROBLEMAS (registro clínica-wide cableado) ----------
   const probLoaded=!!probReg;
   type PRow={id:string;pid:string;name:string;type:string;patient:string;age:string;code:string;estado:string;date:string;active:boolean};
   const fmtD=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   // Registro clínica-wide REAL (GET /api/v1/problems); sin datos de ejemplo.
   const allRows:PRow[]=(probReg?.items??[]).map((it,i)=>({id:it.problemId||`x${i}`,pid:it.patientId,name:it.description||it.code,type:it.chronic?"Crónico":"Agudo",patient:it.patientName,age:"",code:it.code,estado:it.statusLabel,date:fmtD(it.recordedAt),active:it.status==="ACTIVE"||it.status==="CHRONIC"}));
   const rows=allRows.filter(r=>(probStatusF==="Todos"||r.estado===probStatusF)&&(!probSearch||`${r.name} ${r.patient} ${r.code}`.toLowerCase().includes(probSearch.toLowerCase())));
   const selp:PRow|null=rows[probSel]??rows[0]??null;
   const total=probReg?.total??0;
   const cAct=probReg?.byStatus.activos??0,cSeg=probReg?.byStatus.enSeguimiento??0,cRes=probReg?.byStatus.resueltos??0,cIna=probReg?.byStatus.inactivos??0;
   const pct=(n:number)=>total?Math.round(n/total*100):0;
   const catEntries:[string,number][]=probReg?Object.entries(probReg.byCategory).sort((a,b)=>b[1]-a[1]):[];
   const CATC=["#16A66A","#6C5CF6","#F0455E","#20B7D9","#E5983B","#6B7191","#B7791F","#0E7490"];
   let cAcc=0;const catStops=catEntries.map(([,n],i)=>{const a=total?cAcc/total*100:0;cAcc+=n;const b=total?cAcc/total*100:0;return `${CATC[i%CATC.length]} ${a}% ${b}%`;}).join(",");
   const topP=probReg?.topPatients??[];
   const kico=(bg:string,fg:string,d:string)=><span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const kcard:React.CSSProperties={...card2,padding:16,display:"flex",gap:13,alignItems:"center"};
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:P.muted,fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`};
   const tdc:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:13,verticalAlign:"middle"};
   const chk2=(on:boolean,l:string,tog:()=>void)=><label key={l} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,padding:"5px 0",cursor:"pointer"}} onClick={tog}><span style={{width:16,height:16,borderRadius:4,border:on?"0":"1.6px solid #C7CCE0",background:on?P.purple:"transparent",display:"grid",placeItems:"center",color:"#fff",fontSize:10,flex:"0 0 auto"}}>{on?"✓":""}</span>{l}</label>;
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1zM9 12l2 2 4-4"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Problemas</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Gestiona los problemas de salud de tus pacientes (diagnósticos, condiciones crónicas y antecedentes relevantes).</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button onClick={()=>setProbScreen("plantillas")} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"10px 15px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>⊟ Plantillas</button>
      <button onClick={()=>setProbScreen("nuevo")} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>⚡ Problema rápido</button>
      <button onClick={()=>setProbScreen("nuevo")} style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>+ Nuevo problema ▾</button>
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={kcard}>{kico("#EEEBFD",P.purple,"M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z")}<div><div style={{fontSize:24,fontWeight:800}}>{total}</div><div style={{fontSize:11.5,color:P.muted}}>Problemas registrados<br/>En todos los pacientes</div></div></div>
     <div style={kcard}>{kico("#FDECEE",P.red,"M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01")}<div><div style={{fontSize:24,fontWeight:800}}>{cAct}</div><div style={{fontSize:11.5,color:P.muted}}>Activos ({pct(cAct)}%)</div></div></div>
     <div style={kcard}>{kico("#FBF0DC",P.amber,"M12 9v4M12 17h.01M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{cSeg}</div><div style={{fontSize:11.5,color:P.muted}}>En seguimiento ({pct(cSeg)}%)</div></div></div>
     <div style={kcard}>{kico("#E6F6EE","#16A66A","M20 6L9 17l-5-5")}<div><div style={{fontSize:24,fontWeight:800}}>{cRes}</div><div style={{fontSize:11.5,color:P.muted}}>Resueltos ({pct(cRes)}%)</div></div></div>
     <div style={kcard}>{kico("#EEF1F7","#6B7191","M12 9v4M12 17h.01M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{cIna}</div><div style={{fontSize:11.5,color:P.muted}}>Inactivos ({pct(cIna)}%)</div></div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"240px 1fr 320px",gap:16,marginTop:16,alignItems:"start"}} className="mos-prob">
     <div style={{...card2,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:15,fontWeight:700}}>Filtros</div><button onClick={()=>{setProbSearch("");setProbStatusF("Todos");}} style={{border:0,background:"transparent",color:P.blue,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:UI}}>Limpiar</button></div>
      <div style={{position:"relative",marginTop:10}}><input value={probSearch} onChange={e=>{setProbSearch(e.target.value);setProbSel(0);}} placeholder="Buscar problema, diagnóstico o CI..." style={{...selSty,padding:"9px 11px 9px 32px"}}/><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA0BC" strokeWidth="1.9" style={{position:"absolute",left:10,top:11}}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></div>
      <div style={flbl}>Estado</div><select value={probStatusF} onChange={e=>{setProbStatusF(e.target.value);setProbSel(0);}} style={selSty}>{["Todos","Activo","En seguimiento","Resuelto","Inactivo"].map(o=><option key={o}>{o}</option>)}</select>
      <div style={{marginTop:14,borderTop:`1px solid ${LINE}`,paddingTop:10}}>{chk2(probStatusF==="Activo","Solo activos",()=>{setProbStatusF(probStatusF==="Activo"?"Todos":"Activo");setProbSel(0);})}{chk2(probStatusF==="En seguimiento","Solo en seguimiento",()=>{setProbStatusF(probStatusF==="En seguimiento"?"Todos":"En seguimiento");setProbSel(0);})}</div>
      <div style={{marginTop:14,fontSize:12,color:P.muted}}>{rows.length} de {allRows.length} problema(s)</div>
     </div>
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px"}}><div style={{fontSize:16,fontWeight:800}}>Problemas ({rows.length})</div></div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr><th style={th}>Problema / Diagnóstico</th><th style={th}>Paciente</th><th style={th}>Código CIE-10</th><th style={th}>Estado</th><th style={th}>Fecha de registro</th></tr></thead>
       <tbody>{rows.map((r,i)=>{const on=i===probSel;return <tr key={r.id} {...actRow(()=>setProbSel(i))} style={{cursor:"pointer",background:on?"#F7F6FE":"transparent"}}>
        <td style={tdc}><div style={{fontWeight:600}}>{r.name}</div><div style={{fontSize:11,color:P.muted}}>{r.type}</div></td>
        <td style={tdc}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:26,height:26,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>{initials(r.patient)}</span><div style={{minWidth:0}}><div style={{fontSize:12.5,fontWeight:600,whiteSpace:"nowrap"}}>{r.patient}</div>{r.age&&<div style={{fontSize:10.5,color:P.muted}}>{r.age}</div>}</div></div></td>
        <td style={{...tdc,fontWeight:600}}>{r.code}</td>
        <td style={tdc}><span style={estSty(r.estado)}>{r.estado}</span></td>
        <td style={{...tdc,color:P.muted}}>{r.date}</td>
       </tr>;})}
       {rows.length===0&&<tr><td colSpan={5} style={{...tdc,textAlign:"center",color:P.muted,padding:"30px"}}>{probLoaded?(allRows.length===0?"Sin problemas registrados. Usa «+ Nuevo problema».":"Ningún problema coincide con los filtros."):"Cargando registro…"}</td></tr>}
       </tbody></table></div>
      {rows.length>0&&<div style={{padding:"13px 16px",fontSize:13,color:P.muted}}>Mostrando {rows.length} de {allRows.length} problema(s) del registro</div>}
     </div>
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:`1px solid ${LINE}`}}><div style={{fontSize:15,fontWeight:800}}>Detalle del problema</div></div>
      {!selp?<div style={{padding:"40px 16px",textAlign:"center",color:P.muted,fontSize:13}}>{allRows.length===0?"Registra un problema con «+ Nuevo problema».":"Selecciona un problema de la lista para ver su detalle."}</div>:<div style={{padding:"14px 16px"}}>
       <div style={{display:"flex",gap:11,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:14,fontWeight:700,flex:"0 0 auto"}}>{initials(selp.patient)}</span><div><div style={{fontWeight:700,fontSize:14.5}}>{selp.patient}</div><div style={{fontSize:11.5,color:P.muted}}>Expediente: {selp.pid.slice(0,8).toUpperCase()}</div></div></div>
       <div style={{display:"flex",gap:10,alignItems:"center",marginTop:14,justifyContent:"space-between"}}><div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{width:38,height:38,borderRadius:10,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3h6l1 4H8zM7 7h10l1 13H6z"/></svg></span><div><div style={{fontWeight:700,fontSize:14}}>{selp.name}</div><div style={{fontSize:12,color:P.muted}}>{selp.code}</div></div></div><span style={estSty(selp.estado)}>{selp.estado}</span></div>
       <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:9,fontSize:12.5}}>
        {[["Código CIE-10",selp.code],["Fecha de registro",selp.date],["Tipo",selp.type],["Estado",selp.estado]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",gap:10}}><span style={{color:P.muted}}>{k}</span><span style={{fontWeight:600,textAlign:"right"}}>{v}</span></div>)}
       </div>
       <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>{selectPatientRaw(selp.pid,selp.patient);setView("exp");setTimeout(()=>scrollToSection("Lista de problemas"),0);}} style={{flex:1,border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"9px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver en el expediente →</button></div>
      </div>}
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginTop:16,alignItems:"start"}} className="mos-prob2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Problemas por categoría (CIE-10)</div><div style={{display:"flex",gap:14,alignItems:"center"}}><div style={{width:100,height:100,borderRadius:"50%",flex:"0 0 auto",display:"grid",placeItems:"center",background:total>0&&catStops?`conic-gradient(${catStops})`:"#EEF0F5"}}><div style={{width:64,height:64,borderRadius:"50%",background:P.white,display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:16,fontWeight:800}}>{total}</div><div style={{fontSize:9,color:P.muted}}>Problemas</div></div></div></div><div style={{flex:1}}>{catEntries.length===0?<div style={{fontSize:12.5,color:P.muted}}>Sin problemas registrados.</div>:catEntries.map(([l,n],i)=><div key={l} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,padding:"3px 0"}}><span style={{width:8,height:8,borderRadius:"50%",background:CATC[i%CATC.length]}}/>{l}<b style={{marginLeft:"auto"}}>{n} ({pct(n)}%)</b></div>)}</div></div></div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Estado de problemas</div>{([["Activos",cAct,"#F0455E"],["En seguimiento",cSeg,"#E5983B"],["Resueltos",cRes,"#16A66A"],["Inactivos",cIna,"#9AA0BC"]] as [string,number,string][]).map(([l,n,c])=><div key={l} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:4}}><span>{l}</span><b>{n} ({pct(n)}%)</b></div><div style={{height:8,borderRadius:6,background:"#EEF1F7",overflow:"hidden"}}><div style={{height:"100%",width:`${pct(n)}%`,background:c,borderRadius:6}}/></div></div>)}</div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:700,marginBottom:10}}>Pacientes con más problemas</div>{topP.length===0?<div style={{fontSize:12.5,color:P.muted}}>Sin problemas registrados.</div>:topP.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",borderBottom:i<topP.length-1?`1px solid #F2F4F9`:"0"}}><span style={{width:28,height:28,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>{initials(p.name)}</span><span style={{flex:1,fontSize:12.5,fontWeight:600}}>{p.name}</span><b style={{fontSize:13}}>{p.count}</b></div>)}</div>
    </div>
   </div>;
  
}
