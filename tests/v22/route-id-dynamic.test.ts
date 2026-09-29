import{describe,it,expect,vi,beforeAll}from"vitest";
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
// Hallazgo D8 (porte) — complemento DINÁMICO del guardián estático de R04-007 (tests/v22/http-boundary.test.ts). El estático
// solo mira el texto (`pathIds(ctx.params)` en cada ruta); este INVOCA toda operación con parámetros `*Id` con un id malformado
// y exige la respuesta del contrato de main —400 VALIDATION_ERROR— SIN llegar a la persistencia con ese id. Lo destapó el porte:
// 100 rutas llamaban a `pathIds` fuera de un `try`, así que su VALIDATION_ERROR escapaba del handler y Next respondía un 500
// sin cuerpo. Un id con espacios alrededor (que `isUuid` recorta) también debe rechazarse.
const calls:string[]=[];
const record=(where:string,args:unknown[])=>{calls.push(`${where} ${JSON.stringify(args,(_k,v)=>typeof v==="function"?"[fn]":v)}`);};
// La persistencia entera se sustituye por un espía que registra y falla: ninguna ruta debería llegar hasta aquí.
vi.mock("postgres",()=>{
 const fake=(...args:unknown[])=>{record("postgres()",args);const tag=(...q:unknown[])=>{record("sql``",q);throw new Error("PERSISTENCE_TOUCHED");};
  return new Proxy(tag,{get:(_t,p)=>(...a:unknown[])=>{record(`sql.${String(p)}`,a);throw new Error("PERSISTENCE_TOUCHED");}});};
 return{default:fake};
});
vi.mock("../../apps/web/lib/runtime/connection",async orig=>{
 const real=await orig() as Record<string,unknown>;
 return{...real,
  getSql:(...a:unknown[])=>{record("getSql",a);throw new Error("PERSISTENCE_TOUCHED");},
  withTenantTx:async(...a:unknown[])=>{record("withTenantTx",a);throw new Error("PERSISTENCE_TOUCHED");},
 };
});
const API="apps/web/app/api";
function routes():string[]{
 const out:string[]=[];
 const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name==="route.ts")out.push(p);}};
 walk(API);return out.sort();
}
const P="11111111-1111-4111-8111-111111111111";
const METHODS=["GET","POST","PUT","PATCH","DELETE"] as const;
let token="";
beforeAll(async()=>{
 process.env.SESSION_SIGNING_SECRET??=crypto.randomBytes(32).toString("hex"); // sin literal (R11-07)
 process.env.DATABASE_URL="postgres://nobody@127.0.0.1:1/none";
 const{signSession}=await import("../../packages/session/src");
 const now=Math.floor(Date.now()/1000);
 token=signSession({sub:crypto.randomUUID(),tenantId:crypto.randomUUID(),roles:["PHYSICIAN","ADMIN"],
  scopes:["patient:read","patient:write","allergy:write","document:read","document:write","encounter:read","encounter:write","medication:write"],
  purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},process.env.SESSION_SIGNING_SECRET);
});
type Handler=(r:Request,c:{params:Promise<Record<string,string>>})=>Promise<Response>;
async function call(fn:Handler,method:string,params:Record<string,string>):Promise<{status:number;code:string}>{
 const headers:Record<string,string>={"content-type":"application/json","x-request-id":"req-route-id",authorization:`Bearer ${token}`};
 if(method!=="GET"){headers["idempotency-key"]=crypto.randomUUID();headers["if-match"]="1";}
 const req=new Request("http://route-id.local/api",{method,headers,...(method==="GET"?{}:{body:JSON.stringify({occurredAt:new Date().toISOString()})})});
 try{
  const r=await fn(req,{params:Promise.resolve(params)});
  const body=await r.json().catch(()=>({})) as{error?:{code?:string}};
  return{status:r.status,code:String(body.error?.code??"")};
 }catch(e){return{status:0,code:`THREW ${String(e)}`};}
}

describe("id de ruta malformado: 400 sin tocar la persistencia, en TODA operación (D8)",()=>{
 it("toda operación con parámetro *Id rechaza un id que no es UUID (y uno con espacios) con 400 VALIDATION_ERROR",async()=>{
  const out:string[]=[];let checked=0;
  for(const file of routes()){
   const rel=path.relative(API,file).split(path.sep).join("/");
   const segs=[...rel.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]!);
   const ids=segs.filter(n=>n.endsWith("Id"));if(!ids.length)continue;
   const mod=await import(path.join(process.cwd(),file)) as Record<string,unknown>;
   for(const method of METHODS){
    const fn=mod[method];if(typeof fn!=="function")continue;
    for(const bad of ids){
     for(const BAD of["no-es-un-uuid",` ${P} `]){
      const params=Object.fromEntries(segs.map(n=>[n,n===bad?BAD:n==="kind"?"signature":P]));
      calls.length=0;
      const{status,code}=await call(fn as Handler,method,params);
      const touched=calls.length>0; // más estricto que «con ese id»: un id malformado no debe abrir la persistencia en absoluto
      checked++;
      if(status!==400||code!=="VALIDATION_ERROR"||touched)out.push(`${method} /${rel} [${bad}=${JSON.stringify(BAD)}] -> ${status} ${code}${touched?" (tocó la persistencia)":""}`);
     }
    }
   }
  }
  expect(out).toEqual([]);
  // Si esto cae, la prueba dejó de cubrir algo (hoy: más de 120 rutas con parámetro, varias operaciones cada una).
  expect(checked).toBeGreaterThanOrEqual(240);
 },600_000);
 it("GET /encounters?encounterId=<no uuid o con espacios> es 404 NOT_FOUND sin tocar la base (contrato del porte D4), no un 500",async()=>{
  const mod=await import(path.join(process.cwd(),API,"v1/encounters/route.ts")) as{GET:(r:Request)=>Promise<Response>};
  for(const bad of["not-a-uuid",` ${P} `]){
   calls.length=0;
   const r=await mod.GET(new Request(`http://route-id.local/api/v1/encounters?encounterId=${encodeURIComponent(bad)}`,{headers:{authorization:`Bearer ${token}`}}));
   const body=await r.json() as{error?:{code?:string}};
   expect([r.status,body.error?.code],bad).toEqual([404,"NOT_FOUND"]);
   expect(calls,"no debe tocar la persistencia").toEqual([]);
  }
 },60_000);
});
