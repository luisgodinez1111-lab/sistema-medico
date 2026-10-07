// EPIC AB — Evidencia física del export del expediente (manifiesto + hash reproducible, RLS) contra Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const ref=await import("../../apps/web/app/api/v1/referrals/route");
const im=await import("../../apps/web/app/api/v1/immunizations/route");
const adm=await import("../../apps/web/app/api/v1/immunizations/[immunizationId]/administration/route");
const exp=await import("../../apps/web/app/api/v1/patients/[patientId]/export/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const SCOPES=["record:export","referral:write","immunization:write"];
function tok(t:string,scopes=SCOPES){return signSession({sub:crypto.randomUUID(),tenantId:t,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const TP=(id:string)=>({params:Promise.resolve({patientId:id})});const IP=(id:string)=>({params:Promise.resolve({immunizationId:id})});const ISO="2026-07-07T07:00:00.000Z";const idem=()=>crypto.randomUUID();
const P=(t:string,body:Record<string,unknown>)=>new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({...body,occurredAt:ISO})});
const{result,ok,fin}=libro();
try{
 const t=tok(TA);const pat=crypto.randomUUID();await ensurePatientIn(TA,pat); /* L-07 */
 // dos agregados con varios eventos: interconsulta (1) + vacuna (2: DUE->ADMINISTERED)
 await ref.POST(P(t,{referralId:crypto.randomUUID(),patientId:pat,specialty:"Cardiología",reason:"Soplo"}));
 const iid=crypto.randomUUID();
 await im.POST(P(t,{immunizationId:iid,patientId:pat,vaccineCode:"SRP",dose:"1"}));
 await adm.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({lot:"L-1",site:"deltoides",occurredAt:ISO})}),IP(iid));
 // export
 let r:Response=await exp.GET(new Request("http://l/",{headers:H(t)}),TP(pat));
 ok(r.status===200,"EXPORT_200");
 const b1=await r.json();
 ok(b1.manifest.aggregateCount===2,"MANIFEST_2_AGGREGATES");
 ok(b1.manifest.eventCount===3,"MANIFEST_3_EVENTS");
 ok(typeof b1.contentHash==="string"&&b1.contentHash.length===64,"CONTENT_HASH_SHA256");
 // reproducibilidad: segunda exportación -> mismo hash (aunque generatedAt cambie)
 r=await exp.GET(new Request("http://l/",{headers:H(t)}),TP(pat));
 const b2=await r.json();
 ok(b2.contentHash===b1.contentHash,"HASH_REPRODUCIBLE");
 ok(b2.generatedAt!==undefined,"HAS_GENERATED_AT");
 // cross-tenant: tenant B exporta y obtiene expediente vacío + hash distinto
 const tB=tok(TB);
 r=await exp.GET(new Request("http://l/",{headers:H(tB)}),TP(pat));
 const bB=await r.json();
 ok(r.status===200&&bB.manifest.aggregateCount===0,"CROSS_TENANT_EMPTY");
 ok(bB.contentHash!==b1.contentHash,"CROSS_TENANT_DIFFERENT_HASH");
 // sin scope record:export -> 403
 const noScope=tok(TA,["patient:read"]);
 r=await exp.GET(new Request("http://l/",{headers:H(noScope)}),TP(pat));
 ok(r.status===403,"MISSING_EXPORT_SCOPE_403");
}catch(e){fin(e);}
fin();
