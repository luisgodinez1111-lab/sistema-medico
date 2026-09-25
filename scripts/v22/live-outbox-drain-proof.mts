// Auditoría 2026-09-19, anexos R06 y R09 (R06-27, R06-F16, R09-002) — EVIDENCIA FÍSICA DEL DRENADO DEL OUTBOX.
//
// EL HALLAZGO: todos los comandos clínicos insertan en `outbox` con estado PENDING y NADA la drenaba. ADR-0031 promete un
// outbox reconciliable; existían las piezas puras (lease, retroceso, fencing) y el claim SQL, sin un solo llamador. Esta
// prueba ejercita el mecanismo COMPLETO contra PostgreSQL real, con el rol `medical_os_worker` —NOBYPASSRLS, con la política
// de tenant FORZADA— y comprueba las cinco cosas que hacen de un drenado algo más que un `update`:
//
//   1. sin consumidor registrado NO se vacía la cola ni se gasta un intento (no se fabrica una entrega);
//   2. con consumidor, el mensaje se entrega UNA vez y queda el recibo que lo hace idempotente;
//   3. un consumidor que falla devuelve el mensaje a la cola con retroceso, y a la N-ésima queda en carta muerta;
//   4. el lease impide que dos workers entreguen el mismo mensaje;
//   5. el aislamiento por tenant se mantiene: un worker drenando el tenant A no ve ni toca la cola del tenant B.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{directEndpoint}=await import("../../packages/pg-endpoint/src");
const postgres=(await import("postgres")).default;
const{drainOutboxForTenant}=await import("../../apps/web/lib/outbox-drain");
const{OUTBOX_CONSUMERS}=await import("../../packages/outbox-consumers/src");
const URL_DB=process.env.TEST_DATABASE_URL!;
const WORKER_ROLE="medical_os_worker";
const owner=postgres(directEndpoint(URL_DB),{max:2,prepare:false,onnotice:()=>{}});
// El drenado corre con el ROL DEL WORKER, no con el dueño: un drenado probado como superusuario pasaría ignorando la política
// de tenant, que es justo la restricción que da forma al diseño (por eso es por tenant y no global).
const worker=postgres(directEndpoint(URL_DB),{max:2,prepare:false,onnotice:()=>{},connection:{options:`-c role=${WORKER_ROLE}`}});
const TA=crypto.randomUUID(),TB=crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
/** Inserta un mensaje en la cola como lo hace el kernel (mismo INSERT que atomic-clinical-transaction-v3). */
async function encolar(tenantId:string,topic:string,maxAttempts=8):Promise<string>{
 const id=crypto.randomUUID();
 await owner`insert into outbox(id,tenant_id,topic,aggregate_id,payload,state,available_at,max_attempts)
  values(${id},${tenantId},${topic},${crypto.randomUUID()},${owner.json({eventId:crypto.randomUUID()} as never)},'PENDING',now(),${maxAttempts})`;
 return id;
}
const estado=async(id:string)=>String(((await owner`select state from outbox where id=${id}`)[0]??{}).state??"(ausente)");
const intentos=async(id:string)=>Number(((await owner`select attempts from outbox where id=${id}`)[0]??{}).attempts??-1);

try{
 // El usuario conector debe pertenecer al rol para poder asumirlo (igual que en la prueba de RLS).
 await owner.unsafe(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles g ON g.oid=m.member WHERE r.rolname='${WORKER_ROLE}' AND g.rolname=current_user) THEN EXECUTE format('GRANT ${WORKER_ROLE} TO %I',current_user); END IF; END $$;`);
 const rol=await worker`select current_user as u,(select rolbypassrls from pg_roles where rolname=current_user) as bypass`;
 ok(String(rol[0]!.u)===WORKER_ROLE&&rol[0]!.bypass===false,`DRAINING_AS_WORKER_WITHOUT_BYPASSRLS:${rol[0]!.u}`);

 // R06-06: el registro de tenants existe y es lo que permite ENUMERAR a quién drenar. Sin él no hay worker global posible.
 await owner`insert into tenants(id,name) values(${TA},'Consultorio A'),(${TB},'Consultorio B') on conflict do nothing`;
 const enumerables=await worker`select id from tenants where status='ACTIVE' and id in (${TA},${TB})`;
 ok(enumerables.length===2,`WORKER_CAN_ENUMERATE_TENANTS:${enumerables.length}`);

 // 1) SIN CONSUMIDOR no se vacía nada. Es el estado real del sistema hoy y el comportamiento correcto: marcar entregado lo
 //    que nadie consumió sería una afirmación falsa en un registro append-only.
 ok(OUTBOX_CONSUMERS.length===0,"CONSUMER_REGISTRY_IS_EMPTY_TODAY");
 const m1=await encolar(TA,"patient.registered");
 const sinConsumidor=await drainOutboxForTenant(worker,TA,{worker:"w1"});
 ok(sinConsumidor.claimed===0&&sinConsumidor.delivered===0,"NO_CONSUMER_CLAIMS_NOTHING");
 ok(await estado(m1)==="PENDING","NO_CONSUMER_LEAVES_MESSAGE_PENDING");
 ok(await intentos(m1)===0,"NO_CONSUMER_SPENDS_NO_ATTEMPT");
 ok(sinConsumidor.notes.join(" ").includes("NO_CONSUMER_CONFIGURED"),"NO_CONSUMER_IS_REPORTED");
 ok(sinConsumidor.pendingAfter>=1,`BACKLOG_IS_VISIBLE:${sinConsumidor.pendingAfter}`);

 // 2) CON CONSUMIDOR: entrega, recibo e idempotencia.
 const entregados:string[]=[];
 const bueno={name:"prueba-consumidor",topics:["patient.*"],deliver:async(m:{id:string})=>{entregados.push(m.id);return{status:"DELIVERED" as const};}};
 const r2=await drainOutboxForTenant(worker,TA,{worker:"w1",consumers:[bueno]});
 ok(r2.claimed===1&&r2.delivered===1,`DELIVERED_ONE:${r2.claimed}/${r2.delivered}`);
 ok(await estado(m1)==="DELIVERED","MESSAGE_MARKED_DELIVERED");
 const recibos=await owner`select count(*)::int as n from outbox_consumer_receipts where tenant_id=${TA} and message_id=${m1}`;
 ok(Number(recibos[0]!.n)===1,"RECEIPT_RECORDED");
 // Una segunda pasada no vuelve a entregar: el mensaje ya no está reclamable y el recibo existe.
 const r3=await drainOutboxForTenant(worker,TA,{worker:"w1",consumers:[bueno]});
 ok(r3.claimed===0&&entregados.length===1,`DELIVERY_IS_IDEMPOTENT:${entregados.length}`);

 // 3) UN CONSUMIDOR QUE FALLA: retroceso y, al agotar intentos, carta muerta.
 const m2=await encolar(TA,"patient.amended",2); // dos intentos y a carta muerta
 const malo={name:"consumidor-caido",topics:["patient.*"],deliver:async()=>({status:"FAILED" as const,error:"ECONNREFUSED"})};
 const f1=await drainOutboxForTenant(worker,TA,{worker:"w1",consumers:[malo]});
 ok(f1.retried===1&&await estado(m2)==="RETRY",`FAILURE_GOES_TO_RETRY:${await estado(m2)}`);
 const conError=await owner`select last_error from outbox where id=${m2}`;
 ok(String(conError[0]!.last_error??"").includes("ECONNREFUSED"),"LAST_ERROR_RECORDED");
 // El retroceso pone el mensaje en el futuro: por eso la siguiente pasada NO lo reclama todavía.
 const f2=await drainOutboxForTenant(worker,TA,{worker:"w1",consumers:[malo]});
 ok(f2.claimed===0,"BACKOFF_DELAYS_NEXT_ATTEMPT");
 // Se adelanta el reloj de la cola para ejercitar la carta muerta sin esperar el retroceso real.
 await owner`update outbox set available_at=now()-interval '1 minute',next_attempt_at=now()-interval '1 minute' where id=${m2}`;
 const f3=await drainOutboxForTenant(worker,TA,{worker:"w1",consumers:[malo]});
 ok(f3.deadLettered===1&&await estado(m2)==="DEAD_LETTER",`ATTEMPTS_EXHAUSTED_IS_DEAD_LETTER:${await estado(m2)}`);

 // 4) UN TEMA SIN SUSCRIPTOR vuelve a PENDIENTE sin gastar intento: no falló nada, no hay a quién entregar.
 const m3=await encolar(TA,"billing.claim_paid");
 const r4=await drainOutboxForTenant(worker,TA,{worker:"w1",consumers:[bueno]});
 ok(r4.withoutConsumer===1&&await estado(m3)==="PENDING",`TOPIC_WITHOUT_CONSUMER_STAYS_PENDING:${await estado(m3)}`);
 ok(await intentos(m3)===0,"TOPIC_WITHOUT_CONSUMER_SPENDS_NO_ATTEMPT");

 // 5) EL LEASE impide la doble entrega: mientras w1 tiene el lease, w2 no reclama ese mensaje.
 const m4=await encolar(TA,"patient.registered");
 await owner`update outbox set state='LEASED',locked_by='w1',locked_until=now()+interval '30 seconds' where id=${m4}`;
 const r5=await drainOutboxForTenant(worker,TA,{worker:"w2",consumers:[bueno]});
 // La comprobación es sobre ESE mensaje, no sobre el total reclamado: la cola tiene otros pendientes (el del tema sin
 // suscriptor) y w2 sí puede reclamarlos. Afirmar `claimed===0` sería confundir «no tocó el arrendado» con «no hizo nada».
 void r5;
 ok(await estado(m4)==="LEASED"&&!entregados.includes(m4),`LEASE_PREVENTS_DOUBLE_DELIVERY:${await estado(m4)}`);
 // Y cuando el lease VENCE, otro worker sí puede retomarlo: un worker muerto no bloquea la cola para siempre.
 await owner`update outbox set locked_until=now()-interval '1 second' where id=${m4}`;
 const r6=await drainOutboxForTenant(worker,TA,{worker:"w2",consumers:[bueno]});
 ok(r6.delivered===1,`EXPIRED_LEASE_IS_RECLAIMED:${r6.delivered}`);

 // 6) AISLAMIENTO: el worker drenando A no ve ni toca la cola de B.
 const mB=await encolar(TB,"patient.registered");
 const rA=await drainOutboxForTenant(worker,TA,{worker:"w1",consumers:[bueno]});
 ok(await estado(mB)==="PENDING",`OTHER_TENANT_QUEUE_UNTOUCHED:${await estado(mB)}`);
 void rA;
 const rB=await drainOutboxForTenant(worker,TB,{worker:"w1",consumers:[bueno]});
 ok(rB.delivered===1&&await estado(mB)==="DELIVERED","EACH_TENANT_DRAINS_ITS_OWN_QUEUE");
 // Y sin contexto de tenant el worker no ve NADA: la política forzada es lo que obliga a drenar por tenant.
 const aCiegas=await worker`select count(*)::int as n from outbox`;
 ok(Number(aCiegas[0]!.n)===0,"WITHOUT_TENANT_CONTEXT_WORKER_SEES_NOTHING");
}catch(e){result.status="FAIL";result.error=String(e);}
finally{await worker.end();await owner.end();}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
