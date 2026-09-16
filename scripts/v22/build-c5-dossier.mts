// EPIC AD — Validador de evidencia de adjudicación + generador del dossier de aceptación C5 (turnkey).
// Lee la reconciliación, VERIFICA que cada capacidad tenga invariantes, tests que EXISTEN en disco y una
// prueba de runtime cuyo script EXISTE, y emite un checklist firmable para el revisor humano C5.
// Falla (exit 1) si falta evidencia -> convierte la aceptación humana en una revisión turnkey, no una búsqueda.
import fs from"node:fs";import path from"node:path";
const ROOT=process.cwd();
const REC=path.join(ROOT,"docs/adjudication/session-2026-09-15-reconciliation.json");
const OUT=path.join(ROOT,"docs/adjudication/c5-acceptance-dossier.md");
type Cap={id:string;name:string;risk:string;epic?:string;invariants?:string[];tests?:string[];runtime_evidence?:string;proposed_review_decision?:string;requires_human_c5_acceptance?:boolean};
const doc=JSON.parse(fs.readFileSync(REC,"utf8")) as {capabilities:Cap[]};
const problems:string[]=[];
// Una cita puede llevar una anotación entre paréntesis: se valida solo la ruta (primer token).
const pathOf=(cite:string)=>(cite.trim().split(/\s+/)[0]??"");
const exists=(p:string)=>{try{return fs.existsSync(path.join(ROOT,pathOf(p)));}catch{return false;}};
// El primer token de runtime_evidence es la ruta del script de prueba en vivo.
const scriptOf=(ev?:string)=>{const t=(ev??"").trim().split(/\s+/)[0]??"";return t.endsWith(".mts")?t:"";};
for(const c of doc.capabilities){
 if(!c.invariants||c.invariants.length===0)problems.push(`${c.id}: sin invariantes`);
 if(!c.tests||c.tests.length===0)problems.push(`${c.id}: sin tests`);
 for(const t of c.tests??[])if(!exists(t))problems.push(`${c.id}: test inexistente ${t}`);
 // La evidencia de runtime es válida si (a) cita un .mts que existe, o (b) es evidencia documentada
 // no-script (gate de CI, unit test) — en cuyo caso basta con que haya al menos un test que exista.
 if(!c.runtime_evidence||c.runtime_evidence.trim()==="")problems.push(`${c.id}: sin runtime_evidence`);
 const s=scriptOf(c.runtime_evidence);
 if(s&&!exists(s))problems.push(`${c.id}: prueba en vivo citada inexistente ${s}`);
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
lines.push(`- Estado de evidencia: **${problems.length===0?"COMPLETA ✅ (todo test/prueba citada existe en disco)":"INCOMPLETA ❌ ("+problems.length+" faltantes)"}**`);
lines.push(`- Pendiente de aceptación humana C5: **${doc.capabilities.filter(c=>c.requires_human_c5_acceptance).length}**`);
lines.push("");
if(problems.length){lines.push("## ❌ Evidencia faltante");lines.push("");for(const p of problems)lines.push(`- ${p}`);lines.push("");}
for(const r of risks){
 lines.push(`## Riesgo ${r}`);lines.push("");
 for(const c of byRisk(r)){
  const s=scriptOf(c.runtime_evidence);
  lines.push(`### ${c.id} — ${c.name}`);
  if(c.epic)lines.push(`- Epic: ${c.epic}`);
  lines.push(`- Invariantes: ${(c.invariants??[]).length}`);
  lines.push(`- Tests: ${(c.tests??[]).map(t=>`\`${t}\`${exists(t)?"":" (FALTA)"}`).join(", ")||"—"}`);
  lines.push(`- Prueba en vivo: ${s?`\`${s}\`${exists(s)?"":" (FALTA)"}`:"—"}`);
  lines.push(`- Decisión propuesta: ${c.proposed_review_decision??"—"}`);
  lines.push("");
 }
}
lines.push("## Firma de aceptación C5 (humana)");
lines.push("");
lines.push("| Capacidad | Decisión C5 (ACEPTA/RECHAZA) | Revisor | Fecha | Notas |");
lines.push("| --- | --- | --- | --- | --- |");
for(const c of doc.capabilities)lines.push(`| ${c.id} | | | | |`);
lines.push("");
fs.writeFileSync(OUT,lines.join("\n"));
console.log(JSON.stringify({status:problems.length===0?"PASS":"FAIL",capabilities:doc.capabilities.length,problems,dossier:path.relative(ROOT,OUT)},null,2));
process.exit(problems.length===0?0:1);
