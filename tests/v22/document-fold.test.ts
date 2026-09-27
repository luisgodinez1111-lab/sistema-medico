import{describe,it,expect}from"vitest";
import{foldDocument,assertDocumentTransition,DOCUMENT_ANNOTATION_KINDS}from"../../packages/document-fold/src";
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
// Lote 11, hallazgo D3: adjuntar/quitar un archivo es una anotación (estado igual, versión +1); el documento sigue su ciclo.
describe("anotaciones de adjuntos (lote 11, D3)",()=>{
 const created={sequence:1,payload:{kind:"CREATED",patientId:"p1",docType:"PROGRESS_NOTE",content:"x"}};
 it("ATTACHED y ATTACHMENT_REMOVED no cambian el estado y avanzan la versión",()=>{
  const f=foldDocument([created,{sequence:2,payload:{kind:"ATTACHED",attachmentId:"a1"}},{sequence:3,payload:{kind:"FINALIZED"}},{sequence:4,payload:{kind:"SIGNED"}},{sequence:5,payload:{kind:"ATTACHMENT_REMOVED",attachmentId:"a1"}}]);
  expect([f.state,f.version]).toEqual(["SIGNED",5]);
  expect(()=>assertDocumentTransition(f.state,"AMENDED")).not.toThrow();
 });
 it("el vocabulario de anotaciones es el que proyecta el SQL",()=>{expect([...DOCUMENT_ANNOTATION_KINDS]).toEqual(["ATTACHED","ATTACHMENT_REMOVED"]);});
});
