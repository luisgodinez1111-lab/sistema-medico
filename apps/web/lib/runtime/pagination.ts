// Paginación por cursor (keyset). Auditoría S-08: el cursor es opaco; un cursor ilegible se ignora y se empieza
// desde el principio (nunca 500). Auditoría R01-001: extraído de `clinical-runtime.ts`.



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

// R06-20 («sin paginación»): los seis tableros de clínica completa devolvían el TENANT ENTERO. Ahora cada uno devuelve una
// página acotada con su cursor y el `total` real contado en la base, que es lo que permite que los KPI de la ruta sigan
// siendo exactos sin traerse todas las filas. El límite por omisión es el máximo (500): un cambio de comportamiento
// invisible para cualquier consultorio real, pero el tenant deja de ser una lectura sin cota.
export type FilaCursor=Readonly<{cursor_at?:unknown;aggregate_id?:unknown}>;
export function armarPagina<T>(rows:readonly unknown[],limit:number,mapea:(r:unknown)=>T):Page<T>{
 const hayMas=rows.length>limit;
 const pagina=hayMas?rows.slice(0,limit):rows;
 const ultima=pagina.at(-1) as FilaCursor|undefined;
 return{
  items:pagina.map(mapea),
  nextCursor:hayMas&&ultima?encodeCursor([new Date(String(ultima.cursor_at)).toISOString(),String(ultima.aggregate_id)]):null,
 };
}
/** Total REAL del registro, contado en la base: es lo que permite que los KPI de la ruta sigan siendo exactos. */
export const cuentaDe=(rows:readonly unknown[])=>Number((rows[0] as {n?:unknown}|undefined)?.n??0);
/** Límite efectivo de una consulta de registro: por omisión el máximo, siempre acotado. */
export const limiteDe=(q:{limit?:number}|undefined)=>clampLimit(q?.limit===undefined?undefined:String(q.limit),PAGE_LIMIT_MAX,PAGE_LIMIT_MAX);
