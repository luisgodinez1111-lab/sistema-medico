// Porte del hallazgo D4 (lote 11) sobre main — Evidencia física: un comando nunca escribe en el stream de OTRO tipo de agregado. Antes,
// `POST /allergies/{patientId}/refutation` con If-Match 1 añadía un evento de alergia al stream del paciente (desde entonces
// toda operación del paciente respondía 500) y, en sentido inverso, una baja de paciente apagaba en silencio una alergia.
// Tres capas: lectura TIPADA (id de otro tipo -> 404), folds que no aceptan un `kind` ajeno como génesis, y el kernel que
// rechaza el comando cuya génesis del stream es de otro tipo (cualquier camino, cableado o no). vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET; // R11-07: lo fija el prólogo _live-env (aleatorio por corrida si no viene del entorno)
const{default:postgres}=await import("postgres");
const{directEndpoint}=await import("../../packages/pg-endpoint/src"); // R01-004: única fuente del endpoint directo
const{signSession}=await import("../../packages/session/src");
const{subjectToActorId}=await import("../../packages/http-principal/src");
const{foldAllergy}=await import("../../packages/allergy-fold/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const amendR=await import("../../apps/web/app/api/v1/patients/[patientId]/amendment/route");
const deactR=await import("../../apps/web/app/api/v1/patients/[patientId]/deactivation/route");
const algR=await import("../../apps/web/app/api/v1/allergies/route");
const refR=await import("../../apps/web/app/api/v1/allergies/[allergyId]/refutation/route");
const{runClinicalCommand}=await import("../../apps/web/lib/runtime/command");
const{readAggregateEvents,readAggregateStream}=await import("../../apps/web/lib/runtime/records");
const{buildCommand}=await import("../../apps/web/lib/http-command");
const{toHttpError}=await import("../../apps/web/lib/http-errors");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);const SUB=crypto.randomUUID();
const tok=()=>signSession({sub:SUB,tenantId:TA,roles:["PHYSICIAN"],scopes:["patient:write","patient:read","allergy:write","allergy:read"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
let ts=Date.parse("2026-09-10T09:00:00.000Z");const at=()=>new Date(ts+=3_600_000).toISOString();const idem=()=>crypto.randomUUID();
const ctx={tenantId:TA,actorId:subjectToActorId(SUB),actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:crypto.randomUUID()};
const sql=postgres(directEndpoint(process.env.DATABASE_URL??""),{max:2,prepare:false,onnotice:()=>{}});
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const stream=async(id:string)=>(await sql`select aggregate_type,sequence from clinical_events where tenant_id=${TA} and aggregate_id=${id} order by sequence`).map(r=>`${r.aggregate_type}#${r.sequence}`).join(",");
const version=async(id:string)=>Number((await sql`select version from aggregate_versions where tenant_id=${TA} and aggregate_id=${id}`)[0]?.version??0);
async function register(t:string,p:string){return patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Paciente ${p.slice(0,8)}`,birthDate:"1980-01-01",sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function codeOf(r:Response){return((await r.json()) as{error?:{code?:string}}).error?.code;}
try{
 const t=tok();
 // A) Transición de ALERGIA dirigida al id de un PACIENTE: 404 y el stream del paciente queda intacto y operable.
 const p=crypto.randomUUID();ok((await register(t,p)).status===201,"PATIENT_REGISTERED");
 const a=await refR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({allergyId:p})});
 ok(a.status===404&&await codeOf(a)==="NOT_FOUND","ALLERGY_TRANSITION_ON_PATIENT_ID_404");
 ok(await stream(p)==="Patient#1"&&await version(p)===1,"PATIENT_STREAM_UNTOUCHED");
 const am=await amendR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({phone:"5555555555",occurredAt:at()})}),{params:Promise.resolve({patientId:p})});
 ok(am.status===201,"PATIENT_STILL_WRITABLE");
 // B) Sentido inverso: una BAJA de paciente dirigida al id de una alergia no apaga la alergia.
 const q=crypto.randomUUID();await register(t,q);const al=crypto.randomUUID();
 const c=await algR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:al,patientId:q,substance:"Amoxicilina",severity:"SEVERE",reaction:"Anafilaxia",occurredAt:at()})}));
 const d=await deactR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({patientId:al})});
 ok(c.status===201&&d.status===404,"PATIENT_TRANSITION_ON_ALLERGY_ID_404");
 const reg=await(await algR.GET(new Request("http://l/",{headers:H(t)}))).json() as{items:{allergyId:string;status:string}[]};
 ok(await stream(al)==="Allergy#1"&&reg.items.find(x=>x.allergyId===al)?.status==="ACTIVE","ALLERGY_STREAM_UNTOUCHED_AND_ACTIVE");
 // C) El KERNEL rechaza por sí mismo el comando de otro tipo (camino que no pasa por la lectura tipada): 404, sin consumir versión.
 const cmd=buildCommand({idempotencyKey:idem(),aggregateType:"Allergy",aggregateId:p,expectedVersion:await version(p),eventType:"ALLERGY_REFUTED",payload:{kind:"REFUTED"},occurredAt:at(),topic:"allergy.refuted"});
 const before=await stream(p);let kernelErr:unknown=null;try{await runClinicalCommand(ctx,cmd);}catch(e){kernelErr=e;}
 const h=toHttpError(kernelErr);
 ok(h.status===404&&h.body.error.code==="NOT_FOUND"&&await stream(p)===before&&await version(p)===2,"KERNEL_REJECTS_FOREIGN_STREAM_WITHOUT_WRITING");
 // D) El fold de alergia no acepta la génesis de un paciente como propia (lectura sin tipo de los módulos NOT_WIRED).
 let foldCode="";try{foldAllergy(await readAggregateEvents(ctx,p));}catch(e){foldCode=String((e as{code?:string}).code);}
 ok(foldCode==="INVARIANT_VIOLATION","FOLD_REJECTS_FOREIGN_GENESIS");
 // E) Un stream YA contaminado (anterior a la corrección) es un error explícito, nunca un plegado a medias.
 const r=crypto.randomUUID();await register(t,r);
 await sql`insert into clinical_events(id,tenant_id,aggregate_id,aggregate_type,sequence,actor_id,actor_type,authority,correlation_id,payload,schema_version,occurred_at)
  values(${crypto.randomUUID()},${TA},${r},'Allergy',2,${SUB},'HUMAN',${sql.json({purpose:"TREATMENT"})},${crypto.randomUUID()},${sql.json({kind:"REFUTED"})},1,${at()})`;
 let mixed="";try{await readAggregateStream(ctx,"Patient",r);}catch(e){mixed=String((e as{code?:string}).code);}
 ok(mixed==="INVARIANT_VIOLATION"&&(await readAggregateStream(ctx,"Allergy",r)).length===0,"CONTAMINATED_STREAM_IS_EXPLICIT");
}catch(e){result.status="FAIL";result.error=String(e);}
await sql.end();
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
