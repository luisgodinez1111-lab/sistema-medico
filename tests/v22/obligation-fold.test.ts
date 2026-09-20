import{describe,it,expect}from"vitest";
import{foldObligation,assertObligationTransition,signatureBlockReason}from"../../packages/obligation-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const created={sequence:1,payload:{kind:"CREATED",patientId:"p-1",ownerId:"o-1"}};
describe("obligation fold (EPIC O)",()=>{
 it("empty -> not exists",()=>{expect(foldObligation([]).exists).toBe(false);});
 it("created -> OPEN v1",()=>{const f=foldObligation([created]);expect(f.state).toBe("OPEN");expect(f.patientId).toBe("p-1");});
 it("through progress/completed",()=>{expect(foldObligation([created,{sequence:2,payload:{kind:"STARTED"}}]).state).toBe("IN_PROGRESS");expect(foldObligation([created,{sequence:2,payload:{kind:"COMPLETED",evidence:"x"}}]).state).toBe("COMPLETED");});
});
describe("obligation transition guard (EPIC O)",()=>{
 it("allows OPEN->{IN_PROGRESS,COMPLETED,CANCELLED} and IN_PROGRESS->COMPLETED",()=>{
  expect(()=>assertObligationTransition("OPEN","IN_PROGRESS")).not.toThrow();
  expect(()=>assertObligationTransition("OPEN","COMPLETED")).not.toThrow();
  expect(()=>assertObligationTransition("IN_PROGRESS","COMPLETED")).not.toThrow();
 });
 it("blocks mutating a COMPLETED obligation",()=>{const err=(()=>{try{assertObligationTransition("COMPLETED","IN_PROGRESS");}catch(e){return e;}})();expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");});
});
// Auditoría 2026-09-19 (L-01) — criterio PURO de qué obligaciones bloquean la firma (antes: una tabla vacía => siempre 0).
describe("signatureBlockReason — Zero Lost Follow-Up",()=>{
 const NOW="2026-09-20T12:00:00.000Z";const future="2026-10-20T12:00:00.000Z";const past="2026-09-01T12:00:00.000Z";
 it("URGENT sin resolver bloquea aunque su fecha sea futura",()=>{
  expect(signatureBlockReason({state:"OPEN",priority:"URGENT",dueAt:future},NOW)).toBe("URGENT");
  expect(signatureBlockReason({state:"IN_PROGRESS",priority:"URGENT",dueAt:future},NOW)).toBe("URGENT");
 });
 it("VENCIDA sin resolver bloquea aunque sea de rutina (un seguimiento con fecha pasada ES un seguimiento perdido)",()=>{
  expect(signatureBlockReason({state:"OPEN",priority:"ROUTINE",dueAt:past},NOW)).toBe("OVERDUE");
  expect(signatureBlockReason({state:"IN_PROGRESS",dueAt:past},NOW)).toBe("OVERDUE");
 });
 it("futura y no urgente NO bloquea (tiene responsable y fecha: el seguimiento está en curso)",()=>{
  expect(signatureBlockReason({state:"OPEN",priority:"ROUTINE",dueAt:future},NOW)).toBeUndefined();
  expect(signatureBlockReason({state:"OPEN",priority:"HIGH",dueAt:future},NOW)).toBeUndefined();
 });
 it("resuelta (COMPLETED/CANCELLED) nunca bloquea, ni urgente ni vencida",()=>{
  expect(signatureBlockReason({state:"COMPLETED",priority:"URGENT",dueAt:past},NOW)).toBeUndefined();
  expect(signatureBlockReason({state:"CANCELLED",priority:"URGENT",dueAt:past},NOW)).toBeUndefined();
 });
 it("fecha límite ausente o ilegible => bloquea (fail-closed)",()=>{
  expect(signatureBlockReason({state:"OPEN",dueAt:"mañana"},NOW)).toBe("INVALID_DUE_DATE");
  expect(signatureBlockReason({state:"OPEN"},NOW)).toBe("INVALID_DUE_DATE");
  expect(signatureBlockReason({state:"OPEN",dueAt:null},NOW)).toBe("INVALID_DUE_DATE");
 });
 it("el límite exacto no está vencido; un milisegundo después sí",()=>{
  expect(signatureBlockReason({state:"OPEN",dueAt:NOW},NOW)).toBeUndefined();
  expect(signatureBlockReason({state:"OPEN",dueAt:NOW},"2026-09-20T12:00:00.001Z")).toBe("OVERDUE");
 });
});
