// Drenado del outbox: el consumidor que ADR-0031 prometía y que no existía. Corre POR TENANT, con lease y retroceso.
//
// Auditoría 2026-09-19, anexos R06 y R09 (R06-27, R06-F16, R09-002).
//
// POR QUÉ POR TENANT, y no un worker global. `medical_os_worker` es `NOBYPASSRLS` (db/roles_v16.sql) y la política de `outbox`
// es `tenant_id = app.current_tenant()` FORZADA. Es decir: el worker no puede ver una fila sin declarar de qué tenant está
// drenando, lo cual es la propiedad correcta —el aislamiento no se relaja para el proceso de fondo— y a la vez la razón por
// la que no existe todavía un drenado global: para recorrer todos los tenants hace falta poder ENUMERARLOS, y no había tabla
// `tenants` (hallazgo R06-06, cerrado en la migración 0029 de este mismo lote). Los dos hallazgos eran la misma cadena.
//
// LO QUE ESTE MÓDULO NO HACE: inventar una entrega. Si no hay consumidor para el tema, el mensaje se queda PENDIENTE y el
// resultado lo dice. Ver `packages/outbox-consumers`.
import postgres from"postgres";
import{CLAIM_SQL,retryDelayMs}from"../../../packages/outbox-claim-v2/src";
import{OUTBOX_CONSUMERS,consumerHandles,type OutboxConsumer,type OutboxMessage}from"../../../packages/outbox-consumers/src";

export type DrainReport=Readonly<{
 tenantId:string;worker:string;
 /** Reclamados en esta pasada (los que el lease dejó en LEASED). */
 claimed:number;
 delivered:number;
 /** Devueltos a la cola con retroceso exponencial porque su entrega falló y quedan intentos. */
 retried:number;
 /** Agotaron `max_attempts`: dejan de reintentarse y quedan como carta muerta, que es una señal del presupuesto de seguridad. */
 deadLettered:number;
 /** Reclamados pero SIN consumidor para su tema: se devuelven a PENDIENTE sin gastar intento. */
 withoutConsumer:number;
 /** Mensajes pendientes tras la pasada (lo que queda por drenar). */
 pendingAfter:number;
 notes:readonly string[];
}>;

export type DrainOptions=Readonly<{
 worker:string;
 batch?:number;
 leaseMs?:number;
 /** Inyectable para la prueba en vivo: el registro real está vacío y esa es la verdad del sistema hoy. */
 consumers?:readonly OutboxConsumer[];
 now?:()=>number;
}>;

const DEFAULT_BATCH=50;
const DEFAULT_LEASE_MS=30_000;

/**
 * Drena una pasada del outbox de UN tenant. Devuelve el recuento por desenlace; no lanza por un fallo de entrega —un
 * consumidor caído es una condición esperada, no una avería del drenado— y sí lanza si la base rechaza la operación, porque
 * eso sí es un problema de configuración (típicamente el permiso que faltaba).
 */
export async function drainOutboxForTenant(sql:postgres.Sql,tenantId:string,opts:DrainOptions):Promise<DrainReport>{
 const worker=opts.worker;
 const batch=Math.max(1,Math.min(opts.batch??DEFAULT_BATCH,500));
 const leaseMs=Math.max(1_000,opts.leaseMs??DEFAULT_LEASE_MS);
 const consumers=opts.consumers??OUTBOX_CONSUMERS;
 const notes:string[]=[];
 let delivered=0,retried=0,deadLettered=0,withoutConsumer=0;

 return sql.begin(async tx=>{
  // El contexto de tenant es obligatorio: sin él la política no deja ver NADA, que es justo lo que debe pasar.
  await tx`select set_config('app.tenant_id',${tenantId},true)`;
  if(consumers.length===0){
   // Sin consumidores NO se reclama: reclamar gasta un intento y pone un lease sobre mensajes que nadie va a entregar, así
   // que acercaría la cola a la carta muerta sin que nada haya fallado de verdad.
   const pendientes=await tx<{n:number}[]>`select count(*)::int as n from outbox where state in ('PENDING','RETRY')`;
   const n=Number(pendientes[0]?.n??0);
   notes.push("NO_CONSUMER_CONFIGURED: no hay consumidor registrado; no se reclama nada y la cola queda intacta");
   return{tenantId,worker,claimed:0,delivered:0,retried:0,deadLettered:0,withoutConsumer:0,pendingAfter:Number(n),notes};
  }
  const claimed=await tx.unsafe(CLAIM_SQL,[batch,worker,leaseMs] as never[]) as unknown as ReadonlyArray<{
   id:string;tenant_id:string;topic:string;aggregate_id:string;payload:unknown;attempts:number;max_attempts:number}>;

  for(const row of claimed){
   const m:OutboxMessage={id:String(row.id),tenantId:String(row.tenant_id),topic:String(row.topic),
    aggregateId:String(row.aggregate_id),payload:row.payload,attempts:Number(row.attempts),maxAttempts:Number(row.max_attempts)};
   const destinatarios=consumers.filter(c=>consumerHandles(c,m.topic));
   if(destinatarios.length===0){
    // Se devuelve a PENDIENTE y se DESCUENTA el intento que el claim había sumado: no falló nada, simplemente no hay a quién
    // entregar. Sin esto, un tema sin suscriptor llegaría a carta muerta por el mero paso del tiempo.
    await tx`update outbox set state='PENDING',locked_by=null,locked_until=null,attempts=greatest(0,attempts-1)
      where id=${m.id} and tenant_id=${tenantId}`;
    withoutConsumer++;continue;
   }
   const fallos:string[]=[];
   for(const c of destinatarios){
    // El RECIBO es lo que hace el drenado idempotente: si el consumidor ya procesó este mensaje, no se le vuelve a entregar.
    const[ya]=await tx<{n:number}[]>`select count(*)::int as n from outbox_consumer_receipts
      where tenant_id=${tenantId} and consumer=${c.name} and message_id=${m.id}`;
    if(Number(ya?.n??0)>0)continue;
    let r:Awaited<ReturnType<OutboxConsumer["deliver"]>>;
    try{r=await c.deliver(m);}
    catch(e){r={status:"FAILED",error:`THREW:${(e as Error).message}`.slice(0,300)};}
    if(r.status==="DELIVERED"){
     await tx`insert into outbox_consumer_receipts(tenant_id,consumer,message_id,fencing_token)
       values(${tenantId},${c.name},${m.id},${m.attempts}) on conflict do nothing`;
    }else fallos.push(`${c.name}:${r.error}`);
   }
   if(fallos.length===0){
    await tx`update outbox set state='DELIVERED',delivered_at=now(),locked_by=null,locked_until=null,last_error=null
      where id=${m.id} and tenant_id=${tenantId}`;
    delivered++;
   }else if(m.attempts>=m.maxAttempts){
    // Carta muerta: se deja de reintentar y se conserva el último error. Es una señal operativa, no un descarte silencioso.
    await tx`update outbox set state='DEAD_LETTER',dead_letter_at=now(),locked_by=null,locked_until=null,
      last_error=${fallos.join(" | ").slice(0,500)} where id=${m.id} and tenant_id=${tenantId}`;
    deadLettered++;
   }else{
    // Retroceso exponencial con jitter, de `packages/outbox-claim-v2`: sin jitter, todos los reintentos de una caída
    // coinciden en el mismo instante y reproducen la avalancha que la tumbó.
    const espera=retryDelayMs(m.attempts,m.id.charCodeAt(0));
    await tx`update outbox set state='RETRY',available_at=now()+(${espera}::int * interval '1 millisecond'),
      next_attempt_at=now()+(${espera}::int * interval '1 millisecond'),locked_by=null,locked_until=null,
      last_error=${fallos.join(" | ").slice(0,500)} where id=${m.id} and tenant_id=${tenantId}`;
    retried++;
   }
  }
  const restantes=await tx<{n:number}[]>`select count(*)::int as n from outbox where state in ('PENDING','RETRY')`;
  const n=Number(restantes[0]?.n??0);
  return{tenantId,worker,claimed:claimed.length,delivered,retried,deadLettered,withoutConsumer,
   pendingAfter:Number(n),notes};
 }) as Promise<DrainReport>;
}
