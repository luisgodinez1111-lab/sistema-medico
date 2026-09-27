import{ClinicalError}from"../../runtime-errors/src";
// EPIC S — Fold puro del stream de eventos de un paciente (agregado longitudinal). Autoridad:
// CAP-PATIENT-001, patient-domain. Estados: ACTIVE <-> INACTIVE; ACTIVE/INACTIVE -> DECEASED (terminal).
// El nombre es PHI: vive en el payload (RLS-aislado) y en la UICliente; NUNCA se loguea.
export type PatientStatus="ACTIVE"|"INACTIVE"|"DECEASED";
// AMENDED = corrección de datos demográficos/contacto; NO cambia el estado, sólo sobreescribe campos provistos.
export type PatientEventKind="REGISTERED"|"DEACTIVATED"|"REACTIVATED"|"DECEASED"|"AMENDED";
export type StoredPatientEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedPatient=Readonly<{exists:boolean;status:PatientStatus;version:number;name:string;birthDate:string;sexAtBirth:string}>;
// Demografía VIGENTE: el alta fija los campos y cada enmienda sobreescribe SOLO los que trae, así que el valor vigente de
// cada campo es el del último evento (alta o enmienda) que lo trae. Vocabulario compartido con la proyección SQL
// (apps/web/lib/runtime/sql.ts `patientDemographicsJoin`/`currentPatientName`): antes esas consultas combinaban el alta
// con la ÚLTIMA enmienda y perdían los campos corregidos en enmiendas anteriores (hallazgo D2 del lote 11).
export const PATIENT_DEMOGRAPHIC_FIELDS=["name","birthDate","sexAtBirth","curp","phone","email","address","occupation","maritalStatus","guardian"] as const;
export type PatientDemographicField=(typeof PATIENT_DEMOGRAPHIC_FIELDS)[number];
export const PATIENT_DEMOGRAPHIC_KINDS=["REGISTERED","AMENDED"] as const satisfies readonly PatientEventKind[];

function kindOf(e:StoredPatientEvent):PatientEventKind{
 const k=e.payload["kind"];
 if(k==="REGISTERED"||k==="DEACTIVATED"||k==="REACTIVATED"||k==="DECEASED"||k==="AMENDED")return k;
 if(e.sequence===1&&k===undefined)return "REGISTERED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (hallazgo D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown patient event at sequence ${e.sequence}`);
}
const KIND_TO_STATUS:Record<Exclude<PatientEventKind,"AMENDED">,PatientStatus>={REGISTERED:"ACTIVE",DEACTIVATED:"INACTIVE",REACTIVATED:"ACTIVE",DECEASED:"DECEASED"};
const DEMOGRAPHIC_KIND:ReadonlySet<PatientEventKind>=new Set(PATIENT_DEMOGRAPHIC_KINDS);
// Proyección pura campo a campo (la regla de PATIENT_DEMOGRAPHIC_FIELDS). Solo trae los campos que algún evento aportó.
export function patientDemographicsOf(events:readonly StoredPatientEvent[]):Partial<Record<PatientDemographicField,unknown>>{
 const out:Partial<Record<PatientDemographicField,unknown>>={};
 for(const e of [...events].sort((a,b)=>a.sequence-b.sequence)){
  if(!DEMOGRAPHIC_KIND.has(kindOf(e)))continue;
  for(const f of PATIENT_DEMOGRAPHIC_FIELDS)if(e.payload[f]!==undefined)out[f]=e.payload[f];}
 return out;
}
export function foldPatient(events:readonly StoredPatientEvent[]):FoldedPatient{
 if(events.length===0)return{exists:false,status:"ACTIVE",version:0,name:"",birthDate:"",sexAtBirth:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let status:PatientStatus="ACTIVE";
 for(const e of ordered){const k=kindOf(e);if(k!=="AMENDED")status=KIND_TO_STATUS[k];} // AMENDED no altera el estado
 const d=patientDemographicsOf(ordered);
 return{exists:true,status,version:ordered[ordered.length-1]!.sequence,name:String(d.name??""),birthDate:String(d.birthDate??""),sexAtBirth:String(d.sexAtBirth??"")};
}
const ALLOWED:Record<PatientStatus,readonly PatientStatus[]>={ACTIVE:["INACTIVE","DECEASED"],INACTIVE:["ACTIVE","DECEASED"],DECEASED:[]};
export function assertPatientTransition(from:PatientStatus,to:PatientStatus){
 if(!ALLOWED[from].includes(to))throw new ClinicalError("CONFLICT",`Illegal patient transition ${from} -> ${to}`,{from,to});
}
