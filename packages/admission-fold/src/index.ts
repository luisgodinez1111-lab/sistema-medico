import{ClinicalError}from"../../runtime-errors/src";
// EPIC AE — Fold puro del stream de un episodio de internamiento (admission / hospitalización).
// SM: ADMITTED -> {TRANSFERRED, DISCHARGED, CANCELLED}; TRANSFERRED -> {TRANSFERRED, DISCHARGED, CANCELLED}.
// TRANSFERRED (cambio de unidad) NO es terminal y puede repetirse; DISCHARGED/CANCELLED son terminales.
// Autoridad: PROD (censo de hospitalización / episodio de cuidado), CAP-ADMISSION-001.
// unit/reason son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type AdmissionState="ADMITTED"|"TRANSFERRED"|"DISCHARGED"|"CANCELLED";
export type AdmissionEventKind="ADMITTED"|"TRANSFERRED"|"DISCHARGED"|"CANCELLED";
export type StoredAdmissionEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedAdmission=Readonly<{exists:boolean;state:AdmissionState;version:number;patientId:string;unit:string;reason:string}>;

function kindOf(e:StoredAdmissionEvent):AdmissionEventKind{
 const k=e.payload["kind"];
 if(k==="ADMITTED"||k==="TRANSFERRED"||k==="DISCHARGED"||k==="CANCELLED")return k;
 if(e.sequence===1&&k===undefined)return "ADMITTED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (porte D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown admission event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<AdmissionEventKind,AdmissionState>={ADMITTED:"ADMITTED",TRANSFERRED:"TRANSFERRED",DISCHARGED:"DISCHARGED",CANCELLED:"CANCELLED"};
export function foldAdmission(events:readonly StoredAdmissionEvent[]):FoldedAdmission{
 if(events.length===0)return{exists:false,state:"ADMITTED",version:0,patientId:"",unit:"",reason:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:AdmissionState="ADMITTED",patientId="",unit="",reason="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="ADMITTED"){patientId=String(e.payload["patientId"]??"");unit=String(e.payload["unit"]??"");reason=String(e.payload["reason"]??"");}
  // La unidad vigente es la del último traslado (si lo hubo).
  if(kindOf(e)==="TRANSFERRED"&&e.payload["unit"]!==undefined)unit=String(e.payload["unit"]);
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,unit,reason};
}
const ALLOWED:Partial<Record<AdmissionState,readonly AdmissionState[]>>={
 ADMITTED:["TRANSFERRED","DISCHARGED","CANCELLED"],TRANSFERRED:["TRANSFERRED","DISCHARGED","CANCELLED"],
};
export function assertAdmissionTransition(from:AdmissionState,to:AdmissionState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal admission transition ${from} -> ${to}`,{from,to});
}
