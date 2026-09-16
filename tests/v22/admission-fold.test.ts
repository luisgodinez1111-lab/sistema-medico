import{describe,it,expect}from"vitest";
import{foldAdmission,assertAdmissionTransition}from"../../packages/admission-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const adm={sequence:1,payload:{kind:"ADMITTED",patientId:"p1",unit:"ER",reason:"Dolor torácico"}};
describe("admission fold (EPIC AE)",()=>{
 it("empty -> not exists",()=>{expect(foldAdmission([]).exists).toBe(false);});
 it("admitted -> ADMITTED v1 with unit",()=>{const f=foldAdmission([adm]);expect(f.state).toBe("ADMITTED");expect(f.unit).toBe("ER");expect(f.reason).toBe("Dolor torácico");});
 it("transfer updates the current unit and can repeat",()=>{
  const f=foldAdmission([adm,{sequence:2,payload:{kind:"TRANSFERRED",unit:"ICU"}},{sequence:3,payload:{kind:"TRANSFERRED",unit:"WARD"}}]);
  expect(f.state).toBe("TRANSFERRED");expect(f.unit).toBe("WARD");
 });
 it("discharge is terminal",()=>{expect(foldAdmission([adm,{sequence:2,payload:{kind:"DISCHARGED"}}]).state).toBe("DISCHARGED");});
});
describe("admission transition guard (EPIC AE)",()=>{
 it("allows ADMITTED/TRANSFERRED -> {TRANSFERRED, DISCHARGED, CANCELLED}",()=>{
  expect(()=>assertAdmissionTransition("ADMITTED","TRANSFERRED")).not.toThrow();
  expect(()=>assertAdmissionTransition("ADMITTED","DISCHARGED")).not.toThrow();
  expect(()=>assertAdmissionTransition("TRANSFERRED","TRANSFERRED")).not.toThrow();
  expect(()=>assertAdmissionTransition("TRANSFERRED","DISCHARGED")).not.toThrow();
  expect(()=>assertAdmissionTransition("ADMITTED","CANCELLED")).not.toThrow();
 });
 it("blocks mutating a terminal DISCHARGED/CANCELLED",()=>{
  const err=(()=>{try{assertAdmissionTransition("DISCHARGED","TRANSFERRED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertAdmissionTransition("CANCELLED","DISCHARGED")).toThrow();
 });
});
