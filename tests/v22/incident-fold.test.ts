import{describe,it,expect}from"vitest";
import{foldIncident,assertIncidentTransition}from"../../packages/incident-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const rep={sequence:1,payload:{kind:"REPORTED",patientId:"p1",category:"MEDICATION_ERROR",severity:"MODERATE",description:"Dosis duplicada"}};
describe("incident fold (EPIC AG)",()=>{
 it("empty -> not exists",()=>{expect(foldIncident([]).exists).toBe(false);});
 it("reported -> REPORTED v1 with safety data",()=>{const f=foldIncident([rep]);expect(f.state).toBe("REPORTED");expect(f.category).toBe("MEDICATION_ERROR");expect(f.severity).toBe("MODERATE");});
 it("report -> review -> escalate -> resolve",()=>{
  const evs=[rep,{sequence:2,payload:{kind:"REVIEW_STARTED"}},{sequence:3,payload:{kind:"ESCALATED"}},{sequence:4,payload:{kind:"RESOLVED"}}];
  expect(foldIncident(evs.slice(0,2)).state).toBe("UNDER_REVIEW");
  expect(foldIncident(evs.slice(0,3)).state).toBe("ESCALATED");
  expect(foldIncident(evs).state).toBe("RESOLVED");
 });
 it("report -> resolve directo",()=>{expect(foldIncident([rep,{sequence:2,payload:{kind:"RESOLVED"}}]).state).toBe("RESOLVED");});
});
describe("incident transition guard (EPIC AG)",()=>{
 it("allows REPORTED->UNDER_REVIEW->{ESCALATED,RESOLVED}->RESOLVED",()=>{
  expect(()=>assertIncidentTransition("REPORTED","UNDER_REVIEW")).not.toThrow();
  expect(()=>assertIncidentTransition("REPORTED","RESOLVED")).not.toThrow();
  expect(()=>assertIncidentTransition("UNDER_REVIEW","ESCALATED")).not.toThrow();
  expect(()=>assertIncidentTransition("ESCALATED","RESOLVED")).not.toThrow();
 });
 it("blocks escalar sin revisar y mutar un incidente resuelto",()=>{
  const err=(()=>{try{assertIncidentTransition("REPORTED","ESCALATED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertIncidentTransition("RESOLVED","UNDER_REVIEW")).toThrow();
 });
});
