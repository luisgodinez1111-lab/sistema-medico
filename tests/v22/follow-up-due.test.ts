import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
import{dueWindowFor,dueAtFrom,decideDueAt,dueAtPayload,OBLIGATION_DUE_WINDOWS,PRIORITY_DUE_WINDOWS}from"../../packages/obligation-domain/src";
import{CRITICAL_RESULT_DUE_HOURS,resultDueWindow,ActionBody}from"../../apps/web/lib/result-lifecycle";
import{CreateBody}from"../../apps/web/lib/obligation-lifecycle";
// Auditoría 2026-09-19, anexo R05a (R05a-F04 / WS1-10) — el plazo de un seguimiento lo decide el SERVIDOR por severidad.
//
// EL HALLAZGO decía: «vencimiento fijo de 7 días, sin relación con la gravedad; un potasio crítico (acción en horas) recibe
// el mismo plazo que cualquier otro hallazgo; regla de negocio clínica fija en el cliente».
//
// LA CONTRADICCIÓN QUE APARECIÓ AL MEDIRLO. El servidor YA decidía 24 h para el mismo resultado crítico: al recibirlo abría
// una obligación URGENTE `CRITICAL_RESULT_REVIEW` con plazo de 24 h (auditoría C-20). Así que un potasio de 7.0 mEq/L
// quedaba en el expediente con DOS vencimientos distintos para el mismo hecho —24 h en la obligación, 7 días en el evento
// del resultado— y el que ganaba era el que había calculado el navegador. Y siendo una constante de cliente, cualquier
// cliente podía declarar el plazo que quisiera: el servidor guardaba la fecha sin mirarla.
//
// LO QUE ESTE TEST FIJA: (1) la pantalla no vuelve a calcular plazos clínicos; (2) el plazo del resultado crítico es UNO
// solo; (3) lo rutinario NO tiene techo, a propósito; (4) el plazo se deriva del hecho y no del reloj, para que el reintento
// del comando siga siendo idempotente.
const UI="apps/web/app/workspace";
const ISO="2026-03-03T09:00:00.000Z";
const mas=(h:number)=>new Date(Date.parse(ISO)+h*3_600_000).toISOString();
function vistas():string[]{
 const out:string[]=[];
 const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);else if(e.name.endsWith(".tsx"))out.push(p);
 }};
 walk(UI);return out.sort();
}

describe("plazo del seguimiento derivado en servidor (R05a-F04)",()=>{
 it("NINGUNA pantalla calcula ya una fecha límite clínica",()=>{
  // La invariante que faltaba. `in7days()` desapareció; lo que se busca es el PATRÓN, no el nombre: cualquier `dueAt`
  // construido en el cliente a partir de una aritmética de fechas volvería a poner la regla clínica en el navegador.
  const ofensas:string[]=[];
  for(const p of vistas()){
   // Se leen solo las líneas de CÓDIGO: los comentarios de esta corrección citan el nombre del defecto y no son el defecto.
   const src=fs.readFileSync(p,"utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
   for(const m of src.matchAll(/dueAt\s*:/g)){
    const frag=src.slice(m.index!,m.index!+90);
    // Se permite LEER un dueAt del servidor (tipos, tablas, etiquetas); lo prohibido es CALCULARLO.
    if(/Date\.now\(\)|new Date\([^)]*\+|864e5|86400000|3600000/.test(frag))ofensas.push(`${p} → ${frag.slice(0,60)}`);
   }
   if(/in7days/.test(src))ofensas.push(`${p} → in7days sigue existiendo`);
  }
  expect(ofensas,"la pantalla volvió a decidir un plazo clínico").toEqual([]);
 });
 it("el cuerpo de la API ya NO exige `dueAt`: el servidor lo deriva",()=>{
  // Si `dueAt` volviera a ser obligatorio, el cliente tendría que inventarlo otra vez.
  expect(ActionBody.safeParse({ownerId:"11111111-1111-4111-8111-111111111111",occurredAt:ISO}).success).toBe(true);
  expect(CreateBody.safeParse({obligationId:"11111111-1111-4111-8111-111111111111",patientId:"22222222-2222-4222-8222-222222222222",ownerId:"33333333-3333-4333-8333-333333333333",kind:"FOLLOWUP",occurredAt:ISO}).success).toBe(true);
 });
 it("un resultado CRÍTICO tiene UN solo plazo: el de su obligación urgente",()=>{
  // Éste es el defecto medido: 24 h en la obligación y 7 días en el evento del resultado, para el mismo potasio.
  const w=resultDueWindow(true);
  expect(w.maxHours).toBe(CRITICAL_RESULT_DUE_HOURS);
  expect(CRITICAL_RESULT_DUE_HOURS).toBe(OBLIGATION_DUE_WINDOWS["CRITICAL_RESULT_REVIEW"]!.maxHours);
  expect(dueAtFrom(ISO,w)).toBe(dueAtFrom(ISO,OBLIGATION_DUE_WINDOWS["CRITICAL_RESULT_REVIEW"]!));
  // Y pedir 7 días para un crítico —lo que hacía la pantalla— se recorta a 24 h, no se acepta.
  const d=decideDueAt(ISO,mas(24*7),w);
  expect(d.clamped).toBe(true);
  expect(d.dueAt).toBe(mas(24));
  expect(dueAtPayload(d)).toMatchObject({dueAt:mas(24),dueAtRequested:mas(24*7),dueAtClamped:true});
 });
 it("una fecha MÁS PRÓXIMA que el techo se respeta: el techo acota, no impone",()=>{
  const d=decideDueAt(ISO,mas(4),resultDueWindow(true));
  expect(d.clamped).toBe(false);
  expect(d.dueAt).toBe(mas(4));
 });
 it("lo RUTINARIO no tiene techo, y eso es deliberado",()=>{
  // «Solicitar HbA1c en 3 meses» es un seguimiento legítimo; el propio catálogo de monitoreo llega a 180 días. Un techo
  // rutinario lo convertiría en una tarea vencida el mismo día que se crea: pendientes falsos que tapan al real.
  expect(PRIORITY_DUE_WINDOWS["ROUTINE"].maxHours).toBeNull();
  const d=decideDueAt(ISO,mas(24*90),dueWindowFor("Solicitar HbA1c en 3 meses","ROUTINE"));
  expect(d.clamped).toBe(false);
  expect(d.dueAt).toBe(mas(24*90));
  // Pero sin fecha pedida, el plazo por omisión sigue siendo el que el sistema ya aplicaba: 7 días.
  expect(decideDueAt(ISO,undefined,dueWindowFor("FOLLOWUP","ROUTINE")).dueAt).toBe(mas(24*7));
 });
 it("lo declarado URGENTE sí tiene techo: 24 h",()=>{
  const d=decideDueAt(ISO,mas(24*30),dueWindowFor("FOLLOWUP","URGENT"));
  expect(d.clamped).toBe(true);
  expect(d.dueAt).toBe(mas(24));
  expect(decideDueAt(ISO,mas(24*30),dueWindowFor("FOLLOWUP","HIGH")).dueAt).toBe(mas(72));
 });
 it("el plazo se deriva del HECHO, no del reloj: el reintento del comando es idempotente",()=>{
  // El kernel exige que un reintento con la misma Idempotency-Key produzca el MISMO payload. Con `Date.now()` cada
  // reintento calcularía una fecha distinta y el comando dejaría de ser idempotente.
  const a=decideDueAt(ISO,undefined,resultDueWindow(true)).dueAt;
  const b=decideDueAt(ISO,undefined,resultDueWindow(true)).dueAt;
  expect(a).toBe(b);
  expect(a).toBe(mas(24)); // es ISO + 24 h, no ahora + 24 h
  expect(Date.parse(a)).toBeLessThan(Date.now()); // ISO es pasado: si dependiera del reloj, sería futuro
 });
 it("el tipo declarado gana sobre la prioridad pedida, porque es la decisión más específica",()=>{
  // Un cliente que declare `CRITICAL_RESULT_REVIEW` como ROUTINE no relaja el plazo del resultado crítico.
  expect(dueWindowFor("critical_result_review","ROUTINE").maxHours).toBe(24);
  // Y MONITORING_UNDEFINED conserva sus 7 días aunque su prioridad sea ALTA (cuyo techo son 72 h).
  expect(dueWindowFor("MONITORING_UNDEFINED","HIGH").defaultHours).toBe(24*7);
 });
 it("cada plazo declarado explica POR QUÉ es ese plazo",()=>{
  // Sin razón escrita, el número vuelve a ser una constante sin fuente: es el hallazgo otra vez, movido de archivo.
  for(const[k,w]of[...Object.entries(OBLIGATION_DUE_WINDOWS),...Object.entries(PRIORITY_DUE_WINDOWS)]){
   expect(w.basis.length,`${k}: sin razón declarada`).toBeGreaterThan(80);
   expect(w.defaultHours,`${k}: plazo por omisión no positivo`).toBeGreaterThan(0);
   if(w.maxHours!==null)expect(w.maxHours,`${k}: el techo no puede ser menor que el plazo por omisión`).toBeGreaterThanOrEqual(w.defaultHours);
  }
 });
 it("una fecha ilegible no aborta el seguimiento: se abre con el plazo por omisión y queda anotada",()=>{
  // Fail-closed sin perder el lazo: rechazar dejaría al paciente sin responsable ni fecha, que es peor que el plazo corto.
  const d=decideDueAt(ISO,"mañana",dueWindowFor("FOLLOWUP","ROUTINE"));
  expect(d.dueAt).toBe(mas(24*7));
  expect(d.clamped).toBe(true);
  expect(dueAtPayload(d)["dueAtRequested"]).toBe("mañana");
 });
 it("el servidor no escribe plazos a mano fuera de la declaración",()=>{
  // El plazo de la obligación de monitoreo indefinido estaba escrito dentro del ciclo de vida de la medicación (7*DAY_MS).
  // Lo que se prohíbe es el NÚMERO LITERAL: `rule.dueInDays*DAY_MS` es legítimo, porque esos días los declara cada regla de
  // monitoreo del catálogo de fármacos con su propia nota clínica —una fuente—, no el ciclo de vida.
  for(const f of["result-lifecycle.ts","obligation-lifecycle.ts","medication-lifecycle.ts"]){
   const src=fs.readFileSync(`apps/web/lib/${f}`,"utf8");
   const lineas=src.split("\n").filter(l=>/dueAt[:=]/.test(l)&&/[+*]\s*\d+\s*[*)]|\d+\s*\*\s*(DAY_MS|3600000|86400000|864e5)/.test(l)&&!l.trimStart().startsWith("//"));
   expect(lineas,`${f}: plazo calculado a mano en vez de declarado`).toEqual([]);
  }
 });
});
