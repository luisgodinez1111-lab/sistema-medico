
export type ReconciliationFinding={workflow:string; entityId:string; kind:"ORPHAN"|"OVERDUE"|"STATE_EVENT_MISMATCH"; severity:"S1"|"S2"|"S3"};
export type RecoveryAction={finding:ReconciliationFinding; action:"RETRY"|"RELINK"|"REASSIGN"|"ESCALATE"|"BLOCK"; owner:string; evidence:string};
export function requireRecovery(f:ReconciliationFinding,owner?:string):RecoveryAction{
 if(!owner) throw new Error(`RECONCILIATION_OWNER_REQUIRED:${f.workflow}:${f.entityId}`);
 const action=f.severity==="S1"?"BLOCK":f.kind==="OVERDUE"?"ESCALATE":f.kind==="ORPHAN"?"RELINK":"RETRY";
 return {finding:f,action,owner,evidence:"PENDING_EXECUTION_EVIDENCE"};
}
