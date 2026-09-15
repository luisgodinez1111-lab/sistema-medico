export type Inv=Readonly<{id:string;risk:"C3"|"C4"|"C5";tests:readonly string[];executed:number;humanApproved:boolean}>;
export function coverage(xs:readonly Inv[]){const c5=xs.filter(x=>x.risk==="C5"),missing=c5.filter(x=>!x.tests.length||x.executed<1||!x.humanApproved);return{c5Total:c5.length,c5Closed:c5.length-missing.length,missing:missing.map(x=>x.id),releasePass:missing.length===0}}
