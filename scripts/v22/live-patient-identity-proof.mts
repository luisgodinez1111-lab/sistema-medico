// Auditoría 2026-09-19 (L-06) — PRUEBA EN VIVO contra PostgreSQL real: identidad robusta del paciente.
//   · la CURP se valida (formato, dígito verificador, coherencia con nacimiento y sexo): 400 con `curpIssue`;
//   · duplicados: misma CURP -> 409 SIEMPRE (aunque se "confirme"); mismo nombre + misma fecha de nacimiento -> 409 salvo
//     confirmNotDuplicate:true, y la confirmación queda en el evento; el reintento idempotente del alta no es duplicado;
//   · menor de edad sin tutor: el alta avisa (warnings) y el consentimiento responde 428 GUARDIAN_REQUIRED; con tutor
//     registrado por enmienda y signerRole GUARDIAN se concede y el evento lleva al tutor; un menor no firma como PATIENT;
//   · una enmienda no puede reasignar la CURP de otro paciente (409).
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"l06-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{resolveVerified}=await import("../../apps/web/lib/http-command");
const{readAggregateEvents}=await import("../../apps/web/lib/clinical-runtime");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const amend=await import("../../apps/web/app/api/v1/patients/[patientId]/amendment/route");
const co=await import("../../apps/web/app/api/v1/consents/route");
const pre=await import("../../apps/web/app/api/v1/consents/[consentId]/presentation/route");
const gr=await import("../../apps/web/app/api/v1/consents/[consentId]/grant/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes:["patient:write","patient:read","consent:write"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const ISO="2026-09-22T15:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
type Err={error:{code:string;message:string;details?:{curpIssue?:string;duplicateOf?:string;duplicateBy?:string;reason?:string}}};
const reg=(t:string,body:Record<string,unknown>,key=idem())=>patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":key}),body:JSON.stringify({occurredAt:ISO,...body})}));
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});const CP=(id:string)=>({params:Promise.resolve({consentId:id})});
try{
 const phys=tok();const ctx=resolveVerified(new Request("http://l/",{headers:H(phys)})).ctx;
 // 1) CURP inválida (dígito verificador) -> 400 con curpIssue; CURP incoherente con el sexo -> 400
 let r=await reg(phys,{patientId:crypto.randomUUID(),name:"Gloria Hernández García",birthDate:"1956-04-27",sexAtBirth:"FEMALE",curp:"HEGG560427MVZRRL05"});
 let e=await r.json() as Err;ok(r.status===400&&e.error.details?.curpIssue==="CHECK_DIGIT","CURP_CHECK_DIGIT_400");
 r=await reg(phys,{patientId:crypto.randomUUID(),name:"Gloria Hernández García",birthDate:"1956-04-27",sexAtBirth:"MALE",curp:"HEGG560427MVZRRL04"});
 e=await r.json() as Err;ok(r.status===400&&e.error.details?.curpIssue==="SEX_MISMATCH","CURP_SEX_MISMATCH_400");
 // 2) CURP válida -> 201; misma CURP con otro id -> 409 por CURP aunque se "confirme"; reintento idempotente -> 200 (no es duplicado)
 const p1=crypto.randomUUID();const k1=idem();
 r=await reg(phys,{patientId:p1,name:"Gloria Hernández García",birthDate:"1956-04-27",sexAtBirth:"FEMALE",curp:"hegg560427mvzrrl04"},k1);ok(r.status===201,"VALID_CURP_201");
 r=await reg(phys,{patientId:crypto.randomUUID(),name:"Gloria H. García",birthDate:"1956-04-27",sexAtBirth:"FEMALE",curp:"HEGG560427MVZRRL04",confirmNotDuplicate:true});
 e=await r.json() as Err;ok(r.status===409&&e.error.details?.duplicateBy==="CURP"&&e.error.details.duplicateOf===p1,"SAME_CURP_409_EVEN_IF_CONFIRMED");
 r=await reg(phys,{patientId:p1,name:"Gloria Hernández García",birthDate:"1956-04-27",sexAtBirth:"FEMALE",curp:"hegg560427mvzrrl04"},k1);ok(r.status===200&&(await r.json()).replayed===true,"IDEMPOTENT_RETRY_NOT_DUPLICATE");
 // 3) mismo nombre (con otra acentuación y espacios) + misma fecha, sin CURP -> 409; con confirmNotDuplicate -> 201 y consta en el evento
 r=await reg(phys,{patientId:crypto.randomUUID(),name:"  gloria hernandez  garcia ",birthDate:"1956-04-27",sexAtBirth:"FEMALE"});
 e=await r.json() as Err;ok(r.status===409&&e.error.details?.duplicateBy==="NAME_BIRTHDATE"&&e.error.details.duplicateOf===p1,"SAME_NAME_BIRTHDATE_409");
 const p2=crypto.randomUUID();
 r=await reg(phys,{patientId:p2,name:"Gloria Hernández García",birthDate:"1956-04-27",sexAtBirth:"FEMALE",confirmNotDuplicate:true});ok(r.status===201,"HOMONYM_CONFIRMED_201");
 ok((await readAggregateEvents(ctx,p2))[0]!.payload["confirmedNotDuplicate"]===true,"CONFIRMATION_RECORDED_IN_EVENT");
 // 4) menor sin tutor: alta con aviso; consentimiento -> 428 GUARDIAN_REQUIRED
 const child=crypto.randomUUID();
 r=await reg(phys,{patientId:child,name:"Emilia Prueba Niña",birthDate:"2016-05-01",sexAtBirth:"FEMALE"});
 const cb=await r.json() as{isMinor:boolean;warnings?:string[]};ok(r.status===201&&cb.isMinor===true&&cb.warnings?.includes("MINOR_WITHOUT_GUARDIAN")===true,"MINOR_REGISTERED_WITH_WARNING");
 const c1=crypto.randomUUID();
 r=await co.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({consentId:c1,patientId:child,scopeType:"PROCEDURE",documentRef:"CI-PROC-01",occurredAt:ISO})}));ok(r.status===201,"CONSENT_DRAFTED");
 r=await pre.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),CP(c1));ok(r.status===201,"CONSENT_PRESENTED");
 r=await gr.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({signerName:"Emilia Prueba Niña",occurredAt:ISO})}),CP(c1));
 e=await r.json() as Err;ok(r.status===428&&e.error.details?.reason==="GUARDIAN_REQUIRED","MINOR_CONSENT_WITHOUT_GUARDIAN_428");
 // 5) enmienda registra al tutor; el menor no firma como PATIENT; el tutor sí, y consta en el evento
 r=await amend.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({guardian:{name:"Laura Prueba Madre",relationship:"madre",phone:"55 0000 0000"},occurredAt:ISO})}),PP(child));ok(r.status===200||r.status===201,"GUARDIAN_AMENDED");
 r=await gr.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({signerName:"Emilia Prueba Niña",signerRole:"PATIENT",occurredAt:ISO})}),CP(c1));ok(r.status===400,"MINOR_CANNOT_SIGN_AS_PATIENT_400");
 r=await gr.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({signerName:"Laura Prueba Madre",signerRole:"GUARDIAN",occurredAt:ISO})}),CP(c1));ok(r.status===201,"GUARDIAN_CONSENT_201");
 const granted=(await readAggregateEvents(ctx,c1)).find(x=>x.payload["kind"]==="GRANTED")?.payload as{guardian?:{name:string;relationship:string};signerRole?:string}|undefined;
 ok(granted?.signerRole==="GUARDIAN"&&granted.guardian?.name==="Laura Prueba Madre"&&granted.guardian.relationship==="madre","CONSENT_EVENT_CARRIES_GUARDIAN");
 // 6) una enmienda no reasigna la CURP de otro paciente
 r=await amend.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({curp:"HEGG560427MVZRRL04",birthDate:"1956-04-27",sexAtBirth:"FEMALE",occurredAt:ISO})}),PP(p2));
 e=await r.json() as Err;ok(r.status===409&&e.error.details?.duplicateBy==="CURP","AMEND_CANNOT_STEAL_CURP_409");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
