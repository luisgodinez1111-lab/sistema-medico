// Auditoría 2026-09-19, anexo R06 (R06-F16, lote 22) — UN MENSAJE ARRENDADO POR UN WORKER QUE MUERE SE PERDÍA PARA SIEMPRE.
//
// Lo encontró la primera prueba en vivo del drenado, no una lectura: el filtro era `state IN ('PENDING','RETRY')`, de modo que
// la condición `locked_until<=now()` solo se aplicaba a filas que NO estaban arrendadas —donde es trivialmente cierta— y una
// fila en `LEASED` quedaba fuera del candidato. Consecuencia: si un worker reclama un mensaje y se cae antes de entregarlo, el
// mensaje se queda en LEASED y **ningún worker lo vuelve a tomar nunca**. La cola pierde el mensaje sin una sola señal de
// error, que es la peor forma de perderlo.
//
// Que era un descuido y no un diseño lo demuestran dos cosas del propio repositorio: el índice `outbox_fencing_claim_idx`
// incluye `'LEASED'` en su predicado —se creó para reclamar arrendamientos vencidos—, y la función pura `canClaim` de
// `packages/durable-outbox` sí contempla el caso (`state==="LEASED" && leaseUntil<=now`). La primitiva y el SQL que de verdad
// corre decían cosas distintas; ganaba el SQL.
export const CLAIM_SQL=`WITH candidates AS (
 SELECT id FROM outbox
 WHERE (
   -- Listos para un primer intento o un reintento.
   (state IN ('PENDING','RETRY') AND (locked_until IS NULL OR locked_until<=now()))
   -- O arrendados por un worker que ya no responde: el lease VENCIÓ y el mensaje vuelve a estar disponible.
   OR (state='LEASED' AND locked_until IS NOT NULL AND locked_until<=now())
 ) AND COALESCE(available_at,next_attempt_at,created_at)<=now()
 ORDER BY COALESCE(available_at,next_attempt_at,created_at),id
 FOR UPDATE SKIP LOCKED LIMIT $1
)
UPDATE outbox o SET state='LEASED',locked_by=$2,locked_until=now()+($3::int * interval '1 millisecond'),
 attempts=o.attempts+1
FROM candidates c WHERE o.id=c.id
RETURNING o.id,o.tenant_id,o.topic,o.aggregate_id,o.payload,o.attempts,o.max_attempts,o.locked_until`;
export function retryDelayMs(attempt:number,entropy:number){const base=Math.min(300000,1000*2**Math.min(attempt,12));return base+(Math.abs(entropy)%Math.max(1,Math.floor(base*.2)));}
