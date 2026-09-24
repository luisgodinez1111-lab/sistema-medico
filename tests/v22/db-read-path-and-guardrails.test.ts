import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{assertTenantContext,isUuid}from"../../packages/tenant-context/src";
import{assertProductionImport,deprecatedRuntimePackages}from"../../packages/architecture-boundary/src";
// Auditoría 2026-09-19, anexo R06 — R06-13 (constraint NOT VALID nunca validada), R06-20/21/22 (caminos calientes sin
// índice, incluido el GATE DE FIRMA), R06-24 (fechas comparadas como texto), R06-26 (guardarraíl sin cablear) y
// R06-29 (el contexto de tenant no validaba el formato del UUID).
const MIG="db/migrations/0025_read_path_indexes_and_pending_constraint.sql";
const mig=()=>fs.readFileSync(MIG,"utf8");

describe("índices de los caminos calientes (R06-20/21/22)",()=>{
 it("la migración indexa la expresión EXACTA del predicado del analito",()=>{
  // Un índice sobre `payload->>'analyte'` no cubre `upper(payload->>'analyte')=upper($1)`: tiene que ser la expresión.
  expect(mig()).toContain("(upper(payload->>'analyte'))");
  expect(mig()).toContain("WHERE aggregate_type = 'DiagnosticResult'");
 });
 it("indexa las dos mitades del gate de firma (resultados/vitales críticos y su obligación)",()=>{
  expect(mig()).toContain("(payload->>'sourceVitalId')");
  expect(mig()).toContain("WHERE aggregate_type = 'ClinicalObligation'");
  expect(mig()).toContain("clinical_events_critical_by_patient_idx");
  expect(mig()).toContain("WHERE payload->>'critical' = 'true'");
 });
 it("la constraint pendiente se valida, y de forma idempotente",()=>{
  expect(mig()).toContain("VALIDATE CONSTRAINT obligations_owner_due_ck");
  expect(mig()).toContain("NOT c.convalidated");   // no falla si ya estaba validada
 });
 it("la migración es idempotente y transaccional como el resto",()=>{
  expect(mig()).toContain("BEGIN;");expect(mig()).toContain("COMMIT;");
  for(const m of mig().matchAll(/CREATE INDEX(?! IF NOT EXISTS)/g))expect(m[0],"índice sin IF NOT EXISTS").toBe("");
  // Ninguna SENTENCIA usa CONCURRENTLY (las migraciones corren en transacción); el comentario que lo explica sí lo nombra.
  const sentencias=mig().split("\n").filter(l=>!l.trim().startsWith("--")).join("\n");
  expect(sentencias).not.toContain("CONCURRENTLY");
 });
 it("está en el manifiesto de migraciones",()=>{
  const man=JSON.parse(fs.readFileSync("db/migrations/manifest.json","utf8")) as {migrations:{file:string}[]}|{file:string}[];
  const lista=Array.isArray(man)?man:man.migrations;
  expect(lista.some(m=>m.file.includes("0025_read_path_indexes"))).toBe(true);
 });
});

describe("la agenda compara fechas como timestamptz (R06-24)",()=>{
 it("el predicado castea, y el comentario ya no afirma que el texto basta",()=>{
  const src=fs.readFileSync("apps/web/lib/runtime/registries.ts","utf8");
  expect(src).toContain("(a.payload->>'startAt')::timestamptz");
  expect(src).not.toContain("Comparación por string ISO (orden lexicográfico correcto)");
 });
});

describe("el contexto de base de datos valida el formato del UUID (R06-29)",()=>{
 const ok={tenantId:"11111111-1111-1111-1111-111111111111",actorId:"22222222-2222-2222-2222-222222222222",actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:"req-1"};
 it("acepta un contexto válido",()=>{expect(()=>assertTenantContext(ok)).not.toThrow();});
 it("rechaza un tenantId malformado ANTES de tocar la base, nombrando el campo",()=>{
  expect(()=>assertTenantContext({...ok,tenantId:"tenant-1"})).toThrow(/tenantId no es un UUID/);
  expect(()=>assertTenantContext({...ok,actorId:"quien-sea"})).toThrow(/actorId no es un UUID/);
 });
 it("sigue rechazando los campos vacíos y un actorType desconocido",()=>{
  expect(()=>assertTenantContext({...ok,purpose:""})).toThrow(/Missing database context: purpose/);
  expect(()=>assertTenantContext({...ok,actorType:"ROBOT" as never})).toThrow(/actorType/);
 });
 it("isUuid distingue el formato, no solo la longitud",()=>{
  expect(isUuid("11111111-1111-1111-1111-111111111111")).toBe(true);
  expect(isUuid("11111111111111111111111111111111")).toBe(false);
  expect(isUuid("zzzzzzzz-1111-1111-1111-111111111111")).toBe(false);
 });
});

describe("el guardarraíl de imports deprecados está CABLEADO (R06-26)",()=>{
 it("ningún fichero de producción importa un paquete deprecado",()=>{
  // El anexo: «el guardarraíl no se invoca fuera de su propio test unitario». Ahora recorre el código real.
  const dirs=["apps/web/lib","apps/web/app","packages"];
  const archivos:string[]=[];
  const walk=(d:string)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   const p=`${d}/${e.name}`;
   if(e.isDirectory()){if(e.name!=="node_modules"&&!e.name.startsWith("."))walk(p);}
   else if(/\.(ts|tsx)$/.test(e.name)&&!p.includes("/architecture-boundary/"))archivos.push(p);}};
  for(const d of dirs)if(fs.existsSync(d))walk(d);
  const infractores:string[]=[];
  for(const f of archivos){
   const src=fs.readFileSync(f,"utf8");
   for(const dep of deprecatedRuntimePackages)
    if(new RegExp(`from"[^"]*packages/${dep}/`).test(src)||new RegExp(`from"\\.\\./${dep}/`).test(src))infractores.push(`${f} -> ${dep}`);
  }
  expect(infractores).toEqual([]);
  expect(archivos.length,"el guardarraíl no encontró código que revisar").toBeGreaterThan(200);
 });
 it("y sigue rechazando una ruta deprecada explícita",()=>{
  expect(()=>assertProductionImport("/repo/packages/atomic-clinical-transaction-v2/src/index.ts")).toThrow(/DEPRECATED_RUNTIME_IMPORT/);
  expect(assertProductionImport("/repo/packages/atomic-clinical-transaction-v3/src/index.ts")).toBe(true);
 });
});

describe("la evidencia del restore drill no se autodeclara (R06-16)",()=>{
 it("el rango de migraciones se genera del disco, no de una cadena fija",()=>{
  const src=fs.readFileSync("scripts/v22/restore-drill.mts","utf8");
  expect(src,"el rango «0001..0017» estaba escrito a mano y se quedó desalineado del código real").not.toContain("0001..0017");
 });
});

// Auditoría 2026-09-19, anexo R06 (R06-19): el payload clínico entraba a jsonb SIN validar. Estaba tipado como `unknown`
// y se forzaba a `never` con un cast justo antes del INSERT, en una tabla append-only.
describe("validación del payload antes de persistir (R06-19)",()=>{
 it("el KERNEL exige lo estructural: objeto JSON, `kind` presente, serializable y acotado",async()=>{
  const{assertClinicalPayload,MAX_PAYLOAD_BYTES}=await import("../../packages/atomic-clinical-transaction-v3/src");
  const c=(payload:unknown)=>({aggregateType:"VitalSign",eventType:"VITAL_RECORDED",payload});
  expect(()=>assertClinicalPayload(c({kind:"RECORDED",patientId:"p"}))).not.toThrow();
  expect(()=>assertClinicalPayload(c(null))).toThrow(/debe ser un objeto JSON/);
  expect(()=>assertClinicalPayload(c([{kind:"RECORDED"}]))).toThrow(/un arreglo/);
  expect(()=>assertClinicalPayload(c("RECORDED"))).toThrow(/string/);
  expect(()=>assertClinicalPayload(c({patientId:"p"}))).toThrow(/falta el discriminador/);
  expect(()=>assertClinicalPayload(c({kind:"  "}))).toThrow(/falta el discriminador/);
  // Referencia circular: no es serializable, así que no puede escribirse.
  const circular:Record<string,unknown>={kind:"RECORDED"};circular["self"]=circular;
  expect(()=>assertClinicalPayload(c(circular))).toThrow(/no es serializable/);
  // Cota de tamaño: el evento es inmutable y toda lectura clínica recorre esa tabla.
  expect(()=>assertClinicalPayload(c({kind:"RECORDED",relleno:"x".repeat(MAX_PAYLOAD_BYTES)}))).toThrow(/excede el máximo/);
 });
 it("la APLICACIÓN exige la forma del dominio por (aggregateType, kind)",async()=>{
  const{assertPayloadSchema,PAYLOAD_SCHEMAS,payloadSchemaCount}=await import("../../apps/web/lib/payload-schemas");
  const uuid="11111111-1111-1111-1111-111111111111";
  const vital=(p:Record<string,unknown>)=>({aggregateType:"VitalSign",eventType:"VITAL_RECORDED",payload:p});
  // Completo: pasa.
  expect(()=>assertPayloadSchema(vital({kind:"RECORDED",patientId:uuid,vitalType:"HR",value:"72",unit:"lpm",canonicalValue:"72",canonicalUnit:"lpm"}))).not.toThrow();
  // Sin unidad canónica (el defecto R03-09 escrito en la cadena): se rechaza.
  expect(()=>assertPayloadSchema(vital({kind:"RECORDED",patientId:uuid,vitalType:"HR",value:"72",unit:"lpm"}))).toThrow(/no cumple su esquema/);
  // patientId que no es UUID: el caso que la columna uuid descubriría dentro de Postgres.
  expect(()=>assertPayloadSchema(vital({kind:"RECORDED",patientId:"paciente-1",vitalType:"HR",value:"72",unit:"lpm",canonicalValue:"72",canonicalUnit:"lpm"}))).toThrow(/patientId/);
  // Un par SIN esquema declarado no se rechaza (el kernel ya exigió lo estructural).
  expect(()=>assertPayloadSchema({aggregateType:"Surgery",eventType:"X",payload:{kind:"PLANNED"}})).not.toThrow();
  // El registro cubre los eventos fundacionales de los agregados con consecuencia clínica.
  for(const k of["VitalSign::RECORDED","DiagnosticResult::RECEIVED","Medication::PROPOSED","Consent::PRESENTED","Patient::REGISTERED","ClinicalObligation::CREATED"])
   expect(PAYLOAD_SCHEMAS[k],`falta el esquema de ${k}`).toBeDefined();
  expect(payloadSchemaCount()).toBeGreaterThanOrEqual(16);
 });
 it("el mensaje dice POR QUÉ no se escribe (la cadena es inmutable)",async()=>{
  const{assertPayloadSchema}=await import("../../apps/web/lib/payload-schemas");
  try{assertPayloadSchema({aggregateType:"Consent",eventType:"CONSENT_PRESENTED",payload:{kind:"PRESENTED",documentHash:"corto"}});expect.unreachable();}
  catch(e){expect(String((e as Error).message)).toMatch(/inmutable/);}
 });
 it("está cableada en el camino por el que pasan TODOS los comandos",()=>{
  const src=fs.readFileSync("apps/web/lib/runtime/command.ts","utf8");
  expect(src).toContain("assertPayloadSchema(command)");
  const kernel=fs.readFileSync("packages/atomic-clinical-transaction-v3/src/index.ts","utf8");
  expect(kernel).toContain("assertClinicalPayload(c)");
  expect(kernel).toMatch(/assertTenantContext\(ctx\);assertClinicalPayload\(c\)/); // antes de abrir la transacción
 });
});
