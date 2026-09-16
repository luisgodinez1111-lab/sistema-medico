import{describe,it,expect}from"vitest";
import{foldTriage,assertTriageTransition}from"../../packages/triage-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const arr={sequence:1,payload:{kind:"ARRIVED",patientId:"p1",chiefComplaint:"Dolor torácico"}};
describe("triage fold (EPIC AH)",()=>{
 it("empty -> not exists",()=>{expect(foldTriage([]).exists).toBe(false);});
 it("arrived -> WAITING v1 with complaint",()=>{const f=foldTriage([arr]);expect(f.state).toBe("WAITING");expect(f.chiefComplaint).toBe("Dolor torácico");expect(f.acuity).toBe(0);});
 it("start -> triage(acuity) -> re-triage updates acuity -> close",()=>{
  const evs=[arr,{sequence:2,payload:{kind:"TRIAGE_STARTED"}},{sequence:3,payload:{kind:"TRIAGED",acuity:3}},{sequence:4,payload:{kind:"TRIAGED",acuity:2}},{sequence:5,payload:{kind:"CLOSED"}}];
  expect(foldTriage(evs.slice(0,2)).state).toBe("IN_TRIAGE");
  expect(foldTriage(evs.slice(0,3)).acuity).toBe(3);
  expect(foldTriage(evs.slice(0,4)).acuity).toBe(2);
  expect(foldTriage(evs).state).toBe("CLOSED");
 });
 it("left without being seen (LWBS) desde WAITING",()=>{expect(foldTriage([arr,{sequence:2,payload:{kind:"LWBS"}}]).state).toBe("LWBS");});
});
describe("triage transition guard (EPIC AH)",()=>{
 it("allows WAITING->IN_TRIAGE->TRIAGED(loop)->CLOSED y LWBS",()=>{
  expect(()=>assertTriageTransition("WAITING","IN_TRIAGE")).not.toThrow();
  expect(()=>assertTriageTransition("IN_TRIAGE","TRIAGED")).not.toThrow();
  expect(()=>assertTriageTransition("TRIAGED","TRIAGED")).not.toThrow();
  expect(()=>assertTriageTransition("TRIAGED","CLOSED")).not.toThrow();
  expect(()=>assertTriageTransition("WAITING","LWBS")).not.toThrow();
 });
 it("blocks clasificar sin iniciar y mutar terminal",()=>{
  const err=(()=>{try{assertTriageTransition("WAITING","TRIAGED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertTriageTransition("CLOSED","TRIAGED")).toThrow();
  expect(()=>assertTriageTransition("LWBS","IN_TRIAGE")).toThrow();
 });
});
