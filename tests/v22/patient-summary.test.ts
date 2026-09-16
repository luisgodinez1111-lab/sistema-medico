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
 it("cuenta problemas activos (ADDED/REACTIVATED/MARKED_CHRONIC), no los resueltos",()=>{
  const s=summarizePatient([{aggregateType:"ClinicalProblem",latestKind:"ADDED"},{aggregateType:"ClinicalProblem",latestKind:"MARKED_CHRONIC"},{aggregateType:"ClinicalProblem",latestKind:"RESOLVED"}]);
  expect(s.activeProblems).toBe(2);
 });
 it("cuenta alergias activas (RECORDED/REACTIVATED), no las refutadas/inactivas",()=>{
  const s=summarizePatient([{aggregateType:"Allergy",latestKind:"RECORDED"},{aggregateType:"Allergy",latestKind:"REFUTED"},{aggregateType:"Allergy",latestKind:"INACTIVATED"}]);
  expect(s.activeAllergies).toBe(1);
 });
 it("integra los verticales longitudinales (S–Z) en el resumen",()=>{
  const s=summarizePatient([
   {aggregateType:"Referral",latestKind:"REQUESTED"},{aggregateType:"Referral",latestKind:"COMPLETED"},
   {aggregateType:"Appointment",latestKind:"CHECKED_IN"},{aggregateType:"Appointment",latestKind:"NO_SHOW"},
   {aggregateType:"Immunization",latestKind:"DUE"},{aggregateType:"Immunization",latestKind:"ADMINISTERED"},
   {aggregateType:"CarePlan",latestKind:"ACTIVATED"},{aggregateType:"CarePlan",latestKind:"ACHIEVED"},
   {aggregateType:"Claim",latestKind:"SUBMITTED"},{aggregateType:"Claim",latestKind:"PAID"},
   {aggregateType:"Consent",latestKind:"GRANTED"},{aggregateType:"Consent",latestKind:"REVOKED"},
   {aggregateType:"Admission",latestKind:"TRANSFERRED"},{aggregateType:"Admission",latestKind:"DISCHARGED"},
  ]);
  expect(s.openReferrals).toBe(1);
  expect(s.upcomingAppointments).toBe(1);
  expect(s.pendingImmunizations).toBe(1);
  expect(s.activeCarePlans).toBe(1);
  expect(s.openClaims).toBe(1);
  expect(s.grantedConsents).toBe(1);
  expect(s.activeAdmissions).toBe(1);
 });
 it("vacío -> todo en cero",()=>{expect(summarizePatient([])).toEqual({activeAllergies:0,activeProblems:0,openObligations:0,activeMedications:0,openResults:0,openOrders:0,signedEncounters:0,openReferrals:0,upcomingAppointments:0,pendingImmunizations:0,activeCarePlans:0,openClaims:0,grantedConsents:0,activeAdmissions:0,totalItems:0});});
});
