"use client";
// EPIC K — Espacio de trabajo clínico (orquestador). Auditoría K-09 / partición de page.tsx (2026-09-22): el estado y los
// handlers viven en ./model (useWorkspaceModel, mismo orden de hooks), los helpers en ./shared y cada vista en ./views/*.
// Este fichero conserva los retornos tempranos, el layout (barra, rail, encabezado del paciente) y el conmutador de vistas.
import {logout as sessionLogout} from "../../lib/session-client";
import{RAIL_CSS,SIDE_NAV,scrollToSection,scrollTop,NavIcon,TOOLS_NAV,appbar,P,UI,LINE,btn,input,wrap,BrandMark,BrandLockup,NAV_GROUP_META}from"./shared";
import{Alert,Button,Card}from"../../../../packages/design-system/src";
import{useWorkspaceModel,deriveHeader}from"./model";
import{WorkspaceProvider,useWorkspace}from"./context";
import dynamic from"next/dynamic";
// Carga diferida por vista (K-09): las 18 vistas no esenciales viajan en su propio chunk y se cargan al navegar; solo
// Inicio, Pacientes, Consulta y Expediente forman parte de la carga inicial. Sin SSR: la página exige sesión en el cliente.
const lazyView=(load:()=>Promise<{default:React.ComponentType}>)=>dynamic(load,{ssr:false,loading:()=><p role="status" style={{padding:24,color:P.muted}}>Cargando la vista…</p>});
const AgendaView=lazyView(()=>import("./views/agenda"));
const ResultadosView=lazyView(()=>import("./views/resultados"));
const MedicamentosView=lazyView(()=>import("./views/medicamentos"));
const OrdenesView=lazyView(()=>import("./views/ordenes"));
const InterconsultaView=lazyView(()=>import("./views/interconsulta"));
const SeguimientoView=lazyView(()=>import("./views/seguimiento"));
const FacturacionView=lazyView(()=>import("./views/facturacion"));
const ObligacionesView=lazyView(()=>import("./views/obligaciones"));
const ReportesView=lazyView(()=>import("./views/reportes"));
const BibliotecaView=lazyView(()=>import("./views/biblioteca"));
const ConfiguracionView=lazyView(()=>import("./views/configuracion"));

import InicioView from"./views/inicio";
import PacientesView from"./views/pacientes";
import ConsultaView from"./views/consulta";
import ExpView from"./views/exp";
const VIEWS:Record<string,React.ComponentType>={inicio:InicioView,pacientes:PacientesView,consulta:ConsultaView,agenda:AgendaView,resultados:ResultadosView,medicamentos:MedicamentosView,ordenes:OrdenesView,interconsulta:InterconsultaView,seguimiento:SeguimientoView,facturacion:FacturacionView,obligaciones:ObligacionesView,reportes:ReportesView,biblioteca:BibliotecaView,configuracion:ConfiguracionView};
function ViewSwitch(){const{view}=useWorkspace();const V=VIEWS[view]??ExpView;return <V/>;}
export default function Workspace(){
 const m=useWorkspaceModel();
 const{ready,session,cspNonce,sideCollapsed,view,setConsultaPid,setView,setExpTab,setDocMenu,docMenu,setSideCollapsed,topSearch,setTopSearch,loadPatients,setTopMenu,topMenu,chartState,setChartReload,signAsk,signErr,signBusy,setSignAsk,setSignErr,confirmSign,reasonAsk,reasonText,setReasonText,setReasonAsk,amendAsk,amendText,setAmendText,setAmendAsk,busy,confirmAmend}=m;

 if(!ready)return <main style={wrap}><p>Cargando…</p></main>;
 if(!session)return <main style={wrap}>
  <div style={{marginBottom:6}}><BrandLockup size={28}/></div><h1 style={{fontSize:32}}>Espacio clínico</h1>
  <Card><p>No hay una sesión activa.</p><a href="/login" style={{...btn,display:"inline-block",textDecoration:"none"}}>Iniciar sesión</a></Card>
 </main>;
 const d=deriveHeader({...m,session});
 const{navCounts,docInitials,docDisplay,docRole,notifCount}=d;
 const bag={...m,...d};
 return <WorkspaceProvider value={bag}><div className="mos-app">
  <style nonce={cspNonce}>{RAIL_CSS}</style>
  {/* SIDEBAR OSCURO — navegación primaria del expediente (slider a un lado) */}
  <aside className={"mos-side"+(sideCollapsed?" col":"")}>
   <div className="mos-brand">
    <span style={{width:40,height:40,flex:"0 0 auto"}}><BrandMark size={40}/></span>
    <div><div className="mos-bname">MEDIC <span className="os">OS</span></div><div className="mos-bsub">SALUD EN UN<br/>SOLO SISTEMA</div></div>
   </div>
   <nav className="mos-nav" aria-label="Navegación del expediente">
    {(()=>{let prevGroup="";
     // Menú por GRUPOS de presentación (Operación · Hoy / Paciente / Catálogo y gestión): el encabezado de sección se
     // DERIVA del `group` de cada ítem (NAV_GROUP_META, capa de presentación) y se pinta al cambiar de grupo. Esta
     // agrupación es deliberadamente distinta de la taxonomía de dominio (3 ramas); el guard verifica ambas.
     // La portada (home:true) va arriba sin encabezado. Ley de Hick: secciones para bajar el coste de decisión.
     return SIDE_NAV.flatMap(it=>{const vTarget=it.view as typeof view;const on=view===vTarget;const n=it.badge?navCounts[it.badge]:0;const rows:React.ReactNode[]=[];
      const group=it.group;
      if(it.home){if(group)prevGroup=group;}
      else if(group&&group!==prevGroup){prevGroup=group;rows.push(<div key={"sec-"+group} className="mos-navsec" aria-hidden="true">{NAV_GROUP_META[group].label}</div>);}
      rows.push(
       <button key={it.label} className={"mos-navi"+(on?" active":"")} aria-current={on?"true":undefined} title={sideCollapsed?it.label:undefined} onClick={()=>{if(vTarget==="consulta")setConsultaPid(null);if(vTarget==="exp")setExpTab("resumen");setView(vTarget);scrollTop();}}>
        <NavIcon k={it.icon}/><span className="lbl">{it.label}</span>{it.badge&&(n===null||n>0)&&<span className={"mos-badge "+(n===null?"p":(it.badgeColor??"p"))} title={n===null?"Sin dato: no se pudo cargar el conteo":undefined}>{n===null?<><span aria-hidden="true">—</span><span className="mos-sr">sin dato</span></>:n}</span>}
       </button>);
      return rows;});})()}
   </nav>
   <div className="mos-divider"/>
   <div className="mos-toolslbl">HERRAMIENTAS</div>
   {TOOLS_NAV.map(it=>(
    <button key={it.label} className={"mos-navi"+((it.label==="Biblioteca clínica"&&view==="biblioteca")||(it.label==="Configuración"&&view==="configuracion")?" active":"")} aria-current={(it.label==="Biblioteca clínica"&&view==="biblioteca")||(it.label==="Configuración"&&view==="configuracion")?"true":undefined} title={sideCollapsed?it.label:undefined} onClick={()=>{if(it.label==="Configuración"){setView("configuracion");scrollTop();}else if(it.label==="Biblioteca clínica"){setView("biblioteca");scrollTop();}}}>
     <NavIcon k={it.icon}/><span className="lbl">{it.label}</span>
    </button>))}
   <div className="mos-divider"/>
   <div className="mos-doc" onClick={()=>setDocMenu(m=>!m)} role="button" aria-expanded={docMenu} aria-label="Menú del médico">
    <span className="av">{docInitials}</span>
    <div className="info" style={{minWidth:0}}><div className="nm">{docDisplay}</div><div className="rl">{docRole}</div></div>
    <span style={{marginLeft:"auto",color:"#8A8FC6",transform:docMenu?"rotate(180deg)":"none",transition:"transform .15s"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6"/></svg></span>
    {docMenu&&<div className="mos-docmenu" onClick={e=>e.stopPropagation()}>
     <button onClick={()=>{setDocMenu(false);}}><NavIcon k="gear"/>Configuración</button>
     <button onClick={()=>{setDocMenu(false);scrollToSection("Seguridad y auditoría");}}><NavIcon k="lock"/>Seguridad y auditoría</button>
     <button onClick={async()=>{await sessionLogout();location.href="/login";}} style={{color:"#F0919E"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/></svg>Cerrar sesión</button>
    </div>}
   </div>
   <button className="mos-collapse" onClick={()=>setSideCollapsed(c=>!c)} aria-label={sideCollapsed?"Expandir menú":"Contraer menú"}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={sideCollapsed?"M11 6l6 6-6 6M5 6l6 6-6 6":"M13 6l-6 6 6 6M19 6l-6 6 6 6"}/></svg>
    <span className="lbl">Contraer menú</span>
   </button>
  </aside>
  {/* BODY — topbar con buscador global + patient header + rejilla de ventanas */}
  <div className="mos-body">
   <header style={appbar}>
    <div className="mos-topsearch" style={{maxWidth:640}}>
     <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8a90ae" strokeWidth="1.9" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" strokeLinecap="round"/></svg>
     <input placeholder="Buscar paciente por nombre, CURP, teléfono o expediente…" value={topSearch} onChange={e=>setTopSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setView("exp");loadPatients();scrollToSection("Paciente");}}}/>
     <span style={{fontSize:11,background:"#E7EAF2",borderRadius:5,padding:"2px 6px",color:P.muted,fontWeight:600,flex:"0 0 auto"}}>⌘ K</span>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:16,flex:"0 0 auto",marginLeft:"auto"}}>
     <button title="Notificaciones" aria-label="Notificaciones" onClick={()=>{setView("exp");scrollToSection("Seguridad y auditoría");}} style={{position:"relative",background:"transparent",border:0,cursor:"pointer",color:P.muted,padding:2,display:"grid",placeItems:"center"}}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 004 0"/></svg>
      {(notifCount===null||notifCount>0)&&<span title={notifCount===null?"Sin dato: no se pudo cargar el conteo de pendientes":undefined} style={{position:"absolute",top:-3,right:-3,minWidth:16,height:16,borderRadius:999,background:P.redOnPale,color:"#fff",fontSize:9.5,fontWeight:800,display:"grid",placeItems:"center",padding:"0 3px"}}>{notifCount===null?<><span aria-hidden="true">—</span><span className="mos-sr">sin dato</span></>:notifCount}</span>}
     </button>
     <div style={{position:"relative"}}>
      <button onClick={()=>setTopMenu(m=>!m)} style={{display:"flex",alignItems:"center",gap:9,background:"transparent",border:0,cursor:"pointer",fontFamily:UI}}>
       <span style={{width:34,height:34,borderRadius:"50%",background:"#EAE9FB",color:P.purple,display:"grid",placeItems:"center",fontWeight:700,fontSize:12}}>{docInitials}</span>
       <span style={{textAlign:"left"}}><span style={{display:"block",fontSize:13.5,fontWeight:700,color:P.ink}}>{docDisplay}</span><span style={{display:"block",fontSize:11.5,color:P.muted}}>{docRole}</span></span>
       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a90ae" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {topMenu&&<div style={{position:"absolute",top:"calc(100% + 8px)",right:0,minWidth:200,background:"#fff",border:`1px solid ${LINE}`,borderRadius:12,boxShadow:"0 12px 32px rgba(16,42,86,.14)",padding:6,zIndex:40}} onClick={e=>e.stopPropagation()}>
       <button onClick={()=>setTopMenu(false)} style={{display:"flex",alignItems:"center",gap:9,width:"100%",textAlign:"left",background:"transparent",border:0,color:P.ink,fontSize:13.5,fontFamily:UI,padding:"9px 11px",borderRadius:9,cursor:"pointer"}}><NavIcon k="gear"/>Configuración</button>
       <button onClick={async()=>{await sessionLogout();location.href="/login";}} style={{display:"flex",alignItems:"center",gap:9,width:"100%",textAlign:"left",background:"transparent",border:0,color:P.redOnPale,fontSize:13.5,fontFamily:UI,padding:"9px 11px",borderRadius:9,cursor:"pointer"}}>Cerrar sesión</button>
      </div>}
     </div>
    </div>
   </header>
   {/* Aviso GLOBAL: si el expediente no se pudo cargar, los contadores/avisos NO son confiables (U-03). */}
   {chartState==="error"&&<Alert tone="critical" style={{margin:"10px 24px 0"}} action={<Button variant="ghost" onClick={()=>setChartReload(n=>n+1)} style={{border:`1px solid ${P.redOnPale}`,background:"#fff",color:P.redOnPale,padding:"6px 12px",fontSize:13}}>Reintentar</Button>}>
    No se pudo cargar el expediente de este paciente. Alertas, seguimiento y resultados pueden estar incompletos: no asuma que "no hay pendientes".
   </Alert>}
  {<ViewSwitch/>}
  </div>
  {signAsk&&<div style={{position:"fixed",inset:0,background:"rgba(20,22,40,.55)",display:"grid",placeItems:"center",zIndex:1000,padding:16}}>
   <div role="alertdialog" aria-modal="true" aria-labelledby="sign-title" aria-describedby="sign-desc" style={{background:"#fff",borderRadius:16,maxWidth:720,width:"100%",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 60px rgba(0,0,0,.3)"}}>
    <div style={{padding:"18px 22px 10px"}}>
     <b id="sign-title" style={{fontSize:17,color:"#1C1E33"}}>Confirmar firma — {signAsk.title}</b>
     <p id="sign-desc" style={{margin:"6px 0 0",fontSize:13,color:"#4b4c5e"}}>Este es el texto <b>guardado</b> que quedará firmado. Una vez firmado es <b>inmutable</b>: cualquier corrección posterior será una enmienda que se añade, nunca un reemplazo. La fecha y hora de la firma las pone el servidor.</p>
    </div>
    <pre tabIndex={0} aria-label="Contenido que se firmará" style={{margin:"0 22px",padding:14,background:"#F6F7FB",border:"1px solid #E3E6F0",borderRadius:10,overflow:"auto",whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:"inherit",fontSize:13.5,lineHeight:1.5,color:"#1C1E33",flex:"1 1 auto"}}>{signAsk.text}</pre>
    <p style={{margin:"8px 22px 0",fontSize:11.5,color:"#6b6c7e",fontFamily:"ui-monospace,monospace",wordBreak:"break-all"}}>Huella del contenido (SHA-256): {signAsk.hash}</p>
    {signErr&&<Alert tone="critical" style={{margin:"10px 22px 0",fontSize:13}}>{signErr}</Alert>}
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"14px 22px 18px"}}>
     <Button variant="ghost" style={{padding:"10px 18px"}} disabled={signBusy} onClick={()=>{setSignAsk(null);setSignErr("");}}>Cancelar</Button>
     <Button variant="success" busy={signBusy} onClick={confirmSign}>{signBusy?"Firmando…":"Firmar definitivamente"}</Button>
    </div>
   </div>
  </div>}
  {reasonAsk&&<div style={{position:"fixed",inset:0,background:"rgba(20,22,40,.55)",display:"grid",placeItems:"center",zIndex:1001,padding:16}}>
   <div role="dialog" aria-modal="true" aria-labelledby="reason-title" style={{background:"#fff",borderRadius:16,maxWidth:560,width:"100%",padding:"18px 22px",boxShadow:"0 24px 60px rgba(0,0,0,.3)"}}>
    <b id="reason-title" style={{fontSize:16,color:"#1C1E33"}}>{reasonAsk.spec.__ask}</b>
    <p style={{margin:"6px 0 10px",fontSize:12.5,color:"#4b4c5e"}}>Este texto queda en el expediente como el motivo registrado por el médico. Mínimo {reasonAsk.spec.min} caracteres.</p>
    <textarea id="reason-text" aria-label={reasonAsk.spec.__ask} value={reasonText} onChange={e=>setReasonText(e.target.value)} rows={3} maxLength={1000} placeholder={reasonAsk.spec.placeholder??""} style={{...input,width:"100%",resize:"vertical"}} />
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:12}}>
     <Button variant="ghost" style={{padding:"10px 18px"}} onClick={()=>{const r=reasonAsk.resolve;setReasonAsk(null);r(null);}}>Cancelar</Button>
     <Button disabled={reasonText.trim().length<reasonAsk.spec.min} onClick={()=>{const r=reasonAsk.resolve;const v=reasonText.trim();setReasonAsk(null);r(v);}}>Registrar</Button>
    </div>
   </div>
  </div>}
  {amendAsk&&<div style={{position:"fixed",inset:0,background:"rgba(20,22,40,.55)",display:"grid",placeItems:"center",zIndex:1000,padding:16}}>
   <div role="dialog" aria-modal="true" aria-labelledby="amend-title" style={{background:"#fff",borderRadius:16,maxWidth:600,width:"100%",padding:"18px 22px",boxShadow:"0 24px 60px rgba(0,0,0,.3)"}}>
    <b id="amend-title" style={{fontSize:17,color:"#1C1E33"}}>Enmienda — {amendAsk.label}</b>
    <p style={{margin:"6px 0 10px",fontSize:13,color:"#4b4c5e"}}>La enmienda se <b>añade</b> al documento firmado; el contenido original no se modifica.</p>
    <label htmlFor="amend-text" style={{display:"block",fontSize:12,fontWeight:700,color:"#4b4c5e",marginBottom:4}}>Texto de la enmienda (mínimo 10 caracteres)</label>
    <textarea id="amend-text" value={amendText} onChange={e=>setAmendText(e.target.value)} rows={4} maxLength={4000} style={{...input,width:"100%",resize:"vertical"}} />
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:12}}>
     <Button variant="ghost" style={{padding:"10px 18px"}} onClick={()=>{setAmendAsk(null);setAmendText("");}}>Cancelar</Button>
     <Button disabled={busy!==""||amendText.trim().length<10} onClick={confirmAmend}>Añadir enmienda</Button>
    </div>
   </div>
  </div>}
 </div></WorkspaceProvider>;
}
