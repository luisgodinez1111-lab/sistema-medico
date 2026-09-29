import{describe,it,expect,vi,beforeEach}from"vitest";
// Porte del hallazgo D6 (revisión adversarial del lote 11) — `uploadThenCommit`: qué se hace con el binario de un intento según cómo falle el commit.
// Solo un rechazo DEFINITIVO del kernel con la ruta sin citar lo borra; un error ambiguo (la conexión cae durante el COMMIT) lo
// conserva; una carrera con un intento idéntico de la misma llave responde el replay en vez del 409.
const{readEventById}=vi.hoisted(()=>({readEventById:vi.fn()}));
vi.mock("../../apps/web/lib/clinical-runtime",()=>({readEventById,readEventPayloadById:vi.fn(),lookupReplay:vi.fn(),sessionSecret:vi.fn()}));
const{uploadThenCommit}=await import("../../apps/web/lib/http-command");
const{ClinicalError}=await import("../../packages/runtime-errors/src");
const ctx={tenantId:"00000000-0000-4000-8000-000000000001",actorId:"00000000-0000-4000-8000-000000000002",actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:"r"};
const ok=new Response("{}",{status:201});
function run(commitError:unknown,opts:{replayAfter?:Response|null;cited?:boolean}={}){
 const calls:string[]=[];let replays=0;
 readEventById.mockResolvedValue(opts.cited?{payload:{pathname:"p/1"}}:null);
 const p=uploadThenCommit(ctx,{idempotencyKey:"k",aggregateId:"00000000-0000-4000-8000-000000000003",pathname:"p/1",
  replay:async()=>{replays++;return replays>1?(opts.replayAfter??null):null;},
  upload:async()=>{calls.push("upload");},
  commit:async()=>{calls.push("commit");if(commitError)throw commitError;return ok;},
  discard:async()=>{calls.push("discard");}});
 return{p,calls};
}
beforeEach(()=>{readEventById.mockReset();});
describe("uploadThenCommit (D6)",()=>{
 it("replay primero: con respuesta previa no sube nada",async()=>{
  const calls:string[]=[];const prior=new Response("{}",{status:200});
  const r=await uploadThenCommit(ctx,{idempotencyKey:"k",aggregateId:"a",pathname:"p",replay:async()=>prior,upload:async()=>{calls.push("upload");},commit:async()=>ok,discard:async()=>{calls.push("discard");}});
  expect(r).toBe(prior);expect(calls).toEqual([]);
 });
 it("éxito: sube y confirma, sin borrar",async()=>{const{p,calls}=run(null);expect(await p).toBe(ok);expect(calls).toEqual(["upload","commit"]);});
 it("rechazo definitivo del kernel sin evento que cite la ruta: borra el binario de este intento",async()=>{
  const{p,calls}=run(new Error("CONCURRENCY_CONFLICT"));await expect(p).rejects.toThrow("CONCURRENCY_CONFLICT");expect(calls).toEqual(["upload","commit","discard"]);
 });
 it("rechazo definitivo pero un evento confirmado cita la ruta: la conserva",async()=>{
  const{p,calls}=run(new Error("CONCURRENCY_CONFLICT"),{cited:true});await expect(p).rejects.toThrow();expect(calls).toEqual(["upload","commit"]);
 });
 it("límite de tasa (ClinicalError) es definitivo: borra",async()=>{
  const{p,calls}=run(new ClinicalError("RATE_LIMITED","slow down"));await expect(p).rejects.toThrow();expect(calls).toContain("discard");
 });
 it("error AMBIGUO (conexión caída durante el COMMIT): conserva el binario aunque la lectura no vea el evento",async()=>{
  const{p,calls}=run(Object.assign(new Error("write CONNECTION_CLOSED"),{code:"CONNECTION_CLOSED"}));await expect(p).rejects.toThrow("CONNECTION_CLOSED");
  expect(calls).toEqual(["upload","commit"]);
 });
 it("almacén o base no disponibles (DEPENDENCY_UNAVAILABLE) también es ambiguo: conserva",async()=>{
  const{p,calls}=run(new ClinicalError("DEPENDENCY_UNAVAILABLE","db down"));await expect(p).rejects.toThrow();expect(calls).not.toContain("discard");
 });
 it("carrera con un intento IDÉNTICO de la misma llave: borra su binario y responde el replay del ganador",async()=>{
  const winner=new Response("{}",{status:200});
  const{p,calls}=run(new Error("IDEMPOTENCY_CONFLICT"),{replayAfter:winner});expect(await p).toBe(winner);expect(calls).toEqual(["upload","commit","discard"]);
 });
 it("misma llave con OTRO contenido (sin replay que coincida): el 409 se propaga",async()=>{
  const{p}=run(new Error("IDEMPOTENCY_CONFLICT"),{replayAfter:null});await expect(p).rejects.toThrow("IDEMPOTENCY_CONFLICT");
 });
 it("un Error plano que no es un rechazo del kernel también es ambiguo: conserva",async()=>{
  const{p,calls}=run(new Error("socket hang up"));await expect(p).rejects.toThrow();expect(calls).toEqual(["upload","commit"]);
 });
});
// La lista de rechazos DEFINITIVOS del kernel es la del mapa KERNEL de http-errors (fuente única), no una copia.
describe("isKernelRejection (D6)",()=>{
 it("reconoce exactamente los Error() planos que toHttpError remapea desde el kernel",async()=>{
  const{isKernelRejection,toHttpError}=await import("../../apps/web/lib/http-errors");
  for(const m of["CONCURRENCY_CONFLICT","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_IN_PROGRESS","AGGREGATE_TYPE_MISMATCH"]){
   expect(isKernelRejection(new Error(m))).toBe(true);expect(toHttpError(new Error(m)).status).not.toBe(500);
  }
  for(const m of["CONNECTION_CLOSED","toString","__proto__","constructor"])expect(isKernelRejection(new Error(m))).toBe(false);
  expect(isKernelRejection(new ClinicalError("CONCURRENCY_CONFLICT","x"))).toBe(false); // un ClinicalError se juzga por su código
  expect(isKernelRejection("CONCURRENCY_CONFLICT")).toBe(false);
 });
});
