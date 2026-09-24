import{describe,it,expect}from"vitest";
import fs from "node:fs";
import path from "node:path";
// Auditoría 2026-09-19, anexo R09 (hallazgo R09-027, verificado el 23-sep-2026): los gates RG-002 y RG-003 de
// `pnpm release:check` y la comprobación de cobertura C4/C5 de `pnpm traceability:check` leían `safety/invariants.json` y
// `tests/traceability/contracts.json`, dos arreglos VACÍOS desde el baseline del scaffold: contaban 0 incumplimientos
// sobre 0 filas y pasaban sin evaluar nada. Este test impide que eso vuelva a ocurrir de tres formas:
//  1. el registro ejecutable no puede quedar vacío,
//  2. cada invariante declara tests que EXISTEN y están fijados por sha256 en el manifiesto de evidencia,
//  3. ningún gate vuelve a apuntar a los corpus vacíos (que se eliminaron).
const root=process.cwd();
const load=(p:string):unknown[]=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8")) as unknown[];
type Inv=Readonly<{id:string;risk:string;predicate?:string;tests?:string[];authority?:string[]}>;
type Manifest=Readonly<{test:string;sha256:string;authority?:string[]}>;

const CORPUS=["safety/core-invariants.json","safety/core-hazards.json","safety/controls/catalog.json","capabilities/catalog.json"];
const STUBS_ELIMINADOS=["safety/invariants.json","safety/hazards.json","tests/traceability/contracts.json"];

describe("los gates de release no pueden pasar vacíamente (R09-027)",()=>{
 it("ningún corpus de seguridad está vacío",()=>{
  for(const p of CORPUS){const arr=load(p);expect(Array.isArray(arr),p).toBe(true);expect(arr.length,p).toBeGreaterThan(0);}
 });
 it("los corpus vacíos del scaffold ya no existen (nadie puede volver a leerlos)",()=>{
  for(const p of STUBS_ELIMINADOS)expect(fs.existsSync(path.join(root,p)),p).toBe(false);
 });
 it("ningún gate ni script referencia los corpus eliminados",()=>{
  const files=["packages/clinical-safety/src/release-admission.ts","packages/clinical-safety/src/validate-registry.ts","release/self-check.mjs","release/build-evidence.mjs","release/architecture-self-check.mjs","release/build-safety-cases.mjs"];
  for(const f of files){
   const src=fs.readFileSync(path.join(root,f),"utf8");
   // El comentario que explica el hallazgo sí puede nombrarlos; una carga real, no.
   for(const stub of STUBS_ELIMINADOS)expect(src.includes(`load("${stub}")`)||src.includes(`"${stub}"`)&&/const must=\[[^\]]*"safety\/invariants\.json"/.test(src),`${f} carga ${stub}`).toBe(false);
  }
 });
 it("cada invariante C4/C5 tiene predicado y tests que existen y están fijados por sha256",()=>{
  const inv=load("safety/core-invariants.json") as Inv[];
  const manifest=load("release/test-evidence-manifest.json") as Manifest[];
  const pinned=new Set(manifest.map(m=>m.test));
  const walk=(d:string,acc:string[]=[]):string[]=>{for(const e of fs.readdirSync(path.join(root,d),{withFileTypes:true})){const p=`${d}/${e.name}`;if(e.isDirectory())walk(p,acc);else if(/\.tsx?$/.test(e.name))acc.push(p);}return acc;};
  const byBase=new Map<string,string[]>();
  for(const f of walk("tests")){const b=f.slice(f.lastIndexOf("/")+1);byBase.set(b,[...(byBase.get(b)??[]),f]);}
  const fallos:string[]=[];
  for(const i of inv){
   if(!i.predicate)fallos.push(`${i.id}: sin predicado`);
   if(!i.authority?.length)fallos.push(`${i.id}: sin autoridad`);
   if(!i.tests?.length){fallos.push(`${i.id}: sin tests declarados`);continue;}
   for(const t of i.tests){
    const paths=byBase.get(t)??[];
    if(!paths.length)fallos.push(`${i.id}: el test declarado ${t} no existe`);
    else if(!paths.some(p=>pinned.has(p)))fallos.push(`${i.id}: ${t} existe pero no está fijado en release/test-evidence-manifest.json`);
   }
  }
  expect(fallos).toEqual([]);
 });
 it("el manifiesto de evidencia fija la huella real de cada test (detecta una edición silenciosa)",()=>{
  const manifest=load("release/test-evidence-manifest.json") as Manifest[];
  expect(manifest.length).toBeGreaterThan(100);
  for(const m of manifest){expect(fs.existsSync(path.join(root,m.test)),m.test).toBe(true);expect(m.sha256,m.test).toMatch(/^[0-9a-f]{64}$/);}
 });
 it("ningún control declara su evidencia como «future:» (una promesa no es un control)",()=>{
  const controls=load("safety/controls/catalog.json") as Readonly<{id:string;verification?:string[]}>[];
  const pendientes=controls.filter(c=>(c.verification??[]).some(v=>v.startsWith("future:"))).map(c=>c.id);
  expect(pendientes).toEqual([]);
 });
});
