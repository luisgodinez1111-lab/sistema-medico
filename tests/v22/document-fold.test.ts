import{describe,it,expect}from"vitest";
import{foldDocument,assertDocumentTransition}from"../../packages/document-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";

const created={sequence:1,payload:{kind:"CREATED",patientId:"p-1",docType:"PROGRESS_NOTE",title:"t",content:"nota clinica"}};
const finalized={sequence:2,payload:{kind:"FINALIZED"}};
const signed={sequence:3,payload:{kind:"SIGNED",authorId:"dr-1",contentHash:"h"}};
const amended=(s:number)=>({sequence:s,payload:{kind:"AMENDED",authorId:"dr-1",addendum:"addendum "+s}});

describe("document fold (EPIC I)",()=>{
 it("empty -> not exists",()=>{expect(foldDocument([]).exists).toBe(false);});
 it("created -> DRAFT v1 with content",()=>{const f=foldDocument([created]);expect(f.state).toBe("DRAFT");expect(f.version).toBe(1);expect(f.patientId).toBe("p-1");expect(f.content).toBe("nota clinica");});
 it("through finalize/sign",()=>{
  expect(foldDocument([created,finalized]).state).toBe("FINALIZED");
  expect(foldDocument([created,finalized,signed]).state).toBe("SIGNED");
 });
 it("append-only amendments accumulate (history never shrinks)",()=>{
  const f=foldDocument([created,finalized,signed,amended(4),amended(5)]);
  expect(f.state).toBe("AMENDED");expect(f.version).toBe(5);expect(f.amendmentCount).toBe(2);
 });
});

describe("document transition guard (EPIC I)",()=>{
 it("allows DRAFT->FINALIZED->SIGNED->AMENDED->AMENDED",()=>{
  expect(()=>assertDocumentTransition("DRAFT","FINALIZED")).not.toThrow();
  expect(()=>assertDocumentTransition("FINALIZED","SIGNED")).not.toThrow();
  expect(()=>assertDocumentTransition("SIGNED","AMENDED")).not.toThrow();
  expect(()=>assertDocumentTransition("AMENDED","AMENDED")).not.toThrow();
 });
 it("blocks editing a SIGNED document (immutability)",()=>{
  const err=(()=>{try{assertDocumentTransition("SIGNED","FINALIZED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
 });
 it("blocks signing a DRAFT directly (must finalize first)",()=>{expect(()=>assertDocumentTransition("DRAFT","SIGNED")).toThrow();});
});
