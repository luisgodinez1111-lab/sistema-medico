export type Claim=Readonly<{messageId:string;worker:string;token:number;leaseUntil:number}>;
export function acceptWorkerWrite(current:Claim,attempt:Claim,now:number){if(attempt.messageId!==current.messageId)return false;if(attempt.token!==current.token)return false;if(attempt.worker!==current.worker)return false;if(current.leaseUntil<=now)return false;return true}
