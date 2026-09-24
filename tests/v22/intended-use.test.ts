import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{CLINICAL_USE_WARNING}from"../../apps/web/lib/calc-receipt";
// Auditoría 2026-09-19, anexo R03 (R03-35, CRÍTICA): «21 endpoints interpretan datos del paciente y emiten
// recomendaciones clínicas, y el repositorio se declara fuera del alcance de dispositivo médico sin una declaración de
// uso previsto por función». La autoexclusión era una afirmación de cumplimiento CONTRADICHA por el propio código.
const RUTAS_CALCULADORAS=["fib4","egfr","cha2ds2vasc","meld","charlson","aa-gradient","acid-base","curb65","bmi","bp-stage","news2"];
const leer=(f:string)=>fs.readFileSync(f,"utf8");

describe("declaración de uso previsto (R03-35)",()=>{
 it("la autoexclusión de dispositivo médico se RETIRÓ del registro NOM",()=>{
  const reg=JSON.parse(leer("docs/compliance/nom-applicability-register.json")) as {instruments:{id:string;status:string;addressedBy:string;evidence:string[]}[]};
  const nom241=reg.instruments.find(i=>i.id==="NOM-241-SSA1-2025")!;
  expect(nom241.addressedBy).not.toMatch(/Fuera del alcance actual/);
  expect(nom241.addressedBy).toMatch(/PENDIENTE DE DETERMINACIÓN/);
  expect(nom241.addressedBy).toMatch(/CONTRADICE el propio código/);
  expect(nom241.status).toBe("EVALUATE");          // ya no es NOT_STARTED «por diseño»
  expect(nom241.evidence).toContain("docs/compliance/intended-use-by-endpoint.md");
 });
 it("existe la tabla de uso previsto y cubre las rutas calculadoras",()=>{
  const doc=leer("docs/compliance/intended-use-by-endpoint.md");
  for(const r of RUTAS_CALCULADORAS)expect(doc,`la tabla no menciona /${r}`).toContain(`/${r}`);
  // Las cinco columnas que el anexo pidió: entrada, salida, población, quién decide, qué NO hace.
  for(const col of["Entrada","Salida","Población validada","Quién decide","Qué NO hace"])expect(doc).toContain(col);
  expect(doc).toMatch(/decisión del dueño del producto/);
 });
 it("TODA respuesta de cálculo lleva la advertencia de uso",()=>{
  for(const r of RUTAS_CALCULADORAS){
   const src=leer(`apps/web/app/api/v1/patients/[patientId]/${r}/route.ts`);
   expect(src,`/${r} no declara la advertencia de uso`).toContain("usageWarning:CLINICAL_USE_WARNING");
  }
 });
 it("la advertencia dice quién decide y que hay que verificar las entradas",()=>{
  expect(CLINICAL_USE_WARNING).toMatch(/NO sustituye el juicio del médico/);
  expect(CLINICAL_USE_WARNING).toMatch(/quien decide/);
  expect(CLINICAL_USE_WARNING).toMatch(/unidades y fechas/);
 });
 it("las afirmaciones del anexo sobre el código siguen siendo ciertas (el motivo de retirar la autoexclusión)",()=>{
  // Si estos textos desaparecieran, el producto habría dejado de proponer conducta y la determinación cambiaría.
  expect(leer("packages/stroke-risk/src/index.ts")).toMatch(/Anticoagulación oral recomendada/);
  expect(leer("packages/pneumonia-severity/src/index.ts")).toMatch(/ingreso hospitalario/);
  expect(leer("packages/liver-fibrosis/src/index.ts")).toMatch(/referir a hepatología/);
  expect(leer("packages/bp-staging/src/index.ts")).toMatch(/Iniciar\/ajustar 2 fármacos/);
  expect(leer("apps/web/lib/medication-lifecycle.ts")).toContain("SAFETY_BLOCKED");
 });
});
