import{describe,it,expect}from"vitest";
import{isUuid}from"../../packages/tenant-context/src";
import{derivedUuid,pathIds}from"../../apps/web/lib/http-command";
// Hallazgo D8 (porte): main tiene UNA definición de UUID (`isUuid`/`UUID_RE` de tenant-context), compartida por el esquema de
// payload y por `pathIds`. La regla acepta EXACTAMENTE la forma del tipo uuid que guarda la base, incluidos los ids que deriva el
// servidor (sin bits de versión RFC 9562): rechazarlos dejaría sin cerrar las obligaciones derivadas.
describe("ids de agregado (D8)",()=>{
 it("acepta los ids derivados por el servidor y los UUID de cliente",()=>{
  expect(isUuid(derivedUuid("clave-de-prueba","monitor-agg-0"))).toBe(true);
  expect(isUuid("00000000-0000-4000-8000-0000000000aa")).toBe(true);
 });
 it("rechaza lo que no tiene forma de uuid",()=>{
  for(const v of["not-a-uuid","","00000000-0000-4000-8000-0000000000a","00000000000040008000000000000aa0"])expect(isUuid(v)).toBe(false);
 });
 it("un valor que no es cadena no pasa el borde (isUuid solo tipa cadenas; pathIds comprueba el tipo antes)",async()=>{
  for(const v of[undefined,42,null])await expect(pathIds(Promise.resolve({patientId:v as unknown as string}))).rejects.toThrow(/no es un UUID válido/);
 });
 it("un id de ruta con espacios alrededor se rechaza (isUuid recorta; la columna uuid no)",async()=>{
  const id="00000000-0000-4000-8000-0000000000aa";
  await expect(pathIds(Promise.resolve({patientId:` ${id} `}))).rejects.toThrow(/no es un UUID válido/);
  await expect(pathIds(Promise.resolve({patientId:`${id}\n`}))).rejects.toThrow(/no es un UUID válido/);
  expect((await pathIds(Promise.resolve({patientId:derivedUuid("clave-de-prueba","monitor-agg-0")}))).patientId).toBeTruthy();
 });
});
