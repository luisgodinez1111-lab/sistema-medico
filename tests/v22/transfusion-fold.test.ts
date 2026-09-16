import{describe,it,expect}from"vitest";
import{foldTransfusion,assertTransfusionTransition}from"../../packages/transfusion-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const ord={sequence:1,payload:{kind:"ORDERED",patientId:"p1",bloodProduct:"PRBC",units:"2"}};
describe("transfusion fold (EPIC AJ)",()=>{
 it("empty -> not exists",()=>{expect(foldTransfusion([]).exists).toBe(false);});
 it("ordered -> ORDERED v1 with product",()=>{const f=foldTransfusion([ord]);expect(f.state).toBe("ORDERED");expect(f.bloodProduct).toBe("PRBC");expect(f.units).toBe("2");});
 it("order -> crossmatch -> start -> complete",()=>{
  const evs=[ord,{sequence:2,payload:{kind:"CROSSMATCHED"}},{sequence:3,payload:{kind:"STARTED"}},{sequence:4,payload:{kind:"COMPLETED"}}];
  expect(foldTransfusion(evs.slice(0,3)).state).toBe("TRANSFUSING");
  expect(foldTransfusion(evs).state).toBe("COMPLETED");
 });
 it("reaction from transfusing is terminal",()=>{expect(foldTransfusion([ord,{sequence:2,payload:{kind:"CROSSMATCHED"}},{sequence:3,payload:{kind:"STARTED"}},{sequence:4,payload:{kind:"REACTION"}}]).state).toBe("REACTION");});
});
describe("transfusion transition guard (EPIC AJ)",()=>{
 it("allows la cadena pre-transfusional",()=>{
  expect(()=>assertTransfusionTransition("ORDERED","CROSSMATCHED")).not.toThrow();
  expect(()=>assertTransfusionTransition("CROSSMATCHED","TRANSFUSING")).not.toThrow();
  expect(()=>assertTransfusionTransition("TRANSFUSING","COMPLETED")).not.toThrow();
  expect(()=>assertTransfusionTransition("TRANSFUSING","REACTION")).not.toThrow();
  expect(()=>assertTransfusionTransition("ORDERED","CANCELLED")).not.toThrow();
 });
 it("blocks iniciar sin cruzar y mutar terminal",()=>{
  const err=(()=>{try{assertTransfusionTransition("ORDERED","TRANSFUSING");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertTransfusionTransition("COMPLETED","REACTION")).toThrow();
  expect(()=>assertTransfusionTransition("REACTION","TRANSFUSING")).toThrow();
 });
});
