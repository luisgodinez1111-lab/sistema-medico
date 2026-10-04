import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
import{mensajeDeError}from"../../apps/web/lib/idp-errors";
import{unidadesDe}from"../../apps/web/app/workspace/shared";
import{canonicalVitalUnit}from"../../packages/lab-reference/src";
// Auditoría 2026-09-19, anexo R05c (R05c-19, R05c-17, R05c-27, R05c-32, R05c-02) — captura estructurada y puerta de entrada.
//
// R05c-27 es el de seguridad: el `error_description` del proveedor de identidad se pintaba TAL CUAL en la pantalla de login,
// con el estilo de la propia aplicación. React escapa el HTML, así que no había XSS, pero sí suplantación de mensaje: un
// enlace a `/login?error=x&error_description=Su sesión expiró, llame al 55-…` mostraba ese texto como si fuera del sistema,
// justo en la pantalla donde el usuario va a escribir sus credenciales.
const UI="apps/web/app/workspace";
const vista=(f:string)=>fs.readFileSync(path.join(UI,"views",f),"utf8");

describe("el mensaje de error del login no lo escribe quien manda el enlace (R05c-27)",()=>{
 it("el texto libre de la URL NUNCA llega a la pantalla",()=>{
  const src=fs.readFileSync("apps/web/app/login/page.tsx","utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
  expect(src.includes('params.get("error_description")'),"el texto del tercero volvió a la pantalla").toBe(false);
  expect(src,"el mensaje se deriva del código, que sí es un conjunto conocido").toContain("mensajeDeError(urlErr)");
 });
 it("cada código conocido tiene su mensaje propio, en español",()=>{
  for(const c of ["access_denied","unauthorized","login_required","server_error","temporarily_unavailable"]){
   const m=mensajeDeError(c);
   expect(m.length,`${c}: sin mensaje`).toBeGreaterThan(20);
   expect(m,`${c}: no debe filtrar el código crudo como único contenido`).not.toBe(c);
  }
 });
 it("un código desconocido da un mensaje genérico y saneado, sin repetir lo que venga en la URL",()=>{
  const inyeccion="x'\"><b>Llame al 55-1234-5678</b>";
  const m=mensajeDeError(inyeccion);
  expect(m,"nada del texto recibido puede aparecer").not.toMatch(/55-1234|<b>|Llame/);
  expect(m).toMatch(/administrador del consultorio/);
  // El código se muestra saneado a letras y guiones bajos, y acotado.
  expect(mensajeDeError("ACCESS_DENIED"),"normaliza mayúsculas").toBe(mensajeDeError("access_denied"));
  expect(mensajeDeError("a".repeat(200)).length).toBeLessThan(200);
 });
});

describe("captura estructurada de signos vitales (R05c-19)",()=>{
 it("la unidad sale del catálogo, no de un campo de texto libre",()=>{
  const src=vista("exp.tsx");
  expect(src.includes('value={vitUnit} onChange={e=>setVitUnit(e.target.value)} placeholder="Unidad"'),"la unidad volvió a ser texto libre").toBe(false);
  expect(src,"debe ofrecer solo las unidades del tipo").toContain("unidadesDe(vitType)");
  // Al cambiar de tipo, la unidad salta a la PREFERIDA del catálogo según el sistema de unidades del consultorio
  // (canónica en Métrico; lb/in/°F en Imperial) — nunca texto libre. La elige `defaultUnitFor`, que solo devuelve claves
  // aceptadas por el servidor (ver tests/v22/workspace-units-default.test.ts).
  expect(src,"y al cambiar de tipo, la unidad salta a la preferida del catálogo").toMatch(/setVitUnit\(defaultUnitFor\(e\.target\.value,cfgSettings\.prefUnits\)\)/);
 });
 it("cada tipo ofrece su unidad canónica primero, y ninguna unidad de otro tipo",()=>{
  // El defecto: nada impedía «Peso: 120/80 mmHg», y ese dato alimenta las tendencias, el IMC y el gate de vital crítico.
  for(const t of ["BP","HR","RESP","SPO2","WEIGHT","HEIGHT","TEMP"]){
   const us=unidadesDe(t);
   expect(us.length,`${t}: sin unidades`).toBeGreaterThan(0);
   expect(us[0],`${t}: la primera debe ser la canónica`).toBe(canonicalVitalUnit(t));
  }
  expect(unidadesDe("WEIGHT")).not.toContain("mmHg");
  expect(unidadesDe("BP")).not.toContain("kg");
  expect(unidadesDe("TIPO_QUE_NO_EXISTE")).toEqual([]);
 });
});

describe("catálogo real y rutas muertas (R05c-17, R05c-32, R05c-02)",()=>{
 it("las sugerencias CIE-10 del expediente salen del catálogo, no de diez códigos a mano",()=>{
  // El subtítulo prometía «validados contra el catálogo» y la lista eran diez opciones escritas en el JSX.
  const src=vista("exp.tsx");
  const i=src.indexOf('<datalist id="icd10-list">');
  expect(i,"no se encontró la lista de sugerencias").toBeGreaterThan(-1);
  const bloque=src.slice(i,src.indexOf("</datalist>",i));
  expect(bloque,"debe consultar el catálogo").toContain("searchIcd10");
  expect(bloque.includes('<option value="E11">'),"volvieron los códigos escritos a mano").toBe(false);
 });
 it("la ruta stub en inglés y sin guardia ya no existe",()=>{
  // Server Component que solo hacía eco del id de la URL con un texto en inglés, sin verificación de sesión.
  expect(fs.existsSync("apps/web/app/patients"),"la ruta muerta volvió").toBe(false);
 });
 it("Facturación no afirma «IVA 0%» mientras Configuración ofrece otra tasa",()=>{
  const src=vista("facturacion.tsx");
  expect(src,"la tasa configurada tiene que aparecer").toContain("cfgSettings.regTaxRate");
  expect(src,"y decir que no se aplica, en vez de esconder la discrepancia").toMatch(/no aplicado/);
  // El módulo sigue declarando que no emite CFDI: eso era correcto y no se toca.
  expect(src).toMatch(/NO emite CFDI/);
 });
});
