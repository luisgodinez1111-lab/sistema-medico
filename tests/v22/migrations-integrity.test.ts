import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{readMigrationFiles,stripOwnTransaction,buildManifest,manifestDrift,createdTables,retiredTables,MIGRATION_FILE_RE}from"../../packages/db-migrations/src";
// Auditoría 2026-09-19 (P-06, D-05, D-07, D-08) — las migraciones son un artefacto controlado, no una carpeta de SQL suelto.
const files=readMigrationFiles();
describe("db/migrations — integridad",()=>{
 it("nombres NNNN_snake_case.sql, versiones consecutivas desde 0001 y sin huecos",()=>{
  expect(files.length).toBeGreaterThanOrEqual(20);
  files.forEach((f,i)=>{expect(f.filename,f.filename).toMatch(MIGRATION_FILE_RE);expect(Number(f.version),f.filename).toBe(i+1);});
 });
 it("el manifiesto cubre TODAS las migraciones con su sha256 actual (D-08: el v17 cubría 13 de 18)",()=>{
  const manifest=JSON.parse(fs.readFileSync("db/migrations/manifest.json","utf8"));
  expect(manifestDrift(manifest,files)).toEqual({missing:[],changed:[],extra:[]});
  expect(buildManifest(files)).toEqual(manifest);
 });
 it("ninguna migración usa CREATE INDEX CONCURRENTLY (no cabe en la transacción del migrador)",()=>{
  for(const f of files)expect(/CONCURRENTLY/i.test(f.body.replace(/--.*$/gm,"")),f.filename).toBe(false);
 });
 it("BEGIN;/COMMIT; propios van en líneas sueltas y emparejados; el migrador los retira sin tocar los bloques plpgsql",()=>{
  for(const f of files){
   const b=(f.body.match(/^\s*BEGIN\s*;\s*$/gim)??[]).length,c=(f.body.match(/^\s*COMMIT\s*;\s*$/gim)??[]).length;
   expect(b,f.filename).toBe(c);
   const stripped=stripOwnTransaction(f.body);
   expect(/^\s*(BEGIN|COMMIT)\s*;\s*$/im.test(stripped),f.filename).toBe(false);
   expect((stripped.match(/DO \$\$/g)??[]).length,f.filename).toBe((f.body.match(/DO \$\$/g)??[]).length); // bloques intactos
  }
 });
 // Lote 12e: `createdTables` escaneaba el cuerpo CRUDO, así que un comentario que mencionara «CREATE TABLE IF NOT EXISTS»
 // —lo hace la 0020 al explicar el hallazgo D-05— devolvía la tabla fantasma `if`. `db:migrate baseline` EXIGE que exista
 // toda tabla de esa lista antes de registrar nada, de modo que el fantasma rompía el baseline: el procedimiento
 // documentado para la base de producción, migrada a mano hasta 0018. Nadie lo había ejecutado desde que la 0020 existe.
 it("createdTables ignora los comentarios y tolera el espaciado (ningún nombre fantasma)",()=>{
  for(const f of files)for(const t of createdTables(f.body))
   expect(/^[a-z][a-z0-9_]*$/.test(t)&&!["if","not","exists","table"].includes(t),`${f.filename}: nombre de tabla inverosímil «${t}»`).toBe(true);
  expect(createdTables("-- ejemplo: CREATE TABLE IF NOT EXISTS fantasma\nCREATE TABLE  IF NOT EXISTS real_x(id int);")).toEqual(["real_x"]);
  expect(createdTables("/* CREATE TABLE comentada(x int) */\nCREATE TABLE\n  otra(y int);")).toEqual(["otra"]);
 });
 it("no hay NUEVAS colisiones de nombre de tabla entre migraciones (D-05); las dos heredadas están documentadas en 0020",()=>{
  const owners=new Map<string,string[]>();
  for(const f of files)for(const t of new Set(createdTables(f.body)))owners.set(t,[...(owners.get(t)??[]),f.version]);
  const collisions=Object.fromEntries([...owners].filter(([,v])=>v.length>1));
  expect(collisions).toEqual({release_evidence:["0005","0010"],projection_checkpoints:["0007","0011"]});
  const m20=files.find(f=>f.version==="0020")!.body;
  expect(m20).toMatch(/COMMENT ON TABLE release_evidence/);expect(m20).toMatch(/COMMENT ON TABLE projection_checkpoints/);
 });
 it("0020 cierra las seis tablas en denegación total y aísla las dos heredadas (D-04, D-01)",()=>{
  const m20=files.find(f=>f.version==="0020")!.body;
  for(const t of["access_decisions","aggregate_snapshots","ai_execution_receipts","break_glass_events","clinical_amendments","patient_state_projection"])expect(m20,t).toContain(`'${t}'`);
  expect(m20).toMatch(/ALTER TABLE audit_ledger\s+ENABLE ROW LEVEL SECURITY/);expect(m20).toMatch(/ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY/);
  expect(m20).toMatch(/REVOKE ALL ON audit_ledger, idempotency_keys FROM medical_os_runtime/);
 });
});

// Auditoría 2026-09-19, anexo R06 (R06-17) — EL ESQUEMA VIGENTE SE DERIVA DE LAS MIGRACIONES, NO SE CUENTA A MANO.
//
// EL HALLAZGO, encontrado al ejecutar: `live-rls-every-table-proof` tenía dos umbrales escritos a mano (`>=35` tablas con RLS,
// `>=22` tablas con aislamiento ejercitado) y los dos fallaban contra una base recién migrada, que da 33. El número no medía
// el esquema: medía el clúster contra el que se calibró. Un umbral que se recalibra cada vez que falla deja de comprobar algo.
describe("retiredTables: las tablas retiradas del esquema vigente se leen del SQL (R06-17)",()=>{
 it("devuelve los seis nombres ORIGEN que la 0028 retira, y todos los crea alguna migración",()=>{
  const retiradas=[...new Set(files.flatMap(f=>retiredTables(f.body)))];
  expect(retiradas.sort()).toEqual(["break_glass_events","break_glass_reviews","patient_state_projection",
   "projection_aggregate_checkpoints","projection_checkpoints","release_evidence"]);
  // Si una «retirada» no la creara ninguna migración, el nombre estaría mal escrito y la resta sería silenciosamente inútil.
  const creadas=new Set(files.flatMap(f=>createdTables(f.body)));
  expect(retiradas.filter(t=>!creadas.has(t)),"tabla retirada que ninguna migración crea").toEqual([]);
 });
 it("no confunde un ARRAY con otro propósito: solo cuenta si el bucle construye el sufijo de retiro",()=>{
  expect(retiredTables("DO $$ BEGIN FOREACH t IN ARRAY ARRAY['a','b'] LOOP EXECUTE 'ANALYZE '||t; END LOOP; END $$;")).toEqual([]);
  expect(retiredTables("destino := t||'_retirada_0099'; FOREACH t IN ARRAY ARRAY['a','b'] LOOP")).toEqual(["a","b"]);
  expect(retiredTables("-- destino := t||'_retirada_0099' con ARRAY['comentada']"),"los comentarios no cuentan").toEqual([]);
 });
 it("el esquema vigente es lo creado menos lo retirado, y cuadra con las tablas que el repo declara",()=>{
  const creadas=new Set(files.flatMap(f=>createdTables(f.body)));
  const retiradas=new Set(files.flatMap(f=>retiredTables(f.body)));
  const vigentes=[...creadas].filter(t=>!retiradas.has(t));
  expect(creadas.size).toBeGreaterThan(vigentes.length); // hubo retiro
  expect(vigentes.length).toBe(creadas.size-retiradas.size);
 });
 it("la prueba en vivo de RLS ya no lleva umbrales escritos a mano",()=>{
  // Es la garantía de que el arreglo no se deshace: si alguien vuelve a poner `>=N`, este test lo dice.
  const src=fs.readFileSync("scripts/v22/live-rls-every-table-proof.mts","utf8")
   .split("\n").filter(l=>!l.trimStart().startsWith("//")&&!l.trimStart().startsWith("--")).join("\n");
  expect(/length\s*>=\s*\d+/.test(src),"umbral numérico a mano en la prueba de RLS").toBe(false);
  expect(src,"el techo del inventario tiene que venir de las migraciones").toContain("vigentes.length");
  // Y que sigue exigiendo que TODA tabla con RLS se ejercite o esté declarada, sin saco silencioso.
  expect(src).toContain("UNDECLARED_NON_INSERTABLE");
  expect(src).toContain("OBSOLETE_NON_INSERTABLE_DECLARATION");
  expect(src).toMatch(/probadas\.length===conRls\.length-noProbadas\.length/);
 });
});
