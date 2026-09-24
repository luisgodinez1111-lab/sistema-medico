import{describe,it,expect}from"vitest";
import fs from"node:fs";
// EPIC BI (endurecimiento G / ENG-044) — Compliance-as-code: el registro de aplicabilidad NOM debe ser estructuralmente
// válido, con evidencia que EXISTE y SIN declarar certificación sin evidencia.
//
// Auditoría 2026-09-19, anexo R09 (R09-007): «el test "enforzado" del registro de compliance solo verifica que los archivos
// citados existan». Era peor que eso, y se comprobó: los identificadores de capacidad se validaban contra
// `session-2026-09-15-reconciliation.json`, una INSTANTÁNEA histórica, no contra el catálogo vivo. Resultado medido el
// 24-sep-2026: SEIS de los identificadores citados como evidencia regulatoria de NOM-004, NOM-024 y LFPDPPP
// —CAP-VITAL-001, CAP-BACKUP-DR-001, CAP-RECORD-EXPORT-001, CAP-TERMINOLOGY-001, CAP-BILLING-ICD10-001 y
// CAP-OBSERVABILITY-SLI-001— no existían en `capabilities/catalog.json`. El registro de cumplimiento de tres instrumentos
// se apoyaba en nombres que no nombraban nada, y el test pasaba porque miraba el fichero equivocado.
//
// Lo que este fichero exige ahora, y por qué cada regla:
//  · una capacidad citada está en el catálogo VIVO y tiene al menos una prueba declarada (una capacidad sin pruebas no
//    sustenta un cumplimiento: es la misma cobertura aparente que la auditoría persigue en el código);
//  · un artefacto citado existe, NO está en el registro de rutas retiradas y no es un esbozo;
//  · todo instrumento APPLICABLE tiene al menos una evidencia EJECUTABLE —una prueba o una prueba en vivo—, porque un
//    documento puede afirmar cualquier cosa y solo un artefacto que corre puede desmentirlo;
//  · todo instrumento que no está terminado declara sus huecos por escrito.
const REG="docs/compliance/nom-applicability-register.json";
const reg=JSON.parse(fs.readFileSync(REG,"utf8")) as{
 applicabilityLevels:string[];statusLevels:string[];updated:string;evidenceRule?:string;
 instruments:{id:string;name:string;scope:string;applicability:string;status:string;certificationClaimed:boolean;evidence:string[];gaps:string}[];
};
const catalogo=new Map((JSON.parse(fs.readFileSync("capabilities/catalog.json","utf8")) as{id:string;tests?:string[]}[]).map(c=>[c.id,c]));
const retiradas=new Set((JSON.parse(fs.readFileSync("docs/adjudication/retired-paths.json","utf8")) as{retired:{path:string}[]}).retired.map(r=>r.path));
const APPLIC=new Set(reg.applicabilityLevels);const STATUS=new Set(reg.statusLevels);
const esEjecutable=(ev:string)=>ev.startsWith("tests/")||ev.startsWith("scripts/");

describe("compliance-as-code: registro de aplicabilidad NOM (ENG-044, R09-007)",()=>{
 it("estructura válida por instrumento (campos, niveles enumerados)",()=>{
  expect(Array.isArray(reg.instruments)).toBe(true);
  expect(reg.instruments.length).toBeGreaterThanOrEqual(5);
  for(const m of reg.instruments){
   for(const k of["id","name","scope","applicability","status","certificationClaimed","evidence","gaps"])expect(m,`${m.id} sin ${k}`).toHaveProperty(k);
   expect(APPLIC.has(m.applicability),`${m.id} applicability inválida`).toBe(true);
   expect(STATUS.has(m.status),`${m.id} status inválido`).toBe(true);
   expect(typeof m.certificationClaimed).toBe("boolean");
   expect(Array.isArray(m.evidence)).toBe(true);
  }
 });
 it("NO se declara certificación sin evidencia (ley: no claim de certificación sin evidencia)",()=>{
  for(const m of reg.instruments){
   if(m.certificationClaimed===true)expect(m.evidence.length,`${m.id} declara certificación sin evidencia`).toBeGreaterThan(0);
  }
 });
 it("toda capacidad citada existe en el catálogo VIVO y tiene pruebas (R09-007)",()=>{
  const problemas:string[]=[];
  for(const m of reg.instruments)for(const ev of m.evidence){
   if(!ev.startsWith("CAP-"))continue;
   const cap=catalogo.get(ev);
   if(!cap){problemas.push(`${m.id}: ${ev} no está en capabilities/catalog.json`);continue;}
   if(!(cap.tests??[]).length)problemas.push(`${m.id}: ${ev} no declara ninguna prueba, así que no sustenta nada`);
  }
  expect(problemas,"evidencia regulatoria que nombra capacidades inexistentes o sin pruebas").toEqual([]);
 });
 it("todo artefacto citado existe, no está retirado y no es un esbozo",()=>{
  const problemas:string[]=[];
  for(const m of reg.instruments)for(const ev of m.evidence){
   if(ev.startsWith("CAP-"))continue;
   if(!ev.includes("/")){problemas.push(`${m.id}: evidencia con formato desconocido "${ev}"`);continue;}
   if(retiradas.has(ev)){problemas.push(`${m.id}: ${ev} está en el registro de rutas RETIRADAS`);continue;}
   if(!fs.existsSync(ev)){problemas.push(`${m.id}: ${ev} no existe`);continue;}
   // Un esbozo de dos líneas no sustenta un instrumento regulatorio. El umbral es deliberadamente bajo: no juzga la
   // calidad, solo descarta el fichero vacío que se cita para llenar la casilla.
   const bytes=fs.statSync(ev).size;
   if(bytes<400)problemas.push(`${m.id}: ${ev} tiene ${bytes} bytes: es un esbozo`);
  }
  expect(problemas).toEqual([]);
 });
 it("todo instrumento APPLICABLE tiene al menos una evidencia EJECUTABLE",()=>{
  // La prosa puede afirmar cualquier cosa; solo un artefacto que corre puede desmentirla. Ésta es la regla que convierte
  // el registro en compliance-as-code y no en una tabla de intenciones.
  for(const m of reg.instruments){
   if(m.applicability!=="APPLICABLE")continue;
   const ejecutables=m.evidence.filter(esEjecutable);
   expect(ejecutables.length,`${m.id}: ninguna evidencia ejecutable (solo ${m.evidence.join(", ")})`).toBeGreaterThan(0);
  }
 });
 it("todo instrumento sin terminar declara sus huecos por escrito",()=>{
  for(const m of reg.instruments){
   if(m.status==="BASELINE_ADDRESSED")continue;
   expect(typeof m.gaps,`${m.id}: gaps debe ser texto`).toBe("string");
   expect(m.gaps.trim().length,`${m.id}: status ${m.status} sin declarar qué falta`).toBeGreaterThan(30);
  }
 });
 it("los instrumentos foundational aplicables están presentes",()=>{
  const byId=new Map(reg.instruments.map(m=>[m.id,m]));
  for(const id of["NOM-004-SSA3-2012","NOM-024-SSA3-2012","LFPDPPP"]){
   expect(byId.has(id),`falta ${id}`).toBe(true);
   expect(byId.get(id)!.applicability).toBe("APPLICABLE");
  }
 });
 it("el registro declara la regla con la que se valida su propia evidencia",()=>{
  // Sin esto, quien añada una fila mañana no sabe qué cuenta como evidencia y el registro vuelve a degradarse.
  expect(reg.evidenceRule,"el registro debe declarar su regla de evidencia (R09-007)").toBeTruthy();
  expect(reg.evidenceRule!).toMatch(/catalogo vivo|catálogo vivo/i);
 });
 it("NOM-004 cita el plazo legal de conservación con su numeral, no «tiempo mínimo» (R09-009)",()=>{
  // El anexo: «el registro admite el hueco pero nunca cita el plazo legal». Un plazo sin cifra no se puede implementar ni
  // auditar, y el hueco se vuelve imposible de cerrar porque nadie sabe contra qué. La cifra va citada de la norma, con la
  // advertencia de que la determinación definitiva (menores, fallecidos, tipos de documento) es del dueño con asesoría legal.
  const m=reg.instruments.find(x=>x.id==="NOM-004-SSA3-2012") as unknown as{legalRetention?:string;gaps:string};
  expect(m.legalRetention,"NOM-004 debe citar el plazo de conservación").toBeTruthy();
  expect(m.legalRetention!,"con el numeral de la norma").toMatch(/numeral\s*5\.\d/);
  expect(m.legalRetention!,"y con la cifra, no «tiempo mínimo»").toMatch(/CINCO|cinco|5\s*a[nñ]os/);
  expect(m.legalRetention!,"y diciendo qué parte es decisión del dueño").toMatch(/decision del dueno|decisión del dueño/i);
 });
 it("NOM-024 declara el identificador nacional que el código captura (R09-010)",()=>{
  // El anexo: «NOM-024 no menciona CURP pese a que el código lo captura como identificador de paciente». Peor: no solo lo
  // captura, lo VALIDA contra fecha de nacimiento y sexo. Un registro de interoperabilidad que no nombra el identificador
  // nacional que el sistema usa está describiendo otro sistema.
  const m=reg.instruments.find(x=>x.id==="NOM-024-SSA3-2012") as unknown as{nationalIdentifier?:string;evidence:string[]};
  expect(m.nationalIdentifier,"NOM-024 debe declarar el identificador nacional").toBeTruthy();
  expect(m.nationalIdentifier!).toMatch(/CURP/);
  // Y la afirmación tiene que descansar en el código que la sostiene, no en la prosa.
  expect(m.evidence.some(e=>e.includes("mx-identity")),"la CURP se declara sin citar el paquete que la valida").toBe(true);
 });
 it("las carpetas de gobernanza de la jerarquía existen (compliance + threat-models)",()=>{
  expect(fs.existsSync("docs/compliance")).toBe(true);
  expect(fs.existsSync("docs/threat-models/baseline-threat-model.md")).toBe(true);
 });
});
