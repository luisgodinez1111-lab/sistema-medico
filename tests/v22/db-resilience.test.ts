import{describe,it,expect,vi}from"vitest";
import{CircuitBreaker}from"../../packages/resilience/src";
import{runWithDbResilience,type DbResilienceHooks}from"../../apps/web/lib/runtime/db-resilience";
import{ClinicalError}from"../../packages/runtime-errors/src";
// Prueba de la resiliencia de la dependencia de BD SIN una base real (es lógica pura). El invariante crítico:
// el circuit breaker cuenta SOLO fallos de conexión; un error de dominio implica que la conexión funcionó, así que
// no cuenta y resetea el breaker. Sin esto, el tráfico normal (lleno de errores de dominio legítimos) abriría el
// circuito y tumbaría el camino de escritura clínica entero.
const connErr=()=>Object.assign(new Error("connection terminated"),{conn:true});
const domainErr=()=>new ClinicalError("VALIDATION_ERROR","dato inválido");
const hooks=(over:Partial<DbResilienceHooks>={}):DbResilienceHooks=>({
 isConnectionFailure:(e)=>Boolean((e as{conn?:boolean})?.conn),
 onConnRetry:vi.fn(),onCircuitOpen:vi.fn(),
 backoffMs:[0,0],waitMs:()=>Promise.resolve(),...over,
});

describe("runWithDbResilience — reintento + circuit breaker de la dependencia de BD",()=>{
 it("devuelve el valor y no reintenta cuando la operación tiene éxito",async()=>{
  const b=new CircuitBreaker(3,1000);const h=hooks();const run=vi.fn(async()=>42);
  await expect(runWithDbResilience(b,run,h)).resolves.toBe(42);
  expect(run).toHaveBeenCalledTimes(1);expect(h.onConnRetry).not.toHaveBeenCalled();
 });

 it("un error de DOMINIO se relanza INTACTO y NO abre el breaker, aunque se repita",async()=>{
  const b=new CircuitBreaker(2,10_000);const h=hooks();
  for(let i=0;i<5;i++)await expect(runWithDbResilience(b,async()=>{throw domainErr();},h)).rejects.toMatchObject({code:"VALIDATION_ERROR"});
  expect(h.onConnRetry).not.toHaveBeenCalled();
  // El circuito sigue cerrado: una operación correcta pasa con normalidad.
  await expect(runWithDbResilience(b,async()=>"ok",h)).resolves.toBe("ok");
 });

 it("agota los reintentos de conexión y traduce a DEPENDENCY_UNAVAILABLE, con telemetría por intento",async()=>{
  const b=new CircuitBreaker(10,10_000);const h=hooks({backoffMs:[0,0]});
  await expect(runWithDbResilience(b,async()=>{throw connErr();},h)).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE"});
  expect(h.onConnRetry).toHaveBeenCalledTimes(3); // intentos 0,1,2 (dos esperas y el tercero agota)
 });

 it("tras N fallos de conexión seguidos el circuito ABRE y rechaza rápido sin ejecutar la operación",async()=>{
  const b=new CircuitBreaker(2,10_000);const h=hooks({backoffMs:[]}); // sin reintentos: un intento por llamada
  await expect(runWithDbResilience(b,async()=>{throw connErr();},h)).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE"});
  await expect(runWithDbResilience(b,async()=>{throw connErr();},h)).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE"});
  const run=vi.fn(async()=>"nunca");
  await expect(runWithDbResilience(b,run,h)).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE"});
  expect(run).not.toHaveBeenCalled();                 // circuito abierto → ni se intenta la conexión
  expect(h.onCircuitOpen).toHaveBeenCalledTimes(1);
 });

 it("un error de dominio entre fallos de conexión RESETEA el contador (no se acumulan hasta abrir)",async()=>{
  const b=new CircuitBreaker(2,10_000);const h=hooks({backoffMs:[]});
  await expect(runWithDbResilience(b,async()=>{throw connErr();},h)).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE"}); // fallo 1
  await expect(runWithDbResilience(b,async()=>{throw domainErr();},h)).rejects.toMatchObject({code:"VALIDATION_ERROR"});       // conexión OK → resetea
  await expect(runWithDbResilience(b,async()=>{throw connErr();},h)).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE"}); // fallo 1 (no 2 seguidos)
  await expect(runWithDbResilience(b,async()=>"ok",h)).resolves.toBe("ok");                                                 // nunca abrió
 });
});
