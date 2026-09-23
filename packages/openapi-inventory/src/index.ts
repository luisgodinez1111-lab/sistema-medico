// Auditoría 2026-09-19 (S-10) — Especificación OpenAPI 3.1 GENERADA a partir del inventario real de rutas
// (apps/web/app/api/**/route.ts). Puro: recibe el listado de ficheros ya leído y produce el documento. Declara con
// honestidad lo que hay: métodos, parámetros de ruta, cabeceras obligatorias de escritura (Idempotency-Key, If-Match en
// transiciones), autenticación (cookie httpOnly o Bearer), el sobre de error único de apps/web/lib/http-errors.ts, los
// códigos de respuesta comunes y el flag de las verticales hospitalarias. Los cuerpos se validan con zod en cada handler
// (la spec enlaza el fichero); su esquema JSON se incorporará handler a handler exportando cada zod (pendiente declarado).
export type RouteFile=Readonly<{path:string;source:string}>; // path relativo a apps/web/app/api, p. ej. "v1/patients/[patientId]/timeline/route.ts"
export type OpenApiDoc=Readonly<Record<string,unknown>>;
const HTTP=["GET","POST","PUT","PATCH","DELETE"] as const;
export const HOSPITAL_VERTICALS=["admissions","dialysis-sessions","specimens","surgeries","transfusions","triage","wounds"] as const;
const ERROR_CODES:Record<string,string>={"400":"VALIDATION_ERROR (cuerpo o parámetros inválidos)","401":"UNAUTHENTICATED (sin sesión válida)","403":"FORBIDDEN / CROSS_TENANT / SAFETY_BLOCKED","404":"NOT_FOUND (recurso o paciente inexistente en el tenant)","409":"CONFLICT / CONCURRENCY_CONFLICT / IDEMPOTENCY_CONFLICT","428":"PRECONDITION_REQUIRED (Idempotency-Key, cédula profesional) o SAFETY_ACK_REQUIRED","429":"RATE_LIMITED (Retry-After)","503":"DEPENDENCY_UNAVAILABLE (base de datos o almacén no disponibles)"};
export function methodsOf(source:string):string[]{return HTTP.filter(m=>new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(source));}
export function summaryOf(source:string):string{const m=source.match(/^\/\/\s*(.+)$/m);return m?m[1]!.trim():"";}
export function toOpenApiPath(file:string):string{return "/api/"+file.replace(/\/route\.ts$/,"").replace(/\[([^\]]+)\]/g,"{$1}");}
const isTransition=(p:string)=>/\{[^}]+\}\/[^/{}]+$/.test(p); // /resource/{id}/accion
// `bodies`: esquema JSON (JSON Schema 2020-12, derivado del zod del handler) por "MÉTODO ruta"; si falta, el cuerpo se declara opaco.
export type BodySchemas=Readonly<Record<string,Readonly<Record<string,unknown>>>>;
export function buildOpenApi(routes:readonly RouteFile[],info:{version:string;commit?:string;bodies?:BodySchemas}):OpenApiDoc{
 const bodies=info.bodies??{};let withSchema=0;
 const paths:Record<string,Record<string,unknown>>={};
 for(const r of [...routes].sort((a,b)=>a.path.localeCompare(b.path))){
  const p=toOpenApiPath(r.path);const methods=methodsOf(r.source);if(methods.length===0)continue;
  const params=[...p.matchAll(/\{([^}]+)\}/g)].map(m=>({name:m[1]!,in:"path",required:true,schema:{type:"string",format:"uuid"}}));
  const vertical=HOSPITAL_VERTICALS.find(v=>p.startsWith(`/api/v1/${v}`));
  const item:Record<string,unknown>={};
  for(const m of methods){
   const write=m!=="GET";
   const headers=write?[{name:"Idempotency-Key",in:"header",required:true,schema:{type:"string"},description:"Clave única por intento; el reintento con la misma clave y el mismo cuerpo devuelve la misma respuesta (200, replayed:true); otro cuerpo -> 409 IDEMPOTENCY_CONFLICT"}]:[];
   if(write&&isTransition(p))headers.push({name:"If-Match",in:"header",required:true,schema:{type:"string"},description:"Versión del agregado leída (concurrencia optimista); desfasada -> 409 CONCURRENCY_CONFLICT"});
   const responses:Record<string,unknown>={[write?"201":"200"]:{description:write?"Comando aplicado (200 con replayed:true si es un reintento idempotente)":"OK",content:{"application/json":{schema:{type:"object"}}}}};
   for(const[code,desc]of Object.entries(ERROR_CODES))responses[code]={description:desc,content:{"application/json":{schema:{$ref:"#/components/schemas/ErrorEnvelope"}}}};
   const schema=bodies[`${m} ${p}`];
   const op:Record<string,unknown>={summary:summaryOf(r.source)||p,tags:[p.split("/")[3]??"api"],parameters:[...params,...headers],responses,security:[{sessionCookie:[]},{bearer:[]}],
    "x-handler":`apps/web/app/api/${r.path}`,"x-body-validation":write?(schema?"zod en el handler; esquema JSON derivado con z.toJSONSchema (apps/web/lib/api-body-registry.ts)":"validado en la ruta o multipart: sin esquema JSON exportable"):undefined};
   if(write){if(schema)withSchema++;op["requestBody"]={required:true,content:{"application/json":{schema:schema??{type:"object",additionalProperties:true,description:"Validado en el handler; campos comunes: occurredAt (ISO 8601 UTC)"}}}};}
   if(vertical)op["x-feature-flag"]={env:"ENABLE_HOSPITAL_VERTICALS",default:"false",whenOff:"404"};
   item[m.toLowerCase()]=Object.fromEntries(Object.entries(op).filter(([,v])=>v!==undefined));
  }
  paths[p]=item;
 }
 return{openapi:"3.1.0",info:{title:"Medical OS — API clínica",version:info.version,...(info.commit?{"x-commit":info.commit}:{}),description:"Generada desde el inventario real de rutas (pnpm openapi:generate). Sesión: cookie httpOnly medos_session o Authorization: Bearer. Toda respuesta de la API lleva Cache-Control: no-store.","x-bodies-with-schema":withSchema},
  servers:[{url:"/"}],
  components:{securitySchemes:{sessionCookie:{type:"apiKey",in:"cookie",name:"medos_session"},bearer:{type:"http",scheme:"bearer"}},
   schemas:{ErrorEnvelope:{type:"object",required:["error"],properties:{error:{type:"object",required:["code","message"],properties:{code:{type:"string",enum:["VALIDATION_ERROR","UNAUTHENTICATED","FORBIDDEN","CROSS_TENANT","NOT_FOUND","CONFLICT","CONCURRENCY_CONFLICT","IDEMPOTENCY_CONFLICT","SAFETY_BLOCKED","PRECONDITION_REQUIRED","DEPENDENCY_UNAVAILABLE","INVARIANT_VIOLATION","SAFETY_ACK_REQUIRED","RATE_LIMITED","INTERNAL"]},message:{type:"string"},details:{type:"object",description:"Solo claves de una lista cerrada no-PHI (apps/web/lib/http-errors.ts: EXPOSED_DETAILS)",additionalProperties:true}}}}}}},
  paths};
}
