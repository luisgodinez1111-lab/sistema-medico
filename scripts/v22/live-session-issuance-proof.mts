// EPIC E — Evidencia física del boundary de emisión de sesión + round-trip login->abrir encuentro.
// Ejecuta: pnpm exec tsx ./scripts/v22/live-session-issuance-proof.mts
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
// Entorno de desarrollo controlado para este proof (verificador dev opt-in explícito).
process.env.AUTH_MODE="development";
process.env.ALLOW_DEV_IDENTITY="true";
delete process.env.VERCEL_ENV;
const IDP_SECRET=process.env.DEV_IDENTITY_SECRET="epic-e-dev-idp-secret";

const{signSession}=await import("../../packages/session/src");
const sessions=await import("../../apps/web/app/api/v1/sessions/route");
const open=await import("../../apps/web/app/api/v1/encounters/route");

const now=Math.floor(Date.now()/1000);
const TENANT=crypto.randomUUID(),SUB=crypto.randomUUID();
function idpAssertion(secret=IDP_SECRET,over={}){return signSession({sub:SUB,tenantId:TENANT,roles:["PHYSICIAN"],scopes:["encounter:write","encounter:read"],purpose:"TREATMENT",iat:now-5,exp:now+600,sessionId:crypto.randomUUID(),...over},secret);}
// R01-013: el token solo viaja en el cuerpo si el cliente de API lo pide con la cabecera; el navegador usa la cookie.
function loginReq(body:unknown,deliverToken=true){const headers:Record<string,string>={"content-type":"application/json"};if(deliverToken)headers["x-medos-token-delivery"]="body";return new Request("http://l/api/v1/sessions",{method:"POST",headers,body:JSON.stringify(body)});}

const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 // 1) Sin verificador (DEV_IDENTITY_SECRET ausente) -> 503 deny-closed.
 delete process.env.DEV_IDENTITY_SECRET;
 let r:Response=await sessions.POST(loginReq({assertion:idpAssertion()}));
 ok(r.status===503,"NO_VERIFIER_503");
 process.env.DEV_IDENTITY_SECRET=IDP_SECRET;

 // 2) Aserción válida del IdP de dev -> 201 con token (el cliente de API lo pide explícitamente).
 r=await sessions.POST(loginReq({assertion:idpAssertion()}));
 const b=await r.json();
 ok(r.status===201&&typeof b.token==="string"&&b.tokenType==="Bearer"&&b.expiresAt>now,"LOGIN_201_TOKEN");

 // 2b) R01-013: el flujo de NAVEGADOR (sin la cabecera) recibe la cookie y NUNCA el token en el cuerpo.
 const rb=await sessions.POST(loginReq({assertion:idpAssertion()},false));
 const bb=await rb.json();
 ok(rb.status===201&&bb.token===undefined&&bb.tokenType==="Cookie"&&typeof bb.sessionId==="string","LOGIN_BROWSER_NO_TOKEN_IN_BODY");
 ok((rb.headers.get("set-cookie")??"").includes("medos_session=")&&(rb.headers.get("set-cookie")??"").toLowerCase().includes("httponly"),"LOGIN_BROWSER_HTTPONLY_COOKIE");

 // 3) ROUND-TRIP: el token emitido abre un encuentro real -> 201.
 const enc=crypto.randomUUID();
 r=await open.POST(new Request("http://l/",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+b.token,"idempotency-key":crypto.randomUUID()},body:JSON.stringify({encounterId:enc,patientId:await freshPatient(TENANT),occurredAt:new Date().toISOString()})}));
 ok(r.status===201&&(await r.json()).version===1,"ROUNDTRIP_OPEN_201");

 // 4) Aserción manipulada -> 401.
 r=await sessions.POST(loginReq({assertion:idpAssertion()+"x"}));
 ok(r.status===401,"TAMPERED_ASSERTION_401");

 // 5) Aserción firmada con OTRO secreto (IdP no confiable) -> 401.
 r=await sessions.POST(loginReq({assertion:idpAssertion("attacker-secret")}));
 ok(r.status===401,"WRONG_IDP_SECRET_401");

 // 6) En producción el verificador de desarrollo está DESHABILITADO -> 503.
 process.env.VERCEL_ENV="production";
 r=await sessions.POST(loginReq({assertion:idpAssertion()}));
 ok(r.status===503,"DEV_VERIFIER_DISABLED_IN_PROD_503");
 delete process.env.VERCEL_ENV;
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));
process.exit(result.status==="PASS"?0:1);
