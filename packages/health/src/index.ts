
export type DependencyHealth=Readonly<{name:string;status:"UP"|"DOWN";latencyMs?:number}>;
export function readiness(deps:readonly DependencyHealth[]){const down=deps.filter(d=>d.status==="DOWN");return {status:down.length?"NOT_READY":"READY",dependencies:deps};}
export function liveness(){return {status:"ALIVE"} as const;}
