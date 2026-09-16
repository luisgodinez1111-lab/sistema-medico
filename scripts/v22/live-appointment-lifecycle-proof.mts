// EPIC U — Evidencia física de la agenda (agendar/llegada/completar/no-show/cancelar) contra Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-u-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const ap=await import("../../apps/web/app/api/v1/appointments/route");
const ci=await import("../../apps/web/app/api/v1/appointments/[appointmentId]/check-in/route");
const comp=await import("../../apps/web/app/api/v1/appointments/[appointmentId]/completion/route");
const ns=await import("../../apps/web/app/api/v1/appointments/[appointmentId]/no-show/route");
const can=await import("../../apps/web/app/api/v1/appointments/[appointmentId]/cancellation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["CLINICAL_ADMIN"],scopes=["appointment:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({appointmentId:id})});const ISO="2026-09-11T11:00:00.000Z";const SLOT="2026-09-20T15:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await ap.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({appointmentId:id,patientId:crypto.randomUUID(),startAt:SLOT,reason:"Control",occurredAt:ISO})}));return{id,r};}
try{
 const staff=tok(TA);
 // camino feliz: SCHEDULED -> CHECKED_IN -> COMPLETED
 let{id,r}=await mk(staff);ok(r.status===201&&(await r.json()).state==="SCHEDULED","SCHEDULE_201");
 r=await ci.POST(new Request("http://l/",{method:"POST",headers:H(staff,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),PP(id));
 ok(r.status===201&&(await r.json()).state==="CHECKED_IN","CHECKIN_201");
 r=await comp.POST(new Request("http://l/",{method:"POST",headers:H(staff,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),PP(id));
 ok(r.status===201&&(await r.json()).state==="COMPLETED","COMPLETE_201");
 // SM: completar sin check-in -> 409
 const two=await mk(staff);
 r=await comp.POST(new Request("http://l/",{method:"POST",headers:H(staff,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),PP(two.id));
 ok(r.status===409,"COMPLETE_WITHOUT_CHECKIN_409");
 // no-show desde SCHEDULED
 const three=await mk(staff);
 r=await ns.POST(new Request("http://l/",{method:"POST",headers:H(staff,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),PP(three.id));
 ok(r.status===201&&(await r.json()).state==="NO_SHOW","NOSHOW_201");
 // SM: check-in tras no-show (terminal) -> 409
 r=await ci.POST(new Request("http://l/",{method:"POST",headers:H(staff,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),PP(three.id));
 ok(r.status===409,"CHECKIN_AFTER_NOSHOW_409");
 // cancel desde SCHEDULED
 const four=await mk(staff);
 r=await can.POST(new Request("http://l/",{method:"POST",headers:H(staff,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"Reagendada",occurredAt:ISO})}),PP(four.id));
 ok(r.status===201&&(await r.json()).state==="CANCELLED","CANCEL_201");
 // cross-tenant: tenant B no puede tocar cita de A -> 404
 const staffB=tok(TB);
 r=await ci.POST(new Request("http://l/",{method:"POST",headers:H(staffB,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),PP(two.id));
 ok(r.status===404,"CROSS_TENANT_404");
 // sin scope appointment:write -> 403
 const noScope=tok(TA,["CLINICAL_ADMIN"],["patient:read"]);
 r=await ap.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({appointmentId:crypto.randomUUID(),patientId:crypto.randomUUID(),startAt:SLOT,reason:"X",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
