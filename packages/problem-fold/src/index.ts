import{ClinicalError}from"../../runtime-errors/src";
// EPIC Q — Fold puro del stream de eventos de un problema clínico (lista de problemas / diagnósticos).
// Autoridad: CAP-PROBLEM-GRAPH-001, PROD-011-R005 (problemas/medicamentos/alergias en el chart).
// Estados: ACTIVE -> RESOLVED / CHRONIC / ENTERED_IN_ERROR; RESOLVED -> ACTIVE; CHRONIC -> RESOLVED.
export type ProblemState="ACTIVE"|"RESOLVED"|"CHRONIC"|"ENTERED_IN_ERROR";
export type ProblemEventKind="ADDED"|"RESOLVED"|"REACTIVATED"|"MARKED_CHRONIC"|"MARKED_ERROR";
export type StoredProblemEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedProblem=Readonly<{exists:boolean;state:ProblemState;version:number;patientId:string}>;

function kindOf(e:StoredProblemEvent):ProblemEventKind{
 const k=e.payload["kind"];
 if(k==="ADDED"||k==="RESOLVED"||k==="REACTIVATED"||k==="MARKED_CHRONIC"||k==="MARKED_ERROR")return k;
 if(e.sequence===1)return "ADDED";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown problem event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<ProblemEventKind,ProblemState>={ADDED:"ACTIVE",RESOLVED:"RESOLVED",REACTIVATED:"ACTIVE",MARKED_CHRONIC:"CHRONIC",MARKED_ERROR:"ENTERED_IN_ERROR"};
export function foldProblem(events:readonly StoredProblemEvent[]):FoldedProblem{
 if(events.length===0)return{exists:false,state:"ACTIVE",version:0,patientId:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:ProblemState="ACTIVE",patientId="";
 for(const e of ordered){state=KIND_TO_STATE[kindOf(e)];if(kindOf(e)==="ADDED")patientId=String(e.payload["patientId"]??"");}
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId};
}
const ALLOWED:Record<ProblemState,readonly ProblemState[]>={
 ACTIVE:["RESOLVED","CHRONIC","ENTERED_IN_ERROR"],RESOLVED:["ACTIVE"],CHRONIC:["RESOLVED","ENTERED_IN_ERROR"],ENTERED_IN_ERROR:[],
};
export function assertProblemTransition(from:ProblemState,to:ProblemState){
 if(!ALLOWED[from].includes(to))throw new ClinicalError("CONFLICT",`Illegal problem transition ${from} -> ${to}`,{from,to});
}
