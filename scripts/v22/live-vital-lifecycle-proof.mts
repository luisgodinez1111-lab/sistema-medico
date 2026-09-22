// EPIC W — Evidencia física de signos vitales (registrar/enmendar/marcar-error) contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-w-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const vt=await import("../../apps/web/app/api/v1/vitals/route");
const am=await import("../../apps/web/app/api/v1/vitals/[vitalId]/amendment/route");
const er=await import("../../apps/web/app/api/v1/vitals/[vitalId]/error-mark/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["vital:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({vitalId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await vt.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:id,patientId:crypto.randomUUID(),vitalType:"BP",value:"120/80",unit:"mmHg",occurredAt:ISO})}));return{id,r};}
try{
 const nurse=tok(TA);
 // registrar -> enmendar -> re-enmendar
 let{id,r}=await mk(nurse);ok(r.status===201&&(await r.json()).state==="RECORDED","RECORD_201");
 r=await am.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({value:"130/85",unit:"mmHg",reason:"Error de captura",occurredAt:ISO})}),PP(id));
 ok(r.status===201&&(await r.json()).state==="AMENDED","AMEND_201");
 r=await am.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({value:"128/82",unit:"mmHg",reason:"Reverificado",occurredAt:ISO})}),PP(id));
 ok(r.status===201&&(await r.json()).state==="AMENDED","RE_AMEND_201");
 // marcar error (terminal)
 const two=await mk(nurse);
 r=await er.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"Paciente equivocado",occurredAt:ISO})}),PP(two.id));
 ok(r.status===201&&(await r.json()).state==="ENTERED_IN_ERROR","ERROR_MARK_201");
 // SM: enmendar tras marcar error (terminal) -> 409
 r=await am.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({value:"125/80",unit:"mmHg",reason:"y",occurredAt:ISO})}),PP(two.id));
 ok(r.status===409,"AMEND_AFTER_ERROR_409");
 // Auditoría C-13: un valor físicamente imposible se RECHAZA al capturar (400), no se guarda como "desconocido"
 r=await vt.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:crypto.randomUUID(),vitalType:"WEIGHT",value:"700",unit:"kg",occurredAt:ISO})}));
 ok(r.status===400&&(await r.json()).error.code==="VALIDATION_ERROR","IMPLAUSIBLE_WEIGHT_REJECTED_400");
 r=await vt.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:crypto.randomUUID(),vitalType:"BP",value:"80/120",unit:"mmHg",occurredAt:ISO})}));
 ok(r.status===400,"IMPLAUSIBLE_BP_REJECTED_400");
 // idempotencia: repetir la MISMA enmienda (misma idempotency-key) -> replay 200
 const three=await mk(nurse);const k=idem();
 r=await am.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":k,"if-match":"1"}),body:JSON.stringify({value:"140/90",unit:"mmHg",reason:"z",occurredAt:ISO})}),PP(three.id));
 ok(r.status===201,"AMEND3_201");
 r=await am.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":k,"if-match":"1"}),body:JSON.stringify({value:"140/90",unit:"mmHg",reason:"z",occurredAt:ISO})}),PP(three.id));
 ok(r.status===200&&(await r.json()).replayed===true,"AMEND3_REPLAY_200");
 // cross-tenant -> 404
 const nurseB=tok(TB);
 r=await am.POST(new Request("http://l/",{method:"POST",headers:H(nurseB,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({value:"x",unit:"mmHg",reason:"y",occurredAt:ISO})}),PP(two.id));
 ok(r.status===404,"CROSS_TENANT_404");
 // sin scope vital:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await vt.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:crypto.randomUUID(),vitalType:"HR",value:"72",unit:"bpm",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
