
export type PolicyDecision="ALLOW"|"BLOCK"|"REVIEW";
export type Policy=Readonly<{id:string;version:string;authority:readonly string[];effectiveFrom:string;effectiveTo?:string;evaluate:(ctx:unknown)=>PolicyDecision}>;
export function evaluatePolicy(p:Policy,ctx:unknown,at:string){
 const t=Date.parse(at);if(t<Date.parse(p.effectiveFrom)||(p.effectiveTo&&t>Date.parse(p.effectiveTo)))throw new Error(`POLICY_NOT_APPLICABLE:${p.id}:${p.version}`);
 return {policyId:p.id,version:p.version,decision:p.evaluate(ctx),evaluatedAt:at};
}
