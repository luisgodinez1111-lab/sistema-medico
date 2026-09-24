import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{foldResult,assertResultCorrectable,assertResultVoidable}from"../../packages/result-fold/src";
import{runtimeFiles}from"./_runtime-src";
import{ANALYTE_UNITS,canonicalUnitOf,classifyLab,labReferenceRanges}from"../../packages/lab-reference/src";
// Auditoría 2026-09-19, anexo R03 (R03-10): un resultado solo se podía CORREGIR (con un valor nuevo), nunca ANULAR; y el
// lector de "último valor" devolvía un número desnudo —sin unidad, sin fecha, sin estado— y alimentaba así eGFR, MELD,
// FIB-4, ácido-base, paneles y el contexto de referencia.
const ev=(sequence:number,payload:Record<string,unknown>)=>({sequence,payload});

describe("anulación de un resultado (R03-10)",()=>{
 it("ENTERED_IN_ERROR es una anotación: el estado del ciclo NO cambia, pero el dato deja de contar",()=>{
  const f=foldResult([
   ev(1,{kind:"RECEIVED",patientId:"p1",critical:true}),
   ev(2,{kind:"VERIFIED"}),
   ev(3,{kind:"ENTERED_IN_ERROR",reason:"Muestra de otro paciente (etiqueta equivocada)"}),
  ]);
  expect(f.state).toBe("VERIFIED");        // la anotación no mueve la máquina
  expect(f.enteredInError).toBe(true);
  expect(f.errorReason).toMatch(/otro paciente/);
 });
 it("un resultado anulado no se corrige (se registra uno nuevo) y no se anula dos veces",()=>{
  const anulado=foldResult([ev(1,{kind:"RECEIVED",patientId:"p1"}),ev(2,{kind:"ENTERED_IN_ERROR",reason:"x"})]);
  expect(()=>assertResultCorrectable(anulado)).toThrow(/entered in error/i);
  expect(()=>assertResultVoidable(anulado)).toThrow(/already marked/i);
 });
 it("lo ya superseded por una corrección no se anula: se anula el vigente",()=>{
  const corregido=foldResult([ev(1,{kind:"RECEIVED",patientId:"p1"}),ev(2,{kind:"CORRECTED",supersededBy:"r2"})]);
  expect(()=>assertResultVoidable(corregido)).toThrow(/already superseded/i);
 });
 it("un resultado intacto se puede anular y corregir",()=>{
  const vivo=foldResult([ev(1,{kind:"RECEIVED",patientId:"p1"})]);
  expect(vivo.enteredInError).toBe(false);
  expect(()=>assertResultVoidable(vivo)).not.toThrow();
  expect(()=>assertResultCorrectable(vivo)).not.toThrow();
 });
 it("el motivo de la anulación es obligatorio y tiene que explicar algo (no «x»)",()=>{
  const src=fs.readFileSync("apps/web/lib/result-lifecycle.ts","utf8");
  expect(src).toMatch(/ErrorMarkBody=z\.object\(\{reason:z\.string\(\)\.trim\(\)\.min\(10/);
  expect(src).toContain("RESULT_ENTERED_IN_ERROR");
  // Un resultado anulado no puede dejar un pendiente abierto por haber sido crítico.
  expect(src).toMatch(/completeCriticalResultObligation\(ctx,resultId,`resultado anulado/);
 });
 it("la ruta existe y está declarada en el inventario de la API",()=>{
  expect(fs.existsSync("apps/web/app/api/v1/results/[resultId]/error-mark/route.ts")).toBe(true);
  expect(fs.readFileSync("docs/api/openapi.json","utf8")).toContain("/api/v1/results/{resultId}/error-mark");
 });
 it("TODOS los lectores de resultados excluyen los anulados (guardián de las consultas SQL)",()=>{
  const lectores:[string,string][]=[
   ["apps/web/lib/runtime/lab-facts.ts","latestAnalyteReading"],
   ["apps/web/lib/runtime/lab-facts.ts","analyteSeries"],
   ["apps/web/lib/runtime/registries.ts","resultsRegistry"],
   ["apps/web/lib/runtime/records.ts","countOpenCriticalResults"],
  ];
  for(const[f,fn]of lectores){
   const src=fs.readFileSync(f,"utf8");
   const i=src.indexOf(`export async function ${fn}(`);
   const cuerpo=i<0?"":src.slice(i,src.indexOf("\n}",i));
   expect(cuerpo,`no se encontró ${fn} en ${f}`).not.toBe("");
   expect(cuerpo,`${fn} no excluye los resultados anulados`).toContain("ENTERED_IN_ERROR");
  }
 });
});

describe("toda lectura de laboratorio pasa por la guarda (R03-10)",()=>{
 it("el lector de número desnudo YA NO EXISTE: no quedaba ningún consumidor",()=>{
  // En el lote 11e quedaba uno (el delta check); en el 11h pasó a `latestAnalyteReading` porque necesitaba la fecha del
  // previo (ventana temporal del delta, vector F09). Una función muerta que devuelve números sin unidad es una invitación.
  const fs2=fs;
  expect(fs2.readFileSync("apps/web/lib/runtime/lab-facts.ts","utf8")).not.toMatch(/export async function latestResultValueForAnalyte/);
  expect(fs2.readFileSync("apps/web/lib/clinical-runtime.ts","utf8")).not.toContain("latestResultValueForAnalyte");
 });
 it("ninguna ruta ni panel lee laboratorio por otra vía que la guarda",()=>{
  const ficheros=[...runtimeFiles(),"apps/web/lib/result-lifecycle.ts","apps/web/lib/clinical-intelligence-summary.ts"]
   .concat(fs.readdirSync("apps/web/app/api/v1/patients/[patientId]",{recursive:true,encoding:"utf8"})
    .filter(f=>f.endsWith("route.ts")).map(f=>`apps/web/app/api/v1/patients/[patientId]/${f}`));
  const conLectorDesnudo=ficheros.filter(f=>fs.existsSync(f)&&fs.readFileSync(f,"utf8").includes("latestResultValueForAnalyte("));
  expect(conLectorDesnudo).toEqual([]);
 });
 it("los dos analitos que quedaban sin especificación de unidad ya la tienen",()=>{
  // Los comentarios del código lo declaraban: «LDL aún sin especificación (pendiente C-13)» y «unidad asumida: el
  // analito UACR aún no tiene especificación de unidad».
  expect(canonicalUnitOf("LDL")).toBe("mg/dL");
  expect(canonicalUnitOf("UACR")).toBe("mg/g");
  expect(ANALYTE_UNITS["LDL"]!.accepted["mmol/l"]).toBeDefined();   // el cruce SI↔convencional del colesterol
  expect(ANALYTE_UNITS["UACR"]!.accepted["mg/mmol"]).toBeDefined();
  expect(classifyLab("LDL","200").status).toBe("CRITICAL");         // ≥190: hipercolesterolemia severa
  expect(classifyLab("LDL","95").status).toBe("NORMAL");
  expect(classifyLab("UACR","45").status).toBe("ABNORMAL");         // A2
  expect(classifyLab("UACR","350").status).toBe("CRITICAL");        // A3
  for(const a of["LDL","UACR"])expect(labReferenceRanges().find(r=>r.analyte===a)?.source).toBeTruthy();
 });
 it("ningún comentario del runtime sigue prometiendo una unidad pendiente",()=>{
  for(const f of runtimeFiles()){
   const src=fs.readFileSync(f,"utf8");
   expect(src,`${f} declara una unidad pendiente`).not.toMatch(/sin especificación de unidad|unidad asumida: el analito/);
  }
 });
});
