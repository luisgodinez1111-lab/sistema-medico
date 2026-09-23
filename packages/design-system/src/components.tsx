"use client";
// Design System v3.2 — componentes. Auditoría 2026-09-19 (K-09): el design system solo tenía tokens y los seis componentes
// que documentaba el Storybook perdido (Alert, AllergyBanner, Badge, Button, Card, PatientHeader) no existían como código.
// Aquí están como fuente real, construidos sobre los tokens, y el workspace los consume (page.tsx, shared.tsx, views/exp.tsx).
// Son presentacionales y sin estado: la verdad clínica la decide quien los usa; ellos garantizan anatomía, accesibilidad
// (roles ARIA correctos, el estado nunca se comunica solo por color) y contraste AA (tests/v22/design-system-contrast.test.ts).
import React,{useId} from "react";
import {primitive,semantic,typography} from "./tokens";

const P=primitive.color,S=primitive.space,UI=typography.family.ui;
export const LINE="#E4E9F2";

// ── Tonos semánticos: fondo claro + texto oscuro del mismo matiz. Cada par cumple AA (≥4.5:1).
export type Tone="neutral"|"info"|"brand"|"success"|"attention"|"critical";
export const TONE:Readonly<Record<Tone,Readonly<{bg:string;fg:string;bd:string}>>>={
 neutral:{bg:"#F1F1F4",fg:"#5F6072",bd:"#DCDDE4"},
 info:{bg:"#EAF3FF",fg:"#1F5FB0",bd:"#CFE0F7"},
 brand:{bg:"#EEF0FF",fg:"#3F3AA0",bd:"#D8DAF5"},
 success:{bg:"#E8F7EE",fg:"#1A7F43",bd:"#CDEBD8"},
 attention:{bg:"#FFF4E5",fg:"#A15C00",bd:"#F0DBB8"},
 critical:{bg:"#FDEAEA",fg:"#B3261E",bd:"#F3C9C9"},
};

// ── Estilos base (los mismos objetos que el workspace usa como `btn`, `ghost`, `card`, `input`).
export type ButtonVariant="primary"|"ghost"|"success"|"danger";
const BUTTON_BASE:React.CSSProperties={border:0,borderRadius:primitive.radius.md,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontSize:typography.size.base,fontFamily:UI};
export const buttonStyle:Readonly<Record<ButtonVariant,React.CSSProperties>>={
 primary:{...BUTTON_BASE,background:semantic.brand.primary,color:P.white},
 ghost:{...BUTTON_BASE,background:"transparent",color:semantic.brand.primary,border:"1px solid #CFE0F7"},
 success:{...BUTTON_BASE,background:semantic.state.success,color:P.white},
 danger:{...BUTTON_BASE,background:semantic.state.critical,color:P.white},
};
export const cardStyle:React.CSSProperties={background:P.white,border:`1px solid ${LINE}`,borderRadius:16,padding:S[6],boxShadow:"0 1px 2px rgba(16,42,86,.04),0 8px 24px rgba(16,42,86,.05)",marginTop:S[5]};
export const inputStyle:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"10px 12px",border:`1px solid ${LINE}`,borderRadius:primitive.radius.md,fontSize:typography.size.base,fontFamily:"inherit",background:P.white,color:P.ink};
export const badgeStyle=(tone:Tone):React.CSSProperties=>({display:"inline-block",background:TONE[tone].bg,color:TONE[tone].fg,fontWeight:700,fontSize:typography.size.xs,padding:"3px 10px",borderRadius:999});

// Estado clínico (máquinas de estado de los agregados) → tono. Lo que no está aquí es "en curso" (brand), nunca verde.
export const STATE_TONE:Readonly<Record<string,Tone>>={
 SIGNED:"success",ACTIVE:"success",CLOSED:"success",AMENDED:"success",FULFILLED:"success",COMPLETED:"success",ADMINISTERED:"success",RECORDED:"success",ACHIEVED:"success",PAID:"success",GRANTED:"success",ADMITTED:"success",RESULTED:"success",HEALED:"success",
 READY_TO_SIGN:"attention",ACTIONED:"attention",IN_PROGRESS:"attention",CHRONIC:"attention",CHECKED_IN:"attention",ON_HOLD:"attention",SUBMITTED:"attention",PRESENTED:"attention",TRANSFERRED:"attention",UNDER_REVIEW:"attention",IN_TRIAGE:"attention",TRANSFUSING:"attention",IN_SESSION:"attention",
 OPEN:"brand",PROPOSED:"brand",RECEIVED:"brand",DRAFT:"brand",ACTIVE_PROB:"brand",REQUESTED:"brand",SCHEDULED:"brand",DUE:"brand",DRAFTED:"brand",DISCHARGED:"brand",COLLECTED:"brand",WAITING:"brand",
 PRESCRIBED:"info",VERIFIED:"info",FINALIZED:"info",ORDERED:"info",ACCEPTED:"info",CODED:"info",TRIAGED:"info",CROSSMATCHED:"info",TIMED_OUT:"info",
 STOPPED:"neutral",CANCELLED:"neutral",RESOLVED:"neutral",ENTERED_IN_ERROR:"neutral",REFUTED:"neutral",INACTIVE:"neutral",DECLINED:"neutral",NO_SHOW:"neutral",VOIDED:"neutral",REVOKED:"neutral",LWBS:"neutral",
 ADVERSE_EVENT:"critical",REJECTED:"critical",ESCALATED:"critical",REACTION:"critical",INTERRUPTED:"critical",
};
export const toneOfState=(state:string):Tone=>STATE_TONE[state]??"brand";

// ── Button: siempre `type="button"` salvo que se pida otro; `busy` bloquea y se anuncia (aria-busy).
export type ButtonProps=Omit<React.ButtonHTMLAttributes<HTMLButtonElement>,"style">&Readonly<{variant?:ButtonVariant;busy?:boolean;style?:React.CSSProperties}>;
export function Button({variant="primary",busy=false,disabled=false,style,type="button",children,...rest}:ButtonProps){
 const off=disabled||busy;
 return <button type={type} disabled={off} aria-busy={busy||undefined} style={{...buttonStyle[variant],...(off?{opacity:.55,cursor:"not-allowed"}:{}),...style}} {...rest}>{children}</button>;
}

// ── Card: superficie elevada. Con `title` añade el encabezado y lo enlaza (aria-labelledby) para lectores de pantalla.
export type CardProps=Omit<React.HTMLAttributes<HTMLDivElement>,"style"|"title">&Readonly<{title?:string;titleId?:string;style?:React.CSSProperties}>;
export function Card({title,titleId,style,children,...rest}:CardProps){
 const autoId=useId();
 const id=title?(titleId??`card-${autoId}`):undefined;
 return <div style={{...cardStyle,...style}} {...(id?{"aria-labelledby":id}:{})} {...rest}>
  {title&&<h2 id={id} style={{margin:"0 0 10px",fontSize:typography.size.md}}>{title}</h2>}
  {children}
 </div>;
}

// ── Badge: etiqueta de estado. El texto ES el estado (nunca solo el color).
export type BadgeProps=Readonly<{tone?:Tone;title?:string;style?:React.CSSProperties;children:React.ReactNode}>;
export function Badge({tone="neutral",title,style,children}:BadgeProps){
 return <span {...(title?{title}:{})} style={{...badgeStyle(tone),...style}}>{children}</span>;
}
export function StateBadge({state}:Readonly<{state:string}>){return <Badge tone={toneOfState(state)}>{state}</Badge>;}

// ── Alert: aviso en línea. Crítico ⇒ role="alert" (interrumpe al lector de pantalla); el resto ⇒ role="status".
export type AlertProps=Readonly<{tone:Exclude<Tone,"neutral"|"brand">;title?:string;children:React.ReactNode;action?:React.ReactNode;style?:React.CSSProperties}>;
export function Alert({tone,title,children,action,style}:AlertProps){
 const c=TONE[tone];
 return <div role={tone==="critical"?"alert":"status"} style={{padding:"10px 14px",borderRadius:12,background:c.bg,border:`1px solid ${c.bd}`,color:c.fg,fontSize:13.5,fontWeight:600,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",fontFamily:UI,...style}}>
  <span style={{flex:"1 1 auto",minWidth:0}}>{title&&<b style={{display:"block",marginBottom:2}}>{title}</b>}{children}</span>
  {action&&<span style={{marginLeft:"auto",flex:"0 0 auto"}}>{action}</span>}
 </div>;
}

// ── AllergyBanner: alergias del paciente. Estado prohibido UNKNOWN+NORMAL: si el expediente no se cargó, NUNCA se
// presenta como "sin alergias"; y un registro vacío es "sin alergias documentadas", no "sin alergias".
export type AllergyBannerProps=Readonly<{allergies:readonly string[]|null;max?:number;style?:React.CSSProperties}>;
export function AllergyBanner({allergies,max=5,style}:AllergyBannerProps){
 if(allergies===null)return <div role="status" data-allergy-state="unknown" style={{display:"flex",alignItems:"center",gap:8,fontSize:13.5,color:TONE.attention.fg,fontWeight:600,...style}}>
  <span aria-hidden style={{width:8,height:8,borderRadius:"50%",background:TONE.attention.fg,flex:"0 0 auto"}}/>Alergias no evaluadas: el expediente no se cargó
 </div>;
 if(allergies.length===0)return <div data-allergy-state="none" style={{display:"flex",alignItems:"center",gap:8,fontSize:13.5,color:TONE.success.fg,fontWeight:600,...style}}>✓ Sin alergias documentadas</div>;
 const shown=allergies.slice(0,max),rest=allergies.length-shown.length;
 return <ul aria-label="Alergias documentadas" data-allergy-state="present" style={{listStyle:"none",margin:0,padding:0,display:"flex",flexDirection:"column",gap:6,...style}}>
  {shown.map(a=><li key={a} style={{display:"flex",alignItems:"center",gap:8,fontSize:13.5,color:TONE.critical.fg,fontWeight:600}}><span aria-hidden style={{width:8,height:8,borderRadius:"50%",background:TONE.critical.fg,flex:"0 0 auto"}}/>{a}</li>)}
  {rest>0&&<li style={{fontSize:12.5,color:P.muted}}>y {rest} más</li>}
 </ul>;
}

// ── PatientHeader: contexto del paciente SIEMPRE visible (design-contract). Anatomía: identidad (iniciales, nombre,
// identificador), estado de seguridad (`status`: chips que decide el modelo) y acciones.
export type PatientHeaderProps=Readonly<{name:string;patientId:string;status?:React.ReactNode;actions?:React.ReactNode;style?:React.CSSProperties}>;
export const patientHeaderStyle:React.CSSProperties={position:"sticky",top:57,zIndex:25,background:"rgba(255,255,255,.92)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",borderBottom:`1px solid ${LINE}`,padding:"11px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16};
export function PatientHeader({name,patientId,status,actions,style}:PatientHeaderProps){
 const named=name.trim()!=="";
 return <section aria-label="Paciente activo" style={{...patientHeaderStyle,...style}}>
  <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
   <span aria-hidden style={{width:38,height:38,borderRadius:"50%",background:named?"#E7EEFB":"#EFF1F5",color:named?semantic.brand.primary:P.muted,display:"grid",placeItems:"center",fontWeight:700,fontSize:14,flex:"0 0 auto"}}>{named?name.trim().slice(0,2).toUpperCase():"—"}</span>
   <div style={{minWidth:0}}>
    <div style={{fontSize:15,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:P.ink}}>{named?name:"Paciente anónimo"}</div>
    <div style={{fontSize:12,color:P.muted,marginTop:1}}>ID <span style={{fontFamily:typography.family.mono,fontSize:12,background:"#EEF3FB",color:"#33507D",padding:"2px 6px",borderRadius:6}}>{patientId.slice(0,8)}</span> · paciente activo del expediente</div>
   </div>
  </div>
  <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",justifyContent:"flex-end"}}>{status}{actions}</div>
 </section>;
}
