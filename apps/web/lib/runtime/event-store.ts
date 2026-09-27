// Lote 11 (ADR-0300) — lectura directa del event store (streams de agregado, payload por id de evento, encuentro). Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
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
