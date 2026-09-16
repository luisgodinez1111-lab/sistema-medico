import{describe,it,expect}from"vitest";
import{foldProblem,assertProblemTransition}from"../../packages/problem-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const added={sequence:1,payload:{kind:"ADDED",patientId:"p-1",code:"J02",description:"Faringitis"}};
describe("problem fold (EPIC Q)",()=>{
 it("empty -> not exists",()=>{expect(foldProblem([]).exists).toBe(false);});
 it("added -> ACTIVE v1",()=>{const f=foldProblem([added]);expect(f.state).toBe("ACTIVE");expect(f.patientId).toBe("p-1");});
 it("resolved then reactivated",()=>{expect(foldProblem([added,{sequence:2,payload:{kind:"RESOLVED",note:"n"}}]).state).toBe("RESOLVED");expect(foldProblem([added,{sequence:2,payload:{kind:"RESOLVED",note:"n"}},{sequence:3,payload:{kind:"REACTIVATED"}}]).state).toBe("ACTIVE");});
 it("marked chronic",()=>{expect(foldProblem([added,{sequence:2,payload:{kind:"MARKED_CHRONIC"}}]).state).toBe("CHRONIC");});
});
describe("problem transition guard (EPIC Q)",()=>{
 it("allows ACTIVE->{RESOLVED,CHRONIC} and RESOLVED->ACTIVE",()=>{
  expect(()=>assertProblemTransition("ACTIVE","RESOLVED")).not.toThrow();
  expect(()=>assertProblemTransition("ACTIVE","CHRONIC")).not.toThrow();
  expect(()=>assertProblemTransition("RESOLVED","ACTIVE")).not.toThrow();
 });
 it("blocks mutating ENTERED_IN_ERROR (terminal)",()=>{const err=(()=>{try{assertProblemTransition("ENTERED_IN_ERROR","ACTIVE");}catch(e){return e;}})();expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");});
});
