"use client";
import{useEffect,useState}from"react";
import{createAuth0Client,type Auth0Client}from"@auth0/auth0-spa-js";
import{exchangeForSession,storeSession,getStoredSession,authHeader,logout as sessionLogout,type MedicalSession}from"../../lib/session-client";
// EPIC J — Frontend de login. Flujo: Auth0 (PKCE en el navegador) -> access token (audience
// medical-os) -> intercambio en /api/v1/sessions -> sesión medical-os firmada -> Bearer a la API.
// Config vía NEXT_PUBLIC_*; sin ellas, muestra un aviso en vez de romper.

const DOMAIN=process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
const CLIENT_ID=process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
const AUDIENCE=process.env.NEXT_PUBLIC_OIDC_AUDIENCE;

type Phase="loading"|"config"|"anonymous"|"authenticating"|"authenticated"|"error";
const card:React.CSSProperties={background:"white",border:"1px solid #e7e6f2",borderRadius:18,padding:26,boxShadow:"0 6px 20px #19145b0a",maxWidth:560,margin:"48px auto"};
const btn:React.CSSProperties={background:"#6255c7",color:"white",border:0,borderRadius:10,padding:"11px 18px",fontWeight:700,cursor:"pointer",fontSize:15};
const ghost:React.CSSProperties={...btn,background:"transparent",color:"#6255c7",border:"1px solid #d9d6f2"};
const mono:React.CSSProperties={fontFamily:"ui-monospace,Menlo,monospace",fontSize:12,background:"#f4f3fb",padding:"2px 6px",borderRadius:6};

export default function LoginPage(){
 const[phase,setPhase]=useState<Phase>("loading");
 const[client,setClient]=useState<Auth0Client|null>(null);
 const[subject,setSubject]=useState<string>("");
 const[session,setSession]=useState<MedicalSession|null>(null);
 const[detail,setDetail]=useState<string>("");
 const[apiResult,setApiResult]=useState<string>("");

 useEffect(()=>{
  if(!DOMAIN||!CLIENT_ID||!AUDIENCE){setPhase("config");return;}
  const domain:string=DOMAIN,clientId:string=CLIENT_ID,audience:string=AUDIENCE;
  let cancelled=false;
  (async()=>{
   try{
    const c=await createAuth0Client({domain,clientId,authorizationParams:{redirect_uri:window.location.origin+"/login",audience},cacheLocation:"memory"});
    if(cancelled)return;setClient(c);
    // Regreso desde Auth0 con error (?error=...): mostrarlo en vez de re-renderizar el login.
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
     const s=await exchangeForSession(idpToken);storeSession(s);
     const u=await c.getUser();
     if(cancelled)return;
     setSubject(u?.sub??"");setSession(s);setPhase("authenticated");
    }else{
     const existing=getStoredSession();
     if(existing){setSession(existing);setPhase("authenticated");}
     else setPhase("anonymous");
    }
   }catch(e){if(!cancelled){setDetail(String(e));setPhase("error");}}
  })();
  return()=>{cancelled=true;};
 },[]);

 async function login(){try{await client?.loginWithRedirect();}catch(e){setDetail(String(e));setPhase("error");}}
 async function logout(){await sessionLogout();setSession(null);await client?.logout({logoutParams:{returnTo:window.location.origin+"/login"}});}
 async function probeApi(){
  setApiResult("…");
  try{
   const r=await fetch("/api/v1/encounters?encounterId=00000000-0000-4000-8000-000000000000",{headers:authHeader(session)});
   setApiResult(r.status===401?`401 — sesión NO aceptada`:`${r.status} — la API aceptó la sesión (${r.status===404?"encuentro inexistente, auth OK":"respuesta"})`);
  }catch(e){setApiResult(String(e));}
 }

 return <main style={{maxWidth:1180,margin:"0 auto",padding:32}}>
  <div style={{fontSize:13,color:"#6255c7",fontWeight:700}}>MEDICAL OS</div>
  <h1 style={{fontSize:34,margin:"6px 0 0"}}>Iniciar sesión</h1>
  <div style={card}>
   {phase==="loading"&&<p>Cargando…</p>}
   {phase==="config"&&<div>
    <b>Configuración de Auth0 pendiente.</b>
    <p style={{color:"#5f6072"}}>Define estas variables públicas en Vercel y vuelve a desplegar:</p>
    <ul style={{color:"#5f6072",lineHeight:1.9}}>
     <li><span style={mono}>NEXT_PUBLIC_AUTH0_DOMAIN</span> — p.ej. <span style={mono}>dev-xxxx.us.auth0.com</span></li>
     <li><span style={mono}>NEXT_PUBLIC_AUTH0_CLIENT_ID</span> — el Client ID de tu SPA</li>
     <li><span style={mono}>NEXT_PUBLIC_OIDC_AUDIENCE</span> — <span style={mono}>medical-os</span></li>
    </ul>
   </div>}
   {phase==="anonymous"&&<div>
    <p style={{color:"#5f6072"}}>Autentícate con el proveedor de identidad de tu organización.</p>
    <button style={btn} onClick={login}>Entrar con Auth0</button>
   </div>}
   {phase==="authenticating"&&<p>Verificando identidad y emitiendo sesión clínica…</p>}
   {phase==="authenticated"&&session&&<div>
    <div style={{display:"inline-block",background:"#e8f7ee",color:"#1a7f43",fontWeight:700,fontSize:13,padding:"4px 10px",borderRadius:999}}>● Sesión clínica activa</div>
    <p style={{marginTop:14}}>Identidad: <span style={mono}>{subject||"(sesión previa)"}</span></p>
    <p>Sesión: <span style={mono}>{session.sessionId}</span> · expira <span style={mono}>{new Date(session.expiresAt*1000).toLocaleTimeString()}</span></p>
    <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
     <a href="/workspace" style={{...btn,textDecoration:"none"}}>Ir al espacio clínico</a>
     <button style={ghost} onClick={probeApi}>Probar API clínica</button>
     <button style={ghost} onClick={logout}>Cerrar sesión</button>
    </div>
    {apiResult&&<p style={{marginTop:12,color:"#5f6072"}}>{apiResult}</p>}
   </div>}
   {phase==="error"&&<div>
    <b style={{color:"#c0392b"}}>No se pudo completar el inicio de sesión.</b>
    <p style={{color:"#5f6072",wordBreak:"break-word"}}>{detail}</p>
    <button style={ghost} onClick={()=>location.reload()}>Reintentar</button>
   </div>}
  </div>
 </main>;
}
