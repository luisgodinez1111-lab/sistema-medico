import{type MedicationState}from"../../medication-domain/src";
import{ClinicalError}from"../../runtime-errors/src";
// EPIC H — Fold puro del stream de eventos de una medicación -> estado actual.
// Discriminador en payload.kind; el primer evento es la propuesta. Physician Control: la propuesta
// puede venir de cualquier clínico (o IA), pero PRESCRIBED (la decisión firmada) exige médico.
export type MedEventKind="PROPOSED"|"PRESCRIBED"|"ACTIVATED"|"HELD"|"RESUMED"|"STOPPED"|"MODIFIED"|"RECONCILED";
export type StoredMedEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedMedication=Readonly<{exists:boolean;state:MedicationState;version:number;patientId:string;drugCode:string;dose:string;route:string;frequency:string}>;

function kindOf(e:StoredMedEvent):MedEventKind{
 const k=e.payload["kind"];
 if(k==="PROPOSED"||k==="PRESCRIBED"||k==="ACTIVATED"||k==="HELD"||k==="RESUMED"||k==="STOPPED"||k==="MODIFIED"||k==="RECONCILED")return k;
 if(e.sequence===1&&k===undefined)return "PROPOSED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown medication event at sequence ${e.sequence}`);
}
// Auditoría 2026-09-19 (L-04) — eventos de ANOTACIÓN: enriquecen el agregado SIN cambiar su estado de ciclo de vida.
// Antes no existían en el fold: MODIFY/RECONCILE pedían la "transición" ACTIVE->ACTIVE (siempre 409) y, de haberse guardado
// un evento MODIFIED, `kindOf` habría lanzado INVARIANT_VIOLATION dejando la medicación ilegible para siempre.
export const MED_ANNOTATION_KINDS=["MODIFIED","RECONCILED"]as const;
export type MedAnnotationKind=typeof MED_ANNOTATION_KINDS[number];
const isAnnotation=(k:MedEventKind):k is MedAnnotationKind=>k==="MODIFIED"||k==="RECONCILED";
const KIND_TO_STATE:Record<Exclude<MedEventKind,MedAnnotationKind>,MedicationState>={PROPOSED:"PROPOSED",PRESCRIBED:"PRESCRIBED",ACTIVATED:"ACTIVE",HELD:"HELD",RESUMED:"ACTIVE",STOPPED:"STOPPED"};
export function foldMedication(events:readonly StoredMedEvent[]):FoldedMedication{
 if(events.length===0)return{exists:false,state:"PROPOSED",version:0,patientId:"",drugCode:"",dose:"",route:"",frequency:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:MedicationState="PROPOSED",patientId="",drugCode="",dose="",route="",frequency="";
 for(const e of ordered){
  const k=kindOf(e);
  if(isAnnotation(k)){
   // MODIFIED sobreescribe SOLO los campos provistos: la orden vigente es la que evalúan las barreras y la que ve el médico.
   if(k==="MODIFIED"){const str=(x:unknown)=>typeof x==="string"&&x.trim()!==""?x:undefined;
    dose=str(e.payload["dose"])??dose;route=str(e.payload["route"])??route;frequency=str(e.payload["frequency"])??frequency;}
   continue;
  }
  state=KIND_TO_STATE[k];
  if(k==="PROPOSED"){patientId=String(e.payload["patientId"]??"");drugCode=String(e.payload["drugCode"]??"");
   dose=String(e.payload["dose"]??"");route=String(e.payload["route"]??"");frequency=String(e.payload["frequency"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,drugCode,dose,route,frequency};
}
// SM del ciclo de vida de medicación (subconjunto determinista, alineado con medication-domain).
const ALLOWED:Partial<Record<MedicationState,readonly MedicationState[]>>={
 PROPOSED:["PRESCRIBED","CANCELLED"],PRESCRIBED:["ACTIVE","CANCELLED"],ACTIVE:["HELD","STOPPED"],HELD:["ACTIVE","STOPPED"],
};
// Una anotación solo procede sobre una medicación EN CURSO (ACTIVE/HELD): una propuesta se corrige cancelándola y
// proponiendo otra (pasa de nuevo por todas las barreras); una suspendida definitivamente ya no se modifica.
export function assertMedicationAnnotation(state:MedicationState,kind:MedAnnotationKind){
 if(state!=="ACTIVE"&&state!=="HELD")throw new ClinicalError("CONFLICT",`Cannot apply ${kind} to a medication in state ${state}`,{state,kind});
}
export function assertMedicationTransition(from:MedicationState,to:MedicationState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal medication transition ${from} -> ${to}`,{from,to});
}
