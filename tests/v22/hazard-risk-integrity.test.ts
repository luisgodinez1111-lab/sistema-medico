import{describe,it,expect}from"vitest";
import fs from"node:fs";
// Auditoría 2026-09-19, anexo R09 (R09-026) — integridad de la evaluación de riesgo de los peligros clínicos.
//
// El anexo: «los 6 hazards documentados usan una sola severidad (S1) sin probabilidad ni matriz de riesgo». Al medirlo son
// TRECE, y todos llevaban `severity: "S1"` y nada más. Con un solo eje no hay evaluación de riesgo —riesgo = severidad ×
// probabilidad—: el campo no transporta información, no se puede priorizar y no se puede justificar la aceptación de un
// riesgo residual. Aquí NO se inventan probabilidades (es un juicio clínico y regulatorio del dueño, ISO 14971; una cifra
// inventada convertiría una laguna visible en una evaluación falsa). Lo que se impone es que el hueco esté DECLARADO y que
// lo único determinable por ingeniería —que el control que detecta el peligro exista y se ejecute— sea cierto.
//
// Al mirar los controles apareció el segundo defecto: siete de los quince declaraban su verificación con etiquetas
// simbólicas (`unit:test-result-closure`, `reconciliation:due-date-scan`…) que NINGÚN gate resolvía y a las que no
// correspondía ningún fichero. El control decía estar verificado por algo que no existía con ese nombre.
type Hazard=Readonly<{id:string;severity:string;controls:string[];severityBasis?:string;probability?:string;riskClass?:string;residualRiskAcceptance?:string;detection?:string}>;
type Control=Readonly<{id:string;type:string;invariant:string;verification:string[]}>;
const hazards=JSON.parse(fs.readFileSync("safety/core-hazards.json","utf8")) as Hazard[];
const raw=JSON.parse(fs.readFileSync("safety/controls/catalog.json","utf8")) as Control[]|{controls:Control[]};
const controls=Array.isArray(raw)?raw:raw.controls;
const REGLA="docs/compliance/evaluacion-de-riesgo.md";
/** Una referencia de verificación es `<tipo>:<ruta>`; la ruta tiene que existir en el árbol. */
const rutaDe=(v:string)=>v.includes(":")?v.slice(v.indexOf(":")+1):v;

describe("evaluación de riesgo de los peligros clínicos (R09-026)",()=>{
 it("hay registro de peligros y todos declaran severidad y controles",()=>{
  expect(hazards.length).toBeGreaterThanOrEqual(13);
  for(const h of hazards){
   expect(h.severity,`${h.id} sin severidad`).toBeTruthy();
   expect(h.controls.length,`${h.id} sin ningún control`).toBeGreaterThan(0);
  }
 });
 it("la severidad declara su BASE: un eje solo no es una evaluación de riesgo",()=>{
  for(const h of hazards){
   expect(h.severityBasis,`${h.id}: severidad sin base declarada`).toBeTruthy();
   expect(h.severityBasis!.length,`${h.id}: la base debe explicar de dónde sale`).toBeGreaterThan(60);
  }
 });
 it("el hueco de la probabilidad está DECLARADO, no silencioso, y no se inventa una cifra",()=>{
  for(const h of hazards){
   expect(h.probability,`${h.id}: sin campo de probabilidad`).toBeTruthy();
   // Si algún día se determina, tendrá un valor; lo que no puede volver a pasar es que el campo no exista.
   if(/PENDIENTE/i.test(h.probability!)){
    expect(h.riskClass,`${h.id}: sin probabilidad no puede haber clase de riesgo`).toMatch(/NO EVALUADO/i);
    expect(h.residualRiskAcceptance,`${h.id}: la aceptación de riesgo residual debe nombrar a quién le toca`).toMatch(/dueno|dueño/i);
   }
  }
 });
 it("todo control citado por un peligro existe en el catálogo",()=>{
  const ids=new Set(controls.map(c=>c.id));
  const huerfanos:string[]=[];
  for(const h of hazards)for(const c of h.controls)if(!ids.has(c))huerfanos.push(`${h.id} -> ${c}`);
  expect(huerfanos,"peligro que declara un control inexistente").toEqual([]);
 });
 it("TODA verificación de un control resuelve a un fichero que existe (R09-026)",()=>{
  // Éste es el corazón del hallazgo: un control «verificado» por una etiqueta que nadie resuelve no está verificado.
  const problemas:string[]=[];
  for(const c of controls){
   expect(c.verification.length,`${c.id} sin verificación`).toBeGreaterThan(0);
   for(const v of c.verification){
    const ruta=rutaDe(v);
    if(!ruta.includes("/")){problemas.push(`${c.id}: «${v}» es una etiqueta sin ruta: nadie la resuelve`);continue;}
    if(!fs.existsSync(ruta))problemas.push(`${c.id}: «${v}» no existe en el árbol`);
   }
  }
  expect(problemas,"verificación de control que no resuelve a un artefacto ejecutable").toEqual([]);
 });
 it("cada peligro tiene al menos un control con verificación EJECUTADA por el gate",()=>{
  // Un control preventivo cuyo único respaldo fuera un documento no detecta nada. Al menos una verificación de cada
  // peligro tiene que ser una prueba (`tests/`) o una prueba en vivo (`scripts/`), que es lo que el gate corre.
  const porId=new Map(controls.map(c=>[c.id,c]));
  const sinEjecutable:string[]=[];
  for(const h of hazards){
   const ejecutable=h.controls.some(id=>(porId.get(id)?.verification??[]).some(v=>{
    const r=rutaDe(v);return r.startsWith("tests/")||r.startsWith("scripts/");
   }));
   if(!ejecutable)sinEjecutable.push(h.id);
  }
  expect(sinEjecutable,"peligro sin ningún control verificado por algo que se ejecute").toEqual([]);
 });
 it("la regla de la evaluación de riesgo está escrita y dice qué falta",()=>{
  expect(fs.existsSync(REGLA),"falta docs/compliance/evaluacion-de-riesgo.md").toBe(true);
  const b=fs.readFileSync(REGLA,"utf8");
  expect(b,"debe decir que no se inventan probabilidades").toMatch(/no se inventaron probabilidades|No se inventaron/i);
  expect(b,"debe remitir la aceptación de riesgo a la lista única").toMatch(/ADR-0300/);
  expect(b,"debe citar la norma de gestión de riesgo").toMatch(/ISO 14971/);
 });
});
