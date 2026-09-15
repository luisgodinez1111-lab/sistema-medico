export type EncounterEvidence=Readonly<{history:boolean;medications:boolean;allergies:boolean;vitals:boolean;assessment:boolean;plan:boolean;criticalFollowupResolved:boolean}>;
export function assessCompleteness(x:EncounterEvidence){const missing=Object.entries(x).filter(([,v])=>!v).map(([k])=>k);return {complete:missing.length===0,missing,signable:missing.length===0};}
