export type VersionedExecution=Readonly<{executionId:string;patientId:string;artifactId:string;policyId:string;policyVersion:string;at:string}>;
export function impactedByVersion(xs:readonly VersionedExecution[],policyId:string,version:string){return xs.filter(x=>x.policyId===policyId&&x.policyVersion===version);}
export function replayOrder<T extends {at:string}>(xs:readonly T[]){return [...xs].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));}
