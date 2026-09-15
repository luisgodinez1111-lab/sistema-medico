export type RestoreCheck=Readonly<{backupHashVerified:boolean;schemaCompatible:boolean;tenantIsolationVerified:boolean;auditChainVerified:boolean}>;
export function admitRestore(x:RestoreCheck){const failures=Object.entries(x).filter(([,v])=>!v).map(([k])=>k);return{admitted:failures.length===0,failures};}
