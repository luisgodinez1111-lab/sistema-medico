import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{issueSession,devIdentityVerifier,type IdentityVerifier}from"../../../packages/session-issuance/src";
import{safeLog}from"../../../packages/secure-logger/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{sessionSecret}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
// EPIC E — Emisión de sesión (login) en el borde HTTP. Selecciona un verificador de identidad
// según el entorno; sin verificador, deny-closed (503). El verificador de desarrollo se
// deshabilita DURO en producción: jamás acuña sesiones a partir de aserciones de prueba en prod.
const SESSION_TTL_SECONDS=900; // 15 min, vida corta (mínimo privilegio).

function isProduction():boolean{
 return process.env.NODE_ENV==="production"||process.env.VERCEL_ENV==="production";
}
// Devuelve el verificador activo, o undefined (deny-closed). Hoy solo existe el de desarrollo;
// un verificador OIDC/JWT real se enchufa aquí sin tocar el resto del boundary.
export function selectVerifier(now:number):IdentityVerifier|undefined{
 if(isProduction())return undefined; // ningún verificador real cableado todavía -> prod deny-closed
 const devSecret=process.env.DEV_IDENTITY_SECRET;
 if(process.env.AUTH_MODE==="development"&&devSecret)return devIdentityVerifier(devSecret,now);
 return undefined;
}

export async function handleLogin(req:Request):Promise<Response>{
 try{
  const now=Math.floor(Date.now()/1000);
  const verifier=selectVerifier(now);
  if(!verifier)throw new ClinicalError("DEPENDENCY_UNAVAILABLE","No identity verifier configured");
  let credential:unknown;
  try{credential=await req.json();}catch{throw new ClinicalError("VALIDATION_ERROR","Body must be valid JSON");}
  const verified=verifier(credential); // lanza UNAUTHENTICATED si la credencial no verifica
  const session=issueSession(verified,sessionSecret(),{now,ttlSeconds:SESSION_TTL_SECONDS,sessionId:crypto.randomUUID()});
  // Auditoría de login sin PHI (redactada); nunca se loguea el token ni la credencial.
  safeLog("session.issued",{sessionId:session.sessionId,tenantId:verified.tenantId,subject:verified.subject,issuer:verified.issuer});
  return NextResponse.json({token:session.token,sessionId:session.sessionId,expiresAt:session.expiresAt,tokenType:"Bearer"},{status:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
