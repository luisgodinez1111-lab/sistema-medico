import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { executeAtomicClinicalCommand } from "./packages/atomic-clinical-transaction-v3/src/index.ts";
const url=process.env.DATABASE_URL!.replace("-pooler","").replace(/([?&])channel_binding=require/,"$1").replace(/[?&]$/,"");
const sql=postgres(url,{max:20,prepare:false,onnotice:()=>{}});
const T="33333333-3333-3333-3333-333333333333", A="44444444-4444-4444-4444-444444444444";
const ctx=(rid=randomUUID())=>({tenantId:T,actorId:A,purpose:"TREATMENT",requestId:rid});
const mkCmd=(o:any)=>({commandId:randomUUID(),idempotencyKey:o.idempotencyKey??randomUUID(),aggregateId:o.aggregateId,aggregateType:"encounter",expectedVersion:o.expectedVersion??0,eventId:o.eventId??randomUUID(),eventType:"ENCOUNTER_OPENED",payload:{p:1},outboxId:o.outboxId??randomUUID(),topic:"clinical",auditId:randomUUID(),correlationId:randomUUID(),occurredAt:new Date().toISOString()});
const summarize=(rs:PromiseSettledResult<any>[])=>{const o:any={ok:0,replay:0,inprogress:0,conflict:0,other:0};for(const r of rs){if(r.status==="fulfilled"){r.value.replayed?o.replay++:o.ok++;}else{const m=String(r.reason?.message||r.reason);if(m.includes("IN_PROGRESS"))o.inprogress++;else if(m.includes("CONFLICT"))o.conflict++;else{o.other++;o.lastErr=m.slice(0,70);}}}return o;};
const results:any={};
try{
 const clean=async()=>{await sql`delete from clinical_events where tenant_id=${T}`;await sql`delete from outbox where tenant_id=${T}`;await sql`delete from command_idempotency where tenant_id=${T}`;await sql`delete from aggregate_versions where tenant_id=${T}`;};
 await clean();
 const A1="55555555-0000-0000-0000-0000000000a1"; const cmdA=mkCmd({aggregateId:A1,idempotencyKey:"idem-key-A",expectedVersion:0});
 const rsA=await Promise.allSettled(Array.from({length:12},()=>executeAtomicClinicalCommand(sql,ctx(),cmdA)));
 const evA=(await sql`select count(*)::int c from clinical_events where tenant_id=${T} and aggregate_id=${A1}`)[0].c;
 results.A_idempotency={outcomes:summarize(rsA),clinical_events_rows:evA,pass:(summarize(rsA).ok===1&&evA===1)};
 const B1="55555555-0000-0000-0000-0000000000b1";
 const cmdsB=Array.from({length:12},(_,i)=>mkCmd({aggregateId:B1,idempotencyKey:"idem-key-B-"+i,expectedVersion:0}));
 const rsB=await Promise.allSettled(cmdsB.map(c=>executeAtomicClinicalCommand(sql,ctx(),c)));
 const sB=summarize(rsB);
 const evB=(await sql`select count(*)::int c from clinical_events where tenant_id=${T} and aggregate_id=${B1}`)[0].c;
 const verB=(await sql`select version from aggregate_versions where tenant_id=${T} and aggregate_id=${B1}`)[0]?.version;
 results.B_optimistic={outcomes:sB,clinical_events_rows:evB,aggregate_version:Number(verB),pass:(sB.ok===1&&evB===1&&Number(verB)===1)};
 const C1="55555555-0000-0000-0000-0000000000c1", ckey="idem-key-C";
 const crash=postgres(url,{max:1,prepare:false,onnotice:()=>{}});
 try{ await crash.begin(async(t:any)=>{ await t`insert into command_idempotency(tenant_id,actor_id,key,request_hash,status,expires_at) values(${T},${A},${ckey},'deadbeef','IN_PROGRESS',now()+interval '1 hour')`; throw new Error("SIMULATED_CRASH"); }); }catch{} finally{ await crash.end({timeout:0}); }
 const leftover=(await sql`select count(*)::int c from command_idempotency where tenant_id=${T} and key=${ckey}`)[0].c;
 let retry="?"; try{ const r:any=await executeAtomicClinicalCommand(sql,ctx(),mkCmd({aggregateId:C1,idempotencyKey:ckey,expectedVersion:0})); retry=r.replayed?"REPLAY":"OK_RECOVERED"; }catch(e:any){ retry="FAIL:"+String(e.message).slice(0,50); }
 results.C_crash_recovery={leftover_inprogress_after_crash:leftover,retry_after_crash:retry,pass:(leftover===0&&retry==="OK_RECOVERED")};
 await clean();
}catch(e:any){ results.FATAL=String(e.message); }
finally{ await sql.end(); }
console.log(JSON.stringify(results,null,2));
const allpass=results.A_idempotency?.pass&&results.B_optimistic?.pass&&results.C_crash_recovery?.pass;
console.log(allpass?"RESULT: LIVE CONCURRENCY + CRASH RECOVERY PASS":"RESULT: REVISAR");
