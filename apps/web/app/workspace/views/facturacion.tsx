"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09): vista "facturacion" del workspace, extraída de page.tsx sin cambios
// en su JSX ni en su lógica. Toma del contexto solo lo que usa.
import {apiRequest} from "../../../lib/session-client";
import{card,P,LINE,UI,act,type ClaimsRegistry}from"../shared";
import{useWorkspace}from"../context";
export default function FacturacionView(){
 const{cfgSettings,claimsReg,nfConcepts,setNfConcepts,nfPatientId,patientId,setNfMsg,setNfBusy,setClaimsReg,setNfPatientId,patientList,patientName,nfMsg,nfBusy}=useWorkspace();

   // ===== MÓDULO FACTURACIÓN (S-FACTURACION) — registro clínica-wide cableado a GET /claims; emisión -> POST /claims =====
   const card2:React.CSSProperties={...card,marginTop:0};
   const initials=(n:string)=>n.split(" ").filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
   const money=(n:number)=>"$"+n.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});
   const fmtD=(iso:string)=>{if(!iso)return"—";const d=new Date(iso);return isNaN(d.getTime())?"—":d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
   const claimsLoaded=!!claimsReg;
   type FRow={folio:string;date:string;patient:string;total:number;estado:string};
   const rows:FRow[]=(claimsReg?.items??[]).slice(0,20).map(it=>({folio:it.folio,date:fmtD(it.recordedAt),patient:it.patientName,total:it.amount,estado:it.statusLabel}));
   const kIngresos=claimsReg?.incomeThisMonth??0;
   const kEmitidas=claimsReg?.issuedCount??0;
   const kPend=claimsReg?.pendingCount??0,kPendAmt=claimsReg?.pendingAmount??0;
   const kCanc=claimsReg?.cancellations??0;
   const nfTotal=nfConcepts.reduce((s,c)=>s+c.qty*c.price,0);
   const setConcept=(i:number,patch:Partial<{desc:string;qty:number;price:number}>)=>setNfConcepts(nfConcepts.map((c,j)=>j===i?{...c,...patch}:c));
   const billTo=nfPatientId||patientId;
   const emit=async()=>{
    if(!billTo){setNfMsg("Selecciona un paciente para emitir la factura.");return;}
    if(nfTotal<=0){setNfMsg("Agrega al menos un concepto con importe.");return;}
    setNfBusy(true);setNfMsg("");
    try{const r=await apiRequest("/api/v1/claims",{method:"POST",body:{claimId:crypto.randomUUID(),patientId:billTo,amount:String(nfTotal),currency:"MXN",occurredAt:new Date().toISOString()}});
     if(r.status===201||r.status===200){setNfMsg("Factura emitida ✓");const g=await apiRequest("/api/v1/claims",{method:"GET"});if(g.status===200)setClaimsReg(g.body as unknown as ClaimsRegistry);}
     else setNfMsg("No se pudo emitir (estado "+r.status+").");
    }catch{setNfMsg("Error al emitir la factura.");}finally{setNfBusy(false);}
   };
   const estSty=(k:string):React.CSSProperties=>{const m:Record<string,[string,string]>={Pagada:["#E6F6EE",P.greenOnPale],Pendiente:["#FBF0DC",P.amberOnPale],Cancelada:["#EEF1F7",P.muted],Rechazada:["#FDECEE",P.redOnPale]};const[b,f]=m[k]??m.Pendiente!;return{background:b,color:f,borderRadius:16,padding:"3px 12px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"};};
   const kico=(bg:string,fg:string,d:string)=><span style={{width:48,height:48,borderRadius:"50%",background:bg,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8" aria-hidden><path d={d}/></svg></span>;
   const th:React.CSSProperties={textAlign:"left",fontSize:11.5,color:P.muted,fontWeight:600,padding:"11px 12px",borderBottom:`1px solid ${LINE}`,whiteSpace:"nowrap"};
   const tdc:React.CSSProperties={padding:"10px 12px",borderBottom:`1px solid #F2F4F9`,fontSize:12.5,whiteSpace:"nowrap"};
   const selSty:React.CSSProperties={width:"100%",border:`1px solid ${LINE}`,borderRadius:9,padding:"9px 11px",fontSize:13,background:P.white,fontFamily:UI,color:P.ink};
   const stepN=(n:number)=><span style={{width:20,height:20,borderRadius:"50%",background:P.purple,color:"#fff",display:"grid",placeItems:"center",fontSize:11,fontWeight:700,flex:"0 0 auto"}}>{n}</span>;
   return <div style={{padding:"18px 24px 40px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
     <div style={{display:"flex",alignItems:"flex-start",gap:14}}><span style={{width:46,height:46,borderRadius:12,background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",flex:"0 0 auto"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1zM9 12h6M9 16h4"/></svg></span><div><h1 style={{fontSize:28,fontWeight:800,margin:0,letterSpacing:"-.02em"}}>Facturación</h1><p style={{color:P.muted,fontSize:13.5,margin:"4px 0 0"}}>Emite facturas, controla pagos y administra tus ingresos.</p></div></div>
     <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={{border:0,background:P.purple,color:"#fff",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13.5,cursor:"pointer",fontFamily:UI}} onClick={()=>{setNfConcepts([{desc:"Consulta médica",qty:1,price:500}]);setNfPatientId("");setNfMsg("");}}>+ Nueva factura</button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}} className="mos-kpis">
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#E6F6EE",P.greenOnPale,"M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6")}<div><div style={{fontSize:24,fontWeight:800}}>{money(kIngresos)}</div><div style={{fontSize:11.5,color:P.muted}}>Ingresos del mes{claimsReg?.incomePeriod?` (${claimsReg.incomePeriod})`:""}</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#E7EEFB",P.blue,"M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z")}<div><div style={{fontSize:24,fontWeight:800}}>{kEmitidas}</div><div style={{fontSize:11.5,color:P.muted}}>Facturas emitidas</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#FBF0DC",P.amber,"M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z")}<div><div style={{fontSize:24,fontWeight:800}}>{kPend}</div><div style={{fontSize:11.5,color:P.muted}}>Pendientes de pago</div><div style={{fontSize:11.5,color:P.amber,fontWeight:700,marginTop:2}}>{money(kPendAmt)}</div></div></div>
     <div style={{...card2,padding:16,display:"flex",gap:13,alignItems:"center"}}>{kico("#FDECEE",P.red,"M18 6L6 18M6 6l12 12")}<div><div style={{fontSize:24,fontWeight:800}}>{kCanc}</div><div style={{fontSize:11.5,color:P.muted}}>Cancelaciones</div></div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 380px",gap:16,marginTop:16,alignItems:"start"}} className="mos-fac">
     {/* Columna izquierda: tabla + gráficas */}
     <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{...card2,padding:0,overflow:"hidden"}}>
       <div style={{padding:"14px 16px",fontSize:16,fontWeight:800}}>Facturas ({rows.length})</div>
       <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><th style={th}>Folio</th><th style={th}>Fecha</th><th style={th}>Paciente</th><th style={{...th,textAlign:"right"}}>Total</th><th style={th}>Estado</th></tr></thead>
        <tbody>{rows.length===0?<tr><td colSpan={5} style={{...tdc,textAlign:"center",color:P.muted,padding:"36px 12px"}}>{claimsLoaded?"Aún no hay facturas emitidas. Usa «Nueva factura».":"Cargando facturas…"}</td></tr>:rows.map((r,i)=><tr key={i}><td style={{...tdc,fontWeight:700,color:P.ink}}>{r.folio}</td><td style={{...tdc,color:P.muted}}>{r.date}</td><td style={tdc}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:26,height:26,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:10,fontWeight:700,flex:"0 0 auto"}}>{initials(r.patient)}</span><span style={{fontWeight:600}}>{r.patient}</span></div></td><td style={{...tdc,textAlign:"right",fontWeight:700}}>{money(r.total)}</td><td style={tdc}><span style={estSty(r.estado)}>{r.estado}</span></td></tr>)}</tbody>
       </table></div>
       {rows.length>0&&<div style={{padding:"13px 16px",fontSize:13,color:P.muted}}>Mostrando {rows.length} de {kEmitidas} factura(s)</div>}
      </div>
     </div>
     {/* Columna derecha: Nueva factura */}
     <div style={{...card2,padding:18}}>
      <div style={{fontSize:17,fontWeight:800,marginBottom:14}}>Nueva factura</div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>{stepN(1)}<span style={{fontSize:13.5,fontWeight:700}}>Paciente</span></div>
      {(()=>{const bill=nfPatientId||patientId;const bp=(patientList??[]).find(p=>p.patientId===bill);const bname=bp?bp.name:(nfPatientId?"":patientName);return <>
       <select value={nfPatientId||(patientId&&bp?patientId:"")} onChange={e=>setNfPatientId(e.target.value)} style={{...selSty,marginBottom:8}}><option value="">Selecciona un paciente…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select>
       {bname?<div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:`1px solid ${LINE}`,borderRadius:10,marginBottom:16}}><span style={{width:34,height:34,borderRadius:"50%",background:"#EEEBFD",color:P.purple,display:"grid",placeItems:"center",fontSize:12,fontWeight:700}}>{initials(bname)}</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700}}>{bname}</div><div style={{fontSize:11,color:P.muted,fontFamily:"monospace"}}>{bp?.curp?`CURP: ${bp.curp}`:"Paciente del tenant"}</div></div></div>:<div style={{fontSize:12,color:P.muted,marginBottom:16}}>Elige el paciente al que se emitirá la factura.</div>}
      </>;})()}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:8}}>{stepN(2)}<span style={{fontSize:13.5,fontWeight:700}}>Conceptos</span></div><button onClick={()=>setNfConcepts([...nfConcepts,{desc:"Nuevo concepto",qty:1,price:0}])} style={{border:`1px solid ${P.purple}`,background:P.white,color:P.purple,borderRadius:8,padding:"6px 11px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:UI}}>+ Agregar concepto</button></div>
      <div style={{fontSize:11,color:P.muted,display:"grid",gridTemplateColumns:"1fr 46px 62px 62px 20px",gap:6,padding:"0 2px 4px",fontWeight:600}}><span>Descripción</span><span>Cant.</span><span style={{textAlign:"right"}}>Precio</span><span style={{textAlign:"right"}}>Importe</span><span/></div>
      {nfConcepts.map((c,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 46px 62px 62px 20px",gap:6,alignItems:"center",padding:"4px 0"}}><input value={c.desc} onChange={e=>setConcept(i,{desc:e.target.value})} style={{...selSty,padding:"7px 8px",fontSize:12.5}}/><input value={c.qty} onChange={e=>setConcept(i,{qty:Number(e.target.value)||0})} style={{...selSty,padding:"7px 4px",fontSize:12.5,textAlign:"center"}}/><input value={c.price} onChange={e=>setConcept(i,{price:Number(e.target.value)||0})} style={{...selSty,padding:"7px 6px",fontSize:12.5,textAlign:"right"}}/><span style={{fontSize:12.5,fontWeight:600,textAlign:"right"}}>{money(c.qty*c.price)}</span><span {...act(()=>setNfConcepts(nfConcepts.filter((_,j)=>j!==i)))} style={{color:P.red,cursor:"pointer",textAlign:"center"}}>🗑</span></div>)}
      <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${LINE}`,display:"flex",flexDirection:"column",gap:6,fontSize:13}}>
       <div style={{display:"flex",justifyContent:"space-between",color:P.muted}}><span>Subtotal</span><span style={{fontWeight:600,color:P.ink}}>{money(nfTotal)}</span></div>
       {/* Auditoría R05c-02: Configuración ofrece una tasa de IVA (16 % por omisión) y aquí se afirmaba «IVA (0%)» fijo: dos
          partes del producto contradiciéndose. El importe que se registra NO se toca —aplicar IVA sin CFDI es una decisión de
          negocio, anotada en ADR-0300—, pero la pantalla deja de esconder la discrepancia. */}
      <div style={{display:"flex",justifyContent:"space-between",color:P.muted}}><span>IVA{cfgSettings.regTaxRate.trim()?` (configurado ${cfgSettings.regTaxRate}%, no aplicado)`:" (0%)"}</span><span style={{fontWeight:600,color:P.ink}}>{money(0)}</span></div>
       <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800}}><span>Total</span><span>{money(nfTotal)}</span></div>
      </div>
      <div style={{fontSize:11.5,color:P.muted,margin:"14px 0 10px"}}>Se registra el cargo (monto y paciente) en el expediente. Este módulo NO emite CFDI: la facturación fiscal (PAC, uso, régimen, método de pago) no está implementada.</div>
      {nfMsg&&<div style={{marginBottom:10,padding:"9px 12px",borderRadius:9,background:nfMsg.includes("✓")?"#E6F6EE":"#FDF4E6",border:`1px solid ${nfMsg.includes("✓")?"#BFE6CF":"#F2E1C0"}`,fontSize:12.5,color:nfMsg.includes("✓")?"#166534":"#7A5A16"}}>{nfMsg}</div>}
      <button onClick={emit} disabled={nfBusy||!billTo||nfTotal<=0} style={{width:"100%",border:0,background:(nfBusy||!billTo||nfTotal<=0)?"#C7CCE0":P.purple,color:"#fff",borderRadius:10,padding:"12px",fontWeight:700,fontSize:14,cursor:(nfBusy||!billTo||nfTotal<=0)?"default":"pointer",fontFamily:UI}}>{nfBusy?"Registrando…":"Registrar cargo"}</button>
     </div>
    </div>
   </div>;
  
}
