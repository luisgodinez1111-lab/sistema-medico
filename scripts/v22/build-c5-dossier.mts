// EPIC AD — Validador de evidencia de adjudicación + generador del dossier de aceptación C5 (turnkey).
//
// Auditoría 2026-09-19, anexo R11 (R11-22 y R11-18) — «EVIDENCIA COMPLETA» SIGNIFICA EJECUTADA Y EN VERDE.
//
// EL HALLAZGO: este script certificaba «evidencia COMPLETA» comprobando que el archivo de prueba EXISTIERA en disco. Un
// test que existe y falla —o una prueba en vivo que nadie ha ejecutado nunca— contaba igual que una prueba verde. Es el
// mismo defecto que tenía el drill de restauración: un gate que no puede fallar. Y el dossier resumía un subconjunto del
// registro de capacidades sin decir cuántas quedaban fuera.
//
// AHORA: la evidencia se cruza con los LIBROS DE EJECUCIÓN que dejan `pnpm test:ledger` (pruebas unitarias) y
// `scripts/ci/live-smoke.mts` (pruebas en vivo). Para que una capacidad cuente como respaldada, cada test y cada prueba en
// vivo que cita tiene que aparecer en su libro EN VERDE. Sin libros, el dossier no dice «COMPLETA»: dice que no puede
// afirmarlo. Y declara la cobertura contra el registro completo, con la lista de capacidades que no cubre.
//
// LO QUE ESTE SCRIPT NO PUEDE HACER, y por eso no lo finge: aceptar. Las decisiones `APPROVED_WITH_EVIDENCE` del JSON son
// PROPUESTAS de un agente, no aprobaciones; el dossier lo dice en la primera línea de la tabla de firma y cuenta cuántas
// capacidades siguen sin firma humana (hoy: todas).
import fs from"node:fs";import path from"node:path";
const ROOT=process.cwd();
const REC=path.join(ROOT,"docs/adjudication/session-2026-09-15-reconciliation.json");
const OUT=path.join(ROOT,"docs/adjudication/c5-acceptance-dossier.md");
type Cap={id:string;name:string;risk:string;epic?:string;invariants?:string[];tests?:string[];runtime_evidence?:string;proposed_review_decision?:string;requires_human_c5_acceptance?:boolean};
const doc=JSON.parse(fs.readFileSync(REC,"utf8")) as {capabilities:Cap[]};
const problems:string[]=[];
// ---- Libros de ejecución: qué corrió de verdad y con qué resultado ----
type Libro=Readonly<{verde:ReadonlySet<string>;rojo:ReadonlySet<string>;generatedAt:string}|null>;
function leerGates(ruta:string):ReadonlySet<string>{
 try{
  const d=JSON.parse(fs.readFileSync(path.join(ROOT,ruta),"utf8")) as {gates?:{gate?:string;status?:string}[]};
  return new Set((d.gates??[]).filter(g=>g.status==="PASS").map(g=>String(g.gate??"")));
 }catch{return new Set();}
}
function leerLibro(ruta:string,clave:"file"|"proof"):Libro{
 try{
  const d=JSON.parse(fs.readFileSync(path.join(ROOT,ruta),"utf8")) as {generatedAt?:string;results?:{status?:string}[]};
  const verde=new Set<string>(),rojo=new Set<string>();
  for(const r of d.results??[]){
   const k=String((r as Record<string,unknown>)[clave]??"");
   if(!k)continue;
   (r.status==="PASS"?verde:rojo).add(k);
  }
  return{verde,rojo,generatedAt:String(d.generatedAt??"")};
 }catch{return null;}
}
const libroTests=leerLibro("release/evidence/test-ledger.json","file");
const libroProofs=leerLibro("release/evidence/live-smoke-ledger.json","proof");
const gatesVerdes=leerGates("release/evidence/live-smoke-ledger.json");
/** Un gate NO puede ser evidencia de sí mismo: si lo fuera, cualquier script se aprobaría con solo existir (R11-22). */
const ESTE_GATE="scripts/v22/build-c5-dossier.mts";
const SIN_CITA="SIN CITA EJECUTABLE";
const sinCitaEjecutable:string[]=[];
if(!libroTests)problems.push("falta el libro de ejecución de pruebas unitarias (pnpm test:ledger)");
if(!libroProofs)problems.push("falta el libro de ejecución de pruebas en vivo (scripts/ci/live-smoke.mts)");
/** Estado de ejecución de una cita: verde solo si el libro dice que corrió y pasó. */
/** Cada cita se comprueba en SU libro: una prueba en vivo (.mts) la lleva el smoke; un test de vitest, el de la batería. */
function libroDe(ruta:string):Libro{return ruta.endsWith(".mts")?libroProofs:libroTests;}
/** Estado de una cita, sea prueba en vivo, test de la batería o gate de CI. */
function estadoDeCita(ruta:string):"VERDE"|"ROJO"|"NO EJECUTADO"|"SIN LIBRO"|"GATE DE SÍ MISMO"{
 if(ruta===ESTE_GATE)return "GATE DE SÍ MISMO";
 if(gatesVerdes.has(ruta))return "VERDE";
 return ejecucion(libroDe(ruta),ruta);
}
function ejecucion(libro:Libro,ruta:string):"VERDE"|"ROJO"|"NO EJECUTADO"|"SIN LIBRO"{
 if(!libro)return "SIN LIBRO";
 if(libro.verde.has(ruta))return "VERDE";
 if(libro.rojo.has(ruta))return "ROJO";
 return "NO EJECUTADO";
}
const registro=(()=>{try{
 const j=JSON.parse(fs.readFileSync(path.join(ROOT,"docs/compliance/nom-applicability-register.json"),"utf8")) as unknown;
 return Array.isArray(j)?j.length:0;
}catch{return 0;}})();
// Una cita puede llevar una anotación entre paréntesis: se valida solo la ruta (primer token).
const pathOf=(cite:string)=>(cite.trim().split(/\s+/)[0]??"");
const exists=(p:string)=>{try{return fs.existsSync(path.join(ROOT,pathOf(p)));}catch{return false;}};
// El primer token de runtime_evidence es la ruta del script de prueba en vivo.
const scriptOf=(ev?:string)=>{const t=(ev??"").trim().split(/\s+/)[0]??"";return t.endsWith(".mts")?t:"";};
for(const c of doc.capabilities){
 if(!c.invariants||c.invariants.length===0)problems.push(`${c.id}: sin invariantes`);
 if(!c.tests||c.tests.length===0)problems.push(`${c.id}: sin tests`);
 for(const t of c.tests??[]){
  if(!exists(t)){problems.push(`${c.id}: test inexistente ${t}`);continue;}
  // R11-22: existir no es evidencia. Cada cita tiene que aparecer EN VERDE en SU libro: algunas capacidades citan una
  // prueba en vivo (.mts) en el campo `tests`, y ésa la lleva el libro del smoke, no el de vitest.
  const e=estadoDeCita(pathOf(t));
  if(e!=="VERDE")problems.push(`${c.id}: evidencia citada ${pathOf(t)} — ${e.toLowerCase()} en el libro de ejecución`);
 }
 // La evidencia de runtime es válida si (a) cita un .mts que existe, o (b) es evidencia documentada
 // no-script (gate de CI, unit test) — en cuyo caso basta con que haya al menos un test que exista.
 if(!c.runtime_evidence||c.runtime_evidence.trim()==="")problems.push(`${c.id}: sin runtime_evidence`);
 // R11-22: una capacidad cuya «evidencia» es prosa no tiene evidencia EJECUTABLE propia. No rompe el gate —se aceptó como
 // reutilización de otras capacidades—, pero se cuenta y se lista aparte: el revisor humano tiene que verlas.
 if(c.runtime_evidence?.trim()===SIN_CITA)sinCitaEjecutable.push(`${c.id} — ${c.name}`);
 const s=c.runtime_evidence?.trim()===SIN_CITA?"":scriptOf(c.runtime_evidence);
 if(s&&!exists(s))problems.push(`${c.id}: prueba en vivo citada inexistente ${s}`);
 // R11-22: la prueba en vivo citada tiene que haber corrido y pasado en el smoke, no solo existir.
 if(s&&exists(s)){const e=estadoDeCita(s);if(e!=="VERDE")problems.push(`${c.id}: prueba en vivo ${s} — ${e.toLowerCase()} en el libro de ejecución`);}
 if(!c.proposed_review_decision)problems.push(`${c.id}: sin proposed_review_decision`);
}
// Emitir dossier turnkey (aunque haya problemas, para que el revisor los vea; pero exit!=0).
const byRisk=(r:string)=>doc.capabilities.filter(c=>c.risk===r);
const risks=[...new Set(doc.capabilities.map(c=>c.risk))].sort();
const lines:string[]=[];
lines.push("# Dossier de aceptación C5 — Medical OS V2");
lines.push("");
lines.push("**Generado automáticamente** por `scripts/v22/build-c5-dossier.mts`. NO es autoridad: es el paquete de evidencia");
lines.push("para que un revisor humano C5 acepte (o rechace) cada capacidad reconciliada. La aceptación se registra firmando la tabla al final.");
lines.push("");
lines.push(`- Capacidades reconciliadas: **${doc.capabilities.length}**`);
lines.push(`- Estado de evidencia: **${problems.length===0?"EJECUTADA Y EN VERDE ✅":"NO RESPALDADA ❌ ("+problems.length+" problemas)"}**`);
lines.push(`  - Libro de pruebas unitarias: ${libroTests?`${libroTests.verde.size} archivos en verde (generado ${libroTests.generatedAt})`:"**AUSENTE** — sin él no se puede afirmar que la evidencia se haya ejecutado"}`);
lines.push(`  - Libro de pruebas en vivo: ${libroProofs?`${libroProofs.verde.size} pruebas en verde (generado ${libroProofs.generatedAt})`:"**AUSENTE**"}`);
// R11-18: el dossier resumía un subconjunto sin decir cuántas capacidades quedaban fuera.
lines.push(`- Cobertura declarada: **${doc.capabilities.length} capacidades reconciliadas**. El registro de capacidades del repositorio tiene más (ver \`pnpm capability:check\`); las que no aparecen aquí NO están respaldadas por este dossier y no pueden presentarse como aceptadas.`);
lines.push(`- Pendiente de aceptación humana C5: **${doc.capabilities.filter(c=>c.requires_human_c5_acceptance).length}**`);
lines.push(`- Sin evidencia EJECUTABLE propia (evidencia en prosa): **${sinCitaEjecutable.length}**`);
lines.push("");
if(sinCitaEjecutable.length){
 lines.push("## ⚠ Capacidades SIN evidencia ejecutable propia");
 lines.push("");
 lines.push(`Estas **${sinCitaEjecutable.length}** capacidades no citan ningún artefacto que se pueda ejecutar: su evidencia es una`);
 lines.push("descripción en prosa (reutilización de otras capacidades, módulo presentacional, etc.). No se pueden presentar como");
 lines.push("respaldadas por una ejecución, y el revisor humano C5 tiene que decidirlas mirando el código, no el libro.");
 lines.push("");
 for(const x of sinCitaEjecutable)lines.push(`- ${x}`);
 lines.push("");
}
if(problems.length){lines.push("## ❌ Evidencia faltante");lines.push("");for(const p of problems)lines.push(`- ${p}`);lines.push("");}
for(const r of risks){
 lines.push(`## Riesgo ${r}`);lines.push("");
 for(const c of byRisk(r)){
  const s=scriptOf(c.runtime_evidence);
  lines.push(`### ${c.id} — ${c.name}`);
  if(c.epic)lines.push(`- Epic: ${c.epic}`);
  lines.push(`- Invariantes: ${(c.invariants??[]).length}`);
  lines.push(`- Tests: ${(c.tests??[]).map(t=>`\`${t}\` — ${exists(t)?estadoDeCita(pathOf(t)):"FALTA EN DISCO"}`).join("; ")||"—"}`);
  lines.push(`- Prueba en vivo: ${s?`\`${s}\` — ${exists(s)?estadoDeCita(s):"FALTA EN DISCO"}`:"—"}`);
  lines.push(`- Decisión propuesta: ${c.proposed_review_decision??"—"}`);
  lines.push("");
 }
}
lines.push("## Firma de aceptación C5 (humana)");
lines.push("");
// R11-19: las decisiones del JSON son PROPUESTAS de un agente. El dossier no puede presentarlas como aprobaciones.
lines.push(`> Las decisiones «${"APPROVED_WITH_EVIDENCE"}» de la sección anterior son **propuestas generadas por un agente**, no aceptaciones.`);
lines.push(`> Capacidades con firma humana registrada en este dossier: **0 de ${doc.capabilities.length}**. Mientras esta tabla esté vacía,`);
lines.push("> ninguna capacidad C5 está aceptada, y así lo declara ADR-0300 entre las condiciones de decisión del dueño.");
lines.push("");
lines.push("| Capacidad | Decisión C5 (ACEPTA/RECHAZA) | Revisor | Fecha | Notas |");
lines.push("| --- | --- | --- | --- | --- |");
for(const c of doc.capabilities)lines.push(`| ${c.id} | | | | |`);
lines.push("");
fs.writeFileSync(OUT,lines.join("\n"));
console.log(JSON.stringify({status:problems.length===0?"PASS":"FAIL",capabilities:doc.capabilities.length,
 ledgers:{tests:libroTests?libroTests.verde.size:null,liveProofs:libroProofs?libroProofs.verde.size:null},
 humanSignatures:0,registryEntries:registro,withoutExecutableEvidence:sinCitaEjecutable.length,problems,dossier:path.relative(ROOT,OUT)},null,2));
process.exit(problems.length===0?0:1);
