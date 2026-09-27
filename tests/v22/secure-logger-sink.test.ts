import{describe,it,expect,vi,afterEach}from"vitest";
import{safeLog,setLogSink}from"../../packages/secure-logger/src";
// Lote 11, hallazgo D12c: safeLog EMITE (antes solo devolvía la línea y los eventos de seguridad no dejaban rastro).
describe("safeLog emite al sumidero (D12c)",()=>{
 afterEach(()=>{vi.restoreAllMocks();});
 it("una línea JSON redactada por evento, la misma que devuelve",()=>{
  const lines:string[]=[];const prev=setLogSink(l=>{lines.push(l);});
  try{
   const out=safeLog("session.issued",{sessionId:"s-1",email:"a@b.com"});
   expect(lines).toEqual([out]);
   expect(JSON.parse(out)).toEqual({event:"session.issued",sessionId:"s-1",email:"[REDACTED]"});
  }finally{setLogSink(prev);}
 });
 it("el sumidero por defecto escribe en la salida estándar del proceso",()=>{
  const spy=vi.spyOn(console,"info").mockImplementation(()=>{});
  safeLog("session.rate_limited",{retryAfterSeconds:30});
  expect(spy).toHaveBeenCalledWith(JSON.stringify({event:"session.rate_limited",retryAfterSeconds:30}));
 });
});
