// EPIC B — Evidencia física del vertical clínico autenticado (endpoint real contra Neon).
// Ejecuta: pnpm exec tsx ./scripts/v22/live-encounter-endpoint-proof.mts
// Requiere TEST_DATABASE_URL (base desechable). El secreto de sesión se fija aquí para
// firmar tokens de prueba consistentes con el verificador del endpoint.
import crypto from"node:crypto";

import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-b-live-proof-secret";
const SECRET=process.env.SESSION_SIGNING_SECRET;

const{signSession}=await import("../../packages/session/src");
const{POST,GET}=await import("../../apps/web/app/api/v1/encounters/route");

const TENANT_A=crypto.randomUUID();
const TENANT_B=crypto.randomUUID();
const now=Math.floor(Date.now()/1000);
function tokenFor(tenantId:string,roles:string[]){
 return signSession({sub:crypto.randomUUID(),tenantId,roles,scopes:["encounter:write","encounter:read"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
}
function postReq(tok:string|null,idem:string|null,body:unknown){
 const headers:Record<string,string>={"content-type":"application/json"};
 if(tok)headers["authorization"]="Bearer "+tok;
 if(idem)headers["idempotency-key"]=idem;
 return new Request("http://local/api/v1/encounters",{method:"POST",headers,body:JSON.stringify(body)});
}
function getReq(tok:string,encounterId:string){
 return new Request("http://local/api/v1/encounters?encounterId="+encounterId,{headers:{authorization:"Bearer "+tok}});
}

const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function assert(cond:boolean,label:string){if(!cond)throw new Error("FAIL:"+label);result.checks.push(label);}

try{
 const physA=tokenFor(TENANT_A,["PHYSICIAN"]);
 const encounterId=crypto.randomUUID();
 const patientId=crypto.randomUUID();
 const idem=crypto.randomUUID();
 // El cliente acuña el cuerpo UNA vez (incl. occurredAt) y lo reenvía idéntico en el reintento.
 const openBody={encounterId,patientId,occurredAt:new Date().toISOString()};

 // P1 — abrir encuentro (fresh) => 201, version 1
 const r1=await POST(postReq(physA,idem,openBody));
 const b1=await r1.json();
 assert(r1.status===201&&b1.version===1&&b1.replayed===false,"OPEN_201_v1");
 assert(typeof b1.auditHash==="string"&&b1.auditHash.length>0,"AUDIT_HASH_PRESENT");

 // P2 — reintento idéntico (misma Idempotency-Key + mismo cuerpo) => 200 replayed
 const r2=await POST(postReq(physA,idem,openBody));
 const b2=await r2.json();
 assert(r2.status===200&&b2.replayed===true&&b2.version===1,"IDEMPOTENT_REPLAY_200");

 // P3 — lectura RLS-scoped del mismo tenant => 200 con 1 evento
 const r3=await GET(getReq(physA,encounterId));
 const b3=await r3.json();
 assert(r3.status===200&&b3.version===1&&Array.isArray(b3.events)&&b3.events.length===1,"READ_200_v1");
 assert(b3.events[0].type==="Encounter","EVENT_AGGREGATE_TYPE");

 // P4 — aislamiento cross-tenant: tenant B no ve el encuentro de A => 404
 const physB=tokenFor(TENANT_B,["PHYSICIAN"]);
 const r4=await GET(getReq(physB,encounterId));
 assert(r4.status===404,"CROSS_TENANT_ISOLATION_404");

 // P5 — sin sesión verificada => 401 fail-closed
 const r5=await POST(postReq(null,crypto.randomUUID(),{encounterId:crypto.randomUUID(),patientId}));
 assert(r5.status===401,"NO_SESSION_401");

 // P6 — rol insuficiente (no PHYSICIAN) => 403
 const nurse=tokenFor(TENANT_A,["NURSE"]);
 const r6=await POST(postReq(nurse,crypto.randomUUID(),{encounterId:crypto.randomUUID(),patientId}));
 assert(r6.status===403,"ROLE_FORBIDDEN_403");

 // P7 — sin Idempotency-Key => 428 precondición requerida
 const r7=await POST(postReq(physA,null,{encounterId:crypto.randomUUID(),patientId}));
 assert(r7.status===428,"IDEMPOTENCY_REQUIRED_428");

 // P8 — payload inválido => 400
 const r8=await POST(postReq(physA,crypto.randomUUID(),{encounterId:"not-a-uuid",patientId}));
 assert(r8.status===400,"VALIDATION_400");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));
process.exit(result.status==="PASS"?0:1);
