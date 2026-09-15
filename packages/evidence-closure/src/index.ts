export type Evidence=Readonly<{claim:string;source:boolean;executed:boolean;environment:boolean;reviewed:boolean}>;
export function evidenceClosure(xs:readonly Evidence[]){const open=xs.filter(x=>!x.source||!x.executed||!x.environment||!x.reviewed);return{closed:open.length===0,open:open.map(x=>x.claim)}}
