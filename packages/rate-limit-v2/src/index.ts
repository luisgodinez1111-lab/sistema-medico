export type Bucket=Readonly<{tokens:number;capacity:number;refillPerSecond:number;lastMs:number}>;
export function consume(b:Bucket,now:number,cost=1){const refill=Math.max(0,(now-b.lastMs)/1000*b.refillPerSecond),tokens=Math.min(b.capacity,b.tokens+refill);if(tokens<cost)return{allowed:false,bucket:{...b,tokens,lastMs:now}};return{allowed:true,bucket:{...b,tokens:tokens-cost,lastMs:now}}}
