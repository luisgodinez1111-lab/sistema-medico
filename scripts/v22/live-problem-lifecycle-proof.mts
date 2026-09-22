// EPIC Q — Evidencia física del ciclo de vida del problema clínico contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-q-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const pr=await import("../../apps/web/app/api/v1/problems/route");
const res=await import("../../apps/web/app/api/v1/problems/[problemId]/resolution/route");
const rea=await import("../../apps/web/app/api/v1/problems/[problemId]/reactivation/route");
const chr=await import("../../apps/web/app/api/v1/problems/[problemId]/chronicity/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,scopes=["problem:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({problemId:id})});const ISO="2026-09-09T09:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok(TA);const p=crypto.randomUUID(),pat=crypto.randomUUID();await ensurePatientIn(TA,pat); /* L-07 */
 let r=await pr.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({problemId:p,patientId:pat,code:"J06.9",occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).state==="ACTIVE","ADD_ACTIVE_201");
 // resolver sin nota -> 400
 r=await res.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),PP(p));
 ok(r.status===400,"RESOLVE_WITHOUT_NOTE_400");
 const idemR=idem();const rReq=()=>new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idemR,"if-match":"1"}),body:JSON.stringify({note:"Resuelto con tratamiento",occurredAt:ISO})});
 r=await res.POST(rReq(),PP(p));ok(r.status===201&&(await r.json()).state==="RESOLVED","RESOLVE_201_v2");
 r=await res.POST(rReq(),PP(p));ok(r.status===200&&(await r.json()).replayed===true,"RESOLVE_REPLAY_200");
 r=await rea.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),PP(p));
 ok(r.status===201&&(await r.json()).state==="ACTIVE","REACTIVATE_201_v3");
 r=await chr.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({occurredAt:ISO})}),PP(p));
 ok(r.status===201&&(await r.json()).state==="CHRONIC","CHRONIC_201_v4");
 // reactivar un cronico -> ilegal (CHRONIC->ACTIVE no permitido) 409
 r=await rea.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"4"}),body:JSON.stringify({occurredAt:ISO})}),PP(p));
 ok(r.status===409,"REACTIVATE_CHRONIC_ILLEGAL_409");
 // cross-tenant
 const physB=tok(TB);
 r=await res.POST(new Request("http://l/",{method:"POST",headers:H(physB,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({note:"x",occurredAt:ISO})}),PP(p));
 ok(r.status===404,"CROSS_TENANT_404");
 // sin scope
 const noScope=tok(TA,["encounter:read"]);
 r=await pr.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:await freshPatient(TA),code:"x",description:"y",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
