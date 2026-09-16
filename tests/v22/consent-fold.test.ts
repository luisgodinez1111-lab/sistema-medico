import{describe,it,expect}from"vitest";
import{foldConsent,assertConsentTransition}from"../../packages/consent-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const draft={sequence:1,payload:{kind:"DRAFTED",patientId:"p1",scopeType:"PROCEDURE",documentRef:"CI-2026-001"}};
describe("consent fold (EPIC Z)",()=>{
 it("empty -> not exists",()=>{expect(foldConsent([]).exists).toBe(false);});
 it("drafted -> DRAFTED v1 with legal data",()=>{const f=foldConsent([draft]);expect(f.state).toBe("DRAFTED");expect(f.scopeType).toBe("PROCEDURE");expect(f.documentRef).toBe("CI-2026-001");});
 it("present -> grant -> revoke",()=>{
  const evs=[draft,{sequence:2,payload:{kind:"PRESENTED"}},{sequence:3,payload:{kind:"GRANTED"}},{sequence:4,payload:{kind:"REVOKED"}}];
  expect(foldConsent(evs.slice(0,2)).state).toBe("PRESENTED");
  expect(foldConsent(evs.slice(0,3)).state).toBe("GRANTED");
  expect(foldConsent(evs).state).toBe("REVOKED");
 });
 it("present -> decline",()=>{expect(foldConsent([draft,{sequence:2,payload:{kind:"PRESENTED"}},{sequence:3,payload:{kind:"DECLINED"}}]).state).toBe("DECLINED");});
});
describe("consent transition guard (EPIC Z)",()=>{
 it("allows DRAFTED->PRESENTED->{GRANTED,DECLINED} and GRANTED->REVOKED",()=>{
  expect(()=>assertConsentTransition("DRAFTED","PRESENTED")).not.toThrow();
  expect(()=>assertConsentTransition("PRESENTED","GRANTED")).not.toThrow();
  expect(()=>assertConsentTransition("PRESENTED","DECLINED")).not.toThrow();
  expect(()=>assertConsentTransition("GRANTED","REVOKED")).not.toThrow();
 });
 it("blocks granting before presenting and mutating terminal",()=>{
  const err=(()=>{try{assertConsentTransition("DRAFTED","GRANTED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertConsentTransition("DECLINED","GRANTED")).toThrow();
  expect(()=>assertConsentTransition("REVOKED","GRANTED")).toThrow();
 });
});
