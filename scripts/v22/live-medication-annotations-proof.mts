// Auditoría 2026-09-19 (L-04, K-05) — PRUEBA EN VIVO de las anotaciones de medicación y de problema, de punta a punta sobre
// Postgres real. Antes: MODIFY/RECONCILE y las actualizaciones epistémica/de evidencia pedían la "transición" X->X (409
// siempre), no tenían ruta, y un evento guardado habría dejado el agregado ilegible. Además, "activa" se derivaba del ÚLTIMO
// evento: una medicación reanudada o modificada dejaba de contar para las barreras de interacción y duplicidad.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"audit-l04-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const act=await import("../../apps/web/app/api/v1/medications/[medicationId]/activation/route");
const hold=await import("../../apps/web/app/api/v1/medications/[medicationId]/hold/route");
const resume=await import("../../apps/web/app/api/v1/medications/[medicationId]/resumption/route");
const modify=await import("../../apps/web/app/api/v1/medications/[medicationId]/modification/route");
const stop=await import("../../apps/web/app/api/v1/medications/[medicationId]/discontinuation/route");
const probs=await import("../../apps/web/app/api/v1/problems/route");
const epi=await import("../../apps/web/app/api/v1/problems/[problemId]/epistemic-status/route");
const evi=await import("../../apps/web/app/api/v1/problems/[problemId]/evidence/route");
const chronic=await import("../../apps/web/app/api/v1/problems/[problemId]/chronicity/route");
const patientsList=await import("../../apps/web/app/api/v1/patients/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(roles=["PHYSICIAN"],scopes=["patient:write","patient:read","result:write","medication:propose","medication:write","problem:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});const PP=(id:string)=>({params:Promise.resolve({problemId:id})});
let ts=Date.now()-3_600_000;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
const post=(mod:{POST:(r:Request,c:never)=>Promise<Response>},t:string,v:number,body:Record<string,unknown>,params:unknown)=>mod.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:at(),...body})}),params as never);
async function propose(t:string,p:string,drugCode:string,o:{dose:string;route:string;frequency:string}){const id=crypto.randomUUID();const r=await meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:p,drugCode,...o,occurredAt:at()})}));if(r.status!==201)throw new Error("propose "+r.status);return id;}
try{
 const phys=tok();await registerPhysicianCredentials(phys);
 // Paciente ADULTO con creatinina normal y vigente: todas las barreras son verificables (no hace falta confirmación).
 const p=crypto.randomUUID();
 await patR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:"Prueba L04",birthDate:birth(45),sexAtBirth:"FEMALE",occurredAt:at()})}));
 await resR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:"CREATININE",value:"0.8",unit:"mg/dL",occurredAt:at()})}));

 // === A) Ciclo completo: proponer -> prescribir -> activar -> MODIFICAR -> suspender -> reanudar ===
 const ibu=await propose(phys,p,"ibuprofeno-400",{dose:"400mg",route:"VO",frequency:"c/12h"});
 let r=await post(rx,phys,1,{},MP(ibu));ok(r.status===201,"PRESCRIBED_201_NO_ACK_NEEDED");
 r=await post(act,phys,2,{},MP(ibu));ok(r.status===201,"ACTIVE_201");
 // A1) MODIFY válido: c/12h -> c/8h (1200 mg/día, dentro del máximo). Antes: 409 SIEMPRE.
 r=await post(modify,phys,3,{frequency:"c/8h",reason:"Dolor no controlado con c/12h"},MP(ibu));let j=await r.json();
 ok(r.status===201&&j.state==="ACTIVE"&&j.annotation==="MODIFIED"&&j.version===4&&j.order.frequency==="c/8h"&&j.order.dose==="400mg","MODIFY_201_STATE_UNCHANGED_v4");
 // A2) MODIFY NO es un atajo para saltarse las barreras: 800 mg c/4h = 4800 mg/día -> BLOQUEADO
 r=await post(modify,phys,4,{dose:"800mg",frequency:"c/4h",reason:"intento de sobredosis"},MP(ibu));j=await r.json();
 ok(r.status===403&&j.error.code==="SAFETY_BLOCKED","MODIFY_OVER_CEILING_BLOCKED_403");
 // A3) validación de la orden y de la razón
 r=await post(modify,phys,4,{reason:"sin cambios"},MP(ibu));ok(r.status===400,"MODIFY_WITHOUT_CHANGES_400");
 r=await post(modify,phys,4,{dose:"dos pastillas",reason:"formato libre"},MP(ibu));ok(r.status===400,"MODIFY_INVALID_ORDER_400");
 // A4) versión primero: If-Match desfasado -> 409 (y no 403/428)
 r=await post(modify,phys,2,{frequency:"c/12h",reason:"vista obsoleta"},MP(ibu));ok(r.status===409,"MODIFY_STALE_VERSION_409");
 // A5) una medicación MODIFICADA sigue contando como ACTIVA para la duplicidad (antes: desaparecía de la lista)
 const napro=await propose(phys,p,"naproxeno-500",{dose:"500mg",route:"VO",frequency:"c/12h"});
 r=await post(rx,phys,1,{},MP(napro));j=await r.json();ok(r.status===403&&j.error.code==="SAFETY_BLOCKED","DUPLICATE_STILL_SEEN_AFTER_MODIFY_403");
 // A6) HOLD exige razón; suspendida NO cuenta como activa -> el segundo AINE ya se puede prescribir
 r=await post(hold,phys,4,{},MP(ibu));ok(r.status===400,"HOLD_WITHOUT_REASON_400");
 r=await post(hold,phys,4,{reason:"Suspensión preoperatoria"},MP(ibu));j=await r.json();ok(r.status===201&&j.state==="HELD"&&j.version===5,"HOLD_201_v5");
 r=await post(rx,phys,1,{},MP(napro));ok(r.status===201,"SECOND_NSAID_ALLOWED_WHILE_FIRST_HELD");
 r=await post(act,phys,2,{},MP(napro));ok(r.status===201,"SECOND_NSAID_ACTIVE");
 // A7) REANUDAR reevalúa las barreras: ahora hay otro AINE activo -> BLOQUEADO (antes RESUME no verificaba nada)
 r=await post(resume,phys,5,{},MP(ibu));j=await r.json();ok(r.status===403&&j.error.code==="SAFETY_BLOCKED","RESUME_REEVALUATES_SAFETY_403");
 // A8) se suspende definitivamente el segundo AINE -> reanudar procede, y la reanudada vuelve a contar como ACTIVA (K-05)
 r=await post(stop,phys,3,{reason:"Se retoma el esquema original"},MP(napro));ok(r.status===201,"SECOND_NSAID_STOPPED");
 r=await post(resume,phys,5,{},MP(ibu));j=await r.json();ok(r.status===201&&j.state==="ACTIVE"&&j.version===6,"RESUME_201_v6");
 const keto=await propose(phys,p,"ketorolaco-10",{dose:"10mg",route:"VO",frequency:"c/8h"}).catch(()=>"");
 if(keto){r=await post(rx,phys,1,{},MP(keto));ok(r.status===403,"RESUMED_MEDICATION_COUNTS_AS_ACTIVE_403");}
 else{const n2=await propose(phys,p,"naproxeno-500",{dose:"500mg",route:"VO",frequency:"c/12h"});r=await post(rx,phys,1,{},MP(n2));ok(r.status===403,"RESUMED_MEDICATION_COUNTS_AS_ACTIVE_403");}
 // A9) no se modifica una medicación que no está en curso
 const draft=await propose(phys,p,"paracetamol-500",{dose:"500mg",route:"VO",frequency:"c/8h"});
 r=await post(modify,phys,1,{frequency:"c/6h",reason:"aún es propuesta"},MP(draft));ok(r.status===409,"MODIFY_PROPOSED_409");
 // A10) Physician Control
 const nurse=tok(["NURSE"]);r=await post(modify,nurse,6,{frequency:"c/12h",reason:"enfermería"},MP(ibu));ok(r.status===403,"NURSE_CANNOT_MODIFY_403");
 // A11) replay idempotente de una anotación
 const key=idem();const body=JSON.stringify({frequency:"c/12h",reason:"Mejoría clínica",occurredAt:at()});
 const send=()=>modify.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":key,"if-match":"6"}),body}),MP(ibu) as never);
 r=await send();ok(r.status===201,"MODIFY_AGAIN_201_v7");r=await send();j=await r.json();ok(r.status===200&&j.replayed===true,"MODIFY_REPLAY_200");
 // A12) MISMA llave con una petición DISTINTA -> conflicto (nunca la respuesta del primer cuerpo en silencio)
 r=await modify.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":key,"if-match":"6"}),body:JSON.stringify({frequency:"c/6h",reason:"otra petición con la misma llave",occurredAt:at()})}),MP(ibu) as never);
 j=await r.json();ok(r.status===409&&j.error.code==="IDEMPOTENCY_CONFLICT","SAME_KEY_DIFFERENT_BODY_409");

 // === B) Problema: estado epistémico y evidencia son anotaciones ===
 const pr=crypto.randomUUID();
 r=await probs.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({problemId:pr,patientId:p,code:"E11.9",description:"Diabetes mellitus tipo 2",occurredAt:at()})}));
 ok(r.status===201,"PROBLEM_ADDED_201");
 r=await post(epi,phys,1,{epistemic:"CONFIRMED"},PP(pr));j=await r.json();ok(r.status===201&&j.state==="ACTIVE"&&j.annotation==="EPISTEMIC_CHANGED"&&j.version===2,"EPISTEMIC_201_STATE_UNCHANGED");
 r=await post(evi,phys,2,{evidenceFor:["HbA1c 8.1 %"],confidence:90},PP(pr));j=await r.json();ok(r.status===201&&j.version===3,"EVIDENCE_201_v3");
 r=await post(evi,phys,3,{},PP(pr));ok(r.status===400,"EVIDENCE_EMPTY_400");
 // B1) el problema anotado SIGUE activo para la contraindicación fármaco–condición (antes: salía de la lista)
 r=await post(chronic,phys,3,{},PP(pr));j=await r.json();ok(r.status===201&&j.state==="CHRONIC","CHRONIC_AFTER_ANNOTATIONS_201");
 r=await post(epi,phys,4,{epistemic:"HISTORICAL"},PP(pr));j=await r.json();ok(r.status===201&&j.state==="CHRONIC","ANNOTATION_KEEPS_CHRONIC");

 // === C) Registro de pacientes: corregir un dato NO cambia el estado (AMENDED es anotación en Patient) ===
 const lst=await patientsList.GET(new Request("http://l/",{headers:H(phys)}));const lj=await lst.json();
 ok(lst.status===200&&Array.isArray(lj.patients)&&lj.patients.some((x:{patientId:string;status:string})=>x.patientId===p&&x.status==="ACTIVE"),"PATIENT_LISTED_ACTIVE");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
