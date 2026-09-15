import { describe,it,expect } from "vitest";
import { assertTransition } from "../../packages/clinical-kernel/src/state-machine";
import { ResultLifecycle, MedicationLifecycle } from "../../packages/clinical-kernel/src/formal-machines";

describe("Result lifecycle truthfulness",()=>{
 it("does not allow RECEIVED to become CLOSED directly",()=>{
  expect(()=>assertTransition(ResultLifecycle,"RECEIVED","CLOSE")).toThrow(/ILLEGAL_TRANSITION/);
 });
 it("requires explicit verification",()=>{
  expect(assertTransition(ResultLifecycle,"RECEIVED","VERIFY")).toBe("VERIFIED");
 });
});
describe("Medication physician-controlled lifecycle",()=>{
 it("does not allow PROPOSED to become ACTIVE directly",()=>{
  expect(()=>assertTransition(MedicationLifecycle,"PROPOSED","ACTIVATE")).toThrow(/ILLEGAL_TRANSITION/);
 });
});
