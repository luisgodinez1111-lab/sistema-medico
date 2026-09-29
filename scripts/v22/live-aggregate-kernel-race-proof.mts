// Porte sobre main de la revisión adversarial del hallazgo D4 (lote 11) — secciones A y B de live-review-hardening-proof de la
// rama de origen (las C–F pertenecen a otros hallazgos). Evidencia física de que:
// (A) el kernel rechaza escribir en un stream de otro tipo AUNQUE su génesis se confirme en paralelo (la guarda corre después de
// reclamar la versión); (B) GET /encounters solo sirve encuentros y un id que no es uuid es 404, no 500. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=process.env.SESSION_SIGNING_SECRET; // R11-07: lo fija el prólogo _live-env (aleatorio por corrida si no viene del entorno)
const{default:postgres}=await import("postgres");
const{directEndpoint}=await import("../../packages/pg-endpoint/src"); // R01-004: única fuente del endpoint directo
const{signSession}=await import("../../packages/session/src");
const{subjectToActorId}=await import("../../packages/http-principal/src");
const{buildCommand}=await import("../../apps/web/lib/http-command");
const{runClinicalCommand}=await import("../../apps/web/lib/runtime/command");
const enc=await import("../../apps/web/app/api/v1/encounters/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);const SUB=crypto.randomUUID();
const phys=signSession({sub:SUB,tenantId:TA,roles:["PHYSICIAN"],scopes:["encounter:write","encounter:read","result:write","result:read","obligation:write","patient:read","record:export"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+phys,...x};}
let ts=Date.now()-3_600_000;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const ctx={tenantId:TA,actorId:subjectToActorId(SUB),actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:crypto.randomUUID()};
const sql=postgres(directEndpoint(process.env.DATABASE_URL??""),{max:3,prepare:false,onnotice:()=>{}});
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const codeOf=async(r:Response)=>((await r.clone().json()) as{error?:{code?:string}}).error?.code;
const streamOf=async(id:string)=>(await sql`select aggregate_type||'#'||sequence as s from clinical_events where tenant_id=${TA} and aggregate_id=${id} order by sequence`).map(r=>String(r.s)).join(",");
// Espera a que haya al menos `n` sesiones esperando un bloqueo (las dos transacciones de la carrera están dentro del kernel).
async function waitForLockWaiters(n:number){for(let i=0;i<100;i++){const w=await sql`select count(*)::int as c from pg_locks where not granted`;if(Number(w[0]!.c)>=n)return true;await new Promise(r=>setTimeout(r,50));}return false;}
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
}catch(e){result.status="FAIL";result.error=String(e);}
await sql.end();
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
