import type{Sql,TransactionSql}from"postgres";import crypto from"node:crypto";import{canonicalize}from"../../canonical-json/src";import{ClinicalError}from"../../runtime-errors/src";import{assertTenantContext,type TenantContext}from"../../tenant-context/src";
export type ClinicalCommand=Readonly<{commandId:string;idempotencyKey:string;aggregateId:string;aggregateType:string;expectedVersion:number;eventId:string;eventType:string;payload:unknown;outboxId:string;topic:string;auditId:string;correlationId:string;occurredAt:string}>;
// `preflight` (opcional) corre DENTRO de la transacción, justo después de fijar el contexto de RLS y antes de tocar
// ningún agregado: si lanza, nada se escribe. Lo usa la comprobación de sesión revocada (auditoría R01-014) para que la
// decisión sea atómica con el comando, sin una transacción extra ni ventana entre comprobar y escribir.
// ---------- Auditoría 2026-09-19, anexo R06 (R06-19): el payload entraba a jsonb SIN validar ----------
//
// `payload` está tipado como `unknown` en la firma pública y se forzaba a `never` con un cast para satisfacer al
// compilador justo antes del INSERT. Es decir: el registro clínico inmutable aceptaba cualquier forma, y `zod` —que el
// repositorio ya usa en todos los cuerpos HTTP— no llegaba hasta aquí. Cualquier defecto de construcción de un comando
// (una clave mal escrita, un `undefined` que desaparece al serializar, un payload que no es un objeto) quedaba escrito
// para siempre en una tabla append-only, y el fold correspondiente lo descubría al leerlo, mucho después.
//
// Esta es la validación ESTRUCTURAL universal, en el kernel: la que vale para todos los agregados sin conocer ninguno.
// La validación por (aggregateType, kind) con esquema propio vive en la capa de aplicación (apps/web/lib/payload-schemas),
// que es la que sabe de dominios; el kernel garantiza el mínimo que hace que el evento sea legible.
export const MAX_PAYLOAD_BYTES=64*1024;
export function assertClinicalPayload(c:Pick<ClinicalCommand,"aggregateType"|"eventType"|"payload">):void{
 const p=c.payload;
 const ctx=`${c.aggregateType}/${c.eventType}`;
 if(p===null||typeof p!=="object"||Array.isArray(p))throw new ClinicalError("INVARIANT_VIOLATION",`Payload inválido (${ctx}): debe ser un objeto JSON, no ${p===null?"null":Array.isArray(p)?"un arreglo":typeof p}`,{aggregateType:c.aggregateType});
 const kind=(p as Record<string,unknown>)["kind"];
 if(typeof kind!=="string"||kind.trim()==="")throw new ClinicalError("INVARIANT_VIOLATION",`Payload inválido (${ctx}): falta el discriminador \`kind\`, con el que los folds deciden el estado del agregado`,{aggregateType:c.aggregateType});
 let json:string;
 try{json=JSON.stringify(p);}catch{throw new ClinicalError("INVARIANT_VIOLATION",`Payload inválido (${ctx}): no es serializable a JSON (referencia circular o valor no soportado)`,{aggregateType:c.aggregateType});}
 if(json===undefined)throw new ClinicalError("INVARIANT_VIOLATION",`Payload inválido (${ctx}): se serializa como undefined`,{aggregateType:c.aggregateType});
 // Una jsonb de megabytes en la tabla que TODA lectura clínica recorre degrada el camino caliente para siempre: el evento
 // es inmutable, así que el límite tiene que estar en la escritura.
 const bytes=Buffer.byteLength(json,"utf8");
 if(bytes>MAX_PAYLOAD_BYTES)throw new ClinicalError("INVARIANT_VIOLATION",`Payload inválido (${ctx}): ${bytes} bytes excede el máximo de ${MAX_PAYLOAD_BYTES}. El evento es inmutable: un payload enorme degrada para siempre toda lectura de la cadena.`,{aggregateType:c.aggregateType,bytes});
}
export async function executeAtomicClinicalCommand(sql:Sql,ctx:TenantContext,c:ClinicalCommand,preflight?:(tx:TransactionSql)=>Promise<void>){assertTenantContext(ctx);assertClinicalPayload(c);return sql.begin(async(tx:TransactionSql)=>{
 await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
 if(preflight)await preflight(tx);
 const h=crypto.createHash("sha256").update(canonicalize(c)).digest("hex");
 const claim=await tx`insert into command_idempotency(tenant_id,actor_id,key,request_hash,status,expires_at) values(${ctx.tenantId},${ctx.actorId},${c.idempotencyKey},${h},'IN_PROGRESS',now()+interval '24 hours') on conflict do nothing returning key`;
 // Reintento: la clave ya existe. `for update` BLOQUEA hasta que la transacción que la reclamó termine, así que al leerla
 // o el cuerpo difiere (conflicto real) o el comando ya está COMPLETED (replay). La tercera rama, IDEMPOTENCY_IN_PROGRESS,
 // es INALCANZABLE en este diseño —auditoría R01-027— porque la reclamación y el UPDATE a COMPLETED ocurren en la MISMA
 // transacción: nadie fuera de ella puede ver el estado intermedio, y si el proceso muere, Postgres revierte la fila.
 // Se conserva a propósito como red de seguridad: volvería a ser alcanzable el día que la reclamación se confirmara por
 // separado (p. ej. un worker que reclamara y ejecutara en dos pasos), y entonces fallar cerrado es lo correcto.
 if(!claim.length){const p=await tx`select request_hash,status,response_json from command_idempotency where tenant_id=${ctx.tenantId} and actor_id=${ctx.actorId} and key=${c.idempotencyKey} for update`;if(p[0]?.request_hash!==h)throw Error('IDEMPOTENCY_CONFLICT');if(p[0]?.status==='COMPLETED')return{replayed:true,response:p[0].response_json};throw Error('IDEMPOTENCY_IN_PROGRESS');}
 const v=await tx`insert into aggregate_versions(tenant_id,aggregate_id,version) values(${ctx.tenantId},${c.aggregateId},1) on conflict(tenant_id,aggregate_id) do update set version=aggregate_versions.version+1,updated_at=now() where aggregate_versions.version=${c.expectedVersion} returning version`;
 if(v.length!==1||Number(v[0]?.version)!==c.expectedVersion+1)throw Error('CONCURRENCY_CONFLICT');
 await tx`insert into clinical_events(id,tenant_id,aggregate_id,aggregate_type,sequence,actor_id,actor_type,authority,correlation_id,payload,schema_version,occurred_at) values(${c.eventId},${ctx.tenantId},${c.aggregateId},${c.aggregateType},${c.expectedVersion+1},${ctx.actorId},${ctx.actorType},${tx.json({purpose:ctx.purpose})},${c.correlationId},${tx.json(c.payload as never)},1,${c.occurredAt})`;
 await tx`insert into outbox(id,tenant_id,topic,aggregate_id,payload,state,available_at) values(${c.outboxId},${ctx.tenantId},${c.topic},${c.aggregateId},${tx.json({eventId:c.eventId} as never)},'PENDING',now())`;
 const audit=await tx`select app.append_audit_v17(${ctx.tenantId},${c.auditId},${ctx.actorId},'CLINICAL_COMMAND',${c.aggregateType},${tx.json({commandId:c.commandId,eventId:c.eventId} as never)}) as entry_hash`;
 const response={aggregateId:c.aggregateId,version:c.expectedVersion+1,eventId:c.eventId,outboxId:c.outboxId,auditId:c.auditId,auditHash:audit[0]?.entry_hash};
 await tx`update command_idempotency set status='COMPLETED',response_json=${tx.json(response)} where tenant_id=${ctx.tenantId} and actor_id=${ctx.actorId} and key=${c.idempotencyKey}`;return{replayed:false,response};});}

// ---------- Comando MULTI-AGREGADO atómico (auditoría M4) ----------
//
// `executeAtomicClinicalCommand` escribe UN agregado. Una corrección de laboratorio, en cambio, necesita que DOS hechos
// entren juntos o no entren: el resultado corregido (nuevo agregado, con `supersedes`) y la anotación del original
// (`supersededBy`). Antes eran dos comandos independientes con dos llaves de idempotencia: si el proceso moría entre uno y
// otro y el cliente no reintentaba, quedaba un estado parcial PERMANENTE (el valor corregido visible pero el original sin
// anotar, o al revés). Este primitivo mete N `legs` —cada uno su agregado, su `expectedVersion` y su evento— en UNA sola
// transacción bajo UNA llave de idempotencia: si cualquier leg falla el chequeo optimista, la transacción entera revierte y
// no se escribe nada. La invariante por agregado (secuencia = versión = expectedVersion+1) se conserva leg por leg, igual
// que en el comando simple; el camino simple de arriba NO se toca. La idempotencia es una sola fila: el reintento con la
// misma llave y el mismo cuerpo devuelve la respuesta COMPLETED guardada, sin reescribir ningún evento.
export type ClinicalLeg=Readonly<{aggregateId:string;aggregateType:string;expectedVersion:number;eventId:string;eventType:string;payload:unknown;outboxId:string;topic:string}>;
export type ClinicalMultiCommand=Readonly<{commandId:string;idempotencyKey:string;legs:readonly ClinicalLeg[];auditId:string;correlationId:string;occurredAt:string}>;
export async function executeAtomicMultiCommand(sql:Sql,ctx:TenantContext,c:ClinicalMultiCommand,preflight?:(tx:TransactionSql)=>Promise<void>){
 assertTenantContext(ctx);
 if(c.legs.length===0)throw new ClinicalError("INVARIANT_VIOLATION","Un comando multi-agregado necesita al menos un evento",{});
 for(const leg of c.legs)assertClinicalPayload(leg);
 // Dos legs sobre el MISMO agregado en una transacción romperían «secuencia = versión» (cada uno asume expectedVersion+1
 // por separado y el segundo chocaría o se adelantaría). Se prohíbe aquí, con un mensaje claro, en vez de en el SQL.
 const ids=new Set(c.legs.map(l=>l.aggregateId));if(ids.size!==c.legs.length)throw new ClinicalError("INVARIANT_VIOLATION","Un comando multi-agregado no puede tocar el mismo agregado dos veces en la misma transacción",{});
 return sql.begin(async(tx:TransactionSql)=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  if(preflight)await preflight(tx);
  const h=crypto.createHash("sha256").update(canonicalize(c)).digest("hex");
  const claim=await tx`insert into command_idempotency(tenant_id,actor_id,key,request_hash,status,expires_at) values(${ctx.tenantId},${ctx.actorId},${c.idempotencyKey},${h},'IN_PROGRESS',now()+interval '24 hours') on conflict do nothing returning key`;
  if(!claim.length){const p=await tx`select request_hash,status,response_json from command_idempotency where tenant_id=${ctx.tenantId} and actor_id=${ctx.actorId} and key=${c.idempotencyKey} for update`;if(p[0]?.request_hash!==h)throw Error('IDEMPOTENCY_CONFLICT');if(p[0]?.status==='COMPLETED')return{replayed:true,response:p[0].response_json};throw Error('IDEMPOTENCY_IN_PROGRESS');}
  const legs:Array<{aggregateId:string;version:number;eventId:string}>=[];
  for(const leg of c.legs){
   const v=await tx`insert into aggregate_versions(tenant_id,aggregate_id,version) values(${ctx.tenantId},${leg.aggregateId},1) on conflict(tenant_id,aggregate_id) do update set version=aggregate_versions.version+1,updated_at=now() where aggregate_versions.version=${leg.expectedVersion} returning version`;
   if(v.length!==1||Number(v[0]?.version)!==leg.expectedVersion+1)throw Error('CONCURRENCY_CONFLICT');
   await tx`insert into clinical_events(id,tenant_id,aggregate_id,aggregate_type,sequence,actor_id,actor_type,authority,correlation_id,payload,schema_version,occurred_at) values(${leg.eventId},${ctx.tenantId},${leg.aggregateId},${leg.aggregateType},${leg.expectedVersion+1},${ctx.actorId},${ctx.actorType},${tx.json({purpose:ctx.purpose})},${c.correlationId},${tx.json(leg.payload as never)},1,${c.occurredAt})`;
   await tx`insert into outbox(id,tenant_id,topic,aggregate_id,payload,state,available_at) values(${leg.outboxId},${ctx.tenantId},${leg.topic},${leg.aggregateId},${tx.json({eventId:leg.eventId} as never)},'PENDING',now())`;
   legs.push({aggregateId:leg.aggregateId,version:leg.expectedVersion+1,eventId:leg.eventId});
  }
  const audit=await tx`select app.append_audit_v17(${ctx.tenantId},${c.auditId},${ctx.actorId},'CLINICAL_COMMAND',${c.legs[0]!.aggregateType},${tx.json({commandId:c.commandId,eventIds:c.legs.map(l=>l.eventId)} as never)}) as entry_hash`;
  const response={commandId:c.commandId,legs,auditId:c.auditId,auditHash:audit[0]?.entry_hash};
  await tx`update command_idempotency set status='COMPLETED',response_json=${tx.json(response)} where tenant_id=${ctx.tenantId} and actor_id=${ctx.actorId} and key=${c.idempotencyKey}`;return{replayed:false,response};});}
