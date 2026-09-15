import crypto from"node:crypto";import{ClinicalError}from"../../runtime-errors/src";
export type Encounter=Readonly<{id:string;patientId:string;version:number;status:"OPEN"|"READY_TO_SIGN"|"SIGNED";assessment?:string;plan?:string;signature?:string}>;
export function assess(e:Encounter,assessment:string,plan:string):Encounter{
 if(e.status==="SIGNED")throw new ClinicalError("SAFETY_BLOCKED","Signed encounter is immutable");
 if(!assessment||!plan)throw new ClinicalError("VALIDATION_ERROR","Assessment and plan required");
 return Object.freeze({...e,version:e.version+1,status:"READY_TO_SIGN",assessment,plan});
}
export function sign(e:Encounter,authorId:string,criticalOpen:number):Encounter{
 if(e.status!=="READY_TO_SIGN")throw new ClinicalError("SAFETY_BLOCKED","Encounter not ready to sign");
 if(criticalOpen>0)throw new ClinicalError("SAFETY_BLOCKED","Critical obligations unresolved");
 const signature=crypto.createHash("sha256").update(`${e.id}:${e.version}:${e.assessment}:${e.plan}:${authorId}`).digest("hex");
 return Object.freeze({...e,version:e.version+1,status:"SIGNED",signature});
}
