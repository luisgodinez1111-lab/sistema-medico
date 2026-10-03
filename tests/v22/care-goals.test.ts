import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{CARE_GOALS,goalFor,INDIVIDUALIZATION_NOTICE}from"../../packages/care-goals/src";
// Auditoría 2026-09-19, anexo R05a (R05a-F01) — metas de tendencia con fuente, población e individualización.
//
// Las metas estaban ESCRITAS EN LA VISTA: `metric("HbA1c","Meta < 7%",…)`, «Meta < 130/80», «Meta < 25». Sin fuente y, lo
// que importa más, **sin población**: se presentaban como LA meta de cualquier paciente.
//
// No es un problema de estilo. Una HbA1c < 7 % es razonable para la mayoría de los adultos no embarazados y NO lo es para
// un anciano frágil, con hipoglucemias graves previas, comorbilidad avanzada o esperanza de vida limitada: ahí el control
// estricto AUMENTA el riesgo de hipoglucemia grave. Mostrar «Meta < 7 %» en la pantalla de ese paciente empuja a una
// conducta que puede dañarlo.
// (Fase 2) El Plan de cuidados es ahora un submenú del Expediente; su sección es un form de meta LIBRE (el médico la
// escribe), sin presentar metas universales como hecho.
const VISTA="apps/web/app/workspace/views/exp.tsx";

describe("metas del plan de cuidado (R05a-F01)",()=>{
 it("cada meta declara fuente, población e individualización",()=>{
  expect(CARE_GOALS.length).toBeGreaterThanOrEqual(4);
  for(const g of CARE_GOALS){
   expect(g.source.length,`${g.metric}: sin fuente`).toBeGreaterThan(30);
   expect(g.appliesTo.length,`${g.metric}: sin población declarada`).toBeGreaterThan(20);
   expect(g.individualizeWhen.length,`${g.metric}: ninguna condición de individualización`).toBeGreaterThan(0);
   for(const c of g.individualizeWhen)expect(c.length,`${g.metric}: condición vacía`).toBeGreaterThan(20);
  }
 });
 it("la HbA1c advierte del anciano frágil y de la hipoglucemia, que es el daño real",()=>{
  // La invariante clínica del hallazgo: si esta advertencia desaparece, la meta vuelve a presentarse como universal.
  const g=goalFor("HbA1c")!;
  const texto=g.individualizeWhen.join(" ").toLowerCase();
  expect(texto).toMatch(/frágil|fragil|mayor/);
  expect(texto).toMatch(/hipoglucemia/);
  expect(texto,"el embarazo tiene metas propias y más estrictas").toMatch(/embarazo/);
 });
 it("el IMC advierte que no aplica a menores de 18, que usan percentiles",()=>{
  const g=goalFor("IMC")!;
  expect(g.appliesTo+g.individualizeWhen.join(" ")).toMatch(/percentil/i);
 });
 it("el peso NO declara una meta numérica, porque no existe una universal",()=>{
  // Inventarle un peso objetivo sería exactamente el defecto que el hallazgo describe.
  const g=goalFor("Peso")!;
  expect(g.meetsDefault).toBeNull();
 });
 it("los predicados de «en meta» coinciden con la meta declarada",()=>{
  expect(goalFor("HbA1c")!.meetsDefault!(6.9)).toBe(true);
  expect(goalFor("HbA1c")!.meetsDefault!(7.0)).toBe(false);
  expect(goalFor("IMC")!.meetsDefault!(24.9)).toBe(true);
  expect(goalFor("IMC")!.meetsDefault!(18.4),"el IMC tiene cota INFERIOR: el bajo peso no está «en meta»").toBe(false);
  expect(goalFor("Presión arterial")!.meetsDefault!(129)).toBe(true);
 });
 it("la sección del expediente NO presenta metas universales como hecho (la meta la escribe el médico)",()=>{
  const src=fs.readFileSync(VISTA,"utf8");
  // La sección Plan del expediente usa un campo de meta LIBRE: no vuelve a escribir una meta universal como afirmación.
  for(const literal of ['"Meta < 7%"','"Meta < 130/80"','"Meta < 25"'])
   expect(src.includes(literal),`la sección presenta una meta universal como hecho: ${literal}`).toBe(false);
  // El módulo care-goals (con fuente, población e individualización) sigue disponible y probado arriba; su nota deja claro
  // que la meta del paciente la fija su médico.
  expect(INDIVIDUALIZATION_NOTICE).toMatch(/su médico|su medico/i);
 });
});
