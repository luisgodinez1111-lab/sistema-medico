// EPIC V — Evidencia física de la cartilla de vacunas (indicar/aplicar/rechazar/evento adverso) contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-v-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const im=await import("../../apps/web/app/api/v1/immunizations/route");
const adm=await import("../../apps/web/app/api/v1/immunizations/[immunizationId]/administration/route");
const ref=await import("../../apps/web/app/api/v1/immunizations/[immunizationId]/refusal/route");
const adv=await import("../../apps/web/app/api/v1/immunizations/[immunizationId]/adverse-event/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["immunization:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({immunizationId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await im.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({immunizationId:id,patientId:await freshPatient(TA),vaccineCode:"SRP",dose:"1",occurredAt:ISO})}));return{id,r};}
try{
 const nurse=tok(TA);
 // camino feliz: DUE -> ADMINISTERED -> ADVERSE_EVENT
 let{id,r}=await mk(nurse);ok(r.status===201&&(await r.json()).state==="DUE","DUE_201");
 r=await adm.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({lot:"L-2026-A",site:"deltoides izq",occurredAt:ISO})}),PP(id));
 ok(r.status===201&&(await r.json()).state==="ADMINISTERED","ADMINISTER_201");
 r=await adv.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({reaction:"Fiebre leve",occurredAt:ISO})}),PP(id));
 ok(r.status===201&&(await r.json()).state==="ADVERSE_EVENT","ADVERSE_EVENT_201");
 // SM: evento adverso tras terminal -> 409
 r=await adv.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({reaction:"x",occurredAt:ISO})}),PP(id));
 ok(r.status===409,"ADVERSE_TERMINAL_409");
 // SM: evento adverso sin aplicar -> 409
 const two=await mk(nurse);
 r=await adv.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reaction:"x",occurredAt:ISO})}),PP(two.id));
 ok(r.status===409,"ADVERSE_WITHOUT_ADMIN_409");
 // rechazo desde DUE
 const three=await mk(nurse);
 r=await ref.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"Rechazo de tutor",occurredAt:ISO})}),PP(three.id));
 ok(r.status===201&&(await r.json()).state==="REFUSED","REFUSE_201");
 // SM: aplicar tras rechazo (terminal) -> 409
 r=await adm.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({lot:"L",site:"x",occurredAt:ISO})}),PP(three.id));
 ok(r.status===409,"ADMIN_AFTER_REFUSE_409");
 // cross-tenant: tenant B no puede tocar la vacuna de A -> 404
 const nurseB=tok(TB);
 r=await adm.POST(new Request("http://l/",{method:"POST",headers:H(nurseB,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({lot:"L",site:"x",occurredAt:ISO})}),PP(two.id));
 ok(r.status===404,"CROSS_TENANT_404");
 // sin scope immunization:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await im.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({immunizationId:crypto.randomUUID(),patientId:await freshPatient(TA),vaccineCode:"X",dose:"1",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
