import{ClinicalError}from"../../runtime-errors/src";
// EPIC U — Fold puro del stream de una cita (appointment) de agenda.
// SM: SCHEDULED -> CHECKED_IN -> COMPLETED; SCHEDULED -> {CANCELLED,NO_SHOW}; CHECKED_IN -> CANCELLED.
// COMPLETED/CANCELLED/NO_SHOW son terminales. Autoridad: PROD (agenda/scheduling), CAP-APPOINTMENT-001.
// startAt/reason son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type AppointmentState="SCHEDULED"|"CHECKED_IN"|"COMPLETED"|"CANCELLED"|"NO_SHOW";
export type AppointmentEventKind="SCHEDULED"|"CHECKED_IN"|"COMPLETED"|"CANCELLED"|"NO_SHOW";
export type StoredAppointmentEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedAppointment=Readonly<{exists:boolean;state:AppointmentState;version:number;patientId:string;startAt:string;reason:string}>;

function kindOf(e:StoredAppointmentEvent):AppointmentEventKind{
 const k=e.payload["kind"];
 if(k==="SCHEDULED"||k==="CHECKED_IN"||k==="COMPLETED"||k==="CANCELLED"||k==="NO_SHOW")return k;
 if(e.sequence===1&&k===undefined)return "SCHEDULED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown appointment event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<AppointmentEventKind,AppointmentState>={SCHEDULED:"SCHEDULED",CHECKED_IN:"CHECKED_IN",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED",NO_SHOW:"NO_SHOW"};
export function foldAppointment(events:readonly StoredAppointmentEvent[]):FoldedAppointment{
 if(events.length===0)return{exists:false,state:"SCHEDULED",version:0,patientId:"",startAt:"",reason:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:AppointmentState="SCHEDULED",patientId="",startAt="",reason="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="SCHEDULED"){patientId=String(e.payload["patientId"]??"");startAt=String(e.payload["startAt"]??"");reason=String(e.payload["reason"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,startAt,reason};
}
const ALLOWED:Partial<Record<AppointmentState,readonly AppointmentState[]>>={
 SCHEDULED:["CHECKED_IN","CANCELLED","NO_SHOW"],CHECKED_IN:["COMPLETED","CANCELLED"],
};
export function assertAppointmentTransition(from:AppointmentState,to:AppointmentState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal appointment transition ${from} -> ${to}`,{from,to});
}
