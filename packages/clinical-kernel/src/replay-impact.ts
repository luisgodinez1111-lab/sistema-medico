
export type ProvenancedEvent={id:string; patientId:string; occurredAt:string; authority:string; artifactVersion:string; payload:unknown};
export function replay(events:readonly ProvenancedEvent[],asOf:string){
 const t=Date.parse(asOf);
 return events.filter(e=>Date.parse(e.occurredAt)<=t).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));
}
export function patientImpact(events:readonly ProvenancedEvent[],artifactVersion:string){
 const affected=events.filter(e=>e.artifactVersion===artifactVersion);
 return {patients:[...new Set(affected.map(e=>e.patientId))],events:affected.map(e=>e.id)};
}
