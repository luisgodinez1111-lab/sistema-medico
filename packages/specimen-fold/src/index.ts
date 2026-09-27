import{ClinicalError}from"../../runtime-errors/src";
// EPIC AF — Fold puro del stream de una muestra de laboratorio (cadena de custodia, fase pre-analítica).
// SM: COLLECTED -> {IN_TRANSIT, REJECTED}; IN_TRANSIT -> {RECEIVED, REJECTED}; RECEIVED -> {RESULTED, REJECTED}.
// RESULTED/REJECTED son terminales. Autoridad: PROD (trazabilidad de muestras / seguridad de laboratorio), CAP-SPECIMEN-001.
// specimenType/orderId son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type SpecimenState="COLLECTED"|"IN_TRANSIT"|"RECEIVED"|"RESULTED"|"REJECTED";
export type SpecimenEventKind="COLLECTED"|"IN_TRANSIT"|"RECEIVED"|"RESULTED"|"REJECTED";
export type StoredSpecimenEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedSpecimen=Readonly<{exists:boolean;state:SpecimenState;version:number;patientId:string;specimenType:string;orderId:string}>;

function kindOf(e:StoredSpecimenEvent):SpecimenEventKind{
 const k=e.payload["kind"];
 if(k==="COLLECTED"||k==="IN_TRANSIT"||k==="RECEIVED"||k==="RESULTED"||k==="REJECTED")return k;
 if(e.sequence===1&&k===undefined)return "COLLECTED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown specimen event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<SpecimenEventKind,SpecimenState>={COLLECTED:"COLLECTED",IN_TRANSIT:"IN_TRANSIT",RECEIVED:"RECEIVED",RESULTED:"RESULTED",REJECTED:"REJECTED"};
export function foldSpecimen(events:readonly StoredSpecimenEvent[]):FoldedSpecimen{
 if(events.length===0)return{exists:false,state:"COLLECTED",version:0,patientId:"",specimenType:"",orderId:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:SpecimenState="COLLECTED",patientId="",specimenType="",orderId="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="COLLECTED"){patientId=String(e.payload["patientId"]??"");specimenType=String(e.payload["specimenType"]??"");orderId=String(e.payload["orderId"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,specimenType,orderId};
}
const ALLOWED:Partial<Record<SpecimenState,readonly SpecimenState[]>>={
 COLLECTED:["IN_TRANSIT","REJECTED"],IN_TRANSIT:["RECEIVED","REJECTED"],RECEIVED:["RESULTED","REJECTED"],
};
export function assertSpecimenTransition(from:SpecimenState,to:SpecimenState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal specimen transition ${from} -> ${to}`,{from,to});
}
