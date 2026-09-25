// EPIC X — Evidencia física del plan de cuidados (proponer/activar/pausar/reanudar/lograr/cancelar) contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const cp=await import("../../apps/web/app/api/v1/care-plans/route");
const act=await import("../../apps/web/app/api/v1/care-plans/[carePlanId]/activation/route");
const hold=await import("../../apps/web/app/api/v1/care-plans/[carePlanId]/hold/route");
const res=await import("../../apps/web/app/api/v1/care-plans/[carePlanId]/resumption/route");
const ach=await import("../../apps/web/app/api/v1/care-plans/[carePlanId]/achievement/route");
const can=await import("../../apps/web/app/api/v1/care-plans/[carePlanId]/cancellation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["PHYSICIAN"],scopes=["careplan:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({carePlanId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await cp.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({carePlanId:id,patientId:await freshPatient(TA),category:"DIABETES",goal:"HbA1c < 7%",occurredAt:ISO})}));return{id,r};}
const W=(t:string,v:number)=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO})});
try{
 const phys=tok(TA);
 // proponer -> activar -> pausar -> reanudar -> lograr
 let{id,r}=await mk(phys);ok(r.status===201&&(await r.json()).state==="PROPOSED","PROPOSE_201");
 r=await act.POST(new Request("http://l/",W(phys,1)),PP(id));ok(r.status===201&&(await r.json()).state==="ACTIVE","ACTIVATE_201");
 r=await hold.POST(new Request("http://l/",W(phys,2)),PP(id));ok(r.status===201&&(await r.json()).state==="ON_HOLD","HOLD_201");
 r=await res.POST(new Request("http://l/",W(phys,3)),PP(id));ok(r.status===201&&(await r.json()).state==="ACTIVE","RESUME_201");
 r=await ach.POST(new Request("http://l/",W(phys,4)),PP(id));ok(r.status===201&&(await r.json()).state==="ACHIEVED","ACHIEVE_201");
 // SM: pausar tras lograr (terminal) -> 409
 r=await hold.POST(new Request("http://l/",W(phys,5)),PP(id));ok(r.status===409,"HOLD_AFTER_ACHIEVE_409");
 // SM: lograr un PROPOSED (sin activar) -> 409
 const two=await mk(phys);
 r=await ach.POST(new Request("http://l/",W(phys,1)),PP(two.id));ok(r.status===409,"ACHIEVE_WITHOUT_ACTIVATE_409");
 // cancelar desde ON_HOLD
 const three=await mk(phys);
 await act.POST(new Request("http://l/",W(phys,1)),PP(three.id));
 await hold.POST(new Request("http://l/",W(phys,2)),PP(three.id));
 r=await can.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({reason:"Paciente cambió de plan",occurredAt:ISO})}),PP(three.id));
 ok(r.status===201&&(await r.json()).state==="CANCELLED","CANCEL_FROM_HOLD_201");
 // cross-tenant -> 404
 const physB=tok(TB);
 r=await act.POST(new Request("http://l/",W(physB,1)),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope careplan:write -> 403
 const noScope=tok(TA,["PHYSICIAN"],["patient:read"]);
 r=await cp.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({carePlanId:crypto.randomUUID(),patientId:await freshPatient(TA),category:"OTHER",goal:"x",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
