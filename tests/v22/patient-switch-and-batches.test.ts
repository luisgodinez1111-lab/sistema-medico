import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Auditoría 2026-09-19, anexo R05a (WS1-04, WS1-11, WS1-02, WS1-01, WS1-08) — los cinco parciales que quedaban.
//
// WS1-04 es el grave: al cambiar de paciente, CINCO estados por paciente NO se limpiaban —`cpSnap` (plan de cuidado),
// `vitHist` (historial de signos vitales), `refCtx` (contexto de interconsulta), `docsSnap` (documentos) y `ciSnap`
// (Clinical Intelligence)—, así que los datos del paciente ANTERIOR seguían pintados bajo la cabecera del NUEVO hasta que
// llegara su GET; y si ese GET fallaba o devolvía 404, se quedaban ahí indefinidamente. El detector de estado prohibido
// `PATIENT_B_DATA` que el repositorio ya tenía vigilaba solo cuatro estados y no veía ninguno de estos cinco.
//
// WS1-11: el lote de órdenes de la consulta enviaba `orderId:uuid()` NUEVO en cada intento y se abortaba en la primera que
// fallara. Si fallaba la tercera de cinco, las dos primeras ya estaban en el expediente, el mensaje solo hablaba de la
// tercera, y volver a pulsar las creaba OTRA VEZ.
const MODELO="apps/web/app/workspace/model.tsx";
const UI="apps/web/app/workspace";
/** Estados que se llenan con un GET por paciente: son los que no pueden sobrevivir a un cambio de paciente. */
const POR_PACIENTE=["setSnap","setTrends","setConsTabs","setFuSnap","setCpSnap","setVitHist","setRefCtx","setDocsSnap","setCiSnap","setDocDetail","setTl","setGaps"];
const modelo=()=>fs.readFileSync(MODELO,"utf8");
/** Cuerpo exacto de `createConsultaOrders`: hasta el siguiente manejador. Una ventana de caracteres se colaba en
 *  `createResult`, que manda `orderId:uuid()` legítimamente (un resultado puede no venir de una orden registrada). */
function cuerpoDeOrdenes():string{
 const src=modelo();
 const i=src.indexOf(" const createConsultaOrders=");
 const j=src.indexOf("\n // =====",i);
 return src.slice(i,j>0?j:i+2500);
}
const seleccion=()=>/function selectPatientRaw\(id:string,name:string\)\{(.*?)\n/s.exec(modelo())![1]!;

describe("cambio de paciente: nada del anterior sobrevive (WS1-04)",()=>{
 it("TODO estado por paciente se limpia de forma síncrona al cambiar de paciente",()=>{
  const sel=seleccion();
  const sinLimpiar=POR_PACIENTE.filter(s=>!sel.includes(`${s}(null)`)&&!sel.includes(`${s}([])`));
  expect(sinLimpiar,"estado del paciente anterior que sobrevive al cambio").toEqual([]);
 });
 it("el detector de estado prohibido PATIENT_B_DATA los VE a todos",()=>{
  // Sin esto el repositorio tenía el mecanismo correcto vigilando el subconjunto equivocado: los cuatro que sí se
  // limpiaban. Los cinco que no se limpiaban eran precisamente los que no vigilaba.
  const m=/if\(dataOwner\.current&&dataOwner\.current!==patientId&&\(([^)]*)\)\)active\.push\("PATIENT_B_DATA"\)/.exec(modelo());
  expect(m,"falta el detector de datos del paciente anterior").not.toBeNull();
  const vigilados=m![1]!;
  for(const s of ["tl","gaps","snap","trends","cpSnap","vitHist","refCtx","docsSnap","ciSnap","docDetail"])
   expect(vigilados,`${s} no está vigilado`).toContain(s);
 });
 it("y la corrección del estado prohibido borra lo mismo que vigila",()=>{
  const m=/if\(rule\.includes\("PATIENT_B_DATA"\)\)\{([^}]*)\}/.exec(modelo());
  expect(m).not.toBeNull();
  for(const s of ["setCpSnap(null)","setVitHist(null)","setRefCtx(null)","setDocsSnap(null)","setCiSnap(null)","setDocDetail(null)"])
   expect(m![1]!,`la corrección no borra ${s}`).toContain(s);
 });
 it("cada efecto por paciente vacía ANTES de cargar, no solo al cambiar por el selector",()=>{
  // `patientId` también cambia por caminos que no pasan por `selectPatientRaw`; el vaciado en el propio efecto lo cubre.
  // (Fase 2) Los módulos per-paciente que eran vistas sueltas (signos/planCuidado/documentos/clinicalIntel) viven ahora en
  // el Expediente, alimentados por `snap`; su vaciado-antes-de-cargar lo hace el efecto del snapshot (setSnap(null) al
  // cambiar patientId, verificado abajo). Aquí queda la interconsulta, cuyo efecto propio sigue vaciando su contexto.
  const src=modelo();
  for(const[vista,setter]of [["interconsulta","setRefCtx"]] as const){
   const i=src.indexOf(`if(view!=="${vista}"||!ready||!session||!patientId)return;`);
   expect(i,`no se encontró el efecto de ${vista}`).toBeGreaterThan(-1);
   expect(src.slice(i,i+400),`${vista}: no vacía ${setter} antes de cargar`).toContain(`${setter}(null)`);
  }
  // El efecto del snapshot del paciente vacía `snap` (y tl/gaps/trends) ANTES de cargar, cubriendo a los módulos movidos.
  const snapEff=src.indexOf('setTl(null);setGaps(null);setSnap(null);setTrends(null);setChartState("loading");');
  expect(snapEff,"el efecto del snapshot debe vaciar snap antes de cargar").toBeGreaterThan(-1);
 });
});

describe("lotes de POST secuenciales (WS1-11)",()=>{
 it("las órdenes del lote derivan su id de una captura estable: el reintento no duplica",()=>{
  const fn=cuerpoDeOrdenes();
  expect(fn,"el id de la orden no puede ser nuevo en cada intento").not.toMatch(/orderId:uuid\(\)/);
  expect(fn,"debe derivarse de la captura").toContain("derivedClientUuid");
  expect(fn,"y la Idempotency-Key también").toMatch(/idempotencyKey:derivedClientUuid/);
  expect(fn,"el paciente entra en la llave: un lote no puede replicarse sobre otro paciente").toMatch(/\$\{patientId\}/);
 });
 it("no se aborta en la primera que falla y se dice cuáles quedaron",()=>{
  const fn=cuerpoDeOrdenes();
  expect(fn,"se intentan todas").toContain("continue;");
  expect(fn,"y el mensaje distingue creadas de no creadas").toMatch(/NO creadas/);
  expect(fn,"y promete que el reintento no duplica").toMatch(/no se duplicarán/);
 });
 it("cambiar de paciente cierra el lote en curso (igual que con los signos vitales)",()=>{
  expect(seleccion(),"un lote abierto no puede seguir vivo con otro paciente").toContain("cOrdSubmission.current=null");
 });
});

describe("lo que la pantalla no sabe (WS1-02) y lo que no puede inventar (WS1-01/WS1-08)",()=>{
 it("los contadores del menú distinguen «cero» de «no se sabe»",()=>{
  const src=modelo();
  const m=/const navCounts:Record<BadgeKey,([^>]*)>=\{([\s\S]*?)\n \};/.exec(src);
  expect(m,"no se encontraron los contadores").not.toBeNull();
  expect(m![1]!,"un contador sin dato no es un cero").toContain("null");
  expect(m![2]!,"ningún contador puede colapsar a 0 con dato desconocido").not.toMatch(/\?\?0/);
  expect(src,"y la campana tampoco").toMatch(/const notifCount:number\|null=/);
 });
 it("la insignia sin dato se ve como «—» y se ANUNCIA con palabras",()=>{
  // Un guion a secas en el nombre accesible («Agenda —») no dice nada a un lector de pantalla.
  const src=fs.readFileSync(path.join(UI,"page.tsx"),"utf8");
  expect(src).toContain('<span aria-hidden="true">—</span>');
  expect(src).toContain('<span className="mos-sr">sin dato</span>');
  expect(fs.readFileSync(path.join(UI,"shared.tsx"),"utf8"),"falta la clase de texto para lector de pantalla").toContain(".mos-sr{position:absolute");
 });
 it("la consulta no afirma «sin recordatorios» cuando no los ha podido cargar",()=>{
  // El formulario de encuentro (con el panel de recordatorios) se unificó en _encounter.tsx, montado dentro del expediente.
  const src=fs.readFileSync(path.join(UI,"views/_encounter.tsx"),"utf8");
  const i=src.indexOf("Recordatorios y obligaciones");
  const frag=src.slice(i,i+900);
  expect(frag,"debe comprobar el desconocido primero").toContain("gaps===null");
  expect(frag).toMatch(/No evaluados/);
  expect(frag.indexOf("gaps===null")).toBeLessThan(frag.indexOf("Sin recordatorios pendientes"));
 });
 it("el dashboard ya no inventa avisos ni su hora",()=>{
  // Solo líneas de CÓDIGO: el comentario de esta corrección cita los tres avisos inventados y no es el defecto.
  const src=fs.readFileSync(path.join(UI,"views/inicio.tsx"),"utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")&&!l.trimStart().startsWith("*")&&!l.trimStart().startsWith("{/*")&&!l.includes("indistinguibles")).join("\n");
  for(const inventado of ["Nuevo resultado de laboratorio","Interconsulta aceptada","Documento pendiente por firmar","Hoy 12:45 p.m."])
   expect(src.includes(inventado),`aviso inventado que sigue en el dashboard: ${inventado}`).toBe(false);
  expect(src,"los avisos salen del worklist real").toMatch(/const avisos=/);
  expect(src,"y se distingue «no cargó» de «sin avisos»").toContain("panel===null");
 });
 it("ninguna pantalla muestra una excepción cruda",()=>{
  // `String(e)` en un mensaje de UI pinta «TypeError: Failed to fetch» o un stack; `userMessage` traduce.
  const malos:string[]=[];
  const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   const p=path.join(d,e.name);
   if(e.isDirectory()){walk(p);continue;}
   if(!p.endsWith(".tsx"))continue;
   const src=fs.readFileSync(p,"utf8");
   for(const m of src.matchAll(/set\w*(?:Msg|Err|Error)\(String\((?:e|err|error)\)\)/g))malos.push(`${p} → ${m[0]}`);
  }};
  walk(UI);
  expect(malos,"excepción cruda expuesta como mensaje de UI").toEqual([]);
 });
});
