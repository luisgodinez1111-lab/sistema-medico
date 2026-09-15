export type Proof=Readonly<{mapping:boolean;defects:boolean;tests:boolean;database:boolean;rls:boolean;replay:boolean;restore:boolean;humanC5:boolean;aiReconciled:boolean;supplyChain:boolean}>;
export function releaseProof(x:Proof){const blockers=Object.entries(x).filter(([,v])=>!v).map(([k])=>k);return{state:blockers.length?"BLOCKED":"ADMISSIBLE",blockers}}
