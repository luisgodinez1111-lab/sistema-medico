import crypto from"node:crypto";import{canonicalize}from"../../canonical-json/src";
export function transactionReceipt(x:{tenantId:string;aggregateId:string;version:number;eventId:string;outboxId:string;auditId:string;idempotencyKey:string;committedAt:string}){return Object.freeze({...x,receiptHash:crypto.createHash("sha256").update(canonicalize(x)).digest("hex")});}
