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
 it("la alerta ya NO sale de un regex sobre texto libre",()=>{
  const src=vista("alergias.tsx");
  expect(src.includes("penicil|amoxi|betalact"),"el regex de siete palabras volvió").toBe(false);
  expect(src,"la clase la determina el catálogo de fármacos").toContain("allergyCrossReactivity");
 });
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
  expect(vista("alergias.tsx"),"la pantalla debe decir que no se pudo evaluar").toMatch(/no evaluada/i);
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
 it("la barra del plan de cuidado ya no inventa un porcentaje de avance",()=>{
  const src=vista("planCuidado.tsx");
  expect(src.includes('width:good?"85%":"55%"'),"un 85 % que el sistema no mide").toBe(false);
  expect(src,"el estado real es binario y se dice con palabras").toMatch(/En meta/);
  expect(src,"y se anuncia para lectores de pantalla").toMatch(/aria-label=\{good\?/);
 });
 it("Órdenes no tiene dos pestañas con el mismo filtro",()=>{
  const src=vista("ordenes.tsx");
  const m=/const TAB_TYPES:Record<string,string\[\]>=\{([^}]*)\}/.exec(src);
  expect(m,"no se encontró el mapa de pestañas").not.toBeNull();
  const tipos=[...m![1]!.matchAll(/\["([A-Z]+)"\]/g)].map(x=>x[1]!);
  expect(new Set(tipos).size,`dos pestañas filtran lo mismo: ${tipos.join(", ")}`).toBe(tipos.length);
  expect(src.includes('"gabinete"'),"la pestaña duplicada volvió").toBe(false);
 });
 it("el fallo del catálogo CIE-10 se distingue de «sin resultados»",()=>{
  // Sin código no se puede registrar el problema: el médico tiene que saber si el catálogo no respondió.
  const src=vista("problemas.tsx");
  expect(src,"debe haber un aviso propio del fallo de búsqueda").toContain("pfSearchErr");
  expect(src.includes("catch{/* búsqueda no disponible */}"),"el catch silencioso volvió").toBe(false);
  expect(src).toMatch(/no respondió|No se pudo consultar/);
 });
 it("la edad de la fila se deriva de verdad y no es código muerto",()=>{
  for(const f of ["alergias.tsx","problemas.tsx","vacunas.tsx"]){
   const src=vista(f);
   expect(src.includes('age:""'),`${f}: el campo edad sigue siendo código muerto`).toBe(false);
   expect(src,`${f}: la edad debe derivarse de la lista de pacientes`).toContain("edadDe(patientList");
  }
  // Y la función no inventa: sin fecha de nacimiento devuelve vacío.
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
