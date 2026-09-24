import{type EncounterState,transitionEncounter,ENCOUNTER_INITIAL}from"../../encounter-domain/src";
import{ClinicalError}from"../../runtime-errors/src";
// EPIC D — Fold puro del stream de eventos de un encuentro -> estado actual.
// El kernel NO persiste el tipo de evento como columna (solo aggregate_type + payload), así que
// el discriminador va en payload.kind. El primer evento (sequence 1) es siempre la apertura.
export type EncounterEventKind="OPENED"|"ASSESSED"|"SIGNED";
export type StoredEncounterEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedEncounter=Readonly<{exists:boolean;status:EncounterState;version:number;patientId:string;assessment?:string;plan?:string}>;

function kindOf(e:StoredEncounterEvent):EncounterEventKind{
 const k=e.payload["kind"];
 if(k==="OPENED"||k==="ASSESSED"||k==="SIGNED")return k;
 if(e.sequence===1)return "OPENED"; // compat: encuentros abiertos sin discriminador explícito
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown encounter event at sequence ${e.sequence}`);
}
export function foldEncounter(events:readonly StoredEncounterEvent[]):FoldedEncounter{
 // R02a-ENC-03: sin eventos el agregado NO EXISTE (`exists:false`); el estado que se devuelve es el inicial, y quien lo
 // recibe debe mirar `exists`, no el estado. Antes se devolvía "PLANNED", un estado que ningún evento podía producir.
 if(events.length===0)return{exists:false,status:ENCOUNTER_INITIAL,version:0,patientId:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let status:EncounterState=ENCOUNTER_INITIAL;
 let patientId="",assessment:string|undefined,plan:string|undefined;
 for(const e of ordered){
  switch(kindOf(e)){
   case"OPENED":status="OPEN";patientId=String(e.payload["patientId"]??"");break;
   case"ASSESSED":status="READY_TO_SIGN";assessment=typeof e.payload["assessment"]==="string"?e.payload["assessment"] as string:assessment;plan=typeof e.payload["plan"]==="string"?e.payload["plan"] as string:plan;break;
   case"SIGNED":status="SIGNED";break;
  }
 }
 const version=ordered[ordered.length-1]!.sequence;
 return{exists:true,status,version,patientId,...(assessment!==undefined?{assessment}:{}),...(plan!==undefined?{plan}:{})};
}
// Valida una transición contra la state machine formal; lanza ClinicalError si es ilegal.
export function assertTransition(from:EncounterState,to:EncounterState){
 try{transitionEncounter(from,to);}
 catch{throw new ClinicalError("CONFLICT",`Illegal encounter transition ${from} -> ${to}`,{from,to});}
}
