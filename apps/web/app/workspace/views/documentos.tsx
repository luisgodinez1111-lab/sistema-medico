"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "documentos" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import {apiRequest} from "../../../lib/session-client";
import{card,LINE,P,UI,act,actRow,scrollToSection,Skeleton,type DocsSnap}from"../shared";
import{useWorkspace}from"../context";
export default function DocumentosView(){
 const{docsSnap,docFolder,docSel,patientId,setDocMsg,setDocsSnap,setDocNew,docNew,patientName,docForm,setDocForm,createDocument,docBusy,patientSelector,setView,setDocFolder,setDocSel,loadDoc,docDetail,docDetBusy,attInputRef,attBusy,onPickAttachment,attMsg,fmtBytes,viewAttachment,removeAttachment,docMsg}=useWorkspace();

   // ===== MÓDULO DOCUMENTOS (S-DOCUMENTOS) — lista por paciente cableada a GET /patients/:id/documents =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const fmtD=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const docLoaded=!!docsSnap;
   type DRow={id:string;title:string;type:string;date:string;by:string;size:string};
   const allRows:DRow[]=(docsSnap?.items??[]).map(it=>({id:it.documentId,title:it.title,type:it.typeLabel,date:fmtD(it.createdAt),by:"Médico tratante",size:"—"}));
   const rows:DRow[]=docFolder==="Todos los documentos"?allRows:allRows.filter(r=>r.type===docFolder);
   const total=docsSnap?.total??0;
   const chips=docsSnap?docsSnap.chips:{clinical:0,consents:0,studies:0};
   const sel:DRow|null=rows[docSel]??rows[0]??null;
   const folders:[string,number][]=[["Todos los documentos",total],...Object.entries(docsSnap?.byType??{})];
   const genDoc=async()=>{
    if(!patientId){setDocMsg("Selecciona un paciente para generar un documento.");return;}
    setDocMsg("");
    try{const r=await apiRequest("/api/v1/documents",{method:"POST",body:{documentId:crypto.randomUUID(),patientId,docType:"PROGRESS_NOTE",title:`Nota_${new Date().toISOString().slice(0,10)}.pdf`,content:"Documento generado desde plantilla.",occurredAt:new Date().toISOString()}});
     if(r.status===201||r.status===200){setDocMsg("Documento generado ✓");const g=await apiRequest(`/api/v1/patients/${patientId}/documents`,{method:"GET"});if(g.status===200)setDocsSnap(g.body as unknown as DocsSnap);}
     else setDocMsg("No se pudo generar (estado "+r.status+").");
    }catch{setDocMsg("Error al generar el documento.");}
   };
   const typeSty=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={Laboratorio:["#EEEBFD",P.purpleOnPale],["Imagenología"]:["#E7EEFB",P.blueOnPale],Consentimiento:["#FBF0DC",P.amberOnPale],Interconsulta:["#E0F7FA",P.cyan],Receta:["#E6F6EE",P.greenOnPale],["Nota médica"]:["#EEF1FB","#4653C4"],Vacunas:["#E6F6EE",P.greenOnPale],Administrativo:["#EEF1F7",P.muted],Procedimiento:["#EEEBFD",P.purpleOnPale],Otro:["#EEF1F7",P.muted]};const[b,f]=m[k]??m.Otro!;return{background:b,color:f,borderRadius:8,padding:"3px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"};};
   const folderIco=["#6C5CF6",P.blueOnPale,P.greenOnPale,P.amberOnPale,P.cyan,P.redOnPale,"#4653C4",P.muted];
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:P.muted,fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
   const tdc:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,whiteSpace:"nowrap"};
   const chipC=(c:string,d:string,n:number,l:string)=><div style={{...card2,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}><span style={{width:34,height:34,borderRadius:9,background:c+"22",color:c,display:"grid",placeItems:"center"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={d}/></svg></span><div><div style={{fontSize:15,fontWeight:800,lineHeight:1}}>{n}</div><div style={{fontSize:11,color:P.muted}}>{l}</div></div></div>;
   const pdfIco="M6 2h9l5 5v15H6zM14 2v6h6";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Documentos</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Gestiona, organiza y comparte todos los documentos clínicos y administrativos de tus pacientes.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setDocNew(v=>!v);setDocMsg("");}}>{docNew?"Cerrar":"+ Nuevo documento"}</button></div>
    </div>
    {docNew&&<div style={{...card2,marginTop:16,padding:18}}>
     <div style={{fontWeight:800,fontSize:16,marginBottom:4}}>Nuevo documento clínico</div>
     <div style={{fontSize:12.5,color:P.muted,marginBottom:12}}>Para <b style={{color:P.ink}}>{patientName||"el paciente en contexto"}</b>{!patientId?" — selecciona un paciente primero":""}. Documento de texto firmable (no carga de archivos).</div>
     <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:14}} className="mos-med2">
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Tipo</div><select value={docForm.docType} onChange={e=>setDocForm({...docForm,docType:e.target.value})} style={selSty}>{[["PROGRESS_NOTE","Nota de evolución"],["DISCHARGE_SUMMARY","Resumen de alta"],["REFERRAL","Interconsulta"],["PROCEDURE_NOTE","Nota de procedimiento"],["OTHER","Otro"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
      <div><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Título</div><input value={docForm.title} onChange={e=>setDocForm({...docForm,title:e.target.value})} placeholder="Ej. Nota de evolución 19/09/2026" style={selSty}/></div>
     </div>
     <div style={{marginTop:12}}><div style={{fontSize:12,fontWeight:700,color:P.muted,margin:"0 0 6px"}}>Contenido</div><textarea value={docForm.content} onChange={e=>setDocForm({...docForm,content:e.target.value})} placeholder="Contenido del documento…" style={{width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"10px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink,minHeight:100,resize:"vertical",boxSizing:"border-box"}}/></div>
     <div style={{display:"flex",gap:10,marginTop:16}}><button onClick={()=>void createDocument()} disabled={docBusy||!patientId||!docForm.title.trim()||!docForm.content.trim()} style={{border:0,background:(docBusy||!patientId||!docForm.title.trim()||!docForm.content.trim())?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:14,cursor:(docBusy||!patientId||!docForm.title.trim()||!docForm.content.trim())?"default":"pointer",fontFamily:UI}}>{docBusy?"Creando…":"Crear documento"}</button><button onClick={()=>setDocNew(false)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:10,padding:"11px 18px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:UI}}>Cancelar</button></div>
    </div>}
    <div style={{...card2,marginTop:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"center",gap:13,minWidth:0}}><span style={{width:48,height:48,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:15,fontWeight:700,flex:"0 0 auto"}}>{initials(patientName||"—")}</span><div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:16}}>{patientSelector}</div><div style={{fontSize:12.5,color:P.muted}}>{patientId?"Documentos del paciente en contexto":"Selecciona un paciente en el buscador superior para ver y crear sus documentos"}</div></div></div>
     <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>{chipC(P.blue,pdfIco,chips.clinical,"Documentos clínicos")}{chipC(P.green,"M10.5 4.5l9 9a5 5 0 01-7 7l-9-9a5 5 0 017-7z",chips.consents,"Consentimientos")}{chipC(P.purple,"M4 5h16v14H4zM4 15l4-4 3 3 5-5 4 4",chips.studies,"Estudios de imagen")}<button onClick={()=>setView("exp")} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px 15px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver expediente →</button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"250px 1fr 380px",gap:16,marginTop:16,alignItems:"start"}} className="mos-doc">
     {/* Carpetas */}
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:8}}>Carpetas</div>{folders.map(([f,n],i)=>{const on=f===docFolder;return <div key={i} {...act(()=>{setDocFolder(f);setDocSel(0);})} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:9,cursor:"pointer",background:on?"#EEEBFD":"transparent"}}><span style={{color:i===0?P.purple:folderIco[i%folderIco.length]}}><svg width="17" height="17" viewBox="0 0 24 24" fill={on||i>0?"currentColor":"none"} stroke="currentColor" strokeWidth="1.6" opacity={i===0?1:.9}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></span><span style={{flex:1,fontSize:13,fontWeight:on?700:500,color:on?P.purple:P.ink}}>{f}</span><span style={{fontSize:12,color:P.muted}}>{n}</span></div>;})}</div>
     {/* Tabla */}
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{padding:"14px 16px",fontSize:16,fontWeight:800}}>Documentos ({rows.length})</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr><th style={th}>Nombre</th><th style={th}>Tipo</th><th style={{...th,textAlign:"right"}}>Fecha</th></tr></thead>
       <tbody>{patientId&&!docLoaded?Array.from({length:6}).map((_,i)=><tr key={"sk"+i} aria-hidden><td style={tdc}><div style={{display:"flex",alignItems:"center",gap:9}}><Skeleton w={17} h={17} r={5}/><Skeleton w={"62%"} h={12}/></div></td><td style={tdc}><Skeleton w={72} h={16} r={8}/></td><td style={{...tdc,textAlign:"right"}}><Skeleton w={80} h={12} style={{marginLeft:"auto"}}/></td></tr>):rows.length===0?<tr><td colSpan={3} style={{...tdc,textAlign:"center",color:P.muted,padding:"36px 12px"}}>{patientId?(docFolder==="Todos los documentos"?"Sin documentos. Usa «+ Nuevo documento».":"Sin documentos en esta carpeta."):"Selecciona un paciente para ver sus documentos."}</td></tr>:rows.map((r,i)=>{const on=i===docSel;return <tr key={i} {...actRow(()=>{setDocSel(i);void loadDoc(r.id);})} style={{cursor:"pointer",background:on?"#F7F6FE":"transparent"}}>
        <td style={tdc}><div style={{display:"flex",alignItems:"center",gap:9}}><span style={{color:P.red,flex:"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={pdfIco}/></svg></span><span style={{fontWeight:600,color:P.ink}}>{r.title}</span></div></td>
        <td style={tdc}><span style={typeSty(r.type)}>{r.type}</span></td>
        <td style={{...tdc,color:P.muted,textAlign:"right"}}>{r.date}</td>
       </tr>;})}</tbody>
      </table></div>
      {rows.length>0&&<div style={{padding:"13px 16px",fontSize:13,color:P.muted}}>Mostrando {rows.length} de {total} documento(s)</div>}
     </div>
     {/* Detalle del documento seleccionado */}
     <div style={{...card2,padding:0,overflow:"hidden"}}>
      <div style={{padding:"14px 16px",borderBottom:`1px solid ${LINE}`,fontSize:15,fontWeight:800}}>Detalle del documento</div>
      {!sel?<div style={{padding:"40px 16px",textAlign:"center",color:P.muted,fontSize:13}}>{rows.length===0?"Crea un documento con «+ Nuevo documento».":"Selecciona un documento de la lista para ver su detalle."}</div>:<div style={{padding:"16px"}}>
       <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{color:P.red,flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={pdfIco}/></svg></span><div style={{minWidth:0}}><div style={{fontSize:14,fontWeight:700}}>{docDetail?.title??sel.title}</div><span style={typeSty(docDetail?.typeLabel??sel.type)}>{docDetail?.typeLabel??sel.type}</span>{docDetail&&<span style={{marginLeft:6,fontSize:11,fontWeight:700,color:docDetail.state==="SIGNED"||docDetail.state==="AMENDED"?P.greenOnPale:P.amber}}>· {docDetail.statusLabel}</span>}</div></div>
       <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:9,fontSize:12.5}}>
        {[["Tipo",docDetail?.typeLabel??sel.type],["Fecha de creación",docDetail?fmtD(docDetail.createdAt):sel.date],["Paciente",patientName||"—"]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",gap:10}}><span style={{color:P.muted}}>{k}</span><span style={{fontWeight:600,textAlign:"right"}}>{v}</span></div>)}
       </div>
       <div style={{marginTop:14,fontSize:12,fontWeight:700,marginBottom:6}}>Contenido</div>
       {docDetBusy?<div aria-hidden style={{background:"#F7F8FC",border:`1px solid ${LINE}`,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}><Skeleton w={"92%"} h={11}/><Skeleton w={"98%"} h={11}/><Skeleton w={"85%"} h={11}/><Skeleton w={"70%"} h={11}/></div>:docDetail?<div style={{background:"#F7F8FC",border:`1px solid ${LINE}`,borderRadius:10,padding:"12px 14px",fontSize:12.5,lineHeight:1.55,whiteSpace:"pre-wrap",maxHeight:220,overflow:"auto",color:P.ink}}>{docDetail.content}</div>:<div style={{fontSize:12.5,color:P.muted}}>Selecciona el documento para ver su contenido.</div>}
       {docDetail&&docDetail.addenda.length>0&&<div style={{marginTop:12}}><div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Adenda ({docDetail.addenda.length})</div>{docDetail.addenda.map((a,i)=><div key={i} style={{fontSize:12,lineHeight:1.5,padding:"8px 11px",borderRadius:9,background:"#FFF9EC",border:"1px solid #F2E1C0",marginBottom:6}}>{a.addendum}<div style={{fontSize:10.5,color:P.muted,marginTop:3}}>{fmtD(a.at)}</div></div>)}</div>}
       {docDetail?.signature&&<div style={{marginTop:12,fontSize:11.5,color:"#166534",background:"#E6F6EE",border:"1px solid #BFE6CF",borderRadius:9,padding:"9px 11px"}}>✓ Firmado · digest <span style={{fontFamily:"monospace"}}>{docDetail.signature.signatureDigest.slice(0,16)}…</span></div>}
       {docDetail&&<div style={{marginTop:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
         <div style={{fontSize:12.5,fontWeight:700}}>Archivos adjuntos {docDetail.attachments.length>0&&`(${docDetail.attachments.length})`}</div>
         <button onClick={()=>attInputRef.current?.click()} disabled={attBusy} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:8,padding:"5px 11px",fontWeight:700,fontSize:12,cursor:attBusy?"default":"pointer",fontFamily:UI}}>{attBusy?"Subiendo…":"⤒ Adjuntar archivo"}</button>
         <input ref={attInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.tif,.tiff,application/pdf,image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];void onPickAttachment(f??undefined);e.target.value="";}}/>
        </div>
        {attMsg&&<div style={{marginBottom:8,padding:"7px 10px",borderRadius:8,background:attMsg.includes("✓")?"#E6F6EE":"#FDF4E6",fontSize:11.5,color:attMsg.includes("✓")?"#166534":"#7A5A16"}}>{attMsg}</div>}
        {docDetail.attachments.length===0?<div style={{fontSize:12,color:P.muted}}>Sin archivos adjuntos. Sube PDF o imágenes (privado, cifrado).</div>:docDetail.attachments.map(a=><div key={a.attachmentId} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",border:`1px solid ${LINE}`,borderRadius:9,marginBottom:6}}>
         <span style={{color:P.red,flex:"0 0 auto"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 2h9l5 5v15H6z"/></svg></span>
         <div style={{minWidth:0,flex:1}}><div style={{fontSize:12.5,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.filename}</div><div style={{fontSize:10.5,color:P.muted}}>{fmtBytes(a.size)} · {fmtD(a.attachedAt)}</div></div>
         <button onClick={()=>void viewAttachment(a)} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:7,padding:"4px 9px",fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:UI,flex:"0 0 auto"}}>Ver</button>
         <button onClick={()=>void removeAttachment(a)} disabled={attBusy} title="Quitar adjunto" style={{border:`1px solid #E7C9C4`,background:P.white,color:P.red,borderRadius:7,padding:"4px 8px",fontSize:11.5,fontWeight:600,cursor:attBusy?"default":"pointer",fontFamily:UI,flex:"0 0 auto"}}>Quitar</button>
        </div>)}
       </div>}
       <button onClick={()=>{setView("exp");setTimeout(()=>scrollToSection("Documentos clínicos"),0);}} style={{marginTop:14,width:"100%",border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:10,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:UI}}>Ver en el expediente →</button>
      </div>}
     </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1.1fr 1.2fr 1fr",gap:14,marginTop:16,alignItems:"start"}} className="mos-doc2">
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:12}}>⚡ Acciones rápidas</div>{docMsg&&<div style={{marginBottom:10,padding:"8px 11px",borderRadius:8,background:docMsg.includes("✓")?"#E6F6EE":"#FDF4E6",fontSize:12,color:docMsg.includes("✓")?"#166534":"#7A5A16"}}>{docMsg}</div>}<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["⤒","Nuevo documento",()=>{setDocNew(true);setDocMsg("");}],["◉","Escanear con cámara",()=>setDocMsg("Escaneo con cámara: próximamente (requiere captura/almacenamiento de archivos).")],["▤","Generar desde plantilla",genDoc],["➤","Solicitar al paciente",()=>setDocMsg("Solicitud al portal del paciente: próximamente.")]].map(([ic,l,fn],i)=><button key={i} onClick={fn as ()=>void} style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:11,padding:"16px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,cursor:"pointer",fontFamily:UI}}><span style={{width:38,height:38,borderRadius:10,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:16}}>{ic as string}</span><span style={{fontSize:12.5,fontWeight:600}}>{l as string}</span></button>)}</div></div>
     <div style={{...card2,padding:16}}><div style={{fontSize:15,fontWeight:800,marginBottom:12}}>▤ Tipos de archivo permitidos</div><div style={{display:"flex",gap:10,justifyContent:"space-between",flexWrap:"wrap"}}>{[["PDF",P.red],["JPG",P.amber],["PNG",P.amber],["WEBP",P.blue],["GIF/TIFF",P.green]].map(([l,c],i)=><div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flex:1}}><span style={{width:44,height:44,borderRadius:10,background:(c as string)+"22",color:c as string,display:"grid",placeItems:"center"}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 2h9l5 5v15H6z"/></svg></span><span style={{fontSize:11.5,fontWeight:600,textAlign:"center"}}>{l as string}</span></div>)}</div><div style={{fontSize:11.5,color:P.muted,marginTop:12}}>Tamaño máximo: 25 MB por archivo · almacenamiento privado y cifrado (Vercel Blob), ligado al documento en el expediente.</div></div>
     <div style={{...card2,padding:16,background:"#F7F6FE",borderColor:"#E2DEFB"}}><div style={{display:"flex",gap:10}}><span style={{color:P.purple}}>ⓘ</span><div><div style={{fontWeight:700,fontSize:13.5}}>Nota</div><div style={{fontSize:12.5,color:P.muted,marginTop:2,lineHeight:1.5}}>Los adjuntos se guardan en un almacén privado (nunca en URL pública) y se sirven solo a sesiones autorizadas del mismo consultorio. El sistema no está certificado conforme a la NOM-024-SSA3-2012; el registro normativo del proyecto declara esa certificación como pendiente.</div></div></div></div>
    </div>
   </div>;
  
}
