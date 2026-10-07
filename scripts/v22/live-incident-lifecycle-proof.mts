// EPIC AG — Evidencia física del reporte de incidentes de seguridad (reportar/revisar/escalar/resolver) contra Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const ic=await import("../../apps/web/app/api/v1/incidents/route");
const rv=await import("../../apps/web/app/api/v1/incidents/[incidentId]/review/route");
const es=await import("../../apps/web/app/api/v1/incidents/[incidentId]/escalation/route");
const rl=await import("../../apps/web/app/api/v1/incidents/[incidentId]/resolution/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["incident:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({incidentId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const{result,ok,fin}=libro();
async function mk(t:string){const id=crypto.randomUUID();const r=await ic.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({incidentId:id,patientId:await freshPatient(TA),category:"MEDICATION_ERROR",severity:"MODERATE",description:"Dosis duplicada",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const nurse=tok(TA);
 // reportar -> revisar -> escalar -> resolver
 let{id,r}=await mk(nurse);ok(r.status===201&&(await r.json()).state==="REPORTED","REPORT_201");
 r=await rv.POST(new Request("http://l/",B(nurse,1)),PP(id));ok(r.status===201&&(await r.json()).state==="UNDER_REVIEW","REVIEW_201");
 r=await es.POST(new Request("http://l/",B(nurse,2,{reason:"Riesgo alto"})),PP(id));ok(r.status===201&&(await r.json()).state==="ESCALATED","ESCALATE_201");
 r=await rl.POST(new Request("http://l/",B(nurse,3,{resolution:"CAPA implementada"})),PP(id));ok(r.status===201&&(await r.json()).state==="RESOLVED","RESOLVE_201");
 // SM: resolver dos veces (terminal) -> 409
 r=await rl.POST(new Request("http://l/",B(nurse,4,{resolution:"x"})),PP(id));ok(r.status===409,"RESOLVE_TERMINAL_409");
 // SM: escalar sin revisar -> 409
 const two=await mk(nurse);
 r=await es.POST(new Request("http://l/",B(nurse,1,{reason:"x"})),PP(two.id));ok(r.status===409,"ESCALATE_WITHOUT_REVIEW_409");
 // resolver directo desde REPORTED
 const three=await mk(nurse);
 r=await rl.POST(new Request("http://l/",B(nurse,1,{resolution:"Falsa alarma"})),PP(three.id));ok(r.status===201&&(await r.json()).state==="RESOLVED","RESOLVE_FROM_REPORTED_201");
 // cross-tenant -> 404
 const nurseB=tok(TB);
 r=await rv.POST(new Request("http://l/",B(nurseB,1)),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope incident:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await ic.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({incidentId:crypto.randomUUID(),patientId:await freshPatient(TA),category:"FALL",severity:"LOW",description:"x",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){fin(e);}
fin();
