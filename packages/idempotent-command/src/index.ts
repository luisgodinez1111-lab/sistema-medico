import crypto from"node:crypto";import{ClinicalError}from"../../runtime-errors/src";
export function canonicalHash(x:unknown){return crypto.createHash("sha256").update(JSON.stringify(x,Object.keys((x??{}) as any).sort())).digest("hex");}
export type IdempotencyState=Readonly<{requestHash:string;status:"IN_PROGRESS"|"COMPLETED";response?:unknown;expiresAt:number}>;
export function decideIdempotency(existing:IdempotencyState|undefined,payload:unknown,now:number){
 const h=canonicalHash(payload); if(!existing)return{action:"EXECUTE" as const,requestHash:h};
 if(existing.expiresAt<=now)return{action:"EXECUTE" as const,requestHash:h};
 if(existing.requestHash!==h)throw new ClinicalError("IDEMPOTENCY_CONFLICT","Key reused for different command");
 if(existing.status==="COMPLETED")return{action:"REPLAY" as const,requestHash:h,response:existing.response};
 return{action:"WAIT" as const,requestHash:h};
}
