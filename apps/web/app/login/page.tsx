"use client";
import{useEffect,useState}from"react";
import{Auth0Client}from"@auth0/auth0-spa-js";
import{exchangeForSession,storeSession,getStoredSession,logout as sessionLogout,type MedicalSession}from"../../lib/session-client";
import{primitive,semantic,typography}from"../../../../packages/design-system/src";
import{useNonce}from"../../lib/nonce-context";
// EPIC J / eje E — PUERTA ÚNICA de sesión (auth split premium clínico). Una sola ventana:
// panel de marca con la identidad del producto (Zero-Lost-Follow-Up) + tarjeta de acción.
// Identidad de la organización vía Auth0 (PKCE) -> access token (audience medical-os) ->
// intercambio en /api/v1/sessions -> sesión clínica firmada -> se entra directo al workspace.
// Sin tarjeta-dashboard intermedia ni herramientas de prueba. Estados transitorios = spinner
// branded en el MISMO marco. Tokens verbatim del design-system (single-source vía CSS vars).

const DOMAIN=process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
const CLIENT_ID=process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
const AUDIENCE=process.env.NEXT_PUBLIC_OIDC_AUDIENCE;

type Phase="loading"|"config"|"anonymous"|"authenticating"|"redirecting"|"error";

const P=primitive.color,R=primitive.radius,UI=typography.family.ui,MONOF=typography.family.mono;
// CSS con los tokens interpolados (un único origen de verdad = design-system).
const CSS=`
.mos-auth{--navy:${P.navy};--blue:${P.blue};--purple:${P.purple};--cyan:${P.cyan};--green:${P.green};
 --red:${P.red};--canvas:${P.canvas};--ink:${P.ink};--muted:${P.muted};--white:${P.white};--line:#E4E9F2;
 --rmd:${R.md}px;--rxl:${R.xl}px;--ui:${UI};--mono:${MONOF};
 font-family:var(--ui);color:var(--ink)}
.mos-auth *{box-sizing:border-box}
.mos-auth .auth{min-height:100vh;display:grid;grid-template-columns:1.05fr .95fr;background:var(--canvas)}
.mos-auth .brand-panel{position:relative;background:linear-gradient(160deg,#0C2148 0%,${P.navy} 55%,#15346B 100%);color:#EAF0FA;padding:56px 56px 48px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
.mos-auth .brand-panel::after{content:"";position:absolute;inset:0;opacity:.5;pointer-events:none;background:radial-gradient(120% 80% at 88% 8%,rgba(32,183,217,.16),transparent 60%),radial-gradient(90% 60% at 8% 100%,rgba(103,87,232,.16),transparent 60%)}
.mos-auth .lockup{display:flex;align-items:center;gap:12px;position:relative;z-index:1}
.mos-auth .mark{width:42px;height:42px;border-radius:11px;background:var(--white);display:grid;place-items:center;box-shadow:0 8px 24px rgba(6,16,38,.4)}
.mos-auth .bname{font-size:12px;font-weight:800;letter-spacing:.16em;color:#fff}
.mos-auth .bsub{font-size:12.5px;color:#9DB2D4;margin-top:3px}
.mos-auth .mid{position:relative;z-index:1;max-width:34ch;display:flex;flex-direction:column;gap:28px}
.mos-auth .mid h2{font-size:30px;line-height:1.18;letter-spacing:-.015em;margin:0;font-weight:700;text-wrap:balance;color:#fff}
.mos-auth .mid p{font-size:14.5px;line-height:1.65;color:#B7C6E0;margin:14px 0 0;max-width:32ch}
.mos-auth .trust{display:flex;flex-direction:column;gap:15px;padding-top:4px}
.mos-auth .ti{display:flex;align-items:flex-start;gap:11px;font-size:13.5px;color:#C3D0E6;line-height:1.5}
.mos-auth .ti svg{flex:0 0 auto;margin-top:1px}
.mos-auth .ti b{color:#EAF0FA;font-weight:600}
.mos-auth .pfoot{position:relative;z-index:1;font-size:12px;letter-spacing:.02em;color:#7E93B8;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.mos-auth .pfoot .sep{width:4px;height:4px;border-radius:50%;background:#4A5F86}
.mos-auth .action{display:grid;place-items:center;padding:40px 24px}
.mos-auth .inner{width:100%;max-width:392px}
.mos-auth .mbrand{display:none}
.mos-auth .card{background:var(--white);border:1px solid var(--line);border-radius:var(--rxl);padding:34px 32px;box-shadow:0 16px 48px rgba(16,42,86,.09);display:flex;flex-direction:column;gap:22px;min-height:150px;justify-content:center}
.mos-auth h1{font-size:25px;line-height:1.15;letter-spacing:-.01em;margin:0;font-weight:700}
.mos-auth .lede{color:var(--muted);font-size:14.5px;line-height:1.6;margin:8px 0 0}
.mos-auth .btn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;background:var(--blue);color:#fff;border:0;border-radius:var(--rmd);padding:14px 18px;font-family:var(--ui);font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 8px 20px rgba(23,105,224,.24);transition:filter .16s ease,transform .16s ease}
.mos-auth .btn:hover{filter:brightness(1.06)}.mos-auth .btn:active{transform:translateY(1px)}
.mos-auth .btn:focus-visible{outline:3px solid rgba(23,105,224,.4);outline-offset:2px}
.mos-auth .btn.sec{background:transparent;color:var(--blue);box-shadow:none;width:auto;padding:10px 0;font-size:14px}
.mos-auth .reassure{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12.5px;line-height:1.5}
.mos-auth .dot-ok{width:7px;height:7px;border-radius:50%;background:var(--green);flex:0 0 auto}
.mos-auth .hr{height:1px;background:var(--line);border:0;margin:2px 0}
.mos-auth .cfoot{color:var(--muted);font-size:11.5px;text-align:center;margin:18px 0 0}
.mos-auth .transient{display:flex;align-items:center;gap:12px;font-size:15px;font-weight:500;color:var(--ink)}
.mos-auth .spin{width:19px;height:19px;border-radius:50%;border:2.5px solid rgba(23,105,224,.22);border-top-color:var(--blue);animation:mos-sp .7s linear infinite}
.mos-auth .mono{font-family:var(--mono);font-size:12px;background:#f4f3fb;padding:2px 6px;border-radius:${R.sm}px}
.mos-auth ul.cfg{color:var(--muted);font-size:13.5px;line-height:2;margin:0;padding-left:18px}
@keyframes mos-sp{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.mos-auth .spin{animation:none}}
@media(max-width:880px){
 .mos-auth .auth{grid-template-columns:1fr}
 .mos-auth .brand-panel{display:none}
 .mos-auth .action{padding:28px 18px;align-items:flex-start}
 .mos-auth .inner{margin:0 auto}
 .mos-auth .mbrand{display:flex;align-items:center;gap:11px;margin-bottom:22px}
 .mos-auth .mmark{width:38px;height:38px;border-radius:10px;background:linear-gradient(160deg,#0C2148,#15346B);display:grid;place-items:center}
}`;

const MarkGlyph=({stroke}:{stroke:string})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 13h3.2l1.7-5.3 2.9 9 2-6.4 1.4 2.7H20" stroke={stroke} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/></svg>;
function Transient({label}:{label:string}){return <div className="transient" role="status" aria-live="polite"><span className="spin" aria-hidden/><span>{label}</span></div>;}

export default function LoginPage(){
 const cspNonce=useNonce(); // S-04
 const[phase,setPhase]=useState<Phase>("loading");
 const[client,setClient]=useState<Auth0Client|null>(null);
 const[detail,setDetail]=useState<string>("");

 useEffect(()=>{
  if(!DOMAIN||!CLIENT_ID||!AUDIENCE){setPhase("config");return;}
  const domain:string=DOMAIN,clientId:string=CLIENT_ID,audience:string=AUDIENCE;
  let cancelled=false;
  const params=new URLSearchParams(location.search);
  const urlErr=params.get("error");
  const returning=params.has("code")&&params.has("state");
  // Cliente LISTO de inmediato: el constructor NO hace el checkSession con iframe del factory
  // (que se cuelga hasta el timeout con cookies de terceros bloqueadas). La puerta no espera.
  const c=new Auth0Client({domain,clientId,authorizationParams:{redirect_uri:window.location.origin+"/login",audience},cacheLocation:"memory"});
  setClient(c);
  if(urlErr){
   setDetail(`${urlErr}: ${params.get("error_description")??""}`);
   window.history.replaceState({},document.title,"/login");
   setPhase("error");return;
  }
  // Vuelta desde Auth0 -> "verificando"; visita normal -> muestra la puerta YA y verifica en 2.º plano.
  setPhase(returning?"authenticating":"anonymous");
  (async()=>{
   try{
    if(returning){
     await c.handleRedirectCallback();
     window.history.replaceState({},document.title,"/login");
    }
    const existing=getStoredSession();
    if(existing){if(cancelled)return;setPhase("redirecting");window.location.replace("/workspace");return;}
    // Sesión SSO activa? Silencioso (resuelve/rechaza rápido). Si falla, se queda la puerta visible.
    const idpToken=await c.getTokenSilently({authorizationParams:{audience}}).catch(()=>null);
    if(cancelled)return;
    if(typeof idpToken==="string"&&idpToken){
     setPhase("authenticating");
     const s:MedicalSession=await exchangeForSession(idpToken);
     // Metadatos de display del médico desde el IdP (nombre/rol) para el perfil del sidebar.
     let physicianName:string|undefined,physicianRole:string|undefined;
     try{const u=await c.getUser();physicianName=(u?.name??u?.nickname??u?.email)as string|undefined;
      const rolesClaim=u?.["https://medical-os/roles"]??u?.["roles"];
      if(Array.isArray(rolesClaim)&&rolesClaim.length)physicianRole=String(rolesClaim[0]);}catch{/* sin claims de display */}
     storeSession({...s,...(physicianName?{physicianName}:{}),...(physicianRole?{physicianRole}:{})});
     if(cancelled)return;
     setPhase("redirecting");
     window.location.replace("/workspace");
    }else if(returning){
     setDetail("No se pudo emitir la sesión clínica tras el inicio de sesión. Reintenta.");
     setPhase("error");
    } // si no: permanece en "anonymous" con el botón "Entrar con Auth0" ya visible
   }catch(e){if(!cancelled){setDetail(String(e));setPhase("error");}}
  })();
  return()=>{cancelled=true;};
 },[]);

 async function login(){setDetail("");try{await client?.loginWithRedirect();}catch(e){setDetail(String(e));setPhase("error");}}
 async function resetAuth(){try{await sessionLogout();}catch{/* limpiar aunque falle */}location.reload();}

 return <main className="mos-auth">
  <style nonce={cspNonce}>{CSS}</style>
  <div className="auth">
   <section className="brand-panel">
    <div className="lockup">
     <span className="mark"><MarkGlyph stroke={P.navy}/></span>
     <div><div className="bname">MEDICAL OS</div><div className="bsub">Sistema clínico · acceso profesional</div></div>
    </div>
    <div className="mid">
     <div>
      <h2>Ningún resultado crítico se pierde. Ningún seguimiento se olvida.</h2>
      <p>Inteligencia clínica determinista sobre un expediente longitudinal. La autoridad siempre es del médico.</p>
     </div>
     <div className="trust">
      <div className="ti"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" stroke={P.cyan} strokeWidth="1.7" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke={P.cyan} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg><span><b>Identidad verificada</b> de tu organización y sesión cifrada por turno.</span></div>
      <div className="ti"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 8v4l3 2" stroke={P.cyan} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="8.2" stroke={P.cyan} strokeWidth="1.7"/></svg><span><b>Trazabilidad de auditoría</b> inmutable en cada acción clínica.</span></div>
      <div className="ti"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="4.5" y="4.5" width="15" height="15" rx="3" stroke={P.cyan} strokeWidth="1.7"/><path d="M8.5 12h7M12 8.5v7" stroke={P.cyan} strokeWidth="1.7" strokeLinecap="round"/></svg><span><b>Barreras de seguridad</b> en prescripción y resultados, sin excepción.</span></div>
     </div>
    </div>
    <div className="pfoot"><span>Medical OS · V2</span><span className="sep"/><span>México-first</span><span className="sep"/><span>Uso clínico autorizado</span></div>
   </section>

   <section className="action">
    <div className="inner">
     <div className="mbrand">
      <span className="mmark"><MarkGlyph stroke={P.white}/></span>
      <div><div className="bname" style={{color:P.blue}}>MEDICAL OS</div><div className="bsub" style={{color:P.muted}}>Sistema clínico · acceso profesional</div></div>
     </div>
     <div className="card">
      {phase==="loading"&&<Transient label="Preparando el acceso…"/>}
      {phase==="authenticating"&&<Transient label="Verificando identidad y emitiendo sesión clínica…"/>}
      {phase==="redirecting"&&<Transient label="Entrando al espacio clínico…"/>}

      {phase==="anonymous"&&<>
       <div>
        <h1>Inicia sesión</h1>
        <p className="lede">Accede con la identidad de tu organización. Al continuar se emite una sesión clínica firmada para tu turno.</p>
       </div>
       <button className="btn" onClick={login}>Entrar con Auth0
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h13m-5-5l5 5-5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
       </button>
       <hr className="hr"/>
       <div className="reassure"><span className="dot-ok"/> Uso exclusivo de personal clínico autorizado.</div>
      </>}

      {phase==="config"&&<>
       <h1 style={{fontSize:21}}>Configuración de acceso pendiente</h1>
       <p className="lede">Define estas variables públicas en el entorno y vuelve a desplegar:</p>
       <ul className="cfg">
        <li><span className="mono">NEXT_PUBLIC_AUTH0_DOMAIN</span></li>
        <li><span className="mono">NEXT_PUBLIC_AUTH0_CLIENT_ID</span></li>
        <li><span className="mono">NEXT_PUBLIC_OIDC_AUDIENCE</span></li>
       </ul>
      </>}

      {phase==="error"&&<>
       <h1 style={{fontSize:21,color:P.red}}>No se pudo iniciar sesión</h1>
       <p className="lede" style={{wordBreak:"break-word"}}>{detail}</p>
       <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
        <button className="btn" style={{width:"auto",padding:"12px 20px"}} onClick={()=>location.reload()}>Reintentar</button>
        <button className="btn sec" onClick={resetAuth}>Limpiar sesión y empezar de nuevo</button>
       </div>
      </>}
     </div>
     <p className="cfoot">Medical OS · sesión protegida de extremo a extremo.</p>
    </div>
   </section>
  </div>
 </main>;
}
