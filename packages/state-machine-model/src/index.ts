export type State="OPEN"|"IN_REVIEW"|"SIGNED"|"AMENDED"|"CLOSED";
export type Action="REVIEW"|"SIGN"|"AMEND"|"CLOSE";
const T:Record<State,Partial<Record<Action,State>>>={OPEN:{REVIEW:"IN_REVIEW"},IN_REVIEW:{SIGN:"SIGNED"},SIGNED:{AMEND:"AMENDED"},AMENDED:{SIGN:"SIGNED"},CLOSED:{},};
export function transition(s:State,a:Action){const n=T[s][a];if(!n)throw new Error(`INVALID_TRANSITION:${s}:${a}`);return n}
export function explore(max=8){const q:[State,Action[]][]=[["OPEN",[]]],seen=new Set<string>(),bad:string[]=[];while(q.length){const[s,path]=q.shift()!;const k=s+":"+path.join(",");if(seen.has(k)||path.length>max)continue;seen.add(k);for(const a of["REVIEW","SIGN","AMEND","CLOSE"] as Action[]){try{const n=transition(s,a);if(s==="SIGNED"&&a!=="AMEND")bad.push(`${s}:${a}`);q.push([n,[...path,a]])}catch{}}}return{explored:seen.size,violations:bad}}
