import crypto from"node:crypto";
import{verifySession,type SessionClaims}from"../../session/src";
import{type Principal}from"../../runtime-auth/src";
import{ClinicalError}from"../../runtime-errors/src";
// EPIC B — Adaptador de sesión/principal verificado para la capa HTTP.
// Convierte un token de sesión firmado (HMAC) en un Principal + TenantContext.
// Fail-closed: cualquier ausencia/expiración/manipulación => UNAUTHENTICATED.
// Autoridad: EXEC-0003 (no frontend authz) — la verificación es 100% server-side.
import{type ActorType}from"../../tenant-context/src";
import{uuidFromDigest}from"../../canonical-json/src";
// `actorType`: HUMAN para toda sesión verificada por el IdP. El gateway de IA (no cableado, R6 en pausa) y los trabajos
// del sistema deben construir su propio contexto con AI / SYSTEM: nunca heredan el HUMAN de la sesión (auditoría S-06).
export type HttpTenantContext=Readonly<{tenantId:string;actorId:string;actorType:ActorType;purpose:string;requestId:string}>;
// El subject del IdP puede NO ser un UUID (Auth0 usa "auth0|<hex>", Google "google-oauth2|...").
// Las columnas actor_id de la BD son uuid, así que el actorId clínico es un UUID DETERMINISTA
// derivado del subject (estable por usuario). El subject crudo se conserva en las claims para
// trazabilidad legible.
// R01-015: el actorId es un UUID DERIVADO del sujeto OIDC (mismo sujeto ⇒ mismo actor, sin guardar el sujeto en claro),
// emitido como UUID válido (versión 8, variante RFC 9562) y no como un corte crudo del sha256.
export function subjectToActorId(subject:string):string{
 return uuidFromDigest(crypto.createHash("sha256").update("medical-os:actor:"+subject).digest("hex"));
}
export type ResolvedPrincipal=Readonly<{claims:SessionClaims;principal:Principal;ctx:HttpTenantContext}>;
export type HeaderReader=(name:string)=>string|null|undefined;
function bearerToken(read:HeaderReader):string{
 const raw=read("authorization")??read("Authorization");
 if(!raw)throw new ClinicalError("UNAUTHENTICATED","Missing Authorization header");
 const m=/^Bearer\s+(\S+)$/i.exec(raw.trim());
 if(!m||!m[1])throw new ClinicalError("UNAUTHENTICATED","Malformed Authorization header");
 return m[1];
}
export function resolvePrincipal(read:HeaderReader,secret:string,requestId:string,now=Math.floor(Date.now()/1000)):ResolvedPrincipal{
 if(!secret)throw new ClinicalError("SAFETY_BLOCKED","Session signing secret not configured");
 if(!requestId)throw new ClinicalError("SAFETY_BLOCKED","Request id required for provenance");
 const token=bearerToken(read);
 let claims:SessionClaims;
 try{claims=verifySession(token,secret,now);}
 catch(e){throw new ClinicalError("UNAUTHENTICATED","Session verification failed",{reason:e instanceof Error?e.message:"UNKNOWN"});}
 if(!claims.sessionId||!claims.tenantId||!claims.sub)throw new ClinicalError("UNAUTHENTICATED","Session missing identity");
 const actorId=subjectToActorId(claims.sub);
 const principal:Principal={actorId,tenantId:claims.tenantId,roles:claims.roles,scopes:claims.scopes,purpose:claims.purpose,sessionId:claims.sessionId};
 const ctx:HttpTenantContext={tenantId:claims.tenantId,actorId,actorType:"HUMAN",purpose:claims.purpose,requestId};
 return Object.freeze({claims,principal,ctx});
}
