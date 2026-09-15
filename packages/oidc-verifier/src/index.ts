import{jwtVerify,type JWTPayload,type JWTVerifyGetKey}from"jose";
import{type VerifiedIdentity}from"../../identity-boundary-v2/src";
import{ClinicalError}from"../../runtime-errors/src";
// EPIC F — Verificador de identidad OIDC/JWT estándar (vendor-neutral). Valida firma contra el
// JWKS del proveedor + iss/aud/exp y mapea claims -> VerifiedIdentity. Funciona con cualquier IdP
// compliant (Auth0, Clerk, SSO del hospital). Solo algoritmos ASIMÉTRICOS: nunca HS*/none, para
// cerrar ataques de confusión de algoritmo. La verificación de firma la hace `jose` (auditado).
export type OidcClaimMap=Readonly<{tenant?:string;roles?:string;scopes?:string}>;
export type OidcConfig=Readonly<{issuer:string;audience:string;claims?:OidcClaimMap}>;
const ASYMMETRIC_ALGS=["RS256","RS384","RS512","PS256","PS384","PS512","ES256","ES384","ES512"];

function asStringArray(v:unknown):string[]{
 if(Array.isArray(v))return v.filter((x):x is string=>typeof x==="string");
 if(typeof v==="string"&&v.length>0)return v.split(/\s+/).filter(Boolean);
 return[];
}
// Mapea el payload verificado a una identidad clínica. Exige subject, tenant y al menos un rol:
// sin ellos no puede existir una sesión clínica (tenant isolation + authz).
export function mapClaims(payload:JWTPayload,cfg:OidcConfig):VerifiedIdentity{
 const tenantClaim=cfg.claims?.tenant??"tenant_id";
 const rolesClaim=cfg.claims?.roles??"roles";
 const scopesClaim=cfg.claims?.scopes;
 const sub=payload.sub;
 if(typeof sub!=="string"||!sub)throw new ClinicalError("UNAUTHENTICATED","Token missing subject");
 const tenantId=payload[tenantClaim];
 if(typeof tenantId!=="string"||!tenantId)throw new ClinicalError("UNAUTHENTICATED",`Token missing tenant claim (${tenantClaim})`);
 const roles=asStringArray(payload[rolesClaim]);
 if(roles.length===0)throw new ClinicalError("UNAUTHENTICATED",`Token missing roles claim (${rolesClaim})`);
 const scopes=asStringArray(scopesClaim?payload[scopesClaim]:payload["scope"]);
 const sid=payload["sid"];
 const sessionId=(typeof sid==="string"&&sid)||(typeof payload.jti==="string"&&payload.jti)||sub;
 return{subject:sub,issuer:typeof payload.iss==="string"?payload.iss:cfg.issuer,audience:cfg.audience,expiresAt:typeof payload.exp==="number"?payload.exp:0,sessionId,tenantId,roles,scopes};
}
// getKey: resolver de claves JWKS (createRemoteJWKSet en prod; createLocalJWKSet en tests).
export function oidcVerifier(getKey:JWTVerifyGetKey,cfg:OidcConfig){
 return async(credential:unknown):Promise<VerifiedIdentity>=>{
  const c=credential as{token?:unknown};
  const token=typeof c?.token==="string"?c.token:(typeof credential==="string"?credential:undefined);
  if(!token)throw new ClinicalError("UNAUTHENTICATED","Missing OIDC token");
  let payload:JWTPayload;
  try{({payload}=await jwtVerify(token,getKey,{issuer:cfg.issuer,audience:cfg.audience,algorithms:ASYMMETRIC_ALGS}));}
  catch(e){throw new ClinicalError("UNAUTHENTICATED","OIDC token verification failed",{reason:e instanceof Error?e.message:"UNKNOWN"});}
  return mapClaims(payload,cfg);
 };
}
