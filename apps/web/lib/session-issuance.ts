import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{createRemoteJWKSet,type JWTVerifyGetKey}from"jose";
import{issueSession,devIdentityVerifier,type IdentityVerifier}from"../../../packages/session-issuance/src";
import{oidcVerifier,type OidcClaimMap}from"../../../packages/oidc-verifier/src";
import{safeLog}from"../../../packages/secure-logger/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{sessionSecret}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{SESSION_COOKIE}from"./http-command";
import{loginLimiter,clientIp,rateLimitedResponse}from"./rate-limit";
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
 return process.env.ALLOW_DEV_IDENTITY==="true"&&process.env.AUTH_MODE==="development"&&!!process.env.DEV_IDENTITY_SECRET;
}

export async function handleLogin(req:Request):Promise<Response>{
 try{
  // Auditoría S-03: límite por IP ANTES de leer el cuerpo o verificar la credencial (la verificación OIDC/JWKS es lo caro).
  const limit=loginLimiter.allow(clientIp(req.headers));
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
  // El navegador usa la cookie httpOnly (no persiste el token en JS). El body sigue devolviendo
  // el token para clientes/API que usen Bearer. tokenType informa cómo autenticar.
  const res=NextResponse.json({token:session.token,sessionId:session.sessionId,expiresAt:session.expiresAt,tokenType:"Bearer"},{status:201});
  res.cookies.set(SESSION_COOKIE,session.token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:SESSION_TTL_SECONDS});
  return res;
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// Logout: borra la cookie de sesión (la sesión firmada expira sola por TTL).
export function handleLogout():Response{
 const res=NextResponse.json({ok:true},{status:200});
 res.cookies.set(SESSION_COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
 return res;
}
