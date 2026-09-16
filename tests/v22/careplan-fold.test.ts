import{describe,it,expect}from"vitest";
import{foldCarePlan,assertCarePlanTransition}from"../../packages/careplan-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const prop={sequence:1,payload:{kind:"PROPOSED",patientId:"p1",category:"DIABETES",goal:"HbA1c < 7%"}};
describe("care plan fold (EPIC X)",()=>{
 it("empty -> not exists",()=>{expect(foldCarePlan([]).exists).toBe(false);});
 it("proposed -> PROPOSED v1 with goal",()=>{const f=foldCarePlan([prop]);expect(f.state).toBe("PROPOSED");expect(f.category).toBe("DIABETES");expect(f.goal).toBe("HbA1c < 7%");});
 it("activate -> hold -> resume -> achieve",()=>{
  const evs=[prop,{sequence:2,payload:{kind:"ACTIVATED"}},{sequence:3,payload:{kind:"HELD"}},{sequence:4,payload:{kind:"RESUMED"}},{sequence:5,payload:{kind:"ACHIEVED"}}];
  expect(foldCarePlan(evs.slice(0,2)).state).toBe("ACTIVE");
  expect(foldCarePlan(evs.slice(0,3)).state).toBe("ON_HOLD");
  expect(foldCarePlan(evs.slice(0,4)).state).toBe("ACTIVE");
  expect(foldCarePlan(evs).state).toBe("ACHIEVED");
 });
});
describe("care plan transition guard (EPIC X)",()=>{
 it("allows PROPOSED->ACTIVE, ACTIVE<->ON_HOLD, ACTIVE->ACHIEVED and cancels",()=>{
  expect(()=>assertCarePlanTransition("PROPOSED","ACTIVE")).not.toThrow();
  expect(()=>assertCarePlanTransition("ACTIVE","ON_HOLD")).not.toThrow();
  expect(()=>assertCarePlanTransition("ON_HOLD","ACTIVE")).not.toThrow();
  expect(()=>assertCarePlanTransition("ACTIVE","ACHIEVED")).not.toThrow();
  expect(()=>assertCarePlanTransition("ON_HOLD","CANCELLED")).not.toThrow();
 });
 it("blocks achieving a PROPOSED and mutating terminal",()=>{
  const err=(()=>{try{assertCarePlanTransition("PROPOSED","ACHIEVED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertCarePlanTransition("ACHIEVED","ACTIVE")).toThrow();
  expect(()=>assertCarePlanTransition("CANCELLED","ACTIVE")).toThrow();
 });
});
