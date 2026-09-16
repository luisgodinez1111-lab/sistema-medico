import{describe,it,expect}from"vitest";
import{foldReferral,assertReferralTransition}from"../../packages/referral-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const req={sequence:1,payload:{kind:"REQUESTED",patientId:"p1",specialty:"Cardiología",reason:"Soplo sistólico"}};
describe("referral fold (EPIC T)",()=>{
 it("empty -> not exists",()=>{expect(foldReferral([]).exists).toBe(false);});
 it("requested -> REQUESTED v1 with clinical data",()=>{const f=foldReferral([req]);expect(f.state).toBe("REQUESTED");expect(f.specialty).toBe("Cardiología");expect(f.reason).toBe("Soplo sistólico");});
 it("accept then complete",()=>{expect(foldReferral([req,{sequence:2,payload:{kind:"ACCEPTED"}}]).state).toBe("ACCEPTED");expect(foldReferral([req,{sequence:2,payload:{kind:"ACCEPTED"}},{sequence:3,payload:{kind:"COMPLETED"}}]).state).toBe("COMPLETED");});
 it("decline from requested",()=>{expect(foldReferral([req,{sequence:2,payload:{kind:"DECLINED"}}]).state).toBe("DECLINED");});
});
describe("referral transition guard (EPIC T)",()=>{
 it("allows REQUESTED->ACCEPTED/DECLINED/CANCELLED and ACCEPTED->COMPLETED/CANCELLED",()=>{
  expect(()=>assertReferralTransition("REQUESTED","ACCEPTED")).not.toThrow();
  expect(()=>assertReferralTransition("REQUESTED","DECLINED")).not.toThrow();
  expect(()=>assertReferralTransition("REQUESTED","CANCELLED")).not.toThrow();
  expect(()=>assertReferralTransition("ACCEPTED","COMPLETED")).not.toThrow();
  expect(()=>assertReferralTransition("ACCEPTED","CANCELLED")).not.toThrow();
 });
 it("blocks completing a REQUESTED (must accept first) and mutating terminal",()=>{
  const err=(()=>{try{assertReferralTransition("REQUESTED","COMPLETED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertReferralTransition("COMPLETED","CANCELLED")).toThrow();
  expect(()=>assertReferralTransition("DECLINED","ACCEPTED")).toThrow();
 });
});
