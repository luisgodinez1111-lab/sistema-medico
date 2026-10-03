import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{apiRequest,isAbortError}from"../../apps/web/lib/session-client";
// Auditoría 2026-09-19, anexo R05a (R05a-F06 / WS1-05) — CANCELACIÓN REAL DE LAS LECTURAS EN VUELO.
//
// EL HALLAZGO se comprobó con `grep -rn "AbortController|AbortSignal"` sobre todo el repositorio: CERO resultados. El
// patrón `let cancelled=false` de los ~20 efectos evitaba PINTAR una respuesta tardía, pero la petición seguía viva.
// Cambiar de paciente cinco veces seguidas —normal en consultorio y en triage— dejaba cinco cargas completas del
// expediente compitiendo por la red y por el servidor.
//
// DOS DECISIONES QUE ESTE TEST FIJA, porque sin ellas la corrección haría daño:
//   1) LAS MUTACIONES NO SE CANCELAN. Abortar un POST corta la espera del cliente, no el comando: si el servidor ya lo
//      recibió, la receta quedó prescrita y la pantalla creería que no pasó nada. Pasar `signal` en una mutación es un
//      error de programación y se avisa.
//   2) UNA LECTURA CANCELADA NO SE REINTENTA. El abort llega como fallo de red, y el reintento automático (S-05) lo
//      habría tratado como tal: cancelar habría disparado MÁS peticiones que no cancelar.
const MODELO="apps/web/app/workspace/model.tsx";
type FakeCall=Readonly<{path:string;init:RequestInit}>;
/** fetch de laboratorio: registra lo recibido y responde lo que se le diga. */
function fakeFetch(responder:(n:number)=>unknown){
 const calls:FakeCall[]=[];
 const impl=(async(path:unknown,init:unknown)=>{
  calls.push({path:String(path),init:(init??{}) as RequestInit});
  const r=responder(calls.length);
  if(r instanceof Error)throw r;
  return{status:200,json:async()=>r} as unknown as Response;
 }) as unknown as typeof fetch;
 return{impl,calls};
}
const abortError=()=>{const e=new Error("The operation was aborted.");e.name="AbortError";return e;};
/** Cuerpos de los efectos de auto-carga: de `useEffect(()=>{` hasta la línea que cierra con `},[deps]);`. */
function efectos():string[]{
 const lineas=fs.readFileSync(MODELO,"utf8").split("\n");
 const out:string[]=[];
 for(let i=0;i<lineas.length;i++){
  if(!/^\s*useEffect\(\(\)=>\{/.test(lineas[i]!))continue;
  let j=i+1;
  while(j<lineas.length&&!/^\s*\},\[/.test(lineas[j]!))j++;
  out.push(lineas.slice(i,j+1).join("\n"));
 }
 return out;
}

describe("cancelación de peticiones en vuelo (R05a-F06)",()=>{
 it("una lectura lleva la señal hasta el fetch real",async()=>{
  const ac=new AbortController();
  const f=fakeFetch(()=>({ok:true}));
  await apiRequest("/api/v1/worklist",{method:"GET",signal:ac.signal},f.impl);
  expect(f.calls.length).toBe(1);
  expect(f.calls[0]!.init.signal,"el fetch tiene que recibir la señal, no solo el cliente").toBe(ac.signal);
 });
 it("una lectura CANCELADA no se reintenta: cancelar no puede generar más tráfico",async()=>{
  // La trampa que tenía este cliente: el abort llega por el mismo camino que un fallo de red, y el reintento automático
  // de S-05 habría hecho hasta tres peticiones por cada cancelación.
  const ac=new AbortController();ac.abort();
  const f=fakeFetch(()=>abortError());
  await expect(apiRequest("/api/v1/worklist",{method:"GET",signal:ac.signal},f.impl,{sleep:async()=>{}})).rejects.toThrow(/aborted/i);
  expect(f.calls.length,"una cancelación son cero reintentos").toBe(1);
 });
 it("un fallo de red de verdad SÍ se sigue reintentando (no se rompió S-05)",async()=>{
  const f=fakeFetch(n=>n<=1?new Error("ECONNRESET"):({ok:true}));
  const r=await apiRequest("/api/v1/worklist",{method:"GET"},f.impl,{sleep:async()=>{}});
  expect(r.status).toBe(200);
  expect(f.calls.length,"el reintento ante fallo de red sigue vivo").toBe(2);
 });
 it("una MUTACIÓN no acepta señal: abortar el POST no deshace el comando",async()=>{
  // Es la decisión que protege el expediente: una receta abortada a medio vuelo pudo quedar prescrita.
  const ac=new AbortController();
  const f=fakeFetch(()=>({version:1}));
  await expect(apiRequest("/api/v1/medications",{method:"POST",body:{a:1},signal:ac.signal},f.impl))
   .rejects.toThrow(/MUTATION_NOT_CANCELLABLE/);
  expect(f.calls.length,"ni siquiera se envía").toBe(0);
 });
 it("se distingue «lo cancelamos nosotros» de «la red falló»",()=>{
  expect(isAbortError(abortError())).toBe(true);
  expect(isAbortError(new Error("ECONNRESET"))).toBe(false);
  expect(isAbortError("AbortError")).toBe(false);
 });
 it("TODO efecto que lee datos crea su AbortController y aborta en la limpieza",()=>{
  // La invariante estructural: un efecto de auto-carga nuevo sin cancelación vuelve a acumular peticiones en vuelo.
  const conLectura=efectos().filter(e=>/apiRequest\([^)]*\{method:"GET"/.test(e));
  // (Fase 2) Bajó el número de efectos de auto-carga al retirar las vistas sueltas per-paciente (sus módulos viven en el
  // Expediente, alimentados por snap/consTabs). El invariante que importa es el de abajo: ninguno sin cancelar.
  expect(conLectura.length,"no se encontraron efectos de auto-carga: ¿cambió la forma del modelo?").toBeGreaterThanOrEqual(8);
  const sinCancelacion=conLectura.filter(e=>!/new AbortController\(\)/.test(e)||!/ac\.abort\(\)/.test(e));
  expect(sinCancelacion.map(e=>e.split("\n")[0]),"efecto que lee datos sin cancelar la petición al limpiar").toEqual([]);
 });
 it("y ninguna de esas lecturas se queda sin señal",()=>{
  const huerfanas:string[]=[];
  for(const e of efectos()){
   if(!/new AbortController\(\)/.test(e))continue;
   for(const m of e.matchAll(/apiRequest\((.{0,120}?)\{method:"GET"([^}]*)\}/g))
    if(!m[2]!.includes("signal:ac.signal"))huerfanas.push(m[1]!.slice(0,70));
  }
  expect(huerfanas,"lectura dentro de un efecto cancelable que no lleva la señal").toEqual([]);
 });
 it("el abort nunca se presenta al médico como un error de carga",()=>{
  // Cancelar es una decisión nuestra, no un fallo del sistema. Todo `catch` de estos efectos tiene que estar guardado por
  // `cancelled` antes de tocar el estado, o pintaría «no se pudo cargar» justo al cambiar de paciente.
  const malos:string[]=[];
  for(const e of efectos()){
   if(!/new AbortController\(\)/.test(e))continue;
   for(const m of e.matchAll(/\}?catch(?:\([^)]*\))?\{([^}]*)\}/g)){
    const cuerpo=m[1]!;
    // Un catch vacío (o solo comentario) no pinta nada; si toca el estado, tiene que consultar `cancelled`.
    if(/set[A-Z]\w*\(/.test(cuerpo)&&!/cancelled/.test(cuerpo))malos.push(cuerpo.slice(0,70));
   }
  }
  expect(malos,"un catch pinta estado sin comprobar si la carga fue cancelada").toEqual([]);
 });
});
