export type Mutant=Readonly<{id:string;description:string;killed:boolean}>;
export function mutationScore(xs:readonly Mutant[]){return xs.length?xs.filter(x=>x.killed).length/xs.length:0}
export function releaseMutationGate(xs:readonly Mutant[],criticalIds:readonly string[]){const live=xs.filter(x=>criticalIds.includes(x.id)&&!x.killed);return{pass:live.length===0,liveCritical:live.map(x=>x.id),score:mutationScore(xs)}}
