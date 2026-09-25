import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Auditoría 2026-09-19, anexo R07 (R07-05 y R07-03) — CADA RUTA HTTP SE EJERCITA CONTRA UNA BASE REAL.
//
// EL HALLAZGO decía: «0 de 151 `route.ts` tienen un test propio; sin infraestructura para probar HTTP» y «cero tests tocan
// PostgreSQL; las políticas RLS reales nunca se ejecutan contra un motor de base de datos». Al medirlo el 25-sep-2026 eran
// **159 de 162** rutas ejercitadas por una prueba en vivo que importa el handler real y lo invoca con un `Request` real
// contra una base de datos real —con RLS forzado— y las tres que faltaban se cubrieron en el mismo lote.
//
// Este test mantiene el 100 %: una ruta nueva sin prueba en vivo rompe la compilación. Es la única forma de que la
// afirmación «las rutas están probadas» no envejezca, porque añadir una ruta es más fácil que probarla.
const API="apps/web/app/api";
const PROOFS="scripts/v22";
function rutas():string[]{
 const out:string[]=[];
 const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);else if(e.name==="route.ts")out.push(p.split(path.sep).join("/"));
 }};
 walk(API);return out.sort();
}
const fuentesDeProofs=():string=>fs.readdirSync(PROOFS)
 .filter(f=>/^live-.*-proof\.mts$/.test(f))
 .map(f=>fs.readFileSync(path.join(PROOFS,f),"utf8")).join("\n");

describe("cobertura de rutas por prueba en vivo (R07-05)",()=>{
 const todas=rutas();
 const proofs=fuentesDeProofs();
 it("hay rutas y hay pruebas en vivo que las importan",()=>{
  expect(todas.length,"no se encontraron rutas").toBeGreaterThanOrEqual(160);
  expect(proofs.length,"no se encontraron pruebas en vivo").toBeGreaterThan(100000);
 });
 it("TODA ruta HTTP la ejercita al menos una prueba en vivo",()=>{
  // Las pruebas importan el módulo de la ruta por su camino relativo: `../../apps/web/app/api/v1/results/route`.
  const sinProof=todas.filter(r=>{
   const sinExt=r.replace(/\.ts$/,"");
   return !proofs.includes(sinExt)&&!proofs.includes(`../../${sinExt}`);
  });
  expect(sinProof,"ruta HTTP sin prueba en vivo que la ejercite").toEqual([]);
 });
 it("las pruebas en vivo corren contra una base DESECHABLE, nunca la de la aplicación",()=>{
  // Es lo que hace que «tocar PostgreSQL» sea seguro: el prólogo se niega si el destino es la base de la aplicación.
  const prologo=fs.readFileSync(path.join(PROOFS,"_live-env.mts"),"utf8");
  expect(prologo).toMatch(/TEST_DATABASE_URL/);
  expect(prologo,"debe negarse si apunta a la base de la aplicación").toMatch(/TEST_DATABASE_URL_IS_APP_DATABASE/);
  // Y todas las pruebas tienen que importarlo: una que no lo haga escribiría donde no debe.
  const sinPrologo=fs.readdirSync(PROOFS).filter(f=>/^live-.*-proof\.mts$/.test(f))
   .filter(f=>!fs.readFileSync(path.join(PROOFS,f),"utf8").includes('"./_live-env.mts"'));
  expect(sinPrologo,"prueba en vivo sin el prólogo que impone la base desechable").toEqual([]);
 });
});
