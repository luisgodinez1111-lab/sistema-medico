// Bucket puro de tokens (auditoría S-03: lo aplica apps/web/lib/rate-limit.ts). La comparación admite 1e-9 de tolerancia:
// sin ella, recargas fraccionarias (p. ej. 0.8333 + 0.1667) podían quedar en 0.9999999 y negar el token que Retry-After prometió.
export type Bucket=Readonly<{tokens:number;capacity:number;refillPerSecond:number;lastMs:number}>;
export function consume(b:Bucket,now:number,cost=1){const refill=Math.max(0,(now-b.lastMs)/1000*b.refillPerSecond),tokens=Math.min(b.capacity,b.tokens+refill);if(tokens+1e-9<cost)return{allowed:false,bucket:{...b,tokens,lastMs:now}};return{allowed:true,bucket:{...b,tokens:tokens-cost,lastMs:now}}}
