// EPIC F — Evidencia física del camino OIDC REAL a través del route handler.
// Levanta un JWKS local; selectVerifier usa createRemoteJWKSet (el MISMO código de producción)
// apuntando a ese issuer local; firma tokens RS256 y prueba login->abrir encuentro end-to-end.
// Ejecuta: pnpm exec tsx ./scripts/v22/live-oidc-login-proof.mts
import crypto from"node:crypto";import http from"node:http";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir

const{SignJWT,exportJWK,generateKeyPair}=await import("jose");
const AUD="medical-os";
const kp=await generateKeyPair("RS256",{extractable:true});
const other=await generateKeyPair("RS256",{extractable:true});
const pub=await exportJWK(kp.publicKey);const kid="test-key-1";
const jwksBody=JSON.stringify({keys:[{...pub,alg:"RS256",kid,use:"sig"}]});
const server=http.createServer((req,res)=>{
 if(req.url&&req.url.startsWith("/.well-known/jwks.json")){res.writeHead(200,{"content-type":"application/json"});res.end(jwksBody);}
 else{res.writeHead(404);res.end("{}");}
});
await new Promise<void>(r=>server.listen(0,"127.0.0.1",()=>r()));
const port=(server.address() as import("node:net").AddressInfo).port;
const ISS=`http://127.0.0.1:${port}/`;

// Configurar SOLO el camino OIDC (sin dev verifier).
process.env.OIDC_ISSUER=ISS;process.env.OIDC_AUDIENCE=AUD;
delete process.env.DEV_IDENTITY_SECRET;delete process.env.AUTH_MODE;delete process.env.VERCEL_ENV;
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-f-session-secret";

const sessions=await import("../../apps/web/app/api/v1/sessions/route");
const open=await import("../../apps/web/app/api/v1/encounters/route");

const TENANT=crypto.randomUUID();
async function mkToken(claims:Record<string,unknown>={},opts:{iss?:string;aud?:string;exp?:string;signer?:CryptoKey}={}){
 return new SignJWT({tenant_id:TENANT,roles:["PHYSICIAN"],scope:"encounter:write encounter:read",...claims})
  .setProtectedHeader({alg:"RS256",kid}).setIssuedAt().setIssuer(opts.iss??ISS).setAudience(opts.aud??AUD)
  .setSubject(String(claims["sub"]??crypto.randomUUID())).setExpirationTime(opts.exp??"15m").sign(opts.signer??kp.privateKey);
}
// R01-013: el token de sesión solo viaja en el cuerpo si el cliente de API lo pide con la cabecera (el navegador usa la cookie).
// Auditoría (hallado el 24-sep-2026 al correr el smoke dos veces seguidas): esta prueba NO era idempotente. El límite de
// tasa del login se guarda en la BASE (`rate_limit_buckets`, S-03) con la IP del cliente como llave, y `clientIp` cae a
// «unknown» cuando no hay `x-forwarded-for`. Como la prueba no lo mandaba, TODAS sus corridas compartían el mismo cubo:
// pasaba la primera vez y devolvía 429 en las siguientes hasta que expiraba la ventana. Pasó inadvertido porque las
// corridas del gate estaban suficientemente espaciadas. Una IP única por corrida le da su propio cubo y sigue ejercitando
// el límite igual.
const RUN_IP=`203.0.113.${1+Math.floor(Math.random()*250)}`; // rango de documentación (RFC 5737): nunca es una IP real
const loginReq=(token:string)=>new Request("http://l/api/v1/sessions",{method:"POST",headers:{"content-type":"application/json","x-medos-token-delivery":"body","x-forwarded-for":RUN_IP},body:JSON.stringify({token})});

const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 // 1) Token OIDC RS256 válido (verificado contra el JWKS remoto) -> 201 sesión.
 let r=await sessions.POST(loginReq(await mkToken()));
 const b=await r.json();
 ok(r.status===201&&typeof b.token==="string","OIDC_LOGIN_201");

 // 2) ROUND-TRIP: la sesión emitida abre un encuentro real -> 201.
 r=await open.POST(new Request("http://l/",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+b.token,"idempotency-key":crypto.randomUUID()},body:JSON.stringify({encounterId:crypto.randomUUID(),patientId:await freshPatient(TENANT),occurredAt:new Date().toISOString()})}));
 ok(r.status===201&&(await r.json()).version===1,"OIDC_ROUNDTRIP_OPEN_201");

 // 3) Token expirado -> 401.
 r=await sessions.POST(loginReq(await mkToken({},{exp:"-1m"})));
 ok(r.status===401,"EXPIRED_401");

 // 4) Audience incorrecta -> 401.
 r=await sessions.POST(loginReq(await mkToken({},{aud:"other-api"})));
 ok(r.status===401,"WRONG_AUDIENCE_401");

 // 5) Issuer incorrecto -> 401.
 r=await sessions.POST(loginReq(await mkToken({},{iss:"https://evil.example/"})));
 ok(r.status===401,"WRONG_ISSUER_401");

 // 6) Firmado por una clave que NO está en el JWKS -> 401.
 r=await sessions.POST(loginReq(await mkToken({},{signer:other.privateKey as CryptoKey})));
 ok(r.status===401,"UNKNOWN_KEY_401");

 // 7) Sin claim de tenant -> 401 (no puede haber sesión clínica sin tenant).
 r=await sessions.POST(loginReq(await mkToken({tenant_id:undefined})));
 ok(r.status===401,"MISSING_TENANT_401");
}catch(e){result.status="FAIL";result.error=String(e);}finally{server.close();}
console.log(JSON.stringify(result,null,2));
process.exit(result.status==="PASS"?0:1);
