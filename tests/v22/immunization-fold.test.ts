import{describe,it,expect}from"vitest";
import{foldImmunization,assertImmunizationTransition}from"../../packages/immunization-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const due={sequence:1,payload:{kind:"DUE",patientId:"p1",vaccineCode:"SRP",dose:"1"}};
describe("immunization fold (EPIC V)",()=>{
 it("empty -> not exists",()=>{expect(foldImmunization([]).exists).toBe(false);});
 it("due -> DUE v1 with vaccine data",()=>{const f=foldImmunization([due]);expect(f.state).toBe("DUE");expect(f.vaccineCode).toBe("SRP");expect(f.dose).toBe("1");});
 it("administer then adverse event",()=>{expect(foldImmunization([due,{sequence:2,payload:{kind:"ADMINISTERED"}}]).state).toBe("ADMINISTERED");expect(foldImmunization([due,{sequence:2,payload:{kind:"ADMINISTERED"}},{sequence:3,payload:{kind:"ADVERSE_EVENT"}}]).state).toBe("ADVERSE_EVENT");});
 it("refuse from due",()=>{expect(foldImmunization([due,{sequence:2,payload:{kind:"REFUSED"}}]).state).toBe("REFUSED");});
});
describe("immunization transition guard (EPIC V)",()=>{
 it("allows DUE->{ADMINISTERED,REFUSED} and ADMINISTERED->ADVERSE_EVENT",()=>{
  expect(()=>assertImmunizationTransition("DUE","ADMINISTERED")).not.toThrow();
  expect(()=>assertImmunizationTransition("DUE","REFUSED")).not.toThrow();
  expect(()=>assertImmunizationTransition("ADMINISTERED","ADVERSE_EVENT")).not.toThrow();
 });
 it("blocks adverse event without administration and mutating terminal",()=>{
  const err=(()=>{try{assertImmunizationTransition("DUE","ADVERSE_EVENT");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertImmunizationTransition("REFUSED","ADMINISTERED")).toThrow();
  expect(()=>assertImmunizationTransition("ADVERSE_EVENT","ADMINISTERED")).toThrow();
 });
});
