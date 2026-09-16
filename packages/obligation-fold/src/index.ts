import{ClinicalError}from"../../runtime-errors/src";
// EPIC O — Fold puro del stream de eventos de una obligación clínica (seguimiento / care gap).
// Subconjunto determinista de la SM de obligation-domain: OPEN -> IN_PROGRESS -> COMPLETED, con
// CANCELLED desde OPEN/IN_PROGRESS. Completar exige evidencia. Autoridad: CAP-OBLIGATION-002.
export type ObligationSt="OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";
export type ObEventKind="CREATED"|"STARTED"|"COMPLETED"|"CANCELLED";
export type StoredObEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedObligation=Readonly<{exists:boolean;state:ObligationSt;version:number;patientId:string}>;

function kindOf(e:StoredObEvent):ObEventKind{
 const k=e.payload["kind"];
 if(k==="CREATED"||k==="STARTED"||k==="COMPLETED"||k==="CANCELLED")return k;
 if(e.sequence===1)return "CREATED";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown obligation event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<ObEventKind,ObligationSt>={CREATED:"OPEN",STARTED:"IN_PROGRESS",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED"};
export function foldObligation(events:readonly StoredObEvent[]):FoldedObligation{
 if(events.length===0)return{exists:false,state:"OPEN",version:0,patientId:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:ObligationSt="OPEN",patientId="";
 for(const e of ordered){state=KIND_TO_STATE[kindOf(e)];if(kindOf(e)==="CREATED")patientId=String(e.payload["patientId"]??"");}
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId};
}
const ALLOWED:Partial<Record<ObligationSt,readonly ObligationSt[]>>={
 OPEN:["IN_PROGRESS","COMPLETED","CANCELLED"],IN_PROGRESS:["COMPLETED","CANCELLED"],
};
export function assertObligationTransition(from:ObligationSt,to:ObligationSt){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal obligation transition ${from} -> ${to}`,{from,to});
}
