"use client";
import{useReducer,useState,type CSSProperties}from"react";
import{semantic,primitive,typography}from"../../../../../packages/design-system/src";
import{initialSignGate,signGateReducer,gateView,isPending,canSign,MIN_EVIDENCE,type SignGateState,type SignGateEvent}from"../../../../../packages/ui-sign-gate/src";
// GUX-001 — Golden UX Loop (componente canónico): resultado crítico -> bloqueo de firma -> resolución CON
// evidencia -> readiness refresh -> firma -> auditoría. Renderiza la máquina de estados pura (ui-sign-gate).
// Estado codificado en forma+ícono+texto (no solo color); patient context siempre visible; pending != success.

const c=primitive.color;
const tone:Record<string,{stripe:string;wash:string;glyph:string}>= {
 critical:{stripe:semantic.state.critical,wash:"rgba(201,54,74,.08)",glyph:"▲"},
 pending:{stripe:semantic.brand.primary,wash:"rgba(23,105,224,.08)",glyph:"◍"},
 ready:{stripe:semantic.state.success,wash:"rgba(22,139,91,.10)",glyph:"✓"},
 signed:{stripe:c.navy,wash:"rgba(23,105,224,.08)",glyph:"🔏"},
};
const S={box:{border:`1px solid ${c.muted}33`,borderRadius:primitive.radius.md,background:c.white} as CSSProperties};

type TL=Readonly<{sev:"crit"|"ok"|"sign";t:string;d:string;h:string}>;
const seed:TL[]=[
 {sev:"crit",t:"Resultado crítico recibido",d:"Potasio 7.0 mEq/L · valor de pánico (rango 3.5–5.1).",h:"09:12 · evt 7c3f…a1"},
 {sev:"crit",t:"Obligación creada",d:"Acción requerida — owner Dr. Alarcón, vence hoy.",h:"09:12 · obl 91b2…4d"},
];

export default function Gux001(){
 const[state,dispatch]=useReducer((s:SignGateState,e:SignGateEvent)=>signGateReducer(s,e),initialSignGate(1));
 const[evidence,setEvidence]=useState("");
 const[err,setErr]=useState("");
 const[tl,setTl]=useState<TL[]>(seed);
 const v=gateView(state),tn=tone[v.tone]!;

 function resolve(){
  if(evidence.trim().length<MIN_EVIDENCE){setErr("Se requiere evidencia clínica concreta para cerrar un pendiente crítico (reconocer no basta).");return;}
  setErr("");dispatch({type:"RESOLVE",evidence});
  setTimeout(()=>{ // confirmación autoritativa del servidor
   dispatch({type:"RESOLUTION_CONFIRMED"});
   setTl(x=>[...x,{sev:"ok",t:"Resultado crítico cerrado",d:"K⁺ resuelto con evidencia; obligación → COMPLETED.",h:"09:39 · evt b1d7…7e"}]);
  },1200);
 }
 function sign(){
  dispatch({type:"SIGN"});
  setTimeout(()=>{
   dispatch({type:"SIGN_CONFIRMED"});
   setTl(x=>[...x,{sev:"sign",t:"Encuentro firmado",d:"Firma confirmada por el servidor. Registro inmutable.",h:"09:41 · sig 4af0…9c"}]);
  },1200);
 }

 return <div style={{minHeight:"100vh",background:semantic.surface.canvas,color:semantic.text.primary,fontFamily:typography.family.ui}}>
  {/* Banner degradado persistente (DEGRADED_DEPENDENCY+EMPTY_SUCCESS prohibido) */}
  <div role="status" style={{padding:"8px 16px",background:"rgba(200,123,18,.10)",borderBottom:`1px solid ${c.muted}22`,fontSize:12.5}}>
   <b>Modo degradado.</b> Copiloto IA: <b>no disponible</b> · Red: <b>intermitente</b> · Proyección: <b>desactualizada</b> — se usan lecturas autoritativas del servidor.
  </div>
  {/* Patient context header — P0/P1/P2 siempre visible, incluso durante la firma (C5) */}
  <header data-testid="patient-header" style={{position:"sticky",top:0,zIndex:20,background:c.white,borderBottom:`1px solid ${c.muted}44`,display:"flex",gap:18,alignItems:"center",padding:"12px 20px",flexWrap:"wrap"}}>
   <div style={{flex:"1 1 320px",minWidth:0}}>
    <div style={{fontSize:17,fontWeight:700,overflowWrap:"anywhere"}}>María Fernanda de los Ángeles Hernández-Ramírez y Santiago</div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:3,color:c.muted,fontSize:12.5}}>
     <span style={{color:semantic.state.attention,fontWeight:600}}>◐ Nacimiento parcial · identidad temporal</span>
     <span style={{fontFamily:typography.family.mono}}>EXP·FX-EXTREME-001</span>
    </div>
   </div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <Chip k="Críticos abiertos" v={String(state.criticalOpen+2)} crit/>
    <Chip k="Alergias" v="9"/><Chip k="Medicación" v="14"/><Chip k="Problemas" v="27"/>
   </div>
  </header>

  <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 340px",gap:18,padding:"22px clamp(16px,3vw,32px)",alignItems:"start"}}>
   <main style={{display:"flex",flexDirection:"column",gap:16,minWidth:0}}>
    <div><div style={{fontSize:11,fontWeight:600,letterSpacing:".09em",textTransform:"uppercase",color:c.muted}}>Encuentro · firma clínica</div>
     <h1 style={{fontSize:22,fontWeight:700,margin:"2px 0 0"}}>Consulta de medicina interna — 17 sep 2026</h1></div>

    {/* SIGN GATE */}
    <section data-testid="sign-gate" aria-live="polite" style={{...S.box,border:`1px solid ${c.muted}44`,overflow:"hidden"}}>
     <div style={{display:"flex",gap:14,alignItems:"flex-start",padding:"16px 18px",borderLeft:`5px solid ${tn.stripe}`,background:tn.wash}}>
      <div aria-hidden style={{width:34,height:34,display:"grid",placeItems:"center",borderRadius:9,background:c.white,border:`1px solid ${c.muted}44`,fontWeight:800,fontSize:17,color:tn.stripe}}>{tn.glyph}</div>
      <div style={{flex:1,minWidth:0}}>
       <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <span data-testid="gate-status" style={{fontSize:11,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",padding:"2px 8px",borderRadius:5,border:`1px solid ${tn.stripe}`,color:tn.stripe}}>{v.label}</span>
        <h2 style={{fontSize:16,fontWeight:700}}>{v.title}</h2>
       </div>
       <p style={{margin:"4px 0 0",color:c.muted,fontSize:13}}>{v.why}</p>
      </div>
     </div>

     <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{fontSize:11,fontWeight:600,letterSpacing:".09em",textTransform:"uppercase",color:c.muted}}>{state.phase==="SIGNED"?"Registro firmado":state.phase==="READY"||state.phase==="SIGNING"?"Pendiente resuelto":"Blocker exacto — 1 de 1"}</div>
      <ResultCard resolved={state.criticalOpen===0}/>

      {state.phase==="BLOCKED"&&<div data-testid="resolve-form" style={{border:`1px dashed ${c.muted}55`,borderRadius:primitive.radius.md,padding:14,background:"#FBFCFE"}}>
       <h3 style={{fontSize:13,fontWeight:700,margin:0}}>▲ Resolver el resultado crítico</h3>
       <p style={{margin:"5px 0 10px",fontSize:12.5,color:c.muted}}>Reconocer no es resolver: el cierre exige evidencia de que el paciente fue contactado y tratado.</p>
       <label htmlFor="ev" style={{display:"block",fontSize:12,fontWeight:600,marginBottom:5}}>Evidencia clínica del seguimiento</label>
       <textarea id="ev" data-testid="resolve-evidence" value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Ej. Paciente contactado; gluconato de calcio + insulina/glucosa; K⁺ control 5.1; ECG sin cambios."
        style={{width:"100%",minHeight:64,resize:"vertical",padding:"9px 11px",borderRadius:6,border:`1px solid ${c.muted}55`,background:c.white,color:c.ink,font:"inherit",fontSize:13}}/>
       {err&&<div style={{fontSize:11.5,color:semantic.state.critical,marginTop:6}}>{err}</div>}
       <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>
        <button data-testid="btn-resolve" onClick={resolve} style={btn(semantic.state.critical,true)}>Cerrar con evidencia</button>
        <button onClick={()=>setErr("Reconocer no cierra la obligación (ACKNOWLEDGED ≠ RESOLVED). El pendiente crítico sigue bloqueando la firma.")} style={btn("",false)}>Solo reconocer</button>
       </div>
      </div>}

      {(state.phase==="READY"||state.phase==="SIGNING")&&<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
       <button data-testid="btn-sign" disabled={!canSign(state)} onClick={sign} style={{...btn(semantic.brand.primary,true),opacity:isPending(state)?.6:1,cursor:isPending(state)?"not-allowed":"pointer"}}>{state.phase==="SIGNING"?"Firmando…":"Firmar encuentro"}</button>
       <span style={{fontSize:12.5,color:c.muted}}>Acción de alto impacto (C5) sobre <b>esta</b> paciente · requiere confirmación del servidor.</span>
      </div>}

      {state.phase==="SIGNED"&&<div style={{fontSize:12.5,color:c.muted}}>🔏 Firmado por Dr. R. Alarcón · 17 sep 2026 09:41 · <span style={{fontFamily:typography.family.mono}}>sig 4af0…9c</span></div>}
     </div>
    </section>

    <p style={{fontSize:11.5,color:c.muted,borderTop:`1px solid ${c.muted}22`,paddingTop:12}}>
     <b>Invariantes:</b> el estado se codifica en forma, ícono y texto (no solo color). Un pendiente crítico y una firma lista nunca coexisten. Una obligación no se resuelve sin evidencia. Pendiente ≠ éxito. Un registro firmado deja de ser editable y conserva su procedencia.</p>
   </main>

   <aside style={{...S.box,padding:"18px",display:"flex",flexDirection:"column",gap:16}}>
    <div style={{border:`1px solid ${c.muted}22`,borderRadius:primitive.radius.md,padding:"13px 14px",background:"#FBFCFE"}}>
     <h3 style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:c.muted,marginBottom:9}}>Encuentro</h3>
     <KV k="Clínico" v="Dr. R. Alarcón"/><KV k="Propósito" v="Tratamiento"/>
     <KV k="Estado" v={state.phase==="SIGNED"?"Firmado · inmutable":"Borrador · v3"}/>
     <KV k="Readiness" v={v.label}/>
    </div>
    <div>
     <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
      <h3 style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:c.muted}}>Auditoría / timeline</h3>
      <span style={{fontSize:11,color:c.muted}}>{tl.length} eventos</span>
     </div>
     {tl.map((e,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"12px 1fr",gap:10,padding:"9px 0",borderTop:i?`1px dashed ${c.muted}22`:"none"}}>
      <div style={{width:11,height:11,borderRadius:"50%",border:`2px solid ${e.sev==="crit"?semantic.state.critical:e.sev==="ok"?semantic.state.success:c.navy}`,background:e.sev==="sign"?c.navy:c.white,marginTop:3}}/>
      <div><div style={{fontSize:12.5,fontWeight:600}}>{e.t}</div><div style={{fontSize:11.5,color:c.muted}}>{e.d}</div><div style={{fontSize:10.5,color:c.muted,fontFamily:typography.family.mono,marginTop:2}}>{e.h}</div></div>
     </div>)}
    </div>
   </aside>
  </div>
 </div>;
}

function btn(bg:string,solid:boolean):CSSProperties{
 return{display:"inline-flex",gap:8,alignItems:"center",padding:"9px 16px",borderRadius:6,fontWeight:600,fontSize:13.5,
  border:solid?"1px solid transparent":`1px solid ${primitive.color.muted}55`,background:solid?bg:"transparent",color:solid?"#fff":primitive.color.ink,cursor:"pointer"};
}
function Chip({k,v,crit}:{k:string;v:string;crit?:boolean}){
 return <div style={{display:"flex",flexDirection:"column",gap:1,minWidth:74,padding:"6px 11px",borderRadius:primitive.radius.md,
  border:`1px solid ${crit?semantic.state.critical+"88":primitive.color.muted+"33"}`,background:crit?"rgba(201,54,74,.08)":"#FBFCFE"}}>
  <span style={{fontSize:10.5,fontWeight:600,letterSpacing:".05em",textTransform:"uppercase",color:crit?semantic.state.critical:primitive.color.muted}}>{k}</span>
  <span style={{fontSize:17,fontWeight:700,fontVariantNumeric:"tabular-nums",color:crit?semantic.state.critical:primitive.color.ink}}>{v}</span>
 </div>;
}
function KV({k,v}:{k:string;v:string}){
 return <div style={{display:"flex",justifyContent:"space-between",gap:12,padding:"4px 0",fontSize:12.5}}>
  <span style={{color:primitive.color.muted}}>{k}</span><span style={{fontWeight:600,textAlign:"right"}}>{v}</span></div>;
}
function ResultCard({resolved}:{resolved:boolean}){
 const cr=semantic.state.critical,ok=semantic.state.success;
 return <div data-testid="result-card" style={{border:`1px solid ${primitive.color.muted}33`,borderRadius:primitive.radius.md,overflow:"hidden"}}>
  <div style={{display:"flex",gap:12,padding:"12px 14px",borderLeft:`4px solid ${resolved?ok:cr}`}}>
   <span data-testid="result-state" style={{display:"inline-flex",gap:5,alignItems:"center",height:"fit-content",fontSize:10.5,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",padding:"2px 7px",borderRadius:5,border:`1px solid ${(resolved?ok:cr)}88`,color:resolved?ok:cr,background:resolved?"rgba(22,139,91,.10)":"rgba(201,54,74,.08)"}}>
    <span style={{fontWeight:800}}>{resolved?"✓":"▲"}</span>{resolved?"Resuelto · con evidencia":"Crítico · sin resolver"}</span>
   <div style={{minWidth:0,flex:1}}>
    <div style={{fontWeight:600,fontSize:14}}>Potasio sérico (K⁺)</div>
    <div style={{display:"flex",gap:10,alignItems:"baseline",flexWrap:"wrap",marginTop:3}}>
     <span data-testid="result-value" style={{fontSize:22,fontWeight:700,fontVariantNumeric:"tabular-nums",color:resolved?primitive.color.ink:cr}}>7.0</span>
     <span style={{fontSize:13,color:primitive.color.muted,fontWeight:600}}>mEq/L</span>
     <span style={{fontSize:12,color:primitive.color.muted}}>Ref 3.5–5.1 · <span style={{color:cr,fontWeight:600}}>pánico ≥6.5</span></span>
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8,fontSize:11.5,color:primitive.color.muted}}>
     <span><b style={{color:primitive.color.ink}}>Fuente:</b> Laboratorio · verificado</span>
     <span><b style={{color:primitive.color.ink}}>Clase:</b> FACT</span>
     <span style={{color:resolved?primitive.color.muted:cr}}><b>Obligación:</b> {resolved?"cerrada con evidencia":"abierta"}</span>
    </div>
   </div>
  </div>
 </div>;
}
