
export type OutboxState="PENDING"|"DELIVERED"|"RETRY"|"DEAD_LETTER";
export type OutboxMessage=Readonly<{id:string;topic:string;aggregateId:string;payload:unknown;attempts:number;state:OutboxState;nextAttemptAt?:string}>;
export function deliveryFailure(m:OutboxMessage,maxAttempts=5):OutboxMessage{
 const attempts=m.attempts+1;
 return Object.freeze({...m,attempts,state:attempts>=maxAttempts?"DEAD_LETTER":"RETRY"});
}
export function delivered(m:OutboxMessage):OutboxMessage{return Object.freeze({...m,state:"DELIVERED"});}
