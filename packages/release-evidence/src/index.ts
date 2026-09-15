export type EvidenceState="MISSING"|"GENERATED"|"EXECUTED_PASS"|"EXECUTED_FAIL"|"HUMAN_REVIEW_PENDING"|"HUMAN_APPROVED";
export type Evidence=Readonly<{id:string;state:EvidenceState;artifactHash:string;authority:readonly string[];runner?:string;commit?:string;reviewer?:string}>;
export function admitEvidence(e:Evidence,risk:"C3"|"C4"|"C5"){if(e.state==="EXECUTED_FAIL"||e.state==="MISSING")return false;if(risk==="C5")return e.state==="HUMAN_APPROVED";return ["EXECUTED_PASS","HUMAN_APPROVED"].includes(e.state);}
