import{describe,it,expect}from"vitest";
import{foldProblem,assertProblemTransition,assertProblemAnnotation}from"../../packages/problem-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const added={sequence:1,payload:{kind:"ADDED",patientId:"p-1",code:"J02",description:"Faringitis"}};
describe("problem fold (EPIC Q)",()=>{
 it("empty -> not exists",()=>{expect(foldProblem([]).exists).toBe(false);});
 it("added -> ACTIVE v1",()=>{const f=foldProblem([added]);expect(f.state).toBe("ACTIVE");expect(f.patientId).toBe("p-1");});
 it("resolved then reactivated",()=>{expect(foldProblem([added,{sequence:2,payload:{kind:"RESOLVED",note:"n"}}]).state).toBe("RESOLVED");expect(foldProblem([added,{sequence:2,payload:{kind:"RESOLVED",note:"n"}},{sequence:3,payload:{kind:"REACTIVATED"}}]).state).toBe("ACTIVE");});
 it("marked chronic",()=>{expect(foldProblem([added,{sequence:2,payload:{kind:"MARKED_CHRONIC"}}]).state).toBe("CHRONIC");});
});
describe("problem transition guard (EPIC Q)",()=>{
 it("allows ACTIVE->{RESOLVED,CHRONIC} and RESOLVED->ACTIVE",()=>{
  expect(()=>assertProblemTransition("ACTIVE","RESOLVED")).not.toThrow();
  expect(()=>assertProblemTransition("ACTIVE","CHRONIC")).not.toThrow();
  expect(()=>assertProblemTransition("RESOLVED","ACTIVE")).not.toThrow();
 });
 it("blocks mutating ENTERED_IN_ERROR (terminal)",()=>{const err=(()=>{try{assertProblemTransition("ENTERED_IN_ERROR","ACTIVE");}catch(e){return e;}})();expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");});
});
// Auditoría 2026-09-19 (L-04) — estado epistémico y evidencia son ANOTACIONES: no cambian el estado del problema.
describe("problem fold — eventos de anotación (auditoría L-04)",()=>{
 const epi={sequence:2,payload:{kind:"EPISTEMIC_CHANGED",epistemic:"CONFIRMED"}};
 const evi={sequence:3,payload:{kind:"EVIDENCE_UPDATED",evidenceFor:["cultivo positivo"],confidence:85}};
 it("no cambian el estado, suben la versión y quedan reflejadas en el fold",()=>{
  const f=foldProblem([added,epi,evi]);
  expect(f.state).toBe("ACTIVE");expect(f.version).toBe(3);expect(f.epistemic).toBe("CONFIRMED");expect(f.confidence).toBe(85);
 });
 it("una anotación tras MARKED_CHRONIC conserva CHRONIC (antes: el problema 'desaparecía' de los activos)",()=>{
  expect(foldProblem([added,{sequence:2,payload:{kind:"MARKED_CHRONIC"}},{...epi,sequence:3}]).state).toBe("CHRONIC");
 });
 it("un problema registrado por error no admite anotaciones; el resto sí",()=>{
  expect(()=>assertProblemAnnotation("ENTERED_IN_ERROR","EPISTEMIC_CHANGED")).toThrow(ClinicalError);
  for(const s of["ACTIVE","CHRONIC","RESOLVED"]as const)expect(()=>assertProblemAnnotation(s,"EVIDENCE_UPDATED")).not.toThrow();
 });
});
