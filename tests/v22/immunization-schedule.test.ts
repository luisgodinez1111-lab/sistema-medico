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
  expect(s.overdue+s.due+s.upcoming+s.complete+s.notApplicable).toBe(f.length);
  expect(s.complete).toBe(0);expect(s.overdue).toBeGreaterThan(0);
 });
 it("fecha inválida -> vacío (nunca falso positivo)",()=>{
  expect(forecastImmunizations("no-date",[],"2026-07-05")).toEqual([]);
 });
});
// Auditoría 2026-09-19 (C-10): ventanas de edad por dosis; adolescente y adulto con sus propias dosis; periódicas por fecha.
describe("pronóstico por edad (C-10)",()=>{
 const AS_OF="2026-09-19";
 it("un adulto de 40 años sin registros NO tiene '15 vacunas vencidas': solo Td, y como 'verificar antecedente', no vencida",()=>{
  const f=forecastImmunizations("1986-01-01",[],AS_OF);const s=forecastSummary(f);
  const pending=f.filter(d=>d.status==="OVERDUE"||d.status==="DUE");
  expect(pending.map(d=>d.code)).toEqual(["TD"]);expect(pending[0]!.status).toBe("DUE");expect(pending[0]!.note).toMatch(/verificar antecedente/);
  expect(s.overdue).toBe(0);expect(s.due).toBe(1);expect(s.notApplicable).toBeGreaterThan(10);
  expect(f.find(d=>d.code==="ROTA")!.status).toBe("NOT_APPLICABLE");
 });
 it("rotavirus a los 3 años: NO_APLICABLE con la razón (contraindicado pasados los 8 meses), nunca 'vencida'",()=>{
  const r=forecastImmunizations("2023-06-01",[],AS_OF).find(d=>d.code==="ROTA")!;
  expect(r.status).toBe("NOT_APPLICABLE");expect(r.note).toMatch(/8 meses/);
 });
 it("adolescente de 12 años sin VPH: VPH pendiente (antes figuraba 'completo')",()=>{
  const f=forecastImmunizations("2014-03-01",["BCG","HEPB","HEPB","HEPB","PENTA","PENTA","PENTA","PENTA","NEUMO","NEUMO","NEUMO","SRP","SRP","DPT"],AS_OF);
  expect(f.find(d=>d.code==="VPH")!.status).toBe("OVERDUE");
  expect(f.filter(d=>d.status==="OVERDUE").map(d=>d.code)).not.toContain("ROTA");
 });
 it("adulto mayor de 65: influenza anual y neumococo del adulto pendientes; la influenza se decide por FECHA de la última dosis",()=>{
  const none=forecastImmunizations("1960-01-01",[],AS_OF);
  expect(none.find(d=>d.code==="INFLUENZA"&&d.recommendedAgeMonths===720)!.status).toBe("DUE"); // sin registro: verificar, no "vencida"
  expect(none.find(d=>d.code==="NEUMO23")!.status).toBe("DUE");
  const recent=forecastImmunizations("1960-01-01",[{code:"INFLUENZA",occurredAt:"2026-01-15"}],AS_OF);
  expect(recent.find(d=>d.code==="INFLUENZA"&&d.recommendedAgeMonths===720)!.status).toBe("COMPLETE");
  const old=forecastImmunizations("1960-01-01",[{code:"INFLUENZA",occurredAt:"2024-01-15"}],AS_OF);
  expect(old.find(d=>d.code==="INFLUENZA"&&d.recommendedAgeMonths===720)!.status).toBe("OVERDUE");
 });
 it("Td: refuerzo cada 10 años; con dosis registrada sin fecha no se afirma vigencia (DUE con nota)",()=>{
  expect(forecastImmunizations("1986-01-01",[{code:"TD",occurredAt:"2020-05-01"}],AS_OF).find(d=>d.code==="TD")!.status).toBe("COMPLETE");
  expect(forecastImmunizations("1986-01-01",[{code:"TD",occurredAt:"2010-05-01"}],AS_OF).find(d=>d.code==="TD")!.status).toBe("OVERDUE");
  const nodate=forecastImmunizations("1986-01-01",["TD"],AS_OF).find(d=>d.code==="TD")!;expect(nodate.status).toBe("DUE");expect(nodate.note).toMatch(/sin fecha/);
 });
 it("la infancia sigue funcionando igual: recién nacido con BCG/HEPB DUE, y las dosis del adulto son UPCOMING",()=>{
  const f=forecastImmunizations("2026-09-01",[],AS_OF);
  expect(f.find(d=>d.code==="BCG")!.status).toBe("DUE");expect(f.find(d=>d.code==="VPH")!.status).toBe("UPCOMING");expect(f.find(d=>d.code==="NEUMO23")!.status).toBe("UPCOMING");
 });
});
