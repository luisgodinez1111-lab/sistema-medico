import{describe,it,expect}from"vitest";
import{foldSurgery,assertSurgeryTransition}from"../../packages/surgery-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const sch={sequence:1,payload:{kind:"SCHEDULED",patientId:"p1",procedure:"Colecistectomía",laterality:"NA",surgeon:"Dr. X"}};
describe("surgery fold (EPIC AK)",()=>{
 it("empty -> not exists",()=>{expect(foldSurgery([]).exists).toBe(false);});
 it("scheduled -> SCHEDULED v1 with procedure",()=>{const f=foldSurgery([sch]);expect(f.state).toBe("SCHEDULED");expect(f.procedure).toBe("Colecistectomía");expect(f.laterality).toBe("NA");});
 it("schedule -> timeout -> start -> complete",()=>{
  const evs=[sch,{sequence:2,payload:{kind:"TIMEOUT_COMPLETED"}},{sequence:3,payload:{kind:"STARTED"}},{sequence:4,payload:{kind:"COMPLETED"}}];
  expect(foldSurgery(evs.slice(0,2)).state).toBe("TIMED_OUT");
  expect(foldSurgery(evs.slice(0,3)).state).toBe("IN_PROGRESS");
  expect(foldSurgery(evs).state).toBe("COMPLETED");
 });
 it("cancel desde SCHEDULED",()=>{expect(foldSurgery([sch,{sequence:2,payload:{kind:"CANCELLED"}}]).state).toBe("CANCELLED");});
});
describe("surgery transition guard (EPIC AK)",()=>{
 it("allows SCHEDULED->TIMED_OUT->IN_PROGRESS->COMPLETED y cancelaciones",()=>{
  expect(()=>assertSurgeryTransition("SCHEDULED","TIMED_OUT")).not.toThrow();
  expect(()=>assertSurgeryTransition("TIMED_OUT","IN_PROGRESS")).not.toThrow();
  expect(()=>assertSurgeryTransition("IN_PROGRESS","COMPLETED")).not.toThrow();
  expect(()=>assertSurgeryTransition("SCHEDULED","CANCELLED")).not.toThrow();
  expect(()=>assertSurgeryTransition("TIMED_OUT","CANCELLED")).not.toThrow();
 });
 it("blocks iniciar sin time-out (barrera OMS) y mutar terminal",()=>{
  const err=(()=>{try{assertSurgeryTransition("SCHEDULED","IN_PROGRESS");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertSurgeryTransition("COMPLETED","IN_PROGRESS")).toThrow();
  expect(()=>assertSurgeryTransition("IN_PROGRESS","CANCELLED")).toThrow();
 });
});
