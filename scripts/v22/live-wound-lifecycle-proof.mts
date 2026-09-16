// EPIC AI — Evidencia física del cuidado de heridas/UPP (documentar/re-valorar/cerrar/escalar) contra Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-ai-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const wd=await import("../../apps/web/app/api/v1/wounds/route");
const ra=await import("../../apps/web/app/api/v1/wounds/[woundId]/reassessment/route");
const he=await import("../../apps/web/app/api/v1/wounds/[woundId]/healing/route");
const es=await import("../../apps/web/app/api/v1/wounds/[woundId]/escalation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["wound:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({woundId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await wd.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({woundId:id,patientId:crypto.randomUUID(),location:"SACRUM",stage:"STAGE_2",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const nurse=tok(TA);
 // documentar -> re-valorar STAGE_3 -> re-valorar STAGE_4 -> cerrar (healed)
 let{id,r}=await mk(nurse);ok(r.status===201&&(await r.json()).state==="OPEN","DOCUMENT_201");
 r=await ra.POST(new Request("http://l/",B(nurse,1,{stage:"STAGE_3"})),PP(id));ok(r.status===201&&(await r.json()).state==="OPEN","REASSESS_S3_201");
 r=await ra.POST(new Request("http://l/",B(nurse,2,{stage:"STAGE_4"})),PP(id));ok(r.status===201&&(await r.json()).state==="OPEN","REASSESS_S4_201");
 r=await he.POST(new Request("http://l/",B(nurse,3)),PP(id));ok(r.status===201&&(await r.json()).state==="HEALED","HEAL_201");
 // SM: re-valorar tras cerrar (terminal) -> 409
 r=await ra.POST(new Request("http://l/",B(nurse,4,{stage:"STAGE_1"})),PP(id));ok(r.status===409,"REASSESS_AFTER_HEAL_409");
 // escalar
 const two=await mk(nurse);
 r=await es.POST(new Request("http://l/",B(nurse,1,{reason:"Deterioro, valoración especializada"})),PP(two.id));ok(r.status===201&&(await r.json()).state==="ESCALATED","ESCALATE_201");
 // SM: cerrar tras escalar (terminal) -> 409
 r=await he.POST(new Request("http://l/",B(nurse,2)),PP(two.id));ok(r.status===409,"HEAL_AFTER_ESCALATE_409");
 // cross-tenant -> 404
 const nurseB=tok(TB);const three=await mk(nurse);
 r=await ra.POST(new Request("http://l/",B(nurseB,1,{stage:"STAGE_3"})),PP(three.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope wound:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await wd.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({woundId:crypto.randomUUID(),patientId:crypto.randomUUID(),location:"HEEL",stage:"STAGE_1",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
