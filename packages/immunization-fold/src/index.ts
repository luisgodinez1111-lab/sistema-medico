import{ClinicalError}from"../../runtime-errors/src";
// EPIC V — Fold puro del stream de una inmunización (vacuna) del paciente (cartilla longitudinal).
// SM: DUE -> {ADMINISTERED, REFUSED}; ADMINISTERED -> ADVERSE_EVENT.
// REFUSED/ADVERSE_EVENT son terminales; ADMINISTERED sólo avanza a ADVERSE_EVENT (farmacovigilancia).
// Autoridad: PROD (inmunizaciones/cartilla nacional), CAP-IMMUNIZATION-001.
// vaccineCode/dose son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type ImmunizationState="DUE"|"ADMINISTERED"|"REFUSED"|"ADVERSE_EVENT";
export type ImmunizationEventKind="DUE"|"ADMINISTERED"|"REFUSED"|"ADVERSE_EVENT";
export type StoredImmunizationEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedImmunization=Readonly<{exists:boolean;state:ImmunizationState;version:number;patientId:string;vaccineCode:string;dose:string}>;

function kindOf(e:StoredImmunizationEvent):ImmunizationEventKind{
 const k=e.payload["kind"];
 if(k==="DUE"||k==="ADMINISTERED"||k==="REFUSED"||k==="ADVERSE_EVENT")return k;
 if(e.sequence===1)return "DUE";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown immunization event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<ImmunizationEventKind,ImmunizationState>={DUE:"DUE",ADMINISTERED:"ADMINISTERED",REFUSED:"REFUSED",ADVERSE_EVENT:"ADVERSE_EVENT"};
export function foldImmunization(events:readonly StoredImmunizationEvent[]):FoldedImmunization{
 if(events.length===0)return{exists:false,state:"DUE",version:0,patientId:"",vaccineCode:"",dose:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:ImmunizationState="DUE",patientId="",vaccineCode="",dose="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="DUE"){patientId=String(e.payload["patientId"]??"");vaccineCode=String(e.payload["vaccineCode"]??"");dose=String(e.payload["dose"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,vaccineCode,dose};
}
const ALLOWED:Partial<Record<ImmunizationState,readonly ImmunizationState[]>>={
 DUE:["ADMINISTERED","REFUSED"],ADMINISTERED:["ADVERSE_EVENT"],
};
export function assertImmunizationTransition(from:ImmunizationState,to:ImmunizationState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal immunization transition ${from} -> ${to}`,{from,to});
}
