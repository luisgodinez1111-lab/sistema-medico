import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{spawnSync}from"node:child_process";
// Auditoría 2026-09-19, anexo R11 (R11-22, R11-18, R11-19) — «EVIDENCIA COMPLETA» TIENE QUE SIGNIFICAR EJECUTADA Y EN VERDE.
//
// EL HALLAZGO: `build-c5-dossier.mts` certificaba «evidencia COMPLETA» comprobando que el archivo de prueba EXISTIERA en
// disco. Un test que existe y falla —o una prueba en vivo que nadie ha ejecutado nunca— contaba igual que una prueba verde.
// Es el mismo defecto que llevaba un lote entero escondido en el drill de restauración: un gate que no puede fallar.
//
// AL CABLEAR EL CRUCE APARECIERON DOS VEREDICTOS CONGELADOS en el propio archivo de evidencia, que es la forma más pura del
// hallazgo: uno decía «PASS (26 capacidades, evidencia COMPLETA, 0 citas rotas)» cuando el archivo ya tenía 151, y otro
// «PASS (14/14 proofs del smoke)» cuando el smoke tiene 107. Cadenas escritas a mano hace semanas, presentadas como
// resultado de una ejecución. Ahora el veredicto lo pone el libro de ejecución y esas cadenas no existen.
const DOSSIER="scripts/v22/build-c5-dossier.mts";
const REC="docs/adjudication/session-2026-09-15-reconciliation.json";
const LIBRO_TESTS="release/evidence/test-ledger.json";
const LIBRO_PROOFS="release/evidence/live-smoke-ledger.json";

describe("libros de ejecución de la evidencia (R11-22)",()=>{
 it("el gate del dossier exige que cada cita aparezca EN VERDE en su libro",()=>{
  const src=fs.readFileSync(DOSSIER,"utf8");
  expect(src,"debe leer el libro de las pruebas unitarias").toContain("release/evidence/test-ledger.json");
  expect(src,"y el de las pruebas en vivo").toContain("release/evidence/live-smoke-ledger.json");
  expect(src,"cada cita se resuelve contra su libro").toContain("estadoDeCita");
  // La frase que delataba el defecto: certificar porque el archivo existe.
  expect(src.includes("todo test/prueba citada existe en disco"),"volvió a certificar por existencia").toBe(false);
 });
 it("sin libros, el dossier NO puede decir que la evidencia está respaldada",()=>{
  // Se ejecuta el gate con los libros escondidos: tiene que fallar y decir que faltan.
  const mover=(p:string)=>{if(fs.existsSync(p)){fs.renameSync(p,p+".bak");return true;}return false;};
  const m1=mover(LIBRO_TESTS),m2=mover(LIBRO_PROOFS);
  try{
   const r=spawnSync("pnpm",["-s","exec","tsx",DOSSIER],{encoding:"utf8"});
   expect(r.status,"sin libros el gate tiene que fallar").not.toBe(0);
   expect(r.stdout,"y decir exactamente qué falta").toMatch(/falta el libro de ejecución/);
  }finally{
   if(m1)fs.renameSync(LIBRO_TESTS+".bak",LIBRO_TESTS);
   if(m2)fs.renameSync(LIBRO_PROOFS+".bak",LIBRO_PROOFS);
  }
 },60000);
 it("un gate no es evidencia de sí mismo",()=>{
  // Si lo fuera, cualquier script se aprobaría con solo existir: es el defecto, escrito de otra forma.
  const src=fs.readFileSync(DOSSIER,"utf8");
  expect(src).toContain("GATE DE SÍ MISMO");
  expect(src,"la regla tiene que estar escrita, no implícita").toMatch(/NO puede ser evidencia de sí mismo/);
 });
 it("la CITA de evidencia es una ruta o la marca de ausencia, nunca un veredicto",()=>{
  // Medido al cablear el cruce: 146 de 151 capacidades guardaban un veredicto escrito a mano en el campo de la cita
  // («PASS 10/10 (…)», «PASS (26 capacidades, evidencia COMPLETA)»). Esas cadenas envejecen y siguen afirmando: una decía
  // 26 capacidades cuando el archivo ya tenía 151, y otra 14/14 proofs cuando el smoke tiene 107. La cita se separó del
  // relato: la ruta queda en `runtime_evidence` —comprobable contra el libro— y la prosa en `runtime_evidence_note`,
  // etiquetada como nota. Y 53 capacidades resultaron no citar NINGÚN artefacto ejecutable: eso se declara, no se disfraza.
  const d=JSON.parse(fs.readFileSync(REC,"utf8")) as {capabilities:{id:string;runtime_evidence?:string}[]};
  const malas=d.capabilities
   .filter(c=>{const ev=(c.runtime_evidence??"").trim();return ev!=="SIN CITA EJECUTABLE"&&!/^\S+\.(mts|ts|tsx|mjs|sql|json|md)$/.test(ev);})
   .map(c=>`${c.id}: ${(c.runtime_evidence??"").slice(0,70)}`);
  expect(malas,"la cita de evidencia tiene que ser una ruta o la marca de ausencia").toEqual([]);
 });
 it("las capacidades sin evidencia ejecutable se cuentan y se listan, no se cuelan como respaldadas",()=>{
  const d=JSON.parse(fs.readFileSync(REC,"utf8")) as {capabilities:{runtime_evidence?:string}[]};
  const sinCita=d.capabilities.filter(c=>(c.runtime_evidence??"").trim()==="SIN CITA EJECUTABLE").length;
  expect(sinCita,"si llegara a cero, revisar: significaría que alguien les inventó una cita").toBeGreaterThan(0);
  const md=fs.readFileSync("docs/adjudication/c5-acceptance-dossier.md","utf8");
  expect(md,"el dossier tiene que declararlas").toMatch(/SIN evidencia ejecutable propia/);
  expect(md).toContain(`**${sinCita}**`);
 });
 it("los libros registran lo que corrió, sin credenciales",()=>{
  for(const p of [LIBRO_TESTS,LIBRO_PROOFS]){
   expect(fs.existsSync(p),`falta ${p}`).toBe(true);
   const txt=fs.readFileSync(p,"utf8");
   // Un libro versionado con una cadena de conexión sería un defecto peor que el que se está corrigiendo.
   expect(txt,`${p}: no puede contener una cadena de conexión`).not.toMatch(/postgres(ql)?:\/\//);
   expect(txt).not.toMatch(/password|sslmode|@127\.0\.0\.1/);
  }
  const proofs=JSON.parse(fs.readFileSync(LIBRO_PROOFS,"utf8")) as {target:string;results:{proof:string;status:string}[];gates?:{gate:string;status:string}[]};
  expect(proofs.target,"solo se declara la CLASE de destino, no la conexión").toMatch(/local-ephemeral|other|none/);
  expect(proofs.results.length).toBeGreaterThanOrEqual(100);
  expect(proofs.gates?.[0]?.gate).toBe("scripts/ci/live-smoke.mts");
 });
});

describe("lo que el dossier no puede fingir (R11-18, R11-19)",()=>{
 it("declara que cubre un subconjunto del registro, en vez de resumirlo en silencio",()=>{
  const src=fs.readFileSync(DOSSIER,"utf8");
  expect(src,"debe decir que lo que no aparece no está respaldado").toMatch(/Cobertura declarada/);
  expect(src).toMatch(/NO están respaldadas por este dossier/);
 });
 it("no presenta las decisiones del agente como aceptaciones humanas",()=>{
  const src=fs.readFileSync(DOSSIER,"utf8");
  expect(src,"tiene que decir que son propuestas de un agente").toMatch(/propuestas generadas por un agente/);
  expect(src,"y contar las firmas humanas, que hoy son cero").toMatch(/Capacidades con firma humana registrada/);
 });
 it("el dossier generado dice lo mismo que el gate",()=>{
  const md="docs/adjudication/c5-acceptance-dossier.md";
  expect(fs.existsSync(md)).toBe(true);
  const txt=fs.readFileSync(md,"utf8");
  expect(txt,"el estado de evidencia se declara como ejecución, no como existencia").toMatch(/EJECUTADA Y EN VERDE|NO RESPALDADA/);
  expect(txt).toMatch(/Libro de pruebas unitarias:/);
  expect(txt).toMatch(/0 de \d+/); // firmas humanas
 });
});
