import{describe,it,expect}from"vitest";
import fs from "node:fs";
import{isVaccineCode,VACCINE_CODES,vaccineComponents,SCHEDULE}from"../../packages/immunization-schedule/src";
import{ORDER_SLA_HOURS,ORDER_PRIORITIES}from"../../apps/web/lib/order-lifecycle";
import{foldOrder}from"../../packages/order-fold/src";
import{foldPatient}from"../../packages/patient-fold/src";
// Auditoría 2026-09-19, anexo R02a — PAT-03 (`DECEASED` era un estado FANTASMA: declarado y consumido, pero imposible de
// producir), ORD-01 (una orden colocada sin resultado no vencía nunca y el `orderId` de un resultado no se validaba) e
// IMM-01 (`vaccineCode` era texto libre y no había cruce con alergias antes de administrar).
// La evidencia contra Postgres real está en scripts/v22/live-patient-order-vaccine-gaps-proof.mts.
const ev=(sequence:number,payload:Record<string,unknown>)=>({sequence,payload});

describe("defunción del paciente (R02a-PAT-03)",()=>{
 it("el fold alcanza DECEASED y es terminal",()=>{
  const f=foldPatient([ev(1,{kind:"REGISTERED",name:"X",birthDate:"1950-01-01"}),ev(2,{kind:"DECEASED",deceasedAt:"2026-09-20T10:00:00.000Z"})]);
  expect(f.status).toBe("DECEASED");
 });
 it("existe la ruta que lo produce (antes el estado era inalcanzable)",()=>{
  expect(fs.existsSync("apps/web/app/api/v1/patients/[patientId]/deceased/route.ts")).toBe(true);
  const handler=fs.readFileSync("apps/web/lib/patient-lifecycle.ts","utf8");
  expect(handler).toContain("handlePatientDeceased");
  expect(handler).toContain("PATIENT_DECEASED");
 });
 it("valida fecha no futura y no anterior al nacimiento, con código estable",()=>{
  const handler=fs.readFileSync("apps/web/lib/patient-lifecycle.ts","utf8");
  expect(handler).toMatch(/no puede estar en el futuro/);
  expect(handler).toContain("DECEASED_BEFORE_BIRTH");
  const errores=fs.readFileSync("apps/web/lib/http-errors.ts","utf8");
  expect(errores,"el código estable debe llegar al cliente").toMatch(/VALIDATION_ERROR:\[[^\]]*conflictReason/);
 });
 it("la causa es texto libre opcional: no se pretende codificarla ni sustituir el certificado",()=>{
  const handler=fs.readFileSync("apps/web/lib/patient-lifecycle.ts","utf8");
  expect(handler).toMatch(/cause:z\.string\(\)\.trim\(\)\.max\(500\)\.optional\(\)/);
  expect(handler).toMatch(/certificado de defunción es un\s*\/\/ *documento aparte/);
 });
});

describe("SLA de la orden clínica (R02a-ORD-01)",()=>{
 it("los plazos por urgencia son crecientes y finitos",()=>{
  expect(ORDER_PRIORITIES).toEqual(["ROUTINE","URGENT","STAT"]);
  expect(ORDER_SLA_HOURS.STAT).toBeLessThan(ORDER_SLA_HOURS.URGENT);
  expect(ORDER_SLA_HOURS.URGENT).toBeLessThan(ORDER_SLA_HOURS.ROUTINE);
  for(const p of ORDER_PRIORITIES)expect(ORDER_SLA_HOURS[p]).toBeGreaterThan(0);
 });
 it("el fold expone urgencia y vencimiento, y el último evento gana",()=>{
  const f=foldOrder([
   ev(1,{kind:"CREATED",patientId:"p",orderType:"LAB",priority:"ROUTINE"}),
   ev(2,{kind:"PLACED",priority:"URGENT",dueAt:"2026-09-24T10:00:00.000Z"}),
  ]);
  expect(f.state).toBe("ORDERED");
  expect(f.priority).toBe("URGENT");
  expect(f.dueAt).toBe("2026-09-24T10:00:00.000Z");
 });
 it("una orden sin urgencia declarada no queda sin plazo: se deriva al colocarla",()=>{
  const src=fs.readFileSync("apps/web/lib/order-lifecycle.ts","utf8");
  expect(src).toMatch(/const dueAt=b\.dueAt\?\?folded\.dueAt\?\?new Date\(Date\.parse\(b\.occurredAt\)\+ORDER_SLA_HOURS\[priority\]/);
  expect(src,"una prioridad desconocida del payload no puede dejar el plazo indefinido").toMatch(/esPrioridad\(folded\.priority\)\?folded\.priority:"ROUTINE"/);
 });
 it("existe la consulta de órdenes vencidas (sin ella el SLA no sirve de nada)",()=>{
  const src=fs.readFileSync("apps/web/lib/runtime/registries.ts","utf8");
  expect(src).toContain("export async function overdueOrders");
  expect(src).toMatch(/hoursOverdue/);
  // Auditoría R06-20: el filtro estaba en JS —`last_kind==="PLACED"` sobre TODAS las órdenes creadas de la clínica, cada
  // una con cuatro subconsultas correlacionadas—. Ahora la base devuelve solo las vencidas. La invariante es la misma
  // (solo las colocadas, no las cumplidas ni las canceladas), exigida donde ahora vive: en la consulta.
  expect(src,"solo las colocadas: el filtro tiene que estar en el SQL").toMatch(/and lk\.kind='PLACED'/);
  expect(src,"y el vencimiento comparado como fecha, no como texto").toMatch(/\(attr\.due_at\)::timestamptz\s*</);
 });
 it("el resultado valida la orden que declara y marca si estaba vinculada",()=>{
  const src=fs.readFileSync("apps/web/lib/result-lifecycle.ts","utf8");
  expect(src).toContain("ORDER_PATIENT_MISMATCH");
  expect(src).toMatch(/orderLinked:/);
 });
});

describe("catálogo de vacunas y cruce con alergias (R02a-IMM-01)",()=>{
 it("el código de vacuna sale del esquema y no es texto libre",()=>{
  expect(isVaccineCode("BCG")).toBe(true);
  expect(isVaccineCode("bcg")).toBe(true);           // se normaliza
  expect(isVaccineCode("Neumococo 13V")).toBe(false); // el nombre comercial no vale
  expect(isVaccineCode("")).toBe(false);
  const src=fs.readFileSync("apps/web/lib/immunization-lifecycle.ts","utf8");
  expect(src).toMatch(/vaccineCode:z\.string\(\)\.trim\(\)\.transform\(v=>v\.toUpperCase\(\)\)\.refine\(isVaccineCode/);
 });
 it("todo código del esquema tiene componentes DECLARADOS (ausencia ≠ sin riesgo)",()=>{
  const sinDeclarar=VACCINE_CODES.filter(c=>vaccineComponents(c).length===0);
  expect(sinDeclarar,`códigos del esquema sin componentes declarados: ${sinDeclarar.join(", ")}`).toEqual([]);
 });
 it("no se declaran componentes de vacunas que el esquema no maneja",()=>{
  const delEsquema=new Set(SCHEDULE.map(e=>e.code));
  const declarados=Object.keys(JSON.parse(JSON.stringify(
   Object.fromEntries(VACCINE_CODES.map(c=>[c,vaccineComponents(c)])))) as Record<string,string[]>);
  for(const c of declarados)expect(delEsquema.has(c),`${c} no pertenece al esquema`).toBe(true);
 });
 it("una alergia GRAVE a un componente bloquea; una leve exige confirmación justificada",()=>{
  const src=fs.readFileSync("apps/web/lib/immunization-lifecycle.ts","utf8");
  expect(src).toMatch(/severity==="SEVERE"/);
  expect(src).toMatch(/SAFETY_BLOCKED/);
  expect(src).toMatch(/SAFETY_ACK_REQUIRED/);
  expect(src).toMatch(/allergyJustification.*≥10|≥10 caracteres/);
  expect(src,"la confirmación debe quedar en el evento").toMatch(/allergyAcknowledged/);
 });
 it("el criterio clínico está escrito en el código, no solo en el tracker",()=>{
  const src=fs.readFileSync("apps/web/lib/immunization-lifecycle.ts","utf8");
  expect(src).toMatch(/no sustituye la ficha técnica del lote/);
  const cat=fs.readFileSync("packages/immunization-schedule/src/index.ts","utf8");
  expect(cat).toMatch(/huevo \(cultivo en embrión de pollo\)/);
 });
});
