import{type ResultState}from"../../order-result-domain/src";
import{ClinicalError}from"../../runtime-errors/src";
// EPIC G — Fold puro del stream de eventos de un resultado diagnóstico -> estado actual.
// Discriminador en payload.kind (RECEIVED/VERIFIED/ACTIONED/CLOSED); el primer evento es RECEIVED.
// Subconjunto de la SM formal de order-result-domain para el closed-loop de seguimiento.
export type ResultEventKind="RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED";
export type StoredResultEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedResult=Readonly<{exists:boolean;state:ResultState;version:number;patientId:string;critical:boolean}>;

function kindOf(e:StoredResultEvent):ResultEventKind{
 const k=e.payload["kind"];
 if(k==="RECEIVED"||k==="VERIFIED"||k==="ACTIONED"||k==="CLOSED")return k;
 if(e.sequence===1)return "RECEIVED";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown result event at sequence ${e.sequence}`);
}
export function foldResult(events:readonly StoredResultEvent[]):FoldedResult{
 if(events.length===0)return{exists:false,state:"EXPECTED",version:0,patientId:"",critical:false};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:ResultState="EXPECTED",patientId="",critical=false;
 for(const e of ordered){
  switch(kindOf(e)){
   case"RECEIVED":state="RECEIVED";patientId=String(e.payload["patientId"]??"");critical=e.payload["critical"]===true;break;
   case"VERIFIED":state="VERIFIED";break;
   case"ACTIONED":state="ACTIONED";break; // acción requerida -> obligación abierta
   case"CLOSED":state="CLOSED";break;
  }
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,critical};
}
// Transiciones permitidas del closed-loop (subconjunto determinista de la SM formal).
const ALLOWED:Partial<Record<ResultState,readonly ResultState[]>>={
 RECEIVED:["VERIFIED"],VERIFIED:["ACTIONED"],ACTIONED:["CLOSED"],
};
export function assertResultTransition(from:ResultState,to:ResultState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal result transition ${from} -> ${to}`,{from,to});
}
