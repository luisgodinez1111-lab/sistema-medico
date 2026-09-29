import{type ResultState}from"../../order-result-domain/src";
import{ClinicalError}from"../../runtime-errors/src";
// EPIC G — Fold puro del stream de eventos de un resultado diagnóstico -> estado actual.
// Discriminador en payload.kind (RECEIVED/VERIFIED/ACTIONED/CLOSED); el primer evento es RECEIVED.
// Subconjunto de la SM formal de order-result-domain para el closed-loop de seguimiento.
// Auditoría 2026-09-19 (C-02): CORRECTED es una ANOTACIÓN (no cambia el estado del ciclo de vida): el resultado queda
// SUPERSEDIDO por otro resultado nuevo (`supersededBy`), que es el que leen las calculadoras y el gate de firma.
// Auditoría 2026-09-19, anexo R03 (R03-10): ENTERED_IN_ERROR es la ANULACIÓN PURA. Antes solo existía la corrección, que
// exige un valor nuevo: un resultado capturado en el paciente equivocado no se podía retirar del expediente, solo
// "corregir" con otro número, de modo que el dato erróneo seguía alimentando cálculos y alertas. Un resultado anulado
// deja de existir para todo lector (calculadoras, series, delta check, gate de firma), pero su evento permanece en la
// cadena: se anula, no se borra.
export type ResultEventKind="RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED"|"CORRECTED"|"ENTERED_IN_ERROR";
export type StoredResultEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedResult=Readonly<{exists:boolean;state:ResultState;version:number;patientId:string;critical:boolean;supersededBy:string|null;supersedes:string|null;enteredInError:boolean;errorReason:string|null}>;

function kindOf(e:StoredResultEvent):ResultEventKind{
 const k=e.payload["kind"];
 if(k==="RECEIVED"||k==="VERIFIED"||k==="ACTIONED"||k==="CLOSED"||k==="CORRECTED"||k==="ENTERED_IN_ERROR")return k;
 if(e.sequence===1&&k===undefined)return "RECEIVED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (porte D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown result event at sequence ${e.sequence}`);
}
export function foldResult(events:readonly StoredResultEvent[]):FoldedResult{
 if(events.length===0)return{exists:false,state:"EXPECTED",version:0,patientId:"",critical:false,supersededBy:null,supersedes:null,enteredInError:false,errorReason:null};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:ResultState="EXPECTED",patientId="",critical=false,supersededBy:string|null=null,supersedes:string|null=null,enteredInError=false,errorReason:string|null=null;
 for(const e of ordered){
  switch(kindOf(e)){
   case"RECEIVED":state="RECEIVED";patientId=String(e.payload["patientId"]??"");critical=e.payload["critical"]===true;supersedes=typeof e.payload["supersedes"]==="string"?String(e.payload["supersedes"]):null;break;
   case"VERIFIED":state="VERIFIED";break;
   case"ACTIONED":state="ACTIONED";break; // acción requerida -> obligación abierta
   case"CLOSED":state="CLOSED";break;
   case"CORRECTED":supersededBy=String(e.payload["supersededBy"]??"");break; // anotación: el estado no cambia
   case"ENTERED_IN_ERROR":enteredInError=true;errorReason=String(e.payload["reason"]??"");break; // anotación: el dato deja de contar
  }
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,critical,supersededBy,supersedes,enteredInError,errorReason};
}
// Un resultado se corrige UNA vez (la corrección de una corrección se hace sobre el resultado vigente).
export function assertResultCorrectable(f:FoldedResult){
 if(f.supersededBy)throw new ClinicalError("CONFLICT",`Result already superseded by ${f.supersededBy}`,{supersededBy:f.supersededBy});
 if(f.enteredInError)throw new ClinicalError("CONFLICT","Result was marked as entered in error: it cannot be corrected (register a new result instead)",{});
}
// R03-10: un resultado se anula UNA vez, y no se anula lo que ya fue reemplazado por una corrección (se anula el vigente).
export function assertResultVoidable(f:FoldedResult){
 if(f.enteredInError)throw new ClinicalError("CONFLICT","Result already marked as entered in error",{});
 if(f.supersededBy)throw new ClinicalError("CONFLICT",`Result already superseded by ${f.supersededBy}: mark the current result instead`,{supersededBy:f.supersededBy});
}
// Transiciones permitidas del closed-loop (subconjunto determinista de la SM formal).
const ALLOWED:Partial<Record<ResultState,readonly ResultState[]>>={
 RECEIVED:["VERIFIED"],VERIFIED:["ACTIONED"],ACTIONED:["CLOSED"],
};
export function assertResultTransition(from:ResultState,to:ResultState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal result transition ${from} -> ${to}`,{from,to});
}
