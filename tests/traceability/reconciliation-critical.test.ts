
import {describe,it,expect} from "vitest";
import {requireRecovery} from "../../packages/clinical-safety/src/reconciliation";
describe("critical reconciliation",()=>{
 for(const kind of ["ORPHAN","OVERDUE","STATE_EVENT_MISMATCH"] as const){
  it(`produces accountable recovery for ${kind}`,()=>{
   const r=requireRecovery({workflow:"critical-results",entityId:"x",kind,severity:"S1"},"results-service");
   expect(r.owner).toBe("results-service"); expect(r.action).toBe("BLOCK"); expect(r.evidence).toMatch(/PENDING/);
  });
 }
});
