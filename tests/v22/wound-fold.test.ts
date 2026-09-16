import{describe,it,expect}from"vitest";
import{foldWound,assertWoundTransition}from"../../packages/wound-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const doc={sequence:1,payload:{kind:"DOCUMENTED",patientId:"p1",location:"SACRUM",stage:"STAGE_2"}};
describe("wound fold (EPIC AI)",()=>{
 it("empty -> not exists",()=>{expect(foldWound([]).exists).toBe(false);});
 it("documented -> OPEN v1 with location/stage",()=>{const f=foldWound([doc]);expect(f.state).toBe("OPEN");expect(f.location).toBe("SACRUM");expect(f.stage).toBe("STAGE_2");});
 it("reassess updates the current stage and can repeat",()=>{
  const f=foldWound([doc,{sequence:2,payload:{kind:"REASSESSED",stage:"STAGE_3"}},{sequence:3,payload:{kind:"REASSESSED",stage:"STAGE_4"}}]);
  expect(f.state).toBe("OPEN");expect(f.stage).toBe("STAGE_4");
 });
 it("healed and escalated are terminal",()=>{
  expect(foldWound([doc,{sequence:2,payload:{kind:"HEALED"}}]).state).toBe("HEALED");
  expect(foldWound([doc,{sequence:2,payload:{kind:"ESCALATED"}}]).state).toBe("ESCALATED");
 });
});
describe("wound transition guard (EPIC AI)",()=>{
 it("allows OPEN -> {OPEN, HEALED, ESCALATED}",()=>{
  expect(()=>assertWoundTransition("OPEN","OPEN")).not.toThrow();
  expect(()=>assertWoundTransition("OPEN","HEALED")).not.toThrow();
  expect(()=>assertWoundTransition("OPEN","ESCALATED")).not.toThrow();
 });
 it("blocks mutating a terminal HEALED/ESCALATED",()=>{
  const err=(()=>{try{assertWoundTransition("HEALED","OPEN");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertWoundTransition("ESCALATED","OPEN")).toThrow();
 });
});
