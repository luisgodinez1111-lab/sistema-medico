// EPIC AF — Evidencia física de la cadena de custodia de muestras (recolectar/enviar/recibir/resultar/rechazar) contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-af-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const sp=await import("../../apps/web/app/api/v1/specimens/route");
const tr=await import("../../apps/web/app/api/v1/specimens/[specimenId]/transit/route");
const re=await import("../../apps/web/app/api/v1/specimens/[specimenId]/receipt/route");
const rs=await import("../../apps/web/app/api/v1/specimens/[specimenId]/result/route");
const rj=await import("../../apps/web/app/api/v1/specimens/[specimenId]/rejection/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["specimen:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({specimenId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await sp.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({specimenId:id,patientId:await freshPatient(TA),specimenType:"BLOOD",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const nurse=tok(TA);
 // recolectar -> enviar -> recibir -> resultar
 let{id,r}=await mk(nurse);ok(r.status===201&&(await r.json()).state==="COLLECTED","COLLECT_201");
 r=await tr.POST(new Request("http://l/",B(nurse,1)),PP(id));ok(r.status===201&&(await r.json()).state==="IN_TRANSIT","TRANSIT_201");
 r=await re.POST(new Request("http://l/",B(nurse,2)),PP(id));ok(r.status===201&&(await r.json()).state==="RECEIVED","RECEIPT_201");
 r=await rs.POST(new Request("http://l/",B(nurse,3)),PP(id));ok(r.status===201&&(await r.json()).state==="RESULTED","RESULT_201");
 // SM: resultar dos veces (terminal) -> 409
 r=await rs.POST(new Request("http://l/",B(nurse,4)),PP(id));ok(r.status===409,"RESULT_TERMINAL_409");
 // SM: resultar sin recibir -> 409
 const two=await mk(nurse);
 await tr.POST(new Request("http://l/",B(nurse,1)),PP(two.id));
 r=await rs.POST(new Request("http://l/",B(nurse,2)),PP(two.id));ok(r.status===409,"RESULT_WITHOUT_RECEIPT_409");
 // rechazo al recibir
 const three=await mk(nurse);
 await tr.POST(new Request("http://l/",B(nurse,1)),PP(three.id));
 await re.POST(new Request("http://l/",B(nurse,2)),PP(three.id));
 r=await rj.POST(new Request("http://l/",B(nurse,3,{reason:"Muestra hemolizada"})),PP(three.id));ok(r.status===201&&(await r.json()).state==="REJECTED","REJECT_201");
 // cross-tenant -> 404
 const nurseB=tok(TB);
 r=await tr.POST(new Request("http://l/",B(nurseB,1)),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope specimen:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await sp.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({specimenId:crypto.randomUUID(),patientId:await freshPatient(TA),specimenType:"URINE",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
