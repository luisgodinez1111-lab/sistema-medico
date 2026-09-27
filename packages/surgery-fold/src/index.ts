import{ClinicalError}from"../../runtime-errors/src";
// EPIC AK — Fold puro del stream de un caso quirúrgico (procedimiento en quirófano).
// SM: SCHEDULED -> {TIMED_OUT, CANCELLED}; TIMED_OUT -> {IN_PROGRESS, CANCELLED}; IN_PROGRESS -> COMPLETED.
// TIMED_OUT = time-out quirúrgico (checklist OMS) completado: barrera de seguridad obligatoria para iniciar.
// COMPLETED/CANCELLED son terminales. Autoridad: PROD (cirugía segura / checklist OMS), CAP-SURGERY-001.
// procedure/laterality/surgeon son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type SurgeryState="SCHEDULED"|"TIMED_OUT"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";
export type SurgeryEventKind="SCHEDULED"|"TIMEOUT_COMPLETED"|"STARTED"|"COMPLETED"|"CANCELLED";
export type StoredSurgeryEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedSurgery=Readonly<{exists:boolean;state:SurgeryState;version:number;patientId:string;procedure:string;laterality:string}>;

function kindOf(e:StoredSurgeryEvent):SurgeryEventKind{
 const k=e.payload["kind"];
 if(k==="SCHEDULED"||k==="TIMEOUT_COMPLETED"||k==="STARTED"||k==="COMPLETED"||k==="CANCELLED")return k;
 if(e.sequence===1&&k===undefined)return "SCHEDULED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown surgery event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<SurgeryEventKind,SurgeryState>={SCHEDULED:"SCHEDULED",TIMEOUT_COMPLETED:"TIMED_OUT",STARTED:"IN_PROGRESS",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED"};
export function foldSurgery(events:readonly StoredSurgeryEvent[]):FoldedSurgery{
 if(events.length===0)return{exists:false,state:"SCHEDULED",version:0,patientId:"",procedure:"",laterality:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:SurgeryState="SCHEDULED",patientId="",procedure="",laterality="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="SCHEDULED"){patientId=String(e.payload["patientId"]??"");procedure=String(e.payload["procedure"]??"");laterality=String(e.payload["laterality"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,procedure,laterality};
}
const ALLOWED:Partial<Record<SurgeryState,readonly SurgeryState[]>>={
 SCHEDULED:["TIMED_OUT","CANCELLED"],TIMED_OUT:["IN_PROGRESS","CANCELLED"],IN_PROGRESS:["COMPLETED"],
};
export function assertSurgeryTransition(from:SurgeryState,to:SurgeryState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal surgery transition ${from} -> ${to}`,{from,to});
}
