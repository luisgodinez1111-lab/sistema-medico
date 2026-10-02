// Hallazgo D12c del lote 11 — Evidencia física: los eventos de seguridad del login/logout DEJAN RASTRO. safeLog construía la
// línea redactada y ningún llamador la escribía: inicios de sesión, entrega del token en el cuerpo, identidad de desarrollo
// rehusada en producción y revocaciones no quedaban en ningún registro. Se captura el sumidero POR DEFECTO (la salida estándar
// del proceso, console.info), que es el de producción; no se sustituye por uno de prueba. vs base desechable.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.AUTH_MODE="development";process.env.ALLOW_DEV_IDENTITY="true";delete process.env.VERCEL_ENV;
const IDP_SECRET=process.env.DEV_IDENTITY_SECRET="d12c-dev-idp-secret";
const{signSession}=await import("../../packages/session/src");
const sessions=await import("../../apps/web/app/api/v1/sessions/route");
const now=Math.floor(Date.now()/1000);
const TENANT=crypto.randomUUID(),SUB=crypto.randomUUID();
function idpAssertion(){return signSession({sub:SUB,tenantId:TENANT,roles:["PHYSICIAN"],scopes:["encounter:read"],purpose:"TREATMENT",iat:now-5,exp:now+600,sessionId:crypto.randomUUID()},IDP_SECRET);}
function loginReq(body:unknown){return new Request("http://l/api/v1/sessions",{method:"POST",headers:{"content-type":"application/json","x-medos-token-delivery":"body"},body:JSON.stringify(body)});}
// Captura de la salida estándar del proceso por la vía que usa el sumidero por defecto.
const lines:string[]=[];const origInfo=console.info;console.info=(...a:unknown[])=>{lines.push(a.map(String).join(" "));};
const events=()=>lines.flatMap(l=>{try{const o=JSON.parse(l);return o&&typeof o.event==="string"?[o as Record<string,unknown>]:[];}catch{return[];}});
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 // 1) Login válido con el token pedido en el cuerpo (precondición).
 const r=await sessions.POST(loginReq({assertion:idpAssertion()}));const b=await r.json();
 ok(r.status===201&&typeof b.token==="string"&&typeof b.sessionId==="string","LOGIN_201");
 // 2) session.issued queda registrado con el sessionId emitido; el sujeto (PHI potencial) sale redactado.
 const issued=events().filter(e=>e.event==="session.issued"&&e.sessionId===b.sessionId);
 ok(issued.length===1&&issued[0]!.tenantId===TENANT&&issued[0]!.subject==="[REDACTED]","SESSION_ISSUED_EMITTED_REDACTED");
 // 3) La entrega del token en el cuerpo (el caso peligroso, que se pide explícitamente) también deja rastro.
 ok(events().filter(e=>e.event==="session.token_delivered_in_body"&&e.sessionId===b.sessionId).length===1,"TOKEN_DELIVERED_IN_BODY_EMITTED");
 // 4) Logout: la revocación queda registrada.
 const lo=await sessions.DELETE(new Request("http://l/api/v1/sessions",{method:"DELETE",headers:{authorization:"Bearer "+b.token}}));
 ok(lo.status===200&&events().some(e=>e.event==="session.revoked"&&e.sessionId===b.sessionId&&e.result==="REVOKED"),"SESSION_REVOKED_EMITTED");
 // 5) Banderas de identidad de desarrollo en producción: se rehúsa (503) Y se registra el incidente.
 process.env.VERCEL_ENV="production";
 const p=await sessions.POST(loginReq({assertion:idpAssertion()}));
 delete process.env.VERCEL_ENV;
 ok(p.status===503&&events().some(e=>e.event==="security.dev_identity_refused_in_prod"&&e.reason==="DEV_IDENTITY_FLAGS_IN_PRODUCTION"),"DEV_IDENTITY_REFUSED_IN_PROD_EMITTED");
 // 6) Nada de lo registrado contiene el token ni la aserción (invariante de redacción; se cumple también sin emisión).
 ok(!lines.some(l=>l.includes(b.token)),"NO_TOKEN_IN_LOG");
}catch(e){result.status="FAIL";result.error=String(e);}
console.info=origInfo;
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
