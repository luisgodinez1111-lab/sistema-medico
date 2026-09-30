// Hallazgo D7 del lote 11 — Evidencia física: toda transición compara If-Match con la versión leída ANTES de evaluar la máquina
// de estados (409 CONCURRENCY_CONFLICT {expected,actual}). Antes 23 transiciones evaluaban la máquina sobre la versión leída
// por el servidor: un If-Match desfasado respondía un CONFLICT engañoso y, con un If-Match adelantado y un escritor concurrente,
// se persistía una transición ilegal (alergia INACTIVE -> REFUTED). contra una base desechable (one.sh).
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=process.env.SESSION_SIGNING_SECRET; // R11-07: lo fija el prólogo _live-env (aleatorio por corrida si no viene del entorno)
const{default:postgres}=await import("postgres");
const{directEndpoint}=await import("../../packages/pg-endpoint/src"); // R01-004: única fuente del endpoint directo
const{signSession}=await import("../../packages/session/src");
const{subjectToActorId}=await import("../../packages/http-principal/src");
const alR=await import("../../apps/web/app/api/v1/allergies/route");
const alRef=await import("../../apps/web/app/api/v1/allergies/[allergyId]/refutation/route");
const alIn=await import("../../apps/web/app/api/v1/allergies/[allergyId]/inactivation/route");
const alRe=await import("../../apps/web/app/api/v1/allergies/[allergyId]/reactivation/route");
// Porte a main: además de la fábrica (alergia), un ciclo con forma propia (medicación, commitTransition) que no pasa por ella.
const meds=await import("../../apps/web/app/api/v1/medications/route");
const medHold=await import("../../apps/web/app/api/v1/medications/[medicationId]/hold/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const tok=(sub:string)=>signSession({sub,tenantId:TA,roles:["PHYSICIAN"],scopes:["patient:read","allergy:write","medication:propose","medication:write"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
let ts=Date.parse("2026-09-10T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const AP=(id:string)=>({params:Promise.resolve({allergyId:id})});
const sql=postgres(directEndpoint(process.env.DATABASE_URL??""),{max:3,prepare:false,onnotice:()=>{}});
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
type Mod={POST:(r:Request,p:ReturnType<typeof AP>)=>Promise<Response>};
const post=(m:Mod,t:string,ifMatch:string,id:string)=>m.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":ifMatch}),body:JSON.stringify({occurredAt:at()})}),AP(id));
const kinds=async(id:string)=>(await sql`select payload->>'kind' as k from clinical_events where tenant_id=${TA} and aggregate_id=${id} order by sequence`).map(r=>String(r.k)).join(",");
async function conflict(r:Response,expected:number,actual:number){const b=await r.json().catch(()=>({})) as{error?:{code?:string;details?:{expected?:number;actual?:number}}};
 return r.status===409&&b.error?.code==="CONCURRENCY_CONFLICT"&&b.error.details?.expected===expected&&b.error.details?.actual===actual;}
try{
 const subA=crypto.randomUUID(),subB=crypto.randomUUID();const tA=tok(subA),tB=tok(subB);
 const pat=crypto.randomUUID();await ensurePatientIn(TA,pat);
 const record=async()=>{const id=crypto.randomUUID();const r=await alR.POST(new Request("http://l/",{method:"POST",headers:H(tA,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:id,patientId:pat,substance:"Penicilina",severity:"SEVERE",reaction:"Urticaria",occurredAt:at()})}));if(r.status!==201)throw new Error("RECORD_"+r.status);return id;};
 // 1) If-Match desfasado cuya transición sería ILEGAL en el estado actual: 409 de versión, no un CONFLICT de máquina de estados.
 const a1=await record();ok((await post(alRef,tA,"1",a1)).status===201,"REFUTED_BY_A");
 ok(await conflict(await post(alIn,tB,"1",a1),1,2),"STALE_IF_MATCH_409_VERSION_NOT_STATE_MACHINE");
 // 2) If-Match desfasado cuya transición sería LEGAL en el estado actual: igual de rechazada, con las versiones.
 const a2=await record();ok((await post(alIn,tA,"1",a2)).status===201,"INACTIVATED_BY_A");
 ok(await conflict(await post(alRe,tB,"1",a2),1,2)&&await kinds(a2)==="RECORDED,INACTIVATED","STALE_LEGAL_TRANSITION_409");
 // 3) If-Match ADELANTADO sin escritor concurrente: 409 antes de cualquier regla; nada se escribe.
 const a3=await record();ok(await conflict(await post(alRef,tA,"2",a3),2,1)&&await kinds(a3)==="RECORDED","AHEAD_IF_MATCH_409");
 // 4) La carrera del hallazgo, con A retenido de verdad. El punto de retención es el límite de tasa compartido del actor A
 //    (fila de rate_limit_buckets): runClinicalCommand lo toma DESPUÉS de lookupReplay -> assertReadVersion -> regla y ANTES del
 //    kernel, que es la ventana donde vivía el defecto. Que A esté ahí se observa en pg_stat_activity (backend de ESTA base
 //    esperando un Lock, excluida la sesión que retiene la fila), no se supone por tiempo.
 //  4a) If-Match ADELANTADO (el defecto): A no llega a la ventana. Se rechaza con el 409 de versión {2,1} MIENTRAS la fila sigue
 //      retenida y sin ningún backend esperándola. Antes (máquina evaluada sobre la versión leída) A pasaba su regla, quedaba
 //      retenido aquí y, tras la inactivación concurrente de B, el kernel aceptaba If-Match 2 y escribía REFUTED sobre INACTIVE.
 //  4b) If-Match correcto (= versión leída) y regla evaluada sobre esa lectura: A SÍ queda retenido tras su regla; B inactiva
 //      entretanto; al liberar, el kernel rechaza la versión (409 del kernel, sin {expected,actual}) y el stream queda legal.
 //      Es la garantía que complementa a 4a (no un control negativo: también pasa sin D7).
 const actorKey=`${TA}:${subjectToActorId(subA)}`;
 const lockWaiters=async(exclude:number)=>Number((await sql`select count(*)::int as c from pg_stat_activity
  where datname=current_database() and wait_event_type='Lock' and pid<>pg_backend_pid() and pid<>${exclude}`)[0]!.c);
 const waitForWaiter=async(exclude:number)=>{for(let i=0;i<100;i++){if(await lockWaiters(exclude)>0)return true;await new Promise(r=>setTimeout(r,50));}return false;};
 // Retiene la fila del cubo de A en una transacción aparte hasta que `body` termine (siempre se libera, también si falla).
 const holdingActorBucket=async<T,>(body:(holderPid:number)=>Promise<T>):Promise<T>=>{
  let release!:()=>void;const released=new Promise<void>(r=>{release=r;});let locked!:(pid:number)=>void;const lockHeld=new Promise<number>(r=>{locked=r;});
  const holder=sql.begin(async tx=>{
   await tx`insert into rate_limit_buckets(scope,key,tokens,updated_at) values('write',${actorKey},100,now()) on conflict(scope,key) do update set tokens=rate_limit_buckets.tokens`;
   locked(Number((await tx`select pg_backend_pid() as p`)[0]!.p));await released;});
  try{return await body(await lockHeld);}finally{release();await holder;}
 };
 const a4=await record();
 const ahead=await holdingActorBucket(async holderPid=>{
  const settled=await Promise.race([post(alRef,tA,"2",a4).then(r=>r),new Promise<null>(r=>setTimeout(()=>r(null),3000))]);
  return{settled,waiters:await lockWaiters(holderPid)};
 });
 ok(ahead.settled!==null&&ahead.waiters===0&&await conflict(ahead.settled,2,1)&&await kinds(a4)==="RECORDED","RACE_AHEAD_IF_MATCH_REJECTED_BEFORE_THE_PRE_KERNEL_WINDOW");
 const a5=await record();
 const race=await holdingActorBucket(async holderPid=>{
  const pendingA=post(alRef,tA,"1",a5);
  const held=await waitForWaiter(holderPid);
  const b=await post(alIn,tB,"1",a5);
  return{pendingA,held,bStatus:b.status};
 });
 const aRes=await race.pendingA;const aBody=await aRes.json().catch(()=>({})) as{error?:{code?:string;details?:unknown}};
 ok(race.held&&race.bStatus===201&&aRes.status===409&&aBody.error?.code==="CONCURRENCY_CONFLICT"&&aBody.error.details===undefined
  &&await kinds(a5)==="RECORDED,INACTIVATED","RACE_HELD_AFTER_RULES_KERNEL_NEVER_PERSISTS_ILLEGAL_TRANSITION");
 // 5) Ciclo con forma propia (medicación): If-Match ADELANTADO sobre PROPOSED -> 409 de versión antes de la máquina (antes: CONFLICT
 //    «Illegal medication transition PROPOSED -> HELD», evaluado sobre una versión que el cliente no pidió); nada se escribe.
 const m1=crypto.randomUUID();
 const mr=await meds.POST(new Request("http://l/",{method:"POST",headers:H(tA,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:m1,patientId:pat,drugCode:"paracetamol-500",dose:"500mg",route:"VO",frequency:"c/8h",occurredAt:at()})}));
 if(mr.status!==201)throw new Error("PROPOSE_"+mr.status);
 const hold=await medHold.POST(new Request("http://l/",{method:"POST",headers:H(tA,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({reason:"prueba D7",occurredAt:at()})}),{params:Promise.resolve({medicationId:m1})});
 ok(await conflict(hold,2,1)&&await kinds(m1)==="PROPOSED","MEDICATION_AHEAD_IF_MATCH_409_OWN_LIFECYCLE");
}catch(e){result.status="FAIL";result.error=String(e);}
await sql.end();
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
