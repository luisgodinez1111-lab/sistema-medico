// `pnpm openapi:registry` — genera apps/web/lib/api-body-registry.ts: el mapa "MÉTODO ruta" -> esquema zod del cuerpo, derivado
// de las rutas reales (apps/web/app/api/**/route.ts -> handler -> `parseJson(req, XBody)` en apps/web/lib/*-lifecycle.ts).
// Auditoría S-10: los esquemas que valida cada handler son la fuente de verdad de la OpenAPI; este script los EXPORTA
// (si aún no lo están) y los enlaza. Se re-ejecuta al añadir rutas; `pnpm openapi:check` detecta la deriva.
import fs from"node:fs";import path from"node:path";
const ROOT=process.cwd();const API=path.join(ROOT,"apps/web/app/api");const LIB=path.join(ROOT,"apps/web/lib");
const libs=new Map<string,string>();for(const f of fs.readdirSync(LIB))if(f.endsWith(".ts"))libs.set(f,fs.readFileSync(path.join(LIB,f),"utf8"));
// handler -> {lib, schema}
const handlers=new Map<string,{lib:string;schema:string}>();
for(const[name,src]of libs){
 for(const m of src.matchAll(/export async function (handle\w+)\(/g)){
  const fn=m[1]!;const start=m.index!;const nxt=src.indexOf("\nexport async function",start+10);const body=src.slice(start,nxt>0?nxt:src.length);
  const b=/parseJson\(req,(\w+)\)/.exec(body);if(b)handlers.set(fn,{lib:name,schema:b[1]!});
 }
}
type Entry={key:string;lib:string;schema:string};const entries:Entry[]=[];
const walk=(d:string)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name==="route.ts"){
 const src=fs.readFileSync(p,"utf8");const rel=path.relative(API,p).split(path.sep).join("/");const oa="/api/"+rel.replace(/\/route\.ts$/,"").replace(/\[([^\]]+)\]/g,"{$1}");
 for(const m of src.matchAll(/export async function (POST|PUT|PATCH|DELETE)\b[^{]*\{([^\n]*)/g)){
  const h=/return (handle\w+)\(/.exec(m[2]!)??/(handle\w+)\(req/.exec(src.slice(m.index!,m.index!+400));const hb=h?handlers.get(h[1]!):undefined;
  if(hb)entries.push({key:`${m[1]} ${oa}`,lib:hb.lib,schema:hb.schema});
 }}}};
walk(API);
// exportar los esquemas referenciados que aún son privados
const needed=new Map<string,Set<string>>();for(const e of entries){if(!needed.has(e.lib))needed.set(e.lib,new Set());needed.get(e.lib)!.add(e.schema);}
let exported=0;
for(const[lib,names]of needed){let src=libs.get(lib)!;let changed=false;
 for(const n of names){const re=new RegExp(`(^|\\n)const ${n}=z\\.object`);if(re.test(src)){src=src.replace(re,`$1export const ${n}=z.object`);changed=true;exported++;}}
 if(changed){fs.writeFileSync(path.join(LIB,lib),src);libs.set(lib,src);}
}
const imports=new Map<string,Set<string>>();for(const e of entries){const mod="./"+e.lib.replace(/\.ts$/,"");if(!imports.has(mod))imports.set(mod,new Set());imports.get(mod)!.add(e.schema);}
const alias=(mod:string,s:string)=>`${mod.replace("./","").replace(/-lifecycle$/,"").replace(/[^a-zA-Z0-9]/g,"_")}__${s}`;
const lines:string[]=["// GENERADO por `pnpm openapi:registry` (scripts/ops/api-body-registry.mts). NO editar a mano.","// Auditoría S-10: mapa \"MÉTODO ruta\" -> esquema zod que valida el handler; alimenta docs/api/openapi.json.","import type{ZodType}from\"zod\";"];
for(const[mod,names]of[...imports].sort())lines.push(`import{${[...names].sort().map(n=>`${n} as ${alias(mod,n)}`).join(",")}}from"${mod}";`);
lines.push("export const API_BODY_SCHEMAS:Readonly<Record<string,ZodType>>={");
for(const e of [...entries].sort((a,b)=>a.key.localeCompare(b.key)))lines.push(` ${JSON.stringify(e.key)}:${alias("./"+e.lib.replace(/\.ts$/,""),e.schema)},`);
lines.push("};","");
const text=lines.join("\n");const out=path.join(LIB,"api-body-registry.ts");
if(process.argv.includes("--check")){
 if(exported>0||!fs.existsSync(out)||fs.readFileSync(out,"utf8")!==text){console.error("apps/web/lib/api-body-registry.ts está desfasado respecto a las rutas y handlers: ejecute pnpm openapi:registry && pnpm openapi:generate");process.exit(1);}
 console.log(`Registro de cuerpos al día: ${entries.length} rutas`);
}else{fs.writeFileSync(out,text);console.log(`api-body-registry.ts: ${entries.length} rutas de escritura con esquema (${exported} esquemas exportados ahora)`);}
