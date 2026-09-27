import{ClinicalError}from"../../runtime-errors/src";
// EPIC AG — Fold puro del stream de un incidente de seguridad del paciente (evento adverso institucional).
// SM: REPORTED -> {UNDER_REVIEW, RESOLVED}; UNDER_REVIEW -> {ESCALATED, RESOLVED}; ESCALATED -> RESOLVED.
// RESOLVED es terminal. Autoridad: PROD (seguridad del paciente / farmacovigilancia, NOM), CAP-INCIDENT-001.
// category/severity/description son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type IncidentState="REPORTED"|"UNDER_REVIEW"|"ESCALATED"|"RESOLVED";
export type IncidentEventKind="REPORTED"|"REVIEW_STARTED"|"ESCALATED"|"RESOLVED";
export type StoredIncidentEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedIncident=Readonly<{exists:boolean;state:IncidentState;version:number;patientId:string;category:string;severity:string}>;

function kindOf(e:StoredIncidentEvent):IncidentEventKind{
 const k=e.payload["kind"];
 if(k==="REPORTED"||k==="REVIEW_STARTED"||k==="ESCALATED"||k==="RESOLVED")return k;
 if(e.sequence===1&&k===undefined)return "REPORTED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown incident event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<IncidentEventKind,IncidentState>={REPORTED:"REPORTED",REVIEW_STARTED:"UNDER_REVIEW",ESCALATED:"ESCALATED",RESOLVED:"RESOLVED"};
export function foldIncident(events:readonly StoredIncidentEvent[]):FoldedIncident{
 if(events.length===0)return{exists:false,state:"REPORTED",version:0,patientId:"",category:"",severity:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:IncidentState="REPORTED",patientId="",category="",severity="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="REPORTED"){patientId=String(e.payload["patientId"]??"");category=String(e.payload["category"]??"");severity=String(e.payload["severity"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,category,severity};
}
const ALLOWED:Partial<Record<IncidentState,readonly IncidentState[]>>={
 REPORTED:["UNDER_REVIEW","RESOLVED"],UNDER_REVIEW:["ESCALATED","RESOLVED"],ESCALATED:["RESOLVED"],
};
export function assertIncidentTransition(from:IncidentState,to:IncidentState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal incident transition ${from} -> ${to}`,{from,to});
}
