import {describe,it,expect} from "vitest";
import {assertObligationTransition,signatureBlockReason,foldObligation} from "../../packages/obligation-fold/src";
// Auditoría 2026-09-19 (K-02): Zero Lost Follow-Up contra el fold REAL. "Vencida" no es un estado que el sistema pueda
// alcanzar por sí solo: es una obligación ABIERTA cuya fecha pasó, y así bloquea la firma; nunca equivale a completada.
describe("Zero Lost Follow-Up (fold real)",()=>{
 it("does not infer completion from overdue: una obligación abierta y vencida sigue OPEN y bloquea la firma",()=>{
  const o=foldObligation([{sequence:1,payload:{kind:"CREATED",patientId:"p",dueAt:"2026-09-01T00:00:00Z",priority:"ROUTINE"}}]);
  expect(o.state).toBe("OPEN");
  expect(signatureBlockReason({state:"OPEN",priority:"ROUTINE",dueAt:"2026-09-01T00:00:00Z"},"2026-09-22T00:00:00Z")).toBe("OVERDUE");
 });
 it("requires an explicit terminal: solo COMPLETED o CANCELLED cierran; una completada ya no bloquea",()=>{
  expect(()=>assertObligationTransition("OPEN","COMPLETED")).not.toThrow();
  expect(()=>assertObligationTransition("COMPLETED","OPEN")).toThrow(/Illegal obligation transition/);
  expect(signatureBlockReason({state:"COMPLETED",priority:"ROUTINE",dueAt:"2026-09-01T00:00:00Z"},"2026-09-22T00:00:00Z")).toBeUndefined();
 });
 it("una fecha de vencimiento inválida bloquea (no se asume 'a tiempo')",()=>{
  expect(signatureBlockReason({state:"OPEN",priority:"ROUTINE",dueAt:"no-es-fecha"},"2026-09-22T00:00:00Z")).toBe("INVALID_DUE_DATE");
 });
});
