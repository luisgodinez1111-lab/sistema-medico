export type OutboxRow=Readonly<{state:string;lockedBy?:string;lockedUntil?:number;fencingToken:number;receipt:boolean}>;
export function outboxProof(x:OutboxRow,now:number){if(x.state==="LEASED"&&(!x.lockedBy||!x.lockedUntil))return"INVALID_LEASE";if(x.state==="DELIVERED"&&!x.receipt)return"MISSING_RECEIPT";if(x.state==="LEASED"&&x.lockedUntil<=now)return"RECLAIMABLE";return"CONSISTENT"}
