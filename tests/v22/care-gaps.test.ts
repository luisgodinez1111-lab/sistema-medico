import{describe,it,expect}from"vitest";
import{computeCareGaps,computePanelWorklist}from"../../packages/care-gaps/src";
const A=(aggregateType:string,latestKind:string,aggregateId="x")=>({aggregateType,aggregateId,latestKind});
const PR=(patientId:string,aggregateType:string,latestKind:string,aggregateId=patientId+aggregateType)=>({patientId,aggregateType,aggregateId,latestKind});
describe("care gaps engine (EPIC AA)",()=>{
 it("vacío -> sin pendientes",()=>{expect(computeCareGaps([])).toEqual([]);});
 it("no genera pendiente para estados resueltos/terminales benignos",()=>{
  const g=computeCareGaps([A("DiagnosticResult","CLOSED"),A("ClinicalObligation","COMPLETED"),A("Consent","GRANTED"),A("Immunization","ADMINISTERED"),A("CarePlan","ACHIEVED"),A("Referral","COMPLETED"),A("Appointment","COMPLETED"),A("Claim","PAID")]);
  expect(g).toEqual([]);
 });
 it("computa un pendiente por cada regla accionable",()=>{
  const g=computeCareGaps([A("DiagnosticResult","ACTIONED"),A("ClinicalObligation","OPEN"),A("Consent","PRESENTED"),A("Immunization","DUE"),A("CarePlan","HELD"),A("Referral","REQUESTED"),A("Appointment","NO_SHOW"),A("Claim","REJECTED")]);
  expect(g).toHaveLength(8);
  expect(g.map(x=>x.code)).toContain("CRITICAL_RESULT_OPEN");
  expect(g.map(x=>x.code)).toContain("IMMUNIZATION_DUE");
 });
 it("prioriza HIGH antes que MEDIUM y LOW (orden determinista)",()=>{
  const g=computeCareGaps([A("Claim","REJECTED"),A("DiagnosticResult","ACTIONED"),A("Immunization","DUE")]);
  expect(g.map(x=>x.priority)).toEqual(["HIGH","MEDIUM","LOW"]);
  expect(g[0]!.code).toBe("CRITICAL_RESULT_OPEN");
 });
 it("una muestra rechazada es un pendiente HIGH; una resultada no genera pendiente",()=>{
  expect(computeCareGaps([A("Specimen","RESULTED")])).toEqual([]);
  const g=computeCareGaps([A("Specimen","REJECTED")]);
  expect(g).toHaveLength(1);expect(g[0]!.code).toBe("SPECIMEN_REJECTED");expect(g[0]!.priority).toBe("HIGH");
 });
 it("un incidente de seguridad abierto es HIGH; uno resuelto no genera pendiente",()=>{
  expect(computeCareGaps([A("Incident","RESOLVED")])).toEqual([]);
  for(const k of["REPORTED","REVIEW_STARTED","ESCALATED"]){
   const g=computeCareGaps([A("Incident",k)]);
   expect(g).toHaveLength(1);expect(g[0]!.code).toBe("SAFETY_INCIDENT_OPEN");expect(g[0]!.priority).toBe("HIGH");
  }
 });
});
describe("panel/population worklist (EPIC AC)",()=>{
 it("vacío -> sin pendientes",()=>{expect(computePanelWorklist([])).toEqual([]);});
 it("agrega pendientes de varios pacientes y adjunta patientId",()=>{
  const w=computePanelWorklist([PR("pat-1","Immunization","DUE"),PR("pat-2","DiagnosticResult","ACTIONED"),PR("pat-1","Claim","PAID")]);
  expect(w).toHaveLength(2);
  expect(w[0]!.patientId).toBe("pat-2"); // HIGH primero
  expect(w[0]!.code).toBe("CRITICAL_RESULT_OPEN");
  expect(w[1]!.patientId).toBe("pat-1");
 });
 it("orden determinista: prioridad, luego patientId",()=>{
  const w=computePanelWorklist([PR("pat-B","Referral","REQUESTED"),PR("pat-A","Referral","REQUESTED")]);
  expect(w.map(x=>x.patientId)).toEqual(["pat-A","pat-B"]);
 });
});
