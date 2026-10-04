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
const vAmend=await import("../../apps/web/app/api/v1/vitals/[vitalId]/amendment/route");
const vErr=await import("../../apps/web/app/api/v1/vitals/[vitalId]/error-mark/route");
const oblCancel=await import("../../apps/web/app/api/v1/obligations/[obligationId]/cancellation/route");
const oblComplete=await import("../../apps/web/app/api/v1/obligations/[obligationId]/completion/route");
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
 // 4) atender el vital crítico: DECISIÓN DEL DUEÑO — a un vital CRÍTICO solo lo releva un seguimiento URGENTE; un recordatorio
 //    de rutina ya no basta (antes CUALQUIER obligación abierta lo vaciaba, y ROUTINE no bloquea → se firmaba sobre la crisis).
 //    Crear la URGENTE releva el gate del vital, pero la propia obligación urgente ABIERTA bloquea la firma hasta resolverse.
 const oblU=crypto.randomUUID();const OPU={params:Promise.resolve({obligationId:oblU})};
 r=await obl.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:oblU,patientId:pat,ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+86_400_000).toISOString()/* fecha RELATIVA: una fecha fija acaba venciendo y el gate (L-01) la bloquea */,kind:"CRITICAL_VITAL_FOLLOWUP",priority:"URGENT",sourceVitalId:vid,occurredAt:ISO})}));
 ok(r.status===201,"URGENT_FOLLOWUP_OBLIGATION_CREATED");
 // 5) firmar -> AÚN BLOQUEADO: la obligación urgente abierta es, ella misma, un pendiente crítico (Zero Lost Follow-Up).
 r=await sign.POST(B(phys,2,SIGN),EP(enc));ok(r.status===403,"SIGN_STILL_BLOCKED_BY_OPEN_URGENT_FOLLOWUP_403");
 // 5b) resolver la obligación URGENTE con evidencia -> AHORA sí se desbloquea (el vital ya no cuenta y la urgente dejó de bloquear).
 r=await oblComplete.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({evidence:"paciente contactado, antihipertensivo IV y en observación con TA 150/95",occurredAt:ISO})}),OPU);
 ok(r.status===201||r.status===200,"URGENT_FOLLOWUP_COMPLETED");
 r=await sign.POST(B(phys,2,SIGN),EP(enc));const s=await r.json();ok(r.status===201&&s.status==="SIGNED","SIGN_UNBLOCKED_AFTER_URGENT_FOLLOWUP_RESOLVED_201");
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

 // === Auditoría multi-agente (gate de firma) — tres cierres de hueco en countOpenCriticalVitals ===
 const VP=(id:string)=>({params:Promise.resolve({vitalId:id})});const OP=(id:string)=>({params:Promise.resolve({obligationId:id})});

 // 8) Una obligación de seguimiento URGENTE CANCELADA ya no "limpia" el vital crítico: crear y cancelar NO debe vaciar el gate
 //    (URGENTE para que el relevo SERÍA posible de no cancelarse; cancelada, el vital vuelve a contar).
 const pat8=crypto.randomUUID();await ensurePatientIn(TA,pat8);const vid8=crypto.randomUUID(),enc8=crypto.randomUUID(),obl8=crypto.randomUUID();
 await vt.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:vid8,patientId:pat8,vitalType:"BP",value:"190/125",unit:"mmHg",occurredAt:ISO})}));
 await open.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:enc8,patientId:pat8,occurredAt:ISO})}));
 await assess.POST(B(phys,1,{assessment:"Dx",plan:"Plan"}),EP(enc8));
 await obl.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:obl8,patientId:pat8,ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+86_400_000).toISOString(),kind:"CRITICAL_VITAL_FOLLOWUP",priority:"URGENT",sourceVitalId:vid8,occurredAt:ISO})}));
 await oblCancel.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"creada por error, se cancela",occurredAt:ISO})}),OP(obl8));
 r=await sign.POST(B(phys,2,SIGN),EP(enc8));ok(r.status===403&&(await r.json()).error.code==="SAFETY_BLOCKED","CANCELLED_FOLLOWUP_DOES_NOT_CLEAR_CRITICAL_VITAL_403");

 // 9) Un vital crítico ENMENDADO a un valor NORMAL deja de bloquear (el gate mira el valor VIGENTE, no el original).
 const pat9=crypto.randomUUID();await ensurePatientIn(TA,pat9);const vid9=crypto.randomUUID(),enc9=crypto.randomUUID();
 await vt.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:vid9,patientId:pat9,vitalType:"BP",value:"190/125",unit:"mmHg",occurredAt:ISO})}));
 await open.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:enc9,patientId:pat9,occurredAt:ISO})}));
 await assess.POST(B(phys,1,{assessment:"Dx",plan:"Plan"}),EP(enc9));
 r=await sign.POST(B(phys,2,SIGN),EP(enc9));ok(r.status===403,"AMEND_CASE_BLOCKED_BEFORE");
 await vAmend.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({value:"120/80",unit:"mmHg",reason:"relectura: cifra correcta tras recalibrar",occurredAt:ISO})}),VP(vid9));
 r=await sign.POST(B(phys,2,SIGN),EP(enc9));ok(r.status===201&&(await r.json()).status==="SIGNED","AMENDED_TO_NORMAL_UNBLOCKS_SIGN_201");

 // 10) Un vital crítico marcado por error (ENTERED_IN_ERROR) deja de bloquear (dato retractado: no existe para el gate).
 const pat10=crypto.randomUUID();await ensurePatientIn(TA,pat10);const vid10=crypto.randomUUID(),enc10=crypto.randomUUID();
 await vt.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:vid10,patientId:pat10,vitalType:"SPO2",value:"80",unit:"%",occurredAt:ISO})}));
 await open.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:enc10,patientId:pat10,occurredAt:ISO})}));
 await assess.POST(B(phys,1,{assessment:"Dx",plan:"Plan"}),EP(enc10));
 r=await sign.POST(B(phys,2,SIGN),EP(enc10));ok(r.status===403,"ERROR_CASE_BLOCKED_BEFORE");
 await vErr.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"captura equivocada: era de otro paciente",occurredAt:ISO})}),VP(vid10));
 r=await sign.POST(B(phys,2,SIGN),EP(enc10));ok(r.status===201&&(await r.json()).status==="SIGNED","ENTERED_IN_ERROR_UNBLOCKS_SIGN_201");

 // 11) DECISIÓN DEL DUEÑO (vital crítico ⇒ seguimiento URGENTE): un seguimiento ROUTINE del vital —NO vencido— NO lo releva.
 //     El seguimiento de rutina ni vacía el gate del vital ni bloquea por sí mismo; sin él sería una firma sobre la crisis.
 const pat11=crypto.randomUUID();await ensurePatientIn(TA,pat11);const vid11=crypto.randomUUID(),enc11=crypto.randomUUID();
 await vt.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:vid11,patientId:pat11,vitalType:"BP",value:"190/125",unit:"mmHg",occurredAt:ISO})}));
 await open.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:enc11,patientId:pat11,occurredAt:ISO})}));
 await assess.POST(B(phys,1,{assessment:"Dx",plan:"Plan"}),EP(enc11));
 await obl.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:crypto.randomUUID(),patientId:pat11,ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+86_400_000).toISOString(),kind:"CRITICAL_VITAL_FOLLOWUP",priority:"ROUTINE",sourceVitalId:vid11,occurredAt:ISO})}));
 r=await sign.POST(B(phys,2,SIGN),EP(enc11));const b11=await r.json();ok(r.status===403&&/vital/i.test(b11.error.message),"ROUTINE_FOLLOWUP_DOES_NOT_CLEAR_CRITICAL_VITAL_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
