import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{ALGORITHM_SPECS}from"../../packages/clinical-algorithm-specs/src";
// Cotejo de los algoritmos clínicos contra las guías internacionales — guardián del documento.
//
// El cotejo (docs/compliance/cotejo-de-guias-clinicas.md) compara lo que el código hace de verdad contra el texto de la guía
// que dice seguir, y termina en una lista de decisiones para el especialista. Este test NO puede comprobar que el cotejo sea
// correcto —eso lo hace quien lo lee— pero sí que EXISTA y que no se quede atrás: añadir un algoritmo sin cotejarlo rompe la
// compilación, que es la única forma de que un documento de cumplimiento no envejezca en silencio.
//
// Es el mismo principio que el resto de la campaña: el inventario de algoritmos se genera del código (no se transcribe), y
// aquí el documento se ata al inventario.
const DOC="docs/compliance/cotejo-de-guias-clinicas.md";
const doc=()=>fs.readFileSync(DOC,"utf8");

describe("cotejo de guías clínicas (preparación de la validación clínica)",()=>{
 it("cada algoritmo declarado tiene su sección en el cotejo",()=>{
  const txt=doc();
  const sinCotejo=ALGORITHM_SPECS.filter(s=>{
   // Se busca el identificador o el nombre del algoritmo en un encabezado de sección.
   const clave=s.id.replace(/-\d{4}$/,"").replace(/-/g," ");
   return !new RegExp(`^## \\d+\\.[^\\n]*(${s.id}|${clave.split(" ")[0]})`,"mi").test(txt);
  }).map(s=>s.id);
  expect(sinCotejo,"algoritmo declarado sin cotejar contra su guía").toEqual([]);
 });
 it("cada sección lleva veredicto y fuente, no solo una descripción",()=>{
  const txt=doc();
  const secciones=txt.split(/^## \d+\. /m).slice(1);
  expect(secciones.length,`se esperaban ${ALGORITHM_SPECS.length} secciones de algoritmo`).toBe(ALGORITHM_SPECS.length);
  const flojas:string[]=[];
  for(const s of secciones){
   const titulo=(s.split("\n")[0]??"").slice(0,60);
   if(!/\*\*Veredicto:/.test(s))flojas.push(`${titulo}: sin veredicto`);
   if(!/Guía[s]? de referencia|Guía de referencia implementada/.test(s))flojas.push(`${titulo}: sin fuente`);
   if(!/Decisión pendiente|Sin brecha|Ninguna/.test(s))flojas.push(`${titulo}: sin decisión ni declaración de que no hay`);
  }
  expect(flojas,"sección incompleta del cotejo").toEqual([]);
 });
 it("el documento declara que NO sustituye a la validación clínica",()=>{
  // Sin esta frase, el cotejo podría leerse como una aprobación, que es exactamente lo que no es.
  const txt=doc();
  expect(txt).toMatch(/NO es una validación clínica y no la sustituye/);
  expect(txt,"y quién la firma").toMatch(/ADR-0300/);
 });
 it("declara el límite de conocimiento de quien lo hizo",()=>{
  // Una guía revisada después del corte de conocimiento invalidaría una fila sin que nadie lo note.
  const txt=doc();
  expect(txt).toMatch(/corte de conocimiento/i);
  expect(txt,"y marca las filas que hay que verificar").toMatch(/[Vv]erificar vigencia/);
 });
 it("las decisiones están numeradas y priorizadas, no sueltas en la prosa",()=>{
  const txt=doc();
  const decisiones=[...txt.matchAll(/^\| D(\d+) \|/gm)].map(m=>Number(m[1]));
  expect(decisiones.length,"debe haber una tabla de decisiones para firmar").toBeGreaterThanOrEqual(8);
  expect(decisiones,"numeradas sin huecos").toEqual(decisiones.map((_,i)=>i+1));
  // Las tres de mayor consecuencia clínica encontradas en el cotejo tienen que estar marcadas como altas.
  const altas=txt.split("\n").filter(l=>/^\| D\d+ \|/.test(l)&&/\*\*Alta\*\*/.test(l));
  expect(altas.length,"al menos las brechas con consecuencia clínica van como prioridad alta").toBeGreaterThanOrEqual(3);
 });
 it("el inventario de algoritmos y el cotejo hablan del mismo conjunto",()=>{
  // El inventario se genera del código; si divergen, uno de los dos miente.
  const inv=fs.readFileSync("docs/compliance/inventario-de-algoritmos.md","utf8");
  for(const s of ALGORITHM_SPECS)expect(inv,`${s.id} no está en el inventario`).toContain(s.id);
  expect(ALGORITHM_SPECS.length).toBe(10);
 });
});
