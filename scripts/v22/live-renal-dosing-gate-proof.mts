// EPIC BM — Evidencia física: el gate renal por eGFR MEDIDO bloquea fármacos contraindicados por función
// renal en la prescripción (metformina/AINE con TFG<30). Cross-vertical medicación←creatinina+demografía. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","result:write","medication:propose","medication:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});const ISO=new Date(Date.now()-3_600_000).toISOString()/* reloj RELATIVO: la creatinina obsoleta ya no se usa para el eGFR */;const idem=()=>crypto.randomUUID();
const{result,ok,fin}=libro();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function register(t:string,p:string,y:number){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:birth(y),sexAtBirth:"MALE",occurredAt:ISO})}));}
async function creat(t:string,p:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:"CREATININE",value:v,unit:"mg/dL",occurredAt:ISO})}));}
const order={dose:"850mg",route:"VO",frequency:"c/12h"};
async function propose(t:string,p:string,drugCode:string,o=order){const id=crypto.randomUUID();await meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:p,drugCode,...o,occurredAt:ISO})}));return id;}
const B=(t:string,extra:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO,...extra})});
try{
 const phys=tok();await registerPhysicianCredentials(phys);
 // 1) hombre 70a con creatinina 4.0 -> TFG ~15 (<30): metformina BLOQUEADA 403
 const p1=crypto.randomUUID();await register(phys,p1,70);await creat(phys,p1,"4.0");
 const mf=await propose(phys,p1,"metformina-850");
 let r:Response=await rx.POST(new Request("http://l/",B(phys)),MP(mf));ok(r.status===403&&(await r.json()).error.code==="SAFETY_BLOCKED","METFORMIN_LOW_EGFR_BLOCKED_403");
 // 2) mismo paciente: AINE (ibuprofeno) también contraindicado con TFG<30 -> BLOQUEADO
 const ib=await propose(phys,p1,"ibuprofeno-400",{dose:"400mg",route:"VO",frequency:"c/8h"});
 r=await rx.POST(new Request("http://l/",B(phys)),MP(ib));ok(r.status===403,"NSAID_LOW_EGFR_BLOCKED_403");
 // 3) hombre 40a con creatinina 0.9 -> TFG normal: metformina PERMITIDA 201
 const p2=crypto.randomUUID();await register(phys,p2,40);await creat(phys,p2,"0.9");
 const mf2=await propose(phys,p2,"metformina-850");
 r=await rx.POST(new Request("http://l/",B(phys)),MP(mf2));ok(r.status===201,"METFORMIN_NORMAL_EGFR_ALLOWED_201");
 // 4) Auditoría C-05 — sin creatinina la barrera renal NO se pudo evaluar. Antes: 201 silencioso ("fail-open" presentado como
 //    seguro). Ahora: 428 SAFETY_ACK_REQUIRED nombrando la barrera; sin justificación suficiente 400; con confirmación 201.
 const p3=crypto.randomUUID();await register(phys,p3,40);
 const mf3=await propose(phys,p3,"metformina-850");
 r=await rx.POST(new Request("http://l/",B(phys)),MP(mf3));let j=await r.json();
 ok(r.status===428&&j.error.code==="SAFETY_ACK_REQUIRED","NO_EGFR_REQUIRES_ACK_428");
 r=await rx.POST(new Request("http://l/",B(phys,{acknowledgeUnverified:true,unverifiedJustification:"ok"})),MP(mf3));ok(r.status===400,"ACK_WITHOUT_JUSTIFICATION_400");
 r=await rx.POST(new Request("http://l/",B(phys,{acknowledgeUnverified:true,unverifiedJustification:"Sin creatinina disponible; se solicita hoy y se revalora en 72 h"})),MP(mf3));j=await r.json();
 ok(r.status===201&&j.state==="PRESCRIBED","NO_EGFR_ACKNOWLEDGED_201");
 // 4b) la confirmación NO levanta un BLOQUEO: metformina con TFG<30 sigue en 403 aunque el médico "confirme"
 const mfBlocked=await propose(phys,p1,"metformina-850");
 r=await rx.POST(new Request("http://l/",B(phys,{acknowledgeUnverified:true,unverifiedJustification:"Intento de saltar el bloqueo con confirmación"})),MP(mfBlocked));ok(r.status===403,"ACK_DOES_NOT_OVERRIDE_BLOCK_403");
 // 5) amoxicilina (sin regla renal) con TFG baja -> PERMITIDA
 const am=await propose(phys,p1,"amoxicilina-500",{dose:"500mg",route:"VO",frequency:"c/8h"});
 r=await rx.POST(new Request("http://l/",B(phys)),MP(am));ok(r.status===201,"NONRENAL_DRUG_ALLOWED_201");
}catch(e){fin(e);}
fin();
