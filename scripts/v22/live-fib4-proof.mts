// EPIC BR — Evidencia física: FIB-4 (fibrosis hepática) desde edad + AST + ALT + plaquetas. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-br-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const f4=await import("../../apps/web/app/api/v1/patients/[patientId]/fib4/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:"Prueba",birthDate:birth(y),sexAtBirth:"MALE",occurredAt:at()})}));}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,occurredAt:at()})}));}
async function get(t:string,p:string){const r=await f4.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) 65a, AST 80, ALT 40, plaq 100 -> FIB-4 ~8.2, HIGH
 const p1=crypto.randomUUID();await reg(phys,p1,65);
 for(const[a,v]of[["AST","80"],["ALT","40"],["PLATELETS","100"]]as const)await res(phys,p1,a,v);
 let g=await get(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(g.body.fib4>2.67&&g.body.risk==="HIGH","HIGH_RISK");
 // 2) 40a, AST 25, ALT 25, plaq 250 -> ~0.8, LOW
 const p2=crypto.randomUUID();await reg(phys,p2,40);
 for(const[a,v]of[["AST","25"],["ALT","25"],["PLATELETS","250"]]as const)await res(phys,p2,a,v);
 g=await get(phys,p2);ok(g.body.risk==="LOW","LOW_RISK");
 // 3) usa el valor MÁS RECIENTE: plaquetas caen a 90 -> sube el FIB-4
 const before=g.body.fib4;await res(phys,p2,"PLATELETS","90");g=await get(phys,p2);ok(g.body.fib4>before,"USES_LATEST_PLATELETS");
 // 4) falta un analito -> no computable
 const p3=crypto.randomUUID();await reg(phys,p3,50);await res(phys,p3,"AST","40");await res(phys,p3,"ALT","30");
 g=await get(phys,p3);ok(g.body.computable===false&&/PLATELETS/.test(g.body.reason),"MISSING_ANALYTE");
 // 5) paciente no registrado -> 404
 g=await get(phys,crypto.randomUUID());ok(g.status===404,"UNREGISTERED_404");
 // 6) sin scope patient:read -> 403
 const noScope=tok(["result:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
