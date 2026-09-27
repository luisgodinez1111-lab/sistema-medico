import{describe,it,expect}from"vitest";
import{isAggregateId}from"../../apps/web/lib/runtime/ids";
import{derivedUuid}from"../../apps/web/lib/http-command";
// Lote 11, hallazgo D8: la regla de id de ruta acepta EXACTAMENTE la forma del tipo uuid que guarda la base, incluidos los ids
// que deriva el servidor (sin bits de versión RFC 9562): rechazarlos dejaba sin cerrar las obligaciones derivadas.
describe("ids de agregado (D8)",()=>{
 it("acepta los ids derivados por el servidor y los UUID de cliente",()=>{
  expect(isAggregateId(derivedUuid("clave-de-prueba","monitor-agg-0"))).toBe(true);
  expect(isAggregateId("00000000-0000-4000-8000-0000000000aa")).toBe(true);
 });
 it("rechaza lo que no tiene forma de uuid",()=>{
  for(const v of["not-a-uuid","","00000000-0000-4000-8000-0000000000a","00000000000040008000000000000aa0",undefined,42])expect(isAggregateId(v)).toBe(false);
 });
});
