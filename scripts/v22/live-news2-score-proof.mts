// EPIC BC — Evidencia física: NEWS2 computado desde los últimos signos vitales del paciente (RLS-scoped).
// Registra vitales vía la ruta real y consulta GET /patients/:id/news2. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bc-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const vitals=await import("../../apps/web/app/api/v1/vitals/route");
const news2=await import("../../apps/web/app/api/v1/patients/[patientId]/news2/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["vital:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let seq=0;const at=()=>new Date(Date.parse("2026-09-14T08:00:00.000Z")+(seq++)*60000).toISOString();
const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const U:Record<string,string>={BP:"mmHg",HR:"lpm",TEMP:"C",SPO2:"%",RESP:"rpm"};
async function rec(t:string,pat:string,vitalType:string,value:string){await vitals.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:pat,vitalType,value,unit:U[vitalType]??"u",occurredAt:at()})}));}
async function getNews2(t:string,pat:string){const r=await news2.GET(new Request("http://l/",{headers:H(t)}),PP(pat));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) paciente estable -> score 0, LOW
 const p1=crypto.randomUUID();
 for(const[k,v]of[["RESP","16"],["SPO2","98"],["TEMP","36.8"],["BP","120/80"],["HR","72"]]as const)await rec(phys,p1,k,v);
 let g=await getNews2(phys,p1);ok(g.status===200&&g.body.news2.score===0&&g.body.news2.band==="LOW","STABLE_SCORE_0_LOW");
 // 2) paciente en deterioro -> score alto, HIGH, escalamiento
 const p2=crypto.randomUUID();
 for(const[k,v]of[["RESP","24"],["SPO2","91"],["TEMP","39.2"],["BP","95/60"],["HR","125"]]as const)await rec(phys,p2,k,v);
 g=await getNews2(phys,p2);ok(g.status===200&&g.body.news2.band==="HIGH"&&g.body.news2.escalation===true,"DETERIORATING_HIGH_ESCALATION");
 // 3) usa el ÚLTIMO valor: re-registrar SpO2 normal baja el score respecto al deterioro
 await rec(phys,p2,"SPO2","98");await rec(phys,p2,"RESP","16");await rec(phys,p2,"TEMP","36.8");await rec(phys,p2,"BP","120/80");await rec(phys,p2,"HR","72");
 g=await getNews2(phys,p2);ok(g.body.news2.score===0,"USES_LATEST_VALUE_RECOVERED");
 // 4) parámetros faltantes se reportan; consciencia nunca se registra como vital -> siempre en missing
 const p3=crypto.randomUUID();await rec(phys,p3,"HR","72");
 g=await getNews2(phys,p3);ok(g.body.news2.missing.includes("consciousness")&&g.body.news2.missing.includes("resp"),"MISSING_PARAMS_REPORTED");
 // 5) aislamiento por paciente: un paciente sin vitales -> todo faltante, score 0
 const p4=crypto.randomUUID();g=await getNews2(phys,p4);ok(g.body.news2.score===0&&g.body.news2.missing.length>=5,"PER_PATIENT_ISOLATION");
 // 6) sin scope patient:read -> 403
 const noScope=tok(["vital:write"]);g=await getNews2(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
