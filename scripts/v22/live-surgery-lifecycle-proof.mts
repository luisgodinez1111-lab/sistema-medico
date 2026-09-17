// EPIC AK — Evidencia física del caso quirúrgico (agendar/time-out/iniciar/completar/cancelar) contra Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-ak-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const sg=await import("../../apps/web/app/api/v1/surgeries/route");
const to=await import("../../apps/web/app/api/v1/surgeries/[surgeryId]/timeout/route");
const st=await import("../../apps/web/app/api/v1/surgeries/[surgeryId]/start/route");
const co=await import("../../apps/web/app/api/v1/surgeries/[surgeryId]/completion/route");
const cn=await import("../../apps/web/app/api/v1/surgeries/[surgeryId]/cancellation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["PHYSICIAN"],scopes=["surgery:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({surgeryId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await sg.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({surgeryId:id,patientId:crypto.randomUUID(),procedure:"Colecistectomía",laterality:"NA",surgeon:"Dr. X",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const phys=tok(TA);
 // agendar -> time-out -> iniciar -> completar
 let{id,r}=await mk(phys);ok(r.status===201&&(await r.json()).state==="SCHEDULED","SCHEDULE_201");
 r=await to.POST(new Request("http://l/",B(phys,1)),PP(id));ok(r.status===201&&(await r.json()).state==="TIMED_OUT","TIMEOUT_201");
 r=await st.POST(new Request("http://l/",B(phys,2)),PP(id));ok(r.status===201&&(await r.json()).state==="IN_PROGRESS","START_201");
 r=await co.POST(new Request("http://l/",B(phys,3,{outcome:"Sin complicaciones"})),PP(id));ok(r.status===201&&(await r.json()).state==="COMPLETED","COMPLETE_201");
 // SM: iniciar sin time-out (barrera OMS) -> 409
 const two=await mk(phys);
 r=await st.POST(new Request("http://l/",B(phys,1)),PP(two.id));ok(r.status===409,"START_WITHOUT_TIMEOUT_409");
 // SM: completar sin iniciar -> 409
 const three=await mk(phys);
 await to.POST(new Request("http://l/",B(phys,1)),PP(three.id));
 r=await co.POST(new Request("http://l/",B(phys,2,{outcome:"x"})),PP(three.id));ok(r.status===409,"COMPLETE_WITHOUT_START_409");
 // cancelar desde TIMED_OUT
 r=await cn.POST(new Request("http://l/",B(phys,2,{reason:"Paciente inestable"})),PP(three.id));ok(r.status===201&&(await r.json()).state==="CANCELLED","CANCEL_FROM_TIMEOUT_201");
 // cross-tenant -> 404
 const physB=tok(TB);
 r=await to.POST(new Request("http://l/",B(physB,1)),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope surgery:write -> 403
 const noScope=tok(TA,["PHYSICIAN"],["patient:read"]);
 r=await sg.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({surgeryId:crypto.randomUUID(),patientId:crypto.randomUUID(),procedure:"x",laterality:"NA",surgeon:"Y",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
