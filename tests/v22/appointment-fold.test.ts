import{describe,it,expect}from"vitest";
import{foldAppointment,assertAppointmentTransition}from"../../packages/appointment-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const sch={sequence:1,payload:{kind:"SCHEDULED",patientId:"p1",startAt:"2026-09-20T15:00:00.000Z",reason:"Control anual"}};
describe("appointment fold (EPIC U)",()=>{
 it("empty -> not exists",()=>{expect(foldAppointment([]).exists).toBe(false);});
 it("scheduled -> SCHEDULED v1 with slot data",()=>{const f=foldAppointment([sch]);expect(f.state).toBe("SCHEDULED");expect(f.startAt).toBe("2026-09-20T15:00:00.000Z");expect(f.reason).toBe("Control anual");});
 it("check-in then complete",()=>{expect(foldAppointment([sch,{sequence:2,payload:{kind:"CHECKED_IN"}}]).state).toBe("CHECKED_IN");expect(foldAppointment([sch,{sequence:2,payload:{kind:"CHECKED_IN"}},{sequence:3,payload:{kind:"COMPLETED"}}]).state).toBe("COMPLETED");});
 it("no-show from scheduled",()=>{expect(foldAppointment([sch,{sequence:2,payload:{kind:"NO_SHOW"}}]).state).toBe("NO_SHOW");});
});
describe("appointment transition guard (EPIC U)",()=>{
 it("allows SCHEDULED->{CHECKED_IN,CANCELLED,NO_SHOW} and CHECKED_IN->{COMPLETED,CANCELLED}",()=>{
  expect(()=>assertAppointmentTransition("SCHEDULED","CHECKED_IN")).not.toThrow();
  expect(()=>assertAppointmentTransition("SCHEDULED","CANCELLED")).not.toThrow();
  expect(()=>assertAppointmentTransition("SCHEDULED","NO_SHOW")).not.toThrow();
  expect(()=>assertAppointmentTransition("CHECKED_IN","COMPLETED")).not.toThrow();
  expect(()=>assertAppointmentTransition("CHECKED_IN","CANCELLED")).not.toThrow();
 });
 it("blocks completing without check-in and mutating terminal",()=>{
  const err=(()=>{try{assertAppointmentTransition("SCHEDULED","COMPLETED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertAppointmentTransition("NO_SHOW","CHECKED_IN")).toThrow();
  expect(()=>assertAppointmentTransition("COMPLETED","CANCELLED")).toThrow();
 });
});
