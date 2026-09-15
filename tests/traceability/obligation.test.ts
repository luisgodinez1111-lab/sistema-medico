
import {describe,it,expect} from "vitest";
import {assertTransition} from "../../packages/clinical-kernel/src/state-machine";
import {ClinicalObligation} from "../../packages/clinical-kernel/src/obligation-machine";
describe("Zero Lost Follow-Up",()=>{
 it("does not infer completion from overdue",()=>expect(()=>assertTransition(ClinicalObligation,"OVERDUE","COMPLETE")).toThrow(/ILLEGAL_TRANSITION/));
 it("requires escalation path",()=>expect(assertTransition(ClinicalObligation,"OVERDUE","ESCALATE")).toBe("ESCALATED"));
});
