// EPIC I — Evidencia física del ciclo de vida del documento clínico contra Neon.
// Ejecuta: pnpm exec tsx ./scripts/v22/live-document-lifecycle-proof.mts
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-i-secret";
const SECRET=process.env.SESSION_SIGNING_SECRET;

const{signSession}=await import("../../packages/session/src");
const docs=await import("../../apps/web/app/api/v1/documents/route");
const fin=await import("../../apps/web/app/api/v1/documents/[documentId]/finalization/route");
const sig=await import("../../apps/web/app/api/v1/documents/[documentId]/signature/route");
const amd=await import("../../apps/web/app/api/v1/documents/[documentId]/amendment/route");

const TENANT_A=crypto.randomUUID(),TENANT_B=crypto.randomUUID();
const now=Math.floor(Date.now()/1000);
function tok(tenantId:string,roles:string[],scopes:string[]){return signSession({sub:crypto.randomUUID(),tenantId,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string|null,extra:Record<string,string>={}){const x:Record<string,string>={"content-type":"application/json",...extra};if(t)x["authorization"]="Bearer "+t;return x;}
const DP=(id:string)=>({params:Promise.resolve({documentId:id})});
const ISO="2026-05-05T07:00:00.000Z";
const idem=()=>crypto.randomUUID();

const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const nurse=tok(TENANT_A,["NURSE"],["document:write"]);
 const physA=tok(TENANT_A,["PHYSICIAN"],["document:write"]);
 const doc=crypto.randomUUID(),pat=crypto.randomUUID();
 const content="Nota de evolución: paciente estable, plan sin cambios.";
 const expectedHash=crypto.createHash("sha256").update(content).digest("hex");

 // 1) La enfermera crea el borrador -> 201 DRAFT v1.
 let r=await docs.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem()}),body:JSON.stringify({documentId:doc,patientId:pat,docType:"PROGRESS_NOTE",title:"Evolución",content,occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).state==="DRAFT","CREATE_DRAFT_201_v1");

 // 2) Finalizar -> 201 FINALIZED v2.
 r=await fin.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),DP(doc));
 ok(r.status===201&&(await r.json()).state==="FINALIZED","FINALIZE_201_v2");

 // 3) *** PHYSICIAN CONTROL *** la enfermera NO puede firmar -> 403.
 r=await sig.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO,contentHash:expectedHash})}),DP(doc));
 ok(r.status===403,"NURSE_SIGN_FORBIDDEN_403");
 // 3b) Auditoría L-03 — sin huella, o con la huella de OTRO texto, no se firma: lo firmado debe ser lo que el médico ve.
 r=await sig.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),DP(doc));
 ok(r.status===400,"SIGN_WITHOUT_CONTENT_HASH_400");
 r=await sig.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO,contentHash:crypto.createHash("sha256").update("otro texto").digest("hex")})}),DP(doc));
 ok(r.status===409&&/SIGNED_CONTENT_MISMATCH/.test((await r.json()).error.message),"SIGN_CONTENT_MISMATCH_409");

 // 4) El médico firma -> 201 SIGNED v3 + snapshot reproducible (contentHash = sha256(content)).
 const idemSign=idem();
 const signReq=()=>new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idemSign,"if-match":"2"}),body:JSON.stringify({occurredAt:ISO,contentHash:expectedHash})});
 const t0=Date.now();r=await sig.POST(signReq(),DP(doc));
 const s=await r.json();
 ok(r.status===201&&s.state==="SIGNED"&&s.version===3,"SIGN_201_v3");
 ok(Math.abs(Date.parse(s.signedAt)-t0)<120_000&&s.signedAt!==ISO,"SIGNED_AT_IS_SERVER_TIME"); // auditoría L-02
 ok(s.contentHash===expectedHash&&typeof s.signatureDigest==="string","REPRODUCIBLE_SNAPSHOT_HASH");

 // 5) Replay idempotente de la firma -> 200.
 r=await sig.POST(signReq(),DP(doc));
 const s2=await r.json();ok(r.status===200&&s2.replayed===true&&s2.signatureDigest===s.signatureDigest&&s2.signedAt===s.signedAt,"SIGN_REPLAY_200_SAME_SIGNATURE");

 // 6) *** INMUTABILIDAD *** no se puede re-finalizar un documento firmado -> 409.
 r=await fin.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({occurredAt:ISO})}),DP(doc));
 ok(r.status===409,"SIGNED_IMMUTABLE_409");

 // 7) *** ADDENDUM APPEND-ONLY *** el médico enmienda -> 201 AMENDED v4; y otra vez -> v5.
 r=await amd.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({addendum:"Corrección: se agrega alergia a penicilina.",occurredAt:ISO})}),DP(doc));
 const a1=await r.json();
 ok(r.status===201&&a1.state==="AMENDED"&&a1.version===4,"AMEND_201_v4");
 r=await amd.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"4"}),body:JSON.stringify({addendum:"Segundo addendum.",occurredAt:ISO})}),DP(doc));
 ok(r.status===201&&(await r.json()).version===5,"AMEND_AGAIN_201_v5");

 // 8) Enmienda sin texto -> 400.
 r=await amd.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"5"}),body:JSON.stringify({occurredAt:ISO})}),DP(doc));
 ok(r.status===400,"AMEND_WITHOUT_TEXT_400");

 // 9) SM ilegal: firmar un borrador sin finalizar -> 409.
 const doc2=crypto.randomUUID();
 await docs.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem()}),body:JSON.stringify({documentId:doc2,patientId:crypto.randomUUID(),docType:"REFERRAL",title:"Ref",content:"x",occurredAt:ISO})}));
 r=await sig.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO,contentHash:crypto.createHash("sha256").update("x").digest("hex")})}),DP(doc2));
 ok(r.status===409,"SIGN_DRAFT_ILLEGAL_409");

 // 10) Concurrencia optimista: If-Match equivocado -> 409.
 r=await fin.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"7"}),body:JSON.stringify({occurredAt:ISO})}),DP(doc2));
 ok(r.status===409,"OPTIMISTIC_CONFLICT_409");

 // 11) Cross-tenant -> 404.
 const physB=tok(TENANT_B,["PHYSICIAN"],["document:write"]);
 r=await fin.POST(new Request("http://l/",{method:"POST",headers:H(physB,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),DP(doc2));
 ok(r.status===404,"CROSS_TENANT_404");

 // 12) Sin scope document:write -> 403.
 const noScope=tok(TENANT_A,["PHYSICIAN"],[]);
 r=await docs.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({documentId:crypto.randomUUID(),patientId:crypto.randomUUID(),docType:"OTHER",title:"t",content:"c",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));
process.exit(result.status==="PASS"?0:1);
