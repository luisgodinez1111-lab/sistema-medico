// @vitest-environment jsdom
import{describe,it,expect,vi,afterEach}from"vitest";
import{render,screen,cleanup,act}from"@testing-library/react";
import fs from"node:fs";
import{ScreenError}from"../../apps/web/app/screen-error";
import{parseIxResult,IX_SEVERITIES,IX_SEV_LABEL}from"../../apps/web/app/workspace/shared";
// Auditoría 2026-09-19, anexos R05a/R05b (lote 15, 25-sep-2026) — PANTALLA EN BLANCO Y RESPUESTAS CASTEADAS SIN COMPROBAR.
//
// EL HALLAZGO, encontrado al ejecutar la suite completa: `vitest` reportaba «1 error» suelto junto a 1.519 tests en verde —una
// excepción no atrapada en `medicamentos.tsx:89` al leer `.CONTRAINDICATED` de un `undefined`—. Al seguirla aparecieron dos
// defectos encadenados:
//
//  1. La vista hacía `setIxRes(r.body as unknown as IxResult)`. El casteo no comprueba nada: un 200 sin `counts` —el que
//     devuelve el mock de `ui-interaction-failure`, y el que devolvería un proxy que recorta campos o un servidor de otra
//     versión— pasaba, y el render reventaba al pintar la leyenda de severidades.
//  2. El repositorio NO TENÍA NINGÚN límite de errores: ni `error.tsx`, ni `global-error.tsx`, ni `componentDidCatch`. Así
//     que esa excepción no daba un mensaje: desmontaba el árbol y dejaba una PANTALLA EN BLANCO. En una pantalla clínica es
//     la peor lectura posible, porque «vacío» se lee como «el paciente no tiene nada».
afterEach(()=>cleanup());

describe("parseIxResult: la forma de la respuesta se comprueba, no se afirma (R05b)",()=>{
 const findingOk={kind:"pair",severity:"MAJOR",severityLabel:"Mayor",a:"Sertralina",b:"Ibuprofeno",mechanism:"Riesgo de sangrado.",recommendation:"Vigilar."};
 it("LA RESPUESTA QUE REVENTABA LA PANTALLA (200 sin `counts`) se acepta y el conteo se deriva",()=>{
  // Es exactamente el cuerpo del mock que destapó el fallo: findings sin counts, sin highestSeverity y sin los resueltos.
  const v=parseIxResult({maxSeverity:"MAJOR",findings:[findingOk]});
  expect(v,"una respuesta con hallazgos válidos no debe rechazarse").not.toBeNull();
  expect(v!.counts).toEqual({CONTRAINDICATED:0,MAJOR:1,MODERATE:0,MINOR:0});
  expect(v!.highestSeverity).toBe("MAJOR");
  expect(v!.highestSeverityLabel).toBe("Mayor");
  expect(v!.unresolvedDrugs).toEqual([]); // ausente ≠ undefined: la vista hace `.length` sobre esto
  expect(v!.resolvedFactors).toEqual([]);
 });
 it("el conteo NO se copia de la respuesta: se deriva de los hallazgos",()=>{
  // Si el servidor mandara un conteo que se contradice con los hallazgos, la pantalla mostraría dos números distintos para
  // lo mismo. Un conteo es una función de los hallazgos; con dos fuentes, un día discrepan.
  const v=parseIxResult({findings:[findingOk],counts:{CONTRAINDICATED:9,MAJOR:9,MODERATE:9,MINOR:9}});
  expect(v!.counts.MAJOR).toBe(1);
  expect(v!.counts.CONTRAINDICATED).toBe(0);
 });
 it("una severidad máxima se elige por el ORDEN CLÍNICO, no por el orden de llegada",()=>{
  const v=parseIxResult({findings:[{...findingOk,severity:"MINOR"},{...findingOk,severity:"CONTRAINDICATED"},{...findingOk,severity:"MODERATE"}]});
  expect(v!.highestSeverity).toBe("CONTRAINDICATED");
  expect(v!.counts).toEqual({CONTRAINDICATED:1,MAJOR:0,MODERATE:1,MINOR:1});
 });
 it("rechaza lo que no puede pintar: sin `findings`, o con una severidad desconocida",()=>{
  expect(parseIxResult(null)).toBeNull();
  expect(parseIxResult("texto")).toBeNull();
  expect(parseIxResult({})).toBeNull();                       // 200 vacío
  expect(parseIxResult({findings:"no-es-lista"})).toBeNull();
  expect(parseIxResult({findings:[{severity:"CATASTROFICA"}]}),"una severidad que no existe no se puede ordenar ni colorear").toBeNull();
  expect(parseIxResult({findings:[null]})).toBeNull();
 });
 it("rellena las etiquetas y los textos que falten, en vez de dejar `undefined` en el DOM",()=>{
  const v=parseIxResult({findings:[{severity:"MINOR"}]});
  expect(v!.findings[0]!.severityLabel).toBe("Menor");
  expect(v!.findings[0]!.mechanism).toBe("");
  expect(v!.findings[0]!.kind).toBe("pair");
 });
 it("las severidades y sus etiquetas son una sola autoridad, compartida con la vista",()=>{
  expect([...IX_SEVERITIES]).toEqual(["CONTRAINDICATED","MAJOR","MODERATE","MINOR"]);
  expect(Object.keys(IX_SEV_LABEL).sort()).toEqual([...IX_SEVERITIES].sort());
  // Los comentarios se retiran ANTES de escanear: el comentario que explica el hallazgo cita el casteo que se retiró, y un
  // guardarraíl que se caza a sí mismo por su propia explicación es un guardarraíl que obliga a no documentar el arreglo.
  const src=fs.readFileSync("apps/web/app/workspace/views/medicamentos.tsx","utf8")
   .split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
  expect(src,"la vista no debe volver a declarar su propia tabla de severidades").not.toMatch(/SEV_L\s*:\s*Record<IxSev,string>\s*=\s*\{/);
  expect(src,"ni volver a castear la respuesta sin comprobarla").not.toMatch(/as unknown as IxResult/);
 });
});

describe("límite de errores: una pantalla que revienta lo DICE (R05a)",()=>{
 it("los tres límites existen y comparten el mismo cuerpo",()=>{
  // Sin los ficheros, Next no monta nada y la excepción vuelve a dejar la pantalla en blanco.
  for(const f of["apps/web/app/workspace/error.tsx","apps/web/app/error.tsx","apps/web/app/global-error.tsx"])
   expect(fs.existsSync(f),`falta ${f}`).toBe(true);
  // `global-error` sustituye al layout raíz, así que TIENE que traer <html> y <body>: sin ellos Next no puede renderizarlo.
  const g=fs.readFileSync("apps/web/app/global-error.tsx","utf8");
  expect(g).toMatch(/<html/);expect(g).toMatch(/<body/);
  for(const f of["apps/web/app/workspace/error.tsx","apps/web/app/error.tsx","apps/web/app/global-error.tsx"])
   expect(fs.readFileSync(f,"utf8"),`${f} debe usar el cuerpo compartido`).toMatch(/ScreenError/);
 });
 it("dice que es un fallo de la aplicación y NO que no hay datos",()=>{
  const spy=vi.spyOn(console,"error").mockImplementation(()=>{});
  render(<ScreenError error={Object.assign(new Error("x"),{digest:"d3adb33f"})} reset={()=>{}} scope="workspace"/>);
  const alerta=screen.getByRole("alert");
  expect(alerta.textContent).toMatch(/dejó de responder/i);
  expect(alerta.textContent,"tiene que negar explícitamente la lectura peligrosa «no hay datos»").toMatch(/no lo interpretes como «no hay datos»/i);
  expect(alerta.textContent,"y decir que lo guardado no se perdió").toMatch(/Nada de lo que hubieras guardado se perdió/i);
  spy.mockRestore();
 });
 it("NO muestra el texto de la excepción —puede arrastrar PHI en las props del stack—, solo el digest",()=>{
  const spy=vi.spyOn(console,"error").mockImplementation(()=>{});
  const phi=new Error("Cannot read properties of undefined leyendo paciente Ana Ruiz Domínguez 1982-04-11");
  render(<ScreenError error={Object.assign(phi,{digest:"abc123"})} reset={()=>{}} scope="workspace"/>);
  const alerta=screen.getByRole("alert");
  expect(alerta.textContent,"el mensaje de la excepción no puede aparecer en pantalla").not.toMatch(/Ana Ruiz/);
  expect(alerta.textContent,"ni el nombre técnico del error").not.toMatch(/Cannot read properties/);
  expect(alerta.textContent,"el digest sí: es un hash sin contenido").toMatch(/abc123/);
  spy.mockRestore();
 });
 it("ofrece reintentar de verdad: el botón llama a `reset`",()=>{
  const spy=vi.spyOn(console,"error").mockImplementation(()=>{});
  let veces=0;
  render(<ScreenError error={new Error("x")} reset={()=>{veces++;}} scope="workspace"/>);
  const boton=screen.getByRole("button",{name:/reintentar/i});
  act(()=>{boton.click();});
  expect(veces,"un límite de errores sin salida es una pantalla muerta con mejor texto").toBe(1);
  spy.mockRestore();
 });
 it("registra el fallo con el digest y sin el mensaje",()=>{
  const spy=vi.spyOn(console,"error").mockImplementation(()=>{});
  render(<ScreenError error={Object.assign(new Error("PHI en el mensaje"),{digest:"ref-9"})} reset={()=>{}} scope="workspace"/>);
  const linea=spy.mock.calls.map(c=>c.join(" ")).join("\n");
  expect(linea).toMatch(/\[workspace\] render interrumpido/);
  expect(linea).toMatch(/ref-9/);
  expect(linea,"el registro tampoco debe llevar el mensaje de la excepción").not.toMatch(/PHI en el mensaje/);
  spy.mockRestore();
 });
});
