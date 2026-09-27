// EPIC R — Fold puro del stream de eventos de historia clínica adaptativa.
// Captura: Chief Complaint, HPI adaptativo (preguntas dinámicas), ROS estructurado.
// Cada hallazgo tiene estado epistémico explícito (EXEC-0010): NOT_ASKED/NEGATIVE/POSITIVE/NOT_APPLICABLE/UNABLE_TO_ASSESS.
// Autoridad: PROD (historia clínica), CAP-ADAPTIVE-HISTORY-001.
import{ClinicalError}from"../../runtime-errors/src";

export type FindingState="NOT_ASKED"|"NEGATIVE"|"POSITIVE"|"NOT_APPLICABLE"|"UNABLE_TO_ASSESS";
export type HistoryEventKind="CHIEF_COMPLAINT"|"HPI_FINDING"|"ROS_FINDING"|"PHYSICAL_FINDING"|"HPI_COMPLETED"|"ROS_COMPLETED";
export type StoredHistoryEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedHistory=Readonly<{exists:boolean;version:number;patientId:string;encounterId:string;chiefComplaint:string;findings:readonly Finding[]}>;
export type Finding=Readonly<{id:string;section:"HPI"|"ROS"|"PHYSICAL";question:string;state:FindingState;answer:string;evidenceFor:string[];evidenceAgainst:string[];confidence:number;source:string}>;

function kindOf(e:StoredHistoryEvent):HistoryEventKind{
 const k=e.payload["kind"];
 if(k==="CHIEF_COMPLAINT"||k==="HPI_FINDING"||k==="ROS_FINDING"||k==="PHYSICAL_FINDING"||k==="HPI_COMPLETED"||k==="ROS_COMPLETED")return k;
 if(e.sequence===1&&k===undefined)return "CHIEF_COMPLAINT"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown history event at sequence ${e.sequence}`);
}

export function foldHistory(events:readonly StoredHistoryEvent[]):FoldedHistory{
 if(events.length===0)return{exists:false,version:0,patientId:"",encounterId:"",chiefComplaint:"",findings:[]};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let patientId="",encounterId="",chiefComplaint="";const findings:Finding[]=[];
 for(const e of ordered){
  const k=kindOf(e);
  if(k==="CHIEF_COMPLAINT"){patientId=String(e.payload["patientId"]??"");encounterId=String(e.payload["encounterId"]??"");chiefComplaint=String(e.payload["chiefComplaint"]??"");}
  if(k==="HPI_FINDING"||k==="ROS_FINDING"||k==="PHYSICAL_FINDING"){
   const id=String(e.payload["findingId"]??"");const section=String(e.payload["section"]??"HPI");
   const state=e.payload["state"] as FindingState;const answer=String(e.payload["answer"]??"");
   const evidenceFor=(e.payload["evidenceFor"] as string[])??[];const evidenceAgainst=(e.payload["evidenceAgainst"] as string[])??[];
   const confidence=Number(e.payload["confidence"]??50);const source=String(e.payload["source"]??"CLINICIAN_VERIFIED");
   const existing=findings.findIndex(f=>f.id===id);
   const finding:Finding={id,section:section as "HPI"|"ROS"|"PHYSICAL",question:String(e.payload["question"]??""),state,answer,evidenceFor,evidenceAgainst,confidence,source};
   if(existing>=0)findings.splice(existing,1,finding);else findings.push(finding);
  }
 }
 return{exists:true,version:ordered[ordered.length-1]!.sequence,patientId,encounterId,chiefComplaint,findings};
}

const ALLOWED:Record<HistoryEventKind,readonly HistoryEventKind[]>={
 CHIEF_COMPLAINT:["HPI_FINDING","ROS_FINDING","PHYSICAL_FINDING","HPI_COMPLETED","ROS_COMPLETED"],
 HPI_FINDING:["HPI_FINDING","ROS_FINDING","PHYSICAL_FINDING","HPI_COMPLETED","ROS_COMPLETED"],
 ROS_FINDING:["ROS_FINDING","PHYSICAL_FINDING","HPI_COMPLETED","ROS_COMPLETED"],
 PHYSICAL_FINDING:["PHYSICAL_FINDING","HPI_COMPLETED","ROS_COMPLETED"],
 HPI_COMPLETED:["ROS_FINDING","PHYSICAL_FINDING","ROS_COMPLETED"],
 ROS_COMPLETED:["PHYSICAL_FINDING"],
};

export function assertHistoryTransition(from:HistoryEventKind,to:HistoryEventKind){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal history transition ${from} -> ${to}`,{from,to});
}