// Hallazgo D8 (porte a main) — Evidencia física: un id de ruta que no es UUID responde el contrato de main (R04-007): 400
// VALIDATION_ERROR, en lecturas y escrituras, sin llegar a PostgreSQL. En main, 100 rutas llamaban a `pathIds` fuera de un `try`:
// su VALIDATION_ERROR escapaba del handler (Next responde un 500 sin cuerpo). Además, un id con espacios alrededor pasaba `isUuid`
// (que recorta) y llegaba a la columna uuid (22P02 -> 500), y `GET /encounters?encounterId=` consultaba la base con cualquier
// cadena (22P02 -> 500; el porte D4 lo dejó en 404 NOT_FOUND, que aquí se fija). Precedencia de main: `pathIds` valida ANTES de autenticar (decisión R04-007; ver openIssues del porte).
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET; // R11-07: lo fija el prólogo _live-env (aleatorio por corrida si no viene del entorno)
const{signSession}=await import("../../packages/session/src");
const egfrR=await import("../../apps/web/app/api/v1/patients/[patientId]/egfr/route");
const tlR=await import("../../apps/web/app/api/v1/patients/[patientId]/timeline/route");
const refR=await import("../../apps/web/app/api/v1/allergies/[allergyId]/refutation/route");
const docR=await import("../../apps/web/app/api/v1/documents/[documentId]/route");
const encR=await import("../../apps/web/app/api/v1/encounters/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const tok=()=>signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes:["patient:read","allergy:write","document:read","encounter:read"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(t:string|null,x:Record<string,string>={}){return{"content-type":"application/json",...(t?{authorization:"Bearer "+t}:{}),...x};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const BAD="not-a-uuid";
// Contrato de main: exactamente 400 VALIDATION_ERROR (un único código exacto; ni 404 ni 500). Un handler que LANZA no responde.
async function invalidId(p:Promise<Response>){try{const r=await p;return r.status===400&&((await r.json().catch(()=>({}))) as{error?:{code?:string}}).error?.code==="VALIDATION_ERROR";}catch{return false;}}
try{
 const t=tok();
 ok(await invalidId(egfrR.GET(new Request("http://l/",{headers:H(t)}),{params:Promise.resolve({patientId:BAD})})),"EGFR_BAD_ID_400_NOT_500");
 ok(await invalidId(tlR.GET(new Request("http://l/",{headers:H(t)}),{params:Promise.resolve({patientId:BAD})})),"TIMELINE_BAD_ID_400_NOT_EMPTY_200");
 ok(await invalidId(refR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":crypto.randomUUID(),"if-match":"1"}),body:JSON.stringify({occurredAt:new Date().toISOString()})}),{params:Promise.resolve({allergyId:BAD})})),"WRITE_BAD_ID_400");
 ok(await invalidId(docR.GET(new Request("http://l/",{headers:H(t)}),{params:Promise.resolve({documentId:BAD})})),"DOCUMENT_BAD_ID_400");
 // Huecos que quedaban en main: id con espacios alrededor (isUuid recorta, la columna uuid no) e id de la query de /encounters.
 ok(await invalidId(egfrR.GET(new Request("http://l/",{headers:H(t)}),{params:Promise.resolve({patientId:` ${crypto.randomUUID()} `})})),"WHITESPACE_PADDED_ID_400_NOT_500");
 // El id de la QUERY no es un id de ruta: contrato fijado por el porte D4 (live-aggregate-kernel-race-proof): 404 NOT_FOUND exacto.
 const eq=await encR.GET(new Request(`http://l/api/v1/encounters?encounterId=${BAD}`,{headers:H(t)}));
 ok(eq.status===404&&((await eq.json().catch(()=>({}))) as{error?:{code?:string}}).error?.code==="NOT_FOUND","ENCOUNTER_QUERY_BAD_ID_404_NOT_500");
 // Precedencia de main (R04-007): sin sesión, un UUID válido es 401; un id malformado es 400 sin tocar nada (pathIds va primero).
 // El check original de la rama (anónimo + id inválido -> 401) NO se cumple en main por decisión de contrato: se sustituye por
 // estos dos checks estrictos (ver openIssues), sin aceptar «400 o 401».
 ok((await egfrR.GET(new Request("http://l/",{headers:H(null)}),{params:Promise.resolve({patientId:crypto.randomUUID()})})).status===401,"ANONYMOUS_VALID_UUID_401");
 ok(await invalidId(egfrR.GET(new Request("http://l/",{headers:H(null)}),{params:Promise.resolve({patientId:BAD})})),"ANONYMOUS_BAD_ID_400");
 ok((await tlR.GET(new Request("http://l/",{headers:H(t)}),{params:Promise.resolve({patientId:crypto.randomUUID()})})).status===200,"VALID_UUID_UNCHANGED");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
