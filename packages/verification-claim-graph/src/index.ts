export type ClaimState="UNPROVEN"|"SOURCE_ONLY"|"EXECUTED"|"HUMAN_APPROVED";
export type Claim=Readonly<{id:string;requires:readonly string[];state:ClaimState;critical:boolean}>;
export function unresolvedClaims(xs:readonly Claim[]){const by=new Map(xs.map(x=>[x.id,x]));return xs.filter(x=>x.critical&&(x.state==="UNPROVEN"||x.requires.some(r=>!by.has(r)||["UNPROVEN","SOURCE_ONLY"].includes(by.get(r)!.state)))).map(x=>x.id)}
