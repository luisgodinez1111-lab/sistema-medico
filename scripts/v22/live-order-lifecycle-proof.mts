// EPIC M — Evidencia física del ciclo de vida de la orden clínica contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-m-secret";
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const ords=await import("../../apps/web/app/api/v1/orders/route");
const place=await import("../../apps/web/app/api/v1/orders/[orderId]/placement/route");
const fulfill=await import("../../apps/web/app/api/v1/orders/[orderId]/fulfillment/route");
const cancel=await import("../../apps/web/app/api/v1/orders/[orderId]/cancellation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles:string[],scopes:string[]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string|null,x:Record<string,string>={}){const h:Record<string,string>={"content-type":"application/json",...x};if(t)h["authorization"]="Bearer "+t;return h;}
const OP=(id:string)=>({params:Promise.resolve({orderId:id})});const ISO="2026-06-06T06:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok(TA,["PHYSICIAN"],["order:write"]);
 const o=crypto.randomUUID(),pat=crypto.randomUUID();await ensurePatientIn(TA,pat); /* L-07 */
 let r=await ords.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({orderId:o,patientId:pat,orderType:"LAB",detail:"Hemograma completo",occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).state==="DRAFT","CREATE_DRAFT_201");
 // SM ilegal: cumplir sin colocar
 r=await fulfill.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),OP(o));
 ok(r.status===409,"FULFILL_FROM_DRAFT_ILLEGAL_409");
 const idemP=idem();const pReq=()=>new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idemP,"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})});
 r=await place.POST(pReq(),OP(o));ok(r.status===201&&(await r.json()).state==="ORDERED","PLACE_201_v2");
 r=await place.POST(pReq(),OP(o));ok(r.status===200&&(await r.json()).replayed===true,"PLACE_REPLAY_200");
 r=await fulfill.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),OP(o));
 ok(r.status===201&&(await r.json()).state==="FULFILLED","FULFILL_201_v3");
 r=await cancel.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({reason:"x",occurredAt:ISO})}),OP(o));
 ok(r.status===409,"CANCEL_AFTER_FULFILLED_409");
 // cancel path en otra orden
 const o2=crypto.randomUUID();
 await ords.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({orderId:o2,patientId:await freshPatient(TA),orderType:"IMAGING",detail:"Rx tórax",occurredAt:ISO})}));
 r=await cancel.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"duplicada",occurredAt:ISO})}),OP(o2));
 ok(r.status===201&&(await r.json()).state==="CANCELLED","CANCEL_FROM_DRAFT_201");
 // concurrencia
 const o3=crypto.randomUUID();
 await ords.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({orderId:o3,patientId:await freshPatient(TA),orderType:"LAB",detail:"x",occurredAt:ISO})}));
 r=await place.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"7"}),body:JSON.stringify({occurredAt:ISO})}),OP(o3));
 ok(r.status===409,"OPTIMISTIC_CONFLICT_409");
 // cross-tenant
 const physB=tok(TB,["PHYSICIAN"],["order:write"]);
 r=await place.POST(new Request("http://l/",{method:"POST",headers:H(physB,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),OP(o3));
 ok(r.status===404,"CROSS_TENANT_404");
 // sin scope order:write
 const noScope=tok(TA,["PHYSICIAN"],["encounter:read"]);
 r=await ords.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({orderId:crypto.randomUUID(),patientId:await freshPatient(TA),orderType:"LAB",detail:"x",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
