import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Auditoría 2026-09-19, anexo R05a (R05a-F08) — «no evaluado» y «confirmado vacío» son cosas DISTINTAS en la pantalla.
//
// Es el mismo principio fail-closed del kernel, pero donde el médico lo lee. «Sin alergias documentadas» y «no se pudo
// cargar el expediente» llevan a conductas opuestas: la primera autoriza a prescribir, la segunda obliga a preguntar. Una
// pantalla que afirma la ausencia sin saber si el dato llegó es un dato inventado con aspecto de tranquilizador.
//
// Medido el 24-sep-2026: de CATORCE afirmaciones de ausencia clínica en las vistas, once ya consultaban su indicador de
// carga y TRES no —el contexto de la interconsulta, «Mis medicamentos» del portal del paciente y los medicamentos de la
// pestaña de consulta—. Este test fija la invariante para las catorce.
const DIR="apps/web/app/workspace";
/** Afirmaciones de AUSENCIA de un dato clínico de seguridad: alergias, medicación y problemas. */
const AUSENCIA=/"(Sin (?:alergias|medicamentos|medicaci[oó]n|problemas)[^"]*)"/gi;
/** Señales de que la afirmación está guardada por un indicador de carga. */
const GUARDA=/(Loaded|loaded|!snap|snap\?|cargad|===undefined|consTabs\?|hasCtx)/;
function vistas():string[]{
 const out:string[]=[];
 const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);else if(e.name.endsWith(".tsx"))out.push(p);
 }};
 walk(DIR);return out.sort();
}

describe("desconocido vs confirmado vacío en los indicadores clínicos (R05a-F08)",()=>{
 it("TODA afirmación de ausencia clínica consulta su indicador de carga",()=>{
  const sinGuarda:string[]=[];
  let total=0;
  for(const p of vistas()){
   const src=fs.readFileSync(p,"utf8");
   for(const m of src.matchAll(AUSENCIA)){
    total++;
    // Contexto inmediato anterior: es donde vive la condición que decide qué se muestra.
    const ctx=src.slice(Math.max(0,m.index!-260),m.index!+m[0].length);
    if(!GUARDA.test(ctx))sinGuarda.push(`${p.slice(DIR.length+1)} → ${m[1]!.slice(0,52)}`);
   }
  }
  // (Fusión Pacientes⟷Expediente) Bajó el conteo al retirar la ficha-preview de Pacientes, que repetía varias
  // afirmaciones de ausencia ya presentes en el expediente. La invariante dura es la de abajo: ninguna sin su guarda.
  expect(total,"no se encontraron afirmaciones de ausencia: ¿cambió el texto de la UI?").toBeGreaterThanOrEqual(8);
  expect(sinGuarda,"afirma una ausencia clínica sin saber si el dato cargó").toEqual([]);
 });
 it("el portal del PACIENTE no dice «sin medicamentos» cuando la carga falló",()=>{
  // El caso más peligroso de los tres: es el paciente quien lo lee, y puede dejar de tomar un tratamiento.
  const src=fs.readFileSync(path.join(DIR,"views/exp.tsx"),"utf8");
  const i=src.indexOf("Mis medicamentos");
  expect(i).toBeGreaterThan(-1);
  const frag=src.slice(i,i+320);
  expect(frag,"debe distinguir «no se pudo cargar» de «no hay»").toMatch(/tl===undefined|no se pudo cargar/);
 });
 it("la interconsulta distingue «no evaluado» de «sin problemas»",()=>{
  // Quien recibe la interconsulta lee «sin problemas» y entiende que el paciente no los tiene.
  const src=fs.readFileSync(path.join(DIR,"views/interconsulta.tsx"),"utf8");
  expect(src).toMatch(/No evaluados: contexto del expediente no cargado/);
 });
 it("y el texto de «no evaluado» nunca se parece a una confirmación",()=>{
  // «Sin datos» o «Ninguno» leídos con prisa se confunden con una ausencia confirmada; el texto tiene que nombrar el fallo.
  for(const p of vistas()){
   const src=fs.readFileSync(p,"utf8");
   for(const m of src.matchAll(/"(No evaluad[oa]s?[^"]*)"/g))
    expect(m[1]!,`${p}: un «no evaluado» debe decir POR QUÉ`).toMatch(/no carg|no se pudo|no disponible/i); // «no cargó», «no cargaron», «no cargado»: el radical cubre las conjugaciones
  }
 });
});
