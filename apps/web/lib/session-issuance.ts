import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{createRemoteJWKSet,type JWTVerifyGetKey}from"jose";
import{issueSession,devIdentityVerifier,type IdentityVerifier}from"../../../packages/session-issuance/src";
import{oidcVerifier,type OidcClaimMap}from"../../../packages/oidc-verifier/src";
import{safeLog}from"../../../packages/secure-logger/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{sessionSecret,revokeCurrentSession}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{SESSION_COOKIE,resolveVerified}from"./http-command";
import{clientIp,rateLimitedResponse}from"./rate-limit";
import{describeEndpoint}from"../../../packages/pg-endpoint/src";
import{sharedAllow}from"./rate-limit-shared";
// EPIC E — Emisión de sesión (login) en el borde HTTP. Selecciona un verificador de identidad
// según el entorno; sin verificador, deny-closed (503). El verificador de desarrollo se
// deshabilita DURO en producción: jamás acuña sesiones a partir de aserciones de prueba en prod.
const SESSION_TTL_SECONDS=900; // 15 min, vida corta (mínimo privilegio).

function isProduction():boolean{
 return process.env.NODE_ENV==="production"||process.env.VERCEL_ENV==="production";
}
// Cache del resolver JWKS por URI (createRemoteJWKSet cachea claves y respeta rotación).
const jwksCache=new Map<string,JWTVerifyGetKey>();
function remoteJwks(uri:string):JWTVerifyGetKey{
 let g=jwksCache.get(uri);
 if(!g){g=createRemoteJWKSet(new URL(uri));jwksCache.set(uri,g);}
 return g;
}
function oidcClaimMap():OidcClaimMap{
 const c:{tenant?:string;roles?:string;scopes?:string}={};
 if(process.env.OIDC_TENANT_CLAIM)c.tenant=process.env.OIDC_TENANT_CLAIM;
 if(process.env.OIDC_ROLES_CLAIM)c.roles=process.env.OIDC_ROLES_CLAIM;
 if(process.env.OIDC_SCOPES_CLAIM)c.scopes=process.env.OIDC_SCOPES_CLAIM;
 return c;
}
// Verificador activo, o undefined (deny-closed). OIDC real (si está configurado) tiene prioridad
// y funciona TAMBIÉN en producción -> es lo que desbloquea prod. El verificador de desarrollo es
// el fallback local y está deshabilitado duro en producción.
export function selectVerifier(now:number):IdentityVerifier|undefined{
 const issuer=process.env.OIDC_ISSUER,audience=process.env.OIDC_AUDIENCE;
 if(issuer&&audience){
  const jwksUri=process.env.OIDC_JWKS_URI??new URL("/.well-known/jwks.json",issuer).toString();
  return oidcVerifier(remoteJwks(jwksUri),{issuer,audience,claims:oidcClaimMap()});
 }
 // Sin OIDC configurado: el ÚNICO fallback es el verificador de desarrollo, IMPOSIBLE en producción.
 if(!devIdentityAllowed())return undefined; // deny-closed (prod o dev sin opt-in completo)
 return devIdentityVerifier(process.env.DEV_IDENTITY_SECRET!,now);
}
// ¿Se permite el verificador de DESARROLLO? NUNCA en producción (deshabilitado duro, no solo por
// ausencia del flag). Si detecta flags de dev en producción, lo registra como incidente de seguridad
// (misconfig/ataque) y rehúsa. En no-prod exige el opt-in completo: ALLOW_DEV_IDENTITY + AUTH_MODE + secreto.
export function devIdentityAllowed():boolean{
 const flagsPresent=process.env.ALLOW_DEV_IDENTITY==="true"||!!process.env.DEV_IDENTITY_SECRET||process.env.AUTH_MODE==="development";
 if(isProduction()){
  if(flagsPresent)safeLog("security.dev_identity_refused_in_prod",{reason:"DEV_IDENTITY_FLAGS_IN_PRODUCTION"});
  return false;
 }
 // Auditoría R01-010: `NODE_ENV`/`VERCEL_ENV` eran la ÚNICA señal que apagaba el verificador de desarrollo. Basta un
 // entrypoint que no las fije (imagen propia, `node server.js` a mano, un runner ajeno) para que una aserción de prueba
 // acuñe sesiones. Segunda señal INDEPENDIENTE, del plano de datos: el verificador de desarrollo solo se permite si la
 // base de datos es LOCAL. Contra una base remota —producción o cualquier entorno compartido— se rehúsa y se registra.
 if(!databaseIsLocal()){
  if(flagsPresent)safeLog("security.dev_identity_refused_remote_db",{reason:"DEV_IDENTITY_WITH_REMOTE_DATABASE"});
  return false;
 }
 return process.env.ALLOW_DEV_IDENTITY==="true"&&process.env.AUTH_MODE==="development"&&!!process.env.DEV_IDENTITY_SECRET;
}
// ¿La base configurada es local? (localhost, loopback o el host de Docker). Sin DATABASE_URL no hay nada que proteger:
// el login fallará después por dependencia no disponible.
const LOCAL_HOSTS=new Set(["localhost","127.0.0.1","::1","[::1]","host.docker.internal","postgres","db"]);
export function databaseIsLocal():boolean{
 const raw=process.env.DATABASE_URL;
 if(!raw)return true;
 const{host}=describeEndpoint(raw);
 return LOCAL_HOSTS.has(host.toLowerCase());
}

export async function handleLogin(req:Request):Promise<Response>{
 try{
  // Auditoría S-03: límite por IP ANTES de leer el cuerpo o verificar la credencial (la verificación OIDC/JWKS es lo caro).
  // S-03: el límite de login por IP usa el almacén COMPARTIDO (rate_limit_buckets); si no responde, el de esta instancia.
  const limit=await sharedAllow("login",clientIp(req.headers));
  if(!limit.allowed){safeLog("session.rate_limited",{retryAfterSeconds:limit.retryAfterSeconds});return rateLimitedResponse(limit);}
  const now=Math.floor(Date.now()/1000);
  const verifier=selectVerifier(now);
  if(!verifier)throw new ClinicalError("DEPENDENCY_UNAVAILABLE","No identity verifier configured");
  let credential:unknown;
  try{credential=await req.json();}catch{throw new ClinicalError("VALIDATION_ERROR","Body must be valid JSON");}
  const verified=await verifier(credential); // lanza UNAUTHENTICATED si la credencial no verifica
  const session=issueSession(verified,sessionSecret(),{now,ttlSeconds:SESSION_TTL_SECONDS,sessionId:crypto.randomUUID()});
  // Auditoría de login sin PHI (redactada); nunca se loguea el token ni la credencial.
  safeLog("session.issued",{sessionId:session.sessionId,tenantId:verified.tenantId,subject:verified.subject,issuer:verified.issuer});
  // Auditoría R01-013: el token de sesión ya NO viaja en el cuerpo por defecto. El navegador autentica con la cookie
  // httpOnly y nunca necesita el token en JS; devolverlo igualmente lo exponía a cualquier XSS, a un log de proxy o al
  // historial de una herramienta de red. Un cliente de API (script, integración) que vaya a usar `Authorization: Bearer`
  // lo pide explícitamente con la cabecera `X-Medos-Token-Delivery: body`; así el caso peligroso es el que hay que pedir.
  const wantsBearer=(req.headers.get("x-medos-token-delivery")??"").toLowerCase()==="body";
  const body=wantsBearer
   ?{token:session.token,sessionId:session.sessionId,expiresAt:session.expiresAt,tokenType:"Bearer"}
   :{sessionId:session.sessionId,expiresAt:session.expiresAt,tokenType:"Cookie"};
  if(wantsBearer)safeLog("session.token_delivered_in_body",{sessionId:session.sessionId,tenantId:verified.tenantId});
  const res=NextResponse.json(body,{status:201});
  res.cookies.set(SESSION_COOKIE,session.token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:SESSION_TTL_SECONDS});
  return res;
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// Logout: REVOCA la sesión en la lista de denegación y borra la cookie. Auditoría R01-014: antes solo borraba la cookie,
// así que un token exfiltrado seguía siendo válido hasta cumplir su TTL y no había forma de cortar una sesión en curso.
// La revocación es best-effort en cuanto a la respuesta (el usuario siempre queda «fuera» en su navegador), pero si la
// base rechaza la escritura se responde 503: decir «sesión cerrada» sin haberla podido revocar sería una falsa garantía.
export async function handleLogout(req:Request):Promise<Response>{
 const clearCookie=(res:Response):Response=>{(res as NextResponse).cookies.set(SESSION_COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});return res;};
 try{
  const resolved=await resolveVerified(req);           // sin sesión válida no hay nada que revocar
  const expiresAt=new Date(resolved.claims.exp*1000);
  const already=await revokeCurrentSession(resolved.ctx,expiresAt,"LOGOUT");
  safeLog("session.revoked",{sessionId:resolved.claims.sessionId,tenantId:resolved.claims.tenantId,reason:"LOGOUT",result:already?"ALREADY_REVOKED":"REVOKED"});
  return clearCookie(NextResponse.json({ok:true,revoked:true},{status:200}));
 }catch(e){
  const h=toHttpError(e);
  // Token ausente, caducado o ya inválido: no hay sesión que revocar, pero la cookie se limpia igual (200).
  if(h.status===401)return clearCookie(NextResponse.json({ok:true,revoked:false},{status:200}));
  return clearCookie(NextResponse.json(h.body,{status:h.status}));
 }
}
