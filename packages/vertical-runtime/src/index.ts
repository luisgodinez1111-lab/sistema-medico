import{authorize,type Principal}from"../../runtime-auth/src";
import{decideIdempotency,type IdempotencyState}from"../../idempotent-command/src";
import{ClinicalError}from"../../runtime-errors/src";
export type RuntimeCommand=Readonly<{tenantId:string;aggregateId:string;expectedVersion:number;idempotencyKey:string;type:string;payload:unknown;scope:string}>;
// Auditoría S-01: ningún comando se admite "solo por tenant"; cada comando declara el scope que exige.
export function admitCommand(p:Principal,c:RuntimeCommand,existing:IdempotencyState|undefined,now:number){
 authorize(p,{tenantId:c.tenantId,scope:c.scope,purpose:"TREATMENT"});
 if(!c.idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key required");
 if(c.expectedVersion<0)throw new ClinicalError("PRECONDITION_REQUIRED","Expected version required");
 return decideIdempotency(existing,c,now);
}
