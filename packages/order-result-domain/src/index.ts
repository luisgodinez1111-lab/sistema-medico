export type OrderState="DRAFT"|"ORDERED"|"CANCELLED"|"FULFILLED";
export type ResultState="EXPECTED"|"RECEIVED"|"VERIFIED"|"REVIEWED"|"ACTIONED"|"PATIENT_INFORMED"|"CLOSED"|"CORRECTED";
export type Result=Readonly<{id:string;orderId:string;state:ResultState;version:number;supersedes?:string;closureEvidence?:string}>;
export function closeResult(r:Result,evidence:string){if(!["ACTIONED","PATIENT_INFORMED"].includes(r.state))throw new Error("RESULT_NOT_READY_TO_CLOSE");if(!evidence)throw new Error("CLOSURE_EVIDENCE_REQUIRED");return Object.freeze({...r,state:"CLOSED" as const,version:r.version+1,closureEvidence:evidence});}
export function correctResult(r:Result,newId:string){if(!["VERIFIED","REVIEWED","ACTIONED","PATIENT_INFORMED","CLOSED"].includes(r.state))throw new Error("RESULT_NOT_CORRECTABLE");return Object.freeze({id:newId,orderId:r.orderId,state:"CORRECTED" as const,version:1,supersedes:r.id});}
