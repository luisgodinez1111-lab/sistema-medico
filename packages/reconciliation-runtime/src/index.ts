export type ReconciliationFinding=Readonly<{id:string;kind:"ORPHAN_RESULT"|"STUCK_OUTBOX"|"PROJECTION_GAP"|"OVERDUE_CRITICAL";patientId?:string;ownerId?:string}>;
export function reconcile(f:ReconciliationFinding){
 if(f.kind==="ORPHAN_RESULT")return{action:"CREATE_URGENT_OBLIGATION",requiresOwner:true};
 if(f.kind==="STUCK_OUTBOX")return{action:"RELEASE_OR_DEAD_LETTER",requiresOwner:false};
 if(f.kind==="PROJECTION_GAP")return{action:"REBUILD_AND_COMPARE_HASH",requiresOwner:false};
 return{action:"ESCALATE_CLINICAL_OWNER",requiresOwner:true};
}
