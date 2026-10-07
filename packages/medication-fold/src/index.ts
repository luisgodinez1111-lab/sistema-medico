import{type MedicationState}from"../../medication-domain/src";
import{ClinicalError}from"../../runtime-errors/src";
// EPIC H — Fold puro del stream de eventos de una medicación -> estado actual.
// Discriminador en payload.kind; el primer evento es la propuesta. Physician Control: la propuesta
// puede venir de cualquier clínico (o IA), pero PRESCRIBED (la decisión firmada) exige médico.
export type MedEventKind="PROPOSED"|"PRESCRIBED"|"ACTIVATED"|"HELD"|"RESUMED"|"STOPPED"|"MODIFIED"|"RECONCILED";
export type StoredMedEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
// R03-26: la DURACIÓN se guardaba en el payload de la propuesta y el fold la descartaba, así que la barrera de duración
// no podía verla en PRESCRIBE, que es donde bloquea. Ahora forma parte del estado plegado de la orden.
// Auditoría 2026-09-19, anexo R02a (R02a-MED-02) — LA CONCILIACIÓN NO DEJABA RASTRO LEGIBLE.
//
// El fold trataba `RECONCILED` como anotación y la DESCARTABA: `continue` sin leer un solo campo. Así, aunque el evento se
// hubiera guardado, ninguna pantalla podría decir «conciliada el 6 de octubre contra lo que refiere el paciente». Una
// conciliación que no se puede leer no es una conciliación: es un evento enterrado.
//
// QUÉ ES CONCILIAR UN MEDICAMENTO, Y QUÉ NO. Conciliar es comparar lo que está PRESCRITO con lo que el paciente
// REALMENTE toma, y dejar constancia de las tres cosas que lo hacen verificable: qué se decidió sobre este fármaco, CONTRA
// QUÉ se comprobó la lista, y en qué punto del trayecto asistencial. Sin la fuente es una afirmación; y el valor entero
// del acto está en detectar la DISCREPANCIA —el fármaco que el paciente no está tomando—, no en confirmar lo obvio.
export type MedReconOutcome="CONTINUED"|"MODIFIED"|"SUSPENDED"|"NOT_TAKING";
/** Contra qué se comprobó la lista. Sin fuente, una conciliación es una afirmación del clínico sobre sí misma. */
export type MedReconSource="PATIENT"|"CAREGIVER"|"PREVIOUS_PRESCRIPTION"|"PHARMACY_RECORD"|"MEDICATION_PACKAGING";
/** En qué punto del trayecto asistencial se concilió. Conciliar en consulta externa es tan válido como al ingreso. */
export type MedReconContext="OUTPATIENT_VISIT"|"ADMISSION"|"DISCHARGE"|"TRANSFER";
export type MedReconciliation=Readonly<{at:string;outcome:MedReconOutcome;verifiedAgainst:MedReconSource;context:MedReconContext;note?:string}>;
export type FoldedMedication=Readonly<{exists:boolean;state:MedicationState;version:number;patientId:string;drugCode:string;dose:string;route:string;frequency:string;duration:string;
 /** La ÚLTIMA conciliación, o `null` si este fármaco nunca se ha conciliado — que es un dato clínico en sí mismo. */
 reconciliation:MedReconciliation|null;
 /** `true` cuando la última conciliación encontró que el paciente NO lo está tomando: la discrepancia que el acto busca. */
 reconciliationDiscrepancy:boolean}>;
const RECON_OUTCOMES:readonly string[]=["CONTINUED","MODIFIED","SUSPENDED","NOT_TAKING"];
const RECON_SOURCES:readonly string[]=["PATIENT","CAREGIVER","PREVIOUS_PRESCRIPTION","PHARMACY_RECORD","MEDICATION_PACKAGING"];
const RECON_CONTEXTS:readonly string[]=["OUTPATIENT_VISIT","ADMISSION","DISCHARGE","TRANSFER"];

function kindOf(e:StoredMedEvent):MedEventKind{
 const k=e.payload["kind"];
 if(k==="PROPOSED"||k==="PRESCRIBED"||k==="ACTIVATED"||k==="HELD"||k==="RESUMED"||k==="STOPPED"||k==="MODIFIED"||k==="RECONCILED")return k;
 if(e.sequence===1)return "PROPOSED";
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
 if(events.length===0)return{exists:false,state:"PROPOSED",version:0,patientId:"",drugCode:"",dose:"",route:"",frequency:"",duration:"",reconciliation:null,reconciliationDiscrepancy:false};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:MedicationState="PROPOSED",patientId="",drugCode="",dose="",route="",frequency="",duration="";
 let reconciliation:MedReconciliation|null=null;
 for(const e of ordered){
  const k=kindOf(e);
  if(isAnnotation(k)){
   // MODIFIED sobreescribe SOLO los campos provistos: la orden vigente es la que evalúan las barreras y la que ve el médico.
   if(k==="MODIFIED"){const str=(x:unknown)=>typeof x==="string"&&x.trim()!==""?x:undefined;
    dose=str(e.payload["dose"])??dose;route=str(e.payload["route"])??route;frequency=str(e.payload["frequency"])??frequency;duration=str(e.payload["duration"])??duration;}
   // La conciliación se LEE: gana la última. Un vocabulario desconocido NO se interpreta —no se asume «CONTINUED», que
   // sería afirmar que el paciente lo sigue tomando sin saberlo— y el evento se ignora dejando la conciliación anterior.
   if(k==="RECONCILED"){
    const outcome=String(e.payload["outcome"]??""),src=String(e.payload["verifiedAgainst"]??""),ctxt=String(e.payload["context"]??"");
    const at=String(e.payload["occurredAt"]??e.payload["at"]??"");
    if(RECON_OUTCOMES.includes(outcome)&&RECON_SOURCES.includes(src)&&RECON_CONTEXTS.includes(ctxt)){
     const nota=e.payload["note"];
     reconciliation={at,outcome:outcome as MedReconOutcome,verifiedAgainst:src as MedReconSource,context:ctxt as MedReconContext,
      ...(typeof nota==="string"&&nota.trim()!==""?{note:nota}:{})};
    }
   }
   continue;
  }
  state=KIND_TO_STATE[k];
  if(k==="PROPOSED"){patientId=String(e.payload["patientId"]??"");drugCode=String(e.payload["drugCode"]??"");
   dose=String(e.payload["dose"]??"");route=String(e.payload["route"]??"");frequency=String(e.payload["frequency"]??"");duration=String(e.payload["duration"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,drugCode,dose,route,frequency,duration,
  reconciliation,reconciliationDiscrepancy:reconciliation?.outcome==="NOT_TAKING"};
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
