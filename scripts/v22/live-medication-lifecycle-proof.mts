// EPIC H — Evidencia física del ciclo de vida de medicación (Physician Control) contra Neon.
// Ejecuta: pnpm exec tsx ./scripts/v22/live-medication-lifecycle-proof.mts
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{
 const envRaw=fs.readFileSync(path.resolve(".env.local"),"utf8");
 for(const line of envRaw.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}
}catch{/* env ya cargado */}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-h-secret";
const SECRET=process.env.SESSION_SIGNING_SECRET;

const{signSession}=await import("../../packages/session/src");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const act=await import("../../apps/web/app/api/v1/medications/[medicationId]/activation/route");
const stop=await import("../../apps/web/app/api/v1/medications/[medicationId]/discontinuation/route");

const TENANT_A=crypto.randomUUID(),TENANT_B=crypto.randomUUID();
const now=Math.floor(Date.now()/1000);
function tok(tenantId:string,roles:string[],scopes:string[]){return signSession({sub:crypto.randomUUID(),tenantId,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string|null,extra:Record<string,string>={}){const x:Record<string,string>={"content-type":"application/json",...extra};if(t)x["authorization"]="Bearer "+t;return x;}
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});
const ISO="2026-04-04T08:00:00.000Z";
const idem=()=>crypto.randomUUID();

const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const nurse=tok(TENANT_A,["NURSE"],["medication:propose"]);
 const physA=tok(TENANT_A,["PHYSICIAN"],["medication:propose","medication:write"]);
 const med=crypto.randomUUID(),pat=crypto.randomUUID();
 const drug={drugCode:"amoxicilina-500",dose:"500mg",route:"PO",frequency:"c/8h"};

 // 1) La ENFERMERA propone (no requiere ser médico) -> 201 PROPOSED v1.
 let r=await meds.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:med,patientId:pat,...drug,occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).state==="PROPOSED","NURSE_PROPOSE_201");

 // 2) *** PHYSICIAN CONTROL *** la enfermera NO puede prescribir -> 403.
 r=await rx.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),MP(med));
 ok(r.status===403,"NURSE_PRESCRIBE_FORBIDDEN_403");

 // 3) El MÉDICO prescribe -> 201 PRESCRIBED v2.
 const idemRx=idem();
 const rxReq=()=>new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idemRx,"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})});
 r=await rx.POST(rxReq(),MP(med));
 ok(r.status===201&&(await r.json()).state==="PRESCRIBED","PHYSICIAN_PRESCRIBE_201_v2");

 // 4) Replay idempotente de la prescripción -> 200.
 r=await rx.POST(rxReq(),MP(med));
 ok(r.status===200&&(await r.json()).replayed===true,"PRESCRIBE_REPLAY_200");

 // 5) SM ilegal: suspender desde PRESCRIBED (aún no activa) -> 409.
 r=await stop.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({reason:"x",occurredAt:ISO})}),MP(med));
 ok(r.status===409,"STOP_FROM_PRESCRIBED_ILLEGAL_409");

 // 6) Activar -> 201 ACTIVE v3.
 r=await act.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),MP(med));
 ok(r.status===201&&(await r.json()).state==="ACTIVE","ACTIVATE_201_v3");

 // 7) Suspender sin razón -> 400; con razón -> 201 STOPPED v4.
 r=await stop.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({occurredAt:ISO})}),MP(med));
 ok(r.status===400,"STOP_WITHOUT_REASON_400");
 r=await stop.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({reason:"reacción adversa",occurredAt:ISO})}),MP(med));
 ok(r.status===201&&(await r.json()).state==="STOPPED","DISCONTINUE_201_v4");

 // 8) Activar tras STOPPED -> 409 (inmutable).
 r=await act.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"4"}),body:JSON.stringify({occurredAt:ISO})}),MP(med));
 ok(r.status===409,"ACTIVATE_AFTER_STOPPED_409");

 // 9) Concurrencia optimista: nueva medicación, prescribir con If-Match equivocado -> 409.
 const med2=crypto.randomUUID();
 await meds.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:med2,patientId:crypto.randomUUID(),...drug,occurredAt:ISO})}));
 r=await rx.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"7"}),body:JSON.stringify({occurredAt:ISO})}),MP(med2));
 ok(r.status===409,"OPTIMISTIC_CONFLICT_409");

 // 10) Cross-tenant: médico de tenant B no ve la medicación de A -> 404.
 const physB=tok(TENANT_B,["PHYSICIAN"],["medication:propose","medication:write"]);
 r=await rx.POST(new Request("http://l/",{method:"POST",headers:H(physB,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),MP(med2));
 ok(r.status===404,"CROSS_TENANT_404");

 // 11) Sin scope medication:propose -> 403 (aunque sea médico).
 const noScope=tok(TENANT_A,["PHYSICIAN"],[]);
 r=await meds.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:crypto.randomUUID(),patientId:crypto.randomUUID(),...drug,occurredAt:ISO})}));
 ok(r.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));
process.exit(result.status==="PASS"?0:1);
