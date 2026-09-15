export type ImpactEdge=Readonly<{patientId:string;sourceArtifact:string;sourceVersion:string;derivedArtifact:string;actioned:boolean}>;
export function correctionImpact(edges:readonly ImpactEdge[],artifact:string,version:string){
 const hit=edges.filter(e=>e.sourceArtifact===artifact&&e.sourceVersion===version);
 const patients=[...new Set(hit.map(e=>e.patientId))];
 return{patients,derivedArtifacts:[...new Set(hit.map(e=>e.derivedArtifact))],requiresUrgentReview:hit.some(e=>e.actioned),findingRequired:hit.length>0};
}
