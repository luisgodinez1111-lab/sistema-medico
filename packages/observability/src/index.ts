
export type SafetyMetric=Readonly<{name:string;value:number;unit:string;capability:string;at:string}>;
export type SafetySlo=Readonly<{metric:string;operator:"<="|">=";threshold:number;windowMinutes:number;failure:"BLOCK_CANARY"|"ROLLBACK"|"ESCALATE"}>;
export function evaluateSlo(m:SafetyMetric,s:SafetySlo){
 const pass=s.operator==="<="?m.value<=s.threshold:m.value>=s.threshold;
 return {pass,action:pass?"NONE":s.failure};
}
