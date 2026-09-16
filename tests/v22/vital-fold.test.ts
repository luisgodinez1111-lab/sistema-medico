import{describe,it,expect}from"vitest";
import{foldVital,assertVitalTransition}from"../../packages/vital-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const rec={sequence:1,payload:{kind:"RECORDED",patientId:"p1",vitalType:"BP",value:"120/80",unit:"mmHg"}};
describe("vital fold (EPIC W)",()=>{
 it("empty -> not exists",()=>{expect(foldVital([]).exists).toBe(false);});
 it("recorded -> RECORDED v1 with value",()=>{const f=foldVital([rec]);expect(f.state).toBe("RECORDED");expect(f.vitalType).toBe("BP");expect(f.value).toBe("120/80");expect(f.unit).toBe("mmHg");});
 it("amend updates the current value (append-only)",()=>{const f=foldVital([rec,{sequence:2,payload:{kind:"AMENDED",value:"130/85",unit:"mmHg",reason:"typo"}}]);expect(f.state).toBe("AMENDED");expect(f.value).toBe("130/85");});
 it("re-amend keeps latest value",()=>{const f=foldVital([rec,{sequence:2,payload:{kind:"AMENDED",value:"130/85",unit:"mmHg"}},{sequence:3,payload:{kind:"AMENDED",value:"128/82",unit:"mmHg"}}]);expect(f.state).toBe("AMENDED");expect(f.value).toBe("128/82");});
 it("entered in error is terminal",()=>{expect(foldVital([rec,{sequence:2,payload:{kind:"ENTERED_IN_ERROR"}}]).state).toBe("ENTERED_IN_ERROR");});
});
describe("vital transition guard (EPIC W)",()=>{
 it("allows RECORDED/AMENDED -> {AMENDED, ENTERED_IN_ERROR}",()=>{
  expect(()=>assertVitalTransition("RECORDED","AMENDED")).not.toThrow();
  expect(()=>assertVitalTransition("RECORDED","ENTERED_IN_ERROR")).not.toThrow();
  expect(()=>assertVitalTransition("AMENDED","AMENDED")).not.toThrow();
  expect(()=>assertVitalTransition("AMENDED","ENTERED_IN_ERROR")).not.toThrow();
 });
 it("blocks mutating a terminal ENTERED_IN_ERROR",()=>{
  const err=(()=>{try{assertVitalTransition("ENTERED_IN_ERROR","AMENDED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
 });
});
