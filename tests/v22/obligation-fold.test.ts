import{describe,it,expect}from"vitest";
import{foldObligation,assertObligationTransition}from"../../packages/obligation-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const created={sequence:1,payload:{kind:"CREATED",patientId:"p-1",ownerId:"o-1"}};
describe("obligation fold (EPIC O)",()=>{
 it("empty -> not exists",()=>{expect(foldObligation([]).exists).toBe(false);});
 it("created -> OPEN v1",()=>{const f=foldObligation([created]);expect(f.state).toBe("OPEN");expect(f.patientId).toBe("p-1");});
 it("through progress/completed",()=>{expect(foldObligation([created,{sequence:2,payload:{kind:"STARTED"}}]).state).toBe("IN_PROGRESS");expect(foldObligation([created,{sequence:2,payload:{kind:"COMPLETED",evidence:"x"}}]).state).toBe("COMPLETED");});
});
describe("obligation transition guard (EPIC O)",()=>{
 it("allows OPEN->{IN_PROGRESS,COMPLETED,CANCELLED} and IN_PROGRESS->COMPLETED",()=>{
  expect(()=>assertObligationTransition("OPEN","IN_PROGRESS")).not.toThrow();
  expect(()=>assertObligationTransition("OPEN","COMPLETED")).not.toThrow();
  expect(()=>assertObligationTransition("IN_PROGRESS","COMPLETED")).not.toThrow();
 });
 it("blocks mutating a COMPLETED obligation",()=>{const err=(()=>{try{assertObligationTransition("COMPLETED","IN_PROGRESS");}catch(e){return e;}})();expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");});
});
