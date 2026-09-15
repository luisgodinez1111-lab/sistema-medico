import crypto from"node:crypto";export type AuditRow=Readonly<{prevHash:string;hash:string;payload:string}>;
export function verifyChain(rows:readonly AuditRow[],genesis="GENESIS"){let prev=genesis;for(const r of rows){if(r.prevHash!==prev)return false;const h=crypto.createHash("sha256").update(`${r.prevHash}:${r.payload}`).digest("hex");if(h!==r.hash)return false;prev=r.hash;}return true;}
