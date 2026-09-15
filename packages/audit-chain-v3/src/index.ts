import crypto from"node:crypto";import{canonicalize}from"../../canonical-json/src";
export type AuditEntry=Readonly<{tenantId:string;sequence:number;id:string;previousHash:string;actorId:string;action:string;resource:string;payload:unknown;at:string;entryHash:string}>;
export function auditHash(x:Omit<AuditEntry,"entryHash">){return crypto.createHash("sha256").update(canonicalize(x)).digest("hex")}
export function appendAudit(previous:AuditEntry|undefined,x:Omit<AuditEntry,"sequence"|"previousHash"|"entryHash">):AuditEntry{
 const sequence=(previous?.sequence??0)+1,previousHash=previous?.entryHash??"GENESIS";
 const base={...x,sequence,previousHash};return Object.freeze({...base,entryHash:auditHash(base)});
}
export function verifyAudit(xs:readonly AuditEntry[]){let prev:AuditEntry|undefined;for(const x of xs){if(x.sequence!==(prev?.sequence??0)+1)return false;if(x.previousHash!==(prev?.entryHash??"GENESIS"))return false;const{entryHash,...base}=x;if(auditHash(base)!==entryHash)return false;prev=x;}return true;}
