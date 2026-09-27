import{ClinicalError}from"../../runtime-errors/src";
// EPIC T — Fold puro del stream de una interconsulta/referencia (referral) a especialista.
// SM: REQUESTED -> ACCEPTED -> COMPLETED; REQUESTED -> DECLINED; {REQUESTED,ACCEPTED} -> CANCELLED.
// DECLINED/COMPLETED/CANCELLED son terminales. Autoridad: PROD (referrals/interconsultas), CAP-REFERRAL-001.
// specialty/reason son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type ReferralState="REQUESTED"|"ACCEPTED"|"DECLINED"|"COMPLETED"|"CANCELLED";
export type ReferralEventKind="REQUESTED"|"ACCEPTED"|"DECLINED"|"COMPLETED"|"CANCELLED";
export type StoredReferralEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedReferral=Readonly<{exists:boolean;state:ReferralState;version:number;patientId:string;specialty:string;reason:string}>;

function kindOf(e:StoredReferralEvent):ReferralEventKind{
 const k=e.payload["kind"];
 if(k==="REQUESTED"||k==="ACCEPTED"||k==="DECLINED"||k==="COMPLETED"||k==="CANCELLED")return k;
 if(e.sequence===1&&k===undefined)return "REQUESTED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown referral event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<ReferralEventKind,ReferralState>={REQUESTED:"REQUESTED",ACCEPTED:"ACCEPTED",DECLINED:"DECLINED",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED"};
export function foldReferral(events:readonly StoredReferralEvent[]):FoldedReferral{
 if(events.length===0)return{exists:false,state:"REQUESTED",version:0,patientId:"",specialty:"",reason:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:ReferralState="REQUESTED",patientId="",specialty="",reason="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="REQUESTED"){patientId=String(e.payload["patientId"]??"");specialty=String(e.payload["specialty"]??"");reason=String(e.payload["reason"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,specialty,reason};
}
const ALLOWED:Partial<Record<ReferralState,readonly ReferralState[]>>={
 REQUESTED:["ACCEPTED","DECLINED","CANCELLED"],ACCEPTED:["COMPLETED","CANCELLED"],
};
export function assertReferralTransition(from:ReferralState,to:ReferralState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal referral transition ${from} -> ${to}`,{from,to});
}
