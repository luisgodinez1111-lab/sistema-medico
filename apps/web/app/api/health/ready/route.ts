// SRE — Readiness profundo (distinto de /api/health, que es liveness). Responde si la instancia puede SERVIR:
// comprueba la dependencia crítica (Postgres) con un `select 1` acotado en el tiempo. 200 READY / 503 NOT_READY.
// Sin PHI, sin auth, sin estado de sesión: es una sonda de infraestructura (load balancer / health check), no una
// ruta clínica. El `select 1` no toca ninguna tabla bajo RLS, así que no expone datos aunque corra con el rol runtime.
import{readiness}from"../../../../../../packages/health/src";
import{getSql}from"../../../../lib/runtime/connection";

const PROBE_TIMEOUT_MS=2_000;

export async function GET(){
 const startedAt=Date.now();
 let status:"UP"|"DOWN"="DOWN";let latencyMs:number|undefined;
 try{
  await Promise.race([
   getSql()`select 1`,
   new Promise((_,reject)=>setTimeout(()=>reject(new Error("READINESS_PROBE_TIMEOUT")),PROBE_TIMEOUT_MS)),
  ]);
  status="UP";latencyMs=Date.now()-startedAt;
 }catch{
  status="DOWN"; // fail-closed: cualquier fallo o timeout de la sonda = NOT_READY, nunca se asume sano.
 }
 const r=readiness([{name:"database",status,...(latencyMs!==undefined?{latencyMs}:{})}]);
 return Response.json(
  {...r,service:"medical-os-web",at:new Date().toISOString()},
  {status:r.status==="READY"?200:503,headers:{"cache-control":"no-store"}},
 );
}
