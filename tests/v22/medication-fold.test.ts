import{describe,it,expect}from"vitest";
import{foldMedication,assertMedicationTransition}from"../../packages/medication-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";

const proposed={sequence:1,payload:{kind:"PROPOSED",patientId:"p-1",drugCode:"D",dose:"1",route:"PO",frequency:"QD"}};
const prescribed={sequence:2,payload:{kind:"PRESCRIBED",prescriberId:"dr-1"}};
const activated={sequence:3,payload:{kind:"ACTIVATED"}};
const stopped={sequence:4,payload:{kind:"STOPPED",reason:"adverse"}};

describe("medication fold (EPIC H)",()=>{
 it("empty -> not exists",()=>{expect(foldMedication([]).exists).toBe(false);});
 it("proposed -> PROPOSED v1 with patient",()=>{const f=foldMedication([proposed]);expect(f.state).toBe("PROPOSED");expect(f.version).toBe(1);expect(f.patientId).toBe("p-1");});
 it("through prescribe/activate/stop",()=>{
  expect(foldMedication([proposed,prescribed]).state).toBe("PRESCRIBED");
  expect(foldMedication([proposed,prescribed,activated]).state).toBe("ACTIVE");
  const f=foldMedication([proposed,prescribed,activated,stopped]);expect(f.state).toBe("STOPPED");expect(f.version).toBe(4);
 });
});

describe("medication transition guard (EPIC H)",()=>{
 it("allows the lifecycle path",()=>{
  expect(()=>assertMedicationTransition("PROPOSED","PRESCRIBED")).not.toThrow();
  expect(()=>assertMedicationTransition("PRESCRIBED","ACTIVE")).not.toThrow();
  expect(()=>assertMedicationTransition("ACTIVE","STOPPED")).not.toThrow();
  expect(()=>assertMedicationTransition("ACTIVE","HELD")).not.toThrow();
  expect(()=>assertMedicationTransition("HELD","ACTIVE")).not.toThrow();
 });
 it("blocks skipping prescription (PROPOSED -> ACTIVE)",()=>{
  const err=(()=>{try{assertMedicationTransition("PROPOSED","ACTIVE");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
 });
 it("blocks mutating a STOPPED medication",()=>{expect(()=>assertMedicationTransition("STOPPED","ACTIVE")).toThrow();});
});
