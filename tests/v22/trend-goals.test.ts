import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{CHART,sectionId}from"../../apps/web/app/workspace/shared";
import{goalFor,CARE_GOALS,INDIVIDUALIZATION_NOTICE}from"../../packages/care-goals/src";
// Auditoría 2026-09-19, anexo R05a (WS1-09 / WS1-15b / WS1-15c) — el GRÁFICO de tendencias y dos restos de una época de
// datos de ejemplo.
//
// WS1-09. El gráfico pintaba una FRANJA VERDE de «zona de meta», con su línea y su etiqueta, sobre la serie de CUALQUIER
// paciente: «Objetivo <7%», «Meta <100 mg/dL» para glucosa y para LDL. Una franja verde es la afirmación más fuerte que
// puede hacer una pantalla —«por debajo de esta línea, bien»— y dos de las tres estaban mal:
//   · GLUCOSA. «<100 mg/dL» es el umbral de NORMALIDAD (criterio diagnóstico), no una meta de tratamiento. Mostrárselo a
//     una persona CON diabetes es MÁS ESTRICTO que el rango preprandial recomendado (80–130) y empuja a la hipoglucemia.
//     Y la franja bajaba hasta el suelo del gráfico, así que declaraba «en meta» una glucosa de 45 mg/dL.
//   · LDL. No hay meta universal: se fija por categoría de riesgo cardiovascular, y este sistema no la calcula todavía.
// WS1-15b. `isReal(_r)=>true`: función vestigial que siempre devolvía cierto, resto de una época con filas de ejemplo.
// WS1-15c. El verificador de interacciones arrancaba con tres fármacos de EJEMPLO sin decir que lo eran.
const SHARED="apps/web/app/workspace/shared.tsx";

describe("metas del gráfico de tendencias (WS1-09)",()=>{
 it("cada meta del gráfico sale del módulo con fuente, no de la vista",()=>{
  for(const[k,cfg]of Object.entries(CHART)){
   if(cfg.target===undefined&&cfg.goal===undefined)continue; // creatinina: se sigue, sin meta
   expect(cfg.goal,`${k}: pinta una meta sin declarar de qué métrica es`).toBeTruthy();
   const g=goalFor(cfg.goal!);
   expect(g,`${k}: la métrica «${cfg.goal}» no existe en care-goals`).toBeTruthy();
   expect(g!.source.length,`${k}: la meta no cita fuente`).toBeGreaterThan(30);
   expect(g!.appliesTo.length,`${k}: la meta no declara población`).toBeGreaterThan(20);
  }
 });
 it("la glucosa tiene COTA INFERIOR: la zona verde no puede declarar «en meta» una hipoglucemia",()=>{
  // El defecto con consecuencia: la franja iba desde la meta hasta el suelo del gráfico (60 mg/dL en el dominio).
  expect(CHART.GLUCOSE.targetLow,"sin cota inferior la franja pinta la hipoglucemia como zona buena").toBe(80);
  const g=goalFor("Glucosa en ayuno")!;
  expect(g.meetsDefault!(45),"45 mg/dL es hipoglucemia, nunca «en meta»").toBe(false);
  expect(g.meetsDefault!(79)).toBe(false);
  expect(g.meetsDefault!(110)).toBe(true);
  expect(g.meetsDefault!(131)).toBe(false);
  expect(g.appliesTo,"debe decir que <100 es umbral de normalidad, no meta de tratamiento").toMatch(/normalidad/i);
  expect(g.individualizeWhen.join(" "),"y advertir de la hipoglucemia").toMatch(/hipoglucemia/i);
 });
 it("el LDL ya NO dibuja una meta, porque depende del riesgo cardiovascular",()=>{
  expect(CHART.LDL.target,"una línea de meta de LDL sin categoría de riesgo es una meta inventada").toBeUndefined();
  const g=goalFor("Colesterol LDL")!;
  expect(g.meetsDefault,"no se declara «en meta» sin categoría de riesgo").toBeNull();
  expect(g.appliesTo).toMatch(/riesgo/i);
  expect(g.individualizeWhen.join(" ")).toMatch(/cardiovascular establecida|muy alto/i);
 });
 it("la vista ya no escribe metas a mano y muestra el aviso de individualización",()=>{
  const src=fs.readFileSync(SHARED,"utf8");
  for(const literal of ['"Meta <100 mg/dL"','"Objetivo <7%"'])
   expect(src.includes(literal),`la vista volvió a escribir la meta a mano: ${literal}`).toBe(false);
  expect(src,"el gráfico debe leer la meta del módulo").toContain("goalFor");
  expect(src,"y mostrar que la meta del paciente la fija su médico").toContain("INDIVIDUALIZATION_NOTICE");
  expect(INDIVIDUALIZATION_NOTICE).toMatch(/su médico|su medico/i);
 });
 it("la HbA1c conserva su meta, que sí tiene población declarada",()=>{
  expect(CHART.HBA1C.target).toBe(7);
  expect(CHART.HBA1C.targetLabel,"la etiqueta tiene que decir que es POR OMISIÓN").toMatch(/omisión|omision/i);
  expect(goalFor("HbA1c")!.meetsDefault!(6.9)).toBe(true);
 });
 it("toda métrica del módulo de metas declara individualización (incluidas las nuevas)",()=>{
  expect(CARE_GOALS.length).toBeGreaterThanOrEqual(6);
  for(const g of CARE_GOALS)expect(g.individualizeWhen.length,`${g.metric}: sin condiciones de individualización`).toBeGreaterThan(0);
 });
});

describe("restos de la época de datos de ejemplo (WS1-15b/c)",()=>{
 it("`isReal` ya no existe: era una función que siempre decía cierto",()=>{
  const src=fs.readFileSync("apps/web/app/workspace/views/pacientes.tsx","utf8");
  expect(src.includes("isReal"),"función vestigial: todo el código que la consultaba era código muerto").toBe(false);
 });
 it("el verificador de interacciones arranca VACÍO, sin fármacos de ejemplo",()=>{
  // Tres fármacos precargados en un verificador de interacciones se leen como la medicación de alguien.
  // Solo líneas de CÓDIGO: el comentario de esta corrección cita los tres fármacos del defecto y no es el defecto.
  const src=fs.readFileSync("apps/web/app/workspace/model.tsx","utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
  const m=/const\[ixDrugs,setIxDrugs\]=useState<string\[\]>\(([^)]*)\)/.exec(src);
  expect(m,"no se encontró el estado del verificador").not.toBeNull();
  expect(m![1]!.trim()).toBe("[]");
  for(const f of ["Sertralina","Ibuprofeno","Metformina"])
   expect(src.includes(`"${f}"`),`${f} seguía precargado como si fuera del paciente`).toBe(false);
 });
 it("y no se puede «verificar interacciones» de un solo fármaco",()=>{
  // La pantalla pedía «dos o más» y el botón se habilitaba con uno: un veredicto de interacciones de un fármaco solo.
  const src=fs.readFileSync("apps/web/app/workspace/views/medicamentos.tsx","utf8");
  expect(src,"el botón debe exigir dos fármacos, como dice el propio texto de la pantalla").toContain("ixDrugs.length<2");
  expect(src.includes("ixDrugs.length<1"),"quedó una condición que habilita con un solo fármaco").toBe(false);
 });
 it("el identificador de ventana sigue siendo el mismo para el título de medicación",()=>{
  expect(sectionId("Medicación")).toBe("mos-medicacion"); // ata este lote con la navegación por ancla (WS1-15a)
 });
});
