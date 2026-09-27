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
// Ciclos de archivo conocidos en apps/web/lib. La lista solo puede encogerse: el lote 1 (persistencia) la deja vacía.
const KNOWN_LIB_CYCLES:string[][]=[["apps/web/lib/clinical-runtime.ts","apps/web/lib/rate-limit-shared.ts"]];
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
 it("el middleware (Edge) solo carga módulos sin Node, sin postgres y sin la persistencia",()=>{
  const files=[...closure(["apps/web/middleware.ts"])];
  const bad=files.flatMap(f=>specifiersOf(f).filter(s=>!s.startsWith(".")&&s!=="next/server").map(s=>`${f} importa ${s}`));
  bad.push(...files.filter(f=>/clinical-runtime|\/runtime\//.test(f)).map(f=>`el middleware alcanza ${f}`));
  expect(bad).toEqual([]);
 });
 it(`a lo sumo ${MAX_FAT_ROUTES} rutas llevan el pipeline HTTP en línea (trinquete hacia rutas delgadas)`,()=>{
  const routes=sourceFiles("apps/web/app/api").filter(f=>f.endsWith("/route.ts"));
  expect(routes.length).toBeGreaterThan(100);
  const fat=routes.filter(f=>/authorize\(|toHttpError/.test(fs.readFileSync(f,"utf8")));
  expect(fat.length).toBeLessThanOrEqual(MAX_FAT_ROUTES);
 });
});
