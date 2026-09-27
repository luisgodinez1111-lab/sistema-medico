import{ClinicalError}from"../../runtime-errors/src";
// EPIC AL — Fold puro del stream de una sesión de diálisis (cuidado renal crónico).
// SM: SCHEDULED -> {IN_SESSION, CANCELLED, NO_SHOW}; IN_SESSION -> {COMPLETED, INTERRUPTED};
// INTERRUPTED -> {IN_SESSION (reanudar), COMPLETED}. COMPLETED/CANCELLED/NO_SHOW son terminales.
// Autoridad: PROD (terapia de reemplazo renal / diálisis), CAP-DIALYSIS-001.
// modality/accessType son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type DialysisState="SCHEDULED"|"IN_SESSION"|"INTERRUPTED"|"COMPLETED"|"CANCELLED"|"NO_SHOW";
export type DialysisEventKind="SCHEDULED"|"STARTED"|"INTERRUPTED"|"RESUMED"|"COMPLETED"|"CANCELLED"|"NO_SHOW";
export type StoredDialysisEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedDialysis=Readonly<{exists:boolean;state:DialysisState;version:number;patientId:string;modality:string;accessType:string}>;

function kindOf(e:StoredDialysisEvent):DialysisEventKind{
 const k=e.payload["kind"];
 if(k==="SCHEDULED"||k==="STARTED"||k==="INTERRUPTED"||k==="RESUMED"||k==="COMPLETED"||k==="CANCELLED"||k==="NO_SHOW")return k;
 if(e.sequence===1&&k===undefined)return "SCHEDULED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown dialysis event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<DialysisEventKind,DialysisState>={SCHEDULED:"SCHEDULED",STARTED:"IN_SESSION",RESUMED:"IN_SESSION",INTERRUPTED:"INTERRUPTED",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED",NO_SHOW:"NO_SHOW"};
export function foldDialysis(events:readonly StoredDialysisEvent[]):FoldedDialysis{
 if(events.length===0)return{exists:false,state:"SCHEDULED",version:0,patientId:"",modality:"",accessType:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:DialysisState="SCHEDULED",patientId="",modality="",accessType="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="SCHEDULED"){patientId=String(e.payload["patientId"]??"");modality=String(e.payload["modality"]??"");accessType=String(e.payload["accessType"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,modality,accessType};
}
const ALLOWED:Partial<Record<DialysisState,readonly DialysisState[]>>={
 SCHEDULED:["IN_SESSION","CANCELLED","NO_SHOW"],IN_SESSION:["COMPLETED","INTERRUPTED"],INTERRUPTED:["IN_SESSION","COMPLETED"],
};
export function assertDialysisTransition(from:DialysisState,to:DialysisState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal dialysis transition ${from} -> ${to}`,{from,to});
}
