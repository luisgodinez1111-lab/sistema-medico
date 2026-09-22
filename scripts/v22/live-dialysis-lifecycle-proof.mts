// EPIC AL — Evidencia física de la sesión de diálisis (agendar/iniciar/interrumpir/reanudar/completar) contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-al-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const ds=await import("../../apps/web/app/api/v1/dialysis-sessions/route");
const st=await import("../../apps/web/app/api/v1/dialysis-sessions/[dialysisId]/start/route");
const it=await import("../../apps/web/app/api/v1/dialysis-sessions/[dialysisId]/interruption/route");
const re=await import("../../apps/web/app/api/v1/dialysis-sessions/[dialysisId]/resumption/route");
const co=await import("../../apps/web/app/api/v1/dialysis-sessions/[dialysisId]/completion/route");
const ns=await import("../../apps/web/app/api/v1/dialysis-sessions/[dialysisId]/no-show/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["dialysis:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({dialysisId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await ds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({dialysisId:id,patientId:await freshPatient(TA),modality:"HEMODIALYSIS",accessType:"FISTULA",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const nurse=tok(TA);
 // agendar -> iniciar -> interrumpir -> reanudar -> completar
 let{id,r}=await mk(nurse);ok(r.status===201&&(await r.json()).state==="SCHEDULED","SCHEDULE_201");
 r=await st.POST(new Request("http://l/",B(nurse,1)),PP(id));ok(r.status===201&&(await r.json()).state==="IN_SESSION","START_201");
 r=await it.POST(new Request("http://l/",B(nurse,2,{reason:"Hipotensión"})),PP(id));ok(r.status===201&&(await r.json()).state==="INTERRUPTED","INTERRUPT_201");
 r=await re.POST(new Request("http://l/",B(nurse,3)),PP(id));ok(r.status===201&&(await r.json()).state==="IN_SESSION","RESUME_201");
 r=await co.POST(new Request("http://l/",B(nurse,4)),PP(id));ok(r.status===201&&(await r.json()).state==="COMPLETED","COMPLETE_201");
 // SM: iniciar tras completar (terminal) -> 409
 r=await st.POST(new Request("http://l/",B(nurse,5)),PP(id));ok(r.status===409,"START_AFTER_COMPLETE_409");
 // SM: completar sin iniciar -> 409
 const two=await mk(nurse);
 r=await co.POST(new Request("http://l/",B(nurse,1)),PP(two.id));ok(r.status===409,"COMPLETE_WITHOUT_START_409");
 // no-show desde SCHEDULED
 const three=await mk(nurse);
 r=await ns.POST(new Request("http://l/",B(nurse,1)),PP(three.id));ok(r.status===201&&(await r.json()).state==="NO_SHOW","NOSHOW_201");
 // cross-tenant -> 404
 const nurseB=tok(TB);
 r=await st.POST(new Request("http://l/",B(nurseB,1)),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope dialysis:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await ds.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({dialysisId:crypto.randomUUID(),patientId:await freshPatient(TA),modality:"PERITONEAL",accessType:"PERITONEAL_CATHETER",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
