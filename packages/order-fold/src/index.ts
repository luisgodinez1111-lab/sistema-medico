import{type OrderState}from"../../order-result-domain/src";
import{ClinicalError}from"../../runtime-errors/src";
// EPIC M — Fold puro del stream de eventos de una orden clínica (lab/imagen/patología/procedimiento).
// Discriminador en payload.kind; el primer evento es la creación. SM: DRAFT -> ORDERED -> FULFILLED,
// con CANCELLED desde DRAFT u ORDERED. Autoridad: CAP-ORDER-RESULT-001, PROD-026 (órdenes de servicio).
export type OrderEventKind="CREATED"|"PLACED"|"FULFILLED"|"CANCELLED";
export type StoredOrderEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedOrder=Readonly<{exists:boolean;state:OrderState;version:number;patientId:string;orderType:string}>;

function kindOf(e:StoredOrderEvent):OrderEventKind{
 const k=e.payload["kind"];
 if(k==="CREATED"||k==="PLACED"||k==="FULFILLED"||k==="CANCELLED")return k;
 if(e.sequence===1)return "CREATED";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown order event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<OrderEventKind,OrderState>={CREATED:"DRAFT",PLACED:"ORDERED",FULFILLED:"FULFILLED",CANCELLED:"CANCELLED"};
export function foldOrder(events:readonly StoredOrderEvent[]):FoldedOrder{
 if(events.length===0)return{exists:false,state:"DRAFT",version:0,patientId:"",orderType:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:OrderState="DRAFT",patientId="",orderType="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="CREATED"){patientId=String(e.payload["patientId"]??"");orderType=String(e.payload["orderType"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,orderType};
}
const ALLOWED:Partial<Record<OrderState,readonly OrderState[]>>={
 DRAFT:["ORDERED","CANCELLED"],ORDERED:["FULFILLED","CANCELLED"],
};
export function assertOrderTransition(from:OrderState,to:OrderState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal order transition ${from} -> ${to}`,{from,to});
}
