// Lote 11 (ADR-0300) — expediente: timeline del paciente, worklist del tenant y renglones del expediente. Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import{type HttpTenantContext}from"../../../../../packages/http-principal/src";
import{withTenantTx}from"../db";
import{decodeCursor,encodeCursor,type Page,PAGE_LIMIT_MAX}from"../pagination";
import{lifecycleEventOnly}from"../sql";
// EPIC N — Timeline del paciente: un item por agregado clínico del paciente, con tipo, último kind
// (estado), versión y fechas. RLS-scoped. SIN PHI: solo metadatos, nunca el contenido clínico.
export type TimelineItem=Readonly<{aggregateType:string;aggregateId:string;latestKind:string;status:string;version:number;openedAt:string;lastAt:string}>;
export async function readPatientTimeline(ctx:HttpTenantContext,patientId:string,page:{limit:number;cursor?:string|null}={limit:PAGE_LIMIT_MAX}):Promise<Page<TimelineItem>>{
 const after=decodeCursor(page.cursor,2);const afterAt=after?String(after[0]):null,afterId=after?String(after[1]):null;
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.aggregate_id, r.aggregate_type,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and ${lifecycleEventOnly(tx)} order by sequence desc limit 1) as latest_kind,
     (select payload->>'status' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and ${lifecycleEventOnly(tx)} order by sequence desc limit 1) as latest_status,
     max(r.sequence) as version, min(r.occurred_at) as opened_at, max(r.occurred_at) as last_at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_id in (
     select aggregate_id from clinical_events where tenant_id=${ctx.tenantId} and sequence=1 and payload->>'patientId'=${patientId})
   group by r.aggregate_id, r.aggregate_type
   having (${afterAt}::timestamptz is null or (min(r.occurred_at), r.aggregate_id::text) < (${afterAt}::timestamptz, ${afterId}::text))
   order by min(r.occurred_at) desc, r.aggregate_id desc
   limit ${page.limit+1}`;
  const items=rows.slice(0,page.limit).map(x=>({aggregateType:String(x.aggregate_type),aggregateId:String(x.aggregate_id),latestKind:String(x.latest_kind??""),status:String(x.latest_status??""),version:Number(x.version),openedAt:new Date(String(x.opened_at)).toISOString(),lastAt:new Date(String(x.last_at)).toISOString()}));
  const last=items[items.length-1];
  return{items,nextCursor:rows.length>page.limit&&last?encodeCursor([last.openedAt,last.aggregateId]):null};
 }) as Promise<Page<TimelineItem>>;
}
// EPIC AC — Worklist poblacional: un renglón por agregado clínico del tenant (todos los pacientes),
// con su patientId y su último kind (estado). RLS-scoped al tenant. SIN PHI: solo tipo/estado/ids.
export type PanelRowData=Readonly<{aggregateType:string;aggregateId:string;patientId:string;latestKind:string;status:string}>;
export async function readTenantOpenAggregates(ctx:HttpTenantContext):Promise<ReadonlyArray<PanelRowData>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.aggregate_id, r.aggregate_type, r.payload->>'patientId' as patient_id,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and ${lifecycleEventOnly(tx)} order by sequence desc limit 1) as latest_kind,
     (select payload->>'status' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) as latest_status
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.sequence=1 and r.payload->>'patientId' is not null`;
  return rows.map(x=>({aggregateType:String(x.aggregate_type),aggregateId:String(x.aggregate_id),patientId:String(x.patient_id),latestKind:String(x.latest_kind??""),status:String(x.latest_status??"")}));
 }) as Promise<ReadonlyArray<PanelRowData>>;
}
// EPIC AB — Manifiesto del expediente: filas estructurales (agregado/secuencia/kind/fecha) de TODOS
// los agregados del paciente. RLS-scoped. SIN volcar payloads PHI: solo el kind (estado) y la fecha.
export type RecordRow=Readonly<{aggregateType:string;aggregateId:string;sequence:number;kind:string;occurredAt:string}>;
export async function readPatientRecordRows(ctx:HttpTenantContext,patientId:string):Promise<ReadonlyArray<RecordRow>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.aggregate_id, r.aggregate_type, r.sequence, r.payload->>'kind' as kind, r.occurred_at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_id in (
     select aggregate_id from clinical_events where tenant_id=${ctx.tenantId} and sequence=1 and payload->>'patientId'=${patientId})
   order by r.aggregate_id, r.sequence`;
  return rows.map(x=>({aggregateType:String(x.aggregate_type),aggregateId:String(x.aggregate_id),sequence:Number(x.sequence),kind:String(x.kind??""),occurredAt:String(x.occurred_at)}));
 }) as Promise<ReadonlyArray<RecordRow>>;
}
