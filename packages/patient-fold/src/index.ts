import{ClinicalError}from"../../runtime-errors/src";
// EPIC S — Fold puro del stream de eventos de un paciente (agregado longitudinal). Autoridad:
// CAP-PATIENT-001, patient-domain. Estados: ACTIVE <-> INACTIVE; ACTIVE/INACTIVE -> DECEASED (terminal).
// El nombre es PHI: vive en el payload (RLS-aislado) y en la UICliente; NUNCA se loguea.
export type PatientStatus="ACTIVE"|"INACTIVE"|"DECEASED";
// AMENDED = corrección de datos demográficos/contacto; NO cambia el estado, sólo sobreescribe campos provistos.
export type PatientEventKind="REGISTERED"|"DEACTIVATED"|"REACTIVATED"|"DECEASED"|"AMENDED";
export type StoredPatientEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedPatient=Readonly<{exists:boolean;status:PatientStatus;version:number;name:string;birthDate:string;sexAtBirth:string}>;

function kindOf(e:StoredPatientEvent):PatientEventKind{
 const k=e.payload["kind"];
 if(k==="REGISTERED"||k==="DEACTIVATED"||k==="REACTIVATED"||k==="DECEASED"||k==="AMENDED")return k;
 if(e.sequence===1&&k===undefined)return "REGISTERED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (porte D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown patient event at sequence ${e.sequence}`);
}
const KIND_TO_STATUS:Record<Exclude<PatientEventKind,"AMENDED">,PatientStatus>={REGISTERED:"ACTIVE",DEACTIVATED:"INACTIVE",REACTIVATED:"ACTIVE",DECEASED:"DECEASED"};
export function foldPatient(events:readonly StoredPatientEvent[]):FoldedPatient{
 if(events.length===0)return{exists:false,status:"ACTIVE",version:0,name:"",birthDate:"",sexAtBirth:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let status:PatientStatus="ACTIVE",name="",birthDate="",sexAtBirth="";
 for(const e of ordered){const k=kindOf(e);
  if(k==="AMENDED"){ // sobreescribe sólo los campos presentes; no altera el estado
   if(e.payload["name"]!==undefined)name=String(e.payload["name"]);
   if(e.payload["birthDate"]!==undefined)birthDate=String(e.payload["birthDate"]);
   if(e.payload["sexAtBirth"]!==undefined)sexAtBirth=String(e.payload["sexAtBirth"]);
   continue;}
  status=KIND_TO_STATUS[k];
  if(k==="REGISTERED"){name=String(e.payload["name"]??"");birthDate=String(e.payload["birthDate"]??"");sexAtBirth=String(e.payload["sexAtBirth"]??"");}}
 return{exists:true,status,version:ordered[ordered.length-1]!.sequence,name,birthDate,sexAtBirth};
}
const ALLOWED:Record<PatientStatus,readonly PatientStatus[]>={ACTIVE:["INACTIVE","DECEASED"],INACTIVE:["ACTIVE","DECEASED"],DECEASED:[]};
export function assertPatientTransition(from:PatientStatus,to:PatientStatus){
 if(!ALLOWED[from].includes(to))throw new ClinicalError("CONFLICT",`Illegal patient transition ${from} -> ${to}`,{from,to});
}
