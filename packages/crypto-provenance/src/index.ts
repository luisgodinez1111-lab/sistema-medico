import crypto from"node:crypto";import{canonicalize}from"../../canonical-json/src";
export function artifactDigest(x:unknown){return crypto.createHash("sha256").update(canonicalize(x)).digest("hex")}
export function provenanceEnvelope(x:{artifact:string;commit:string;tree:string;builder:string;inputs:Record<string,string>;outputs:Record<string,string>}){if(!x.commit||!x.tree||!x.builder)throw new Error("PROVENANCE_INCOMPLETE");return Object.freeze({...x,digest:artifactDigest(x)})}
