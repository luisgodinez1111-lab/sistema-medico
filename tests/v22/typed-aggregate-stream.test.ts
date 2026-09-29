import{describe,it,expect}from"vitest";
import fs from "node:fs";
import path from "node:path";
import{toHttpError}from"../../apps/web/lib/http-errors";
import{runtimeBlock}from"./_runtime-src";
// Porte del hallazgo D4 (un comando nunca escribe en el stream de OTRO tipo de agregado). La prueba en vivo con Postgres real
// está en scripts/v22/live-aggregate-stream-isolation-proof.mts y la carrera del kernel en live-aggregate-kernel-race-proof.mts;
// aquí se fija que la regla no pueda volver por la puerta de atrás: lecturas sin tipo en código cableado o la guarda del
// kernel movida antes de reclamar la versión (TOCTOU).
const walk=(dir:string):string[]=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>{
 const p=path.join(dir,d.name);
 return d.isDirectory()?walk(p):/\.(ts|tsx)$/.test(d.name)?[p]:[];
});
const UNTYPED=/\b(readAggregateEvents|readEncounterEvents)\(/;
describe("lectura tipada de streams de agregado (porte D4)",()=>{
 it("ningún caso de uso cableado, ni la fábrica, ni ninguna ruta lee un stream sin tipo",()=>{
  // Solo los módulos del registro NOT_WIRED (sin ruta; su retiro es decisión del dueño) conservan la lectura anterior.
  const notWired=new Set((JSON.parse(fs.readFileSync("docs/adjudication/not-wired-registry.json","utf8")) as{modules:{module:string}[]}).modules.map(m=>path.join("apps/web/lib",`${m.module}.ts`)));
  const lib=fs.readdirSync("apps/web/lib").filter(f=>f.endsWith(".ts")).map(f=>path.join("apps/web/lib",f));
  const wired=lib.filter(f=>(f.endsWith("-lifecycle.ts")||f.endsWith("lifecycle-factory.ts"))&&!notWired.has(f));
  expect(wired.length).toBeGreaterThanOrEqual(27);
  expect(wired.filter(f=>UNTYPED.test(fs.readFileSync(f,"utf8")))).toEqual([]);
  expect(walk("apps/web/app").filter(f=>UNTYPED.test(fs.readFileSync(f,"utf8")))).toEqual([]);
 });
 it("readAggregateStream filtra por tipo: selecciona aggregate_type, valida el id y un stream mezclado es INVARIANT_VIOLATION",()=>{
  const body=runtimeBlock("readAggregateStream");
  expect(body).toMatch(/select sequence,aggregate_type,payload from clinical_events/);
  expect(body).toContain("isAggregateId(aggregateId)");
  expect(body).toContain("genesisIs(rows,aggregateType)");
  expect(body).toMatch(/new ClinicalError\("INVARIANT_VIOLATION"/);
  expect(body).toContain("withTenantTx(");
 });
 it("readEncounter solo sirve encuentros y un id no-uuid no llega a la base",()=>{
  const body=runtimeBlock("readEncounter");
  const guard=body.indexOf("if(!isAggregateId(encounterId))return null");
  expect(guard).toBeGreaterThan(-1);
  expect(guard).toBeLessThan(body.indexOf("withTenantTx("));
  expect(body).toContain('if(!genesisIs(events,"Encounter"))return null');
 });
 it("la guarda del kernel corre DESPUÉS de reclamar la versión y ANTES de escribir el evento (sin TOCTOU)",()=>{
  const kernel=fs.readFileSync("packages/atomic-clinical-transaction-v3/src/index.ts","utf8");
  const orden=[kernel.indexOf("if(preflight)await preflight(tx)"),kernel.indexOf("insert into aggregate_versions"),kernel.indexOf("throw Error('AGGREGATE_TYPE_MISMATCH')"),kernel.indexOf("insert into clinical_events")];
  for(const i of orden)expect(i).toBeGreaterThan(-1);
  expect(orden[1]).toBeGreaterThan(orden[0]!);expect(orden[2]).toBeGreaterThan(orden[1]!);expect(orden[3]).toBeGreaterThan(orden[2]!);
 });
 it("el rechazo del kernel por tipo ajeno es 404 NOT_FOUND (para ese comando el agregado no existe), no 500",()=>{
  const h=toHttpError(new Error("AGGREGATE_TYPE_MISMATCH"));
  expect(h.status).toBe(404);
  expect(h.body.error.code).toBe("NOT_FOUND");
 });
});
