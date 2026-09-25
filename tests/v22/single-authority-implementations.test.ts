import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Auditoría 2026-09-19, anexo R08 (R08-01, R08-07, R08-10) — UNA implementación por regla, y cableada.
//
// EL HALLAZGO: había ocho implementaciones paralelas de «solo el médico puede prescribir/firmar» y **ninguna de las siete
// inertes era la que de verdad corría**. Tres vivían en paquetes propios (`encounter-service`, `medication-ordering`,
// `medication-runtime`) que ninguna ruta importaba: código inalcanzable con su propia prueba en verde.
//
// LO QUE APARECIÓ AL RETIRARLOS, y es peor que el código muerto: la capacidad **CAP-MED-AUTH-003 — «Medication Prescribing
// Authority Boundary», riesgo C5** citaba como ÚNICA evidencia la prueba de `medication-ordering`, es decir, una prueba de
// dos líneas sobre código que nunca se ejecuta. La frontera de autoridad que el sistema promete estaba respaldada por la
// implementación que no corre, mientras la que sí corre —`authorize` en el handler, con la prueba en vivo que comprueba que
// una enfermera recibe 403 y un médico 201— no estaba citada.
//
// Este test fija las tres cosas: que no vuelvan los paquetes inertes, que la capacidad apunte a evidencia que se ejecuta, y
// que las reglas con historial de duplicación sigan teniendo una sola implementación.
const RETIRADOS=["encounter-service","medication-ordering","medication-runtime"];

describe("implementaciones paralelas de la autoridad clínica (R08-01)",()=>{
 it("los paquetes inertes no vuelven",()=>{
  for(const p of RETIRADOS)expect(fs.existsSync(path.join("packages",p)),`packages/${p} volvió`).toBe(false);
 });
 it("su retiro está declarado con la razón, no solo borrado",()=>{
  const reg=JSON.parse(fs.readFileSync("docs/adjudication/not-wired-registry.json","utf8")) as {retiredModules:{module:string;reason:string}[]};
  for(const p of RETIRADOS){
   const e=reg.retiredModules.find(m=>m.module===`packages/${p}`);
   expect(e,`packages/${p} sin declaración de retiro`).toBeTruthy();
   expect(e!.reason.length,`packages/${p}: razón demasiado corta`).toBeGreaterThan(80);
  }
 });
 it("la capacidad C5 de autoridad de prescripción apunta a evidencia que SE EJECUTA",()=>{
  const cat=JSON.parse(fs.readFileSync("capabilities/catalog.json","utf8")) as unknown;
  const caps=(Array.isArray(cat)?cat:(cat as{capabilities:unknown[]}).capabilities) as {id:string;tests?:string[]}[];
  const cap=caps.find(c=>c.id==="CAP-MED-AUTH-003");
  expect(cap,"falta CAP-MED-AUTH-003").toBeTruthy();
  const tests=cap!.tests??[];
  expect(tests.some(t=>t.includes("medication-ordering")),"vuelve a citar el paquete inerte").toBe(false);
  // La prueba en vivo es la que ejercita la frontera de verdad: enfermera 403, médico 201, contra una base real.
  expect(tests.some(t=>t.includes("live-medication-lifecycle-proof")),"debe citar la prueba en vivo de la frontera").toBe(true);
  // Y cada cita tiene que existir en disco.
  for(const t of tests){
   const candidatos=[t,`tests/v22/${t}`,`tests/v12/${t}`,`tests/v11/${t}`,`scripts/v22/${t}`];
   expect(candidatos.some(c=>fs.existsSync(c)),`${t} no existe`).toBe(true);
  }
 });
 it("la frontera que se cita de verdad comprueba los dos lados",()=>{
  // Una prueba que solo comprueba que el médico puede no es una frontera: hay que ver que la enfermera NO puede.
  const src=fs.readFileSync("scripts/v22/live-medication-lifecycle-proof.mts","utf8");
  expect(src).toMatch(/NURSE_PRESCRIBE_FORBIDDEN_403/);
  expect(src).toMatch(/PHYSICIAN_PRESCRIBE_201/);
 });
});

describe("una sola implementación de las reglas con historial de duplicación (R08-10)",()=>{
 it("el parser de presión arterial es uno y está en su paquete",()=>{
  // El anexo contó seis. Hoy hay uno (`parseBp`) y lo importan las diez rutas y vistas que lo necesitan; la consecuencia de
  // tener seis ya se vio en R03-16: una de ellas leía «80/120» como hipertensión estadio 2.
  const propios:string[]=[];
  const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   const p=path.join(d,e.name);
   if(e.isDirectory()){if(e.name!=="node_modules")walk(p);continue;}
   if(!/\.(ts|tsx)$/.test(e.name))continue;
   const src=fs.readFileSync(p,"utf8");
   // Un split por "/" sobre una presión arterial, fuera del paquete que la parsea.
   if(/(ta|bp|presion|presión|systolic)\w*\.split\(["'`]\/["'`]\)/i.test(src)&&!p.includes("bp-staging"))propios.push(p);
  }};
  for(const d of ["packages","apps"])walk(d);
  expect(propios,"parser de presión arterial propio fuera de packages/bp-staging").toEqual([]);
  expect(fs.readFileSync("packages/bp-staging/src/index.ts","utf8"),"el parser único vive aquí").toContain("export function parseBp");
 });
 it("el IMC se calcula en un solo sitio",()=>{
  const calculan:string[]=[];
  const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   const p=path.join(d,e.name);
   if(e.isDirectory()){if(e.name!=="node_modules")walk(p);continue;}
   if(!/\.(ts|tsx)$/.test(e.name))continue;
   const src=fs.readFileSync(p,"utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
   if(/\/\s*\(\s*heightM\s*\*\s*heightM\s*\)|weightKg\s*\/\s*\(/.test(src)&&!p.includes("anthropometrics"))calculan.push(p);
  }};
  for(const d of ["packages","apps"])walk(d);
  expect(calculan,"cálculo de IMC fuera de packages/anthropometrics").toEqual([]);
 });
});

describe("observabilidad: los indicadores tienen a dónde ir (R08-07)",()=>{
 it("el commit del kernel abre un span de SLI y lo cierra en los DOS desenlaces",()=>{
  // El anexo decía que los indicadores «no tienen a dónde ir». Están cableados con `sliSpan` —que emite por el sink y por la
  // salida estándar cuando OBSERVABILITY_EMIT=1—, pero la medición del anexo buscó `emitSli` (la primitiva) en vez del
  // punto de integración. Este test deja la respuesta comprobable en vez de dependiente de un grep.
  const src=fs.readFileSync("apps/web/lib/runtime/command.ts","utf8");
  expect(src,"el comando clínico tiene que abrir su span").toMatch(/sliSpan\(flowForTopic\(command\.topic\)/);
  expect(src,"y cerrarlo en éxito").toMatch(/span\.end\("success"/);
  expect(src,"y en error, con el código").toMatch(/span\.end\("error"/);
 });
 it("el evento de telemetría no puede llevar PHI, y la lista es dura",()=>{
  const src=fs.readFileSync("packages/observability/src/index.ts","utf8");
  expect(src).toContain("assertSliPhiFree");
  expect(src,"el tenant se reporta hasheado, no en crudo").toContain("tenantHash");
  // Un sink defectuoso nunca puede tumbar el flujo clínico: es la diferencia entre telemetría y dependencia.
  expect(src).toMatch(/catch\{\/\* un sink defectuoso nunca debe romper el flujo clínico \*\/\}/);
 });
});
