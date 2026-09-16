import{describe,it,expect}from"vitest";
import{summarizePatient}from"../../packages/patient-summary/src";
const items=[
 {aggregateType:"Encounter",latestKind:"SIGNED"},
 {aggregateType:"Encounter",latestKind:"OPENED"},
 {aggregateType:"Medication",latestKind:"ACTIVATED"},
 {aggregateType:"Medication",latestKind:"STOPPED"},
 {aggregateType:"DiagnosticResult",latestKind:"ACTIONED"},
 {aggregateType:"DiagnosticResult",latestKind:"CLOSED"},
 {aggregateType:"ClinicalOrder",latestKind:"ORDERED"},
 {aggregateType:"ClinicalOrder",latestKind:"FULFILLED"},
 {aggregateType:"ClinicalObligation",latestKind:"OPEN"},
 {aggregateType:"ClinicalObligation",latestKind:"COMPLETED"},
];
describe("patient summary (EPIC P — computed state)",()=>{
 it("cuenta correctamente lo abierto/activo por tipo",()=>{
  const s=summarizePatient(items);
  expect(s.signedEncounters).toBe(1);
  expect(s.activeMedications).toBe(1);
  expect(s.openResults).toBe(1);
  expect(s.openOrders).toBe(1);
  expect(s.openObligations).toBe(1);
  expect(s.totalItems).toBe(10);
 });
 it("vacío -> todo en cero",()=>{expect(summarizePatient([])).toEqual({openObligations:0,activeMedications:0,openResults:0,openOrders:0,signedEncounters:0,totalItems:0});});
});
