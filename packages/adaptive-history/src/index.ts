// EPIC R — Fold puro del stream de eventos de historia clínica adaptativa.
// Captura: Chief Complaint, HPI adaptativo (preguntas dinámicas), ROS estructurado.
// Cada hallazgo tiene estado epistémico explícito (EXEC-0010): NOT_ASKED/NEGATIVE/POSITIVE/NOT_APPLICABLE/UNABLE_TO_ASSESS.
// Autoridad: PROD (historia clínica), CAP-ADAPTIVE-HISTORY-001.
import{ClinicalError}from"../../runtime-errors/src";

export type FindingState="NOT_ASKED"|"NEGATIVE"|"POSITIVE"|"NOT_APPLICABLE"|"UNABLE_TO_ASSESS";
export type HistoryEventKind="CHIEF_COMPLAINT"|"HPI_FINDING"|"ROS_FINDING"|"PHYSICAL_FINDING"|"HPI_COMPLETED"|"ROS_COMPLETED";
export type StoredHistoryEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
// Auditoría 2026-09-19, anexo R02b (R2B-026, lote 18) — EL FOLD NO REGISTRABA EL ÚLTIMO EVENTO, y por eso la máquina de
// estados se comparaba consigo misma.
//
// `FoldedHistory` no tenía ningún campo con el último tipo de evento, así que el ciclo de vida usaba como sustituto
// `folded.chiefComplaint?to:"CHIEF_COMPLAINT"`. Como `chiefComplaint` es obligatorio y no vacío desde el primer evento, esa
// condición es SIEMPRE verdadera en cualquier llamada real, de modo que la comprobación acababa siendo
// `assertHistoryTransition(to,to)`: el destino comparado consigo mismo como si fuera el origen. Consecuencia medida por el
// anexo ejecutando la función real: `HPI_COMPLETED -> HPI_COMPLETED` y `ROS_COMPLETED -> ROS_COMPLETED` no están en la tabla
// (completar-completar no tiene sentido), así que `handleHpiComplete` y `handleRosComplete` eran ESTRUCTURALMENTE incapaces
// de tener éxito: 100 % de las llamadas reales terminaban en CONFLICT. Nunca se detectó porque el módulo no está cableado y
// no tenía ni un test, ni siquiera del paquete puro.
//
// `lastEventKind` es ese estado, igual que `FoldedAdmission.state` o `FoldedSurgery.state` hacen en sus dominios.
export type FoldedHistory=Readonly<{exists:boolean;version:number;patientId:string;encounterId:string;chiefComplaint:string;
 findings:readonly Finding[];lastEventKind:HistoryEventKind|null}>;
export type Finding=Readonly<{id:string;section:"HPI"|"ROS"|"PHYSICAL";question:string;state:FindingState;answer:string;evidenceFor:string[];evidenceAgainst:string[];confidence:number;source:string}>;

function kindOf(e:StoredHistoryEvent):HistoryEventKind{
 const k=e.payload["kind"];
 if(k==="CHIEF_COMPLAINT"||k==="HPI_FINDING"||k==="ROS_FINDING"||k==="PHYSICAL_FINDING"||k==="HPI_COMPLETED"||k==="ROS_COMPLETED")return k;
 if(e.sequence===1)return "CHIEF_COMPLAINT";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown history event at sequence ${e.sequence}`);
}

export function foldHistory(events:readonly StoredHistoryEvent[]):FoldedHistory{
 if(events.length===0)return{exists:false,version:0,patientId:"",encounterId:"",chiefComplaint:"",findings:[],lastEventKind:null};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let patientId="",encounterId="",chiefComplaint="";const findings:Finding[]=[];
 let lastEventKind:HistoryEventKind|null=null;
 for(const e of ordered){
  const k=kindOf(e);
  lastEventKind=k;
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
 return{exists:true,version:ordered[ordered.length-1]!.sequence,patientId,encounterId,chiefComplaint,findings,lastEventKind};
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