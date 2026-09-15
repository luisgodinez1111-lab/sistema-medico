export type RaceResult=Readonly<{attempts:number;successes:number;conflicts:number;finalVersion:number;initialVersion:number}>;
export function casRaceErrors(x:RaceResult){const e:string[]=[];if(x.successes!==1)e.push("NOT_EXACTLY_ONE_WINNER");if(x.conflicts!==x.attempts-1)e.push("CONFLICT_COUNT");if(x.finalVersion!==x.initialVersion+1)e.push("VERSION_ADVANCE");return e}
