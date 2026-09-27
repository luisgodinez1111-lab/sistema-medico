import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{sourceFiles,edgesOf,specifiersOf,packageOf,cycles,closure,impurities}from"./_graph";
// Lote 11 (ADR-0300) — GUARDAS DE ARQUITECTURA. Fijan como reglas las propiedades sanas que hasta ahora se sostenían por
// convención (medidas el 2026-09-27 sobre el grafo real) y los trinquetes del refactor: lo que ya se limpió no vuelve.
// No sustituyen a packages/architecture-boundary (fijado en el manifiesto de evidencia); lo complementan.
const pkgFiles=sourceFiles("packages");
const packages=[...new Set(pkgFiles.map(f=>packageOf(f)!))].sort();
// Dominio puro: folds, calculadoras y reglas clínicas. Solo dependen de runtime-errors y de otros paquetes de dominio.
const DOMAIN=new Set([...packages.filter(p=>p.endsWith("-fold")),
 "prescription-safety","medication-validation","drug-catalog","lab-reference","care-gaps","anthropometrics","bp-staging","meld",
 "renal-function","acid-base","oxygenation","glycemic","anticoagulation","stroke-risk","pneumonia-severity","liver-fibrosis",
 "comorbidity","lab-derivations","immunization-schedule","terminology","mx-identity","clinical-intelligence",
 "encounter-domain","medication-domain","order-result-domain"]);
// Ciclos de archivo conocidos en apps/web/lib. El único (clinical-runtime <-> rate-limit-shared) lo rompió el lote 11.1.
const KNOWN_LIB_CYCLES:string[][]=[];
// Rutas que aún llevan el pipeline HTTP en línea (autorización o traducción de errores). Solo puede bajar; meta del lote 3: 0.
const MAX_FAT_ROUTES=43;

describe("guardas de arquitectura (ADR-0300)",()=>{
 it("los paquetes no importan apps/, scripts/ ni tests/",()=>{
  const out=pkgFiles.flatMap(f=>edgesOf(f).filter(t=>!t.startsWith("packages/")).map(t=>`${f} -> ${t}`));
  expect(out).toEqual([]);
 });
 it("no hay ciclos entre paquetes",()=>{
  const next=(p:string)=>[...new Set(pkgFiles.filter(f=>packageOf(f)===p).flatMap(edgesOf).map(packageOf).filter((q):q is string=>!!q&&q!==p))];
  expect(cycles(packages,next)).toEqual([]);
 });
 it("el dominio es puro: solo depende de runtime-errors y de otro dominio; sin reloj, azar, entorno ni Node",()=>{
  expect([...DOMAIN].filter(p=>!packages.includes(p)),"paquete de dominio inexistente en la lista").toEqual([]);
  const bad:string[]=[];
  for(const f of pkgFiles){const p=packageOf(f)!;if(!DOMAIN.has(p))continue;
   for(const t of edgesOf(f)){const q=packageOf(t)!;if(q!==p&&q!=="runtime-errors"&&!DOMAIN.has(q))bad.push(`${f} -> ${t}`);}
   for(const s of specifiersOf(f))if(!s.startsWith("."))bad.push(`${f} importa el módulo externo ${s}`);
   bad.push(...impurities(f));}
  expect(bad).toEqual([]);
 });
 it("apps/web/lib no tiene ciclos de importación nuevos (y los conocidos no vuelven una vez resueltos)",()=>{
  const lib=sourceFiles("apps/web/lib");
  expect(cycles(lib,f=>edgesOf(f).filter(t=>t.startsWith("apps/web/lib/")))).toEqual(KNOWN_LIB_CYCLES);
 });
 it("la persistencia (lib/runtime) no depende de casos de uso, del transporte HTTP ni de la fachada clinical-runtime",()=>{
  const runtime=sourceFiles("apps/web/lib/runtime");
  expect(runtime.length).toBeGreaterThan(10);
  const forbidden=(t:string)=>t==="apps/web/lib/clinical-runtime.ts"||t==="apps/web/lib/http-command.ts"||/-lifecycle\.ts$/.test(t)||/^apps\/web\/lib\/(http|command|queries|presenters)\//.test(t)||t.startsWith("apps/web/app/");
  const bad=runtime.flatMap(f=>edgesOf(f).filter(forbidden).map(t=>`${f} -> ${t}`));
  bad.push(...runtime.flatMap(f=>specifiersOf(f).filter(s=>s==="next/server"||s.startsWith("next/")).map(s=>`${f} importa ${s}`)));
  expect(bad).toEqual([]);
 });
 it("el middleware (Edge) solo carga módulos sin Node, sin postgres y sin la persistencia",()=>{
  const files=[...closure(["apps/web/middleware.ts"])];
  const bad=files.flatMap(f=>specifiersOf(f).filter(s=>!s.startsWith(".")&&s!=="next/server").map(s=>`${f} importa ${s}`));
  bad.push(...files.filter(f=>/clinical-runtime|\/runtime\//.test(f)).map(f=>`el middleware alcanza ${f}`));
  expect(bad).toEqual([]);
 });
 it("solo el pool (runtime/db), el ejecutor de comandos y el límite de tasa compartido tocan getSql(); lo demás usa withTenantTx",()=>{
  const allowed=new Set(["apps/web/lib/runtime/db.ts","apps/web/lib/runtime/command.ts","apps/web/lib/rate-limit-shared.ts"]);
  const users=sourceFiles("apps/web").filter(f=>/\bgetSql\(\)/.test(fs.readFileSync(f,"utf8")));
  expect(users.filter(f=>!allowed.has(f))).toEqual([]);
 });
 it("el código de cliente ('use client') no alcanza la persistencia, los casos de uso del servidor, secretos ni Node",()=>{
  const clients=sourceFiles("apps/web/app").filter(f=>/^\s*["']use client["']/.test(fs.readFileSync(f,"utf8")));
  expect(clients.length).toBeGreaterThan(20);
  const server=(t:string)=>/^apps\/web\/lib\/(runtime\/|clinical-runtime|http-command|http-errors|session-issuance|rate-limit-shared)|-lifecycle\.ts$/.test(t);
  const bad:string[]=[];
  for(const c of clients){const reach=[...closure([c])];
   bad.push(...reach.filter(server).map(t=>`${c} alcanza ${t}`));
   bad.push(...reach.flatMap(f=>specifiersOf(f).filter(s=>s.startsWith("node:")||s==="postgres"||s==="@vercel/blob").map(s=>`${c} alcanza ${f} que importa ${s}`)));}
  expect([...new Set(bad)]).toEqual([]);
 });
 it("la lectura de process.env en apps/web no se extiende a módulos nuevos (trinquete hacia una configuración única)",()=>{
  const KNOWN=["apps/web/app/login/page.tsx","apps/web/lib/ai-copilot-gateway.ts","apps/web/lib/csp.mjs","apps/web/lib/document-lifecycle.ts","apps/web/lib/feature-flags.ts","apps/web/lib/physician-profile-lifecycle.ts","apps/web/lib/runtime/db.ts","apps/web/lib/runtime/secrets.ts","apps/web/lib/session-issuance.ts","apps/web/middleware.ts","apps/web/next.config.mjs"];
  const readers=sourceFiles("apps/web",/\.(ts|tsx|mts|mjs)$/).filter(f=>/process\.env/.test(fs.readFileSync(f,"utf8")));
  expect(readers.filter(f=>!KNOWN.includes(f))).toEqual([]);
 });
 it(`a lo sumo ${MAX_FAT_ROUTES} rutas llevan el pipeline HTTP en línea (trinquete hacia rutas delgadas)`,()=>{
  const routes=sourceFiles("apps/web/app/api").filter(f=>f.endsWith("/route.ts"));
  expect(routes.length).toBeGreaterThan(100);
  const fat=routes.filter(f=>/authorize\(|toHttpError/.test(fs.readFileSync(f,"utf8")));
  expect(fat.length).toBeLessThanOrEqual(MAX_FAT_ROUTES);
 });
 it("los casos de uso cableados (*-lifecycle) pasan por el kit de transporte y el pipeline: sin preludio a mano, fachada ni streams sin tipo",()=>{
  // Lote 11.2: sesión, autorización y traducción de errores viven en endpoint(); la persistencia se importa de lib/runtime.
  // Hallazgo D4: los streams se leen TIPADOS (readAggregateStream); las lecturas sin tipo tampoco en las rutas.
  // Solo los módulos del registro NOT_WIRED (sin ruta; su retiro es decisión del dueño) conservan el patrón anterior.
  const notWired=new Set((JSON.parse(fs.readFileSync("docs/adjudication/not-wired-registry.json","utf8")) as{modules:{module:string}[]}).modules.map(m=>`apps/web/lib/${m.module}.ts`));
  const wired=sourceFiles("apps/web/lib").filter(f=>f.endsWith("-lifecycle.ts")&&!notWired.has(f));
  expect(wired.length).toBeGreaterThanOrEqual(27);
  const handWritten=wired.filter(f=>/\b(resolveVerified|authorize|toHttpError|readAggregateEvents|readEncounterEvents)\(/.test(fs.readFileSync(f,"utf8"))||specifiersOf(f).some(s=>/\/clinical-runtime$/.test(s)));
  expect(handWritten).toEqual([]);
  expect(sourceFiles("apps/web/app").filter(f=>/\b(readAggregateEvents|readEncounterEvents)\(/.test(fs.readFileSync(f,"utf8")))).toEqual([]);
 });
});
