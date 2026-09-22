// EPIC AE — Evidencia física del internamiento (admitir/trasladar/alta/cancelar) contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-ae-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const ad=await import("../../apps/web/app/api/v1/admissions/route");
const tr=await import("../../apps/web/app/api/v1/admissions/[admissionId]/transfer/route");
const di=await import("../../apps/web/app/api/v1/admissions/[admissionId]/discharge/route");
const ca=await import("../../apps/web/app/api/v1/admissions/[admissionId]/cancellation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["admission:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({admissionId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await ad.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({admissionId:id,patientId:crypto.randomUUID(),unit:"ER",reason:"Dolor torácico",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>)=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const nurse=tok(TA);
 // admitir -> trasladar ICU -> trasladar WARD -> alta
 let{id,r}=await mk(nurse);ok(r.status===201&&(await r.json()).state==="ADMITTED","ADMIT_201");
 r=await tr.POST(new Request("http://l/",B(nurse,1,{unit:"ICU"})),PP(id));ok(r.status===201&&(await r.json()).state==="TRANSFERRED","TRANSFER_ICU_201");
 r=await tr.POST(new Request("http://l/",B(nurse,2,{unit:"WARD"})),PP(id));ok(r.status===201&&(await r.json()).state==="TRANSFERRED","TRANSFER_WARD_201");
 r=await di.POST(new Request("http://l/",B(nurse,3,{disposition:"Alta a domicilio"})),PP(id));ok(r.status===201&&(await r.json()).state==="DISCHARGED","DISCHARGE_201");
 // SM: trasladar tras alta (terminal) -> 409
 r=await tr.POST(new Request("http://l/",B(nurse,4,{unit:"ICU"})),PP(id));ok(r.status===409,"TRANSFER_AFTER_DISCHARGE_409");
 // cancelar (admisión por error) desde ADMITTED
 const two=await mk(nurse);
 r=await ca.POST(new Request("http://l/",B(nurse,1,{reason:"Admisión duplicada"})),PP(two.id));ok(r.status===201&&(await r.json()).state==="CANCELLED","CANCEL_201");
 // SM: alta tras cancelar (terminal) -> 409
 r=await di.POST(new Request("http://l/",B(nurse,2,{disposition:"x"})),PP(two.id));ok(r.status===409,"DISCHARGE_AFTER_CANCEL_409");
 // cross-tenant -> 404
 const nurseB=tok(TB);
 const three=await mk(nurse);
 r=await tr.POST(new Request("http://l/",B(nurseB,1,{unit:"ICU"})),PP(three.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope admission:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await ad.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({admissionId:crypto.randomUUID(),patientId:crypto.randomUUID(),unit:"ER",reason:"x",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
