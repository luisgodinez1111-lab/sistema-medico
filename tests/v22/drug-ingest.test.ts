import{describe,it,expect}from"vitest";
import{INGESTED_DRUGS}from"../../packages/drug-catalog/src/ingested-drugs";
import{ATC_CROSSWALK}from"../../packages/drug-catalog/src/atc-crosswalk";
import{resolveDrug,classHasRenalRule,checkRenalDosing}from"../../packages/drug-catalog/src/index";
// FASE 3 — invariantes de la INGESTA del vademécum (RxNorm/ATC vía RxNav). Garantizan que escalar el catálogo con un
// dataset autoritativo NO pueda fabricar farmacología ni degradar una barrera en silencio. Son puras (sin red): validan
// el artefacto generado y el crosswalk, no la API.

describe("crosswalk ATC→interna: solo apunta a clases admisibles",()=>{
 it("cada fila del crosswalk mapea a ≥1 clase interna con regla renal (si no, nunca podría admitir un fármaco)",()=>{
  const malas=ATC_CROSSWALK.filter(e=>!e.internal.some(classHasRenalRule)).map(e=>`${e.atc} (${e.internal.join(",")})`);
  expect(malas,"filas del crosswalk cuyas clases internas no tienen regla renal: inútiles o peligrosas").toEqual([]);
 });
 it("no hay códigos ATC duplicados en el crosswalk",()=>{
  const ids=ATC_CROSSWALK.map(e=>e.atc);
  expect(ids.length,"código ATC repetido en el crosswalk").toBe(new Set(ids).size);
 });
 it("cada fila declara el nombre de clase ATC esperado (el generador lo verifica contra RxNav)",()=>{
  for(const e of ATC_CROSSWALK){expect(e.atc).toMatch(/^[A-Z]\d{2}[A-Z]{2}$/);expect(e.atcName.length,`${e.atc} sin nombre ATC esperado`).toBeGreaterThan(3);expect(e.internal.length).toBeGreaterThan(0);}
 });
});

describe("entradas INGERIDAS: procedencia obligatoria y nunca inevaluables (fail-closed)",()=>{
 const entries=Object.entries(INGESTED_DRUGS);
 it("toda entrada ingerida lleva procedencia por fila (source RxNorm + atc) y clave===ingrediente",()=>{
  for(const[key,d]of entries){
   expect(d.source,`${key}: ingerida sin procedencia`).toMatch(/RxNorm rxcui:\d+/);
   expect(d.atc,`${key}: ingerida sin código ATC`).toBeTruthy();
   expect(d.ingredient,`${key}: la clave debe ser el ingrediente`).toBe(key);
   expect(d.classes.length,`${key}: sin clase`).toBeGreaterThan(0);
  }
 });
 it("toda entrada ingerida tiene ≥1 clase con regla renal: ninguna rompe el invariante renal del catálogo",()=>{
  const sinRenal=entries.filter(([,d])=>!d.classes.some(classHasRenalRule)).map(([k])=>k);
  expect(sinRenal,"ingeridas cuya clase no tiene regla renal (romperían la barrera renal)").toEqual([]);
  // Y de verdad son evaluables (no NOT_COVERED) con una TFG cualquiera.
  const noCubiertas=entries.filter(([k])=>checkRenalDosing(k,50).action==="NOT_COVERED").map(([k])=>k);
  expect(noCubiertas,"ingeridas que el motor reporta NOT_COVERED").toEqual([]);
 });
 it("cada entrada ingerida es REALMENTE resoluble por el motor (y no la ensombrece una curada)",()=>{
  for(const[key]of entries){
   const r=resolveDrug(key);
   expect(r,`${key}: ingerida pero no resuelve`).toBeTruthy();
   expect(r!.source,`${key}: la resuelve una entrada SIN procedencia (choque con una curada)`).toBeTruthy();
  }
 });
 it("las clases de las ingeridas provienen del crosswalk (no aparecen clases inventadas)",()=>{
  const permitidas=new Set(ATC_CROSSWALK.flatMap(e=>e.internal));
  const intrusas=new Set<string>();
  for(const[,d]of entries)for(const c of d.classes)if(!permitidas.has(c))intrusas.add(c);
  expect([...intrusas],"clases en ingeridas que ningún código ATC del crosswalk produce").toEqual([]);
 });
});
