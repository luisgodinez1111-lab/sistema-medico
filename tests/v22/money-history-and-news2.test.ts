import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{parseMoney,DraftBody}from"../../apps/web/lib/claim-lifecycle";
import{foldHistory,assertHistoryTransition,type StoredHistoryEvent}from"../../packages/adaptive-history/src";
import{computeNEWS2,news2ScoredCount,NEWS2_MIN_SCORED_PARAMS}from"../../packages/lab-reference/src";
import{assembleFindings}from"../../packages/clinical-summary/src";
// Auditoría 2026-09-19, anexo R02b (R2B-021, R2B-026, R2B-009) — EL SIGNO DEL DINERO, UN CICLO DE VIDA QUE NUNCA PODÍA
// COMPLETARSE Y UN SCORE SOSTENIDO POR DOS MEDICIONES.

describe("R2B-021: el importe de una factura",()=>{
 it("EL SIGNO SE CONSERVA: una nota de crédito no puede convertirse en un cargo",()=>{
  // El parseo era `replace(/[^0-9.]/g,"")`, que borra el menos: «-500.00» se leía como 500 positivos e inflaba los ingresos.
  expect(parseMoney("-500.00")).toBe(-500);
  expect(parseMoney("500.00")).toBe(500);
  expect(parseMoney("-0.01")).toBe(-0.01);
 });
 it("tolera espacios y separadores de miles, sin perder el signo",()=>{
  expect(parseMoney(" -1,250.50 ")).toBe(-1250.5);
  expect(parseMoney("1,000")).toBe(1000);
 });
 it("un importe que no tiene forma de número se lee como 0, nunca como NaN",()=>{
  // Los eventos ya escritos no se pueden reescribir (log append-only): lo que no se puede leer vale 0 y se cuenta aparte.
  expect(parseMoney("asdf")).toBe(0);
  expect(parseMoney("")).toBe(0);
  expect(parseMoney("1.2.3")).toBe(0);
 });
 it("y la PUERTA lo rechaza al emitir, en vez de descubrirlo al sumar",()=>{
  const base={claimId:"11111111-1111-4111-8111-111111111111",patientId:"22222222-2222-4222-8222-222222222222",
   currency:"MXN" as const,occurredAt:"2026-09-25T10:00:00.000Z"};
  expect(DraftBody.safeParse({...base,amount:"asdf"}).success,"«asdf» entraba al registro y luego valía 0").toBe(false);
  expect(DraftBody.safeParse({...base,amount:"1.234"}).success,"tres decimales no es un importe monetario").toBe(false);
  expect(DraftBody.safeParse({...base,amount:"1500.00"}).success).toBe(true);
  expect(DraftBody.safeParse({...base,amount:"-500.00"}).success,"una nota de crédito es legítima").toBe(true);
 });
 it("la suma en la base se protege de los importes ya escritos que no son números",()=>{
  // Sin esto, el `::numeric` lanzaba y el tablero de facturación entero devolvía 500: una fila mala tumbaba seis indicadores.
  const src=fs.readFileSync("apps/web/lib/runtime/analytics.ts","utf8");
  expect(src,"el casteo debe estar guardado por un patrón numérico").toMatch(/payload->>'amount' ~ '\^-\?\[0-9\]/);
  expect(src,"y los ilegibles se cuentan, no se ignoran").toMatch(/malformed_amounts/);
 });
 it("hay UNA sola autoridad para parsear dinero",()=>{
  const ruta=fs.readFileSync("apps/web/app/api/v1/claims/route.ts","utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
  expect(ruta,"la ruta no puede tener su propio parseo: así nació el defecto del signo").not.toMatch(/parseFloat/);
  expect(ruta).toMatch(/const num=parseMoney/);
 });
});

const ev=(sequence:number,payload:Record<string,unknown>):StoredHistoryEvent=>({sequence,payload});
const CC=ev(1,{kind:"CHIEF_COMPLAINT",patientId:"p",encounterId:"e",chiefComplaint:"Dolor torácico"});

describe("R2B-026: la historia adaptativa nunca podía completarse",()=>{
 it("el fold expone el ÚLTIMO tipo de evento, que es el origen real de la transición",()=>{
  expect(foldHistory([]).lastEventKind).toBeNull();
  expect(foldHistory([CC]).lastEventKind).toBe("CHIEF_COMPLAINT");
  expect(foldHistory([CC,ev(2,{kind:"HPI_FINDING",findingId:"f1",section:"HPI",question:"¿Irradia?",state:"POSITIVE"})]).lastEventKind).toBe("HPI_FINDING");
  expect(foldHistory([CC,ev(2,{kind:"HPI_FINDING",findingId:"f1",section:"HPI",question:"q",state:"POSITIVE"}),
   ev(3,{kind:"HPI_COMPLETED"})]).lastEventKind).toBe("HPI_COMPLETED");
 });
 it("EL BUG: con el origen igual al destino, completar HPI y ROS era imposible",()=>{
  // Reproducción exacta de lo que hacía el código antes (`assertHistoryTransition(to,to)`), para que quede constancia de
  // por qué fallaba el 100 % de las veces: la tabla no tiene auto-transición para los dos «completar».
  expect(()=>assertHistoryTransition("HPI_COMPLETED","HPI_COMPLETED")).toThrow(/Illegal history transition/);
  expect(()=>assertHistoryTransition("ROS_COMPLETED","ROS_COMPLETED")).toThrow(/Illegal history transition/);
  // Y por qué los hallazgos repetidos SÍ funcionaban, que es lo que ocultaba el defecto: esos tres tienen auto-transición.
  expect(()=>assertHistoryTransition("HPI_FINDING","HPI_FINDING")).not.toThrow();
  expect(()=>assertHistoryTransition("ROS_FINDING","ROS_FINDING")).not.toThrow();
  expect(()=>assertHistoryTransition("PHYSICAL_FINDING","PHYSICAL_FINDING")).not.toThrow();
 });
 it("con el origen REAL, la secuencia clínica completa es legal",()=>{
  const camino:readonly[Parameters<typeof assertHistoryTransition>[0],Parameters<typeof assertHistoryTransition>[1]][]=[
   ["CHIEF_COMPLAINT","HPI_FINDING"],["HPI_FINDING","HPI_FINDING"],["HPI_FINDING","HPI_COMPLETED"],
   ["HPI_COMPLETED","ROS_FINDING"],["ROS_FINDING","ROS_COMPLETED"],["ROS_COMPLETED","PHYSICAL_FINDING"]];
  for(const[from,to]of camino)expect(()=>assertHistoryTransition(from,to),`${from} -> ${to}`).not.toThrow();
 });
 it("y las transiciones que de verdad no tienen sentido siguen bloqueadas",()=>{
  expect(()=>assertHistoryTransition("ROS_COMPLETED","HPI_FINDING")).toThrow(); // no se vuelve al HPI tras cerrar el ROS
  expect(()=>assertHistoryTransition("PHYSICAL_FINDING","HPI_FINDING")).toThrow();
 });
 it("el ciclo de vida usa el origen del fold, no el destino",()=>{
  const src=fs.readFileSync("apps/web/lib/adaptive-history-lifecycle.ts","utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
  expect(src,"el sustituto `folded.chiefComplaint?to:...` era el bug").not.toMatch(/folded\.chiefComplaint\?to:/);
  expect(src).toMatch(/assertHistoryTransition\(folded\.lastEventKind\?\?"CHIEF_COMPLAINT",to\)/);
 });
});

describe("R2B-009: un NEWS2 sostenido por dos mediciones no es un NEWS2",()=>{
 it("el motor dice cuántos parámetros pudo puntuar",()=>{
  const uno=computeNEWS2({hr:72});
  expect(news2ScoredCount(uno)).toBe(1);
  expect(uno.complete).toBe(false);
  expect(uno.scoreIsLowerBound).toBe(true);
  const cuatro=computeNEWS2({hr:125,resp:26,spo2:91,sbp:95});
  expect(news2ScoredCount(cuatro)).toBe(4);
 });
 it("el oxígeno suplementario ausente se REPORTA, no se asume aire ambiente",()=>{
  // Era el primer mecanismo de falso negativo del hallazgo: asumir 0 puntos por un dato desconocido puede bajar la banda
  // de MEDIUM a LOW y suprimir la alerta de deterioro.
  expect(computeNEWS2({hr:72}).missing).toContain("supplementalO2");
  expect(computeNEWS2({hr:72,supplementalO2:true}).params["supplementalO2"]).toBe(2);
 });
 it("el umbral mínimo existe y es el que aplica el consumidor",()=>{
  expect(NEWS2_MIN_SCORED_PARAMS).toBe(4);
  const src=fs.readFileSync("apps/web/lib/clinical-intelligence-summary.ts","utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
  expect(src,"el filtro `missing.length<7` dejaba pasar un score de un solo parámetro").not.toMatch(/missing\.length<7/);
  expect(src).toMatch(/medidos>=NEWS2_MIN_SCORED_PARAMS/);
 });
 it("EL TEXTO QUE VE EL MÉDICO dice con cuántos parámetros se calculó",()=>{
  // Antes el único indicio de un score parcial era un «+» pegado al número, que en una lista de hallazgos no se lee.
  const f=assembleFindings({news2:{score:10,band:"HIGH",missing:["consciousness","temp","supplementalO2"],scored:4}});
  const s=f.find(x=>x.domain==="deterioro")!.summary;
  expect(s).toMatch(/NEWS2 10\+/);
  expect(s).toMatch(/\[4 de 7 parámetros\]/);
 });
 it("por debajo del mínimo NO se presenta un score: se dice que no es calculable",()=>{
  const f=assembleFindings({news2:{score:1,band:"INSUFFICIENT",missing:["resp","spo2","temp","sbp","consciousness","supplementalO2"],scored:1}});
  const d=f.find(x=>x.domain==="deterioro")!;
  expect(d.summary).toMatch(/no calculable/);
  expect(d.summary).toMatch(/1 de 7/);
  expect(d.severity,"no es una alarma clínica: es una advertencia sobre el dato").toBe("INFO");
 });
 it("un score completo no arrastra el caveat",()=>{
  const f=assembleFindings({news2:{score:8,band:"HIGH",missing:[],scored:7}});
  const s=f.find(x=>x.domain==="deterioro")!.summary;
  expect(s).toBe("NEWS2 8 (alto): riesgo de deterioro — escalar");
 });
});
