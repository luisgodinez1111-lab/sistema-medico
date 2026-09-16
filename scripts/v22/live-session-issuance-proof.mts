// EPIC E — Evidencia física del boundary de emisión de sesión + round-trip login->abrir encuentro.
// Ejecuta: pnpm exec tsx ./scripts/v22/live-session-issuance-proof.mts
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{
 const envRaw=fs.readFileSync(path.resolve(".env.local"),"utf8");
 for(const line of envRaw.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}
}catch{/* env ya cargado */}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
// Entorno de desarrollo controlado para este proof (verificador dev opt-in explícito).
process.env.AUTH_MODE="development";
process.env.ALLOW_DEV_IDENTITY="true";
delete process.env.VERCEL_ENV;
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-e-session-secret";
const IDP_SECRET=process.env.DEV_IDENTITY_SECRET="epic-e-dev-idp-secret";

const{signSession}=await import("../../packages/session/src");
const sessions=await import("../../apps/web/app/api/v1/sessions/route");
const open=await import("../../apps/web/app/api/v1/encounters/route");

const now=Math.floor(Date.now()/1000);
const TENANT=crypto.randomUUID(),SUB=crypto.randomUUID();
function idpAssertion(secret=IDP_SECRET,over={}){return signSession({sub:SUB,tenantId:TENANT,roles:["PHYSICIAN"],scopes:["encounter:write","encounter:read"],purpose:"TREATMENT",iat:now-5,exp:now+600,sessionId:crypto.randomUUID(),...over},secret);}
function loginReq(body:unknown){return new Request("http://l/api/v1/sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});}

const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 // 1) Sin verificador (DEV_IDENTITY_SECRET ausente) -> 503 deny-closed.
 delete process.env.DEV_IDENTITY_SECRET;
 let r=await sessions.POST(loginReq({assertion:idpAssertion()}));
 ok(r.status===503,"NO_VERIFIER_503");
 process.env.DEV_IDENTITY_SECRET=IDP_SECRET;

 // 2) Aserción válida del IdP de dev -> 201 con token.
 r=await sessions.POST(loginReq({assertion:idpAssertion()}));
 const b=await r.json();
 ok(r.status===201&&typeof b.token==="string"&&b.tokenType==="Bearer"&&b.expiresAt>now,"LOGIN_201_TOKEN");

 // 3) ROUND-TRIP: el token emitido abre un encuentro real -> 201.
 const enc=crypto.randomUUID();
 r=await open.POST(new Request("http://l/",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+b.token,"idempotency-key":crypto.randomUUID()},body:JSON.stringify({encounterId:enc,patientId:crypto.randomUUID(),occurredAt:new Date().toISOString()})}));
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
