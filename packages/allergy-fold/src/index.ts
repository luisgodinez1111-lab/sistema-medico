import{ClinicalError}from"../../runtime-errors/src";
// EPIC R — Fold puro del stream de eventos de una alergia. Autoridad: PROD-011-R005 (alergias en el
// chart). Estados: ACTIVE -> REFUTED / INACTIVE; INACTIVE -> ACTIVE. Una alergia ACTIVE bloquea la
// prescripción de un fármaco que la contenga (gate de seguridad de medicación).
export type AllergyState="ACTIVE"|"REFUTED"|"INACTIVE";
export type AllergyEventKind="RECORDED"|"REFUTED"|"INACTIVATED"|"REACTIVATED";
export type StoredAllergyEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedAllergy=Readonly<{exists:boolean;state:AllergyState;version:number;patientId:string;substance:string}>;

function kindOf(e:StoredAllergyEvent):AllergyEventKind{
 const k=e.payload["kind"];
 if(k==="RECORDED"||k==="REFUTED"||k==="INACTIVATED"||k==="REACTIVATED")return k;
 if(e.sequence===1&&k===undefined)return "RECORDED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (porte D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown allergy event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<AllergyEventKind,AllergyState>={RECORDED:"ACTIVE",REFUTED:"REFUTED",INACTIVATED:"INACTIVE",REACTIVATED:"ACTIVE"};
export function foldAllergy(events:readonly StoredAllergyEvent[]):FoldedAllergy{
 if(events.length===0)return{exists:false,state:"ACTIVE",version:0,patientId:"",substance:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:AllergyState="ACTIVE",patientId="",substance="";
 for(const e of ordered){state=KIND_TO_STATE[kindOf(e)];if(kindOf(e)==="RECORDED"){patientId=String(e.payload["patientId"]??"");substance=String(e.payload["substance"]??"");}}
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,substance};
}
const ALLOWED:Record<AllergyState,readonly AllergyState[]>={ACTIVE:["REFUTED","INACTIVE"],INACTIVE:["ACTIVE"],REFUTED:[]};
export function assertAllergyTransition(from:AllergyState,to:AllergyState){
 if(!ALLOWED[from].includes(to))throw new ClinicalError("CONFLICT",`Illegal allergy transition ${from} -> ${to}`,{from,to});
}
