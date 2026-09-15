
import type{Sql}from"postgres";import{assertTenantContext,type TenantContext}from"../../tenant-context/src";import{canonicalize}from"../../canonical-json/src";import crypto from"node:crypto";
export type AggregateKind="PATIENT"|"ENCOUNTER"|"RESULT"|"MEDICATION"|"OBLIGATION";
export type AtomicCommand=Readonly<{commandId:string;idempotencyKey:string;aggregateId:string;aggregateType:AggregateKind;expectedVersion:number;eventId:string;eventType:string;eventPayload:unknown;outboxId:string;topic:string;auditId:string;auditAction:string;correlationId:string;occurredAt:string}>;
export async function atomicClinicalWriteV2(sql:Sql,ctx:TenantContext,c:AtomicCommand){
 assertTenantContext(ctx);
 await sql`select set_config('app.tenant_id',${ctx.tenantId},true)`;
 await sql`select set_config('app.actor_id',${ctx.actorId},true)`;
 await sql`select set_config('app.purpose',${ctx.purpose},true)`;
 await sql`select set_config('app.request_id',${ctx.requestId},true)`;
 const requestHash=crypto.createHash("sha256").update(canonicalize(c)).digest("hex");
 const idem=await sql`insert into command_idempotency(tenant_id,actor_id,key,request_hash,status,expires_at)
 values(${ctx.tenantId},${ctx.actorId},${c.idempotencyKey},${requestHash},'IN_PROGRESS',now()+interval '24 hours')
 on conflict(tenant_id,actor_id,key) do nothing returning request_hash,status,response_json`;
 if(idem.length===0){
  const prior=await sql`select request_hash,status,response_json from command_idempotency where tenant_id=${ctx.tenantId} and actor_id=${ctx.actorId} and key=${c.idempotencyKey} for update`;
  if(prior[0]?.request_hash!==requestHash)throw new Error("IDEMPOTENCY_CONFLICT");
  if(prior[0]?.status==="COMPLETED")return{replayed:true,response:prior[0].response_json};
  throw new Error("IDEMPOTENCY_IN_PROGRESS");
 }
 const version=await sql`insert into aggregate_versions(tenant_id,aggregate_id,version) values(${ctx.tenantId},${c.aggregateId},1)
 on conflict(tenant_id,aggregate_id) do update set version=aggregate_versions.version+1,updated_at=now()
 where aggregate_versions.version=${c.expectedVersion} returning version`;
 if(version.length!==1||Number(version[0]?.version)!==c.expectedVersion+1)throw new Error("CONCURRENCY_CONFLICT");
 await sql`insert into clinical_events(id,tenant_id,aggregate_id,aggregate_type,sequence,actor_id,actor_type,authority,correlation_id,payload,schema_version,occurred_at)
 values(${c.eventId},${ctx.tenantId},${c.aggregateId},${c.aggregateType},${c.expectedVersion+1},${ctx.actorId},'HUMAN',${sql.json({purpose:ctx.purpose})},${c.correlationId},${sql.json(c.eventPayload as never)},1,${c.occurredAt})`;
 await sql`insert into outbox(id,tenant_id,topic,aggregate_id,payload,state,available_at)
 values(${c.outboxId},${ctx.tenantId},${c.topic},${c.aggregateId},${sql.json({eventId:c.eventId} as never)},'PENDING',now())`;
 const auditPayload={commandId:c.commandId,eventId:c.eventId,aggregateId:c.aggregateId};
 const auditHash=crypto.createHash("sha256").update(canonicalize(auditPayload)).digest("hex");
 await sql`insert into audit_chain_v3(tenant_id,id,actor_id,action,resource,payload,entry_hash)
 values(${ctx.tenantId},${c.auditId},${ctx.actorId},${c.auditAction},${c.aggregateType},${sql.json(auditPayload as never)},${auditHash})`;
 const response={aggregateId:c.aggregateId,version:c.expectedVersion+1,eventId:c.eventId,outboxId:c.outboxId,auditId:c.auditId};
 await sql`update command_idempotency set status='COMPLETED',response_json=${sql.json(response)} where tenant_id=${ctx.tenantId} and actor_id=${ctx.actorId} and key=${c.idempotencyKey}`;
 return{replayed:false,response};
}
