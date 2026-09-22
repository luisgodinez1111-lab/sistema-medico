// EPIC AH — Evidencia física del triage (arribar/iniciar/clasificar/re-clasificar/cerrar/LWBS) contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-ah-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const tg=await import("../../apps/web/app/api/v1/triage/route");
const st=await import("../../apps/web/app/api/v1/triage/[triageId]/start/route");
const as=await import("../../apps/web/app/api/v1/triage/[triageId]/assessment/route");
const cl=await import("../../apps/web/app/api/v1/triage/[triageId]/closure/route");
const lw=await import("../../apps/web/app/api/v1/triage/[triageId]/lwbs/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["triage:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({triageId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await tg.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({triageId:id,patientId:await freshPatient(TA),chiefComplaint:"Dolor torácico",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const nurse=tok(TA);
 // arribar -> iniciar -> clasificar(3) -> re-clasificar(2) -> cerrar
 let{id,r}=await mk(nurse);ok(r.status===201&&(await r.json()).state==="WAITING","ARRIVE_201");
 r=await st.POST(new Request("http://l/",B(nurse,1)),PP(id));ok(r.status===201&&(await r.json()).state==="IN_TRIAGE","START_201");
 r=await as.POST(new Request("http://l/",B(nurse,2,{acuity:3})),PP(id));ok(r.status===201&&(await r.json()).state==="TRIAGED","TRIAGE_201");
 r=await as.POST(new Request("http://l/",B(nurse,3,{acuity:2})),PP(id));ok(r.status===201&&(await r.json()).state==="TRIAGED","RETRIAGE_201");
 r=await cl.POST(new Request("http://l/",B(nurse,4)),PP(id));ok(r.status===201&&(await r.json()).state==="CLOSED","CLOSE_201");
 // SM: clasificar tras cerrar (terminal) -> 409
 r=await as.POST(new Request("http://l/",B(nurse,5,{acuity:1})),PP(id));ok(r.status===409,"TRIAGE_AFTER_CLOSE_409");
 // SM: clasificar sin iniciar -> 409
 const two=await mk(nurse);
 r=await as.POST(new Request("http://l/",B(nurse,1,{acuity:4})),PP(two.id));ok(r.status===409,"TRIAGE_WITHOUT_START_409");
 // LWBS desde WAITING
 const three=await mk(nurse);
 r=await lw.POST(new Request("http://l/",B(nurse,1,{reason:"Paciente se retiró"})),PP(three.id));ok(r.status===201&&(await r.json()).state==="LWBS","LWBS_201");
 // cross-tenant -> 404
 const nurseB=tok(TB);
 r=await st.POST(new Request("http://l/",B(nurseB,1)),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope triage:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await tg.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({triageId:crypto.randomUUID(),patientId:await freshPatient(TA),chiefComplaint:"x",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
