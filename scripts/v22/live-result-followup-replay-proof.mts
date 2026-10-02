// Porte a main del grupo plan:D5-results — secciones (C) y (D) de live-review-hardening-proof de la rama (las A, B, E y F cubren
// otros grupos: D4, readEncounter, SQL-2, SQL-3) más las extensiones propias de main (anulación R03-10). vs Neon.
// (C) El reintento de un resultado crítico ya CERRADO, CORREGIDO o ANULADO no reabre su obligación urgente (la regla es
//     resultAwaitsFollowUp de result-fold, la misma del gate de firma); (D) el replay de una corrección con otro valor es
//     IDEMPOTENCY_CONFLICT y responde `corrected` igual que el primero; (E) el replay del cierre, de la corrección y de la
//     anulación reconcilia la obligación urgente que un fallo tras el commit principal dejó abierta.
// Adaptación a main: `unit` en la recepción y la corrección del potasio (R02a-RES-01 la exige), lectura con readAggregateEvents.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=process.env.SESSION_SIGNING_SECRET!; // R11-07: el secreto lo genera el prólogo (_live-env)
const{default:postgres}=await import("postgres");
const{directEndpoint}=await import("../../packages/pg-endpoint/src"); // R01-004: única fuente del endpoint directo
const{signSession}=await import("../../packages/session/src");
const{subjectToActorId}=await import("../../packages/http-principal/src");
const{foldObligation}=await import("../../packages/obligation-fold/src");
const{readAggregateEvents}=await import("../../apps/web/lib/clinical-runtime");
const{criticalObligationId}=await import("../../apps/web/lib/result-lifecycle");
const resR=await import("../../apps/web/app/api/v1/results/route");
const rVerify=await import("../../apps/web/app/api/v1/results/[resultId]/verification/route");
const rAction=await import("../../apps/web/app/api/v1/results/[resultId]/action/route");
const rClose=await import("../../apps/web/app/api/v1/results/[resultId]/closure/route");
const rCorr=await import("../../apps/web/app/api/v1/results/[resultId]/correction/route");
const rVoid=await import("../../apps/web/app/api/v1/results/[resultId]/error-mark/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);const SUB=crypto.randomUUID();
const phys=signSession({sub:SUB,tenantId:TA,roles:["PHYSICIAN"],scopes:["encounter:write","encounter:read","result:write","result:read","obligation:write","patient:read","record:export"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+phys,...x};}
let ts=Date.now()-3_600_000;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const ctx={tenantId:TA,actorId:subjectToActorId(SUB),actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:crypto.randomUUID()};
const sql=postgres(directEndpoint(process.env.DATABASE_URL??""),{max:3,prepare:false,onnotice:()=>{}});
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const RP=(id:string)=>({params:Promise.resolve({resultId:id})});
const codeOf=async(r:Response)=>((await r.clone().json()) as{error?:{code?:string}}).error?.code;
const obligationState=async(id:string)=>{const f=foldObligation(await readAggregateEvents(ctx,id));return f.exists?f.state:"ABSENT";};
// Bloquea UNA vez la CREACIÓN de un agregado derivado ocupando su versión (el kernel la rechaza por concurrencia).
const block=(id:string)=>sql`insert into aggregate_versions(tenant_id,aggregate_id,version) values(${TA},${id},1)`;
const unblock=(id:string)=>sql`delete from aggregate_versions where tenant_id=${TA} and aggregate_id=${id}`;
// Bloquea UNA vez la COMPLETACIÓN de una obligación ya creada (v1): su versión deja de ser la esperada; se restaura después.
const blockNext=(id:string)=>sql`update aggregate_versions set version=99 where tenant_id=${TA} and aggregate_id=${id}`;
const unblockNext=(id:string)=>sql`update aggregate_versions set version=1 where tenant_id=${TA} and aggregate_id=${id}`;
// `retry` reenvía EXACTAMENTE la misma petición (misma llave y mismo cuerpo), como un laboratorio que reintenta.
async function receive(pat:string,analyte:string,value:string,resultId=crypto.randomUUID(),unit?:string){
 const key=idem();const body=JSON.stringify({resultId,patientId:pat,orderId:crypto.randomUUID(),analyte,value,...(unit?{unit}:{}),occurredAt:at()});
 const send=()=>resR.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":key}),body}));
 return{r:await send(),resultId,retry:send};
}
const step=(route:{POST:(q:Request,p:{params:Promise<{resultId:string}>})=>Promise<Response>},id:string,ifMatch:number,body:Record<string,unknown>)=>
 route.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem(),"if-match":String(ifMatch)}),body:JSON.stringify({...body,occurredAt:at()})}),RP(id));
// Igual que `step`, pero devuelve también el reenvío idéntico (misma llave, mismo cuerpo, mismo If-Match).
function stepWithRetry(route:{POST:(q:Request,p:{params:Promise<{resultId:string}>})=>Promise<Response>},id:string,ifMatch:number,body:Record<string,unknown>){
 const key=idem();const payload=JSON.stringify({...body,occurredAt:at()});
 return()=>route.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":key,"if-match":String(ifMatch)}),body:payload}),RP(id));
}
async function verifyAndAction(id:string){
 const v=await step(rVerify,id,1,{});const a=await step(rAction,id,2,{ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+86_400_000).toISOString()});
 return[v.status,a.status];
}
async function closeLoop(id:string){
 const[v,a]=await verifyAndAction(id);
 const c=await step(rClose,id,3,{evidence:"Paciente contactado; potasio de control 4.4"});return[v,a,c.status];
}
try{
 const pat=crypto.randomUUID();await ensurePatientIn(TA,pat); // también crea la cabeza de la cadena de auditoría del tenant
 // (C) Crítico cuya obligación falla tras el commit; el médico lo cierra (o se corrige, o se anula) ANTES del reintento del laboratorio.
 const c1id=crypto.randomUUID();await block(criticalObligationId(c1id));const c1=await receive(pat,"POTASSIUM","7.0",c1id,"mmol/L");
 ok(c1.r.status!==201&&await obligationState(criticalObligationId(c1.resultId))==="ABSENT","CRITICAL_OBLIGATION_FAILED_AFTER_COMMIT");
 await unblock(criticalObligationId(c1.resultId));
 ok((await closeLoop(c1.resultId)).every(s=>s===201),"CRITICAL_RESULT_CLOSED_BEFORE_RETRY");
 const c1b=await c1.retry();
 ok(c1b.status===200&&await obligationState(criticalObligationId(c1.resultId))==="ABSENT","RETRY_AFTER_CLOSURE_DOES_NOT_REOPEN_OBLIGATION");
 const c2id=crypto.randomUUID();await block(criticalObligationId(c2id));const c2=await receive(pat,"POTASSIUM","7.1",c2id,"mmol/L");
 ok(c2.r.status!==201&&await obligationState(criticalObligationId(c2id))==="ABSENT","SECOND_CRITICAL_OBLIGATION_FAILED_AFTER_COMMIT");
 await unblock(criticalObligationId(c2id));
 const fix=await step(rCorr,c2.resultId,1,{correctedResultId:crypto.randomUUID(),value:"4.1",unit:"mmol/L",reason:"Muestra hemolizada: valor corregido"});
 const c2b=await c2.retry();
 ok(fix.status===201&&c2b.status===200&&await obligationState(criticalObligationId(c2.resultId))==="ABSENT","RETRY_AFTER_CORRECTION_DOES_NOT_REOPEN_OBLIGATION");
 // Propio de main (R03-10): un crítico ANULADO antes del reintento tampoco reabre su obligación (el predicado incluye enteredInError).
 const c3id=crypto.randomUUID();await block(criticalObligationId(c3id));const c3=await receive(pat,"POTASSIUM","7.2",c3id,"mmol/L");
 ok(c3.r.status!==201&&await obligationState(criticalObligationId(c3id))==="ABSENT","THIRD_CRITICAL_OBLIGATION_FAILED_AFTER_COMMIT");
 await unblock(criticalObligationId(c3id));
 const voided=await step(rVoid,c3.resultId,1,{reason:"Muestra de otro paciente: resultado capturado por error"});
 const c3b=await c3.retry();
 ok(voided.status===201&&c3b.status===200&&await obligationState(criticalObligationId(c3.resultId))==="ABSENT","RETRY_AFTER_VOID_DOES_NOT_REOPEN_OBLIGATION");
 // (D) Replay de una corrección: misma llave y mismo cuerpo -> 200 con `corrected`; misma llave y OTRO valor -> 409.
 const g=await receive(pat,"GLUCOSE","5.5",crypto.randomUUID(),"mmol/L");
 const K=idem();const cBody=JSON.stringify({correctedResultId:crypto.randomUUID(),value:"6.0",unit:"mmol/L",reason:"Corrección del laboratorio",occurredAt:at()});
 const corr=(body:string)=>rCorr.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":K,"if-match":"1"}),body}),RP(g.resultId));
 const k1=await corr(cBody);const b1=await k1.json() as{corrected?:Record<string,unknown>};
 const k2=await corr(cBody);const b2=await k2.json() as{corrected?:Record<string,unknown>;replayed?:boolean};
 ok(k1.status===201&&k2.status===200&&b2.replayed===true&&JSON.stringify(b2.corrected)===JSON.stringify(b1.corrected)&&b1.corrected!==undefined,"CORRECTION_REPLAY_RETURNS_CORRECTED");
 const other=JSON.parse(cBody) as Record<string,unknown>;other["value"]="9.9";
 const k3=await corr(JSON.stringify(other));
 ok(k3.status===409&&await codeOf(k3)==="IDEMPOTENCY_CONFLICT","CORRECTION_SAME_KEY_OTHER_VALUE_409");
 // (E) La obligación urgente existe (OPEN) y su COMPLETACIÓN falla tras el commit del cierre / corrección / anulación: el
 // reintento idéntico (replay 200) la completa. Antes el replay respondía éxito y la obligación quedaba abierta para siempre.
 const e1=await receive(pat,"POTASSIUM","7.3",crypto.randomUUID(),"mmol/L");const o1=criticalObligationId(e1.resultId);
 ok(e1.r.status===201&&await obligationState(o1)==="OPEN"&&(await verifyAndAction(e1.resultId)).every(s=>s===201),"CRITICAL_OBLIGATION_OPEN_BEFORE_CLOSURE");
 const close1=stepWithRetry(rClose,e1.resultId,3,{evidence:"Paciente contactado; potasio de control 4.2"});
 await blockNext(o1);const cl1=await close1();await unblockNext(o1);
 ok(cl1.status!==201&&await obligationState(o1)==="OPEN","CLOSURE_OBLIGATION_COMPLETION_FAILED_AFTER_COMMIT");
 const cl1b=await close1();const bcl=await cl1b.json() as{replayed?:boolean};
 ok(cl1b.status===200&&bcl.replayed===true&&await obligationState(o1)==="COMPLETED","CLOSURE_REPLAY_RECONCILES_CRITICAL_OBLIGATION");
 const e2=await receive(pat,"POTASSIUM","7.4",crypto.randomUUID(),"mmol/L");const o2=criticalObligationId(e2.resultId);
 const corr2=stepWithRetry(rCorr,e2.resultId,1,{correctedResultId:crypto.randomUUID(),value:"4.3",unit:"mmol/L",reason:"Muestra hemolizada: valor corregido"});
 await blockNext(o2);const co2=await corr2();await unblockNext(o2);
 ok(e2.r.status===201&&co2.status!==201&&await obligationState(o2)==="OPEN","CORRECTION_OBLIGATION_COMPLETION_FAILED_AFTER_COMMIT");
 const co2b=await corr2();const bco=await co2b.json() as{replayed?:boolean;corrected?:{resultId?:string}};
 ok(co2b.status===200&&bco.replayed===true&&bco.corrected?.resultId!==undefined&&await obligationState(o2)==="COMPLETED","CORRECTION_REPLAY_RECONCILES_CRITICAL_OBLIGATION");
 const e3=await receive(pat,"POTASSIUM","7.5",crypto.randomUUID(),"mmol/L");const o3=criticalObligationId(e3.resultId);
 const void3=stepWithRetry(rVoid,e3.resultId,1,{reason:"Muestra de otro paciente: resultado capturado por error"});
 await blockNext(o3);const v3=await void3();await unblockNext(o3);
 ok(e3.r.status===201&&v3.status!==201&&await obligationState(o3)==="OPEN","ERROR_MARK_OBLIGATION_COMPLETION_FAILED_AFTER_COMMIT");
 const v3b=await void3();const bv=await v3b.json() as{replayed?:boolean};
 ok(v3b.status===200&&bv.replayed===true&&await obligationState(o3)==="COMPLETED","ERROR_MARK_REPLAY_RECONCILES_CRITICAL_OBLIGATION");
}catch(e){result.status="FAIL";result.error=String(e);}
await sql.end();
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
