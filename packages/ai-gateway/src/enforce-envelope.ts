
export type Envelope={
 id:string;risk:"C2"|"C3"|"C4"|"C5";human_approval_required:boolean;kill_switch:boolean;
 evidence_required:boolean;failure_mode:"ABSTAIN"|"SAFETY_BLOCKED"|"DEPENDENCY_UNAVAILABLE"|"INVALID_INPUT";
};
export function enforceEnvelope(e:Envelope,input:{killSwitchEnabled:boolean;hasEvidence:boolean;humanApproved:boolean}){
 if(!e.kill_switch || !input.killSwitchEnabled) throw new Error(`AI_KILL_SWITCH_UNAVAILABLE:${e.id}`);
 if((e.risk==="C4"||e.risk==="C5") && e.evidence_required && !input.hasEvidence) return {status:"SAFETY_BLOCKED" as const};
 if(e.human_approval_required && !input.humanApproved) return {status:"ABSTAIN" as const};
 return {status:"ALLOWED" as const};
}
