import{describe,it,expect}from"vitest";
import{foldClaim,assertClaimTransition}from"../../packages/claim-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const draft={sequence:1,payload:{kind:"DRAFTED",patientId:"p1",amount:"1500.00",currency:"MXN"}};
describe("claim fold (EPIC Y)",()=>{
 it("empty -> not exists",()=>{expect(foldClaim([]).exists).toBe(false);});
 it("drafted -> DRAFT v1 with amount",()=>{const f=foldClaim([draft]);expect(f.state).toBe("DRAFT");expect(f.amount).toBe("1500.00");expect(f.currency).toBe("MXN");});
 it("code -> submit -> reject -> resubmit -> pay",()=>{
  const evs=[draft,{sequence:2,payload:{kind:"CODED"}},{sequence:3,payload:{kind:"SUBMITTED"}},{sequence:4,payload:{kind:"REJECTED"}},{sequence:5,payload:{kind:"SUBMITTED"}},{sequence:6,payload:{kind:"PAID"}}];
  expect(foldClaim(evs.slice(0,3)).state).toBe("SUBMITTED");
  expect(foldClaim(evs.slice(0,4)).state).toBe("REJECTED");
  expect(foldClaim(evs.slice(0,5)).state).toBe("SUBMITTED");
  expect(foldClaim(evs).state).toBe("PAID");
 });
});
describe("claim transition guard (EPIC Y)",()=>{
 it("allows the revenue-cycle path incl. resubmit loop",()=>{
  expect(()=>assertClaimTransition("DRAFT","CODED")).not.toThrow();
  expect(()=>assertClaimTransition("CODED","SUBMITTED")).not.toThrow();
  expect(()=>assertClaimTransition("SUBMITTED","PAID")).not.toThrow();
  expect(()=>assertClaimTransition("SUBMITTED","REJECTED")).not.toThrow();
  expect(()=>assertClaimTransition("REJECTED","SUBMITTED")).not.toThrow();
  expect(()=>assertClaimTransition("CODED","VOIDED")).not.toThrow();
 });
 it("blocks submitting a DRAFT (must code first) and mutating terminal",()=>{
  const err=(()=>{try{assertClaimTransition("DRAFT","SUBMITTED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertClaimTransition("PAID","VOIDED")).toThrow();
  expect(()=>assertClaimTransition("VOIDED","SUBMITTED")).toThrow();
 });
});
