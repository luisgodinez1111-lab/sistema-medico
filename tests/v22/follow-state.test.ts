import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{followState,followStateOf,FOLLOW_STATE_KINDS}from"../../apps/web/app/workspace/shared";
// Auditoría 2026-09-19, anexo R05a (R05a-F02) — la clasificación del seguimiento tiene FUENTE y es EXHAUSTIVA.
//
// El hallazgo decía «taxonomía UI sin fuente». La fuente son los ciclos de vida: lo que ellos EMITEN es lo que la pantalla
// tiene que clasificar. Al comprobarlo aparecieron seis estados mal clasificados, porque lo que no estaba en ninguno de los
// tres conjuntos caía en «pendiente» por omisión. Dos con consecuencia clínica:
//   · REFUSED — vacuna rechazada por el paciente, mostrada como pendiente: el sistema seguía exigiéndola.
//   · ADVERSE_EVENT — vacuna que causó un evento adverso, mostrada como pendiente: el sistema seguía pidiendo administrar
//     una vacuna que ya dañó a ese paciente.
/** Ciclos de vida cuyos agregados aparecen en la lista de seguimiento (FOLLOW_TYPES de la UI). */
const CICLOS=["obligation","referral","appointment","immunization","careplan"];
/** Kinds que esos ciclos emiten de verdad, leídos del código, no de una lista paralela. */
function kindsEmitidos():string[]{
 const out=new Set<string>();
 for(const f of fs.readdirSync("apps/web/lib")){
  if(!f.endsWith("-lifecycle.ts"))continue;
  if(!CICLOS.some(c=>f.includes(c)))continue;
  const src=fs.readFileSync(`apps/web/lib/${f}`,"utf8");
  for(const m of src.matchAll(/kind:"([A-Z_]+)"/g))out.add(m[1]!);
 }
 return [...out].sort();
}

describe("clasificación del seguimiento (R05a-F02)",()=>{
 it("TODO kind que un ciclo de seguimiento emite está clasificado explícitamente",()=>{
  // Ésta es la invariante que faltaba: sin ella, un estado nuevo aparece en la UI como «pendiente» sin que nadie lo decida.
  const emitidos=kindsEmitidos();
  expect(emitidos.length,"no se encontraron kinds: ¿cambió la forma de los ciclos?").toBeGreaterThanOrEqual(15);
  const sinClasificar=emitidos.filter(k=>followStateOf(k)===undefined);
  expect(sinClasificar,"kind emitido por un ciclo de vida y sin clasificar en la UI").toEqual([]);
 });
 it("una vacuna RECHAZADA o con EVENTO ADVERSO deja de pedirse",()=>{
  // El defecto con consecuencia clínica: el sistema seguía exigiendo una vacuna que el paciente rechazó, o que le causó un
  // evento adverso. Ninguna de las dos es trabajo pendiente.
  expect(followState("REFUSED")).toBe("skip");
  expect(followState("ADVERSE_EVENT")).toBe("skip");
  for(const k of["REFUSED","ADVERSE_EVENT"])expect(followState(k),`${k} no puede ser pendiente`).not.toBe("pend");
 });
 it("lo que está en curso no se presenta como pendiente",()=>{
  // Trabajo ya iniciado presentado como pendiente es trabajo inventado: ruido que desplaza al seguimiento real.
  for(const k of["STARTED","ACTIVATED","RESUMED","ACCEPTED","CHECKED_IN","SCHEDULED"])
   expect(followState(k),`${k} está en curso`).toBe("prog");
  // Y un plan EN PAUSA tampoco es trabajo pendiente.
  expect(followState("HELD")).toBe("skip");
 });
 it("lo pendiente de verdad sigue siendo pendiente",()=>{
  for(const k of["CREATED","PROPOSED","REQUESTED","DUE"])expect(followState(k),k).toBe("pend");
 });
 it("lo hecho es hecho",()=>{
  for(const k of["COMPLETED","ACHIEVED","ADMINISTERED"])expect(followState(k),k).toBe("done");
 });
 it("normaliza como el resto del sistema y no deja a la pantalla sin respuesta",()=>{
  expect(followState(" completed ")).toBe("done");
  // Un kind desconocido cae en «pendiente» —el estado que más ruido hace y menos daño—, pero el primer test impide que un
  // estado nuevo llegue a producción sin clasificarse.
  expect(followState("KIND_QUE_NO_EXISTE")).toBe("pend");
  expect(followStateOf("KIND_QUE_NO_EXISTE")).toBeUndefined();
  expect(FOLLOW_STATE_KINDS.length).toBeGreaterThanOrEqual(20);
 });
});
