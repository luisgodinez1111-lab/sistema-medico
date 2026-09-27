// Lote 11 (ADR-0300) — secreto HMAC de la sesión clínica (sin él la API falla cerrada). Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import{ClinicalError}from"../../../../packages/runtime-errors/src";
export function sessionSecret():string{
 const s=process.env.SESSION_SIGNING_SECRET;
 if(!s)throw new ClinicalError("SAFETY_BLOCKED","SESSION_SIGNING_SECRET not configured");
 return s;
}
