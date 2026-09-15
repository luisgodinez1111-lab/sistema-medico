
import {describe,it,expect} from "vitest";
import {assertClinicalApplicability} from "../../packages/clinical-safety/src/applicability";
describe("Clinical applicability gate",()=>{
  it("fails closed when renal function is required but unknown",()=>{
    expect(()=>assertClinicalApplicability({id:"RULE-X",requiresRenalFunction:true},{renalFunctionKnown:false}))
      .toThrow(/RENAL_FUNCTION_UNKNOWN/);
  });
  it("blocks unsupported age context",()=>{
    expect(()=>assertClinicalApplicability({id:"RULE-PED",maxAgeYears:17},{ageYears:40}))
      .toThrow(/MAX_AGE/);
  });
  it("allows explicitly supported context",()=>{
    expect(assertClinicalApplicability({id:"RULE-X",minAgeYears:18,supportedUnitSystems:["SI"]},{ageYears:40,unitSystem:"SI"})).toBe(true);
  });
});
