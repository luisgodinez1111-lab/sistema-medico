// EPIC D — Evidencia física del ciclo de vida del encuentro (open -> assess -> sign) contra Neon.
// Ejecuta: pnpm exec tsx ./scripts/v22/live-encounter-lifecycle-proof.mts
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{
 const envRaw=fs.readFileSync(path.resolve(".env.local"),"utf8");
 for(const line of envRaw.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}
}catch{/* env ya cargado */}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-d-lifecycle-secret";
const SECRET=process.env.SESSION_SIGNING_SECRET;

const{signSession}=await import("../../packages/session/src");
const open=await import("../../apps/web/app/api/v1/encounters/route");
const assess=await import("../../apps/web/app/api/v1/encounters/[encounterId]/assessment/route");
const sign=await import("../../apps/web/app/api/v1/encounters/[encounterId]/signature/route");
const{default:postgres}=await import("postgres");

const TENANT_A=crypto.randomUUID(),TENANT_B=crypto.randomUUID();
const now=Math.floor(Date.now()/1000);
function tok(tenantId:string,roles:string[]){return signSession({sub:crypto.randomUUID(),tenantId,roles,scopes:["encounter:write","encounter:read"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function h(tok:string|null,extra:Record<string,string>={}){const x:Record<string,string>={"content-type":"application/json",...extra};if(tok)x["authorization"]="Bearer "+tok;return x;}
const P=(id:string)=>({params:Promise.resolve({encounterId:id})});
const ISO="2026-02-02T10:00:00.000Z";

const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}

const raw=process.env.DATABASE_URL.replace("-pooler","").replace(/([?&])channel_binding=require/,"$1").replace(/[?&]$/,"");
const sql=postgres(raw,{max:2,prepare:false,onnotice:()=>{}});
try{
 const physA=tok(TENANT_A,["PHYSICIAN"]);
 const enc=crypto.randomUUID(),pat=crypto.randomUUID();

 // 1) Abrir
 let r=await open.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID()}),body:JSON.stringify({encounterId:enc,patientId:pat,occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).version===1,"OPEN_201_v1");

 // 2) Firmar sin assessment -> 403 (nada que firmar)
 r=await sign.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),P(enc));
 ok(r.status===403,"SIGN_WITHOUT_ASSESSMENT_403");

 // 3) Assess (OPEN->READY_TO_SIGN)
 const idemAssess=crypto.randomUUID();
 const assessReq=()=>new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":idemAssess,"if-match":"1"}),body:JSON.stringify({assessment:"Dx: X",plan:"Plan: Y",occurredAt:ISO})});
 r=await assess.POST(assessReq(),P(enc));
 const a1=await r.json();
 ok(r.status===201&&a1.status==="READY_TO_SIGN"&&a1.version===2,"ASSESS_201_v2");

 // 4) Replay idéntico del assess -> 200 replayed v2
 r=await assess.POST(assessReq(),P(enc));
 const a2=await r.json();
 ok(r.status===200&&a2.replayed===true&&a2.version===2,"ASSESS_REPLAY_200");

 // 5) Re-assess con otra clave (transición ya aplicada) -> 409 (SM)
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({assessment:"Z",plan:"W",occurredAt:ISO})}),P(enc));
 ok(r.status===409,"REASSESS_ILLEGAL_409");

 // 6) Firmar (READY_TO_SIGN->SIGNED) con If-Match 2
 const idemSign=crypto.randomUUID();
 const signReq=()=>new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":idemSign,"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})});
 r=await sign.POST(signReq(),P(enc));
 const s1=await r.json();
 ok(r.status===201&&s1.status==="SIGNED"&&s1.version===3&&typeof s1.signatureDigest==="string","SIGN_201_v3");

 // 7) Replay de la firma -> 200 replayed
 r=await sign.POST(signReq(),P(enc));
 ok(r.status===200&&(await r.json()).replayed===true,"SIGN_REPLAY_200");

 // 8) Assess tras SIGNED -> 409 (inmutable, SM)
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"3"}),body:JSON.stringify({assessment:"Q",plan:"R",occurredAt:ISO})}),P(enc));
 ok(r.status===409,"ASSESS_AFTER_SIGNED_409");

 // 9) Concurrencia optimista: nuevo encuentro, assess con If-Match equivocado -> 409 (kernel)
 const enc2=crypto.randomUUID();
 await open.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID()}),body:JSON.stringify({encounterId:enc2,patientId:crypto.randomUUID(),occurredAt:ISO})}));
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"5"}),body:JSON.stringify({assessment:"a",plan:"b",occurredAt:ISO})}),P(enc2));
 ok(r.status===409,"OPTIMISTIC_CONFLICT_409");

 // 10) Cross-tenant: médico de tenant B no ve el encuentro de A -> 404
 const physB=tok(TENANT_B,["PHYSICIAN"]);
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:h(physB,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({assessment:"a",plan:"b",occurredAt:ISO})}),P(enc));
 ok(r.status===404,"CROSS_TENANT_404");

 // 11) Physician Control: enfermera no puede escribir -> 403
 const nurse=tok(TENANT_A,["NURSE"]);
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:h(nurse,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({assessment:"a",plan:"b",occurredAt:ISO})}),P(enc));
 ok(r.status===403,"ROLE_FORBIDDEN_403");

 // 12) Zero Lost Follow-Up: obligación crítica abierta bloquea la firma -> 403
 const enc3=crypto.randomUUID(),pat3=crypto.randomUUID();
 await open.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID()}),body:JSON.stringify({encounterId:enc3,patientId:pat3,occurredAt:ISO})}));
 await assess.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({assessment:"a",plan:"b",occurredAt:ISO})}),P(enc3));
 // Insertar obligación crítica URGENT sin resolver para el paciente (como owner).
 await sql`insert into clinical_inbox(id,tenant_id,patient_id,kind,priority,owner_id) values(${crypto.randomUUID()},${TENANT_A},${pat3},'CRITICAL_RESULT','URGENT',${crypto.randomUUID()})`;
 r=await sign.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),P(enc3));
 ok(r.status===403,"CRITICAL_OBLIGATION_BLOCKS_SIGN_403");
}catch(e){result.status="FAIL";result.error=String(e);}finally{await sql.end();}
console.log(JSON.stringify(result,null,2));
process.exit(result.status==="PASS"?0:1);
