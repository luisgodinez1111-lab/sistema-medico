import{ClinicalError}from"../../runtime-errors/src";
// EPIC Q — Fold puro del stream de eventos de un problema clínico (lista de problemas / diagnósticos).
// Autoridad: CAP-PROBLEM-GRAPH-001, PROD-011-R005 (problemas/medicamentos/alergias en el chart).
// Estados: ACTIVE -> RESOLVED / CHRONIC / ENTERED_IN_ERROR; RESOLVED -> ACTIVE; CHRONIC -> RESOLVED.
export type ProblemState="ACTIVE"|"RESOLVED"|"CHRONIC"|"ENTERED_IN_ERROR";
export type ProblemEventKind="ADDED"|"RESOLVED"|"REACTIVATED"|"MARKED_CHRONIC"|"MARKED_ERROR"|"EPISTEMIC_CHANGED"|"EVIDENCE_UPDATED";
export type StoredProblemEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedProblem=Readonly<{exists:boolean;state:ProblemState;version:number;patientId:string;epistemic?:string;confidence?:number}>;

function kindOf(e:StoredProblemEvent):ProblemEventKind{
 const k=e.payload["kind"];
 if(k==="ADDED"||k==="RESOLVED"||k==="REACTIVATED"||k==="MARKED_CHRONIC"||k==="MARKED_ERROR"||k==="EPISTEMIC_CHANGED"||k==="EVIDENCE_UPDATED")return k;
 if(e.sequence===1&&k===undefined)return "ADDED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (porte D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown problem event at sequence ${e.sequence}`);
}
// Auditoría 2026-09-19 (L-04) — eventos de ANOTACIÓN (estado epistémico, evidencia): NO cambian el estado del problema.
// Antes se pedía la "transición" X->X (siempre 409) y un evento guardado habría hecho fallar el fold con INVARIANT_VIOLATION.
export const PROBLEM_ANNOTATION_KINDS=["EPISTEMIC_CHANGED","EVIDENCE_UPDATED"]as const;
export type ProblemAnnotationKind=typeof PROBLEM_ANNOTATION_KINDS[number];
const isAnnotation=(k:ProblemEventKind):k is ProblemAnnotationKind=>k==="EPISTEMIC_CHANGED"||k==="EVIDENCE_UPDATED";
const KIND_TO_STATE:Record<Exclude<ProblemEventKind,ProblemAnnotationKind>,ProblemState>={ADDED:"ACTIVE",RESOLVED:"RESOLVED",REACTIVATED:"ACTIVE",MARKED_CHRONIC:"CHRONIC",MARKED_ERROR:"ENTERED_IN_ERROR"};
export function foldProblem(events:readonly StoredProblemEvent[]):FoldedProblem{
 if(events.length===0)return{exists:false,state:"ACTIVE",version:0,patientId:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:ProblemState="ACTIVE",patientId="",epistemic:string|undefined,confidence:number|undefined;
 for(const e of ordered){
  const k=kindOf(e);
  if(isAnnotation(k)){
   if(k==="EPISTEMIC_CHANGED"&&typeof e.payload["epistemic"]==="string")epistemic=e.payload["epistemic"];
   if(k==="EVIDENCE_UPDATED"&&typeof e.payload["confidence"]==="number")confidence=e.payload["confidence"];
   continue;
  }
  state=KIND_TO_STATE[k];
  if(k==="ADDED"){patientId=String(e.payload["patientId"]??"");if(typeof e.payload["epistemic"]==="string")epistemic=e.payload["epistemic"];}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,...(epistemic!==undefined?{epistemic}:{}),...(confidence!==undefined?{confidence}:{})};
}
const ALLOWED:Record<ProblemState,readonly ProblemState[]>={
 ACTIVE:["RESOLVED","CHRONIC","ENTERED_IN_ERROR"],RESOLVED:["ACTIVE"],CHRONIC:["RESOLVED","ENTERED_IN_ERROR"],ENTERED_IN_ERROR:[],
};
// Un problema marcado "registrado por error" ya no admite anotaciones: no es un diagnóstico del paciente.
export function assertProblemAnnotation(state:ProblemState,kind:ProblemAnnotationKind){
 if(state==="ENTERED_IN_ERROR")throw new ClinicalError("CONFLICT",`Cannot apply ${kind} to a problem entered in error`,{state,kind});
}
export function assertProblemTransition(from:ProblemState,to:ProblemState){
 if(!ALLOWED[from].includes(to))throw new ClinicalError("CONFLICT",`Illegal problem transition ${from} -> ${to}`,{from,to});
}
