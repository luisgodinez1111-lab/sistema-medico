// EPIC AS — Evidencia física: un signo vital CRÍTICO bloquea la firma del encuentro, y crear una obligación
// de seguimiento ligada al vital (sourceVitalId) la DESBLOQUEA (cierra el lazo Zero Lost Follow-Up). vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const vt=await import("../../apps/web/app/api/v1/vitals/route");
const open=await import("../../apps/web/app/api/v1/encounters/route");
const assess=await import("../../apps/web/app/api/v1/encounters/[encounterId]/assessment/route");
const sign=await import("../../apps/web/app/api/v1/encounters/[encounterId]/signature/route");
const obl=await import("../../apps/web/app/api/v1/obligations/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["encounter:write","encounter:read","vital:write","obligation:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const EP=(id:string)=>({params:Promise.resolve({encounterId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
// Auditoría L-03: la firma exige la huella del contenido mostrado (sha256 de `${assessment}\n${plan}`).
const SIGN={contentHash:crypto.createHash("sha256").update("Dx\nPlan").digest("hex")};
const B=(t:string,v:number,body:Record<string,unknown>={})=>new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const phys=tok();await registerPhysicianCredentials(phys);const pat=crypto.randomUUID();await ensurePatientIn(TA,pat); /* L-07 */const vid=crypto.randomUUID();const enc=crypto.randomUUID();
 // 1) signo vital CRÍTICO (crisis hipertensiva) para el paciente
 let r=await vt.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:vid,patientId:pat,vitalType:"BP",value:"190/125",unit:"mmHg",occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).critical===true,"VITAL_CRITICAL_RECORDED");
 // 2) abrir encuentro y llevar a READY_TO_SIGN
 await open.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:enc,patientId:pat,occurredAt:ISO})}));
 r=await assess.POST(B(phys,1,{assessment:"Dx",plan:"Plan"}),EP(enc));ok(r.status===201&&(await r.json()).status==="READY_TO_SIGN","ENCOUNTER_READY");
 // 3) firmar -> BLOQUEADO por el vital crítico sin atender (Zero Lost Follow-Up)
 r=await sign.POST(B(phys,2,SIGN),EP(enc));ok(r.status===403&&(await r.json()).error.code==="SAFETY_BLOCKED","SIGN_BLOCKED_BY_CRITICAL_VITAL_403");
 // 4) atender el vital: obligación de seguimiento ligada (sourceVitalId=vid)
 r=await obl.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:crypto.randomUUID(),patientId:pat,ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+86_400_000).toISOString()/* fecha RELATIVA: una fecha fija acaba venciendo y el gate (L-01) la bloquea */,kind:"CRITICAL_VITAL_FOLLOWUP",sourceVitalId:vid,occurredAt:ISO})}));
 ok(r.status===201,"FOLLOWUP_OBLIGATION_CREATED");
 // 5) firmar de nuevo -> DESBLOQUEADO
 r=await sign.POST(B(phys,2,SIGN),EP(enc));const s=await r.json();ok(r.status===201&&s.status==="SIGNED","SIGN_UNBLOCKED_AFTER_FOLLOWUP_201");
 // 6) control: otro paciente con vital crítico y SIN obligación sigue bloqueado
 const pat2=crypto.randomUUID();await ensurePatientIn(TA,pat2); /* L-07 */const enc2=crypto.randomUUID();
 await vt.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:pat2,vitalType:"SPO2",value:"85",unit:"%",occurredAt:ISO})}));
 await open.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:enc2,patientId:pat2,occurredAt:ISO})}));
 await assess.POST(B(phys,1,{assessment:"Dx",plan:"Plan"}),EP(enc2));
 r=await sign.POST(B(phys,2,SIGN),EP(enc2));ok(r.status===403,"OTHER_PATIENT_STILL_BLOCKED_403");
 // 7) Auditoría L-01 — "atender" el vital con un seguimiento que YA VENCIÓ no desbloquea la firma: el vital deja de contar,
 //    pero el seguimiento vencido y sin resolver es, él mismo, un seguimiento perdido.
 const pat3=crypto.randomUUID();await ensurePatientIn(TA,pat3); /* L-07 */const enc3=crypto.randomUUID();const vid3=crypto.randomUUID();
 await vt.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:vid3,patientId:pat3,vitalType:"BP",value:"190/125",unit:"mmHg",occurredAt:ISO})}));
 await open.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:enc3,patientId:pat3,occurredAt:ISO})}));
 await assess.POST(B(phys,1,{assessment:"Dx",plan:"Plan"}),EP(enc3));
 await obl.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:crypto.randomUUID(),patientId:pat3,ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()-86_400_000).toISOString(),kind:"CRITICAL_VITAL_FOLLOWUP",sourceVitalId:vid3,occurredAt:ISO})}));
 r=await sign.POST(B(phys,2,SIGN),EP(enc3));const b3=await r.json();ok(r.status===403&&/VENCIDO/.test(b3.error.message),"OVERDUE_FOLLOWUP_STILL_BLOCKS_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
