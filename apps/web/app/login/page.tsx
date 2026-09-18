"use client";
import{useEffect,useState}from"react";
import{createAuth0Client,type Auth0Client}from"@auth0/auth0-spa-js";
import{exchangeForSession,storeSession,getStoredSession,logout as sessionLogout,type MedicalSession}from"../../lib/session-client";
import{primitive,semantic,typography}from"../../../../packages/design-system/src";
// EPIC J / eje E — PUERTA ÚNICA de sesión. Una sola ventana: identidad de la organización vía
// Auth0 (PKCE en el navegador) -> access token (audience medical-os) -> intercambio en
// /api/v1/sessions -> sesión clínica firmada -> se entra directo al espacio clínico.
// No hay tarjeta-dashboard intermedia ni herramientas de prueba: login o transición, nada más.
// Craft: tokens verbatim del design-system; estados transitorios en el MISMO marco visual.

const DOMAIN=process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
const CLIENT_ID=process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
const AUDIENCE=process.env.NEXT_PUBLIC_OIDC_AUDIENCE;

// Un único estado enumerado para la puerta. "redirecting" = autenticado, entrando al workspace.
type Phase="loading"|"config"|"anonymous"|"authenticating"|"redirecting"|"error";

const INK=semantic.text.primary,MUTED=semantic.text.muted;
const CANVAS=semantic.surface.canvas,RAISED=semantic.surface.raised;
const BRAND=semantic.brand.primary,INTEL=semantic.brand.intelligence,CRIT=semantic.state.critical;
const UI=typography.family.ui,MONOF=typography.family.mono;
const R=primitive.radius,S=primitive.space;
const LINE="#E4E9F2"; // hairline sutil derivado del navy; el design-system no define token de línea

const page:React.CSSProperties={minHeight:"100vh",display:"grid",placeItems:"center",background:CANVAS,fontFamily:UI,color:INK,padding:S[5],boxSizing:"border-box"};
const shell:React.CSSProperties={width:"100%",maxWidth:420,display:"flex",flexDirection:"column",gap:S[6]};
const brandRow:React.CSSProperties={display:"flex",alignItems:"center",gap:S[3]};
const mark:React.CSSProperties={width:40,height:40,borderRadius:R.md,background:`linear-gradient(135deg,${BRAND},${INTEL})`,display:"grid",placeItems:"center",color:"#fff",fontWeight:800,fontSize:18,letterSpacing:"-.02em",boxShadow:`0 6px 18px ${BRAND}33`};
const card:React.CSSProperties={background:RAISED,border:`1px solid ${LINE}`,borderRadius:R.xl,padding:S[8],boxShadow:"0 12px 40px rgba(16,42,86,.08)",display:"flex",flexDirection:"column",gap:S[5]};
const primaryBtn:React.CSSProperties={background:BRAND,color:"#fff",border:0,borderRadius:R.md,padding:`${S[3]}px ${S[5]}px`,fontFamily:UI,fontWeight:700,fontSize:15,cursor:"pointer",width:"100%",boxShadow:`0 6px 16px ${BRAND}2e`,transition:"filter .18s ease"};
const linkBtn:React.CSSProperties={background:"transparent",color:BRAND,border:0,fontFamily:UI,fontWeight:600,fontSize:14,cursor:"pointer",padding:0,textAlign:"left"};
const mono:React.CSSProperties={fontFamily:MONOF,fontSize:12,background:"#f4f3fb",padding:"2px 6px",borderRadius:R.sm};
const foot:React.CSSProperties={color:MUTED,fontSize:12.5,lineHeight:1.6,display:"flex",alignItems:"center",gap:8};

function Spinner(){return <span aria-hidden style={{width:18,height:18,borderRadius:"50%",border:`2.5px solid ${BRAND}33`,borderTopColor:BRAND,display:"inline-block",animation:"mos-spin .7s linear infinite"}}/>;}
function Transient({label}:{label:string}){
 // Estado transitorio: mismo marco, spinner branded. Nunca parece "otra ventana".
 return <div role="status" aria-live="polite" style={{display:"flex",alignItems:"center",gap:S[3],color:INK,fontSize:15,fontWeight:500}}>
  <Spinner/><span>{label}</span>
 </div>;
}

export default function LoginPage(){
 const[phase,setPhase]=useState<Phase>("loading");
 const[client,setClient]=useState<Auth0Client|null>(null);
 const[detail,setDetail]=useState<string>("");

 useEffect(()=>{
  if(!DOMAIN||!CLIENT_ID||!AUDIENCE){setPhase("config");return;}
  const domain:string=DOMAIN,clientId:string=CLIENT_ID,audience:string=AUDIENCE;
  let cancelled=false;
  (async()=>{
   try{
    const c=await createAuth0Client({domain,clientId,authorizationParams:{redirect_uri:window.location.origin+"/login",audience},cacheLocation:"memory"});
    if(cancelled)return;setClient(c);
    // Regreso desde Auth0 con error (?error=...): mostrarlo, no re-renderizar el login en bucle.
    const params=new URLSearchParams(location.search);
    const urlErr=params.get("error");
    if(urlErr){
     setDetail(`${urlErr}: ${params.get("error_description")??""}`);
     window.history.replaceState({},document.title,"/login");
     setPhase("error");return;
    }
    // Regreso desde Auth0 (?code&state): procesar y limpiar la URL.
    if(location.search.includes("code=")&&location.search.includes("state=")){
     await c.handleRedirectCallback();
     window.history.replaceState({},document.title,"/login");
    }
    if(await c.isAuthenticated()){
     setPhase("authenticating");
     const idpToken=await c.getTokenSilently({authorizationParams:{audience}});
     if(typeof idpToken!=="string"||!idpToken)throw new Error("OIDC_TOKEN_UNAVAILABLE");
     const s:MedicalSession=await exchangeForSession(idpToken);storeSession(s);
     if(cancelled)return;
     setPhase("redirecting");
     window.location.replace("/workspace"); // puerta única -> directo al espacio clínico
    }else{
     const existing=getStoredSession();
     if(existing){setPhase("redirecting");window.location.replace("/workspace");}
     else setPhase("anonymous");
    }
   }catch(e){if(!cancelled){setDetail(String(e));setPhase("error");}}
  })();
  return()=>{cancelled=true;};
 },[]);

 async function login(){setDetail("");try{await client?.loginWithRedirect();}catch(e){setDetail(String(e));setPhase("error");}}
 async function resetAuth(){try{await sessionLogout();}catch{/* limpiar aunque falle */}location.reload();}

 return <main style={page}>
  <style>{"@keyframes mos-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.mos-static [style*='mos-spin']{animation:none!important}}"}</style>
  <div style={shell} className="mos-static">
   <div style={brandRow}>
    <div style={mark}>M</div>
    <div>
     <div style={{fontSize:12,fontWeight:800,letterSpacing:".14em",color:BRAND}}>MEDICAL OS</div>
     <div style={{fontSize:13,color:MUTED,marginTop:2}}>Sistema clínico · acceso profesional</div>
    </div>
   </div>

   <div style={card}>
    {phase==="loading"&&<Transient label="Preparando el acceso…"/>}
    {phase==="authenticating"&&<Transient label="Verificando identidad y emitiendo sesión clínica…"/>}
    {phase==="redirecting"&&<Transient label="Entrando al espacio clínico…"/>}

    {phase==="anonymous"&&<>
     <div>
      <h1 style={{fontSize:24,margin:0,letterSpacing:"-.01em"}}>Inicia sesión</h1>
      <p style={{color:MUTED,fontSize:14.5,lineHeight:1.6,margin:`${S[2]}px 0 0`}}>Accede con la identidad de tu organización. Al continuar se emite una sesión clínica firmada para tu turno.</p>
     </div>
     <button style={primaryBtn} onClick={login}
      onMouseEnter={e=>(e.currentTarget.style.filter="brightness(1.06)")}
      onMouseLeave={e=>(e.currentTarget.style.filter="none")}>Entrar con Auth0</button>
     <div style={foot}><span aria-hidden style={{color:semantic.state.success}}>●</span> Identidad verificada · sesión cifrada · trazabilidad de auditoría.</div>
    </>}

    {phase==="config"&&<>
     <h1 style={{fontSize:22,margin:0}}>Configuración de acceso pendiente</h1>
     <p style={{color:MUTED,fontSize:14,lineHeight:1.7,margin:0}}>Define estas variables públicas en el entorno y vuelve a desplegar:</p>
     <ul style={{color:MUTED,fontSize:13.5,lineHeight:2,margin:0,paddingLeft:18}}>
      <li><span style={mono}>NEXT_PUBLIC_AUTH0_DOMAIN</span></li>
      <li><span style={mono}>NEXT_PUBLIC_AUTH0_CLIENT_ID</span></li>
      <li><span style={mono}>NEXT_PUBLIC_OIDC_AUDIENCE</span></li>
     </ul>
    </>}

    {phase==="error"&&<>
     <h1 style={{fontSize:22,margin:0,color:CRIT}}>No se pudo iniciar sesión</h1>
     <p style={{color:MUTED,fontSize:13.5,lineHeight:1.6,margin:0,wordBreak:"break-word"}}>{detail}</p>
     <div style={{display:"flex",gap:S[4],alignItems:"center",flexWrap:"wrap"}}>
      <button style={{...primaryBtn,width:"auto"}} onClick={()=>location.reload()}>Reintentar</button>
      <button style={linkBtn} onClick={resetAuth}>Limpiar sesión y empezar de nuevo</button>
     </div>
    </>}
   </div>

   <p style={{color:MUTED,fontSize:11.5,textAlign:"center",margin:0}}>Uso exclusivo de personal clínico autorizado.</p>
  </div>
 </main>;
}
