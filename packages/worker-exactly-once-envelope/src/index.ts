export type Delivery=Readonly<{tenant:string;consumer:string;message:string;fencing:number;currentFencing:number;receiptExists:boolean;leaseValid:boolean}>;
export function deliveryAuthority(x:Delivery){if(x.receiptExists)return"ALREADY_APPLIED";if(!x.leaseValid)return"LEASE_INVALID";if(x.fencing!==x.currentFencing)return"STALE_FENCE";return"APPLY_ONCE"}
