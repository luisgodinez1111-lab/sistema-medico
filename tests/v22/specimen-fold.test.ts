import{describe,it,expect}from"vitest";
import{foldSpecimen,assertSpecimenTransition}from"../../packages/specimen-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const col={sequence:1,payload:{kind:"COLLECTED",patientId:"p1",specimenType:"BLOOD",orderId:"o1"}};
describe("specimen fold (EPIC AF)",()=>{
 it("empty -> not exists",()=>{expect(foldSpecimen([]).exists).toBe(false);});
 it("collected -> COLLECTED v1 with type",()=>{const f=foldSpecimen([col]);expect(f.state).toBe("COLLECTED");expect(f.specimenType).toBe("BLOOD");expect(f.orderId).toBe("o1");});
 it("collect -> transit -> received -> resulted",()=>{
  const evs=[col,{sequence:2,payload:{kind:"IN_TRANSIT"}},{sequence:3,payload:{kind:"RECEIVED"}},{sequence:4,payload:{kind:"RESULTED"}}];
  expect(foldSpecimen(evs.slice(0,3)).state).toBe("RECEIVED");
  expect(foldSpecimen(evs).state).toBe("RESULTED");
 });
 it("reject from received is terminal",()=>{expect(foldSpecimen([col,{sequence:2,payload:{kind:"IN_TRANSIT"}},{sequence:3,payload:{kind:"RECEIVED"}},{sequence:4,payload:{kind:"REJECTED"}}]).state).toBe("REJECTED");});
});
describe("specimen transition guard (EPIC AF)",()=>{
 it("allows the chain of custody incl. rejection en cada etapa",()=>{
  expect(()=>assertSpecimenTransition("COLLECTED","IN_TRANSIT")).not.toThrow();
  expect(()=>assertSpecimenTransition("IN_TRANSIT","RECEIVED")).not.toThrow();
  expect(()=>assertSpecimenTransition("RECEIVED","RESULTED")).not.toThrow();
  expect(()=>assertSpecimenTransition("COLLECTED","REJECTED")).not.toThrow();
  expect(()=>assertSpecimenTransition("RECEIVED","REJECTED")).not.toThrow();
 });
 it("blocks resultar sin recibir y mutar terminal",()=>{
  const err=(()=>{try{assertSpecimenTransition("IN_TRANSIT","RESULTED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertSpecimenTransition("RESULTED","REJECTED")).toThrow();
  expect(()=>assertSpecimenTransition("REJECTED","RECEIVED")).toThrow();
 });
});
