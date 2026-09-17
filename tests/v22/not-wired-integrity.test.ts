import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// EPIC BF (endurecimiento G) — Guard de la ley no-orphan (EXEC-0003): TODO handler *-lifecycle.ts debe
// estar cableado a una ruta O declarado en el registro NOT_WIRED. Cierra el hallazgo #10 de la auditoría
// (código muerto que inflaba el avance) y mantiene el registro HONESTO: si un huérfano se cablea, hay que
// removerlo del registro; si aparece un nuevo huérfano sin declarar, este test falla.
const LIB="apps/web/lib";
const APP="apps/web/app";
const REGISTRY="docs/adjudication/not-wired-registry.json";
function walk(dir:string):string[]{
 const out:string[]=[];
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,e.name);
  if(e.isDirectory())out.push(...walk(p));
  else if(/\.(ts|tsx)$/.test(e.name))out.push(p);
 }
 return out;
}
const appSource=walk(APP).map(f=>fs.readFileSync(f,"utf8")).join("\n");
// "cableado" = algún archivo bajo apps/web/app importa el módulo (su nombre base aparece en un import).
function isWired(base:string):boolean{return new RegExp(`lib/${base}["'\\.]`).test(appSource)||appSource.includes(`/${base}"`)||appSource.includes(`/${base}'`);}
const lifecycles=fs.readdirSync(LIB).filter(f=>f.endsWith("-lifecycle.ts")).map(f=>f.replace(/\.ts$/,""));
const registry=JSON.parse(fs.readFileSync(REGISTRY,"utf8")) as{modules:{module:string;decision:string;classification:string}[]};
const declared=new Set(registry.modules.map(m=>m.module));

describe("no-orphan guard: registro NOT_WIRED honesto (EPIC BF)",()=>{
 it("todo *-lifecycle.ts está cableado a una ruta O declarado NOT_WIRED (sin huérfanos ocultos)",()=>{
  const undeclaredOrphans=lifecycles.filter(b=>!isWired(b)&&!declared.has(b));
  expect(undeclaredOrphans,`Handlers huérfanos NO declarados en ${REGISTRY}: ${undeclaredOrphans.join(", ")}`).toEqual([]);
 });
 it("ningún módulo declarado NOT_WIRED aparece cableado (registro no obsoleto)",()=>{
  const staleWired=registry.modules.filter(m=>isWired(m.module));
  expect(staleWired.map(m=>m.module),"Módulos listados como NOT_WIRED pero ahora cableados: remuévelos del registro").toEqual([]);
 });
 it("cada entrada del registro apunta a un archivo existente y tiene decision NOT_WIRED",()=>{
  for(const m of registry.modules){
   expect(fs.existsSync(path.join(LIB,`${m.module}.ts`)),`registro apunta a un archivo inexistente: ${m.module}`).toBe(true);
   expect(m.decision).toBe("NOT_WIRED");
   expect(m.classification.length).toBeGreaterThan(0);
  }
 });
 it("los 8 huérfanos conocidos de la auditoría están declarados",()=>{
  const known=["adaptive-history-lifecycle","ai-gateway-lifecycle","clinical-inbox-lifecycle","clinical-intelligence-lifecycle","document-ingestion-lifecycle","imaging-lifecycle","lab-order-lifecycle","prescription-lifecycle"];
  for(const k of known)expect(declared.has(k),`falta declarar ${k}`).toBe(true);
 });
});
