// Auditoría 2026-09-19 (U-19) — PRUEBA EN VIVO de la anulación justificada de un bloqueo de seguridad contra PostgreSQL real.
// Demuestra el contrato completo de PRESCRIBE/RESUME/MODIFY:
//   · un bloqueo anulable (alergia GRAVE, duplicidad, interacción mayor, contraindicación, renal) responde 403 SAFETY_BLOCKED
//     con `overridable` (qué se puede anular) y `hard` (qué no), y sin anulación NADA se escribe;
//   · anular exige NOMBRAR cada barrera y una justificación ≥ 20 caracteres (si no, 400/403 y nada se escribe);
//   · nombrar una barrera que hoy no bloquea se rechaza (400): no se registran anulaciones "por si acaso";
//   · con la anulación completa la prescripción se escribe (201) y el evento inmutable guarda `safety.override`
//     {barreras, justificación, quién}; el reintento idempotente devuelve lo mismo sin duplicar;
//   · un bloqueo DURO responde 403 con `hard` y NINGUNA justificación lo levanta: el techo diario ya se aplica al PROPONER
//     (403 antes de llegar a PRESCRIBE) y la dosis pediátrica por peso bloquea al prescribir cuando el peso se registró después.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"u19-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{resolveVerified}=await import("../../apps/web/lib/http-command");
const{readAggregateEvents}=await import("../../apps/web/lib/clinical-runtime");
const al=await import("../../apps/web/app/api/v1/allergies/route");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const vitals=await import("../../apps/web/app/api/v1/vitals/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);const SUB=crypto.randomUUID();
function tok(scopes=["allergy:write","medication:propose","medication:write","patient:write","vital:write"]){return signSession({sub:SUB,tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});const ISO="2026-09-10T10:00:00.000Z";const idem=()=>crypto.randomUUID();
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
type Err={error:{code:string;message:string;details?:{barriers?:string[];hard?:string[];overridable?:string[];missing?:string[];unmatched?:string[]}}};
async function proposeRaw(t:string,pat:string,drugCode:string,order:{dose:string;frequency:string}){
 const med=crypto.randomUUID();
 const r=await meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:med,patientId:pat,drugCode,dose:order.dose,route:"VO",frequency:order.frequency,occurredAt:ISO})}));
 return{med,r};
}
async function propose(t:string,pat:string,drugCode:string,order:{dose:string;frequency:string}){
 const{med,r}=await proposeRaw(t,pat,drugCode,order);
 if(r.status!==201)throw new Error("PROPOSE_FAILED:"+r.status+":"+await r.text());
 return med;
}
const prescribe=(t:string,med:string,body:Record<string,unknown>,key=idem())=>rx.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":key,"if-match":"1"}),body:JSON.stringify({occurredAt:ISO,...ACK,...body})}),MP(med));
try{
 const phys=tok();await registerPhysicianCredentials(phys);const pat=crypto.randomUUID();
 // Alergia GRAVE a penicilina -> amoxicilina BLOQUEADA por clase (anulable con justificación: p. ej. desensibilización).
 await al.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:crypto.randomUUID(),patientId:pat,substance:"penicilina",severity:"SEVERE",reaction:"anafilaxia",occurredAt:ISO})}));
 const med=await propose(phys,pat,"amoxicilina-500",{dose:"500mg",frequency:"c/8h"});
 // 1) sin anulación: 403 y la respuesta dice QUÉ es anulable y que no hay bloqueo duro
 let r=await prescribe(phys,med,{});let e=await r.json() as Err;
 ok(r.status===403&&e.error.code==="SAFETY_BLOCKED","BLOCKED_403_WITHOUT_OVERRIDE");
 ok(JSON.stringify(e.error.details?.overridable)===JSON.stringify(["allergy"])&&(e.error.details?.hard??[]).length===0&&JSON.stringify(e.error.details?.missing)===JSON.stringify(["allergy"]),"RESPONSE_NAMES_OVERRIDABLE_AND_MISSING");
 // 2) justificación sin nombrar barreras -> 400
 r=await prescribe(phys,med,{overrideJustification:"Desensibilización programada con alergología en hospital"});e=await r.json() as Err;
 ok(r.status===400&&e.error.code==="VALIDATION_ERROR","JUSTIFICATION_WITHOUT_BARRIERS_400");
 // 3) barrera nombrada que NO bloquea (renal) -> 400 OVERRIDE_NOT_BLOCKED
 r=await prescribe(phys,med,{overrideBarriers:["allergy","renal"],overrideJustification:"Desensibilización programada con alergología en hospital"});e=await r.json() as Err;
 ok(r.status===400&&e.error.code==="VALIDATION_ERROR"&&JSON.stringify(e.error.details?.unmatched)===JSON.stringify(["renal"]),"NAMING_NON_BLOCKING_BARRIER_400");
 // 4) justificación corta -> 400
 r=await prescribe(phys,med,{overrideBarriers:["allergy"],overrideJustification:"ok"});e=await r.json() as Err;
 ok(r.status===400&&e.error.code==="VALIDATION_ERROR","SHORT_JUSTIFICATION_400");
 // 5) barrera fuera del esquema (doseCeiling nunca es anulable) -> 400 del validador de cuerpo
 r=await prescribe(phys,med,{overrideBarriers:["doseCeiling"],overrideJustification:"Desensibilización programada con alergología en hospital"});
 ok(r.status===400,"HARD_BARRIER_NOT_ACCEPTED_IN_SCHEMA");
 // nada de lo anterior escribió: la medicación sigue PROPOSED en versión 1
 const ctx=resolveVerified(new Request("http://l/",{headers:H(phys)})).ctx;
 let ev=await readAggregateEvents(ctx,med);ok(ev.length===1&&ev[0]!.payload["kind"]==="PROPOSED","NOTHING_WRITTEN_UNTIL_VALID_OVERRIDE");
 // 6) anulación completa -> 201 y el evento guarda la anulación (barreras, justificación, quién)
 const J="Desensibilización programada con alergología en hospital";const key=idem();
 r=await prescribe(phys,med,{overrideBarriers:["allergy"],overrideJustification:J},key);
 ok(r.status===201,"PRESCRIBED_WITH_OVERRIDE_201");
 ev=await readAggregateEvents(ctx,med);const pres=ev.find(x=>x.payload["kind"]==="PRESCRIBED")?.payload as{prescriberId?:string;safety?:{verdict:string;override?:{barriers:string[];justification:string;by:string}}}|undefined;
 const ov=pres?.safety?.override; // JSONB no conserva el orden de claves: se compara campo a campo. `by` es el actorId derivado del sub (el mismo que prescriberId).
 ok(pres?.safety?.verdict==="BLOCK"&&ov!==undefined&&ov.barriers.join()==="allergy"&&ov.justification===J&&typeof ov.by==="string"&&ov.by===pres.prescriberId,"EVENT_RECORDS_OVERRIDE_WITH_AUTHOR");
 // 7) reintento idempotente: mismo resultado, sin evento nuevo
 r=await prescribe(phys,med,{overrideBarriers:["allergy"],overrideJustification:J},key);
 ok(r.status===200&&(await r.json()).replayed===true&&(await readAggregateEvents(ctx,med)).length===2,"IDEMPOTENT_RETRY_NO_DUPLICATE");
 // 8) bloqueo DURO (a): el techo diario se aplica ya al PROPONER: paracetamol 2000 mg c/4h = 12 g/día -> 403, nada escrito
 const pat2=crypto.randomUUID();const p2=await proposeRaw(phys,pat2,"paracetamol-500",{dose:"2000mg",frequency:"c/4h"});
 ok(p2.r.status===403&&((await p2.r.json()) as Err).error.code==="SAFETY_BLOCKED"&&(await readAggregateEvents(ctx,p2.med)).length===0,"DOSE_CEILING_BLOCKS_AT_PROPOSAL_403");
 // 8) bloqueo DURO (b): niño de 2 años SIN peso al proponer (dosis/kg no evaluable -> 201); se registra 10 kg después; al
 //    prescribir, paracetamol 500 mg c/6h = 200 mg/kg/día bloquea por dosis pediátrica y NINGUNA anulación lo levanta.
 const child=crypto.randomUUID();
 const reg=await patR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({patientId:child,name:"Prueba",birthDate:new Date(Date.now()-2.5*365.25*864e5).toISOString().slice(0,10),sexAtBirth:"MALE",occurredAt:ISO})}));
 ok(reg.status===201,"CHILD_REGISTERED");
 const med3=await propose(phys,child,"paracetamol-500",{dose:"500mg",frequency:"c/6h"});
 const w=await vitals.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:child,vitalType:"WEIGHT",value:"10",unit:"kg",occurredAt:"2026-09-10T10:05:00.000Z"})}));
 ok(w.status===201,"CHILD_WEIGHT_RECORDED_AFTER_PROPOSAL");
 r=await prescribe(phys,med3,{});e=await r.json() as Err;
 ok(r.status===403&&e.error.code==="SAFETY_BLOCKED"&&JSON.stringify(e.error.details?.hard)===JSON.stringify(["pediatricDose"]),"PEDIATRIC_DOSE_HARD_BLOCK_403");
 r=await prescribe(phys,med3,{overrideBarriers:["allergy","interaction","duplicate","contraindication","renal"],overrideJustification:"Intento de anular todo lo anulable: no debe levantar la dosis pediátrica"});e=await r.json() as Err;
 ok(r.status===403&&e.error.code==="SAFETY_BLOCKED"&&JSON.stringify(e.error.details?.hard)===JSON.stringify(["pediatricDose"]),"PEDIATRIC_DOSE_NOT_OVERRIDABLE");
 ok((await readAggregateEvents(ctx,med3)).length===1,"HARD_BLOCK_WROTE_NOTHING");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
