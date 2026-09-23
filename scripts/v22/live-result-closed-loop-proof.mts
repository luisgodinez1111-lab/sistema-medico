// EPIC G — Evidencia física del closed-loop de resultados + Zero Lost Follow-Up end-to-end.
// Ejecuta: pnpm exec tsx ./scripts/v22/live-result-closed-loop-proof.mts
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-g-secret";
const SECRET=process.env.SESSION_SIGNING_SECRET;

const{signSession}=await import("../../packages/session/src");
const{resolveVerified}=await import("../../apps/web/lib/http-command");
const{readAggregateEvents}=await import("../../apps/web/lib/clinical-runtime");
const{criticalObligationId}=await import("../../apps/web/lib/result-lifecycle");
const{foldObligation}=await import("../../packages/obligation-fold/src");
const open=await import("../../apps/web/app/api/v1/encounters/route");
const assess=await import("../../apps/web/app/api/v1/encounters/[encounterId]/assessment/route");
const sign=await import("../../apps/web/app/api/v1/encounters/[encounterId]/signature/route");
const results=await import("../../apps/web/app/api/v1/results/route");
const rVerify=await import("../../apps/web/app/api/v1/results/[resultId]/verification/route");
const rAction=await import("../../apps/web/app/api/v1/results/[resultId]/action/route");
const rClose=await import("../../apps/web/app/api/v1/results/[resultId]/closure/route");

const TENANT_A=crypto.randomUUID(),TENANT_B=crypto.randomUUID();
const now=Math.floor(Date.now()/1000);
function tok(tenantId:string,roles:string[]){return signSession({sub:crypto.randomUUID(),tenantId,roles,scopes:["encounter:write","encounter:read","result:write"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string|null,extra:Record<string,string>={}){const x:Record<string,string>={"content-type":"application/json",...extra};if(t)x["authorization"]="Bearer "+t;return x;}
const RP=(id:string)=>({params:Promise.resolve({resultId:id})});
const EP=(id:string)=>({params:Promise.resolve({encounterId:id})});
const ISO="2026-03-03T09:00:00.000Z";
// Auditoría L-03: huella del contenido que se firma (sha256 de `${assessment}\n${plan}`); aquí la nota es "a" / "p".
const HASH_AP=crypto.createHash("sha256").update("a\np").digest("hex");
const idem=()=>crypto.randomUUID();

const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const physA=tok(TENANT_A,["PHYSICIAN"]);await registerPhysicianCredentials(physA);

 // === A) Ciclo de vida del resultado (camino feliz) ===
 const res=crypto.randomUUID(),pat=crypto.randomUUID(),ord=crypto.randomUUID();await ensurePatientIn(TENANT_A,pat); /* L-07 */
 let r=await results.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem()}),body:JSON.stringify({resultId:res,patientId:pat,orderId:ord,analyte:"POTASSIUM",value:"7.0",occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).version===1,"RESULT_RECEIVED_201_v1");
 r=await rVerify.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),RP(res));
 ok(r.status===201&&(await r.json()).state==="VERIFIED","RESULT_VERIFIED_201_v2");
 const idemAction=idem();
 const actionBody=JSON.stringify({ownerId:crypto.randomUUID(),dueAt:"2026-03-10T00:00:00.000Z",occurredAt:ISO});
 const actionReq=()=>new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idemAction,"if-match":"2"}),body:actionBody});
 r=await rAction.POST(actionReq(),RP(res));
 ok(r.status===201&&(await r.json()).state==="ACTIONED","RESULT_ACTIONED_201_v3");
 r=await rAction.POST(actionReq(),RP(res));
 ok(r.status===200&&(await r.json()).replayed===true,"RESULT_ACTION_REPLAY_200");
 // SM ilegal: saltar verificación no es válido (otra semilla)
 const res2=crypto.randomUUID();
 await results.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem()}),body:JSON.stringify({resultId:res2,patientId:await freshPatient(TENANT_A),orderId:crypto.randomUUID(),analyte:"GLUCOSE",value:"100",occurredAt:ISO})}));
 r=await rClose.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({evidence:"x",occurredAt:ISO})}),RP(res2));
 ok(r.status===409,"RESULT_ILLEGAL_SKIP_409");

 // === B) EL LOOP: un resultado crítico abierto BLOQUEA la firma; cerrarlo la DESBLOQUEA ===
 const enc=crypto.randomUUID(),loopPat=crypto.randomUUID();await ensurePatientIn(TENANT_A,loopPat); /* L-07 */
 // 1) abrir + evaluar el encuentro del paciente
 await open.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:enc,patientId:loopPat,occurredAt:ISO})}));
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({assessment:"a",plan:"p",occurredAt:ISO})}),EP(enc));
 ok(r.status===201&&(await r.json()).status==="READY_TO_SIGN","LOOP_ENCOUNTER_READY");
 // 2) resultado CRÍTICO del mismo paciente -> verify -> action (obligación abierta)
 const cres=crypto.randomUUID();
 await results.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem()}),body:JSON.stringify({resultId:cres,patientId:loopPat,orderId:crypto.randomUUID(),analyte:"POTASSIUM",value:"7.0",occurredAt:ISO})}));
 await rVerify.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),RP(cres));
 await rAction.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({ownerId:crypto.randomUUID(),dueAt:"2026-03-10T00:00:00.000Z",occurredAt:ISO})}),RP(cres));
 // 3) firmar el encuentro -> BLOQUEADO 403 (Zero Lost Follow-Up)
 r=await sign.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO,contentHash:HASH_AP})}),EP(enc));
 ok(r.status===403,"SIGN_BLOCKED_BY_OPEN_CRITICAL_RESULT_403");
 // Auditoría C-20: el resultado crítico creó una obligación URGENTE con responsable (quien lo recibió) y fecha (24 h)
 const octx=resolveVerified(new Request("http://l/",{headers:H(physA)})).ctx;
 let ob=foldObligation(await readAggregateEvents(octx,criticalObligationId(cres)));
 const obEv=(await readAggregateEvents(octx,criticalObligationId(cres)))[0]?.payload as{ownerId?:string;priority?:string;dueAt?:string;obligationKind?:string;sourceResultId?:string}|undefined;
 ok(ob.exists&&ob.state==="OPEN"&&obEv?.priority==="URGENT"&&obEv.obligationKind==="CRITICAL_RESULT_REVIEW"&&obEv.sourceResultId===cres&&obEv.ownerId===octx.actorId&&obEv.dueAt===new Date(Date.parse(ISO)+24*3600000).toISOString(),"CRITICAL_RESULT_CREATES_URGENT_OBLIGATION");
 // 4) cerrar el resultado con evidencia (resuelve la obligación)
 r=await rClose.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({evidence:"paciente contactado y tratado",occurredAt:ISO})}),RP(cres));
 ok(r.status===201&&(await r.json()).state==="CLOSED","RESULT_CLOSED_201_v4");
 ob=foldObligation(await readAggregateEvents(octx,criticalObligationId(cres)));ok(ob.state==="COMPLETED","CLOSURE_COMPLETES_DERIVED_OBLIGATION");
 // 5) firmar de nuevo -> AHORA SÍ 201 SIGNED (loop resuelto)
 r=await sign.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO,contentHash:HASH_AP})}),EP(enc));
 const s=await r.json();
 ok(r.status===201&&s.status==="SIGNED"&&s.version===3,"SIGN_UNBLOCKED_AFTER_CLOSURE_201");

 // === C) Control: un resultado NO crítico abierto NO bloquea la firma ===
 const enc2=crypto.randomUUID(),pat2=crypto.randomUUID();await ensurePatientIn(TENANT_A,pat2); /* L-07 */
 await open.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:enc2,patientId:pat2,occurredAt:ISO})}));
 await assess.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({assessment:"a",plan:"p",occurredAt:ISO})}),EP(enc2));
 const nres=crypto.randomUUID();
 await results.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem()}),body:JSON.stringify({resultId:nres,patientId:pat2,orderId:crypto.randomUUID(),analyte:"GLUCOSE",value:"100",occurredAt:ISO})}));
 await rVerify.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),RP(nres));
 await rAction.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({ownerId:crypto.randomUUID(),dueAt:"2026-03-10T00:00:00.000Z",occurredAt:ISO})}),RP(nres));
 r=await sign.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO,contentHash:HASH_AP})}),EP(enc2));
 ok(r.status===201,"NON_CRITICAL_RESULT_DOES_NOT_BLOCK_201");

 // === C2) Auditoría L-01/C-20 — el caso MÁS peligroso: un crítico recién RECIBIDO que NADIE ha visto también bloquea la firma.
 //         Antes solo contaban los que ya estaban en ACTIONED, aunque la UI promete "bloquea la firma hasta cerrarse".
 const enc4=crypto.randomUUID(),pat4=crypto.randomUUID(),unseen=crypto.randomUUID();await ensurePatientIn(TENANT_A,pat4); /* L-07 */
 await open.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:enc4,patientId:pat4,occurredAt:ISO})}));
 await assess.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({assessment:"a",plan:"p",occurredAt:ISO})}),EP(enc4));
 await results.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem()}),body:JSON.stringify({resultId:unseen,patientId:pat4,orderId:crypto.randomUUID(),analyte:"POTASSIUM",value:"7.0",unit:"mEq/L",occurredAt:ISO})}));
 const sign4=()=>sign.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO,contentHash:HASH_AP})}),EP(enc4));
 r=await sign4();let b4=await r.json();ok(r.status===403&&/1 resultado\(s\) crítico\(s\) sin cerrar/.test(b4.error.message),"UNSEEN_CRITICAL_RESULT_BLOCKS_SIGN_403");
 await rVerify.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),RP(unseen));
 r=await sign4();ok(r.status===403,"VERIFIED_CRITICAL_RESULT_STILL_BLOCKS_403");
 await rAction.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({ownerId:crypto.randomUUID(),dueAt:"2026-03-10T00:00:00.000Z",occurredAt:ISO})}),RP(unseen));
 await rClose.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({evidence:"Hiperkalemia tratada; control 4.8",occurredAt:ISO})}),RP(unseen));
 r=await sign4();b4=await r.json();ok(r.status===201&&b4.status==="SIGNED","SIGN_AFTER_CRITICAL_CLOSED_201");

 // === D) Aislamiento cross-tenant sobre el resultado ===
 const physB=tok(TENANT_B,["PHYSICIAN"]);await registerPhysicianCredentials(physB);
 r=await rVerify.POST(new Request("http://l/",{method:"POST",headers:H(physB,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),RP(res));
 ok(r.status===404,"CROSS_TENANT_RESULT_404");

 // === E) Physician Control: enfermera no escribe resultados ===
 const nurse=tok(TENANT_A,["NURSE"]);
 r=await results.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:await freshPatient(TENANT_A),orderId:crypto.randomUUID(),analyte:"GLUCOSE",value:"100",occurredAt:ISO})}));
 ok(r.status===403,"ROLE_FORBIDDEN_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));
process.exit(result.status==="PASS"?0:1);
