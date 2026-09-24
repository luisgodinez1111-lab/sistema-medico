import crypto from"node:crypto";import{ClinicalError}from"../../runtime-errors/src";
import{canonicalize}from"../../canonical-json/src";
// Auditoría R01-022: `JSON.stringify(x, Object.keys(x).sort())` usa el segundo argumento como LISTA DE CLAVES PERMITIDAS,
// de modo que aplanaba los objetos anidados y dos cuerpos distintos producían la misma huella:
//   canonicalHash({id:"y",payload:{a:1,b:2}}) === canonicalHash({id:"y",payload:{a:9,b:9}})  // era true
// Es exactamente el fallo que la idempotencia debe detectar (IDEMPOTENCY_CONFLICT). Ahora usa la canonicalización
// RECURSIVA de `canonical-json` (la misma que firma los comandos), sin `as any`.
export function canonicalHash(x:unknown):string{return crypto.createHash("sha256").update(canonicalize(x)).digest("hex");}
export type IdempotencyState=Readonly<{requestHash:string;status:"IN_PROGRESS"|"COMPLETED";response?:unknown;expiresAt:number}>;
export function decideIdempotency(existing:IdempotencyState|undefined,payload:unknown,now:number){
 const h=canonicalHash(payload); if(!existing)return{action:"EXECUTE" as const,requestHash:h};
 if(existing.expiresAt<=now)return{action:"EXECUTE" as const,requestHash:h};
 if(existing.requestHash!==h)throw new ClinicalError("IDEMPOTENCY_CONFLICT","Key reused for different command");
 if(existing.status==="COMPLETED")return{action:"REPLAY" as const,requestHash:h,response:existing.response};
 return{action:"WAIT" as const,requestHash:h};
}
