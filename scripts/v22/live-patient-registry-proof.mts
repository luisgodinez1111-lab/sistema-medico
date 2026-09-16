// EPIC S — Evidencia física del registro de pacientes (registrar/listar/estado) contra Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-s-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const pt=await import("../../apps/web/app/api/v1/patients/route");
const deact=await import("../../apps/web/app/api/v1/patients/[patientId]/deactivation/route");
const react=await import("../../apps/web/app/api/v1/patients/[patientId]/reactivation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,scopes=["patient:read","patient:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok(TA);const p1=crypto.randomUUID();const uniq="P-"+crypto.randomUUID().slice(0,8);
 let r=await pt.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p1,name:uniq+" García",birthDate:"1975-03-03",sexAtBirth:"FEMALE",occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).status==="ACTIVE","REGISTER_ACTIVE_201");
 // list incluye al paciente con nombre + estado
 r=await pt.GET(new Request("http://l/",{headers:H(phys)}));
 const list=(await r.json()).patients as {patientId:string;name:string;status:string}[];
 const mine=list.find(x=>x.patientId===p1);
 ok(r.status===200&&!!mine&&mine.name.includes(uniq)&&mine.status==="ACTIVE","LIST_HAS_PATIENT_WITH_NAME");
 // deactivate -> INACTIVE
 r=await deact.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),PP(p1));
 ok(r.status===201&&(await r.json()).status==="INACTIVE","DEACTIVATE_201_v2");
 r=await pt.GET(new Request("http://l/",{headers:H(phys)}));
 ok(((await r.json()).patients as {patientId:string;status:string}[]).find(x=>x.patientId===p1)?.status==="INACTIVE","LIST_REFLECTS_INACTIVE");
 // reactivate -> ACTIVE
 r=await react.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),PP(p1));
 ok(r.status===201&&(await r.json()).status==="ACTIVE","REACTIVATE_201_v3");
 // SM: reactivar un ACTIVE -> 409
 r=await react.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({occurredAt:ISO})}),PP(p1));
 ok(r.status===409,"REACTIVATE_ACTIVE_ILLEGAL_409");
 // cross-tenant: tenant B no ve al paciente y no puede tocarlo
 const physB=tok(TB);
 r=await pt.GET(new Request("http://l/",{headers:H(physB)}));
 ok(!((await r.json()).patients as {patientId:string}[]).some(x=>x.patientId===p1),"CROSS_TENANT_LIST_ISOLATED");
 r=await deact.POST(new Request("http://l/",{method:"POST",headers:H(physB,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({occurredAt:ISO})}),PP(p1));
 ok(r.status===404,"CROSS_TENANT_404");
 // sin scope patient:write -> 403
 const noWrite=tok(TA,["patient:read"]);
 r=await pt.POST(new Request("http://l/",{method:"POST",headers:H(noWrite,{"idempotency-key":idem()}),body:JSON.stringify({patientId:crypto.randomUUID(),name:"X",birthDate:"2000-01-01",sexAtBirth:"UNKNOWN",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
