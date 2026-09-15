export type TxStep=Readonly<{kind:"STATE"|"EVENT"|"OUTBOX"|"AUDIT"|"OBLIGATION";key:string;payload:unknown}>;
export type TransactionPlan=Readonly<{tenantId:string;aggregateId:string;expectedVersion:number;steps:readonly TxStep[]}>;
export function validateTransactionPlan(p:TransactionPlan){if(!p.tenantId||!p.aggregateId)throw new Error("TX_IDENTITY_REQUIRED");if(p.expectedVersion<0)throw new Error("TX_VERSION_INVALID");const kinds=new Set(p.steps.map(s=>s.kind));for(const k of ["EVENT","AUDIT"] as const)if(!kinds.has(k))throw new Error(`TX_STEP_REQUIRED:${k}`);return p;}
