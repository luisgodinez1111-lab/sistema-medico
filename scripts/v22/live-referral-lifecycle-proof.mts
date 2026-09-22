// EPIC T — Evidencia física de interconsultas (solicitar/aceptar/completar/declinar/cancelar) contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-t-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const rf=await import("../../apps/web/app/api/v1/referrals/route");
const acc=await import("../../apps/web/app/api/v1/referrals/[referralId]/acceptance/route");
const comp=await import("../../apps/web/app/api/v1/referrals/[referralId]/completion/route");
const dec=await import("../../apps/web/app/api/v1/referrals/[referralId]/decline/route");
const can=await import("../../apps/web/app/api/v1/referrals/[referralId]/cancellation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,scopes=["referral:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({referralId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await rf.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({referralId:id,patientId:crypto.randomUUID(),specialty:"Cardiología",reason:"Soplo",occurredAt:ISO})}));return{id,r};}
try{
 const phys=tok(TA);
 // camino feliz: REQUESTED -> ACCEPTED -> COMPLETED
 let{id,r}=await mk(phys);ok(r.status===201&&(await r.json()).state==="REQUESTED","REQUEST_201");
 r=await acc.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),PP(id));
 ok(r.status===201&&(await r.json()).state==="ACCEPTED","ACCEPT_201");
 r=await comp.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),PP(id));
 ok(r.status===201&&(await r.json()).state==="COMPLETED","COMPLETE_201");
 // SM: completar dos veces (terminal) -> 409
 r=await comp.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({occurredAt:ISO})}),PP(id));
 ok(r.status===409,"COMPLETE_TERMINAL_409");
 // SM: completar sin aceptar -> 409
 const two=await mk(phys);
 r=await comp.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),PP(two.id));
 ok(r.status===409,"COMPLETE_WITHOUT_ACCEPT_409");
 // decline desde REQUESTED
 const three=await mk(phys);
 r=await dec.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"Fuera de red",occurredAt:ISO})}),PP(three.id));
 ok(r.status===201&&(await r.json()).state==="DECLINED","DECLINE_201");
 // cancel desde ACCEPTED
 const four=await mk(phys);
 await acc.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),PP(four.id));
 r=await can.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({reason:"Paciente desistió",occurredAt:ISO})}),PP(four.id));
 ok(r.status===201&&(await r.json()).state==="CANCELLED","CANCEL_FROM_ACCEPTED_201");
 // cross-tenant: tenant B no puede tocar la interconsulta de A -> 404
 const physB=tok(TB);
 r=await acc.POST(new Request("http://l/",{method:"POST",headers:H(physB,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),PP(two.id));
 ok(r.status===404,"CROSS_TENANT_404");
 // sin scope referral:write -> 403
 const noScope=tok(TA,["patient:read"]);
 r=await rf.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({referralId:crypto.randomUUID(),patientId:crypto.randomUUID(),specialty:"X",reason:"Y",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
