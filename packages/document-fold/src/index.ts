import{ClinicalError}from"../../runtime-errors/src";
// EPIC I — Fold puro del stream de eventos de un documento clínico -> estado actual.
// Autoridad: PROD-022 (documentación clínico-legal), PROD-014-R022 (la firma produce un snapshot
// reproducible; toda corrección posterior es addendum/amendment), PROD-030-R003 (status
// preliminary/final/amended), PROD-022-R018 (NUNCA borrar historial de firma/amendments).
// Modelo append-only sobre el kernel: la firma es inmutable; las enmiendas se agregan, no editan.
export type DocumentState="DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED";
export type DocEventKind="CREATED"|"FINALIZED"|"SIGNED"|"AMENDED";
export type StoredDocEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedDocument=Readonly<{exists:boolean;state:DocumentState;version:number;patientId:string;docType:string;content:string;amendmentCount:number}>;

function kindOf(e:StoredDocEvent):DocEventKind{
 const k=e.payload["kind"];
 if(k==="CREATED"||k==="FINALIZED"||k==="SIGNED"||k==="AMENDED")return k;
 if(e.sequence===1&&k===undefined)return "CREATED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown document event at sequence ${e.sequence}`);
}
export function foldDocument(events:readonly StoredDocEvent[]):FoldedDocument{
 if(events.length===0)return{exists:false,state:"DRAFT",version:0,patientId:"",docType:"",content:"",amendmentCount:0};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:DocumentState="DRAFT",patientId="",docType="",content="",amendmentCount=0;
 for(const e of ordered){
  switch(kindOf(e)){
   case"CREATED":state="DRAFT";patientId=String(e.payload["patientId"]??"");docType=String(e.payload["docType"]??"");content=String(e.payload["content"]??"");break;
   case"FINALIZED":state="FINALIZED";break;
   case"SIGNED":state="SIGNED";break;
   case"AMENDED":state="AMENDED";amendmentCount+=1;break; // append-only: cada enmienda suma, nada se borra
  }
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,docType,content,amendmentCount};
}
// SM: DRAFT -> FINALIZED -> SIGNED -> AMENDED (y AMENDED -> AMENDED, enmiendas sucesivas).
const ALLOWED:Record<DocumentState,readonly DocumentState[]>={
 DRAFT:["FINALIZED"],FINALIZED:["SIGNED"],SIGNED:["AMENDED"],AMENDED:["AMENDED"],
};
export function assertDocumentTransition(from:DocumentState,to:DocumentState){
 if(!ALLOWED[from].includes(to))throw new ClinicalError("CONFLICT",`Illegal document transition ${from} -> ${to}`,{from,to});
}
