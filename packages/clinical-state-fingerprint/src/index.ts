import crypto from"node:crypto";import{canonicalize}from"../../canonical-json/src";
export function clinicalFingerprint(x:{patientId:string;sequence:number;policyVersion:string;terminologyVersion:string;state:unknown}){return crypto.createHash("sha256").update(canonicalize(x)).digest("hex")}
