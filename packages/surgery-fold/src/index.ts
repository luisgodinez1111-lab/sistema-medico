import{ClinicalError}from"../../runtime-errors/src";
// EPIC AK — Fold puro del stream de un caso quirúrgico (procedimiento en quirófano).
// SM: SCHEDULED -> {TIMED_OUT, CANCELLED}; TIMED_OUT -> {IN_PROGRESS, CANCELLED}; IN_PROGRESS -> COMPLETED.
// TIMED_OUT = time-out quirúrgico (checklist OMS 2009) completado: barrera de seguridad obligatoria para iniciar.
// Auditoría R02b (R2B-018): esta línea afirmaba la barrera y el evento de time-out iba VACÍO —un sello de tiempo sin un
// solo ítem del checklist—. Desde el lote 16 el evento lleva los ítems del Time Out y el handler compara lo confirmado en
// quirófano contra lo agendado (`packages/surgical-checklist`); el fold expone ahora los ítems que sostienen la barrera,
// para que una consulta pueda comprobar CON QUÉ se completó y no solo que se completó.
// COMPLETED/CANCELLED son terminales. Autoridad: PROD (cirugía segura / checklist OMS), CAP-SURGERY-001.
// procedure/laterality/surgeon son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type SurgeryState="SCHEDULED"|"TIMED_OUT"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";
export type SurgeryEventKind="SCHEDULED"|"TIMEOUT_COMPLETED"|"STARTED"|"COMPLETED"|"CANCELLED";
export type StoredSurgeryEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type SurgeryTimeOutRecord=Readonly<{ledBy:string;procedureConfirmed:string;lateralityConfirmed:string;checklist:string}>;
export type FoldedSurgery=Readonly<{exists:boolean;state:SurgeryState;version:number;patientId:string;procedure:string;laterality:string;timeOut:SurgeryTimeOutRecord|null}>;

function kindOf(e:StoredSurgeryEvent):SurgeryEventKind{
 const k=e.payload["kind"];
 if(k==="SCHEDULED"||k==="TIMEOUT_COMPLETED"||k==="STARTED"||k==="COMPLETED"||k==="CANCELLED")return k;
 if(e.sequence===1)return "SCHEDULED";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown surgery event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<SurgeryEventKind,SurgeryState>={SCHEDULED:"SCHEDULED",TIMEOUT_COMPLETED:"TIMED_OUT",STARTED:"IN_PROGRESS",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED"};
export function foldSurgery(events:readonly StoredSurgeryEvent[]):FoldedSurgery{
 if(events.length===0)return{exists:false,state:"SCHEDULED",version:0,patientId:"",procedure:"",laterality:"",timeOut:null};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:SurgeryState="SCHEDULED",patientId="",procedure="",laterality="";
 let timeOut:SurgeryTimeOutRecord|null=null;
 for(const e of ordered){
  const k=kindOf(e);
  state=KIND_TO_STATE[k];
  if(k==="SCHEDULED"){patientId=String(e.payload["patientId"]??"");procedure=String(e.payload["procedure"]??"");laterality=String(e.payload["laterality"]??"");}
  // R2B-018: el time-out deja rastro de CON QUÉ se completó. Un evento anterior al lote 16 no trae ítems: se refleja como
  // `checklist:""` en vez de inventar un valor, porque un time-out sin ítems es exactamente lo que el hallazgo describe.
  if(k==="TIMEOUT_COMPLETED")timeOut={ledBy:String(e.payload["ledBy"]??""),procedureConfirmed:String(e.payload["procedureConfirmed"]??""),
   lateralityConfirmed:String(e.payload["lateralityConfirmed"]??""),checklist:String(e.payload["checklist"]??"")};
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,procedure,laterality,timeOut};
}
const ALLOWED:Partial<Record<SurgeryState,readonly SurgeryState[]>>={
 SCHEDULED:["TIMED_OUT","CANCELLED"],TIMED_OUT:["IN_PROGRESS","CANCELLED"],IN_PROGRESS:["COMPLETED"],
};
export function assertSurgeryTransition(from:SurgeryState,to:SurgeryState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal surgery transition ${from} -> ${to}`,{from,to});
}
