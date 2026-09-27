import{ClinicalError}from"../../runtime-errors/src";
// EPIC Z — Fold puro del stream de un consentimiento informado del paciente.
// SM: DRAFTED -> PRESENTED -> {GRANTED, DECLINED}; GRANTED -> REVOKED.
// DECLINED/REVOKED son terminales. Autoridad: PROD (consentimiento informado, NOM-004/aviso de privacidad), CAP-CONSENT-001.
// scopeType/documentRef son datos clínico-legales: viven en payload bajo RLS, nunca en logs.
export type ConsentState="DRAFTED"|"PRESENTED"|"GRANTED"|"DECLINED"|"REVOKED";
export type ConsentEventKind="DRAFTED"|"PRESENTED"|"GRANTED"|"DECLINED"|"REVOKED";
export type StoredConsentEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedConsent=Readonly<{exists:boolean;state:ConsentState;version:number;patientId:string;scopeType:string;documentRef:string}>;

function kindOf(e:StoredConsentEvent):ConsentEventKind{
 const k=e.payload["kind"];
 if(k==="DRAFTED"||k==="PRESENTED"||k==="GRANTED"||k==="DECLINED"||k==="REVOKED")return k;
 if(e.sequence===1&&k===undefined)return "DRAFTED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown consent event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<ConsentEventKind,ConsentState>={DRAFTED:"DRAFTED",PRESENTED:"PRESENTED",GRANTED:"GRANTED",DECLINED:"DECLINED",REVOKED:"REVOKED"};
export function foldConsent(events:readonly StoredConsentEvent[]):FoldedConsent{
 if(events.length===0)return{exists:false,state:"DRAFTED",version:0,patientId:"",scopeType:"",documentRef:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:ConsentState="DRAFTED",patientId="",scopeType="",documentRef="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="DRAFTED"){patientId=String(e.payload["patientId"]??"");scopeType=String(e.payload["scopeType"]??"");documentRef=String(e.payload["documentRef"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,scopeType,documentRef};
}
const ALLOWED:Partial<Record<ConsentState,readonly ConsentState[]>>={
 DRAFTED:["PRESENTED"],PRESENTED:["GRANTED","DECLINED"],GRANTED:["REVOKED"],
};
export function assertConsentTransition(from:ConsentState,to:ConsentState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal consent transition ${from} -> ${to}`,{from,to});
}
