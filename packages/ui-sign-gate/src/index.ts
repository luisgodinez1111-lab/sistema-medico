// GUX-001 — Máquina de estados del SignGate. "Los componentes canónicos son máquinas de estado, no fragmentos
// visuales" (contrato §5). Núcleo PURO y testeable: transiciones, guard de estados prohibidos, evidencia
// obligatoria, pending≠success. El componente React solo renderiza este view-model.
import{assertNoForbidden}from"../../design-system/src";

export type SignPhase="BLOCKED"|"RESOLVING"|"READY"|"SIGNING"|"SIGNED";
export type SignGateState=Readonly<{phase:SignPhase;criticalOpen:number;evidence:string}>;
export type SignGateEvent=
 |{type:"RESOLVE";evidence:string}
 |{type:"ACKNOWLEDGE"}
 |{type:"RESOLUTION_CONFIRMED"}   // confirmación autoritativa del servidor
 |{type:"SIGN"}
 |{type:"SIGN_CONFIRMED"};        // confirmación autoritativa del servidor
export const MIN_EVIDENCE=12;
export class SignGateError extends Error{}

export function initialSignGate(criticalOpen:number):SignGateState{
 return{phase:criticalOpen>0?"BLOCKED":"READY",criticalOpen,evidence:""};
}
// Etiquetas semánticas activas para el guard de estados prohibidos (vocabulario del contrato).
export function activeTags(s:SignGateState):string[]{
 const t:string[]=[];
 if(s.criticalOpen>0)t.push("CRITICAL_OPEN");
 if(s.phase==="READY"||s.phase==="SIGNING")t.push("SIGN_READY");
 if(s.phase==="SIGNED")t.push("SIGNED_STYLE");
 else t.push("DRAFT"); // borrador hasta firmar (nunca DRAFT+SIGNED_STYLE)
 if(s.phase==="RESOLVING"||s.phase==="SIGNING")t.push("UNKNOWN_COMMIT_STATE"); // pendiente
 return t;
}
export function isPending(s:SignGateState):boolean{return s.phase==="RESOLVING"||s.phase==="SIGNING";}
export function canSign(s:SignGateState):boolean{return s.phase==="READY";}

export function signGateReducer(s:SignGateState,e:SignGateEvent):SignGateState{
 let next:SignGateState;
 switch(e.type){
  case"ACKNOWLEDGE": next=s; break; // reconocer NO resuelve (ACKNOWLEDGED != RESOLVED)
  case"RESOLVE":
   if(s.phase!=="BLOCKED")throw new SignGateError("RESOLVE_ONLY_FROM_BLOCKED");
   if(e.evidence.trim().length<MIN_EVIDENCE)throw new SignGateError("EVIDENCE_REQUIRED"); // sin evidencia no hay cierre
   next={...s,phase:"RESOLVING",evidence:e.evidence.trim()}; break;
  case"RESOLUTION_CONFIRMED":
   if(s.phase!=="RESOLVING")throw new SignGateError("CONFIRM_ONLY_FROM_RESOLVING");
   next={...s,phase:"READY",criticalOpen:0}; break;
  case"SIGN":
   if(s.phase!=="READY")throw new SignGateError("SIGN_ONLY_FROM_READY");
   next={...s,phase:"SIGNING"}; break;
  case"SIGN_CONFIRMED":
   if(s.phase!=="SIGNING")throw new SignGateError("SIGN_CONFIRM_ONLY_FROM_SIGNING");
   next={...s,phase:"SIGNED"}; break;
  default:{const _x:never=e;throw new SignGateError("UNKNOWN_EVENT");}
 }
 assertNoForbidden(activeTags(next)); // p.ej. CRITICAL_OPEN+SIGN_READY jamás coexisten
 return next;
}

export type GateTone="critical"|"pending"|"ready"|"signed";
export type GateViewModel=Readonly<{tone:GateTone;label:string;title:string;why:string;testid:string}>;
export function gateView(s:SignGateState):GateViewModel{
 switch(s.phase){
  case"BLOCKED":return{tone:"critical",label:"Firma bloqueada",title:"No se puede firmar el encuentro",why:"Hay un resultado crítico sin resolver que debe atenderse antes de la firma.",testid:"gate-blocked"};
  case"RESOLVING":return{tone:"pending",label:"Confirmando…",title:"Cerrando el pendiente con el servidor",why:"Escritura enviada. La firma sigue bloqueada hasta la confirmación autoritativa — pendiente no es éxito.",testid:"gate-resolving"};
  case"READY":return{tone:"ready",label:"Listo para firmar",title:"Sin pendientes críticos abiertos",why:"El resultado crítico fue resuelto con evidencia. Readiness re-verificada: 0 pendientes críticos.",testid:"gate-ready"};
  case"SIGNING":return{tone:"pending",label:"Firmando…",title:"Confirmando la firma con el servidor",why:"La firma no se muestra como exitosa hasta la confirmación autoritativa del servidor.",testid:"gate-signing"};
  case"SIGNED":return{tone:"signed",label:"Encuentro firmado",title:"Registro firmado e inmutable",why:"El registro deja de ser editable y conserva su procedencia y hash de auditoría.",testid:"gate-signed"};
 }
}
