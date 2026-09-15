import crypto from "node:crypto";
export type Amendment=Readonly<{id:string;documentId:string;previousHash:string;contentHash:string;reason:string;authorId:string;at:string;hash:string}>;
export function amend(input:Omit<Amendment,"hash">):Amendment{if(!input.reason||!input.authorId)throw new Error("AMENDMENT_REASON_AND_AUTHOR_REQUIRED");return Object.freeze({...input,hash:crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex")});}
