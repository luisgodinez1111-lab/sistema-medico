import{type OrderState}from"../../order-result-domain/src";
import{ClinicalError}from"../../runtime-errors/src";
// EPIC M — Fold puro del stream de eventos de una orden clínica (lab/imagen/patología/procedimiento).
// Discriminador en payload.kind; el primer evento es la creación. SM: DRAFT -> ORDERED -> FULFILLED,
// con CANCELLED desde DRAFT u ORDERED. Autoridad: CAP-ORDER-RESULT-001, PROD-026 (órdenes de servicio).
export type OrderEventKind="CREATED"|"PLACED"|"FULFILLED"|"CANCELLED";
export type StoredOrderEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
// R02a-ORD-01: la orden lleva URGENCIA y VENCIMIENTO. Sin ellos, una orden colocada sin resultado se quedaba en ORDERED
// para siempre y nadie podía preguntar «¿qué estudios están retrasados?».
export type FoldedOrder=Readonly<{exists:boolean;state:OrderState;version:number;patientId:string;orderType:string;priority?:string;dueAt?:string}>;

function kindOf(e:StoredOrderEvent):OrderEventKind{
 const k=e.payload["kind"];
 if(k==="CREATED"||k==="PLACED"||k==="FULFILLED"||k==="CANCELLED")return k;
 if(e.sequence===1&&k===undefined)return "CREATED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (porte D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown order event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<OrderEventKind,OrderState>={CREATED:"DRAFT",PLACED:"ORDERED",FULFILLED:"FULFILLED",CANCELLED:"CANCELLED"};
export function foldOrder(events:readonly StoredOrderEvent[]):FoldedOrder{
 if(events.length===0)return{exists:false,state:"DRAFT",version:0,patientId:"",orderType:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:OrderState="DRAFT",patientId="",orderType="",priority:string|undefined,dueAt:string|undefined;
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="CREATED"){patientId=String(e.payload["patientId"]??"");orderType=String(e.payload["orderType"]??"");}
  // Urgencia y vencimiento pueden declararse al crear y CONFIRMARSE/ajustarse al colocar (el último gana).
  if(typeof e.payload["priority"]==="string")priority=e.payload["priority"];
  if(typeof e.payload["dueAt"]==="string")dueAt=e.payload["dueAt"];
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,orderType,
  ...(priority!==undefined?{priority}:{}),...(dueAt!==undefined?{dueAt}:{})};
}
const ALLOWED:Partial<Record<OrderState,readonly OrderState[]>>={
 DRAFT:["ORDERED","CANCELLED"],ORDERED:["FULFILLED","CANCELLED"],
};
export function assertOrderTransition(from:OrderState,to:OrderState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal order transition ${from} -> ${to}`,{from,to});
}
