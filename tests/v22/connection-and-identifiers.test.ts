import{describe,it,expect}from"vitest";
import fs from "node:fs";
import crypto from "node:crypto";
import{directEndpoint,describeEndpoint}from"../../packages/pg-endpoint/src";
import{uuidFromDigest,canonicalize,canonicalHash}from"../../packages/canonical-json/src";
import{subjectToActorId}from"../../packages/http-principal/src";
// Auditoría 2026-09-19, anexo R01 — hallazgos R01-004 (cadena de conexión con regex), R01-015 (UUID derivados no
// conformes) y R01-022 (huella de idempotencia que aplanaba objetos anidados). Cada prueba reproduce el defecto original.

describe("endpoint directo de Postgres/Neon (R01-004)",()=>{
 it("quita el pooler y channel_binding conservando el resto de parámetros, en cualquier orden",()=>{
  expect(directEndpoint("postgres://u:p@ep-x-pooler.aws.neon.tech/db?channel_binding=require&sslmode=require"))
   .toBe("postgres://u:p@ep-x.aws.neon.tech/db?sslmode=require");
  expect(directEndpoint("postgres://u:p@ep-x-pooler.aws.neon.tech/db?sslmode=require&channel_binding=require"))
   .toBe("postgres://u:p@ep-x.aws.neon.tech/db?sslmode=require");
 });
 it("el defecto original: con channel_binding primero, el regex dejaba una URL con «?&»",()=>{
  const regexViejo=(raw:string)=>raw.replace("-pooler","").replace(/([?&])channel_binding=require/,"$1").replace(/[?&]$/,"");
  const entrada="postgres://u:p@ep-x-pooler.aws.neon.tech/db?channel_binding=require&sslmode=require";
  expect(regexViejo(entrada)).toContain("?&");            // lo que producía antes
  expect(directEndpoint(entrada)).not.toContain("?&");    // lo que produce ahora
 });
 it("no deja un «?» colgando cuando channel_binding era el único parámetro",()=>{
  expect(directEndpoint("postgres://u:p@ep-x.aws.neon.tech/db?channel_binding=require")).toBe("postgres://u:p@ep-x.aws.neon.tech/db");
 });
 it("respeta una cadena local y una cadena en formato clave=valor (no la corrompe)",()=>{
  expect(directEndpoint("postgres://postgres@127.0.0.1:54329/medical_os_test?sslmode=disable")).toBe("postgres://postgres@127.0.0.1:54329/medical_os_test?sslmode=disable");
  expect(directEndpoint("host=localhost dbname=medical_os user=postgres")).toBe("host=localhost dbname=medical_os user=postgres");
 });
 it("rechaza una cadena vacía (fail-closed: nunca conectar «a cualquier sitio»)",()=>{
  expect(()=>directEndpoint("  ")).toThrow(/vac/i);
 });
 it("describeEndpoint informa host y base SIN credenciales",()=>{
  const d=describeEndpoint("postgres://usuario:secreto@ep-x.aws.neon.tech/medical_os?sslmode=require");
  expect(d).toEqual({host:"ep-x.aws.neon.tech",database:"medical_os"});
  expect(JSON.stringify(d)).not.toContain("secreto");
 });
 it("es la ÚNICA fuente de verdad: ningún fichero del repo reimplementa el regex",()=>{
  const sospechosos:string[]=[];
  const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   if(e.name==="node_modules"||e.name===".next"||e.name===".git"||e.name.includes(" 2."))continue;
   const p=`${d}/${e.name}`;
   if(e.isDirectory())walk(p);
   else if(/\.(ts|tsx|mts|mjs)$/.test(e.name)&&!p.includes("packages/pg-endpoint")&&!p.endsWith("connection-and-identifiers.test.ts")){
    if(fs.readFileSync(p,"utf8").includes('replace("-pooler"'))sospechosos.push(p);
   }}};
  for(const raiz of ["apps","packages","scripts","tests","release"])walk(raiz);
  expect(sospechosos).toEqual([]);
 });
});

describe("identificadores derivados conformes a RFC 9562 (R01-015)",()=>{
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
 it("uuidFromDigest fija versión (8 = derivado) y variante en 2 000 muestras",()=>{
  const malos:string[]=[];
  for(let i=0;i<2000;i++){
   const u=uuidFromDigest(crypto.createHash("sha256").update(`muestra:${i}`).digest("hex"));
   if(!UUID.test(u))malos.push(u);
  }
  expect(malos).toEqual([]);
 });
 it("el corte crudo del sha256 (defecto original) falla el patrón en la mayoría de los casos",()=>{
  const crudo=(seed:string):string=>{const h=crypto.createHash("sha256").update(seed).digest("hex");return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
  let noConformes=0;
  for(let i=0;i<2000;i++)if(!UUID.test(crudo(`muestra:${i}`)))noConformes++;
  expect(noConformes).toBeGreaterThan(1500); // ~92 % como midió la auditoría
 });
 it("sigue siendo DETERMINISTA: el mismo digest da el mismo UUID y digests distintos dan UUID distintos",()=>{
  const a=uuidFromDigest(crypto.createHash("sha256").update("x").digest("hex"));
  const b=uuidFromDigest(crypto.createHash("sha256").update("x").digest("hex"));
  const c=uuidFromDigest(crypto.createHash("sha256").update("y").digest("hex"));
  expect(a).toBe(b);expect(a).not.toBe(c);
 });
 it("hay UNA sola implementación del formato de UUID en el repo (había siete)",()=>{
  // El defecto real de R01-015 no era el formato: eran SIETE copias del mismo corte de sha256, tres con nibbles
  // distintos, de modo que el `eventId` que escribía el kernel no coincidía con el que buscaba el replay estable.
  const sospechosos:string[]=[];
  const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   if(e.name==="node_modules"||e.name===".next"||e.name===".git"||e.name.includes(" 2."))continue;
   const p=`${d}/${e.name}`;
   if(e.isDirectory())walk(p);
   else if(/\.(ts|tsx|mts)$/.test(e.name)&&!p.includes("packages/canonical-json")&&!p.endsWith("connection-and-identifiers.test.ts")){
    const src=fs.readFileSync(p,"utf8");
    if(/slice\(0,8\)\}-\$\{/.test(src))sospechosos.push(p);
   }}};
  for(const raiz of ["apps","packages","scripts","tests"])walk(raiz);
  expect(sospechosos).toEqual([]);
 });
 it("subjectToActorId emite un UUID conforme y estable por sujeto OIDC",()=>{
  const id=subjectToActorId("auth0|1234567890");
  expect(id).toMatch(UUID);
  expect(subjectToActorId("auth0|1234567890")).toBe(id);
  expect(subjectToActorId("auth0|0987654321")).not.toBe(id);
  expect(id).not.toContain("auth0"); // el sujeto no viaja en claro
 });
});

describe("huella de idempotencia (R01-022)",()=>{
 it("distingue cuerpos que solo difieren DENTRO de un objeto anidado (el defecto original)",()=>{
  const a={id:"y",payload:{a:1,b:2}},b={id:"y",payload:{a:9,b:9}};
  const viejo=(x:unknown)=>crypto.createHash("sha256").update(JSON.stringify(x,Object.keys((x??{}) as Record<string,unknown>).sort())).digest("hex");
  expect(viejo(a)).toBe(viejo(b));                 // antes: dos cuerpos distintos, misma huella
  expect(canonicalHash(a)).not.toBe(canonicalHash(b)); // ahora: IDEMPOTENCY_CONFLICT detectable
 });
 it("es estable ante el orden de las claves, en cualquier nivel",()=>{
  expect(canonicalHash({a:1,b:{c:2,d:[3,{e:4,f:5}]}})).toBe(canonicalHash({b:{d:[3,{f:5,e:4}],c:2},a:1}));
 });
 it("usa la misma canonicalización que firma los comandos",()=>{
  const x={z:1,a:{b:[1,2,3]}};
  expect(canonicalHash(x)).toBe(crypto.createHash("sha256").update(canonicalize(x)).digest("hex"));
 });
 it("distingue tipos que JSON.stringify podría confundir",()=>{
  expect(canonicalHash({v:"1"})).not.toBe(canonicalHash({v:1}));
  expect(canonicalHash({v:null})).not.toBe(canonicalHash({}));
  expect(canonicalHash([1,2])).not.toBe(canonicalHash([2,1]));
 });
});
