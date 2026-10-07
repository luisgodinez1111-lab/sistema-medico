// EPIC L (Lote L) — Evidencia física del GOLDEN PATH clínico end-to-end (§21 del plan Codex), en UN solo recorrido:
// crear paciente → registrar médico → problema (CIE-10) → alergia que BLOQUEA la prescripción → inactivar → prescribir →
// orden → resultado CRÍTICO → abrir encuentro → la firma se BLOQUEA por el resultado crítico → cerrar el resultado →
// signo vital CRÍTICO → la firma se BLOQUEA por el vital → obligación de seguimiento → FIRMAR el contenido visible →
// exportar el expediente (manifiesto + hash) → aislamiento por tenant. Verifica los invariantes de seguridad de punta a
// punta. RLS-scoped, vs Postgres local desechable.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir en el tenant
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const pb=await import("../../apps/web/app/api/v1/problems/route");
const al=await import("../../apps/web/app/api/v1/allergies/route");
const alInact=await import("../../apps/web/app/api/v1/allergies/[allergyId]/inactivation/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const ord=await import("../../apps/web/app/api/v1/orders/route");
const res=await import("../../apps/web/app/api/v1/results/route");
const resVer=await import("../../apps/web/app/api/v1/results/[resultId]/verification/route");
const resAct=await import("../../apps/web/app/api/v1/results/[resultId]/action/route");
const resClose=await import("../../apps/web/app/api/v1/results/[resultId]/closure/route");
const vt=await import("../../apps/web/app/api/v1/vitals/route");
const enc=await import("../../apps/web/app/api/v1/encounters/route");
const assess=await import("../../apps/web/app/api/v1/encounters/[encounterId]/assessment/route");
const sign=await import("../../apps/web/app/api/v1/encounters/[encounterId]/signature/route");
const obl=await import("../../apps/web/app/api/v1/obligations/route");
const oblComplete=await import("../../apps/web/app/api/v1/obligations/[obligationId]/completion/route");
const exp=await import("../../apps/web/app/api/v1/patients/[patientId]/export/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const SCOPES=["patient:write","patient:read","allergy:write","problem:write","medication:propose","medication:write","order:write","result:write","encounter:read","encounter:write","vital:write","obligation:write","record:export"];
function tok(t:string,scopes=SCOPES){return signSession({sub:crypto.randomUUID(),tenantId:t,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const ISO="2026-09-12T10:00:00.000Z";const idem=()=>crypto.randomUUID();
// El contexto de ruta con la clave que cada ruta espera. Cada `route.ts` declara la suya
// (`{params:Promise<{patientId:string}>}`, `{medicationId}`, …), así que un objeto con clave computada no encaja con
// ninguna firma concreta aunque en ejecución sea exactamente lo que recibe. Se tipa como `never` para que el llamador
// use la firma de su ruta: la conversión está AQUÍ, una vez, en lugar de quince veces repartidas.
const P=(k:string,id:string)=>({params:Promise.resolve({[k]:id})}) as never;
const POST=(t:string,body:Record<string,unknown>,ifm?:number)=>new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),...(ifm!==undefined?{"if-match":String(ifm)}:{})}),body:JSON.stringify(body)});
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Golden path: paciente sintético sin datos para verificar todas las barreras"};
const SIGN={contentHash:crypto.createHash("sha256").update("Dx\nPlan").digest("hex"),occurredAt:ISO}; // L-03: huella del contenido mostrado
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok(TA);await registerPhysicianCredentials(phys);
 const pat=crypto.randomUUID();await ensurePatientIn(TA,pat);

 // 1) PROBLEMA codificado en CIE-10 (dx)
 let r:Response=await pb.POST(POST(phys,{problemId:crypto.randomUUID(),patientId:pat,code:"E11.9",epistemic:"CONFIRMED",occurredAt:ISO}));
 ok(r.status===201,"PROBLEM_ADDED_201");

 // 2) ALERGIA que BLOQUEA la prescripción, luego se inactiva y ya se puede prescribir
 const alg=crypto.randomUUID();
 r=await al.POST(POST(phys,{allergyId:alg,patientId:pat,substance:"amoxicilina",severity:"SEVERE",reaction:"anafilaxia",occurredAt:ISO}));
 ok(r.status===201&&(await r.json()).state==="ACTIVE","ALLERGY_ACTIVE_201");
 const med=crypto.randomUUID();
 await meds.POST(POST(phys,{medicationId:med,patientId:pat,drugCode:"amoxicilina-500",dose:"500mg",route:"VO",frequency:"c/8h",occurredAt:ISO}));
 r=await rx.POST(POST(phys,{occurredAt:ISO,...ACK},1),P("medicationId",med));
 ok(r.status===403,"PRESCRIBE_BLOCKED_BY_ALLERGY_403");
 r=await alInact.POST(POST(phys,{occurredAt:ISO},1),P("allergyId",alg));
 ok(r.status===201,"ALLERGY_INACTIVATED_201");
 r=await rx.POST(POST(phys,{occurredAt:ISO,...ACK},1),P("medicationId",med));
 ok(r.status===201&&(await r.json()).state==="PRESCRIBED","PRESCRIBE_UNBLOCKED_201");

 // 3) ORDEN → RESULTADO CRÍTICO (glucosa de pánico), aún sin cerrar
 const orderId=crypto.randomUUID();
 r=await ord.POST(POST(phys,{orderId,patientId:pat,orderType:"LAB",detail:"Glucosa en ayuno",occurredAt:ISO}));
 ok(r.status===201,"ORDER_CREATED_201");
 const resultId=crypto.randomUUID();
 r=await res.POST(POST(phys,{resultId,patientId:pat,orderId,analyte:"GLUCOSE",value:"520",unit:"mg/dL",occurredAt:ISO}));
 ok(r.status===201&&(await r.json()).critical===true,"RESULT_CRITICAL_RECEIVED_201");

 // 4) ABRIR ENCUENTRO y llevarlo a READY_TO_SIGN
 const encId=crypto.randomUUID();
 await enc.POST(POST(phys,{encounterId:encId,patientId:pat,occurredAt:ISO}));
 r=await assess.POST(POST(phys,{assessment:"Dx",plan:"Plan",occurredAt:ISO},1),P("encounterId",encId));
 ok(r.status===201&&(await r.json()).status==="READY_TO_SIGN","ENCOUNTER_READY_201");

 // 5) FIRMAR → BLOQUEADO por el resultado crítico sin cerrar
 r=await sign.POST(POST(phys,SIGN,2),P("encounterId",encId));let b=await r.json();
 ok(r.status===403&&b.error.code==="SAFETY_BLOCKED"&&/resultado\(s\) crítico/.test(b.error.message),"SIGN_BLOCKED_BY_CRITICAL_RESULT_403");

 // 6) CERRAR el resultado crítico: verificar → accionar (con dueña y fecha futura) → cerrar con evidencia
 r=await resVer.POST(POST(phys,{occurredAt:ISO},1),P("resultId",resultId));ok(r.status===201,"RESULT_VERIFIED_201");
 r=await resAct.POST(POST(phys,{ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+86_400_000).toISOString(),occurredAt:ISO},2),P("resultId",resultId));ok(r.status===201,"RESULT_ACTIONED_201");
 r=await resClose.POST(POST(phys,{evidence:"Paciente contactado; se ajustó tratamiento y se documentó",occurredAt:ISO},3),P("resultId",resultId));ok(r.status===201,"RESULT_CLOSED_201");

 // 7) SIGNO VITAL CRÍTICO (crisis hipertensiva) → la firma se BLOQUEA ahora por el vital
 const vid=crypto.randomUUID();
 r=await vt.POST(POST(phys,{vitalId:vid,patientId:pat,vitalType:"BP",value:"190/125",unit:"mmHg",occurredAt:ISO}));
 ok(r.status===201&&(await r.json()).critical===true,"VITAL_CRITICAL_201");
 r=await sign.POST(POST(phys,SIGN,2),P("encounterId",encId));b=await r.json();
 ok(r.status===403&&/signo\(s\) vital\(es\) crítico/.test(b.error.message),"SIGN_BLOCKED_BY_CRITICAL_VITAL_403");

 // 8) OBLIGACIÓN de seguimiento URGENTE ligada al vital (decisión del dueño: a un vital CRÍTICO solo lo releva un seguimiento
 //    URGENTE) → la urgente abierta sigue bloqueando → RESOLVERLA con evidencia cierra el lazo → FIRMAR el contenido visible.
 const oblVid=crypto.randomUUID();
 r=await obl.POST(POST(phys,{obligationId:oblVid,patientId:pat,ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+86_400_000).toISOString(),kind:"CRITICAL_VITAL_FOLLOWUP",priority:"URGENT",sourceVitalId:vid,occurredAt:ISO}));
 ok(r.status===201,"URGENT_FOLLOWUP_OBLIGATION_201");
 r=await sign.POST(POST(phys,SIGN,2),P("encounterId",encId));ok(r.status===403,"SIGN_STILL_BLOCKED_BY_OPEN_URGENT_201");
 r=await oblComplete.POST(POST(phys,{evidence:"paciente contactado, antihipertensivo IV y en observación con TA 150/95",occurredAt:ISO},1),P("obligationId",oblVid));
 ok(r.status===201||r.status===200,"URGENT_FOLLOWUP_COMPLETED");
 r=await sign.POST(POST(phys,SIGN,2),P("encounterId",encId));const s=await r.json();
 ok(r.status===201&&s.status==="SIGNED"&&s.contentHash===SIGN.contentHash,"ENCOUNTER_SIGNED_201");

 // 9) EXPORTAR el expediente (manifiesto reproducible + hash)
 r=await exp.GET(new Request("http://l/",{headers:H(phys)}),P("patientId",pat));const ex=await r.json();
 ok(r.status===200&&ex.manifest.aggregateCount>0&&ex.manifest.eventCount>0&&typeof ex.contentHash==="string"&&ex.contentHash.length===64,"RECORD_EXPORTED_200");

 // 10) AISLAMIENTO por tenant: otro consultorio no ve el expediente (manifiesto vacío)
 const physB=tok(TB);await registerPhysicianCredentials(physB);
 r=await exp.GET(new Request("http://l/",{headers:H(physB)}),P("patientId",pat));const exB=await r.json();
 ok(r.status===200&&exB.manifest.aggregateCount===0&&exB.manifest.eventCount===0,"TENANT_ISOLATION_EMPTY_EXPORT");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
