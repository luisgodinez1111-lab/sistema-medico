export function casWinners(expected:number,observed:number,writers:number){if(writers<1)return 0;return observed===expected?1:0}
export function leaseWinner(tokens:readonly number[]){if(!tokens.length)return null;return Math.max(...tokens)}
export function serializableAuditSequences(start:number,writers:number){return Array.from({length:writers},(_,i)=>start+i+1)}
