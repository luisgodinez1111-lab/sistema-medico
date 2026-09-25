import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Auditoría 2026-09-19, anexo R11 (R11-07) — NINGÚN SECRETO DE FIRMA ESCRITO EN EL CÓDIGO.
//
// EL HALLAZGO: las 101 pruebas en vivo llevaban su propio secreto de respaldo escrito a mano —`?? "epic-g-secret"`,
// `?? "u20-secret"`, uno por epic—. Ninguna era la credencial de producción, pero el patrón es el que hay que erradicar:
// un secreto con valor por omisión invita a que algún día ese valor sea el de verdad, y el `??` esconde la diferencia entre
// «configurado» y «no configurado» justo en scripts que se ejecutan contra una base de datos.
//
// LA CORRECCIÓN: se resuelve una vez en el prólogo común. Si el entorno trae el secreto, se respeta; si no, se genera uno
// ALEATORIO por corrida. Cada prueba firma y verifica sus propios tokens dentro del mismo proceso, así que un secreto
// efímero basta —y es mejor: no existe fuera de la corrida y no puede coincidir por accidente con el de un entorno real.
const PROLOGO="scripts/v22/_live-env.mts";
/** Nombres de variables cuyo valor NUNCA puede aparecer literal en el repositorio. */
const SECRETOS=["SESSION_SIGNING_SECRET","DATABASE_URL","BLOB_READ_WRITE_TOKEN","AUTH0_CLIENT_SECRET"];
function archivos(dir:string,ext:readonly string[]):string[]{
 const out:string[]=[];
 const walk=(d:string):void=>{
  if(!fs.existsSync(d))return;
  for(const e of fs.readdirSync(d,{withFileTypes:true})){
   const p=path.join(d,e.name);
   if(e.isDirectory()){if(e.name!=="node_modules"&&!e.name.startsWith("."))walk(p);continue;}
   if(ext.some(x=>e.name.endsWith(x)))out.push(p);
  }};
 walk(dir);return out.sort();
}

describe("secretos de firma fuera del código (R11-07)",()=>{
 it("ningún script da un valor por omisión a una variable de secreto",()=>{
  const ofensas:string[]=[];
  for(const f of [...archivos("scripts",[".mts",".ts",".mjs"]),...archivos("apps",[".ts",".tsx"]),...archivos("packages",[".ts"])]){
   const src=fs.readFileSync(f,"utf8");
   for(const nombre of SECRETOS){
    // `process.env.X ?? "literal"` o `process.env["X"] || "literal"`: el literal es el defecto, en cualquiera de las formas.
    const re=new RegExp(`process\\\\.env(?:\\\\.${nombre}|\\\\["${nombre}"\\\\])\\\\s*(?:\\\\?\\\\?|\\\\|\\\\|)\\\\s*"[^"]+"`,"g");
    for(const m of src.matchAll(re))ofensas.push(`${f}: ${m[0].slice(0,70)}`);
   }
  }
  expect(ofensas,"secreto con valor por omisión escrito en el código").toEqual([]);
 });
 it("el prólogo de las pruebas en vivo genera un secreto ALEATORIO por corrida",()=>{
  const src=fs.readFileSync(PROLOGO,"utf8");
  expect(src,"debe respetar el del entorno si existe").toMatch(/if\(!process\.env\["SESSION_SIGNING_SECRET"\]\)/);
  expect(src,"y generarlo aleatorio si no").toMatch(/randomBytes\(\d+\)/);
  // Un valor fijo aquí sería el mismo defecto concentrado en un solo sitio, que es peor: parecería resuelto.
  expect(src.includes('SESSION_SIGNING_SECRET"]="'),"el prólogo no puede fijar un literal").toBe(false);
 });
 it("las pruebas en vivo ya no declaran su propio secreto",()=>{
  const conSecreto=archivos("scripts",[".mts"]).filter(f=>{
   const src=fs.readFileSync(f,"utf8");
   return /process\.env\.SESSION_SIGNING_SECRET\s*=\s*process\.env\.SESSION_SIGNING_SECRET/.test(src);
  });
  expect(conSecreto,"prueba que vuelve a fijar su propio secreto").toEqual([]);
  // Y siguen leyéndolo: si nadie lo leyera, el prólogo no serviría de nada.
  const lectores=archivos("scripts",[".mts"]).filter(f=>fs.readFileSync(f,"utf8").includes("process.env.SESSION_SIGNING_SECRET"));
  expect(lectores.length,"las pruebas tienen que seguir firmando con el secreto del entorno").toBeGreaterThanOrEqual(90);
 });
 it("ni el prólogo ni los libros de evidencia guardan una cadena de conexión",()=>{
  // El prólogo manipula DATABASE_URL: es el sitio más fácil para que se cuele una credencial en un commit.
  for(const f of [PROLOGO,"release/evidence/live-smoke-ledger.json","release/evidence/test-ledger.json"]){
   if(!fs.existsSync(f))continue;
   const src=fs.readFileSync(f,"utf8");
   expect(src,`${f}: no puede contener una cadena de conexión literal`).not.toMatch(/postgres(ql)?:\/\/[^\s"']+@/);
  }
 });
});
