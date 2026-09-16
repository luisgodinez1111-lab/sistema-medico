import{describe,it,expect}from"vitest";
import{foldPatient,assertPatientTransition}from"../../packages/patient-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const reg={sequence:1,payload:{kind:"REGISTERED",name:"Juan Pérez",birthDate:"1980-05-05",sexAtBirth:"MALE"}};
describe("patient fold (EPIC S)",()=>{
 it("empty -> not exists",()=>{expect(foldPatient([]).exists).toBe(false);});
 it("registered -> ACTIVE v1 with demographics",()=>{const f=foldPatient([reg]);expect(f.status).toBe("ACTIVE");expect(f.name).toBe("Juan Pérez");expect(f.sexAtBirth).toBe("MALE");});
 it("deactivate then reactivate",()=>{expect(foldPatient([reg,{sequence:2,payload:{kind:"DEACTIVATED"}}]).status).toBe("INACTIVE");expect(foldPatient([reg,{sequence:2,payload:{kind:"DEACTIVATED"}},{sequence:3,payload:{kind:"REACTIVATED"}}]).status).toBe("ACTIVE");});
});
describe("patient transition guard (EPIC S)",()=>{
 it("allows ACTIVE<->INACTIVE and ->DECEASED",()=>{expect(()=>assertPatientTransition("ACTIVE","INACTIVE")).not.toThrow();expect(()=>assertPatientTransition("INACTIVE","ACTIVE")).not.toThrow();expect(()=>assertPatientTransition("ACTIVE","DECEASED")).not.toThrow();});
 it("blocks mutating a DECEASED patient (terminal)",()=>{const err=(()=>{try{assertPatientTransition("DECEASED","ACTIVE");}catch(e){return e;}})();expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");});
});
