
export class CircuitBreaker{private failures=0;private openedAt?:number;constructor(private threshold=5,private coolDownMs=30000){}async execute<T>(fn:()=>Promise<T>,now=Date.now()){if(this.openedAt&&now-this.openedAt<this.coolDownMs)throw new Error("CIRCUIT_OPEN");try{const r=await fn();this.failures=0;this.openedAt=undefined;return r;}catch(e){this.failures++;if(this.failures>=this.threshold)this.openedAt=now;throw e;}}}
export async function retry<T>(fn:()=>Promise<T>,attempts=3){let last:unknown;for(let i=0;i<attempts;i++)try{return await fn()}catch(e){last=e}throw last;}
