"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "biblioteca" del workspace.
// MEDIC OS / Lote A (honestidad): la Biblioteca es un CATÁLOGO DE REFERENCIA presentacional. No hay repositorio
// de contenido con descarga/búsqueda/versionado, así que NO se muestran listas fabricadas (favoritos, "recientes
// hace 2 horas", "actualizaciones") ni afordances de descarga sin archivo. Lo REAL que enlaza (verificador de
// interacciones, calculadoras del motor CDS) sí es operativo.

import{card,LINE,P,UI,act}from"../shared";
import{useWorkspace}from"../context";
export default function BibliotecaView(){
 const{setView,setMedTab}=useWorkspace();

   const card2:React.CSSProperties={...card,marginTop:0};
   // Especialidades: taxonomía de referencia (estática, sin conteos inventados ni selección que no filtra).
   const ESP:[string,string,string][]=[["Medicina general","M12 3a4 4 0 00-4 4c0 3 4 6 4 6s4-3 4-6a4 4 0 00-4-4z",P.purple],["Pediatría","M9 8a3 3 0 106 0 3 3 0 00-6 0zM6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2",P.blue],["Ginecología","M12 3a4 4 0 100 8 4 4 0 000-8zM12 11v9M9 17h6",P.red],["Medicina interna","M12 21C12 21 4 13.5 4 8.5A4 4 0 0112 6a4 4 0 018 2.5C20 13.5 12 21 12 21z",P.red],["Urgencias","M12 5v14M5 12h14",P.red],["Dermatología","M4 4h16v16H4zM8 8h8v8H8z",P.amber],["Psiquiatría","M9 3a3 3 0 00-3 6 3 3 0 001 5 3 3 0 004 2 3 3 0 006 0 3 3 0 004-2 3 3 0 001-5 3 3 0 00-3-6",P.purple],["Nutrición","M12 3a5 5 0 015 5c0 4-5 13-5 13S7 12 7 8a5 5 0 015-5z",P.greenOnPale]];
   type Feat={badge:string;bc:string;title:string;sub:string;desc:string;src:string};
   // Referencias por NOMBRE (reales): sin botón de descarga (no hay archivo almacenado) — lo aclara el banner.
   const FEAT:Feat[]=[
    {badge:"GPC",bc:P.purple,title:"Diabetes mellitus tipo 2",sub:"Guía de práctica clínica",desc:"Diagnóstico, tratamiento y seguimiento del paciente con DM2.",src:"CENETEC"},
    {badge:"Protocolo",bc:P.blue,title:"Manejo de la hipertensión arterial",sub:"Guía de práctica clínica",desc:"Abordaje integral y metas de control.",src:"CENETEC"},
    {badge:"Calculadora",bc:P.greenOnPale,title:"Dosis pediátricas",sub:"Herramienta interactiva",desc:"Cálculo de dosis por peso, edad y medicamento.",src:"Motor CDS"},
    {badge:"Escala",bc:P.red,title:"Escala de Glasgow",sub:"Valoración neurológica",desc:"Evaluación del estado de conciencia en adultos y pediátricos.",src:"Referencia internacional"},
   ];
   const badgeSty=(c:string):React.CSSProperties=>({background:c+"22",color:c,borderRadius:8,padding:"3px 10px",fontSize:11.5,fontWeight:700});
   const SRC:[string,string][]=[["CENETEC","México"],["OMS","Internacional"],["PubMed","Artículos"],["AHA","Cardiología"],["ADA","Diabetes"]];
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="M4 5a2 2 0 012-2h6v18H6a2 2 0 01-2-2zM20 5a2 2 0 00-2-2h-6v18h6a2 2 0 002-2z"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Biblioteca Clínica</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Referencias clínicas y herramientas deterministas del sistema.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button onClick={()=>{setView("medicamentos");setMedTab("interacciones");}} style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}}>Verificador de interacciones →</button></div>
    </div>
    <div style={{...card2,marginTop:14,padding:"12px 16px",background:"#FDF4E6",border:"1px solid #F2E1C0",fontSize:12.5,color:"#7A5A16",lineHeight:1.5}}>Catálogo de referencia (presentacional): los nombres de guías, escalas y fuentes son reales, pero <b>aún no hay repositorio de contenido</b> con descarga, búsqueda ni versionado. Lo <b>operativo y determinista</b> es el <b>verificador de interacciones</b> y las <b>calculadoras del motor CDS</b>.</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     {([["#EEEBFD",P.purple,"M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2z","Guías y protocolos","Nacionales e internacionales"],["#E6F6EE",P.greenOnPale,"M4 4h16v16H4zM8 8h8M8 12h8M8 16h4","Calculadoras médicas","Dosis, escalas (motor CDS)"],["#E7EEFB",P.blue,"M9 3h6l1 4H8zM7 7h10l1 13H6z","Artículos científicos","Fuentes externas (PubMed)"],["#FBF0DC",P.amber,"M12 3a9 9 0 100 18 9 9 0 000-18zM10 8l6 4-6 4z","Recursos educativos","Vídeos, infografías y casos"]] as [string,string,string,string,string][]).map(([bg,fg,d,l,s])=><div key={l} style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:12,background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8"><path d={d}/></svg></span><div><div style={{fontSize:13.5,fontWeight:800}}>{l}</div><div style={{fontSize:11,color:P.muted}}>{s}</div></div></div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16,marginTop:16,alignItems:"start"}} className="mos-bib">
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:16}}>
       <div style={{fontSize:16,fontWeight:800,margin:"4px 0 10px"}}>Especialidades</div>
       <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:8}}>{ESP.map(([l,d,c])=><div key={l} style={{border:`1px solid ${LINE}`,borderRadius:11,padding:"12px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:6,background:P.white}}><span style={{color:c}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={d}/></svg></span><span style={{fontSize:10.5,fontWeight:700,textAlign:"center",lineHeight:1.1}}>{l}</span></div>)}</div>
       <div style={{fontSize:16,fontWeight:800,margin:"18px 0 10px"}}>Contenido destacado <span style={{fontSize:12,fontWeight:500,color:P.muted}}>(referencia)</span></div>
       <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>{FEAT.map((f,i)=><div key={i} style={{border:`1px solid ${LINE}`,borderRadius:12,padding:14,display:"flex",flexDirection:"column"}}><span style={badgeSty(f.bc)}>{f.badge}</span><div style={{fontSize:14.5,fontWeight:700,marginTop:10,lineHeight:1.2}}>{f.title}</div><div style={{fontSize:11.5,color:P.muted,marginTop:2}}>{f.sub}</div><div style={{fontSize:12,color:"#4B5168",marginTop:8,lineHeight:1.4,flex:1,minHeight:48}}>{f.desc}</div><div style={{fontSize:11,color:P.muted,marginTop:8}}>Fuente: {f.src}</div></div>)}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}} className="mos-bib2">
       <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:12}}>Herramientas rápidas</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{([["Verificador de interacciones","Motor determinista (real)",P.purple,()=>{setView("medicamentos");setMedTab("interacciones");}],["IMC y signos vitales","Cálculo al capturar en el módulo",P.amber,()=>setView("signos")]] as [string,string,string,()=>void][]).map(([t,s,c,fn],i)=><div key={i} {...act(fn)} style={{border:`1px solid ${LINE}`,borderRadius:11,padding:12,display:"flex",gap:10,alignItems:"center",cursor:"pointer"}}><span style={{width:34,height:34,borderRadius:9,background:(c as string)+"22",color:c as string,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16v16H4zM8 8h8"/></svg></span><div><div style={{fontSize:12.5,fontWeight:700}}>{t}</div><div style={{fontSize:11,color:P.muted}}>{s}</div></div></div>)}</div></div>
       <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:12}}>Fuentes confiables</div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{SRC.map(([n,s],i)=><div key={i} style={{flex:"1 0 80px",border:`1px solid ${LINE}`,borderRadius:11,padding:"12px 6px",display:"flex",flexDirection:"column",alignItems:"center",gap:5,textAlign:"center"}}><span style={{width:32,height:32,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:11,fontWeight:800}}>{n.slice(0,2)}</span><span style={{fontSize:11.5,fontWeight:700}}>{n}</span><span style={{fontSize:10,color:P.muted}}>{s}</span></div>)}</div></div>
      </div>
     </div>
     {/* Columna derecha — estado HONESTO del repositorio (sin favoritos/recientes/actualizaciones fabricados) */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:18}}>
       <div style={{fontSize:15,fontWeight:800,marginBottom:8,display:"flex",alignItems:"center",gap:8}}><span style={{color:P.purple}}>📚</span>Repositorio de contenido</div>
       <div style={{fontSize:12.5,color:P.muted,lineHeight:1.55}}>El repositorio <b>gobernado</b> de guías y protocolos —con <b>descarga, búsqueda, versión, fuente y fecha de revisión</b> verificables— aún no está implementado. Por eso esta pantalla no muestra favoritos, recientes ni actualizaciones: serían inventados. Lo que sí es real son las <b>herramientas deterministas</b> enlazadas arriba.</div>
      </div>
     </div>
    </div>
    <div style={{...card2,marginTop:16,padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16,background:"linear-gradient(90deg,#F3F0FF,#EEF4FF)"}}>
     <div style={{display:"flex",alignItems:"center",gap:16}}><span style={{fontSize:34}}>📖</span><div><div style={{fontSize:18,fontWeight:800,color:P.purple}}>Conocimiento que mejora vidas</div><div style={{fontSize:13,color:P.muted,marginTop:2}}>Herramientas deterministas y referencias clínicas, integradas en tu práctica.</div></div></div>
    </div>
   </div>;

}
