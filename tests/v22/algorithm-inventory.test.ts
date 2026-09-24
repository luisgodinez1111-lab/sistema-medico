import{describe,it,expect}from"vitest";
import fs from"node:fs";import{spawnSync}from"node:child_process";
import{ALGORITHM_SPECS,SPEC_BY_ID}from"../../packages/clinical-algorithm-specs/src";
// Auditoría 2026-09-19, anexo R09 (R09-F02): «ningún documento de docs/ transcribe fórmula, unidades, umbrales ni fuente
// primaria de los algoritmos clínicos». Para validar lo que el sistema calcula, un médico necesitaba leer TypeScript.
//
// La ficha se GENERA desde el código y los umbrales se IMPORTAN de cada implementación, no se transcriben. Es deliberado:
// en esta misma remediación una afirmación escrita a mano derivó cuatro veces (la expectativa del drill, la ruta de los
// value sets, el «27 migraciones» del runbook y el testid `result-action`). Lo que no se puede copiar, no puede divergir.
const DOC="docs/compliance/inventario-de-algoritmos.md";

describe("inventario de algoritmos clínicos (R09-F02)",()=>{
 it("cada ficha declara fórmula, unidades, fuente, población validada y límites",()=>{
  expect(ALGORITHM_SPECS.length).toBeGreaterThanOrEqual(10);
  for(const s of ALGORITHM_SPECS){
   expect(s.formula.length,`${s.id}: fórmula ausente o trivial`).toBeGreaterThan(20);
   expect(Object.keys(s.units).length,`${s.id}: sin unidades declaradas`).toBeGreaterThan(0);
   // Una fuente primaria cita autor y publicación; «guías internacionales» no es una fuente.
   expect(s.source,`${s.id}: la fuente debe citar publicación y año`).toMatch(/\d{4}/);
   expect(s.validatedIn.length,`${s.id}: sin población de validación`).toBeGreaterThan(15);
   expect(s.limits.length,`${s.id}: sin declarar lo que NO hace`).toBeGreaterThan(40);
  }
 });
 it("los ids son únicos y coinciden con el índice",()=>{
  const ids=ALGORITHM_SPECS.map(s=>s.id);
  expect(new Set(ids).size,"id repetido").toBe(ids.length);
  for(const id of ids)expect(SPEC_BY_ID[id]?.id).toBe(id);
 });
 it("TODO id que viaja en un recibo de cálculo tiene ficha",()=>{
  // Es la invariante que importa: si mañana una ruta empieza a emitir un recibo nuevo, el médico tiene que poder validarlo.
  const ids=new Set<string>();
  const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   if(e.name==="node_modules"||e.name===".next")continue;
   const p=`${d}/${e.name}`;
   if(e.isDirectory()){walk(p);continue;}
   if(!/\.tsx?$/.test(e.name))continue;
   for(const m of fs.readFileSync(p,"utf8").matchAll(/calcReceipt\(\{id:"([^"]+)"/g))ids.add(m[1]!);
  }};
  walk("apps/web");
  const sinFicha=[...ids].filter(id=>!(id in SPEC_BY_ID)).sort();
  expect(sinFicha,"algoritmo expuesto con recibo y sin ficha: un médico no puede validarlo").toEqual([]);
 });
 it("el documento generado está SINCRONIZADO con el código",()=>{
  // No se compara el texto a mano: se invoca el generador en modo --check, que es la misma lógica que lo escribe.
  expect(fs.existsSync(DOC),"falta el inventario generado").toBe(true);
  const r=spawnSync("pnpm",["-s","exec","tsx","scripts/docs/algorithm-inventory.mts","--check"],{encoding:"utf8"});
  expect(r.status,`el inventario derivó del código: ${(r.stderr??r.stdout??"").trim()}`).toBe(0);
 });
 it("el documento dice que NO es validación clínica",()=>{
  // Sin esto, una tabla con fórmulas y fuentes se lee como un aval. No lo es: la validación es del dueño (ADR-0300).
  const b=fs.readFileSync(DOC,"utf8");
  expect(b).toMatch(/no es validaci[oó]n cl[ií]nica/i);
  expect(b).toMatch(/ADR-0300/);
  expect(b,"debe declararse generado para que nadie lo edite a mano").toMatch(/GENERADO desde el c[oó]digo/);
 });
 it("MELD advierte que no implementa MELD 3.0, que es lo que asigna trasplantes",()=>{
  // La advertencia más importante del inventario: usar este número para priorizar un trasplante sería un daño real.
  const meld=SPEC_BY_ID["MELD"];
  expect(meld,"falta la ficha de MELD").toBeTruthy();
  expect(meld!.limits).toMatch(/MELD 3\.0/);
  expect(meld!.limits).toMatch(/no debe usarse para priorizar trasplante/i);
 });
});
