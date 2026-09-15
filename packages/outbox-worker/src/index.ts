export type OutboxMessage=Readonly<{id:string;attempt:number;maxAttempts:number;availableAt:number;lockedBy?:string;lockedUntil?:number;state:"PENDING"|"LEASED"|"DELIVERED"|"DEAD_LETTER"}>;
export function lease(m:OutboxMessage,worker:string,now:number,leaseMs:number){
 if(m.state==="DELIVERED"||m.state==="DEAD_LETTER")return null;
 if(m.lockedUntil&&m.lockedUntil>now&&m.lockedBy!==worker)return null;
 return Object.freeze({...m,state:"LEASED" as const,lockedBy:worker,lockedUntil:now+leaseMs});
}
export function fail(m:OutboxMessage,now:number){const attempt=m.attempt+1;if(attempt>=m.maxAttempts)return Object.freeze({...m,attempt,state:"DEAD_LETTER" as const,availableAt:now});const delay=Math.min(300000,1000*2**Math.min(attempt,12));return Object.freeze({...m,attempt,state:"PENDING" as const,availableAt:now+delay,lockedBy:undefined,lockedUntil:undefined});}
