// Revisión adversarial del lote 11 — Evidencia física de las correcciones que la revisión confirmó sobre D4, D5, D8 y D10:
// (A) el kernel rechaza escribir en un stream de otro tipo AUNQUE su génesis se confirme en paralelo (la guarda corre después de
// reclamar la versión); (B) GET /encounters solo sirve encuentros y un id que no es uuid es 404, no 500; (C) el reintento de un
// resultado crítico ya CERRADO o CORREGIDO no reabre su obligación urgente; (D) el replay de una corrección con otro valor es
// IDEMPOTENCY_CONFLICT y responde `corrected` igual que el primero; (E) el registro de resultados toma el ciclo de vida del fold
// (CORRECTED es anotación) y no cuenta lo reemplazado como pendiente; (F) el indicador glucémico declara lo que excluye. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"review-hardening-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{default:postgres}=await import("postgres");
const{signSession}=await import("../../packages/session/src");
const{subjectToActorId}=await import("../../packages/http-principal/src");
const{foldObligation}=await import("../../packages/obligation-fold/src");
const{buildCommand}=await import("../../apps/web/lib/http-command");
const{runClinicalCommand}=await import("../../apps/web/lib/runtime/command");
const{readAggregateStream}=await import("../../apps/web/lib/runtime/event-store");
const{criticalObligationId}=await import("../../apps/web/lib/result-lifecycle");
const enc=await import("../../apps/web/app/api/v1/encounters/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const rVerify=await import("../../apps/web/app/api/v1/results/[resultId]/verification/route");
const rAction=await import("../../apps/web/app/api/v1/results/[resultId]/action/route");
const rClose=await import("../../apps/web/app/api/v1/results/[resultId]/closure/route");
const rCorr=await import("../../apps/web/app/api/v1/results/[resultId]/correction/route");
const repR=await import("../../apps/web/app/api/v1/reports/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);const SUB=crypto.randomUUID();
const phys=signSession({sub:SUB,tenantId:TA,roles:["PHYSICIAN"],scopes:["encounter:write","encounter:read","result:write","result:read","obligation:write","patient:read","record:export"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+phys,...x};}
let ts=Date.now()-3_600_000;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const ctx={tenantId:TA,actorId:subjectToActorId(SUB),actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:crypto.randomUUID()};
const raw=process.env.DATABASE_URL!.replace("-pooler","").replace(/([?&])channel_binding=require/,"$1").replace(/[?&]$/,"");
const sql=postgres(raw,{max:3,prepare:false,onnotice:()=>{}});
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const RP=(id:string)=>({params:Promise.resolve({resultId:id})});
const codeOf=async(r:Response)=>((await r.clone().json()) as{error?:{code?:string}}).error?.code;
const obligationState=async(id:string)=>{const f=foldObligation(await readAggregateStream(ctx,"ClinicalObligation",id));return f.exists?f.state:"ABSENT";};
const block=(id:string)=>sql`insert into aggregate_versions(tenant_id,aggregate_id,version) values(${TA},${id},1)`;
const unblock=(id:string)=>sql`delete from aggregate_versions where tenant_id=${TA} and aggregate_id=${id}`;
const streamOf=async(id:string)=>(await sql`select aggregate_type||'#'||sequence as s from clinical_events where tenant_id=${TA} and aggregate_id=${id} order by sequence`).map(r=>String(r.s)).join(",");
// Espera a que haya al menos `n` sesiones esperando un bloqueo (las dos transacciones de la carrera están dentro del kernel).
async function waitForLockWaiters(n:number){for(let i=0;i<100;i++){const w=await sql`select count(*)::int as c from pg_locks where not granted`;if(Number(w[0]!.c)>=n)return true;await new Promise(r=>setTimeout(r,50));}return false;}
// `retry` reenvía EXACTAMENTE la misma petición (misma llave y mismo cuerpo), como un laboratorio que reintenta.
async function receive(pat:string,analyte:string,value:string,resultId=crypto.randomUUID(),unit?:string){
 const key=idem();const body=JSON.stringify({resultId,patientId:pat,orderId:crypto.randomUUID(),analyte,value,...(unit?{unit}:{}),occurredAt:at()});
 const send=()=>resR.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":key}),body}));
 return{r:await send(),resultId,retry:send};
}
const step=(route:{POST:(q:Request,p:{params:Promise<{resultId:string}>})=>Promise<Response>},id:string,ifMatch:number,body:Record<string,unknown>)=>
 route.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem(),"if-match":String(ifMatch)}),body:JSON.stringify({...body,occurredAt:at()})}),RP(id));
async function closeLoop(id:string){
 const v=await step(rVerify,id,1,{});const a=await step(rAction,id,2,{ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+86_400_000).toISOString()});
 const c=await step(rClose,id,3,{evidence:"Paciente contactado; potasio de control 4.4"});return[v.status,a.status,c.status];
}
try{
 const pat=crypto.randomUUID();await ensurePatientIn(TA,pat); // también crea la cabeza de la cadena de auditoría del tenant
 // (A) Carrera en el kernel: T1 crea un Patient y queda detenido dentro del kernel (cadena de auditoría bloqueada); T2 escribe un
 // Allergy v1 sobre el MISMO id. Antes T2 no veía la génesis sin confirmar y añadía un evento ajeno en la secuencia 2.
 const I=crypto.randomUUID();
 let release!:()=>void;const released=new Promise<void>(r=>{release=r;});let locked!:()=>void;const lockHeld=new Promise<void>(r=>{locked=r;});
 const holder=sql.begin(async tx=>{await tx`select set_config('app.tenant_id',${TA},true)`;await tx`select 1 from audit_chain_heads where tenant_id=${TA} for update`;locked();await released;});
 await lockHeld;
 const t1=runClinicalCommand(ctx,buildCommand({idempotencyKey:idem(),aggregateType:"Patient",aggregateId:I,expectedVersion:0,eventType:"PATIENT_REGISTERED",payload:{kind:"REGISTERED",name:"Carrera",birthDate:"1990-01-01",sexAtBirth:"FEMALE"},occurredAt:at(),topic:"patient.registered"})).then(r=>({ok:true as const,r}),e=>({ok:false as const,e:String(e)}));
 await waitForLockWaiters(1);
 const t2=runClinicalCommand(ctx,buildCommand({idempotencyKey:idem(),aggregateType:"Allergy",aggregateId:I,expectedVersion:1,eventType:"ALLERGY_REFUTED",payload:{kind:"REFUTED"},occurredAt:at(),topic:"allergy.refuted"})).then(r=>({ok:true as const,r}),e=>({ok:false as const,e:String(e)}));
 const bothWaiting=await waitForLockWaiters(2);
 release();await holder;
 const[x,y]=await Promise.all([t1,t2]);
 ok(bothWaiting,"RACE_BOTH_COMMANDS_INSIDE_THE_KERNEL");
 ok(x.ok&&!y.ok&&y.e.includes("AGGREGATE_TYPE_MISMATCH")&&await streamOf(I)==="Patient#1","KERNEL_REJECTS_FOREIGN_WRITE_RACING_GENESIS");
 // (B) GET /encounters: el id de un paciente no es un encuentro (404) y un id que no es uuid no llega a la base (404, no 500).
 const getEnc=(id:string)=>enc.GET(new Request(`http://l/?encounterId=${encodeURIComponent(id)}`,{headers:H()}));
 const encId=crypto.randomUUID();
 const o=await enc.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem()}),body:JSON.stringify({encounterId:encId,patientId:pat,occurredAt:at()})}));
 ok(o.status===201&&(await getEnc(encId)).status===200,"ENCOUNTER_READABLE");
 const asPatient=await getEnc(pat);ok(asPatient.status===404&&await codeOf(asPatient)==="NOT_FOUND","ENCOUNTER_GET_ON_PATIENT_ID_404");
 const bad=await getEnc("no-es-un-uuid");ok(bad.status===404&&await codeOf(bad)==="NOT_FOUND","ENCOUNTER_GET_MALFORMED_ID_404_NOT_500");
 // (C) Crítico cuya obligación falla tras el commit; el médico lo cierra (o se corrige) ANTES del reintento del laboratorio.
 const c1id=crypto.randomUUID();await block(criticalObligationId(c1id));const c1=await receive(pat,"POTASSIUM","7.0",c1id);
 ok(c1.r.status!==201&&await obligationState(criticalObligationId(c1.resultId))==="ABSENT","CRITICAL_OBLIGATION_FAILED_AFTER_COMMIT");
 await unblock(criticalObligationId(c1.resultId));
 ok((await closeLoop(c1.resultId)).every(s=>s===201),"CRITICAL_RESULT_CLOSED_BEFORE_RETRY");
 const c1b=await c1.retry();
 ok(c1b.status===200&&await obligationState(criticalObligationId(c1.resultId))==="ABSENT","RETRY_AFTER_CLOSURE_DOES_NOT_REOPEN_OBLIGATION");
 const c2id=crypto.randomUUID();await block(criticalObligationId(c2id));const c2=await receive(pat,"POTASSIUM","7.1",c2id);
 ok(c2.r.status!==201&&await obligationState(criticalObligationId(c2id))==="ABSENT","SECOND_CRITICAL_OBLIGATION_FAILED_AFTER_COMMIT");
 await unblock(criticalObligationId(c2id));
 const fix=await step(rCorr,c2.resultId,1,{correctedResultId:crypto.randomUUID(),value:"4.1",reason:"Muestra hemolizada: valor corregido"});
 const c2b=await c2.retry();
 ok(fix.status===201&&c2b.status===200&&await obligationState(criticalObligationId(c2.resultId))==="ABSENT","RETRY_AFTER_CORRECTION_DOES_NOT_REOPEN_OBLIGATION");
 // (D) Replay de una corrección: misma llave y mismo cuerpo -> 200 con `corrected`; mismo llave y OTRO valor -> 409.
 const g=await receive(pat,"GLUCOSE","5.5",crypto.randomUUID(),"mmol/L");
 const K=idem();const cBody=JSON.stringify({correctedResultId:crypto.randomUUID(),value:"6.0",unit:"mmol/L",reason:"Corrección del laboratorio",occurredAt:at()});
 const corr=(body:string)=>rCorr.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":K,"if-match":"1"}),body}),RP(g.resultId));
 const k1=await corr(cBody);const b1=await k1.json() as{corrected?:Record<string,unknown>};
 const k2=await corr(cBody);const b2=await k2.json() as{corrected?:Record<string,unknown>;replayed?:boolean};
 ok(k1.status===201&&k2.status===200&&b2.replayed===true&&JSON.stringify(b2.corrected)===JSON.stringify(b1.corrected)&&b1.corrected!==undefined,"CORRECTION_REPLAY_RETURNS_CORRECTED");
 const other=JSON.parse(cBody) as Record<string,unknown>;other["value"]="9.9";
 const k3=await corr(JSON.stringify(other));
 ok(k3.status===409&&await codeOf(k3)==="IDEMPOTENCY_CONFLICT","CORRECTION_SAME_KEY_OTHER_VALUE_409");
 // (E) Registro: un resultado CERRADO y luego corregido conserva su ciclo de vida (CLOSED) y no cuenta como pendiente.
 const tb=crypto.randomUUID();await ensurePatientIn(TA,tb);
 const n=await receive(tb,"GLUCOSE","5.5",crypto.randomUUID(),"mmol/L");
 await step(rVerify,n.resultId,1,{});await step(rAction,n.resultId,2,{ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+86_400_000).toISOString()});await step(rClose,n.resultId,3,{evidence:"Revisado con la paciente en consulta"});
 const nc=crypto.randomUUID();const nfix=await step(rCorr,n.resultId,4,{correctedResultId:nc,value:"5.6",unit:"mmol/L",reason:"Corrección del laboratorio"});
 const reg=await(await resR.GET(new Request("http://l/",{headers:H()}))).json() as{items:{resultId:string;lifecycle:string;estado:string;superseded:boolean}[]};
 const orig=reg.items.find(i=>i.resultId===n.resultId),neu=reg.items.find(i=>i.resultId===nc);
 ok(nfix.status===201&&orig?.lifecycle==="CLOSED"&&orig.superseded===true&&orig.estado==="Corregido","CORRECTED_CLOSED_RESULT_KEEPS_FOLD_LIFECYCLE");
 ok(neu?.lifecycle==="RECEIVED"&&neu.superseded===false&&neu.estado!=="Corregido","CORRECTION_IS_THE_CURRENT_RESULT");
 const regAll=await(await resR.GET(new Request("http://l/",{headers:H()}))).json() as{items:{lifecycle:string;superseded:boolean}[];pendientes:number};
 ok(regAll.pendientes===regAll.items.filter(i=>!i.superseded&&i.lifecycle==="RECEIVED").length&&regAll.items.some(i=>i.superseded&&i.lifecycle==="RECEIVED"),"PENDING_KPI_EXCLUDES_SUPERSEDED");
 // (F) Indicador glucémico: un valor no interpretable no se cuenta, pero se DECLARA.
 const hb=crypto.randomUUID();await ensurePatientIn(TA,hb);
 const u=await receive(hb,"HBA1C","6.5%");const v=await receive(hb,"HBA1C","6,4");
 const q=((await(await repR.GET(new Request("http://l/",{headers:H()}))).json()).qualityIndicators as{key:string;denominator:number;excluded:number;note:string}[]).find(x=>x.key==="glycemic_control")!;
 ok(u.r.status===201&&v.r.status===201&&q.denominator===1&&q.excluded===1&&/No se cuentan 1 con valor no interpretable/.test(q.note),"GLYCEMIC_QI_DECLARES_EXCLUDED_VALUES");
}catch(e){result.status="FAIL";result.error=String(e);}
await sql.end();
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
