import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Auditoría 2026-09-19, anexo R05a (WS1-12) — NINGUNA MUTACIÓN SIN AVISO.
//
// El hallazgo señalaba dos paradigmas de busy/error conviviendo en el mismo componente: `call()` con estado global y
// decenas de manejadores con su propio `xBusy`/`xMsg`. Al medirlo resultaron 83 mutaciones: 64 por `call()`, 19 con mensaje
// propio y NINGUNA sin aviso. Así que no son dos paradigmas en conflicto, sino una regla que nadie había escrito —el aviso
// aparece donde está la acción— y unificar 83 llamadas sería una reescritura sin beneficio para el médico.
//
// LO QUE SÍ ES UN DEFECTO, y lo que fija este test, es una mutación cuyo fallo el médico no vea: un POST que devuelve 409 o
// 403 y una pantalla que sigue como si nada. Ese es el estado inconsistente que el hallazgo teme, y aquí no puede entrar.
const DIR="apps/web/app/workspace";
const MUTACION=/apiRequest\([^)]*\{method:"(?:POST|PUT|PATCH|DELETE)"|apiUpload\(|apiDelete\(/;
/** Señales de que el fallo de esa mutación llega a la pantalla. */
const AVISO=/call\(|set\w*(?:Msg|Err|Error)\(|setError\(/;
function archivos():string[]{
 const out:string[]=[];
 const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);else if(e.name.endsWith(".tsx"))out.push(p);
 }};
 walk(DIR);return out.sort();
}
type Hallazgo={archivo:string;linea:number;via:"call"|"local"};
function mutaciones():Hallazgo[]{
 const out:Hallazgo[]=[];
 for(const f of archivos()){
  const lineas=fs.readFileSync(f,"utf8").split("\n");
  for(let i=0;i<lineas.length;i++){
   if(!MUTACION.test(lineas[i]!))continue;
   // Contexto del manejador: arriba vive el `call(...)` o el `setXBusy`, abajo el tratamiento de la respuesta.
   const ctx=lineas.slice(Math.max(0,i-14),i+10).join("\n");
   if(!AVISO.test(ctx)){out.push({archivo:f,linea:i+1,via:"local"});continue;}
   out.push({archivo:f,linea:i+1,via:/call\(/.test(ctx)?"call":"local"});
  }
 }
 return out;
}

describe("toda mutación avisa de su fallo (WS1-12)",()=>{
 it("ninguna mutación se queda sin forma de avisar al médico",()=>{
  const m=mutaciones();
  expect(m.length,"no se encontraron mutaciones: ¿cambió la forma del modelo?").toBeGreaterThanOrEqual(60);
  const mudas:string[]=[];
  for(const f of archivos()){
   const lineas=fs.readFileSync(f,"utf8").split("\n");
   for(let i=0;i<lineas.length;i++){
    if(!MUTACION.test(lineas[i]!))continue;
    const ctx=lineas.slice(Math.max(0,i-14),i+10).join("\n");
    if(!AVISO.test(ctx))mudas.push(`${f}:${i+1}`);
   }
  }
  expect(mudas,"mutación que puede fallar sin que el médico se entere").toEqual([]);
 });
 it("los dos caminos siguen existiendo, y el global sigue siendo el mayoritario",()=>{
  // Si el reparto se invirtiera, la regla escrita en `model.tsx` habría dejado de describir el código.
  const m=mutaciones();
  const porCall=m.filter(x=>x.via==="call").length;
  expect(porCall,"las transiciones del expediente usan el aviso del expediente").toBeGreaterThan(m.length/2);
 });
 it("la regla está escrita junto a `call`, no solo en la auditoría",()=>{
  const src=fs.readFileSync(path.join(DIR,"model.tsx"),"utf8");
  const i=src.indexOf("async function call(tag:string");
  const antes=src.slice(Math.max(0,i-2000),i);
  expect(antes,"debe declarar cuándo se usa cada camino").toMatch(/WS1-12/);
  expect(antes,"y el criterio: el aviso va donde está la acción").toMatch(/DONDE ESTÁ LA ACCIÓN/i);
 });
 it("`call` limpia el error anterior y siempre libera el bloqueo",()=>{
  // Dos defectos clásicos de este patrón: dejar un error viejo en pantalla tras una acción que sí funcionó, y quedarse
  // bloqueado si la promesa lanza. El `finally` y el `setError("")` inicial son lo que lo impide.
  const src=fs.readFileSync(path.join(DIR,"model.tsx"),"utf8");
  const fn=/async function call\(tag:string[^\n]*/.exec(src)?.[0]??"";
  expect(fn).toContain('setError("")');
  expect(fn).toContain("finally{setBusy(\"\");}");
  expect(fn,"el error del usuario se traduce, no se pinta la excepción cruda").toContain("userMessage(e)");
 });
});
