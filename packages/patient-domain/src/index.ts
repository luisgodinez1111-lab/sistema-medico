export type PatientState=Readonly<{id:string;tenantId:string;version:number;status:"ACTIVE"|"INACTIVE"|"DECEASED";demographics:Readonly<{birthDate?:string;sexAtBirth?:string}>}>;
export type PatientCommand={type:"CREATE_PATIENT";id:string;tenantId:string}|{type:"SET_STATUS";status:PatientState["status"]};
export function evolvePatient(s:PatientState|undefined,c:PatientCommand):PatientState{
 if(c.type==="CREATE_PATIENT"){if(s)throw new Error("PATIENT_ALREADY_EXISTS");return Object.freeze({id:c.id,tenantId:c.tenantId,version:1,status:"ACTIVE",demographics:{}});}
 if(!s)throw new Error("PATIENT_NOT_FOUND"); return Object.freeze({...s,status:c.status,version:s.version+1});
}
