// EPIC AC — Evidencia física del worklist poblacional del panel (care gaps de todos los pacientes) contra Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const im=await import("../../apps/web/app/api/v1/immunizations/route");
const ref=await import("../../apps/web/app/api/v1/referrals/route");
const wl=await import("../../apps/web/app/api/v1/worklist/route");
// tenant nuevo y aislado para conteos deterministas
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const SCOPES=["patient:read","immunization:write","referral:write"];
function tok(t:string,scopes=SCOPES){return signSession({sub:crypto.randomUUID(),tenantId:t,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const ISO="2026-07-07T07:00:00.000Z";const idem=()=>crypto.randomUUID();
const P=(t:string,body:Record<string,unknown>)=>new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({...body,occurredAt:ISO})});
const{result,ok,fin}=libro();
try{
 const t=tok(TA);const patX=crypto.randomUUID(),patY=crypto.randomUUID();await ensurePatientIn(TA,patX); /* L-07 */await ensurePatientIn(TA,patY); /* L-07 */
 // paciente X: vacuna DUE (MEDIUM). paciente Y: interconsulta REQUESTED (LOW).
 await im.POST(P(t,{immunizationId:crypto.randomUUID(),patientId:patX,vaccineCode:"SRP",dose:"1"}));
 await ref.POST(P(t,{referralId:crypto.randomUUID(),patientId:patY,specialty:"Cardiología",reason:"Soplo"}));
 let r:Response=await wl.GET(new Request("http://l/",{headers:H(t)}));
 ok(r.status===200,"WORKLIST_200");
 const b=await r.json();const gaps=(b.gaps||[]) as {patientId:string;code:string;priority:string}[];
 ok(b.patientCount===2,"PANEL_TWO_PATIENTS");
 ok(gaps.length===2,"PANEL_TWO_GAPS");
 // MEDIUM (vacuna) antes que LOW (interconsulta)
 ok(gaps[0]!.code==="IMMUNIZATION_DUE"&&gaps[0]!.patientId===patX,"MEDIUM_FIRST");
 ok(gaps[gaps.length-1]!.code==="REFERRAL_UNACCEPTED"&&gaps[gaps.length-1]!.patientId===patY,"LOW_LAST");
 // Auditoría S-08 — la respuesta se pagina (los totales gapCount/patientCount siguen siendo del tenant completo)
 r=await wl.GET(new Request("http://l/?limit=1",{headers:H(t)}));const w1=await r.json();
 ok(r.status===200&&w1.gaps.length===1&&w1.gaps[0].code==="IMMUNIZATION_DUE"&&w1.gapCount===2&&w1.patientCount===2&&typeof w1.nextCursor==="string","WORKLIST_PAGE_1_KEEPS_TOTALS");
 r=await wl.GET(new Request("http://l/?limit=1&cursor="+encodeURIComponent(w1.nextCursor),{headers:H(t)}));const w2=await r.json();
 ok(w2.gaps.length===1&&w2.gaps[0].code==="REFERRAL_UNACCEPTED"&&w2.nextCursor===null,"WORKLIST_PAGE_2_LAST");
 // cross-tenant: tenant B ve su propio panel (vacío), no el de A
 const tB=tok(TB);
 r=await wl.GET(new Request("http://l/",{headers:H(tB)}));
 const bB=await r.json();
 ok(r.status===200&&!((bB.gaps||[]) as {patientId:string}[]).some(g=>g.patientId===patX||g.patientId===patY),"CROSS_TENANT_ISOLATED");
 // sin scope patient:read -> 403
 const noScope=tok(TA,["immunization:write"]);
 r=await wl.GET(new Request("http://l/",{headers:H(noScope)}));
 ok(r.status===403,"MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
