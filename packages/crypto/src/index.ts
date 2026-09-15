
import crypto from "node:crypto";
export function sha256(x:string|Buffer){return crypto.createHash("sha256").update(x).digest("hex");}
export function timingSafeEqualHex(a:string,b:string){const A=Buffer.from(a,"hex"),B=Buffer.from(b,"hex");return A.length===B.length&&crypto.timingSafeEqual(A,B);}
