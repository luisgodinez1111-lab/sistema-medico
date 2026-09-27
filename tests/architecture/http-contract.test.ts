import{describe,it,expect,vi,beforeAll,afterAll}from"vitest";
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
import{sourceFiles}from"./_graph";
import{canonicalize}from"../../packages/canonical-json/src";
// Lote 11 (ADR-0300) — CONTRATO HTTP de todas las operaciones de la API (177 al crearlo; 175 tras retirar el stub /api/v1/timeline, D12b), SIN base de datos. Llama a cada export de cada
// apps/web/app/api/**/route.ts (lo mismo que hacen las pruebas en vivo) con escenarios fijos —anónimo, sin scope, sin
// cabeceras de mutación, agregado inexistente, agregado existente, replay idempotente, JSON inválido y cuerpo vacío— y
// registra el estado, el cuerpo de la respuesta y la secuencia de llamadas a la persistencia (el comando COMPLETO que llega
// al kernel, huella incluida). La persistencia (apps/web/lib/runtime/*) se sustituye por dobles que registran; nada toca
// una base. Es el oráculo de los lotes 11.2 (pipeline) y 11.3 (rutas delgadas): la precedencia de errores 401/403 → 428 →
// 404 → 400 → replay → 409, los cuerpos y los comandos no pueden cambiar. Los cuerpos válidos salen del esquema JSON de
// cada operación en docs/api/openapi.json (solo campos requeridos).
const h=vi.hoisted(()=>{
 const state={calls:[] as unknown[][],impl:new Map<string,(...a:unknown[])=>unknown>()};
 const isCtx=(v:unknown)=>typeof v==="object"&&v!==null&&"tenantId" in v&&"requestId" in v;
 const LIST=/Registry$|^active|Codes$|Rows$|Aggregates$|Goals$|Obligations$|Documents$|Series$|ForDate$|Prescribed$|ByType$|Vaccines$|Vitals$|regulatoryObligations$/;
 const DEFAULTS:Record<string,unknown>={listPatients:{items:[],nextCursor:null,total:0},readPatientTimeline:{items:[],nextCursor:null},latestVitalsByType:{},
  officeSettings:{settings:{},version:0},encounterAnalytics:{total:0,signed:0,byDay:[]},appointmentOutcomes:{total:0,completed:0,noShow:0,cancelled:0,checkedIn:0,scheduled:0},
  patientDemographics:{name:"Paciente Contrato",birthDate:"1980-01-01",sexAtBirth:"FEMALE"},countUnresolvedCriticalObligations:0,countOpenCriticalResults:0,countOpenCriticalVitals:0,
  readEncounter:null,sharedAllow:{allowed:true,retryAfterSeconds:0,remaining:100}};
 const fallback=(k:string)=>k in DEFAULTS?structuredClone(DEFAULTS[k]):LIST.test(k)?[]:undefined;
 const wrap=(m:Record<string,unknown>)=>Object.fromEntries(Object.entries(m).map(([k,v])=>[k,typeof v==="function"?async(...a:unknown[])=>{
  state.calls.push([k,...a.filter(x=>!isCtx(x))]);const f=state.impl.get(k);return f?f(...a):fallback(k);}:v]));
 return{state,wrap};
});
vi.mock("../../apps/web/lib/runtime/command",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/event-store",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/rate-limit-shared",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/patient",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/safety-inputs",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/renal",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/immunizations",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/vitals",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/results",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/scheduling",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/registries",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/documents",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/settings",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/follow-up",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/reports",async(o)=>h.wrap(await o()));
vi.mock("../../apps/web/lib/runtime/read-models/record",async(o)=>h.wrap(await o()));
vi.mock("@vercel/blob",()=>({put:async()=>({pathname:"blob"}),del:async()=>undefined,get:async()=>null}));

const T="00000000-0000-4000-8000-000000000001",P="00000000-0000-4000-8000-0000000000aa",SECRET="http-contract-secret";
const API="apps/web/app/api";
const spec=JSON.parse(fs.readFileSync("docs/api/openapi.json","utf8")) as{paths:Record<string,Record<string,{requestBody?:{content:{"application/json"?:{schema:Json}}}}>>};
type Json={type?:string|string[];properties?:Record<string,Json>;required?:string[];items?:Json;enum?:unknown[];const?:unknown;anyOf?:Json[];oneOf?:Json[];allOf?:Json[];format?:string;minLength?:number;minItems?:number;minimum?:number;exclusiveMinimum?:number;maximum?:number};
// Instancia mínima y determinista de un esquema JSON (solo campos requeridos).
function sample(s:Json):unknown{
 if(s.const!==undefined)return s.const;if(s.enum)return s.enum[0];
 if(s.anyOf)return sample(s.anyOf.find(x=>x.type!=="null")??s.anyOf[0]!);if(s.oneOf)return sample(s.oneOf[0]!);
 if(s.allOf)return Object.assign({},...s.allOf.map(x=>sample(x) as object));
 const t=Array.isArray(s.type)?s.type.find(x=>x!=="null"):s.type;
 if(t==="object"){const o:Record<string,unknown>={};for(const k of s.required??[])o[k]=sample(s.properties?.[k]??{});return o;}
 if(t==="array")return Array.from({length:s.minItems??0},()=>sample(s.items??{}));
 if(t==="string")return s.format==="uuid"?P:s.format==="date-time"?"2026-09-01T10:00:00.000Z":"x".repeat(Math.max(1,s.minLength??1));
 if(t==="number"||t==="integer"){const n=s.minimum??(s.exclusiveMinimum!==undefined?s.exclusiveMinimum+1:1);return s.maximum!==undefined&&n>s.maximum?s.maximum:n;}
 if(t==="boolean")return true;
 return null;
}
// Cuerpos clínicamente válidos para las operaciones cuyo esquema mínimo se queda en una validación de dominio (CIE-10, CURP,
// dosis, cédula, huella), y para las que parsean el cuerpo en línea y no publican esquema: así el oráculo recorre sus caminos
// completos (medicación, problemas, encuentro, firma), que son los de mayor riesgo del lote 11.2.
const ISO="2026-09-01T10:00:00.000Z",HASH="a".repeat(64);
const OVERRIDE:Record<string,Record<string,unknown>>={
 "POST /api/v1/problems":{code:"I10"},
 "POST /api/v1/claims/{claimId}/coding":{codes:["I10"]},
 "POST /api/v1/patients":{name:"Paciente Contrato",birthDate:"1980-01-01"},
 "POST /api/v1/medications":{drugCode:"amoxicilina-500",dose:"500mg",route:"PO",frequency:"c/8h"},
 "POST /api/v1/medications/{medicationId}/modification":{dose:"250mg"},
 "POST /api/v1/physician-profile/credentials":{fullName:"Médica Contrato",cedulaProfesional:"1234567",institution:"UNAM"},
 "POST /api/v1/documents/{documentId}/signature":{contentHash:HASH},
 "POST /api/v1/problems/{problemId}/evidence":{confidence:80},
 "POST /api/v1/encounters":{encounterId:P,patientId:P,occurredAt:ISO},
 "POST /api/v1/encounters/{encounterId}/assessment":{assessment:"Evaluación de contrato",plan:"Plan de contrato",occurredAt:ISO},
 "POST /api/v1/encounters/{encounterId}/signature":{occurredAt:ISO,contentHash:HASH},
 "POST /api/v1/patients/{patientId}/prescription-check":{drug:"amoxicilina-500",dose:"500mg",route:"PO",frequency:"c/8h"},
};
const SCOPES=["admission:write","ai:invoke","ai:write","allergy:read","allergy:write","appointment:read","appointment:write","billing:read","billing:write","careplan:read","careplan:write","consent:write","dialysis:write","document:read","document:write","encounter:read","encounter:write","history:write","imaging:write","immunization:read","immunization:write","incident:write","intelligence:write","medication:propose","medication:write","obligation:read","obligation:write","order:read","order:write","patient:read","patient:write","prescription:write","problem:read","problem:write","record:export","referral:read","referral:write","result:read","result:write","settings:read","settings:write","specimen:write","surgery:write","transfusion:write","triage:write","vital:write","wound:write"];
let sign:(c:Record<string,unknown>,s:string)=>string;
const token=(scopes:string[],roles:string[])=>{const now=Math.floor(Date.now()/1000);return sign({sub:"auth0|contract-physician",tenantId:T,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:"s-contract"},SECRET);};
type Scenario={id:string;auth?:"full"|"none";headers:boolean;body:"valid"|"badjson"|"empty";events:"absent"|"genesis";replay:boolean};
const WRITE:Scenario[]=[
 {id:"anonimo",headers:true,body:"valid",events:"genesis",replay:false},
 {id:"sin-scope",auth:"none",headers:true,body:"valid",events:"genesis",replay:false},
 {id:"sin-cabeceras",auth:"full",headers:false,body:"valid",events:"genesis",replay:false},
 {id:"agregado-inexistente",auth:"full",headers:true,body:"valid",events:"absent",replay:false},
 {id:"agregado-existente",auth:"full",headers:true,body:"valid",events:"genesis",replay:false},
 {id:"replay",auth:"full",headers:true,body:"valid",events:"genesis",replay:true},
 {id:"json-invalido",auth:"full",headers:true,body:"badjson",events:"genesis",replay:false},
 {id:"cuerpo-vacio",auth:"full",headers:true,body:"empty",events:"genesis",replay:false},
];
const READ:Scenario[]=[WRITE[0]!,WRITE[1]!,{id:"lectura",auth:"full",headers:false,body:"valid",events:"genesis",replay:false}];
function arrange(s:Scenario){
 h.state.calls=[];h.state.impl.clear();
 const ev=s.events==="genesis"?[{sequence:1,payload:{patientId:P}}]:[];
 h.state.impl.set("readAggregateEvents",async()=>structuredClone(ev));h.state.impl.set("readEncounterEvents",async()=>structuredClone(ev));h.state.impl.set("readAggregateStream",async()=>structuredClone(ev));
 const receipt=(v:number)=>({aggregateId:P,version:v,eventId:"e-contract",outboxId:"o-contract",auditId:"a-contract",auditHash:`audit-${v}`});
 h.state.impl.set("lookupReplay",async()=>s.replay?{replayed:true,response:receipt(9)}:null);
 h.state.impl.set("runClinicalCommand",async(_c:unknown,cmd:unknown)=>({replayed:s.replay,response:receipt(s.replay?9:Number((cmd as{expectedVersion:number}).expectedVersion)+1)}));
}
const summarizeCall=(c:unknown[])=>c[0]==="runClinicalCommand"||c[0]==="lookupReplay"?[c[0],c[1],crypto.createHash("sha256").update(canonicalize(c[1])).digest("hex").slice(0,16)]:c;
async function responseOf(r:Response){
 const text=await r.text();let body:unknown;try{body=JSON.parse(text);}catch{body=text.length>200?{sha256:crypto.createHash("sha256").update(text).digest("hex"),length:text.length}:text;}
 return{status:r.status,type:r.headers.get("content-type")?.split(";")[0]??null,body};
}
const routes=sourceFiles(API).filter(f=>f.endsWith("/route.ts")).sort();
let lines:string[]=[];
beforeAll(async()=>{
 vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
 vi.stubEnv("SESSION_SIGNING_SECRET",SECRET);vi.stubEnv("DATABASE_URL","");
 let n=0;const uuid=()=>`00000000-0000-4000-8000-${String(++n).padStart(12,"0")}` as `${string}-${string}-${string}-${string}-${string}`;
 vi.spyOn(crypto,"randomUUID").mockImplementation(uuid);vi.spyOn(globalThis.crypto,"randomUUID").mockImplementation(uuid);
 vi.spyOn(console,"error").mockImplementation(()=>{});vi.spyOn(console,"log").mockImplementation(()=>{});
 sign=(await import("../../packages/session/src")).signSession as unknown as typeof sign;
});
afterAll(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllEnvs();});
describe("contrato HTTP de la API sin base de datos (ADR-0300, oráculo de los lotes 11.2 y 11.3)",()=>{
 it("estado, cuerpo y llamadas a la persistencia de cada operación en cada escenario",async()=>{
  for(const file of routes){
   const rel=path.relative(API,file).split(path.sep).join("/");const oa="/api/"+rel.replace(/\/route\.ts$/,"").replace(/\[([^\]]+)\]/g,"{$1}");
   const params=Object.fromEntries([...rel.matchAll(/\[([^\]]+)\]/g)].map(m=>[m[1]!,P]));
   const mod=await import(path.join(process.cwd(),file)) as Record<string,unknown>;
   for(const method of["GET","POST","PUT","PATCH","DELETE"]){
    const fn=mod[method];if(typeof fn!=="function")continue;
    const schema=spec.paths[oa]?.[method.toLowerCase()]?.requestBody?.content["application/json"]?.schema;
    for(const s of method==="GET"?READ:WRITE){
     arrange(s);
     const headers:Record<string,string>={"x-request-id":"req-contract","content-type":"application/json"};
     if(s.auth)headers.authorization=`Bearer ${s.auth==="full"?token(SCOPES,["PHYSICIAN"]):token([],[])}`;
     if(s.headers&&method!=="GET"){headers["idempotency-key"]="idem-contract";headers["if-match"]="1";}
     const valid={...(schema?sample(schema) as object:{}),...OVERRIDE[`${method} ${oa}`]};
     const body=method==="GET"?undefined:s.body==="badjson"?"{no es json":JSON.stringify(s.body==="empty"?{}:valid);
     const req=new Request(`http://contract.local${oa.replace(/\{[^}]+\}/g,P)}`,{method,headers,...(body!==undefined?{body}:{})});
     let out:unknown;
     try{out=await responseOf(await (fn as(r:Request,c:unknown)=>Promise<Response>)(req,{params:Promise.resolve(params)}));}
     catch(e){out={thrown:e instanceof Error?`${e.name}: ${e.message}`:String(e)};}
     lines.push(JSON.stringify({op:`${method} ${oa}`,escenario:s.id,...(out as object),llamadas:h.state.calls.map(summarizeCall)}));
    }
   }
  }
  // HTTP_CONTRACT_DUMP=<ruta>: vuelca las líneas para compararlas por operación mientras se migra un módulo.
  if(process.env.HTTP_CONTRACT_DUMP)fs.writeFileSync(process.env.HTTP_CONTRACT_DUMP,lines.join("\n")+"\n");
  expect(lines.length).toBeGreaterThan(1000);
  await expect(lines.join("\n")+"\n").toMatchFileSnapshot("__snapshots__/http-contract.jsonl");
 },600_000);
 // Hallazgo D8 del lote 11: un id de ruta que no es UUID no puede existir. Con sesión y cabeceras válidas, toda operación con
 // parámetros `*Id` responde 404 NOT_FOUND y NO llega a la persistencia con ese id (antes: 500 por 22P02 o 200 vacío).
 it("un id de ruta con formato inválido es 404 tras autenticar, sin tocar la persistencia (D8)",async()=>{
  const BAD="no-es-un-uuid",out:string[]=[];
  for(const file of routes){
   const rel=path.relative(API,file).split(path.sep).join("/");const oa="/api/"+rel.replace(/\/route\.ts$/,"").replace(/\[([^\]]+)\]/g,"{$1}");
   const names=[...rel.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]!).filter(n=>n.endsWith("Id"));if(!names.length)continue;
   const mod=await import(path.join(process.cwd(),file)) as Record<string,unknown>;
   for(const method of["GET","POST","PUT","PATCH","DELETE"]){
    const fn=mod[method];if(typeof fn!=="function")continue;
    for(const bad of names){
     arrange({id:"id-invalido",auth:"full",headers:true,body:"valid",events:"genesis",replay:false});
     const params=Object.fromEntries([...rel.matchAll(/\[([^\]]+)\]/g)].map(m=>[m[1]!,m[1]===bad?BAD:m[1]==="kind"?"signature":P]));
     const headers:Record<string,string>={"x-request-id":"req-contract","content-type":"application/json",authorization:`Bearer ${token(SCOPES,["PHYSICIAN"])}`};
     if(method!=="GET"){headers["idempotency-key"]="idem-contract";headers["if-match"]="1";}
     const schema=spec.paths[oa]?.[method.toLowerCase()]?.requestBody?.content["application/json"]?.schema;
     const body=method==="GET"?undefined:JSON.stringify({...(schema?sample(schema) as object:{}),...OVERRIDE[`${method} ${oa}`]});
     const req=new Request(`http://contract.local${oa.replace(/\{([^}]+)\}/g,(_m,k:string)=>String(params[k]))}`,{method,headers,...(body!==undefined?{body}:{})});
     let status=0,code="";
     try{const r=await (fn as(r:Request,c:unknown)=>Promise<Response>)(req,{params:Promise.resolve(params)});status=r.status;code=String(((await r.json().catch(()=>({}))) as{error?:{code?:string}}).error?.code??"");}catch(e){code=String(e);}
     const touched=h.state.calls.some(c=>c.slice(1).some(a=>JSON.stringify(a)?.includes(BAD)));
     if(status!==404||code!=="NOT_FOUND"||touched)out.push(`${method} ${oa} [${bad}] -> ${status} ${code}${touched?" (tocó la persistencia)":""}`);
    }
   }
  }
  expect(out).toEqual([]);
 },600_000);
});
