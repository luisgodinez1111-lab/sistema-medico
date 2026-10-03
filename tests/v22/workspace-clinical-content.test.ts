import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
import{allergyCrossReactivity}from"../../packages/drug-catalog/src";
import{labReferenceRanges,criticalHighUnbounded}from"../../packages/lab-reference/src";
import{edadDe}from"../../apps/web/app/workspace/shared";
// Auditoría 2026-09-19, anexo R05b (R05b-07, R05b-05, R05b-26, R05b-11, R05b-17, R05b-03/21, R05b-15).
//
// El hilo común de este lote: contenido clínico y proporciones que la pantalla afirmaba por su cuenta, sin la fuente que el
// propio repositorio ya tenía. El caso con consecuencia es R05b-07: la alerta de reactividad cruzada salía de siete palabras
// buscadas en texto libre y CONTRADECÍA al motor que bloquea prescripciones —decía «evitar sulfonamidas» cuando el catálogo
// documenta desde R03-24 que ese antecedente NO debe retirar furosemida ni tiazidas—.
const UI="apps/web/app/workspace";
const vista=(f:string)=>fs.readFileSync(path.join(UI,"views",f),"utf8");

describe("reactividad cruzada de una alergia (R05b-07)",()=>{
 // (Fase 2) El registro clínica-wide de Alergias se retiró; la reactividad cruzada NO se evalúa con un regex sino con el
 // catálogo de fármacos (allergyCrossReactivity), y se usa en la BARRERA DE PRESCRIPCIÓN (no en una vista de lista). Los
 // invariantes del catálogo (abajo) son los que importan.
 it("«alergia a sulfas» NO arrastra a las sulfonamidas no antibióticas",()=>{
  // La contradicción que encontró este hallazgo: la pantalla empujaba a retirar furosemida o tiazidas, que es el daño sin
  // base en la evidencia que el catálogo documenta y rechaza (R03-24).
  const r=allergyCrossReactivity("sulfa");
  expect(r.recognized).toBe(true);
  expect(r.classes).toContain("SULFONAMIDE_ANTIBIOTIC");
  expect(r.avoid.join(" "),"debe acotar a las ANTIBIÓTICAS").toMatch(/antibi/i);
  expect(r.caveats.join(" "),"y decir expresamente qué no se retira").toMatch(/furosemida|tiazida/i);
 });
 it("la reactividad de los betalactámicos se presenta con el matiz que el catálogo documenta",()=>{
  const r=allergyCrossReactivity("penicilina");
  expect(r.classes).toContain("PENICILLIN");
  expect(r.crossFamilies).toContain("BETA_LACTAM");
  expect(r.caveats.join(" "),"la cadena lateral R1 y el ~1 % de 3.ª–4.ª generación").toMatch(/R1|1 %/);
 });
 it("si el catálogo no reconoce la sustancia, NO se inventa una alerta",()=>{
  // El regex anterior caía en «penicilinas» por omisión para cualquier cosa que coincidiera de refilón.
  const r=allergyCrossReactivity("polvo de casa");
  expect(r.recognized).toBe(false);
  expect(r.avoid).toEqual([]);
 });
 it("un AINE cruza con salicilatos, como en el motor de prescripción",()=>{
  const r=allergyCrossReactivity("aspirina");
  expect(r.classes).toContain("SALICYLATE");
  expect(r.crossFamilies).toContain("NSAID");
 });
});

describe("umbrales críticos de laboratorio en pantalla (R05b-05)",()=>{
 it("«sin umbral alto» se declara en el paquete, no se adivina con números mágicos en la vista",()=>{
  const src=vista("resultados.tsx");
  expect(src.includes("criticalHigh!==99"),"el número mágico volvió a la vista").toBe(false);
  expect(src.includes("criticalHigh<99"),"y el corte original tampoco puede volver").toBe(false);
  expect(src,"la vista lee la declaración").toContain("criticalHighUnbounded");
 });
 it("solo dos analitos no tienen umbral alto, y son los fisiológicamente imposibles",()=>{
  const sin=labReferenceRanges().filter(r=>r.criticalHighUnbounded).map(r=>r.analyte).sort();
  expect(sin).toEqual(["ALBUMIN","PO2"]);
 });
 it("ningún umbral crítico REAL se presenta como «sin umbral»",()=>{
  // El defecto medido: el corte `<99` ocultaba once de veintiocho, entre ellos umbrales letales.
  const rangos=labReferenceRanges();
  for(const a of ["POTASSIUM","PH","INR","TROPONIN","CREATININE","LACTATE","CALCIUM","MAGNESIUM","BILIRUBIN","PCO2","HBA1C"]){
   const r=rangos.find(x=>x.analyte===a)!;
   expect(r,`falta ${a}`).toBeTruthy();
   expect(r.criticalHighUnbounded,`${a}: su umbral crítico alto (${r.criticalHigh}) es real y se estaba ocultando`).toBe(false);
  }
  // Y el potasio, que es el ejemplo letal del hallazgo, conserva su 6.5.
  expect(rangos.find(x=>x.analyte==="POTASSIUM")!.criticalHigh).toBe(6.5);
 });
 it("la función del centinela solo dispara con el valor imposible",()=>{
  expect(criticalHighUnbounded("ALBUMIN",99)).toBe(true);
  expect(criticalHighUnbounded("ALBUMIN",5.5)).toBe(false);
  expect(criticalHighUnbounded("POTASSIUM",99)).toBe(false); // el potasio no tiene centinela declarado
 });
});

describe("lo que la pantalla no puede afirmar (R05b-26, R05b-11, R05b-17, R05b-03/21, R05b-15)",()=>{
 // (Fase 2) La barra de «metas y métricas» (con el % inventado que este hallazgo cazó) vivía en la vista suelta de Plan de
 // cuidado, ya retirada. La sección Plan del Expediente usa un form de meta LIBRE (sin barra de avance), así que no hay
 // porcentaje que inventar.
 it("Órdenes no tiene dos pestañas con el mismo filtro",()=>{
  const src=vista("ordenes.tsx");
  const m=/const TAB_TYPES:Record<string,string\[\]>=\{([^}]*)\}/.exec(src);
  expect(m,"no se encontró el mapa de pestañas").not.toBeNull();
  const tipos=[...m![1]!.matchAll(/\["([A-Z]+)"\]/g)].map(x=>x[1]!);
  expect(new Set(tipos).size,`dos pestañas filtran lo mismo: ${tipos.join(", ")}`).toBe(tipos.length);
  expect(src.includes('"gabinete"'),"la pestaña duplicada volvió").toBe(false);
 });
 // (Fase 2) La búsqueda CIE-10 con fallo-de-catálogo distinto de «sin resultados» (pfSearchErr) era de la vista suelta de
 // Problemas (búsqueda por API). En el Expediente, Problemas usa la búsqueda LOCAL del catálogo (searchIcd10, síncrona), que
 // muestra «Sin coincidencias en el catálogo CIE-10»; no hay llamada que pueda «no responder».
 it("la función de edad se deriva de verdad y no inventa",()=>{
  // La función `edadDe` (el módulo que alimentaba la edad de la fila) sigue siendo honesta: sin fecha, devuelve vacío.
  expect(edadDe([{patientId:"p1",birthDate:"1990-06-15"}],"p1","2026-09-24T00:00:00.000Z")).toBe("36 años");
  expect(edadDe([{patientId:"p1"}],"p1")).toBe("");
  expect(edadDe(null,"p1")).toBe("");
  expect(edadDe([{patientId:"p2",birthDate:"1990-06-15"}],"p1")).toBe("");
 });
 it("marcar una inasistencia exige constancia, y el servidor la PERSISTE",()=>{
  const modelo=fs.readFileSync(path.join(UI,"model.tsx"),"utf8");
  expect(modelo,"la pantalla debe pedir la constancia").toMatch(/path==="no-show"\?await resolveAsks/);
  // Lo que faltaba para que pedirla sirviera: `WhenBody` habría descartado el campo en silencio.
  const srv=fs.readFileSync("apps/web/lib/appointment-lifecycle.ts","utf8");
  expect(srv,"el servidor necesita su propio cuerpo").toContain("export const NoShowBody");
  expect(srv,"y la constancia tiene que entrar al evento").toMatch(/kind:"NO_SHOW",\.\.\.\(b\.reason\?\{reason:b\.reason\}:\{\}\)/);
 });
});
