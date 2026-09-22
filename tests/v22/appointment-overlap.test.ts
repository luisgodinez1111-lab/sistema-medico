import{describe,it,expect}from"vitest";
import{findSlotConflict,DEFAULT_SLOT_MINUTES}from"../../apps/web/lib/appointment-lifecycle";
// Auditoría L-12: traslape y doble reserva, decisión pura sobre intervalos semiabiertos [startAt, endAt).
const A="2026-09-22T16:00:00.000Z",A30="2026-09-22T16:30:00.000Z",A15="2026-09-22T16:15:00.000Z",A45="2026-09-22T16:45:00.000Z";
const ex=(o:Partial<{appointmentId:string;startAt:string;endAt:string|null;consultorio:string|null;patientId:string;status:string}>)=>({appointmentId:"a1",startAt:A,endAt:A30,consultorio:null,patientId:"p1",status:"SCHEDULED",...o});
describe("traslape de citas (L-12)",()=>{
 it("mismo hueco y misma agenda -> conflicto de consultorio; intervalos contiguos no chocan",()=>{
  expect(findSlotConflict({startAt:A,endAt:A30,consultorio:null,patientId:"p2"},[ex({})])).toEqual({appointmentId:"a1",startAt:A,endAt:A30,reason:"CONSULTORIO"});
  expect(findSlotConflict({startAt:A15,endAt:A45,consultorio:null,patientId:"p2"},[ex({})])?.reason).toBe("CONSULTORIO");
  expect(findSlotConflict({startAt:A30,endAt:A45,consultorio:null,patientId:"p2"},[ex({})])).toBeNull(); // empieza cuando termina la otra
 });
 it("otro consultorio a la misma hora no choca, pero el mismo paciente sí (aunque cambie de consultorio)",()=>{
  expect(findSlotConflict({startAt:A,endAt:A30,consultorio:"C2",patientId:"p2"},[ex({consultorio:"C1"})])).toBeNull();
  expect(findSlotConflict({startAt:A,endAt:A30,consultorio:"C2",patientId:"p1"},[ex({consultorio:"C1"})])?.reason).toBe("PATIENT");
 });
 it("las citas completadas, canceladas o con inasistencia liberan el hueco; sin endAt se asume el hueco por defecto",()=>{
  for(const status of["COMPLETED","CANCELLED","NO_SHOW"])expect(findSlotConflict({startAt:A,endAt:A30,consultorio:null,patientId:"p2"},[ex({status})])).toBeNull();
  expect(findSlotConflict({startAt:A15,endAt:A45,consultorio:null,patientId:"p2"},[ex({endAt:null})])?.endAt).toBe(new Date(Date.parse(A)+DEFAULT_SLOT_MINUTES*60000).toISOString());
 });
});
