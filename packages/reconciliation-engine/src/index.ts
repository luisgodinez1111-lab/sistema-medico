export type Finding=Readonly<{id:string;kind:"ORPHAN_RESULT"|"OVERDUE_OBLIGATION"|"DEAD_LETTER"|"PROJECTION_DRIFT";severity:"S1"|"S2";owner:string;recovery:string}>;
export function assertAccountable(findings:readonly Finding[]){for(const f of findings)if(!f.owner||!f.recovery)throw new Error(`UNACCOUNTABLE_FINDING:${f.id}`);return true;}
export function releaseImpact(findings:readonly Finding[]){return findings.some(f=>f.severity==="S1")?"BLOCK":"REVIEW";}
