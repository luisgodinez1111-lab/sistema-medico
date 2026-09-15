export type Op="OPEN"|"OBSERVE"|"ASSESS"|"ORDER"|"RESULT"|"OBLIGATE"|"SIGN"|"CORRECT"|"AMEND";
export function generate(seed:number,length:number):Op[]{let x=seed>>>0;const ops:Op[]=["OPEN","OBSERVE","ASSESS","ORDER","RESULT","OBLIGATE","SIGN","CORRECT","AMEND"];return Array.from({length},()=>{x=(1664525*x+1013904223)>>>0;return ops[x%ops.length]})}
