
import crypto from "node:crypto";
export type AuditEntry=Readonly<{id:string;at:string;tenantId:string;actorId:string;action:string;resource:string;prevHash:string;hash:string}>;
const digest=(x:string)=>crypto.createHash("sha256").update(x).digest("hex");
export function createAuditEntry(input:Omit<AuditEntry,"hash">):AuditEntry{
 return Object.freeze({...input,hash:digest(JSON.stringify(input))});
}
export function verifyAuditChain(entries:readonly AuditEntry[]){
 for(let i=0;i<entries.length;i++){const e=entries[i]!;const {hash,...raw}=e;
  if(digest(JSON.stringify(raw))!==hash) throw new Error(`AUDIT_TAMPER:${e.id}`);
  if(i>0&&e.prevHash!==entries[i-1]!.hash) throw new Error(`AUDIT_CHAIN_BREAK:${e.id}`);
 } return true;
}
