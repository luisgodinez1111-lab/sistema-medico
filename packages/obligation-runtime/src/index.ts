import{ClinicalError}from"../../runtime-errors/src";
export type Obligation=Readonly<{id:string;patientId:string;sourceId:string;ownerId:string;dueAt:number;priority:"ROUTINE"|"URGENT";state:"OPEN"|"COMPLETED"|"ESCALATED"}>;
export function createObligation(x:Omit<Obligation,"state">):Obligation{
 if(!x.ownerId||!x.dueAt)throw new ClinicalError("INVARIANT_VIOLATION","Owned due-date obligation required");
 return Object.freeze({...x,state:"OPEN"});
}
export function reconcileObligation(x:Obligation,now:number){return x.state==="OPEN"&&x.dueAt<now?Object.freeze({...x,state:"ESCALATED" as const}):x;}
