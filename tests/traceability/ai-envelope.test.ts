
import {describe,it,expect} from "vitest";
import {enforceEnvelope} from "../../packages/ai-gateway/src/enforce-envelope";
const e={id:"SE-X",risk:"C5" as const,human_approval_required:true,kill_switch:true,evidence_required:true,failure_mode:"SAFETY_BLOCKED" as const};
describe("AI Safety Envelope runtime",()=>{
 it("blocks missing evidence",()=>expect(enforceEnvelope(e,{killSwitchEnabled:true,hasEvidence:false,humanApproved:true}).status).toBe("SAFETY_BLOCKED"));
 it("abstains without human approval",()=>expect(enforceEnvelope(e,{killSwitchEnabled:true,hasEvidence:true,humanApproved:false}).status).toBe("ABSTAIN"));
 it("fails if kill switch is unavailable",()=>expect(()=>enforceEnvelope(e,{killSwitchEnabled:false,hasEvidence:true,humanApproved:true})).toThrow(/KILL_SWITCH/));
});
