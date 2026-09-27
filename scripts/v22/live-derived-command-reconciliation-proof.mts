// Hallazgo D5 del lote 11 — Evidencia física: los comandos DERIVADOS (obligaciones de monitoreo de un fármaco y obligación
// URGENTE de un resultado crítico) no dependen del límite de tasa del actor y se RECONCILIAN en el reintento. Antes solo se
// ejecutaban en el primer intento y se cobraban otra vez: con el cubo agotado entre el principal y el derivado, la warfarina
// quedaba PRESCRITA sin obligación de INR y un crítico sin obligación urgente, y el reintento respondía éxito (replay) sin
// crearlas nunca (Zero-Lost-Follow-Up). vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"d5-derived-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{default:postgres}=await import("postgres");
const{signSession}=await import("../../packages/session/src");
const{subjectToActorId}=await import("../../packages/http-principal/src");
const{foldObligation}=await import("../../packages/obligation-fold/src");
const{derivedUuid}=await import("../../apps/web/lib/http-command");
const{criticalObligationId}=await import("../../apps/web/lib/result-lifecycle");
const{readAggregateStream}=await import("../../apps/web/lib/runtime/event-store");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);const SUB=crypto.randomUUID();
const phys=signSession({sub:SUB,tenantId:TA,roles:["PHYSICIAN"],scopes:["medication:propose","medication:write","obligation:write","result:write"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+phys,...x};}
const ISO=new Date().toISOString();const idem=()=>crypto.randomUUID();
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const ctx={tenantId:TA,actorId:subjectToActorId(SUB),actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:crypto.randomUUID()};
const raw=process.env.DATABASE_URL!.replace("-pooler","").replace(/([?&])channel_binding=require/,"$1").replace(/[?&]$/,"");
const sql=postgres(raw,{max:2,prepare:false,onnotice:()=>{}});
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const bucketKey=`${TA}:${subjectToActorId(SUB)}`;
const oneTokenLeft=()=>sql`insert into rate_limit_buckets(scope,key,tokens,updated_at) values('write',${bucketKey},1.0,now()+interval '30 seconds') on conflict(scope,key) do update set tokens=1.0,updated_at=now()+interval '30 seconds'`;
const fullBucket=()=>sql`delete from rate_limit_buckets where scope='write' and key=${bucketKey}`;
// Bloquea UNA vez la creación de un agregado derivado ocupando su versión (el kernel la rechazará por concurrencia).
const block=(id:string)=>sql`insert into aggregate_versions(tenant_id,aggregate_id,version) values(${TA},${id},1)`;
const unblock=(id:string)=>sql`delete from aggregate_versions where tenant_id=${TA} and aggregate_id=${id}`;
const obligationState=async(id:string)=>{const f=foldObligation(await readAggregateStream(ctx,"ClinicalObligation",id));return f.exists?f.state:"ABSENT";};
async function propose(pat:string,drugCode:string){const id=crypto.randomUUID();const r=await meds.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:pat,drugCode,dose:"5mg",route:"VO",frequency:"c/24h",occurredAt:ISO})}));if(r.status!==201)throw new Error("PROPOSE_"+r.status);return id;}
const prescribe=(medId:string,key:string)=>rx.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":key,"if-match":"1"}),body:JSON.stringify({occurredAt:ISO,...ACK})}),{params:Promise.resolve({medicationId:medId})});
try{
 await registerPhysicianCredentials(phys);const pat=crypto.randomUUID();await ensurePatientIn(TA,pat);
 // A) Cubo del actor con UN token: la prescripción lo consume y la obligación derivada no se cobra.
 const w1=await propose(pat,"warfarina-5");const k1=idem();await oneTokenLeft();
 const p1=await prescribe(w1,k1);await fullBucket();
 ok(p1.status===201&&await obligationState(derivedUuid(k1,"monitor-agg-0"))==="OPEN","DERIVED_NOT_CHARGED_TO_RATE_LIMIT");
 // B) El derivado falla DESPUÉS del commit principal: el reintento con la misma llave (replay) lo crea.
 const w2=await propose(pat,"warfarina-5");const k2=idem();const obl2=derivedUuid(k2,"monitor-agg-0");await block(obl2);
 const p2=await prescribe(w2,k2);ok(p2.status!==201&&await obligationState(obl2)==="ABSENT","DERIVED_FAILURE_AFTER_MAIN_COMMIT");
 await unblock(obl2);const p2b=await prescribe(w2,k2);const b2=await p2b.json() as{replayed?:boolean};
 ok(p2b.status===200&&b2.replayed===true&&await obligationState(obl2)==="OPEN","PRESCRIPTION_REPLAY_RECONCILES_MONITORING_OBLIGATION");
 // C) Igual para el resultado crítico: su obligación URGENTE se reconcilia en el reintento.
 const resultId=crypto.randomUUID(),orderId=crypto.randomUUID();const obl3=criticalObligationId(resultId);await block(obl3);const k3=idem();
 const receive=()=>resR.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":k3}),body:JSON.stringify({resultId,patientId:pat,orderId,analyte:"POTASSIUM",value:"7.0",occurredAt:ISO})}));
 const r3=await receive();ok(r3.status!==201&&await obligationState(obl3)==="ABSENT","CRITICAL_OBLIGATION_FAILURE_AFTER_MAIN_COMMIT");
 await unblock(obl3);const r3b=await receive();const b3=await r3b.json() as{replayed?:boolean;critical?:boolean};
 ok(r3b.status===200&&b3.replayed===true&&b3.critical===true&&await obligationState(obl3)==="OPEN","RESULT_REPLAY_RECONCILES_CRITICAL_OBLIGATION");
}catch(e){result.status="FAIL";result.error=String(e);}
await sql.end();
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
