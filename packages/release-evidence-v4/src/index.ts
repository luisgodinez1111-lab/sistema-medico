import crypto from"node:crypto";import{canonicalize}from"../../canonical-json/src";
export type EvidenceState="GENERATED"|"EXECUTED_PASS"|"EXECUTED_FAIL"|"HUMAN_REVIEW_PENDING"|"HUMAN_APPROVED";
export function buildEvidence(x:{releaseId:string;kind:string;state:EvidenceState;command?:string;exitCode?:number;stdoutHash?:string;artifactHashes:Record<string,string>;toolchain:Record<string,string>;commit:string;tree?:string;reviewer?:string}){
 if(x.state==="EXECUTED_PASS"&&(x.exitCode!==0||!x.command||!x.stdoutHash))throw new Error("EXECUTED_EVIDENCE_INCOMPLETE");
 if(x.state==="HUMAN_APPROVED"&&!x.reviewer)throw new Error("HUMAN_REVIEWER_REQUIRED");
 return Object.freeze({...x,evidenceHash:crypto.createHash("sha256").update(canonicalize(x)).digest("hex")});
}
