import{type MedicationState}from"../../medication-domain/src";
import{ClinicalError}from"../../runtime-errors/src";
// EPIC H — Fold puro del stream de eventos de una medicación -> estado actual.
// Discriminador en payload.kind; el primer evento es la propuesta. Physician Control: la propuesta
// puede venir de cualquier clínico (o IA), pero PRESCRIBED (la decisión firmada) exige médico.
export type MedEventKind="PROPOSED"|"PRESCRIBED"|"ACTIVATED"|"HELD"|"RESUMED"|"STOPPED";
export type StoredMedEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedMedication=Readonly<{exists:boolean;state:MedicationState;version:number;patientId:string}>;

function kindOf(e:StoredMedEvent):MedEventKind{
 const k=e.payload["kind"];
 if(k==="PROPOSED"||k==="PRESCRIBED"||k==="ACTIVATED"||k==="HELD"||k==="RESUMED"||k==="STOPPED")return k;
 if(e.sequence===1)return "PROPOSED";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown medication event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<MedEventKind,MedicationState>={PROPOSED:"PROPOSED",PRESCRIBED:"PRESCRIBED",ACTIVATED:"ACTIVE",HELD:"HELD",RESUMED:"ACTIVE",STOPPED:"STOPPED"};
export function foldMedication(events:readonly StoredMedEvent[]):FoldedMedication{
 if(events.length===0)return{exists:false,state:"PROPOSED",version:0,patientId:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:MedicationState="PROPOSED",patientId="";
 for(const e of ordered){
  const k=kindOf(e);state=KIND_TO_STATE[k];
  if(k==="PROPOSED")patientId=String(e.payload["patientId"]??"");
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId};
}
// SM del ciclo de vida de medicación (subconjunto determinista, alineado con medication-domain).
const ALLOWED:Partial<Record<MedicationState,readonly MedicationState[]>>={
 PROPOSED:["PRESCRIBED","CANCELLED"],PRESCRIBED:["ACTIVE","CANCELLED"],ACTIVE:["HELD","STOPPED"],HELD:["ACTIVE","STOPPED"],
};
export function assertMedicationTransition(from:MedicationState,to:MedicationState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal medication transition ${from} -> ${to}`,{from,to});
}
