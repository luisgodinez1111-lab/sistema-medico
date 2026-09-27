// Lote 11 (ADR-0300) — paginación por cursor (keyset) y límites de página. Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
// Auditoría 2026-09-19 (S-08) — PAGINACIÓN por cursor (keyset). El cursor es opaco (base64url de la clave de orden); un
// cursor ilegible se ignora y se empieza desde el principio (nunca 500). `limit` lo acota el handler (1..MAX).
export type Page<T>=Readonly<{items:readonly T[];nextCursor:string|null}>;
export function encodeCursor(v:readonly unknown[]):string{return Buffer.from(JSON.stringify(v),"utf8").toString("base64url");}
export function decodeCursor(c:string|null|undefined,arity:number):unknown[]|null{
 if(!c)return null;
 try{const v:unknown=JSON.parse(Buffer.from(c,"base64url").toString("utf8"));return Array.isArray(v)&&v.length===arity?v:null;}catch{return null;}
}
export const PAGE_LIMIT_DEFAULT=100,PAGE_LIMIT_MAX=500;
export function clampLimit(raw:string|null|undefined,def=PAGE_LIMIT_DEFAULT,max=PAGE_LIMIT_MAX):number{const n=Number(raw);return Number.isInteger(n)&&n>=1?Math.min(n,max):def;}
