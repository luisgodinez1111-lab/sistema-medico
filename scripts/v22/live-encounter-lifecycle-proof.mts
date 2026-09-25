// EPIC D — Evidencia física del ciclo de vida del encuentro (open -> assess -> sign) contra Neon.
// Ejecuta: pnpm exec tsx ./scripts/v22/live-encounter-lifecycle-proof.mts
import crypto from"node:crypto";
import{directEndpoint}from"../../packages/pg-endpoint/src";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
const SECRET=process.env.SESSION_SIGNING_SECRET;

const{signSession}=await import("../../packages/session/src");
const open=await import("../../apps/web/app/api/v1/encounters/route");
const assess=await import("../../apps/web/app/api/v1/encounters/[encounterId]/assessment/route");
const sign=await import("../../apps/web/app/api/v1/encounters/[encounterId]/signature/route");
const oblig=await import("../../apps/web/app/api/v1/obligations/route");
const oblDone=await import("../../apps/web/app/api/v1/obligations/[obligationId]/completion/route");
const oblCancel=await import("../../apps/web/app/api/v1/obligations/[obligationId]/cancellation/route");
const{default:postgres}=await import("postgres");

const TENANT_A=crypto.randomUUID(),TENANT_B=crypto.randomUUID();
const now=Math.floor(Date.now()/1000);
function tok(tenantId:string,roles:string[]){return signSession({sub:crypto.randomUUID(),tenantId,roles,scopes:["encounter:write","encounter:read","obligation:write"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function h(tok:string|null,extra:Record<string,string>={}){const x:Record<string,string>={"content-type":"application/json",...extra};if(tok)x["authorization"]="Bearer "+tok;return x;}
const P=(id:string)=>({params:Promise.resolve({encounterId:id})});
const ISO="2026-02-02T10:00:00.000Z";
// Auditoría L-03: la firma exige la huella (sha256 de `${assessment}\n${plan}`) del contenido que el cliente muestra.
const hashOf=(assessment:string,plan:string)=>crypto.createHash("sha256").update(`${assessment}\n${plan}`).digest("hex");
const OP=(id:string)=>({params:Promise.resolve({obligationId:id})});

const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}

const raw=directEndpoint(process.env.DATABASE_URL??"");
const sql=postgres(raw,{max:2,prepare:false,onnotice:()=>{}});
try{
 const physA=tok(TENANT_A,["PHYSICIAN"]);await registerPhysicianCredentials(physA);
 const enc=crypto.randomUUID(),pat=crypto.randomUUID();await ensurePatientIn(TENANT_A,pat); /* L-07 */

 // 1) Abrir
 let r=await open.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID()}),body:JSON.stringify({encounterId:enc,patientId:pat,occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).version===1,"OPEN_201_v1");

 // 2) Firmar sin assessment -> 403 (nada que firmar)
 r=await sign.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO,contentHash:hashOf("","")})}),P(enc));
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

 // 5) Re-assess con versión OBSOLETA -> 409 (concurrencia). Con la versión vigente SÍ procede: mientras la nota no esté
 //    firmada el médico puede corregirla (auditoría L-03; antes era ilegal y un cambio posterior no llegaba a lo firmado).
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({assessment:"Z",plan:"W",occurredAt:ISO})}),P(enc));
 ok(r.status===409,"REASSESS_STALE_VERSION_409");
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"2"}),body:JSON.stringify({assessment:"Dx: X corregido",plan:"Plan: Y",occurredAt:ISO})}),P(enc));
 const a3=await r.json();ok(r.status===201&&a3.version===3&&a3.contentHash===hashOf("Dx: X corregido","Plan: Y"),"REASSESS_BEFORE_SIGN_201_v3");

 // 6a) L-03 — firmar con la huella del texto ANTERIOR (lo que el cliente tenía en pantalla antes de la corrección) -> 409
 r=await sign.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"3"}),body:JSON.stringify({occurredAt:ISO,contentHash:hashOf("Dx: X","Plan: Y")})}),P(enc));
 ok(r.status===409&&/SIGNED_CONTENT_MISMATCH/.test((await r.json()).error.message),"SIGN_CONTENT_MISMATCH_409");
 r=await sign.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"3"}),body:JSON.stringify({occurredAt:ISO})}),P(enc));
 ok(r.status===400,"SIGN_WITHOUT_CONTENT_HASH_400");
 // 6b) Firmar (READY_TO_SIGN->SIGNED) con If-Match 3 y la huella correcta. L-02: la hora la pone el SERVIDOR, no el cliente
 //     (el cliente manda una fecha de febrero; la firma queda fechada "ahora").
 const idemSign=crypto.randomUUID();const t0=Date.now();
 const signReq=()=>new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":idemSign,"if-match":"3"}),body:JSON.stringify({occurredAt:ISO,contentHash:hashOf("Dx: X corregido","Plan: Y")})});
 r=await sign.POST(signReq(),P(enc));
 const s1=await r.json();
 ok(r.status===201&&s1.status==="SIGNED"&&s1.version===4&&typeof s1.signatureDigest==="string","SIGN_201_v4");
 ok(Math.abs(Date.parse(s1.signedAt)-t0)<120_000&&s1.signedAt!==ISO,"SIGNED_AT_IS_SERVER_TIME");
 const ev=await sql`select payload,occurred_at from clinical_events where tenant_id=${TENANT_A} and aggregate_id=${enc} order by sequence desc limit 1`;
 ok(ev[0]!.payload.signedAtSource==="SERVER"&&ev[0]!.payload.clientOccurredAt===ISO&&ev[0]!.payload.signedAt===s1.signedAt&&Math.abs(new Date(ev[0]!.occurred_at).getTime()-t0)<120_000,"SIGNED_EVENT_CARRIES_SERVER_TIME");

 // 7) Replay de la firma -> 200 replayed
 // 7) Replay de la firma -> 200 con la MISMA firma y hora (la hora del servidor es estable ante reintentos)
 r=await sign.POST(signReq(),P(enc));
 const s2=await r.json();ok(r.status===200&&s2.replayed===true&&s2.signatureDigest===s1.signatureDigest&&s2.signedAt===s1.signedAt,"SIGN_REPLAY_200_SAME_SIGNATURE");

 // 8) Assess tras SIGNED -> 409 (inmutable, SM)
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"4"}),body:JSON.stringify({assessment:"Q",plan:"R",occurredAt:ISO})}),P(enc));
 ok(r.status===409,"ASSESS_AFTER_SIGNED_409");

 // 9) Concurrencia optimista: nuevo encuentro, assess con If-Match equivocado -> 409 (kernel)
 const enc2=crypto.randomUUID();
 await open.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID()}),body:JSON.stringify({encounterId:enc2,patientId:await freshPatient(TENANT_A),occurredAt:ISO})}));
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"5"}),body:JSON.stringify({assessment:"a",plan:"b",occurredAt:ISO})}),P(enc2));
 ok(r.status===409,"OPTIMISTIC_CONFLICT_409");

 // 10) Cross-tenant: médico de tenant B no ve el encuentro de A -> 404
 const physB=tok(TENANT_B,["PHYSICIAN"]);await registerPhysicianCredentials(physB);
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:h(physB,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({assessment:"a",plan:"b",occurredAt:ISO})}),P(enc));
 ok(r.status===404,"CROSS_TENANT_404");

 // 11) Physician Control: enfermera no puede escribir -> 403
 const nurse=tok(TENANT_A,["NURSE"]);
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:h(nurse,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({assessment:"a",plan:"b",occurredAt:ISO})}),P(enc));
 ok(r.status===403,"ROLE_FORBIDDEN_403");

 // 12) Auditoría L-01 — Zero Lost Follow-Up con obligaciones REALES (eventos). Antes esta prueba insertaba a mano una fila
 //     en `clinical_inbox`, tabla en la que la aplicación jamás escribe: el gate era un placebo que devolvía siempre 0.
 const enc3=crypto.randomUUID(),pat3=crypto.randomUUID();await ensurePatientIn(TENANT_A,pat3); /* L-07 */
 await open.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID()}),body:JSON.stringify({encounterId:enc3,patientId:pat3,occurredAt:ISO})}));
 await assess.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({assessment:"a",plan:"b",occurredAt:ISO})}),P(enc3));
 const signEnc3=()=>sign.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO,contentHash:hashOf("a","b")})}),P(enc3));
 const inDays=(d:number)=>new Date(Date.now()+d*86_400_000).toISOString();
 const mkObl=async(extra:Record<string,unknown>)=>{const id=crypto.randomUUID();const rr=await oblig.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID()}),body:JSON.stringify({obligationId:id,patientId:pat3,ownerId:crypto.randomUUID(),kind:"Control de seguimiento",occurredAt:ISO,...extra})}));if(rr.status!==201)throw new Error("obligation "+rr.status);return id;};
 // 12a) una fila huérfana en clinical_inbox YA NO decide nada (la fuente de verdad es el stream de eventos)
 await sql`insert into clinical_inbox(id,tenant_id,patient_id,kind,priority,owner_id) values(${crypto.randomUUID()},${TENANT_A},${crypto.randomUUID()},'CRITICAL_RESULT','URGENT',${crypto.randomUUID()})`;
 // 12b) seguimiento de RUTINA con fecha FUTURA -> NO bloquea (tiene responsable y fecha: está en curso)... se comprueba al final
 const routine=await mkObl({dueAt:inDays(30)});
 // 12c) seguimiento URGENTE sin resolver -> BLOQUEA, y el mensaje dice qué hay que resolver
 const urgent=await mkObl({dueAt:inDays(30),priority:"URGENT"});
 r=await signEnc3();let bj=await r.json();
 ok(r.status===403&&bj.error.code==="SAFETY_BLOCKED"&&/1 seguimiento\(s\) URGENTE/.test(bj.error.message),"URGENT_OBLIGATION_BLOCKS_SIGN_403");
 // 12d) completarlo CON EVIDENCIA lo resuelve...
 r=await oblDone.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({evidence:"Paciente contactado; potasio de control 4.4",occurredAt:ISO})}),OP(urgent));
 ok(r.status===201,"URGENT_OBLIGATION_COMPLETED_WITH_EVIDENCE");
 // 12e) ...pero un seguimiento VENCIDO (aunque sea de rutina) también bloquea: es, literalmente, un seguimiento perdido
 const overdue=await mkObl({dueAt:inDays(-3)});
 r=await signEnc3();bj=await r.json();
 ok(r.status===403&&/1 seguimiento\(s\) VENCIDO/.test(bj.error.message)&&!/URGENTE/.test(bj.error.message),"OVERDUE_OBLIGATION_BLOCKS_SIGN_403");
 // 12f) cancelarlo CON MOTIVO es una salida explícita (nada desaparece sin estado terminal)
 r=await oblCancel.POST(new Request("http://l/",{method:"POST",headers:h(physA,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({reason:"El paciente cambió de médico tratante",occurredAt:ISO})}),OP(overdue));
 ok(r.status===201,"OVERDUE_OBLIGATION_CANCELLED_WITH_REASON");
 // 12g) solo queda el de rutina con fecha futura -> la firma PROCEDE
 r=await signEnc3();bj=await r.json();ok(r.status===201&&bj.status==="SIGNED","ROUTINE_FUTURE_OBLIGATION_DOES_NOT_BLOCK_201");
 void routine;
}catch(e){result.status="FAIL";result.error=String(e);}finally{await sql.end();}
console.log(JSON.stringify(result,null,2));
process.exit(result.status==="PASS"?0:1);
