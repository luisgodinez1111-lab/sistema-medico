import{describe,it,expect}from"vitest";
import{resultEstado,RESULT_ABNORMAL_STATUSES}from"../../apps/web/lib/runtime/results-registry";
// SQL-2 (porte): la única regla del estado-UI de un resultado (vista Resultados y pestaña de la consulta).
describe("resultEstado (SQL-2)",()=>{
 const r=(x:Partial<Parameters<typeof resultEstado>[0]>)=>resultEstado({superseded:false,critical:false,status:"NORMAL",lifecycle:"CLOSED",...x});
 it("un resultado reemplazado se declara Corregido aunque fuera crítico o estuviera pendiente",()=>{
  expect(r({superseded:true,critical:true,status:"CRITICAL",lifecycle:"RECEIVED"})).toBe("Corregido");
 });
 it("vigente: hallazgos > seguimiento > revisión > normal",()=>{
  expect(r({critical:true})).toBe("Hallazgos");expect(r({status:"high"})).toBe("Hallazgos");
  expect(r({lifecycle:"ACTIONED"})).toBe("En seguimiento");expect(r({lifecycle:"RECEIVED"})).toBe("En revisión");
  expect(r({})).toBe("Normal");
 });
 it("todos los estados de RESULT_ABNORMAL_STATUSES son hallazgo (la misma lista que cuenta el tablero en SQL)",()=>{
  for(const status of RESULT_ABNORMAL_STATUSES)expect(r({status})).toBe("Hallazgos");
 });
});
