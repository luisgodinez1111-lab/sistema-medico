// Lote 11 (ADR-0300) — read models de vacunación. Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import{type HttpTenantContext}from"../../../../../packages/http-principal/src";
import{withTenantTx}from"../db";
// EPIC BK — Códigos de vacunas ADMINISTRADAS del paciente (último kind ADMINISTERED). RLS-scoped.
// Auditoría C-10: las dosis periódicas (influenza anual, Td decenal) se deciden por la FECHA de la última aplicación.
export type AdministeredVaccine=Readonly<{code:string;occurredAt:string|null}>;
export async function administeredVaccines(ctx:HttpTenantContext,patientId:string):Promise<AdministeredVaccine[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'vaccineCode' as code,
     (select occurred_at from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and c.payload->>'kind'='ADMINISTERED' order by sequence desc limit 1) as administered_at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Immunization' and r.payload->>'kind'='DUE' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1)='ADMINISTERED'`;
  return rows.map(x=>({code:String(x.code??""),occurredAt:x.administered_at?new Date(String(x.administered_at)).toISOString():null})).filter(v=>v.code);
 }) as Promise<AdministeredVaccine[]>;
}
export async function administeredVaccineCodes(ctx:HttpTenantContext,patientId:string):Promise<string[]>{return(await administeredVaccines(ctx,patientId)).map(v=>v.code);}
// EPIC V/UI — Registro de vacunas de TODA la clínica (vista Vacunas). Por cada agregado Immunization toma el
// evento base IMMUNIZATION_DUE (vacuna/dosis/paciente) y su ESTADO por la última transición (DUE->PENDING,
// ADMINISTERED->COMPLETE, REFUSED, ADVERSE_EVENT). Une el lote/sitio/fecha del evento ADMINISTERED (si existe)
// y el nombre del paciente. RLS-scoped.
export type ImmunizationRow=Readonly<{immunizationId:string;patientId:string;patientName:string;vaccine:string;dose:string;lot:string;site:string;status:"COMPLETE"|"PENDING"|"REFUSED"|"ADVERSE";appliedAt:string;registeredBy:string}>;
const IMM_STATUS:Record<string,"COMPLETE"|"PENDING"|"REFUSED"|"ADVERSE">={ADMINISTERED:"COMPLETE",DUE:"PENDING",REFUSED:"REFUSED",ADVERSE_EVENT:"ADVERSE"};
export async function immunizationRegistry(ctx:HttpTenantContext):Promise<ImmunizationRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'vaccineCode' as vaccine,
     a.payload->>'dose' as dose, a.occurred_at as due_at, a.actor_id as actor_id,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind,
     (select payload->>'lot' from clinical_events ad where ad.tenant_id=${ctx.tenantId} and ad.aggregate_id=a.aggregate_id and ad.payload->>'kind'='ADMINISTERED' order by sequence desc limit 1) as lot,
     (select payload->>'site' from clinical_events ad where ad.tenant_id=${ctx.tenantId} and ad.aggregate_id=a.aggregate_id and ad.payload->>'kind'='ADMINISTERED' order by sequence desc limit 1) as site,
     (select occurred_at from clinical_events ad where ad.tenant_id=${ctx.tenantId} and ad.aggregate_id=a.aggregate_id and ad.payload->>'kind'='ADMINISTERED' order by sequence desc limit 1) as applied_at,
     (select p.payload->>'name' from clinical_events p where p.tenant_id=${ctx.tenantId} and p.aggregate_type='Patient' and p.payload->>'kind'='REGISTERED' and p.aggregate_id=(a.payload->>'patientId')::uuid limit 1) as patient_name
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Immunization' and a.payload->>'kind'='DUE'
   order by coalesce((select occurred_at from clinical_events ad where ad.tenant_id=${ctx.tenantId} and ad.aggregate_id=a.aggregate_id and ad.payload->>'kind'='ADMINISTERED' order by sequence desc limit 1), a.occurred_at) desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;const applied=o.applied_at??o.due_at;return{
   immunizationId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   vaccine:String(o.vaccine??""),dose:String(o.dose??""),lot:String(o.lot??""),site:String(o.site??""),
   status:IMM_STATUS[String(o.last_kind??"DUE")]??"PENDING",
   appliedAt:applied?new Date(String(applied)).toISOString():"",registeredBy:String(o.actor_id??"")};});
 }) as Promise<ImmunizationRow[]>;
}
