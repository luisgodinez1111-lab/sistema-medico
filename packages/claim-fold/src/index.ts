import{ClinicalError}from"../../runtime-errors/src";
// EPIC Y — Fold puro del stream de una reclamación de facturación (claim del ciclo de ingresos).
// Seguimiento de ESTADO de la reclamación; NO mueve dinero (sin transferencias/pagos reales).
// SM: DRAFT -> CODED -> SUBMITTED -> {PAID, REJECTED}; REJECTED -> SUBMITTED (reenvío); {DRAFT,CODED,REJECTED} -> VOIDED.
// PAID/VOIDED son terminales. Autoridad: PROD (billing/coding, facturación MX), CAP-CLAIM-001.
// codes/amount/currency son datos administrativos: viven en payload bajo RLS, nunca en logs.
export type ClaimState="DRAFT"|"CODED"|"SUBMITTED"|"PAID"|"REJECTED"|"VOIDED";
export type ClaimEventKind="DRAFTED"|"CODED"|"SUBMITTED"|"PAID"|"REJECTED"|"VOIDED";
export type StoredClaimEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedClaim=Readonly<{exists:boolean;state:ClaimState;version:number;patientId:string;amount:string;currency:string}>;

function kindOf(e:StoredClaimEvent):ClaimEventKind{
 const k=e.payload["kind"];
 if(k==="DRAFTED"||k==="CODED"||k==="SUBMITTED"||k==="PAID"||k==="REJECTED"||k==="VOIDED")return k;
 if(e.sequence===1&&k===undefined)return "DRAFTED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown claim event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<ClaimEventKind,ClaimState>={DRAFTED:"DRAFT",CODED:"CODED",SUBMITTED:"SUBMITTED",PAID:"PAID",REJECTED:"REJECTED",VOIDED:"VOIDED"};
export function foldClaim(events:readonly StoredClaimEvent[]):FoldedClaim{
 if(events.length===0)return{exists:false,state:"DRAFT",version:0,patientId:"",amount:"",currency:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:ClaimState="DRAFT",patientId="",amount="",currency="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="DRAFTED"){patientId=String(e.payload["patientId"]??"");amount=String(e.payload["amount"]??"");currency=String(e.payload["currency"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,amount,currency};
}
const ALLOWED:Partial<Record<ClaimState,readonly ClaimState[]>>={
 DRAFT:["CODED","VOIDED"],CODED:["SUBMITTED","VOIDED"],SUBMITTED:["PAID","REJECTED"],REJECTED:["SUBMITTED","VOIDED"],
};
export function assertClaimTransition(from:ClaimState,to:ClaimState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal claim transition ${from} -> ${to}`,{from,to});
}
