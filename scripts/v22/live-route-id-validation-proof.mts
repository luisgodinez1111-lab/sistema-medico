// Hallazgo D8 del lote 11 — Evidencia física: un id de ruta que no es UUID responde 404 NOT_FOUND tras autenticar y
// autorizar, en lecturas y escrituras, sin llegar a PostgreSQL. Antes `GET /patients/not-a-uuid/egfr` respondía 500 INTERNAL
// (22P02 de la base) y `…/timeline` un 200 vacío. La precedencia se conserva: sin sesión sigue siendo 401. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"d8-route-id-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const egfrR=await import("../../apps/web/app/api/v1/patients/[patientId]/egfr/route");
const tlR=await import("../../apps/web/app/api/v1/patients/[patientId]/timeline/route");
const refR=await import("../../apps/web/app/api/v1/allergies/[allergyId]/refutation/route");
const docR=await import("../../apps/web/app/api/v1/documents/[documentId]/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const tok=()=>signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes:["patient:read","allergy:write","document:read"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(t:string|null,x:Record<string,string>={}){return{"content-type":"application/json",...(t?{authorization:"Bearer "+t}:{}),...x};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const BAD="not-a-uuid";
async function notFound(r:Response){return r.status===404&&((await r.json()) as{error?:{code?:string}}).error?.code==="NOT_FOUND";}
try{
 const t=tok();
 ok(await notFound(await egfrR.GET(new Request("http://l/",{headers:H(t)}),{params:Promise.resolve({patientId:BAD})})),"EGFR_BAD_ID_404_NOT_500");
 ok(await notFound(await tlR.GET(new Request("http://l/",{headers:H(t)}),{params:Promise.resolve({patientId:BAD})})),"TIMELINE_BAD_ID_404_NOT_EMPTY_200");
 ok(await notFound(await refR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({occurredAt:new Date().toISOString()})}),{params:Promise.resolve({allergyId:BAD})})),"WRITE_BAD_ID_404");
 ok(await notFound(await docR.GET(new Request("http://l/",{headers:H(t)}),{params:Promise.resolve({documentId:BAD})})),"DOCUMENT_BAD_ID_404");
 // Precedencia intacta: sin sesión, 401 aunque el id sea inválido; un UUID válido sin datos sigue siendo una lectura normal.
 ok((await egfrR.GET(new Request("http://l/",{headers:H(null)}),{params:Promise.resolve({patientId:BAD})})).status===401,"ANONYMOUS_STILL_401");
 ok((await tlR.GET(new Request("http://l/",{headers:H(t)}),{params:Promise.resolve({patientId:crypto.randomUUID()})})).status===200,"VALID_UUID_UNCHANGED");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
