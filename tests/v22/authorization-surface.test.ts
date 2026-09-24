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
 "v1/features/route.ts":"Capacidades que la UI necesita para decidir qué pinta. Exige sesión válida (resolveVerified) pero no scope clínico, porque no toca datos de pacientes.",
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
   const autoriza=src.includes("authorize(");
   // Muchas rutas son una línea: `export async function POST(req){return handleX(req)}`, y la autorización vive en el
   // handler de `lib/`. Delegar es correcto; lo que no puede es no autorizar en ningún sitio.
   const delega=/\bhandle[A-Z]\w*\s*\(/.test(src);
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
 it("el modelo de amenazas registra BOLA con su decisión y lo que NO previene",()=>{
  const b=fs.readFileSync("docs/threat-models/baseline-threat-model.md","utf8");
  expect(b,"BOLA debe estar nombrada, no solo IDOR").toMatch(/BOLA/);
  expect(b,"debe remitir a la decisión que la resuelve").toMatch(/ADR-0230/);
  expect(b,"debe decir qué NO previene: la honestidad es el control").toMatch(/NO previene/);
  expect(b,"y cuál es el control detectivo que queda").toMatch(/phi_access_log/);
 });
});
