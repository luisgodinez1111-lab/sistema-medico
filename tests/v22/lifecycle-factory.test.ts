import{describe,it,expect}from"vitest";
import fs from "node:fs";
import{CONSENT_METHODS}from"../../apps/web/lib/consent-lifecycle";
import{foldConsent}from"../../packages/consent-fold/src";
// Auditoría 2026-09-19, anexo R02a — TPL-01 (la tríada authz→loadForTransition→commit estaba COPIADA en 25 ciclos de vida,
// idéntica en 18: «el mismo bug de plantilla se repitió en varios archivos») y CON-01 (la «firma» del consentimiento era
// un nombre en texto libre, sin documento, sin modalidad y sin artefacto).
const LIB="apps/web/lib";
const lifecycles=fs.readdirSync(LIB).filter(f=>f.endsWith("-lifecycle.ts"));
const leer=(f:string):string=>fs.readFileSync(`${LIB}/${f}`,"utf8");

describe("la plantilla de ciclo de vida vive en un solo sitio (R02a-TPL-01)",()=>{
 it("la fábrica existe y NO se llama «-lifecycle» (no es un handler de dominio)",()=>{
  expect(fs.existsSync(`${LIB}/lifecycle-factory.ts`)).toBe(true);
  expect(fs.existsSync(`${LIB}/aggregate-lifecycle.ts`),"un nombre *-lifecycle.ts obligaría a declararlo NOT_WIRED").toBe(false);
 });
 it("al menos 18 ciclos de vida la usan",()=>{
  const usan=lifecycles.filter(f=>leer(f).includes('from"./lifecycle-factory"'));
  expect(usan.length).toBeGreaterThanOrEqual(18);
 });
 it("ninguno de los que la usan reimplementa la tríada",()=>{
  const reimplementan=lifecycles.filter(f=>{
   const s=leer(f);
   return s.includes('from"./lifecycle-factory"')&&(s.includes("async function loadForTransition")||s.includes("async function commit("));
  });
  expect(reimplementan).toEqual([]);
 });
 it("la fábrica consulta el REPLAY antes de validar la transición (un reintento no choca con la máquina)",()=>{
  const src=fs.readFileSync(`${LIB}/lifecycle-factory.ts`,"utf8");
  const replay=src.indexOf("await lookupReplay");
  const assert=src.indexOf("spec.assertTransition");
  expect(replay).toBeGreaterThan(-1);
  expect(assert).toBeGreaterThan(replay);
 });
 it("la fábrica valida If-Match contra la versión LEÍDA tras el replay y antes de la máquina (hallazgo D7)",()=>{
  const src=fs.readFileSync(`${LIB}/lifecycle-factory.ts`,"utf8");
  const replay=src.indexOf("await lookupReplay");
  const version=src.indexOf("assertReadVersion(",replay);
  const assert=src.indexOf("spec.assertTransition(",replay);
  expect(version,"sin assertReadVersion tras el replay").toBeGreaterThan(replay);
  expect(assert,"la máquina de estados va DESPUÉS de la versión").toBeGreaterThan(version);
  // Y la anotación (sin máquina) también compara la versión antes de escribir.
  const anot=/const commitAnnotation=async[\s\S]*?\n \};/.exec(src)?.[0]??"";
  expect(anot).not.toBe("");
  expect(anot.indexOf("assertReadVersion(")).toBeGreaterThan(anot.indexOf("await lookupReplay"));
  expect(anot.indexOf("runClinicalCommand(")).toBeGreaterThan(anot.indexOf("assertReadVersion("));
 });
 it("todo ciclo que evalúa una regla de transición/anotación compara la versión leída con el helper único (D7)",()=>{
  // Los que delegan en la fábrica heredan la comprobación; los de forma propia deben llamarla ellos, antes de la regla.
  const regla=/assert\w*(Transition|Annotation|Voidable|Correctable)\(/;
  const sinVersion=lifecycles.filter(f=>{
   const s=leer(f).split("\n").filter(l=>!/^\s*(\/\/|\*|import)/.test(l)).join("\n");
   return regla.test(s)&&!s.includes('from"./lifecycle-factory"')&&!s.includes("assertReadVersion(");
  });
  expect(sinVersion,"ciclo con regla de transición y sin assertReadVersion").toEqual([]);
  // Dentro de cada función que consulta el replay, la versión va antes que la primera regla.
  const desordenados:string[]=[];
  for(const f of lifecycles){
   const s=leer(f).split("\n").map(l=>l.replace(/(^|[;{}])\s*\/\/.*$/,"$1")).join("\n"); // sin comentarios que citen la regla
   for(const m of s.matchAll(/await lookupReplay\([^)]*\);[\s\S]*?runClinicalCommand\(/g)){
    const tramo=m[0];const r=tramo.search(regla);if(r<0)continue;
    const v=tramo.indexOf("assertReadVersion(");
    if(v<0||v>r)desordenados.push(`${f}: ${tramo.slice(0,80).replace(/\s+/g," ")}…`);
   }
  }
  expect(desordenados,"regla evaluada antes (o sin) comparar If-Match con la versión leída").toEqual([]);
 });
 it("la comparación de versión vive en UN sitio: ningún ciclo la reescribe en línea (D7)",()=>{
  const enLinea=fs.readdirSync(LIB).filter(f=>f.endsWith(".ts")&&f!=="http-command.ts")
   .filter(f=>/expectedVersion!==\w+\.version|\.version!==expectedVersion/.test(fs.readFileSync(`${LIB}/${f}`,"utf8")));
  expect(enLinea,"use assertReadVersion de http-command").toEqual([]);
  const hc=fs.readFileSync(`${LIB}/http-command.ts`,"utf8");
  expect(hc).toMatch(/export function assertReadVersion\(changed:string,expected:number,actual:number\):void\{\s*if\(expected!==actual\)throw new ClinicalError\("CONCURRENCY_CONFLICT",changed,\{expected,actual\}\);/);
 });
 it("la fábrica autoriza ANTES de leer nada y exige las cabeceras de mutación",()=>{
  const src=fs.readFileSync(`${LIB}/lifecycle-factory.ts`,"utf8");
  // Se compara el orden DENTRO del cuerpo de loadForTransition (en el fichero, el import de readAggregateStream va antes).
  const cuerpo=/const loadForTransition=async[\s\S]*?\n \};/.exec(src)?.[0]??"";
  expect(cuerpo,"no se encontró loadForTransition").not.toBe("");
  const authz=cuerpo.indexOf("spec.authz(");
  const lectura=cuerpo.indexOf("readAggregateStream");
  expect(authz).toBeGreaterThan(-1);
  expect(lectura).toBeGreaterThan(authz);
  expect(src).toContain("requireMutationHeaders");
  expect(src).toMatch(/if\(!folded\.exists\)throw new ClinicalError\("NOT_FOUND"/);
 });
 it("los siete ciclos con forma propia siguen con su implementación (no se forzaron a la plantilla)",()=>{
  const propios=["document","medication","patient","result","imaging","adaptive-history","vital"];
  for(const d of propios){
   const f=`${d}-lifecycle.ts`;
   if(!fs.existsSync(`${LIB}/${f}`))continue; // los no cableados pueden haberse retirado
   expect(leer(f),`${f} no debe usar la fábrica: su forma es distinta`).not.toContain('from"./lifecycle-factory"');
  }
 });
});

describe("firma del consentimiento informado (R02a-CON-01)",()=>{
 const src=leer("consent-lifecycle.ts");
 it("otorgar exige la huella del documento presentado",()=>{
  expect(src).toMatch(/documentHash:z\.string\(\)\.regex\(\/\^\[0-9a-f\]\{64\}\$\//);
  expect(src).toContain("CONSENT_DOCUMENT_MISMATCH");
 });
 it("las tres modalidades están declaradas y cada una tiene su exigencia",()=>{
  expect(CONSENT_METHODS).toEqual(["WET_SIGNATURE","ELECTRONIC_SIGNATURE","VERBAL_WITNESSED"]);
  expect(src).toContain("SIGNATURE_ARTIFACT_REQUIRED"); // firma autógrafa o electrónica: artefacto obligatorio
  expect(src).toContain("WITNESS_REQUIRED");            // verbal: testigo obligatorio
 });
 it("no se finge verificación de identidad del firmante",()=>{
  expect(src).toMatch(/signerIdentityVerified:false/);
  expect(src).toMatch(/RENAPO\/INE|registro oficial/);
 });
 it("el fold conserva la huella declarada al presentar (el último valor gana)",()=>{
  const f=foldConsent([
   {sequence:1,payload:{kind:"DRAFTED",patientId:"p",scopeType:"PROCEDURE",documentRef:"doc"}},
   {sequence:2,payload:{kind:"PRESENTED",documentHash:"a".repeat(64)}},
  ]);
  expect(f.state).toBe("PRESENTED");
  expect(f.documentHash).toBe("a".repeat(64));
 });
 it("un consentimiento antiguo sin huella sigue plegándose (no rompe lo ya registrado)",()=>{
  const f=foldConsent([{sequence:1,payload:{kind:"DRAFTED",patientId:"p",scopeType:"TREATMENT",documentRef:"doc"}}]);
  expect(f.documentHash).toBeUndefined();
  expect(f.exists).toBe(true);
 });
 it("el criterio médico-legal está escrito en el código",()=>{
  expect(src).toMatch(/LGS art\. 81/);
  expect(src).toMatch(/no es una firma, es una afirmación/);
 });
});
