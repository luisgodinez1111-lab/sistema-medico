export type Projection<S,E>=Readonly<{name:string;version:number;initial:S;apply:(s:S,e:E)=>S}>;
export function replay<S,E>(p:Projection<S,E>,events:readonly E[]){return events.reduce((s,e)=>p.apply(s,e),p.initial);}
