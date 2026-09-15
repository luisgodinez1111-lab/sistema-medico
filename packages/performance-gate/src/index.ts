export type Perf=Readonly<{p50:number;p95:number;p99:number;errorRate:number;throughput:number}>;
export type Budget=Readonly<{p95Max:number;p99Max:number;errorRateMax:number;throughputMin:number}>;
export function performanceGate(x:Perf,b:Budget){const failures:string[]=[];if(x.p95>b.p95Max)failures.push("P95");if(x.p99>b.p99Max)failures.push("P99");if(x.errorRate>b.errorRateMax)failures.push("ERROR_RATE");if(x.throughput<b.throughputMin)failures.push("THROUGHPUT");return{pass:failures.length===0,failures}}
