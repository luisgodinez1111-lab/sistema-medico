
import {describe,it,expect} from "vitest";
import {requireRecovery} from "../../packages/clinical-safety/src/reconciliation";
describe("Reconciliation",()=>{
 it("fails if accountable owner is missing",()=>expect(()=>requireRecovery({workflow:"results",entityId:"r1",kind:"ORPHAN",severity:"S1"})).toThrow(/OWNER_REQUIRED/));
 it("blocks S1 until recovery",()=>expect(requireRecovery({workflow:"results",entityId:"r1",kind:"ORPHAN",severity:"S1"},"results-service").action).toBe("BLOCK"));
});
