import{ClinicalError}from"../../../packages/runtime-errors/src";
import type{TransactionSql}from"postgres";
// Auditoría 2026-09-19, anexo R01 (R01-014) — REVOCACIÓN de sesiones firmadas.
//
// El problema: la sesión es un token HMAC autocontenido con TTL de 15 minutos. `handleLogout` solo borraba la cookie, así
// que un token exfiltrado seguía abriendo la API hasta caducar y no existía forma de cortar una sesión en curso. Decir
// «TTL corto» no es revocar: durante esos minutos el sistema no puede negar acceso a una credencial que sabe comprometida.
//
// La decisión de diseño: la lista de denegación (`session_revocations`, migración 0023) se consulta DENTRO de la misma
// transacción que la lectura o el comando, no en un middleware aparte. Tres razones:
//   1. no añade un viaje de ida y vuelta: va en la transacción que ya se abre;
//   2. es fail-closed por construcción: si la base no responde, la operación entera falla (nunca «pasa» por defecto);
//   3. RLS ya está fijada en esa transacción, así que la consulta solo ve las revocaciones del tenant.
// Las peticiones que no tocan la base (p. ej. salud del servicio) no exponen PHI, así que no necesitan la comprobación.
export const SESSION_REVOKED="SESSION_REVOKED";

/** Rechaza la operación si la sesión está en la lista de denegación. Se ejecuta con el contexto de RLS ya fijado. */
export async function assertSessionNotRevoked(tx:TransactionSql,sessionId:string|undefined):Promise<void>{
 if(!sessionId)return; // contextos internos (scripts de operación, recuperación) no llevan sesión de usuario
 const rows=await tx`select 1 from session_revocations where session_id=${sessionId} limit 1`;
 if(rows.length>0)throw new ClinicalError("UNAUTHENTICATED","La sesión fue revocada: vuelva a iniciar sesión",{reason:SESSION_REVOKED});
}

/** Revoca una sesión (idempotente). Devuelve true si ya estaba revocada. */
export async function revokeSession(tx:TransactionSql,args:Readonly<{sessionId:string;tenantId:string;actorId:string;reason:string;expiresAt:Date}>):Promise<boolean>{
 const rows=await tx`select revoke_session(${args.sessionId}::uuid,${args.tenantId}::uuid,${args.actorId}::uuid,${args.reason},${args.expiresAt.toISOString()}::timestamptz) as existed`;
 return Boolean(rows[0]?.["existed"]);
}
