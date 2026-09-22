import{describe,it,expect}from"vitest";
import{monthOf,periodOf}from"../../apps/web/lib/clinic-time";
// Auditoría L-09: "ingresos del mes" se calcula por mes calendario en la zona horaria del consultorio.
describe("periodo de facturación (L-09)",()=>{
 it("un pago a las 23:30 del 30 de septiembre en CDMX es de septiembre, aunque en UTC ya sea 1 de octubre",()=>{
  expect(monthOf("2026-10-01T05:30:00.000Z")).toBe("2026-09"); // 23:30 del 30-sep en America/Mexico_City (UTC-6)
  expect(monthOf("2026-10-01T06:30:00.000Z")).toBe("2026-10");
  expect(monthOf("no-es-fecha")).toBe("");
 });
 it("periodOf acepta solo YYYY-MM válido y si no usa el mes en curso",()=>{
  expect(periodOf("2026-08",new Date("2026-09-22T12:00:00Z"))).toBe("2026-08");
  expect(periodOf("2026-13",new Date("2026-09-22T12:00:00Z"))).toBe("2026-09");
  expect(periodOf(null,new Date("2026-09-22T12:00:00Z"))).toBe("2026-09");
 });
});
import{dayWindow,dayOf}from"../../apps/web/lib/clinic-time";
// Auditoría L-12: la agenda del día es el día CIVIL del consultorio, no el día UTC.
describe("día civil del consultorio (L-12)",()=>{
 it("la ventana del 22-sep-2026 en CDMX va de 06:00Z a 06:00Z del día siguiente (UTC-6, sin horario de verano)",()=>{
  expect(dayWindow("2026-09-22")).toEqual({fromIso:"2026-09-22T06:00:00.000Z",toIso:"2026-09-23T06:00:00.000Z"});
  expect(dayOf("2026-09-23T03:00:00.000Z")).toBe("2026-09-22"); // 21:00 del día 22 en CDMX
  expect(dayOf("2026-09-23T06:00:00.000Z")).toBe("2026-09-23");
  expect(()=>dayWindow("22/09/2026")).toThrow(RangeError);
 });
});
