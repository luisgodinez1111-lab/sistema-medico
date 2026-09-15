import crypto from"node:crypto";
export type RuntimeEvidence=Readonly<{releaseId:string;kind:string;state:"GENERATED"|"EXECUTED_PASS"|"EXECUTED_FAIL"|"HUMAN_APPROVED";artifact:string;stdout:string;at:string}>;
export function evidenceReceipt(x:RuntimeEvidence){return{...x,sha256:crypto.createHash("sha256").update(`${x.releaseId}:${x.kind}:${x.state}:${x.artifact}:${x.stdout}:${x.at}`).digest("hex")};}
