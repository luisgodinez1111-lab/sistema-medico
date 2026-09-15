export type Authority=Readonly<{capability:string;prod?:string;eng?:string;exec?:string;haz?:string;ctl?:string;inv?:string;test?:string}>;
export function authorityGaps(xs:readonly Authority[]){return xs.filter(x=>!x.prod||!x.eng||!x.exec||!x.haz||!x.ctl||!x.inv||!x.test).map(x=>({capability:x.capability,missing:["prod","eng","exec","haz","ctl","inv","test"].filter(k=>!(x as any)[k])}))}
