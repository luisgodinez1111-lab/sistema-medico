// EPIC AM — Evidencia física de la codificación CIE-10 (validación + descripción canónica + búsqueda) contra Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const pr=await import("../../apps/web/app/api/v1/problems/route");
const tm=await import("../../apps/web/app/api/v1/terminology/icd10/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:read","problem:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const{result,ok,fin}=libro();
try{
 const phys=tok();
 // agregar problema con código CIE-10 válido -> se codifica con descripción canónica (aunque no mande description)
 let r:Response=await pr.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:await freshPatient(TA),code:"e11",occurredAt:ISO})}));
 const okBody=await r.json();
 ok(r.status===201,"PROBLEM_CODED_201");
 ok(okBody.code==="E11"&&okBody.description==="Diabetes mellitus tipo 2"&&okBody.codeSystem==="ICD-10","CANONICAL_DESCRIPTION_ATTACHED");
 // código inválido -> 400 VALIDATION_ERROR
 r=await pr.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:await freshPatient(TA),code:"NOPE.123",occurredAt:ISO})}));
 const bad=await r.json();
 ok(r.status===400&&bad.error.code==="VALIDATION_ERROR","INVALID_CODE_400");
 // búsqueda de terminología por texto
 r=await tm.GET(new Request("http://l/api/v1/terminology/icd10?q=diabetes",{headers:H(phys)}));
 const s=await r.json();
 ok(r.status===200&&Array.isArray(s.results)&&s.results.some((e:{code:string})=>e.code==="E11"),"SEARCH_FINDS_DIABETES");
 // lookup por código exacto
 r=await tm.GET(new Request("http://l/api/v1/terminology/icd10?code=I10",{headers:H(phys)}));
 const l=await r.json();
 ok(r.status===200&&l.valid===true&&l.entry.description==="Hipertensión esencial (primaria)","LOOKUP_VALID");
 // sin scope patient:read -> 403
 const noScope=tok(["problem:write"]);
 r=await tm.GET(new Request("http://l/api/v1/terminology/icd10?q=x",{headers:H(noScope)}));
 ok(r.status===403,"MISSING_READ_SCOPE_403");
}catch(e){fin(e);}
fin();
