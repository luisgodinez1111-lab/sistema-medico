import{signSession,verifySession,type SessionClaims}from"../../session/src";
import{assertIdentity,type VerifiedIdentity}from"../../identity-boundary-v2/src";
import{ClinicalError}from"../../runtime-errors/src";
// EPIC E — Boundary de emisión de sesión (CAP-IDENTITY-001). medical-os NO verifica credenciales
// (sin almacén de contraseñas): asume una identidad YA verificada por un IdP upstream y la
// intercambia por una sesión firmada. El verificador es un adaptador enchufable; sin uno,
// deny-closed. Alineado con identity-boundary-v2 (VerifiedIdentity).
export type Purpose=SessionClaims["purpose"];
// Un verificador toma una credencial opaca (token OIDC, aserción del IdP, …) y devuelve una
// identidad verificada, o lanza. La verificación real (firma/JWKS/expiración) vive en el adapter.
// Puede ser asíncrona (OIDC valida contra el JWKS remoto del proveedor).
export type IdentityVerifier=(credential:unknown)=>VerifiedIdentity|Promise<VerifiedIdentity>;

// Acuña una sesión medical-os de vida corta a partir de una identidad verificada.
export function issueSession(v:VerifiedIdentity,sessionSecret:string,opts:{now:number;ttlSeconds:number;sessionId:string;purpose?:Purpose}):Readonly<{token:string;sessionId:string;expiresAt:number}>{
 if(!sessionSecret)throw new ClinicalError("SAFETY_BLOCKED","Session signing secret not configured");
 assertIdentity(v,opts.now);
 const claims:SessionClaims={sub:v.subject,tenantId:v.tenantId,roles:v.roles,scopes:v.scopes,purpose:opts.purpose??"TREATMENT",iat:opts.now,exp:opts.now+opts.ttlSeconds,sessionId:opts.sessionId};
 return Object.freeze({token:signSession(claims,sessionSecret),sessionId:opts.sessionId,expiresAt:claims.exp});
}

// Verificador de DESARROLLO: un "IdP" de pruebas que firma aserciones de identidad con SU PROPIO
// secreto (separado del de sesión). Nunca debe habilitarse en producción (lo decide la capa app).
export function devIdentityVerifier(idpSecret:string,now:number):(credential:unknown)=>VerifiedIdentity{
 return(credential:unknown)=>{
  if(!idpSecret)throw new ClinicalError("DEPENDENCY_UNAVAILABLE","Dev identity secret not configured");
  const c=credential as{assertion?:unknown};
  if(!c||typeof c.assertion!=="string")throw new ClinicalError("UNAUTHENTICATED","Missing identity assertion");
  let claims:SessionClaims;
  try{claims=verifySession(c.assertion,idpSecret,now);}
  catch(e){throw new ClinicalError("UNAUTHENTICATED","Identity assertion invalid",{reason:e instanceof Error?e.message:"UNKNOWN"});}
  if(!claims.sub||!claims.tenantId)throw new ClinicalError("UNAUTHENTICATED","Assertion missing identity");
  return{subject:claims.sub,issuer:"dev-idp",audience:"medical-os",expiresAt:claims.exp,sessionId:claims.sessionId,tenantId:claims.tenantId,roles:claims.roles,scopes:claims.scopes};
 };
}
