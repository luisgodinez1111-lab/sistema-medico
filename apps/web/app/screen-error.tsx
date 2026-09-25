"use client";
// Auditoría 2026-09-19, anexos R05a/R05b (lote 15, 25-sep-2026) — UNA PANTALLA QUE REVIENTA TIENE QUE DECIRLO.
//
// EL HALLAZGO: el repositorio no tenía NI UN límite de errores. Ni `error.tsx`, ni `global-error.tsx`, ni un
// `componentDidCatch` en ninguna parte. Consecuencia exacta: cualquier excepción durante el render desmonta el árbol entero y
// el médico se queda con una pantalla EN BLANCO —sin mensaje, sin botón, sin forma de saber si el paciente no tiene
// medicamentos o si la pantalla murió—. Es la versión extrema del patrón que la auditoría repite en R05: pantallas que
// afirman ausencia sin saber. Y no era hipotético: `parseIxResult` (shared.tsx) documenta la excepción real que lo provocaba
// en el verificador de interacciones, encontrada al ejecutar la suite —un 200 sin `counts` reventaba al pintar la leyenda—.
//
// Next.js App Router monta el `error.tsx` del segmento en lugar de su árbol cuando este lanza; `reset()` reintenta el render.
// Este módulo es el cuerpo compartido por los tres límites (workspace, raíz y `global-error`) para no tener tres copias que
// un día digan cosas distintas. No es una ruta: en App Router solo `page.tsx` y `route.ts` lo son.
//
// LO QUE NO SE MUESTRA: el texto del error. En una pantalla clínica el mensaje de una excepción puede arrastrar props en el
// stack, y esas props llevan PHI. Se muestra un mensaje fijo y, si Next lo aporta, el `digest` —un hash sin contenido— para
// que soporte pueda correlacionarlo con el registro del servidor.
import{useEffect}from"react";
export type PantallaError=Error&{digest?:string};
export function ScreenError({error,reset,scope}:{error:PantallaError;reset:()=>void;scope:string}){
 useEffect(()=>{
  // El fallo se registra en la consola del navegador para que quede en las herramientas del desarrollador. No se manda a
  // ningún sitio: no hay canal de telemetría de cliente y crear uno que pudiera llevar PHI sería peor que no tenerlo.
  console.error(`[${scope}] render interrumpido por una excepción`,error.digest??"(sin digest)");
 },[error,scope]);
 return <div role="alert" style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,
  fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#F6F7FB",color:"#1A1D2E"}}>
  <div style={{maxWidth:560,background:"#fff",border:"1px solid #E4E7F2",borderRadius:16,padding:"28px 30px",
   boxShadow:"0 10px 30px rgba(26,29,46,.06)"}}>
   <div style={{fontSize:13,fontWeight:700,color:"#C33448",letterSpacing:".04em",textTransform:"uppercase"}}>Pantalla interrumpida</div>
   <h1 style={{fontSize:21,fontWeight:800,margin:"8px 0 0"}}>Esta pantalla dejó de responder</h1>
   <p style={{fontSize:14,lineHeight:1.6,color:"#4B5168",margin:"12px 0 0"}}>
    No se pudo terminar de dibujar la pantalla. <b>Lo que ves no es información del paciente</b>: es un fallo de la
    aplicación, así que no lo interpretes como «no hay datos». Nada de lo que hubieras guardado se perdió.
   </p>
   <p style={{fontSize:14,lineHeight:1.6,color:"#4B5168",margin:"10px 0 0"}}>
    Reintenta; si vuelve a fallar, recarga la página y avisa a soporte con la referencia.
   </p>
   <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}}>
    <button onClick={reset} style={{border:0,background:"#6253DC",color:"#fff",borderRadius:10,padding:"11px 18px",
     fontWeight:700,fontSize:14,cursor:"pointer"}}>Reintentar</button>
    <a href="/workspace" style={{border:"1px solid #E4E7F2",background:"#fff",color:"#1A1D2E",borderRadius:10,
     padding:"11px 18px",fontWeight:700,fontSize:14,textDecoration:"none"}}>Recargar el workspace</a>
   </div>
   <div style={{marginTop:16,fontSize:12,color:"#8A90A6"}}>Referencia para soporte: <code>{error.digest??"sin digest"}</code></div>
  </div>
 </div>;
}
