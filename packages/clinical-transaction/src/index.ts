export type ClinicalWrite=Readonly<{state:readonly unknown[];events:readonly unknown[];outbox:readonly unknown[];audit:readonly unknown[]}>;
export function assertAtomicClinicalWrite(x:ClinicalWrite){if(!x.events.length)throw new Error("CLINICAL_EVENT_REQUIRED");if(!x.audit.length)throw new Error("AUDIT_REQUIRED");return x;}
export async function commitClinicalWrite<T>(tx:any,x:ClinicalWrite,apply:(tx:any,x:ClinicalWrite)=>Promise<T>){assertAtomicClinicalWrite(x);return apply(tx,x);}
