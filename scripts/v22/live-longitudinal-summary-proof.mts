// EPIC P+ — Evidencia física de que el resumen longitudinal integra los verticales S–Z contra Neon:
// se crean ítems de varios verticales para UN paciente, se lee su timeline y summarizePatient los cuenta.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-p-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{summarizePatient}=await import("../../packages/patient-summary/src");
const ref=await import("../../apps/web/app/api/v1/referrals/route");
const ap=await import("../../apps/web/app/api/v1/appointments/route");
const im=await import("../../apps/web/app/api/v1/immunizations/route");
const cp=await import("../../apps/web/app/api/v1/care-plans/route");
const cl=await import("../../apps/web/app/api/v1/claims/route");
const co=await import("../../apps/web/app/api/v1/consents/route");
const timeline=await import("../../apps/web/app/api/v1/patients/[patientId]/timeline/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const SCOPES=["patient:read","referral:write","appointment:write","immunization:write","careplan:write","billing:write","consent:write"];
function tok(scopes=SCOPES){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const TP=(id:string)=>({params:Promise.resolve({patientId:id})});const ISO="2026-07-07T07:00:00.000Z";const idem=()=>crypto.randomUUID();
const P=(t:string,body:Record<string,unknown>)=>new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({...body,occurredAt:ISO})});
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const t=tok();const pat=crypto.randomUUID();
 await ref.POST(P(t,{referralId:crypto.randomUUID(),patientId:pat,specialty:"Cardiología",reason:"Soplo"}));
 await ap.POST(P(t,{appointmentId:crypto.randomUUID(),patientId:pat,startAt:"2026-09-20T15:00:00.000Z",reason:"Control"}));
 await im.POST(P(t,{immunizationId:crypto.randomUUID(),patientId:pat,vaccineCode:"SRP",dose:"1"}));
 await cp.POST(P(t,{carePlanId:crypto.randomUUID(),patientId:pat,category:"DIABETES",goal:"HbA1c<7%"}));
 await cl.POST(P(t,{claimId:crypto.randomUUID(),patientId:pat,amount:"1500.00",currency:"MXN"}));
 await co.POST(P(t,{consentId:crypto.randomUUID(),patientId:pat,scopeType:"PROCEDURE",documentRef:"CI-1"}));
 // Leer timeline del paciente y proyectar el resumen
 const r=await timeline.GET(new Request("http://l/",{headers:H(t)}),TP(pat));
 ok(r.status===200,"TIMELINE_200");
 const items=((await r.json()).items||[]) as {aggregateType:string;latestKind:string}[];
 ok(items.length===6,"TIMELINE_HAS_6_VERTICALS");
 const s=summarizePatient(items);
 ok(s.openReferrals===1,"SUMMARY_REFERRAL");
 ok(s.upcomingAppointments===1,"SUMMARY_APPOINTMENT");
 ok(s.pendingImmunizations===1,"SUMMARY_IMMUNIZATION");
 ok(s.activeCarePlans===0,"SUMMARY_CAREPLAN_PROPOSED_NOT_ACTIVE"); // aún PROPOSED, no ACTIVE
 ok(s.openClaims===1,"SUMMARY_CLAIM");
 ok(s.grantedConsents===0,"SUMMARY_CONSENT_DRAFTED_NOT_GRANTED"); // aún DRAFTED, no GRANTED
 ok(s.totalItems===6,"SUMMARY_TOTAL_6");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
