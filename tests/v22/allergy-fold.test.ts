import{describe,it,expect}from"vitest";
import{foldAllergy,assertAllergyTransition}from"../../packages/allergy-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const rec={sequence:1,payload:{kind:"RECORDED",patientId:"p-1",substance:"penicilina",severity:"SEVERE"}};
describe("allergy fold (EPIC R)",()=>{
 it("empty -> not exists",()=>{expect(foldAllergy([]).exists).toBe(false);});
 it("recorded -> ACTIVE v1 with substance",()=>{const f=foldAllergy([rec]);expect(f.state).toBe("ACTIVE");expect(f.substance).toBe("penicilina");expect(f.patientId).toBe("p-1");});
 it("inactivate then reactivate",()=>{expect(foldAllergy([rec,{sequence:2,payload:{kind:"INACTIVATED"}}]).state).toBe("INACTIVE");expect(foldAllergy([rec,{sequence:2,payload:{kind:"INACTIVATED"}},{sequence:3,payload:{kind:"REACTIVATED"}}]).state).toBe("ACTIVE");});
});
describe("allergy transition guard (EPIC R)",()=>{
 it("allows ACTIVE->{REFUTED,INACTIVE} and INACTIVE->ACTIVE",()=>{expect(()=>assertAllergyTransition("ACTIVE","INACTIVE")).not.toThrow();expect(()=>assertAllergyTransition("ACTIVE","REFUTED")).not.toThrow();expect(()=>assertAllergyTransition("INACTIVE","ACTIVE")).not.toThrow();});
 it("blocks mutating a REFUTED allergy (terminal)",()=>{const err=(()=>{try{assertAllergyTransition("REFUTED","ACTIVE");}catch(e){return e;}})();expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");});
});
