export type ImpactExecution=Readonly<{executionId:string;patientId:string;sourceArtifact:string;sourceVersion:string;derivedArtifact:string;clinicalAction?:string}>;
export function patientImpact(xs:readonly ImpactExecution[],artifact:string,version:string){
 const impacted=xs.filter(x=>x.sourceArtifact===artifact&&x.sourceVersion===version);
 return{patients:[...new Set(impacted.map(x=>x.patientId))],executions:impacted.map(x=>x.executionId),actions:impacted.filter(x=>x.clinicalAction).map(x=>x.clinicalAction!),severity:impacted.some(x=>x.clinicalAction)?"URGENT_REVIEW":"REVIEW"};
}
