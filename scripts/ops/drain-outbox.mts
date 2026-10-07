// Drenado del outbox: el punto de entrada que un cron invoca. Auditoría R06-27 / R09-002.
//
// POR QUÉ UN SCRIPT Y NO UN PROCESO PERMANENTE. El despliegue es serverless (Vercel): no hay dónde vivir un worker de larga
// duración. La forma que corresponde a esa plataforma es una invocación periódica —un cron— que hace una pasada y termina. El
// lease y el retroceso son justamente lo que hace segura esa forma: dos invocaciones solapadas no entregan el mismo mensaje.
//
// CÓMO SE EJECUTA (requiere las credenciales del ROL DEL WORKER, no las de la aplicación):
//   OUTBOX_WORKER_DATABASE_URL=postgres://medical_os_worker:...@host/db pnpm -s exec tsx scripts/ops/drain-outbox.mts
//
// Se niega a correr con `DATABASE_URL` a secas: el rol de la aplicación no tiene UPDATE sobre `outbox` —y no debe tenerlo—,
// así que usarlo produciría un fallo de permisos a mitad del drenado en vez de un rechazo claro al arrancar.
//
// LO QUE HOY HACE: nada, y lo dice. El registro de consumidores está vacío (`packages/outbox-consumers`), así que el drenado
// informa del rezago sin tocar la cola. Cuando exista el primer consumidor, este mismo script lo entrega.
import postgres from"postgres";
import{directEndpoint}from"../../packages/pg-endpoint/src";
import{drainOutboxForTenant}from"../../apps/web/lib/outbox-drain";
import{OUTBOX_CONSUMERS,OUTBOX_CONSUMERS_NOTE}from"../../packages/outbox-consumers/src";

const URL_DB=process.env.OUTBOX_WORKER_DATABASE_URL;
if(!URL_DB){
 console.error(JSON.stringify({status:"REFUSED",reason:"OUTBOX_WORKER_DATABASE_URL_REQUIRED",
  note:"El drenado necesita las credenciales del rol medical_os_worker (SELECT+UPDATE en outbox). El rol de la aplicación no las tiene, a propósito."}));
 process.exit(2);
}
const WORKER=process.env.OUTBOX_WORKER_NAME??`cron-${process.pid}`;
const BATCH=Number(process.env.OUTBOX_BATCH??50);
const sql=postgres(directEndpoint(URL_DB),{max:2,prepare:false,onnotice:()=>{}});
try{
 // La enumeración de tenants es lo que la migración 0029 hizo posible: antes no había forma de saber a quién drenar sin
 // relajar el aislamiento del worker, y relajarlo habría sido peor que no drenar.
 const tenants=await sql<{id:string}[]>`select id from tenants where status='ACTIVE' order by id`;
 const reports:Awaited<ReturnType<typeof drainOutboxForTenant>>[]=[];
 for(const t of tenants){
  const r=await drainOutboxForTenant(sql,String(t.id),{worker:WORKER,batch:BATCH});
  reports.push(r);
  // La marca de drenado permite ver si un tenant se quedó atrás; solo se escribe cuando se entregó algo.
  if(r.delivered>0)await sql`update tenants set outbox_drained_at=now() where id=${t.id}`;
 }
 const total=(k:"delivered"|"retried"|"deadLettered"|"withoutConsumer"|"pendingAfter")=>reports.reduce((a,r)=>a+r[k],0);
 console.log(JSON.stringify({status:"OK",worker:WORKER,tenants:tenants.length,
  consumers:OUTBOX_CONSUMERS.map(c=>c.name),
  delivered:total("delivered"),retried:total("retried"),deadLettered:total("deadLettered"),
  withoutConsumer:total("withoutConsumer"),pending:total("pendingAfter"),
  ...(OUTBOX_CONSUMERS.length===0?{note:OUTBOX_CONSUMERS_NOTE}:{})},null,2));
}catch(e){
 console.error(JSON.stringify({status:"FAIL",error:String(e)}));
 process.exitCode=1;
}finally{await sql.end();}
