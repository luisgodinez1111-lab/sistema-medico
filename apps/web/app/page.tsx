"use client";
import{useEffect}from"react";
import{getStoredSession}from"../lib/session-client";
// Puerta única: la raíz NO es un landing con bypass. Decide según sesión y redirige.
// Con metadatos de sesión en el navegador -> espacio clínico; sin ellos -> inicio de sesión.
// R01-031: esto es enrutado, no autorización. Quien pida /workspace sin cookie de sesión lo bloquea el middleware, y cada
// petición a la API verifica firma, scope y revocación en el servidor: el navegador no decide nada.
export default function Home(){
 useEffect(()=>{
  const s=getStoredSession();
  window.location.replace(s?"/workspace":"/login");
 },[]);
 return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",fontFamily:"Inter,system-ui,sans-serif",background:"#F4F7FB",color:"#14213D"}}>
  <div style={{textAlign:"center"}}>
   <div style={{fontSize:13,color:"#6255c7",fontWeight:700,letterSpacing:".08em"}}>MEDIC OS</div>
   <p style={{color:"#5f6072",marginTop:8}}>Verificando sesión…</p>
  </div>
 </main>;
}
