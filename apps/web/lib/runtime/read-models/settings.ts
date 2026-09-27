// Lote 11 (ADR-0300) — configuración del consultorio. Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import{type HttpTenantContext}from"../../../../../packages/http-principal/src";
import{withTenantTx}from"../db";
// EPIC S-CONFIG — Ajustes del consultorio (singleton por tenant, no PHI). Mismo kernel event-sourced:
// el estado actual = payload.settings del último evento OFFICE_SETTINGS_UPDATED. version = nº de eventos del
// agregado (concurrencia optimista If-Match). Si no hay eventos, settings vacío y version 0. RLS-scoped.
export type OfficeSettingsRead=Readonly<{settings:Record<string,unknown>;version:number}>;
export async function officeSettings(ctx:HttpTenantContext):Promise<OfficeSettingsRead>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.payload->'settings' as settings,
     (select count(*)::int from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=a.aggregate_id) as version
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='OfficeSettings' and a.payload->>'kind'='UPDATED'
   order by a.sequence desc limit 1`;
  const row=rows[0] as Record<string,unknown>|undefined;
  if(!row)return{settings:{},version:0};
  return{settings:(row.settings as Record<string,unknown>)??{},version:Number(row.version??0)};
 }) as Promise<OfficeSettingsRead>;
}
