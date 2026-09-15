export type ComponentHealth=Readonly<{name:string;required:boolean;healthy:boolean;latencyMs:number}>;
export function readiness(xs:readonly ComponentHealth[]){const failed=xs.filter(x=>x.required&&!x.healthy);return{ready:failed.length===0,failed:failed.map(x=>x.name),degraded:xs.filter(x=>!x.required&&!x.healthy).map(x=>x.name)};}
