import{ClinicalError}from"../../runtime-errors/src";
// EPIC AJ — Fold puro del stream de una transfusión sanguínea (con verificación pre-transfusional).
// SM: ORDERED -> {CROSSMATCHED, CANCELLED}; CROSSMATCHED -> {TRANSFUSING, CANCELLED}; TRANSFUSING -> {COMPLETED, REACTION}.
// COMPLETED/REACTION/CANCELLED son terminales. Autoridad: PROD (medicina transfusional / hemovigilancia), CAP-TRANSFUSION-001.
// bloodProduct/units son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type TransfusionState="ORDERED"|"CROSSMATCHED"|"TRANSFUSING"|"COMPLETED"|"REACTION"|"CANCELLED";
export type TransfusionEventKind="ORDERED"|"CROSSMATCHED"|"STARTED"|"COMPLETED"|"REACTION"|"CANCELLED";
export type StoredTransfusionEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedTransfusion=Readonly<{exists:boolean;state:TransfusionState;version:number;patientId:string;bloodProduct:string;units:string}>;

function kindOf(e:StoredTransfusionEvent):TransfusionEventKind{
 const k=e.payload["kind"];
 if(k==="ORDERED"||k==="CROSSMATCHED"||k==="STARTED"||k==="COMPLETED"||k==="REACTION"||k==="CANCELLED")return k;
 if(e.sequence===1&&k===undefined)return "ORDERED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown transfusion event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<TransfusionEventKind,TransfusionState>={ORDERED:"ORDERED",CROSSMATCHED:"CROSSMATCHED",STARTED:"TRANSFUSING",COMPLETED:"COMPLETED",REACTION:"REACTION",CANCELLED:"CANCELLED"};
export function foldTransfusion(events:readonly StoredTransfusionEvent[]):FoldedTransfusion{
 if(events.length===0)return{exists:false,state:"ORDERED",version:0,patientId:"",bloodProduct:"",units:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:TransfusionState="ORDERED",patientId="",bloodProduct="",units="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="ORDERED"){patientId=String(e.payload["patientId"]??"");bloodProduct=String(e.payload["bloodProduct"]??"");units=String(e.payload["units"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,bloodProduct,units};
}
const ALLOWED:Partial<Record<TransfusionState,readonly TransfusionState[]>>={
 ORDERED:["CROSSMATCHED","CANCELLED"],CROSSMATCHED:["TRANSFUSING","CANCELLED"],TRANSFUSING:["COMPLETED","REACTION"],
};
export function assertTransfusionTransition(from:TransfusionState,to:TransfusionState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal transfusion transition ${from} -> ${to}`,{from,to});
}
