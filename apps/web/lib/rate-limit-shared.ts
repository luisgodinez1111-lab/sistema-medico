// Auditoría 2026-09-19 (S-03) — límite de tasa con almacén COMPARTIDO (tabla rate_limit_buckets + rate_limit_take(),
// migración 0021). Una decisión = una llamada atómica en la base: con N instancias el tope es el declarado, no N veces.
// Si el almacén no responde, se degrada al limitador en memoria de ESTA instancia (acotado, nunca abierto) y se registra
// la degradación sin PHI. Las llaves son IPs (login) o `tenant:actor` (escrituras): no hay PHI en la tabla.
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{KeyedRateLimiter,LOGIN_POLICY,WRITE_POLICY,type LimitDecision,type LimitPolicy}from"./rate-limit";
import{getSql}from"./clinical-runtime";
import{logEvent}from"./runtime/log";
const fallback:Record<SharedScope,KeyedRateLimiter>={login:new KeyedRateLimiter(LOGIN_POLICY),write:new KeyedRateLimiter(WRITE_POLICY)};
export type SharedScope="login"|"write";
export const SHARED_POLICY:Record<SharedScope,LimitPolicy>={login:LOGIN_POLICY,write:WRITE_POLICY};
let gcTick=0;
export async function sharedAllow(scope:SharedScope,key:string,policy:LimitPolicy=SHARED_POLICY[scope]):Promise<LimitDecision>{
 try{
  const sql=getSql();
  const rows=await sql`select allowed, tokens from rate_limit_take(${scope},${key},${policy.capacity}::double precision,${policy.refillPerSecond}::double precision)`;
  const row=rows[0] as{allowed:boolean;tokens:number|string}|undefined;
  if(!row)throw new Error("rate_limit_take sin fila");
  const tokens=Number(row.tokens);const allowed=row.allowed===true;
  // Limpieza oportunista (1 de cada 1000 decisiones): cubos sin uso desde hace un día.
  if(++gcTick%1000===0)void sql`select rate_limit_gc()`.catch(()=>{/* la limpieza es mejor esfuerzo */});
  return{allowed,retryAfterSeconds:allowed?0:Math.max(1,Math.ceil((1-tokens)/policy.refillPerSecond)),remaining:Math.max(0,Math.floor(tokens))};
 }catch(e){
  // Degradación sin PHI (la llave puede ser una IP/tenant:actor, no se registra): solo el motivo del fallo.
  logEvent("warn","rate_limit.shared_store_unavailable","-",{scope,detail:e instanceof Error?e.message:String(e)});
  return fallback[scope].allow(key);
 }
}
export function rateLimitedError(d:LimitDecision):ClinicalError{return new ClinicalError("RATE_LIMITED",`Demasiadas peticiones; reintente en ${d.retryAfterSeconds} s`,{retryAfterSeconds:d.retryAfterSeconds});}
