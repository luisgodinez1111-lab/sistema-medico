export type RestoreEvidence=Readonly<{schemaHashMatch:boolean;auditChainValid:boolean;tenantIsolationPass:boolean;projectionReplayMatch:boolean;openObligationsMatch:boolean}>;
export function admitRestore(x:RestoreEvidence){const failed=Object.entries(x).filter(([,v])=>!v).map(([k])=>k);return{admitted:failed.length===0,failed}}
