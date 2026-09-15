
export type ClinicalEvent<T=unknown>=Readonly<{
 id:string; aggregateId:string; aggregateType:string; tenantId:string; patientId?:string;
 sequence:number; occurredAt:string; recordedAt:string; actorId:string; actorType:"PHYSICIAN"|"STAFF"|"SYSTEM"|"AI";
 authority:readonly string[]; correlationId:string; causationId?:string; schemaVersion:number; payload:T;
}>;
export class AggregateVersionConflict extends Error{}
export function appendEvent<T>(history:readonly ClinicalEvent[],next:ClinicalEvent<T>,expectedVersion:number){
 const current=history.length?history[history.length-1]!.sequence:0;
 if(current!==expectedVersion) throw new AggregateVersionConflict(`EXPECTED_${expectedVersion}_ACTUAL_${current}`);
 if(next.sequence!==current+1) throw new Error("NON_MONOTONIC_SEQUENCE");
 if(history.some(e=>e.id===next.id)) throw new Error("DUPLICATE_EVENT_ID");
 return [...history,Object.freeze(next)];
}
