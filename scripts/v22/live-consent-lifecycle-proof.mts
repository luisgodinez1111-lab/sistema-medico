// EPIC Z — Evidencia física del consentimiento informado (redactar/presentar/otorgar/rechazar/revocar) contra Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-z-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const co=await import("../../apps/web/app/api/v1/consents/route");
const pre=await import("../../apps/web/app/api/v1/consents/[consentId]/presentation/route");
const gr=await import("../../apps/web/app/api/v1/consents/[consentId]/grant/route");
const de=await import("../../apps/web/app/api/v1/consents/[consentId]/decline/route");
const rev=await import("../../apps/web/app/api/v1/consents/[consentId]/revocation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["consent:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({consentId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await co.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({consentId:id,patientId:crypto.randomUUID(),scopeType:"PROCEDURE",documentRef:"CI-2026-001",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const nurse=tok(TA);
 // redactar -> presentar -> otorgar -> revocar
 let{id,r}=await mk(nurse);ok(r.status===201&&(await r.json()).state==="DRAFTED","DRAFT_201");
 r=await pre.POST(new Request("http://l/",B(nurse,1)),PP(id));ok(r.status===201&&(await r.json()).state==="PRESENTED","PRESENT_201");
 r=await gr.POST(new Request("http://l/",B(nurse,2,{signerName:"Juan Pérez"})),PP(id));ok(r.status===201&&(await r.json()).state==="GRANTED","GRANT_201");
 r=await rev.POST(new Request("http://l/",B(nurse,3,{reason:"Paciente retira consentimiento"})),PP(id));ok(r.status===201&&(await r.json()).state==="REVOKED","REVOKE_201");
 // SM: revocar tras revocar (terminal) -> 409
 r=await rev.POST(new Request("http://l/",B(nurse,4,{reason:"x"})),PP(id));ok(r.status===409,"REVOKE_TERMINAL_409");
 // SM: otorgar sin presentar -> 409
 const two=await mk(nurse);
 r=await gr.POST(new Request("http://l/",B(nurse,1,{signerName:"X"})),PP(two.id));ok(r.status===409,"GRANT_WITHOUT_PRESENT_409");
 // rechazo tras presentar
 const three=await mk(nurse);
 await pre.POST(new Request("http://l/",B(nurse,1)),PP(three.id));
 r=await de.POST(new Request("http://l/",B(nurse,2,{reason:"Paciente no acepta"})),PP(three.id));ok(r.status===201&&(await r.json()).state==="DECLINED","DECLINE_201");
 // SM: revocar un DECLINED (terminal) -> 409
 r=await rev.POST(new Request("http://l/",B(nurse,3,{reason:"x"})),PP(three.id));ok(r.status===409,"REVOKE_DECLINED_409");
 // cross-tenant -> 404
 const nurseB=tok(TB);
 r=await pre.POST(new Request("http://l/",B(nurseB,1)),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope consent:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await co.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({consentId:crypto.randomUUID(),patientId:crypto.randomUUID(),scopeType:"TREATMENT",documentRef:"x",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
