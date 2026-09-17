import{describe,it,expect}from"vitest";
import{foldDialysis,assertDialysisTransition}from"../../packages/dialysis-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const sch={sequence:1,payload:{kind:"SCHEDULED",patientId:"p1",modality:"HEMODIALYSIS",accessType:"FISTULA"}};
describe("dialysis fold (EPIC AL)",()=>{
 it("empty -> not exists",()=>{expect(foldDialysis([]).exists).toBe(false);});
 it("scheduled -> SCHEDULED v1 with modality",()=>{const f=foldDialysis([sch]);expect(f.state).toBe("SCHEDULED");expect(f.modality).toBe("HEMODIALYSIS");expect(f.accessType).toBe("FISTULA");});
 it("start -> interrupt -> resume -> complete",()=>{
  const evs=[sch,{sequence:2,payload:{kind:"STARTED"}},{sequence:3,payload:{kind:"INTERRUPTED"}},{sequence:4,payload:{kind:"RESUMED"}},{sequence:5,payload:{kind:"COMPLETED"}}];
  expect(foldDialysis(evs.slice(0,2)).state).toBe("IN_SESSION");
  expect(foldDialysis(evs.slice(0,3)).state).toBe("INTERRUPTED");
  expect(foldDialysis(evs.slice(0,4)).state).toBe("IN_SESSION");
  expect(foldDialysis(evs).state).toBe("COMPLETED");
 });
 it("no-show desde SCHEDULED",()=>{expect(foldDialysis([sch,{sequence:2,payload:{kind:"NO_SHOW"}}]).state).toBe("NO_SHOW");});
});
describe("dialysis transition guard (EPIC AL)",()=>{
 it("allows SCHEDULED->IN_SESSION->{COMPLETED,INTERRUPTED}; INTERRUPTED<->IN_SESSION",()=>{
  expect(()=>assertDialysisTransition("SCHEDULED","IN_SESSION")).not.toThrow();
  expect(()=>assertDialysisTransition("IN_SESSION","INTERRUPTED")).not.toThrow();
  expect(()=>assertDialysisTransition("INTERRUPTED","IN_SESSION")).not.toThrow();
  expect(()=>assertDialysisTransition("INTERRUPTED","COMPLETED")).not.toThrow();
  expect(()=>assertDialysisTransition("SCHEDULED","NO_SHOW")).not.toThrow();
 });
 it("blocks completar sin iniciar y mutar terminal",()=>{
  const err=(()=>{try{assertDialysisTransition("SCHEDULED","COMPLETED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertDialysisTransition("COMPLETED","IN_SESSION")).toThrow();
  expect(()=>assertDialysisTransition("NO_SHOW","IN_SESSION")).toThrow();
 });
});
