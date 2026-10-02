import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{runtimeBlock}from"./_runtime-src";
// Hallazgo D2 + SQL-1 (porte a main) — guardián de las consultas de demografía del paciente. La regla (por campo, el último
// alta o enmienda que lo TRAE; `patientDemographicsOf` en packages/patient-fold) vive UNA vez en SQL, en read-model-joins,
// con el vocabulario del fold como parámetros. Antes listPatients/patientDemographics combinaban el alta con la ÚLTIMA
// enmienda, findPatientDuplicate miraba solo el alta y los registros tomaban el nombre del alta. La prueba en vivo es
// scripts/v22/live-patient-demographics-projection-proof.mts; esto fija que nadie vuelva a escribir la regla a mano.
const joins=fs.readFileSync("apps/web/lib/runtime/read-model-joins.ts","utf8");
const frag=(n:string)=>new RegExp(`export const ${n}=[\\s\\S]*?\`;\\n`).exec(joins)?.[0]??"";
describe("demografía vigente en SQL (D2, SQL-1)",()=>{
 it("la proyección usa el vocabulario del fold, campo a campo y por el último evento",()=>{
  expect(joins).toMatch(/import\{PATIENT_DEMOGRAPHIC_FIELDS,PATIENT_DEMOGRAPHIC_KINDS[^}]*\}from"[./]+packages\/patient-fold\/src"/);
  const d=frag("demografiaVigente");
  expect(d,"no se encontró demografiaVigente").not.toBe("");
  expect(d).toContain("=any(${[...PATIENT_DEMOGRAPHIC_KINDS]}::text[])");
  expect(d).toContain("kv.key=any(${[...PATIENT_DEMOGRAPHIC_FIELDS]}::text[])");
  expect(d).toMatch(/distinct on \(kv\.key\)[\s\S]*order by kv\.key, e\.sequence desc/); // el ÚLTIMO que trae cada campo
  expect(d).toMatch(/left join lateral/);                                                  // R06-20: por fila devuelta
 });
 it("el nombre de los registros es el vigente (último alta o enmienda que trae `name`), no el del alta",()=>{
  const n=frag("nombreDePaciente");
  expect(n,"no se encontró nombreDePaciente").not.toBe("");
  expect(n).toContain("=any(${[...PATIENT_DEMOGRAPHIC_KINDS]}::text[])");
  expect(n).toContain("pt.payload ? 'name'");
  expect(n).toContain("order by pt.sequence desc limit 1) pn on true");
  expect(n).toContain("pt.aggregate_type='Patient'");
  expect(n).not.toContain("'REGISTERED'");
 });
 it("listado, ficha y duplicados leen la demografía vigente; ninguna lectura combina el alta con la última enmienda",()=>{
  for(const f of ["listPatients","patientDemographics","findPatientDuplicate"]){
   const b=runtimeBlock(f);
   expect(b,f).toContain("${demografiaVigente(tx)}");
   expect(b,`${f}: coalesce(alta, última enmienda) pierde las enmiendas anteriores`).not.toMatch(/coalesce\(a\.payload/);
   expect(b,`${f}: no puede leer un campo demográfico del alta`).not.toMatch(/\br\.payload->>'(name|birthDate|sexAtBirth|curp)'/);
  }
  const dup=runtimeBlock("findPatientDuplicate");
  expect(dup).toContain("${pacientesConValor(tx,ctx.tenantId,\"curp\",q.curp,true)}");
  expect(dup).toContain("${pacientesConValor(tx,ctx.tenantId,\"birthDate\",q.birthDate)}");
 });
 it("el prefiltro SQL-1 busca en altas y enmiendas con el campo como parámetro (sin SQL crudo)",()=>{
  const p=frag("pacientesConValor");
  expect(p,"no se encontró pacientesConValor").not.toBe("");
  expect(p).toContain("field:PatientDemographicField");
  expect(p).toContain("=any(${[...PATIENT_DEMOGRAPHIC_KINDS]}::text[])");
  expect(p).toContain("c.payload->>${field}");
  expect(p).not.toContain("unsafe");
 });
 it("el resumen de pacientes con más registros usa la misma regla de nombre",()=>{
  const b=runtimeBlock("topPatientsOfRegistry");
  expect(b).toContain("${nombreDePaciente(tx,ctx.tenantId,tx`g.pid`)}");
  expect(b).not.toContain("'REGISTERED'");
 });
});
