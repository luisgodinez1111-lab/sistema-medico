import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
import{pathIds}from"../../apps/web/lib/http-command";
// Auditoría 2026-09-19, anexo R04 — el BORDE HTTP: validación del identificador de ruta (R04-007), correlación y versión
// en la respuesta (R04-F09, R04-F10).
//
// R04-007 medido el 24-sep-2026: **0 de 126 rutas con parámetro `[xxxId]` validaban su formato**. Un identificador
// malformado no es una fuga —el SQL va parametrizado y la RLS sigue puesta— pero llega al kernel y provoca un error de
// casteo de Postgres que sale como 500. Un 500 en un sistema clínico es una pantalla en blanco a media consulta, y además
// esconde el problema: el cliente no sabe que mandó basura.
//
// R04-F09: el `requestId` existía en los logs y en el recibo de auditoría, pero el cliente no lo recibía. Cuando un
// médico dice «no me dejó firmar», sin ese identificador no hay forma de atar su pantalla a la traza del servidor.
const RAIZ="apps/web/app/api";
function rutasConParametro():string[]{
 const out:string[]=[];
 const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);
  else if(e.name==="route.ts"&&fs.readFileSync(p,"utf8").includes("ctx.params"))out.push(p);
 }};
 walk(RAIZ);return out.sort();
}

describe("borde HTTP: identificador de ruta validado (R04-007)",()=>{
 it("pathIds acepta un UUID y rechaza lo que no lo es, nombrando el parámetro",async()=>{
  const ok=await pathIds(Promise.resolve({patientId:"11111111-1111-1111-1111-111111111111"}));
  expect(ok.patientId).toBe("11111111-1111-1111-1111-111111111111");
  for(const malo of ["no-un-uuid","../../etc/passwd","1 OR 1=1","11111111111111111111111111111111",""]){
   await expect(pathIds(Promise.resolve({patientId:malo}))).rejects.toThrow(/no es un UUID válido/);
  }
 });
 it("solo valida los parámetros que son identificadores, no cualquier segmento",async()=>{
  // Una ruta con `[date]` o `[slug]` no debe romperse: el validador mira los que acaban en `Id`.
  const r=await pathIds(Promise.resolve({date:"2026-09-24",slug:"resumen-mensual"}));
  expect(r.date).toBe("2026-09-24");
 });
 it("TODA ruta con parámetro de ruta lo valida antes de tocar el kernel",()=>{
  const sinValidar=rutasConParametro().filter(p=>{
   const src=fs.readFileSync(p,"utf8");
   // El patrón del repo es `const{xId}=await pathIds(ctx.params)`. Si alguien vuelve a leer params en crudo, aquí se ve.
   return /=\s*await\s+ctx\.params/.test(src);
  }).map(p=>p.slice(RAIZ.length+1));
  expect(sinValidar,"ruta que lee ctx.params sin validar el formato del identificador").toEqual([]);
 });
 it("hay rutas que revisar (si esto cae, el test dejó de cubrir algo)",()=>{
  expect(rutasConParametro().length).toBeGreaterThanOrEqual(120);
 });
});

describe("borde HTTP: correlación y versión en la respuesta (R04-F09, R04-F10)",()=>{
 const mw=()=>fs.readFileSync("apps/web/middleware.ts","utf8");
 it("el middleware devuelve X-Request-Id y la versión de API en las respuestas de la API",()=>{
  const src=mw();
  expect(src).toContain('res.headers.set("X-Request-Id"');
  expect(src).toContain('res.headers.set("X-Medos-Api-Version"');
 });
 it("respeta el X-Request-Id del cliente y solo genera uno si no viene",()=>{
  // Es lo que permite correlacionar una cadena de llamadas, no solo una.
  expect(mw()).toMatch(/req\.headers\.get\("x-request-id"\)\?\?crypto\.randomUUID\(\)/);
 });
 it("el identificador que devuelve es EL MISMO que ve el handler",()=>{
  // Si el middleware generara uno y el handler otro, el cliente tendría un número que no aparece en ningún log.
  const src=mw();
  expect(src,"el middleware debe propagar el identificador a la petición").toMatch(/headers\.set\("x-request-id",requestId\)/);
  const hc=fs.readFileSync("apps/web/lib/http-command.ts","utf8");
  expect(hc,"el handler lo lee de la misma cabecera").toMatch(/req\.headers\.get\("x-request-id"\)/);
 });
 it("también las respuestas de error del borde llevan la correlación",()=>{
  // Un 404 de vertical apagada o un 429 de límite de tasa son justo los que más se reportan: sin correlación no se
  // pueden investigar.
  const src=mw();
  // La rama de API tiene exactamente TRES salidas: el 404 de vertical apagada, el 429 del límite de tasa y el paso al
  // handler. Las tres llevan correlación; si se añade una cuarta sin ella, este número deja de coincidir.
  expect((src.match(/conCorrelacion\(/g)??[]).length,"una salida del borde sin correlación").toBe(3);
 });
});

// Auditoría 2026-09-19, anexo R04 — higiene del borde: un solo ayudante (R04-002), formato de los identificadores
// fiscales y profesionales (R04-F02) y umbrales declarados (R04-F05).
describe("higiene del borde HTTP (R04-002, R04-F02, R04-F05)",()=>{
 it("ninguna ruta define su propia copia de principalFrom (R04-002)",()=>{
  // Dos familias de ayudantes es como empiezan a divergir: el día que una añada un campo al principal, la otra seguirá
  // autorizando con el viejo y nadie lo notará, porque las dos compilan.
  const copias:string[]=[];
  const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   const p=path.join(d,e.name);
   if(e.isDirectory())walk(p);
   else if(e.name==="route.ts"&&/function\s+principalFrom\s*\(/.test(fs.readFileSync(p,"utf8")))copias.push(p);
  }};
  walk("apps/web/app/api");
  expect(copias,"ruta con su propia copia de principalFrom: use la de lib/http-command").toEqual([]);
 });
 it("el RFC del consultorio valida su FORMA, no solo la longitud (R04-F02)",async()=>{
  const{isValidRfc,normalizeRfc}=await import("../../packages/mx-identity/src");
  // Forma canónica: 3 letras (moral) o 4 (física), 6 dígitos de fecha, 3 de homoclave.
  for(const bueno of ["GODL800101ABC","ABC800101XY1","godl800101abc"])expect(isValidRfc(bueno),bueno).toBe(true);
  for(const malo of ["","XX","GODL8001","GODL800101ABCD","1234800101ABC","GODL-8001-01"])expect(isValidRfc(malo),malo).toBe(false);
  expect(normalizeRfc(" godl800101abc "),"se normaliza como se registra").toBe("GODL800101ABC");
  // Y NO se valida el dígito verificador: rechazar un RFC legítimo bloquearía la configuración del consultorio.
  const src=fs.readFileSync("packages/mx-identity/src/index.ts","utf8");
  expect(src).toMatch(/NO se valida el d[ií]gito verificador/);
 });
 it("la cédula del consultorio usa la MISMA definición que exige la receta legal (R04-F02)",async()=>{
  // Si el sistema aceptara aquí una cédula que la receta rechaza, el consultorio quedaría configurado con un dato que no
  // sirve para prescribir y el médico lo descubriría al firmar.
  const{isValidCedula}=await import("../../packages/prescription-print/src");
  const src=fs.readFileSync("apps/web/lib/office-settings-lifecycle.ts","utf8");
  expect(src,"la validación debe reutilizar isValidCedula, no una segunda regla").toContain("isValidCedula");
  expect(isValidCedula("1234567")).toBe(true);
  expect(isValidCedula("12345")).toBe(false);
 });
 it("el umbral de «Próxima» está declarado como operativo, no como norma (R04-F05)",()=>{
  // El hallazgo era un número suelto. La respuesta honesta no es inventarle una NOM: es decir que NINGUNA la fija.
  const src=fs.readFileSync("apps/web/app/api/v1/regulatory-obligations/route.ts","utf8");
  expect(src).toMatch(/const PROXIMA_DIAS=\d+;/);
  expect(src,"debe decir que el umbral NO es normativo").toMatch(/no normativo|ninguna NOM fija/i);
  expect(src,"y viajar en la respuesta para que quien lea el tablero sepa de dónde sale").toContain("proximaThreshold");
 });
});
