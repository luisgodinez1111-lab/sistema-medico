// `pnpm openapi:generate` — escribe docs/api/openapi.json desde el inventario real de rutas (auditoría S-10).
// `pnpm openapi:generate -- --check` falla si el fichero versionado difiere del generado (deriva).
import fs from"node:fs";import path from"node:path";
import{buildOpenApi,type RouteFile}from"../../packages/openapi-inventory/src";
const ROOT=process.cwd();const API=path.join(ROOT,"apps/web/app/api");const OUT=path.join(ROOT,"docs/api/openapi.json");
export function inventory():RouteFile[]{const out:RouteFile[]=[];
 const walk=(d:string)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name==="route.ts")out.push({path:path.relative(API,p).split(path.sep).join("/"),source:fs.readFileSync(p,"utf8")});}};
 walk(API);return out;}
const version=(JSON.parse(fs.readFileSync(path.join(ROOT,"package.json"),"utf8")) as{version?:string}).version??"0.0.0";
const doc=buildOpenApi(inventory(),{version});
const text=JSON.stringify(doc,null,1)+"\n";
if(process.argv.includes("--check")){
 const cur=fs.existsSync(OUT)?fs.readFileSync(OUT,"utf8"):"";
 if(cur!==text){console.error("docs/api/openapi.json está desfasado respecto a las rutas: ejecute pnpm openapi:generate");process.exit(1);}
 console.log(`OpenAPI al día: ${Object.keys(doc["paths"] as object).length} rutas`);
}else{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,text);console.log(`docs/api/openapi.json: ${Object.keys(doc["paths"] as object).length} rutas`);}
