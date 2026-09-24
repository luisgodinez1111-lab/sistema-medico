import{describe,it,expect}from"vitest";
import fs from "node:fs";
import{logPhiAccess,patientAccessLog}from"../../apps/web/lib/phi-access-log";
import{runtimeBlock}from"./_runtime-src";
// Auditoría 2026-09-19, anexo R01 (R01-026) y deuda D-09 — auditoría de LECTURAS de PHI.
// La evidencia contra Postgres real está en scripts/v22/live-phi-access-log-proof.mts; aquí se fijan el contrato del
// registro (qué campos lleva, qué NO lleva) y los sitios del código que están obligados a registrar.
const ctx={tenantId:"11111111-1111-4111-8111-111111111111",actorId:"22222222-2222-4222-8222-222222222222",
 actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:"33333333-3333-4333-8333-333333333333",
 sessionId:"44444444-4444-4444-8444-444444444444"};
const fakeTx=():{tx:never;consultas:{sql:string;valores:unknown[]}[]}=>{
 const consultas:{sql:string;valores:unknown[]}[]=[];
 const tx=((strings:TemplateStringsArray,...valores:unknown[])=>{consultas.push({sql:strings.join("?"),valores});return Promise.resolve([]);}) as unknown as never;
 return{tx,consultas};
};

describe("contrato del registro de accesos (R01-026)",()=>{
 it("registra actor, sesión, propósito, petición, recurso, paciente y acción",async()=>{
  const{tx,consultas}=fakeTx();
  await logPhiAccess(tx,ctx,{resourceType:"PATIENT_RECORD",resourceId:"55555555-5555-4555-8555-555555555555",patientId:"55555555-5555-4555-8555-555555555555",action:"READ"});
  expect(consultas).toHaveLength(1);
  expect(consultas[0]!.sql).toContain("insert into phi_access_log");
  expect(consultas[0]!.valores).toEqual([ctx.tenantId,ctx.actorId,ctx.sessionId,ctx.purpose,ctx.requestId,"PATIENT_RECORD","55555555-5555-4555-8555-555555555555","55555555-5555-4555-8555-555555555555","READ"]);
 });
 it("la acción por defecto es READ y un contexto sin sesión guarda null (no cadena vacía)",async()=>{
  const{tx,consultas}=fakeTx();
  const{sessionId:_omitido,...sinSesion}=ctx;
  await logPhiAccess(tx,sinSesion,{resourceType:"PATIENT_VITALS",resourceId:"66666666-6666-4666-8666-666666666666"});
  expect(consultas[0]!.valores[2]).toBeNull();
  expect(consultas[0]!.valores[7]).toBeNull();  // sin paciente conocido
  expect(consultas[0]!.valores[8]).toBe("READ");
 });
 it("nunca escribe el contenido leído: la sentencia no tiene columnas de valor clínico",async()=>{
  const{tx,consultas}=fakeTx();
  await logPhiAccess(tx,ctx,{resourceType:"CLINICAL_DOCUMENT",resourceId:"77777777-7777-4777-8777-777777777777",patientId:"55555555-5555-4555-8555-555555555555"});
  // Se inspecciona la LISTA DE COLUMNAS, no la sentencia entera (que contiene la palabra «values» de SQL).
  const columnas=/insert into phi_access_log\(([^)]*)\)/.exec(consultas[0]!.sql)?.[1]?.split(",").map(c=>c.trim())??[];
  expect(columnas.length).toBeGreaterThan(0);
  for(const c of columnas)expect(c,`columna ${c}`).not.toMatch(/content|payload|note|substance|birth|value|name|diagnos/i);
 });
 it("la consulta por paciente acota el límite (1..500) y ordena por fecha descendente",async()=>{
  const{tx,consultas}=fakeTx();
  await patientAccessLog(tx,ctx,"55555555-5555-4555-8555-555555555555",99999);
  expect(consultas[0]!.sql).toContain("order by at desc");
  expect(consultas[0]!.valores[consultas[0]!.valores.length-1]).toBe(500);
  const{tx:tx2,consultas:c2}=fakeTx();
  await patientAccessLog(tx2,ctx,"55555555-5555-4555-8555-555555555555",0);
  expect(c2[0]!.valores[c2[0]!.valores.length-1]).toBe(1);
 });
});

describe("los sitios obligados a registrar lo hacen (R01-026)",()=>{
 const bloque=runtimeBlock;
 it.each([
  ["patientDemographics","PATIENT_DEMOGRAPHICS"],
  ["patientVitals","PATIENT_VITALS"],
  ["readPatientTimeline","PATIENT_TIMELINE"],
  ["readPatientRecordRows","PATIENT_RECORD"],
  ["documentDetail","CLINICAL_DOCUMENT"],
 ])("%s registra el acceso como %s",(fn,tipo)=>{
  const src=bloque(fn);
  expect(src).toContain("logPhiAccess(tx,ctx,");
  expect(src).toContain(tipo);
 });
 it("las lecturas AGREGADAS de la clínica no registran (el registro sirve para detectar abusos, no para contar visitas)",()=>{
  for(const fn of ["readTenantOpenAggregates","allergyRegistry","problemRegistry","resultsRegistry","encounterAnalytics"])
   expect(bloque(fn),fn).not.toContain("logPhiAccess");
 });
 it("exportar e imprimir registran con su propia semántica",()=>{
  const exportar=fs.readFileSync("apps/web/app/api/v1/patients/[patientId]/export/route.ts","utf8");
  expect(exportar).toMatch(/recordPhiAccess\([\s\S]*RECORD_EXPORT[\s\S]*action:"EXPORT"/);
  const receta=fs.readFileSync("apps/web/app/api/v1/patients/[patientId]/prescription-print/route.ts","utf8");
  expect(receta).toMatch(/recordPhiAccess\([\s\S]*PRESCRIPTION[\s\S]*action:"PRINT"/);
 });
 it("la migración 0024 deja el registro append-only para la app y aislado por tenant",()=>{
  const sql=fs.readFileSync("db/migrations/0024_phi_access_log.sql","utf8");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  expect(sql).toMatch(/GRANT SELECT, INSERT ON phi_access_log TO medical_os_runtime/);
  expect(sql).not.toMatch(/GRANT[^;]*(UPDATE|DELETE)[^;]*phi_access_log/);
 });
 it("el ADR-0230 ya no afirma que «cada acceso» queda en la cadena de auditoría",()=>{
  const adr=fs.readFileSync("docs/adr/ADR-0230-modelo-de-acceso-a-pacientes.md","utf8");
  expect(adr).not.toMatch(/^- Cada acceso queda en la cadena de auditoría/m);
  expect(adr).toContain("phi_access_log");
 });
});
