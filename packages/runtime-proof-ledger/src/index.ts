import crypto from"node:crypto";import{canonicalize}from"../../canonical-json/src";
export type ProofState="SOURCE"|"EXECUTED_MODEL"|"EXECUTED_RUNTIME"|"HUMAN_APPROVED";
export type Proof=Readonly<{id:string;claim:string;state:ProofState;environment:string;artifactHashes:Record<string,string>;previousHash:string}>;
export function proofHash(x:Proof){return crypto.createHash("sha256").update(canonicalize(x)).digest("hex")}
export function appendProof(prev:{hash:string}|undefined,x:Omit<Proof,"previousHash">){const proof={...x,previousHash:prev?.hash??"GENESIS"};return{proof,hash:proofHash(proof)}}
