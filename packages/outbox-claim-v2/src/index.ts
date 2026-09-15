export const CLAIM_SQL=`WITH candidates AS (
 SELECT id FROM outbox
 WHERE state IN ('PENDING','RETRY') AND COALESCE(available_at,next_attempt_at,created_at)<=now()
   AND (locked_until IS NULL OR locked_until<=now())
 ORDER BY COALESCE(available_at,next_attempt_at,created_at),id
 FOR UPDATE SKIP LOCKED LIMIT $1
)
UPDATE outbox o SET state='LEASED',locked_by=$2,locked_until=now()+($3::int * interval '1 millisecond'),
 attempts=o.attempts+1
FROM candidates c WHERE o.id=c.id
RETURNING o.id,o.tenant_id,o.topic,o.aggregate_id,o.payload,o.attempts,o.max_attempts,o.locked_until`;
export function retryDelayMs(attempt:number,entropy:number){const base=Math.min(300000,1000*2**Math.min(attempt,12));return base+(Math.abs(entropy)%Math.max(1,Math.floor(base*.2)));}
