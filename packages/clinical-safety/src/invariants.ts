
export type ResultState="EXPECTED"|"ORDERED"|"RECEIVED"|"VERIFIED"|"REVIEWED"|"ACTION_REQUIRED"|"ACTIONED"|"PATIENT_INFORMED"|"CLOSED"|"CORRECTED"|"CANCELLED"|"UNMATCHED"|"FAILED"|"OVERDUE"|"ESCALATED";
export type ObligationState="OPEN"|"SCHEDULED"|"IN_PROGRESS"|"WAITING_EXTERNAL"|"OVERDUE"|"ESCALATED"|"COMPLETED"|"CANCELLED"|"FAILED";

export function invResultClosedHasAccountableEvidence(state:ResultState,evidence?:string){
 if(state==="CLOSED" && !evidence) throw new Error("INV_RESULT_CLOSED_WITHOUT_EVIDENCE");
 return true;
}
export function invObligationTerminalIsExplicit(state:ObligationState){
 if(state==="FAILED"||state==="OVERDUE"||state==="ESCALATED") return false;
 return state==="COMPLETED"||state==="CANCELLED";
}
export function invUnknownNeverReassuring<T>(status:string,value?:T){
 if(status!=="COMPUTED" && value!==undefined) throw new Error("INV_NONCOMPUTED_WITH_VALUE");
 return true;
}
export function invPhysicianAuthority(target:"RECOMMENDED"|"DECIDED"|"SIGNED",actor:"AI"|"SYSTEM"|"PHYSICIAN"){
 if((target==="DECIDED"||target==="SIGNED") && actor!=="PHYSICIAN") throw new Error("INV_HUMAN_AUTHORITY_REQUIRED");
 return true;
}
