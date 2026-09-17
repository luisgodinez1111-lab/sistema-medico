import{describe,it,expect}from"vitest";
import{ageInMonths,forecastImmunizations,forecastSummary}from"../../packages/immunization-schedule/src";
// EPIC BK — Pronóstico de vacunación por edad (cartilla México).
describe("ageInMonths",()=>{
 it("calcula meses de calendario ajustando por día",()=>{
  expect(ageInMonths("2024-01-15","2026-01-15")).toBe(24);
  expect(ageInMonths("2024-01-15","2024-03-14")).toBe(1);   // aún no cumple el 2.º mes
  expect(ageInMonths("2024-01-15","2024-03-15")).toBe(2);
  expect(ageInMonths("2026-01-15","2024-01-15")).toBe(0);   // futuro -> 0 (no negativo)
 });
});
describe("forecastImmunizations (cartilla México)",()=>{
 const NB="2026-01-01"; // recién nacido de referencia
 it("recién nacido sin vacunas: BCG y HEPB (edad 0) DUE",()=>{
  const f=forecastImmunizations(NB,[],"2026-01-10");
  const bcg=f.find(d=>d.code==="BCG");const hepb=f.find(d=>d.code==="HEPB");
  expect(bcg?.status).toBe("DUE");expect(hepb?.status).toBe("DUE");
  // dosis de 2 meses aún UPCOMING
  expect(f.find(d=>d.code==="PENTA"&&d.doseNumber===1)?.status).toBe("UPCOMING");
 });
 it("a los 6 meses sin vacunas: dosis de 0/2/4 meses OVERDUE; la de 6m DUE; la de 18m UPCOMING",()=>{
  const f=forecastImmunizations(NB,[],"2026-07-05"); // ~6 meses
  expect(f.find(d=>d.code==="BCG")?.status).toBe("OVERDUE");
  expect(f.find(d=>d.code==="PENTA"&&d.doseNumber===1)?.status).toBe("OVERDUE"); // 2m
  expect(f.find(d=>d.code==="PENTA"&&d.doseNumber===3)?.status).toBe("DUE");      // 6m
  expect(f.find(d=>d.code==="PENTA"&&d.doseNumber===4)?.status).toBe("UPCOMING"); // 18m
 });
 it("dosis aplicadas -> COMPLETE por conteo posicional",()=>{
  const f=forecastImmunizations(NB,["BCG","PENTA","PENTA"],"2026-07-05");
  expect(f.find(d=>d.code==="BCG")?.status).toBe("COMPLETE");
  expect(f.find(d=>d.code==="PENTA"&&d.doseNumber===1)?.status).toBe("COMPLETE");
  expect(f.find(d=>d.code==="PENTA"&&d.doseNumber===2)?.status).toBe("COMPLETE");
  expect(f.find(d=>d.code==="PENTA"&&d.doseNumber===3)?.status).toBe("DUE"); // 6m, no aplicada
 });
 it("forecastSummary cuenta por estado",()=>{
  const f=forecastImmunizations(NB,[],"2026-07-05");
  const s=forecastSummary(f);
  expect(s.overdue+s.due+s.upcoming+s.complete).toBe(f.length);
  expect(s.complete).toBe(0);expect(s.overdue).toBeGreaterThan(0);
 });
 it("fecha inválida -> vacío (nunca falso positivo)",()=>{
  expect(forecastImmunizations("no-date",[],"2026-07-05")).toEqual([]);
 });
});
