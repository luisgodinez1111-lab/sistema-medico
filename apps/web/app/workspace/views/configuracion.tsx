"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "configuracion" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.

import{card,LINE,P,UI,act,CFG_MODULES,type ScheduleRow,type OfficeSettings}from"../shared";
import{useWorkspace}from"../context";
export default function ConfiguracionView(){
 const{setCfg,cfgSettings,setCfgTab,cfgTab,credMsg,credSaved,credForm,setCredForm,saveCredentials,credBusy,credValid,profMsg,profUrls,profHas,sigInputRef,stampInputRef,uploadProfileAsset,profBusy,removeProfileAsset,cfgMsg,saveOfficeSettings,cfgBusy,cfgLoaded}=useWorkspace();

   // ===== MÓDULO CONFIGURACIÓN (S-CONFIG) — ajustes/preferencias del consultorio (presentacional) =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const lbl:React.CSSProperties={fontSize:12,color:P.muted,fontWeight:600,margin:"0 0 5px"};
   const sec=(ico:string,t:string)=><div style={{fontSize:16,fontWeight:800,display:"flex",alignItems:"center",gap:9,marginBottom:16}}><span style={{width:28,height:28,borderRadius:8,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={ico}/></svg></span>{t}</div>;
   const tog=(on:boolean)=><span style={{width:38,height:22,borderRadius:12,background:on?P.purple:"#D5D9E6",position:"relative",flex:"0 0 auto",cursor:"pointer"}}><span style={{position:"absolute",top:2,left:on?18:2,width:18,height:18,borderRadius:"50%",background:"#fff"}}/></span>;
   // Toggle FUNCIONAL (real): dispara onClick y refleja el estado controlado. Accesible por teclado.
   const togBtn=(on:boolean,onClick:()=>void,label:string)=><button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} style={{width:38,height:22,borderRadius:12,background:on?P.purple:"#D5D9E6",position:"relative",flex:"0 0 auto",cursor:"pointer",border:0,padding:0}}><span style={{position:"absolute",top:2,left:on?18:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .15s"}}/></button>;
   // Helpers de ajustes compuestos (horario/módulos): actualizan el estado controlado que persiste el PUT.
   const setSchedRow=(i:number,patch:Partial<ScheduleRow>)=>setCfg("schedule",cfgSettings.schedule.map((r,ix)=>ix===i?{...r,...patch}:r));
   const toggleModule=(k:string)=>setCfg("modules",{...cfgSettings.modules,[k]:!cfgSettings.modules[k]});
   const CFG_TABS=["General","Consultorio","Usuarios y permisos","Plantillas","Integraciones","Notificaciones","Seguridad","Respaldo","Suscripción","Avanzado"];
   const clip="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z";
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
     <span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.4 2h-4L10 3.9a7 7 0 00-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.4 2.4h4l.4-2.4a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6a7 7 0 00.1-1z"/></svg></span>
     <div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Configuración</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Personaliza tu espacio de trabajo, preferencias y módulos del sistema.</p></div>
    </div>
    <div style={{...card2,marginTop:14,padding:"12px 16px",background:"#EEF6FF",border:"1px solid #CFE0F7",fontSize:12.5,color:"#1c3c66",lineHeight:1.5}}>La <b>Información del consultorio</b>, la <b>apariencia</b> (color/tema/tamaño), las <b>preferencias de consulta</b>, las <b>configuraciones regionales</b>, los <b>horarios de atención</b>, los <b>módulos activos</b> y la <b>firma y sello</b> del médico se <b>guardan de verdad</b> (persistidos, con almacenamiento privado para las imágenes). Las demás secciones (cuenta, integraciones, respaldo) siguen siendo presentacionales.</div>
    <div style={{...card2,marginTop:16,padding:"0 16px",display:"flex",gap:2,overflowX:"auto"}}>{CFG_TABS.map(t=><button key={t} onClick={()=>setCfgTab(t)} style={{padding:"14px 12px",fontSize:13.5,fontWeight:cfgTab===t?700:500,color:cfgTab===t?P.purple:P.muted,borderBottom:cfgTab===t?`2px solid ${P.purple}`:"2px solid transparent",background:"transparent",border:0,borderBottomWidth:2,cursor:"pointer",fontFamily:UI,whiteSpace:"nowrap"}}>{t}</button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"1.15fr 1fr 0.95fr",gap:16,marginTop:16,alignItems:"start"}} className="mos-cfg">
     {/* Col 1 */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:18}}>{sec(clip,"Información del consultorio")}
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{display:"flex",gap:12,alignItems:"center"}}><span style={{width:52,height:52,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={clip}/></svg></span><div><div style={{fontSize:17,fontWeight:800}}>Clínica Medical OS</div><div style={{fontSize:12,color:P.muted}}>Medicina general y atención integral</div></div></div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"8px 12px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>◉ Cambiar logo</button></div>
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><div style={lbl}>Nombre del consultorio</div><input value={cfgSettings.officeName} onChange={e=>setCfg("officeName",e.target.value)} placeholder="Ej. Clínica Medical OS" style={selSty}/></div>
        <div><div style={lbl}>Especialidad principal</div><input value={cfgSettings.specialty} onChange={e=>setCfg("specialty",e.target.value)} placeholder="Ej. Medicina General" style={selSty}/></div>
        <div><div style={lbl}>RFC</div><input value={cfgSettings.rfc} onChange={e=>setCfg("rfc",e.target.value)} placeholder="Ej. XAXX010101000" style={selSty}/></div>
        <div><div style={lbl}>Dirección</div><input value={cfgSettings.address} onChange={e=>setCfg("address",e.target.value)} placeholder="Calle, número, ciudad" style={selSty}/></div>
        <div><div style={lbl}>Zona horaria</div><input value={cfgSettings.timezone} onChange={e=>setCfg("timezone",e.target.value)} placeholder="Ej. (GMT-06:00) Chihuahua" style={selSty}/></div>
        <div><div style={lbl}>Teléfono</div><input value={cfgSettings.phone} onChange={e=>setCfg("phone",e.target.value)} placeholder="Ej. 614 123 4567" style={selSty}/></div>
        <div><div style={lbl}>Correo electrónico</div><input value={cfgSettings.email} onChange={e=>setCfg("email",e.target.value)} placeholder="contacto@consultorio.mx" style={selSty}/></div>
        <div><div style={lbl}>Idioma</div><select value={cfgSettings.language} onChange={e=>setCfg("language",e.target.value)} style={selSty}><option value="es">Español (México)</option><option value="en">English</option></select></div>
       </div>
      </div>
      <div style={{...card2,padding:18}}>{sec("M8 2v4M16 2v4M4 8h16M5 6h14v14H5z","Horarios de atención")}
       {cfgSettings.schedule.map((row,i)=><div key={row.day} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0"}}><span style={{width:84,fontSize:13,fontWeight:600}}>{row.day}</span>{row.open?<><input type="time" value={row.from} onChange={e=>setSchedRow(i,{from:e.target.value})} aria-label={`Apertura ${row.day}`} style={{...selSty,width:96,padding:"7px 8px",textAlign:"center"}}/><span style={{color:P.muted}}>–</span><input type="time" value={row.to} onChange={e=>setSchedRow(i,{to:e.target.value})} aria-label={`Cierre ${row.day}`} style={{...selSty,width:96,padding:"7px 8px",textAlign:"center"}}/></>:<div style={{...selSty,flex:1,color:P.muted,display:"flex",alignItems:"center",gap:6}}>Cerrado</div>}<span style={{flex:1}}/>{togBtn(row.open,()=>setSchedRow(i,row.open?{open:false,from:"",to:""}:{open:true,from:"08:00",to:"15:00"}),`${row.day} ${row.open?"abierto":"cerrado"}`)}</div>)}
       <div style={{fontSize:11.5,color:P.muted,marginTop:10}}>Se guardan a nivel del consultorio con «Guardar cambios».</div>
      </div>
      <div style={{...card2,padding:18}}>{sec("M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7z","Apariencia del sistema")}
       <div style={{display:"flex",gap:24,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div><div style={lbl}>Color principal</div><div style={{display:"flex",gap:8}}>{["#4653C4",P.purpleOnPale,P.blueOnPale,P.cyan,P.greenOnPale,P.amberOnPale,P.redOnPale].map(c=><span key={c} {...act(()=>setCfg("color",c))} style={{width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",boxShadow:cfgSettings.color===c?`0 0 0 3px ${c}44`:"none",border:cfgSettings.color===c?"2px solid #fff":"none"}}/>)}</div></div>
        <div><div style={lbl}>Tema</div><select value={cfgSettings.theme} onChange={e=>setCfg("theme",e.target.value)} style={{...selSty,width:120}}><option>Claro</option><option>Oscuro</option></select></div>
        <div><div style={lbl}>Tamaño de fuente</div><select value={cfgSettings.fontSize} onChange={e=>setCfg("fontSize",e.target.value)} style={{...selSty,width:120}}><option>Normal</option><option>Grande</option></select></div>
       </div>
      </div>
     </div>
     {/* Col 2 */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:18}}>{sec("M9 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z","Preferencias de consulta")}
       {([["Vista por defecto del expediente","prefRecordView",["Resumen clínico","Cronología","Lista de problemas"]],["Plantilla de nota médica por defecto","prefNoteTemplate",["Consulta general (SOAP)","Nota de evolución","Nota de procedimiento"]],["Sistema de unidades","prefUnits",["Métrico (kg, cm)","Imperial (lb, in)"]],["Calculadora de dosis","prefDoseCalc",["Pediátrica y adultos","Solo adultos"]]] as [string,keyof OfficeSettings,string[]][]).map(([l,k,opts])=><div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:11}}><span style={{fontSize:12.5,color:P.muted}}>{l}</span><select value={cfgSettings[k] as string} onChange={e=>setCfg(k,e.target.value as never)} style={{...selSty,width:200}}>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select></div>)}
       <div style={{borderTop:`1px solid ${LINE}`,marginTop:6,paddingTop:12}}>{([["Mostrar alertas clínicas en tiempo real","realtimeAlerts"],["Recordatorios de estudios y seguimiento","followupReminders"],["Mostrar interacciones medicamentosas","showInteractions"],["Modo oscuro (solo para tu cuenta)","darkMode"]] as [string,keyof OfficeSettings][]).map(([l,k])=>{const on=cfgSettings[k] as boolean;return <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0"}}><span style={{fontSize:13}}>{l}</span><span {...act(()=>setCfg(k,!on as never))} style={{width:38,height:22,borderRadius:12,background:on?P.purple:"#D5D9E6",position:"relative",flex:"0 0 auto",cursor:"pointer"}}><span style={{position:"absolute",top:2,left:on?18:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .15s"}}/></span></div>;})}</div>
      </div>
      <div style={{...card2,padding:18}}>{sec("M8 2v4M16 2v4M4 8h16M5 6h14v14H5z","Configuraciones regionales")}
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><div style={lbl}>País</div><select value={cfgSettings.regCountry} onChange={e=>setCfg("regCountry",e.target.value)} style={selSty}>{["México","Estados Unidos","Colombia","Argentina","España","Otro"].map(o=><option key={o} value={o}>{o}</option>)}</select></div>
        <div><div style={lbl}>Estado / Provincia</div><input value={cfgSettings.regState} onChange={e=>setCfg("regState",e.target.value)} placeholder="Ej. Chihuahua" style={selSty}/></div>
        <div><div style={lbl}>Ciudad</div><input value={cfgSettings.regCity} onChange={e=>setCfg("regCity",e.target.value)} placeholder="Ej. Cuauhtémoc" style={selSty}/></div>
        <div><div style={lbl}>Código postal</div><input value={cfgSettings.regPostalCode} onChange={e=>setCfg("regPostalCode",e.target.value)} placeholder="Ej. 31223" style={selSty}/></div>
        <div><div style={lbl}>Formato de fecha</div><select value={cfgSettings.regDateFormat} onChange={e=>setCfg("regDateFormat",e.target.value)} style={selSty}>{["dd/mm/aaaa","mm/dd/aaaa","aaaa-mm-dd"].map(o=><option key={o} value={o}>{o}</option>)}</select></div>
        <div><div style={lbl}>Formato de hora</div><select value={cfgSettings.regTimeFormat} onChange={e=>setCfg("regTimeFormat",e.target.value)} style={selSty}>{["24 horas","12 horas"].map(o=><option key={o} value={o}>{o}</option>)}</select></div>
        <div><div style={lbl}>Moneda</div><select value={cfgSettings.regCurrency} onChange={e=>setCfg("regCurrency",e.target.value)} style={selSty}>{["MXN","USD","COP","ARS","EUR"].map(o=><option key={o} value={o}>{o}</option>)}</select></div>
        <div><div style={lbl}>Impuestos (IVA)</div><select value={cfgSettings.regTaxRate} onChange={e=>setCfg("regTaxRate",e.target.value)} style={selSty}>{["16","8","0"].map(o=><option key={o} value={o}>{o}%</option>)}</select></div>
       </div>
      </div>
      <div style={{...card2,padding:18}}>{sec("M18 3a3 3 0 00-3 3M6 21a3 3 0 003-3M4 7h16v10H4z","Datos y seguridad")}
       <div style={{fontSize:12,color:P.muted,display:"flex",gap:7,alignItems:"center"}}><span style={{color:P.green}}>🛡</span>Los datos viajan cifrados (HTTPS) y se aíslan por consultorio en la base de datos; el cifrado en reposo lo aporta el proveedor de base de datos. No hay certificación NOM-024 ni proceso ARCO implementado todavía. La exportación, el respaldo y la eliminación de cuenta se habilitarán con el backend de configuración.</div>
      </div>
     </div>
     {/* Col 3 */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:18}}>{sec("M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9 8a3 3 0 100-6 3 3 0 000 6z","Tu cuenta")}
       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{display:"flex",gap:11,alignItems:"center"}}><span style={{width:44,height:44,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:14,fontWeight:700}}>LG</span><div><div style={{fontSize:14,fontWeight:700}}>Dr. Luis Godinez</div><div style={{fontSize:11.5,color:P.muted}}>Médico General · Cédula: 12345678</div></div></div><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"7px 11px",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:UI}}>Cambiar foto</button></div>
       {[["Nombre completo","Dr. Luis Godinez"],["Correo electrónico","luis@medicalos.mx"],["Teléfono","614 123 4567"]].map(([l,v])=><div key={l} style={{marginBottom:11}}><div style={lbl}>{l}</div><input defaultValue={v} style={selSty}/></div>)}
       <div><div style={lbl}>Contraseña</div><div style={{display:"flex",gap:8}}><input type="password" defaultValue="password" style={{...selSty,flex:1}}/><button style={{border:`1px solid ${LINE}`,background:P.white,borderRadius:9,padding:"0 14px",fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:UI}}>Cambiar</button></div></div>
      </div>
      <div style={{...card2,padding:18}}>{sec("M12 2l7 4v6c0 5-3 8-7 10-4-2-7-5-7-10V6l7-4z","Identidad profesional")}
       <div style={{fontSize:11.5,color:P.muted,marginBottom:10,lineHeight:1.5}}>Nombre, cédula profesional e institución que expidió el título: la ley los exige en la receta (LGS art. 83; RIS art. 29) y el sistema no prescribe ni firma sin ellos. Quedan ligados a tu cuenta de médico, no al consultorio.</div>
       {credMsg&&<div style={{marginBottom:10,padding:"8px 11px",borderRadius:8,background:credMsg.includes("✓")?"#E6F6EE":"#FDF4E6",fontSize:12,color:credMsg.includes("✓")?"#166534":"#7A5A16"}}>{credMsg}</div>}
       {!credSaved&&<div style={{marginBottom:10,padding:"8px 11px",borderRadius:8,background:"#FDEEEE",fontSize:12,color:P.redOnPale,fontWeight:600}}>Sin cédula registrada: no podrás prescribir ni firmar hasta completar este bloque.</div>}
       <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label htmlFor="cred-name" style={lbl}>Nombre completo del médico</label><input id="cred-name" value={credForm.fullName} onChange={e=>setCredForm(f=>({...f,fullName:e.target.value}))} placeholder="Como aparece en la cédula" style={selSty}/></div>
        <div><label htmlFor="cred-cedula" style={lbl}>Cédula profesional</label><input id="cred-cedula" value={credForm.cedulaProfesional} onChange={e=>setCredForm(f=>({...f,cedulaProfesional:e.target.value}))} placeholder="7 u 8 dígitos" inputMode="numeric" style={selSty}/></div>
        <div><label htmlFor="cred-inst" style={lbl}>Institución que expidió el título</label><input id="cred-inst" value={credForm.institution} onChange={e=>setCredForm(f=>({...f,institution:e.target.value}))} placeholder="Ej. UNAM — Facultad de Medicina" style={selSty}/></div>
        <div><label htmlFor="cred-esp" style={lbl}>Especialidad (opcional)</label><input id="cred-esp" value={credForm.specialty} onChange={e=>setCredForm(f=>({...f,specialty:e.target.value}))} placeholder="Ej. Medicina interna" style={selSty}/></div>
        <div><label htmlFor="cred-cedesp" style={lbl}>Cédula de especialidad (opcional)</label><input id="cred-cedesp" value={credForm.cedulaEspecialidad} onChange={e=>setCredForm(f=>({...f,cedulaEspecialidad:e.target.value}))} placeholder="7 u 8 dígitos" inputMode="numeric" style={selSty}/></div>
       </div>
       <div style={{display:"flex",gap:8,marginTop:10,justifyContent:"flex-end"}}>
        <button onClick={()=>void saveCredentials()} disabled={credBusy||!credValid} style={{border:`1px solid ${P.purple}`,background:P.purple,color:P.white,borderRadius:9,padding:"8px 14px",fontWeight:700,fontSize:12,cursor:credBusy||!credValid?"default":"pointer",opacity:credBusy||!credValid?.6:1,fontFamily:UI}}>{credBusy?"Guardando…":"Guardar identidad profesional"}</button>
       </div>
      </div>
      <div style={{...card2,padding:18}}>{sec("M3 17l6-6 4 4 8-8","Firma y sello")}
       {profMsg&&<div style={{marginBottom:10,padding:"8px 11px",borderRadius:8,background:profMsg.includes("✓")?"#E6F6EE":"#FDF4E6",fontSize:12,color:profMsg.includes("✓")?"#166534":"#7A5A16"}}>{profMsg}</div>}
       <div style={{fontSize:11.5,color:P.muted,marginBottom:10,lineHeight:1.5}}>Sube tu firma y sello profesional (imagen PNG/JPG/WEBP). Se guardan de forma privada y cifrada (Vercel Blob), ligados a tu cuenta de médico.</div>
       {([["signature","Firma","M3 17l6-6 4 4 8-8"],["stamp","Sello","M12 3a4 4 0 100 8 4 4 0 000-8zM6 21v-3a2 2 0 012-2h8a2 2 0 012 2v3"]] as ["signature"|"stamp",string,string][]).map(([kind,label])=>{const url=profUrls[kind];const has=profHas[kind];const ref=kind==="signature"?sigInputRef:stampInputRef;return <div key={kind} style={{marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>{label}</div>
        <div style={{border:`1px solid ${LINE}`,borderRadius:11,padding:14,minHeight:64,display:"grid",placeItems:"center",background:"#FBFBFE"}}>{url?<img src={url} alt={label} style={{maxHeight:56,maxWidth:"100%",objectFit:"contain"}}/>:<span style={{fontSize:12,color:P.muted}}>Sin {label.toLowerCase()} cargada</span>}</div>
        <input ref={ref} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];void uploadProfileAsset(kind,f??undefined);e.target.value="";}}/>
        <div style={{display:"flex",gap:8,marginTop:8}}>
         <button onClick={()=>ref.current?.click()} disabled={profBusy} style={{flex:1,border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:9,padding:"8px",fontWeight:700,fontSize:12,cursor:profBusy?"default":"pointer",fontFamily:UI}}>{has?`Reemplazar ${label.toLowerCase()}`:`↥ Subir ${label.toLowerCase()}`}</button>
         {has&&<button onClick={()=>void removeProfileAsset(kind)} disabled={profBusy} style={{border:`1px solid #E7C9C4`,background:P.white,color:P.red,borderRadius:9,padding:"8px 12px",fontWeight:600,fontSize:12,cursor:profBusy?"default":"pointer",fontFamily:UI}}>Quitar</button>}
        </div>
       </div>;})}
      </div>
      <div style={{...card2,padding:18}}>{sec("M13 7l-6 6a3 3 0 004 4l6-6M11 17l6-6a3 3 0 00-4-4l-6 6","Integraciones rápidas")}
       {[["Correo (SMTP)"],["WhatsApp Business"],["Laboratorio"],["PACS / Imagenología"],["EMR externo (HL7/FHIR)"]].map(([n],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<4?`1px solid #F2F4F9`:"0"}}><span style={{display:"flex",alignItems:"center",gap:9,fontSize:13,fontWeight:500}}><span style={{width:26,height:26,borderRadius:7,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center"}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16v16H4z"/></svg></span>{n}</span><button style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:8,padding:"5px 13px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:UI}}>Conectar</button></div>)}
      </div>
     </div>
    </div>
    {/* Módulos activos + Guardar */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 380px",gap:16,marginTop:16,alignItems:"start"}} className="mos-cfg2">
     <div style={{...card2,padding:18}}>{sec("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z","Módulos activos")}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 24px"}}>{CFG_MODULES.map(m=>{const on=cfgSettings.modules[m]!==false;return <div key={m} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid #F6F7FB`}}><span style={{display:"flex",alignItems:"center",gap:9,fontSize:13,color:on?P.ink:P.muted}}><span style={{color:on?P.purple:"#C7CCE0"}}>▤</span>{m}</span>{togBtn(on,()=>toggleModule(m),`Módulo ${m}`)}</div>;})}</div>
      <div style={{fontSize:11.5,color:P.muted,marginTop:12}}>Activa o desactiva módulos del sistema; la preferencia se guarda a nivel del consultorio con «Guardar cambios».</div>
     </div>
     <div style={{...card2,padding:18,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:14,fontWeight:700}}>Guardar configuración</div>
      <div style={{fontSize:12.5,color:P.muted,lineHeight:1.5}}>La información del consultorio, la apariencia, las preferencias, los horarios de atención y los módulos activos se guardan a nivel del consultorio (persistidos, con concurrencia optimista).</div>
      {cfgMsg&&<div style={{padding:"9px 12px",borderRadius:9,background:cfgMsg.includes("✓")?"#E6F6EE":"#FDF4E6",fontSize:12.5,color:cfgMsg.includes("✓")?"#166534":"#7A5A16",fontWeight:600}}>{cfgMsg}</div>}
      <button onClick={()=>void saveOfficeSettings()} disabled={cfgBusy||!cfgLoaded} style={{border:0,background:(cfgBusy||!cfgLoaded)?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,cursor:(cfgBusy||!cfgLoaded)?"default":"pointer",fontFamily:UI}}>{cfgBusy?"Guardando…":"✓ Guardar cambios"}</button>
     </div>
    </div>
   </div>;
  
}
