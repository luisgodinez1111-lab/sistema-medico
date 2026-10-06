import{describe,it,expect}from"vitest";
import fs from "node:fs";
import{runtimeFiles}from"./_runtime-src";
// Auditoría 2026-09-19, anexo R01 (R01-001): `apps/web/lib/clinical-runtime.ts` era un god-module de 954 líneas y 93
// exports que mezclaba la conexión a Postgres, la ejecución de comandos y más de sesenta read-models de todos los
// dominios clínicos. Estas pruebas impiden que vuelva a crecer así y fijan la separación de responsabilidades.
const FACHADA="apps/web/lib/clinical-runtime.ts";
// R03-10: los lectores de laboratorio salieron de `patient-facts` a su propio dominio `lab-facts` cuando el guardián
// de god-module avisó de que patient-facts pasaba de 300 líneas. El guardián tenía razón: son dos responsabilidades.
// R06-20: las piezas de SQL compartidas por los read-models salieron a  cuando el guardián avisó de
// que  pasaba de 300 líneas. Otra vez tenía razón: los joins son una responsabilidad propia, con su medición.
// Auditoría clínica multiespecialidad (06-oct-2026): `encounters` salió de `records` cuando el guardián avisó de que
// `records` pasaba de 300 líneas al añadir el lector de la nota. Tercera vez que acierta: `records` lee el expediente,
// `encounters` lee la consulta. El guardián no se relaja — se parte el fichero.
const DOMINIOS=["connection","command","pagination","patients","patient-facts","lab-facts","registries","read-model-joins","office","analytics","registry-summaries","records","encounters"];
const leer=(f:string):string=>fs.readFileSync(f,"utf8");
const lineas=(f:string):number=>leer(f).split("\n").length;

describe("el runtime clínico está partido por dominio (R01-001)",()=>{
 it("la fachada solo reexporta: nada de lógica ni de SQL",()=>{
  const src=leer(FACHADA);
  expect(lineas(FACHADA)).toBeLessThan(60);
  expect(src).not.toMatch(/\bpostgres\(/);
  expect(src).not.toMatch(/\bselect\b/i);
  expect(src).not.toMatch(/function\s+\w+\s*\(/);
  for(const l of src.split("\n"))if(l.trim()&&!l.trim().startsWith("//"))expect(l,l).toMatch(/^export\s*(?:type)?\s*\{/);
 });
 it("existe un módulo por dominio y ninguno vuelve a ser un god-module",()=>{
  for(const d of DOMINIOS){
   const f=`apps/web/lib/runtime/${d}.ts`;
   expect(fs.existsSync(f),f).toBe(true);
   expect(lineas(f),`${d} debe seguir siendo legible de una sentada`).toBeLessThan(300);
  }
 });
 it("solo el módulo de conexión abre conexiones y transacciones",()=>{
  for(const f of runtimeFiles()){
   const src=leer(f);
   if(f.endsWith("runtime/connection.ts"))continue;
   expect(src,`${f} no debe crear el pool`).not.toMatch(/\bpostgres\(/);
   expect(src,`${f} no debe abrir transacción`).not.toMatch(/\.begin\(/);
   expect(src,`${f} no debe fijar el contexto de RLS`).not.toContain("set_config('app.tenant_id'");
  }
 });
 it("todo read-model lee dentro de withTenantTx (el contexto de RLS no es opcional)",()=>{
  for(const d of ["patients","patient-facts","registries","analytics","records","encounters"]){
   const src=leer(`apps/web/lib/runtime/${d}.ts`);
   const consultas=(src.match(/await tx`/g)??[]).length;
   const aperturas=(src.match(/withTenantTx\(ctx,/g)??[]).length;
   expect(consultas,`${d} tiene consultas`).toBeGreaterThan(0);
   expect(aperturas,`${d} abre transacción con contexto`).toBeGreaterThan(0);
  }
 });
 it("la superficie pública no cambió al partir el fichero (los ~100 importadores siguen valiendo)",()=>{
  // Si alguien saca un export de la fachada, esta cuenta baja y el test avisa: el corte fue interno, no un cambio de API.
  const exports=[...leer(FACHADA).matchAll(/export\s*(?:type)?\s*\{([^}]*)\}/g)].flatMap(m=>m[1]!.split(",").map(s=>s.trim())).filter(Boolean);
  expect(new Set(exports).size).toBeGreaterThanOrEqual(90);
 });
 it("el codemod que hizo la partición queda como registro del método",()=>{
  expect(fs.existsSync("scripts/refactor/split-clinical-runtime.mts")).toBe(true);
 });
});
