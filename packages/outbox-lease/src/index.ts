export type Lease=Readonly<{messageId:string;workerId:string;lockedAt:number;leaseMs:number;attempt:number}>;
export function canClaim(l:Lease|undefined,workerId:string,now:number){if(!l)return true;if(l.workerId===workerId)return true;return now>=l.lockedAt+l.leaseMs;}
export function nextBackoff(attempt:number,baseMs=1000,maxMs=300000){return Math.min(maxMs,baseMs*2**Math.min(attempt,12));}
