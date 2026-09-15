
import {describe,it,expect} from "vitest";
import {invResultClosedHasAccountableEvidence,invObligationTerminalIsExplicit,invUnknownNeverReassuring,invPhysicianAuthority} from "../../packages/clinical-safety/src/invariants";
describe("invariant-as-code",()=>{
 it("blocks result closure without evidence",()=>expect(()=>invResultClosedHasAccountableEvidence("CLOSED")).toThrow(/WITHOUT_EVIDENCE/));
 it("does not treat overdue obligation as terminal success",()=>expect(invObligationTerminalIsExplicit("OVERDUE")).toBe(false));
 it("blocks non-computed reassuring value",()=>expect(()=>invUnknownNeverReassuring("INSUFFICIENT_DATA",0)).toThrow(/NONCOMPUTED_WITH_VALUE/));
 it("requires physician for decision/signature",()=>expect(()=>invPhysicianAuthority("DECIDED","AI")).toThrow(/HUMAN_AUTHORITY_REQUIRED/));
});
