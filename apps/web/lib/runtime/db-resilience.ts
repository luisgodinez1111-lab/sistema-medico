// SRE — Resiliencia de la DEPENDENCIA de base de datos (reintento + circuit breaker), aislada y PURA para poder
// probarla sin una base real. Regla de oro: el breaker cuenta SOLO fallos de CONEXIÓN (saturación/corte que ya se
// traduce a DEPENDENCY_UNAVAILABLE tras agotar reintentos); un error de DOMINIO (validación, conflicto de
// concurrencia, no-encontrado) significa que la conexión funcionó, así que NO cuenta y además resetea el breaker.
// Sin esto, el tráfico normal (que lanza errores de dominio legítimos) abriría el circuito y tumbaría todo.
import{CircuitBreaker}from"../../../../packages/resilience/src";
import{ClinicalError}from"../../../../packages/runtime-errors/src";

export type DbResilienceHooks=Readonly<{
 isConnectionFailure:(e:unknown)=>boolean;      // ¿el fallo es de conexión (reintenable/contable) o de dominio?
 onConnRetry:(attempt:number,code:string)=>void; // telemetría de cada reintento de conexión (SLI, sin PHI)
 onCircuitOpen:()=>void;                          // telemetría cuando el circuito abierto rechaza rápido
 backoffMs?:readonly number[];                    // esperas entre reintentos de conexión
 waitMs?:(ms:number)=>Promise<void>;              // inyectable para tests (sin timers reales)
}>;

// Envuelve `run` con reintento de conexión y el breaker. Devuelve lo que devuelva `run`; traduce la saturación
// agotada y el circuito abierto a DEPENDENCY_UNAVAILABLE (503 fail-closed, nunca un «guardado» falso).
export async function runWithDbResilience<T>(breaker:CircuitBreaker,run:()=>Promise<T>,hooks:DbResilienceHooks):Promise<T>{
 const backoffMs=hooks.backoffMs??[120,360];
 const wait=hooks.waitMs??((ms:number)=>new Promise<void>(r=>setTimeout(r,ms)));
 let domainError:{e:unknown}|undefined;
 try{
  const out=await breaker.execute<T|undefined>(async()=>{
   for(let attempt=0;;attempt++){
    try{return await run();}
    catch(e){
     if(!hooks.isConnectionFailure(e)){domainError={e};return undefined;} // dominio: conexión OK → no cuenta, resetea
     const code=(e as{code?:string}).code??"POOL_EXHAUSTED";
     hooks.onConnRetry(attempt,code);
     if(attempt>=backoffMs.length)throw new ClinicalError("DEPENDENCY_UNAVAILABLE","La base de datos no aceptó la conexión (límite de conexiones alcanzado)");
     await wait(backoffMs[attempt]!);
    }
   }
  });
  if(domainError)throw domainError.e; // el error de dominio se relanza INTACTO, fuera del breaker
  return out as T;
 }catch(e){
  if(e instanceof Error&&e.message==="CIRCUIT_OPEN"){
   hooks.onCircuitOpen();
   throw new ClinicalError("DEPENDENCY_UNAVAILABLE","La base de datos está temporalmente inaccesible (circuito abierto); reintente en breve");
  }
  throw e;
 }
}
