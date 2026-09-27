// Lote 11 (ADR-0300) — lectura directa del event store (streams de agregado, payload por id de evento, encuentro). Extraído de
// apps/web/lib/clinical-runtime.ts en 11.1; `readAggregateStream` (lectura tipada) es la corrección del hallazgo D4.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{ClinicalError}from"../../../../packages/runtime-errors/src";
import{withTenantTx}from"./db";
// EPIC D — Lectura RLS-scoped del stream de eventos CON payload (para reconstruir estado).
// El payload es contenido clínico (fuente de verdad, RLS-aislado); nunca se loguea.
export async function readEncounterEvents(ctx:HttpTenantContext,encounterId:string):Promise<ReadonlyArray<{sequence:number;payload:Record<string,unknown>}>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`select sequence,payload from clinical_events where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId} order by sequence`;
  return rows.map(r=>({sequence:Number(r.sequence),payload:(r.payload??{}) as Record<string,unknown>}));
 }) as Promise<ReadonlyArray<{sequence:number;payload:Record<string,unknown>}>>;
}
// EPIC G — Lector genérico de eventos de un agregado (RLS-scoped, con payload).
// Payload de UN evento por su id, acotado al agregado esperado (RLS-scoped). El id del evento es determinista respecto de
// la llave de idempotencia (derivedUuid(key,"event")), así que esto responde: "¿esta llave ya produjo su evento, y con qué?".
export async function readEventPayloadById(ctx:HttpTenantContext,eventId:string,aggregateId:string):Promise<Record<string,unknown>|undefined>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`select payload from clinical_events where tenant_id=${ctx.tenantId} and id=${eventId} and aggregate_id=${aggregateId} limit 1`;
  const p=rows[0]?.payload;return p&&typeof p==="object"?p as Record<string,unknown>:undefined;
 }) as Promise<Record<string,unknown>|undefined>;
}
export async function readAggregateEvents(ctx:HttpTenantContext,aggregateId:string):Promise<ReadonlyArray<{sequence:number;payload:Record<string,unknown>}>>{
 return readEncounterEvents(ctx,aggregateId);
}
// Hallazgo D4 del lote 11 — stream de UN agregado de un TIPO dado; es la lectura de todo caso de uso cableado (las lecturas
// sin tipo de arriba quedan para los módulos NOT_WIRED). Antes la lectura ignoraba `aggregate_type`: una transición de alergia
// sobre el id de un paciente plegaba el stream del paciente y escribía en él (el paciente quedaba en 500 para siempre).
//   · id inexistente, o que pertenece a OTRO tipo de agregado (su génesis es de otro tipo) -> [] (el caso de uso responde 404);
//   · stream que mezcla tipos (contaminado antes de esta corrección) -> INVARIANT_VIOLATION explícito: nunca se pliega a medias.
export async function readAggregateStream(ctx:HttpTenantContext,aggregateType:string,aggregateId:string):Promise<ReadonlyArray<{sequence:number;payload:Record<string,unknown>}>>{
 const rows=await withTenantTx(ctx,async tx=>
  tx`select sequence,aggregate_type,payload from clinical_events where tenant_id=${ctx.tenantId} and aggregate_id=${aggregateId} order by sequence`) as ReadonlyArray<Record<string,unknown>>;
 if(rows.length===0||String(rows[0]!.aggregate_type)!==aggregateType)return [];
 if(rows.some(r=>String(r.aggregate_type)!==aggregateType))throw new ClinicalError("INVARIANT_VIOLATION",`${aggregateType} stream mixes aggregate types`,{aggregateType});
 return rows.map(r=>({sequence:Number(r.sequence),payload:(r.payload??{}) as Record<string,unknown>}));
}
export type EncounterView=Readonly<{encounterId:string;version:number;events:ReadonlyArray<{sequence:number;type:string;occurredAt:string}>}>;
// Lectura RLS-scoped del agregado (sin payload clínico: solo metadatos no-PHI).
export async function readEncounter(ctx:HttpTenantContext,encounterId:string):Promise<EncounterView|null>{
 return withTenantTx(ctx,async tx=>{
  const agg=await tx`select version from aggregate_versions where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId}`;
  const head=agg[0];
  if(!head)return null;
  const events=await tx`select sequence,aggregate_type,occurred_at from clinical_events where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId} order by sequence`;
  return{
   encounterId,
   version:Number(head.version),
   events:events.map(e=>({sequence:Number(e.sequence),type:String(e.aggregate_type),occurredAt:String(e.occurred_at)})),
  };
 }) as Promise<EncounterView|null>;
}
