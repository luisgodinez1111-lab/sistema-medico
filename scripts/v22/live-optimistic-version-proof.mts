// Hallazgo D7 del lote 11 — Evidencia física: toda transición compara If-Match con la versión leída ANTES de evaluar la máquina
// de estados (409 CONCURRENCY_CONFLICT {expected,actual}). Antes 23 transiciones evaluaban la máquina sobre la versión leída
// por el servidor: un If-Match desfasado respondía un CONFLICT engañoso y, con un If-Match adelantado y un escritor concurrente,
// se persistía una transición ilegal (alergia INACTIVE -> REFUTED). vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"d7-version-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{default:postgres}=await import("postgres");
const{signSession}=await import("../../packages/session/src");
const{subjectToActorId}=await import("../../packages/http-principal/src");
const alR=await import("../../apps/web/app/api/v1/allergies/route");
const alRef=await import("../../apps/web/app/api/v1/allergies/[allergyId]/refutation/route");
const alIn=await import("../../apps/web/app/api/v1/allergies/[allergyId]/inactivation/route");
const alRe=await import("../../apps/web/app/api/v1/allergies/[allergyId]/reactivation/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const tok=(sub:string)=>signSession({sub,tenantId:TA,roles:["PHYSICIAN"],scopes:["patient:read","allergy:write"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
let ts=Date.parse("2026-09-10T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const AP=(id:string)=>({params:Promise.resolve({allergyId:id})});
const raw=process.env.DATABASE_URL!.replace("-pooler","").replace(/([?&])channel_binding=require/,"$1").replace(/[?&]$/,"");
const sql=postgres(raw,{max:3,prepare:false,onnotice:()=>{}});
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
type Mod={POST:(r:Request,p:ReturnType<typeof AP>)=>Promise<Response>};
const post=(m:Mod,t:string,ifMatch:string,id:string)=>m.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":ifMatch}),body:JSON.stringify({occurredAt:at()})}),AP(id));
const kinds=async(id:string)=>(await sql`select payload->>'kind' as k from clinical_events where tenant_id=${TA} and aggregate_id=${id} order by sequence`).map(r=>String(r.k)).join(",");
async function conflict(r:Response,expected:number,actual:number){const b=await r.json() as{error?:{code?:string;details?:{expected?:number;actual?:number}}};
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
 // 4) La carrera del hallazgo: A (If-Match adelantado) queda retenido tras sus reglas mientras B inactiva; antes A escribía
 //    REFUTED sobre INACTIVE. Ahora A se rechaza por versión antes de llegar al kernel y el stream queda legal.
 const a4=await record();const key=`${TA}:${subjectToActorId(subA)}`;let aRes!:Response;
 await sql.begin(async tx=>{
  await tx`insert into rate_limit_buckets(scope,key,tokens,updated_at) values('write',${key},100,now()) on conflict(scope,key) do update set tokens=rate_limit_buckets.tokens`;
  const pending=post(alRef,tA,"2",a4);
  const b=await post(alIn,tB,"1",a4);if(b.status!==201)throw new Error("B_"+b.status);
  aRes=await Promise.race([pending,new Promise<Response>(r=>setTimeout(()=>r(new Response(null,{status:599})),3000))]);
 });
 ok(await conflict(aRes,2,1)&&await kinds(a4)==="RECORDED,INACTIVATED","RACE_NEVER_PERSISTS_ILLEGAL_TRANSITION");
}catch(e){result.status="FAIL";result.error=String(e);}
await sql.end();
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
