import{ClinicalError}from"../../runtime-errors/src";
export type Prescription=Readonly<{id:string;patientId:string;drugCode:string;dose:string;route:string;frequency:string;prescriberId:string;status:"PRESCRIBED"|"STOPPED"}>;
export function prescribe(x:Omit<Prescription,"status">,roles:readonly string[]):Prescription{
 if(!roles.includes("PHYSICIAN"))throw new ClinicalError("FORBIDDEN","Physician authority required");
 for(const k of ["drugCode","dose","route","frequency","prescriberId"] as const)if(!x[k])throw new ClinicalError("VALIDATION_ERROR",`Missing ${k}`);
 return Object.freeze({...x,status:"PRESCRIBED"});
}
