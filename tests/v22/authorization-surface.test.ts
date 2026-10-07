import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Auditoría 2026-09-19, anexo R09 (R09-014) — la superficie de autorización se MIDE, no se supone.
//
// El anexo señaló dos cosas: que no se modela la autorización por relación médico–paciente (BOLA) y que el STRIDE tiene
// «6 filas para ~150 rutas». Lo primero resultó ser una decisión explícita de ADR-0230 §2 —el tenant es la unidad de
// confianza en un consultorio de 1–5 clínicos— que el modelo de amenazas no registraba; documentarla era el arreglo, y
// queda con sus controles compensatorios y con lo que NO previene dicho sin adornos.
//
// Lo segundo es lo que este test convierte en invariante. Un modelo de amenazas con N filas no dice nada sobre si las 162
// rutas están cubiertas; lo que sí lo dice es recorrerlas y exigir que cada una autorice. Si alguien añade una ruta sin
// autorización, esto la nombra y el build falla, que es la única forma de que «~150 rutas» deje de ser una cifra suelta.
const RAIZ="apps/web/app/api";
/**
 * Rutas que legítimamente NO exigen scope clínico, con su motivo. Añadir una entrada aquí es una decisión visible en la
 * revisión del cambio, que es exactamente el punto: la excepción se argumenta, no se cuela.
 */
const EXCEPCIONES:Readonly<Record<string,string>>={
 "health/route.ts":"Sonda de vida: no abre sesión, no consulta la base y devuelve solo {status, service, at}. Un health check que exigiera sesión no sirve como health check.",
 "health/ready/route.ts":"Sonda de readiness (SRE): no abre sesión —es una sonda de infraestructura para el balanceador—. Toca la base solo con `select 1` acotado en el tiempo, que no lee ninguna tabla bajo RLS ni expone PHI; devuelve solo {status, dependencies}.",
 "v1/features/route.ts":"Capacidades que la UI necesita para decidir qué pinta. Exige sesión válida (resolveVerified) pero no scope clínico, porque no toca datos de pacientes.",
 // R04-019 (lote 36): al exigir que el delegado autorice de verdad, esta ruta dejó de pasar por el nombre `handleLogin`.
 // No es un agujero: es la EMISIÓN de la sesión, y no puede exigir una sesión para crear una sesión. Tiene su propio
 // control, distinto y comprobado abajo: límite de intentos por IP ANTES de leer el cuerpo (S-03, sobre el almacén
 // compartido) y verificación de la credencial contra el IdP (OIDC/JWKS). `authorize(scope)` no aplica porque en ese
 // punto todavía no hay principal que autorizar.
 "v1/sessions/route.ts":"Emisión y cierre de sesión (login/logout): no puede exigir una sesión para crear una sesión. Su control es el límite de intentos por IP antes de leer el cuerpo (S-03) más la verificación OIDC/JWKS de la credencial, no un scope clínico.",
};
/** Las excepciones bajo `/v1/` llevan un control ALTERNATIVO que este test comprueba que exista en el código. */
const CONTROL_ALTERNATIVO:Readonly<Record<string,RegExp[]>>={
 "v1/sessions/route.ts":[/rateLimit|rate_limit|limit\.allowed/,/verifier|verifyIdentity|verify\(/],
 "v1/features/route.ts":[/resolveVerified\(/],
};
function rutas():string[]{
 const out:string[]=[];
 const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);else if(e.name==="route.ts")out.push(p);
 }};
 walk(RAIZ);return out.sort();
}
const rel=(p:string)=>p.slice(RAIZ.length+1);
const LIB="apps/web/lib";
/** El texto de cada módulo de `lib/`, para poder comprobar si el handler delegado autoriza de verdad. */
const FUENTES_LIB:Map<string,string>=(()=>{
 const m=new Map<string,string>();
 for(const f of fs.readdirSync(LIB))if(f.endsWith(".ts"))m.set(f,fs.readFileSync(path.join(LIB,f),"utf8"));
 return m;
})();
/**
 * ¿La ruta delega en un handler de `lib/` que AUTORIZA? Se sigue el import y se mira el módulo del delegado.
 *
 * El rastreo es deliberadamente literal —nombre importado + `authorize(` en su módulo—: un análisis más listo (seguir la
 * llamada, resolver alias) daría falsos negativos silenciosos, y un guardarraíl de seguridad que se equivoca a favor del
 * código no sirve para nada.
 */
function delegaEnHandlerQueAutoriza(src:string):boolean{
 for(const m of src.matchAll(/import\s*\{([^}]+)\}\s*from"[^"]*\/lib\/([\w-]+)"/g)){
  const fuente=FUENTES_LIB.get(`${m[2]}.ts`);
  if(!fuente||!/\bauthorize\(/.test(fuente))continue;
  for(const n of m[1]!.split(",").map(x=>x.trim().replace(/^type\s+/,"")))
   if(n.startsWith("handle")&&new RegExp(`\\b${n}\\b`).test(src))return true;
 }
 return false;
}
const HANDLERS=/export async function (GET|POST|PUT|PATCH|DELETE)/g;

describe("superficie de autorización de la API (R09-014)",()=>{
 const todas=rutas();
 it("hay rutas que revisar (si esto baja de golpe, algo se movió y el test dejó de cubrir)",()=>{
  expect(todas.length).toBeGreaterThanOrEqual(150);
 });
 it("toda ruta autoriza con scope, delega en un handler que lo hace, o es una excepción DECLARADA",()=>{
  const sinAutorizar:string[]=[];
  for(const p of todas){
   const src=fs.readFileSync(p,"utf8");
   if(!HANDLERS.test(src)){HANDLERS.lastIndex=0;continue;}
   HANDLERS.lastIndex=0;
   // R04-019 (lote 36): `withClinicalAuth` aplica el contrato —sesión → autorización → traducción del fallo— en un solo
   // sitio. Una ruta que lo usa autoriza por construcción: el wrapper llama a `authorize` antes de ejecutar el cuerpo.
   const autoriza=src.includes("authorize(")||src.includes("withClinicalAuth(");
   // Muchas rutas son una línea: `export async function POST(req){return handleX(req)}`, y la autorización vive en el
   // handler de `lib/`. Delegar es correcto; lo que no puede es no autorizar en ningún sitio.
   //
   // R04-019: esta comprobación ACEPTABA cualquier ruta que llamara a algo llamado `handleX`, SIN mirar si ese handler
   // autoriza. Era un guardarraíl por convención de nombre: una ruta nueva que delegara en un handler sin autorización
   // pasaba. Ahora se sigue el import y se exige que el módulo del delegado llame a `authorize`. Se midió al endurecerlo:
   // ninguna ruta estaba mal, salvo `v1/sessions` —que no puede autorizar porque todavía no hay principal— y por eso
   // pasa a estar DECLARADA con el control que sí tiene.
   const delega=delegaEnHandlerQueAutoriza(src);
   if(autoriza||delega)continue;
   if(rel(p) in EXCEPCIONES)continue;
   sinAutorizar.push(rel(p));
  }
  expect(sinAutorizar,"ruta sin autorización y sin excepción declarada: decláralo con su motivo o autoriza").toEqual([]);
 });
 it("cada excepción declarada existe y su motivo es sustantivo",()=>{
  // Una lista de excepciones que se queda obsoleta es una puerta abierta que nadie vuelve a mirar.
  for(const[r,motivo]of Object.entries(EXCEPCIONES)){
   expect(fs.existsSync(path.join(RAIZ,r)),`excepción declarada para una ruta que no existe: ${r}`).toBe(true);
   expect(motivo.length,`${r}: el motivo debe explicar por qué no exige scope`).toBeGreaterThan(60);
  }
 });
 it("la excepción de /health no abre sesión ni consulta la base",()=>{
  const src=fs.readFileSync(path.join(RAIZ,"health/route.ts"),"utf8");
  expect(src.includes("resolveVerified"),"/health no debe exigir sesión").toBe(false);
  expect(/getSql|withTenantTx|postgres\(/.test(src),"/health no debe tocar la base").toBe(false);
 });
 it("la excepción de /v1/features SÍ exige sesión, aunque no scope clínico",()=>{
  const src=fs.readFileSync(path.join(RAIZ,"v1/features/route.ts"),"utf8");
  expect(src,"sin sesión, revelaría la configuración a anónimos").toContain("resolveVerified");
 });
 // R04-019 (lote 36) — UNA EXCEPCIÓN BAJO `/v1/` TIENE QUE DECLARAR SU CONTROL, Y ESE CONTROL TIENE QUE EXISTIR.
 //
 // `/v1/` es el espacio de los datos del consultorio. «Sin scope» y «sin control» no son lo mismo, y confundirlos es
 // cómo una ruta de datos acaba abierta con una razón escrita al lado. Así que cada excepción de `/v1/` nombra su
 // control alternativo y aquí se comprueba que esté en el código —el del delegado incluido—, no solo en el comentario.
 it("cada excepción bajo /v1/ declara su control alternativo Y ese control está en el código",()=>{
  const bajoV1=Object.keys(EXCEPCIONES).filter(r=>r.startsWith("v1/"));
  for(const r of bajoV1){
   const patrones=CONTROL_ALTERNATIVO[r];
   expect(patrones,`${r}: excepción de /v1/ sin control alternativo declarado`).toBeDefined();
   const src=fs.readFileSync(path.join(RAIZ,r),"utf8");
   const delegado=[...src.matchAll(/from"[^"]*\/lib\/([\w-]+)"/g)]
    .map(m=>FUENTES_LIB.get(`${m[1]}.ts`)).filter((x):x is string=>!!x).join("\n");
   for(const pat of patrones!)
    expect(pat.test(src)||pat.test(delegado),`${r}: declara un control (${String(pat)}) que no se encuentra en el código`).toBe(true);
  }
 });
 // R04-019 — EL WRAPPER: el contrato en un solo sitio, para que una ruta nueva tenga una forma correcta a mano.
 it("el wrapper exige scope en el tipo, solo ejecuta el cuerpo si autorizó, y no duplica el X-Request-Id",()=>{
  const src=fs.readFileSync(path.join(LIB,"http-command.ts"),"utf8");
  expect(src,"R04-019 pedía el wrapper").toContain("export async function withClinicalAuth");
  // `scope` obligatorio en el TIPO: `authorize` ya rechaza al llamador que lo omita, pero así no se puede ni escribir.
  expect(src).toMatch(/exige:\{scope:string;/);
  // El cuerpo corre DESPUÉS de autorizar, y cualquier fallo sale por `toHttpError`, nunca como un 500 crudo.
  expect(src).toMatch(/authorize\(principalFrom\(claims\),exige\);\s*\n\s*return await cuerpo/);
  expect(src).toMatch(/catch\(e\)\{const h=toHttpError\(e\)/);
  // El anexo proponía el wrapper para emitir `X-Request-Id`, pero el middleware ya lo hace para TODAS las respuestas
  // (R04-F09). Dos fuentes para la misma cabecera es cómo empiezan a divergir.
  const wrapper=src.slice(src.indexOf("export async function withClinicalAuth"));
  expect(wrapper,"la cabecera la pone el middleware; aquí sobraría").not.toMatch(/headers\.set\("X-Request-Id"/);
  expect(fs.readFileSync("apps/web/middleware.ts","utf8"),"y el middleware debe seguir emitiéndola").toContain('"X-Request-Id"');
 });
 it("el modelo de amenazas registra BOLA con su decisión y lo que NO previene",()=>{
  const b=fs.readFileSync("docs/threat-models/baseline-threat-model.md","utf8");
  expect(b,"BOLA debe estar nombrada, no solo IDOR").toMatch(/BOLA/);
  expect(b,"debe remitir a la decisión que la resuelve").toMatch(/ADR-0230/);
  expect(b,"debe decir qué NO previene: la honestidad es el control").toMatch(/NO previene/);
  expect(b,"y cuál es el control detectivo que queda").toMatch(/phi_access_log/);
 });
});
