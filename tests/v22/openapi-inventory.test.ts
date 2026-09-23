import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
import{buildOpenApi,methodsOf,toOpenApiPath,type RouteFile}from"../../packages/openapi-inventory/src";
import{deriveBodySchemas}from"../../apps/web/lib/openapi-bodies";
import{API_BODY_SCHEMAS}from"../../apps/web/lib/api-body-registry";
// Auditoría 2026-09-19 (S-10): la especificación OpenAPI se GENERA desde las rutas reales y el fichero versionado no puede
// quedar desfasado (el gate `pnpm openapi:check` y este test lo vigilan).
const API=path.join(process.cwd(),"apps/web/app/api");
function inventory():RouteFile[]{const out:RouteFile[]=[];const walk=(d:string)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name==="route.ts")out.push({path:path.relative(API,p).split(path.sep).join("/"),source:fs.readFileSync(p,"utf8")});}};walk(API);return out;}
describe("OpenAPI generada desde el inventario de rutas (S-10)",()=>{
 it("cada route.ts de apps/web/app/api aparece con sus métodos reales; docs/api/openapi.json coincide con lo generado",()=>{
  const routes=inventory();expect(routes.length).toBeGreaterThan(100);
  const version=(JSON.parse(fs.readFileSync("package.json","utf8")) as{version?:string}).version??"0.0.0";
  const bodies=deriveBodySchemas();
  const doc=buildOpenApi(routes,{version,bodies}) as{paths:Record<string,Record<string,{requestBody?:{content:{"application/json":{schema:{properties?:object}}}}}>>};
  for(const r of routes){const p=toOpenApiPath(r.path);const ms=methodsOf(r.source);if(ms.length)for(const m of ms)expect(doc.paths[p]?.[m.toLowerCase()],`${m} ${p}`).toBeTruthy();}
  // cada ruta del registro tiene un esquema JSON REAL (con propiedades) en la spec; el registro cubre la gran mayoría de escrituras
  for(const key of Object.keys(API_BODY_SCHEMAS)){const[m,p]=key.split(" ") as[string,string];expect(doc.paths[p]?.[m.toLowerCase()]?.requestBody?.content["application/json"].schema.properties,key).toBeTruthy();}
  const writes=routes.flatMap(r=>methodsOf(r.source).filter(m=>m!=="GET").map(m=>`${m} ${toOpenApiPath(r.path)}`));
  expect(Object.keys(API_BODY_SCHEMAS).length/writes.length).toBeGreaterThan(0.85);
  const committed=fs.readFileSync("docs/api/openapi.json","utf8");
  expect(committed).toBe(JSON.stringify(doc,null,1)+"\n");
 });
 it("las escrituras exigen Idempotency-Key, las transiciones If-Match, y las verticales hospitalarias declaran su flag",()=>{
  const doc=buildOpenApi([
   {path:"v1/medications/[medicationId]/prescription/route.ts",source:"// EPIC H\nexport async function POST(){}"},
   {path:"v1/admissions/route.ts",source:"export async function POST(){}\nexport async function GET(){}"},
  ],{version:"1"}) as{paths:Record<string,Record<string,{parameters:{name:string;required:boolean}[];"x-feature-flag"?:{env:string}}>>};
  const rx=doc.paths["/api/v1/medications/{medicationId}/prescription"]!["post"]!;
  expect(rx.parameters.map(x=>x.name)).toEqual(["medicationId","Idempotency-Key","If-Match"]);
  const adm=doc.paths["/api/v1/admissions"]!;
  expect(adm["post"]!["x-feature-flag"]?.env).toBe("ENABLE_HOSPITAL_VERTICALS");expect(adm["get"]!.parameters.map(x=>x.name)).toEqual([]);
 });
});
