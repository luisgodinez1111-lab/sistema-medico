import{ClinicalError}from"../../runtime-errors/src";
// EPIC W — Fold puro del stream de una observación de signo vital (BP/HR/TEMP/SPO2/WEIGHT/HEIGHT).
// SM append-only con corrección: RECORDED -> {AMENDED, ENTERED_IN_ERROR}; AMENDED -> {AMENDED, ENTERED_IN_ERROR}.
// ENTERED_IN_ERROR es terminal. El valor histórico nunca se sobrescribe: cada corrección es un evento nuevo.
// Autoridad: PROD (signos vitales/observaciones), CAP-VITAL-001. value/unit son datos clínicos en payload bajo RLS.
export type VitalState="RECORDED"|"AMENDED"|"ENTERED_IN_ERROR";
export type VitalEventKind="RECORDED"|"AMENDED"|"ENTERED_IN_ERROR";
export type StoredVitalEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedVital=Readonly<{exists:boolean;state:VitalState;version:number;patientId:string;vitalType:string;value:string;unit:string}>;

function kindOf(e:StoredVitalEvent):VitalEventKind{
 const k=e.payload["kind"];
 if(k==="RECORDED"||k==="AMENDED"||k==="ENTERED_IN_ERROR")return k;
 if(e.sequence===1)return "RECORDED";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown vital event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<VitalEventKind,VitalState>={RECORDED:"RECORDED",AMENDED:"AMENDED",ENTERED_IN_ERROR:"ENTERED_IN_ERROR"};
export function foldVital(events:readonly StoredVitalEvent[]):FoldedVital{
 if(events.length===0)return{exists:false,state:"RECORDED",version:0,patientId:"",vitalType:"",value:"",unit:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:VitalState="RECORDED",patientId="",vitalType="",value="",unit="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="RECORDED"){patientId=String(e.payload["patientId"]??"");vitalType=String(e.payload["vitalType"]??"");}
  // El valor vigente es el del último evento que lo aporta (RECORDED o AMENDED).
  if(e.payload["value"]!==undefined)value=String(e.payload["value"]);
  if(e.payload["unit"]!==undefined)unit=String(e.payload["unit"]);
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,vitalType,value,unit};
}
const ALLOWED:Partial<Record<VitalState,readonly VitalState[]>>={
 RECORDED:["AMENDED","ENTERED_IN_ERROR"],AMENDED:["AMENDED","ENTERED_IN_ERROR"],
};
export function assertVitalTransition(from:VitalState,to:VitalState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal vital transition ${from} -> ${to}`,{from,to});
}
