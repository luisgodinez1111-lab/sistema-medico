// Analítica agregada del tenant (reportes). Auditoría R01-001: extraído del god-module `clinical-runtime.ts`.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{withTenantTx}from"./connection";

// EPIC S-REPORTES — Tendencia de consultas por día del tablero. Cuenta encuentros por el evento base
// ENCOUNTER_OPENED (kind OPENED) agrupados por la FECHA (día) en que ocurrieron, y el total de consultas
// firmadas (ENCOUNTER_SIGNED) para el indicador de expedientes cerrados. Determinista, RLS-scoped, sin PHI.
export type EncounterAnalytics=Readonly<{total:number;signed:number;byDay:ReadonlyArray<{date:string;count:number}>}>;
export async function encounterAnalytics(ctx:HttpTenantContext):Promise<EncounterAnalytics>{
 return withTenantTx(ctx,async tx=>{
  const dayRows=await tx`
   select to_char(a.occurred_at,'YYYY-MM-DD') as day, count(*)::int as n
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Encounter' and a.payload->>'kind'='OPENED'
   group by day order by day asc`;
  const signedRows=await tx`
   select count(*)::int as n from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Encounter' and a.payload->>'kind'='SIGNED'`;
  const byDay=dayRows.map(r=>{const o=r as Record<string,unknown>;return{date:String(o.day??""),count:Number(o.n??0)};});
  const total=byDay.reduce((s,d)=>s+d.count,0);
  const signed=Number((signedRows[0] as Record<string,unknown>|undefined)?.n??0);
  return{total,signed,byDay};
 });
}
// EPIC S-REPORTES — Medicamentos más prescritos del tablero. Toma cada agregado Medication cuyo ciclo llegó a
// MEDICATION_PRESCRIBED (una receta real, no solo propuesta), y agrupa por el drugCode del evento base
// MEDICATION_PROPOSED. Devuelve el top por frecuencia. Determinista, RLS-scoped, sin PHI (solo el fármaco).
export type PrescribedDrugRow=Readonly<{drugCode:string;count:number}>;
export async function medicationsPrescribed(ctx:HttpTenantContext):Promise<ReadonlyArray<PrescribedDrugRow>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select base.payload->>'drugCode' as drug, count(*)::int as n
   from clinical_events base
   where base.tenant_id=${ctx.tenantId} and base.aggregate_type='Medication' and base.payload->>'kind'='PROPOSED'
     and exists (select 1 from clinical_events pr where pr.tenant_id=${ctx.tenantId} and pr.aggregate_id=base.aggregate_id and pr.payload->>'kind'='PRESCRIBED')
   group by drug order by n desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{drugCode:String(o.drug??""),count:Number(o.n??0)};}).filter(x=>x.drugCode);
 });
}
// EPIC S-REPORTES — Tipos de consulta del tablero (desde la agenda). Cuenta las citas por el evento base
// APPOINTMENT_SCHEDULED agrupadas por su apptType (CONSULTA_GENERAL/CONTROL/PRIMERA_VEZ/PROCEDIMIENTO/
// VACUNACION/RESULTADOS/URGENCIA); las citas sin tipo caen en 'SIN_TIPO'. Determinista, RLS-scoped, sin PHI.
export type AppointmentTypeRow=Readonly<{apptType:string;count:number}>;
export async function appointmentsByType(ctx:HttpTenantContext):Promise<ReadonlyArray<AppointmentTypeRow>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select coalesce(a.payload->>'apptType','SIN_TIPO') as appt_type, count(*)::int as n
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Appointment' and a.payload->>'kind'='SCHEDULED'
   group by appt_type order by n desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{apptType:String(o.appt_type??"SIN_TIPO"),count:Number(o.n??0)};});
 });
}
// EPIC S-REPORTES — Desenlaces de la agenda para indicadores de calidad. Por cada cita (agregado Appointment)
// toma su ESTADO final = último kind (SCHEDULED/CHECKED_IN/COMPLETED/CANCELLED/NO_SHOW) y agrega los conteos.
// Base de la tasa de asistencia efectiva y de inasistencia. Determinista, RLS-scoped, sin PHI.
export type AppointmentOutcomes=Readonly<{total:number;completed:number;noShow:number;cancelled:number;checkedIn:number;scheduled:number}>;
export async function appointmentOutcomes(ctx:HttpTenantContext):Promise<AppointmentOutcomes>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select coalesce((select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1),'SCHEDULED') as last_kind, count(*)::int as n
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Appointment' and a.payload->>'kind'='SCHEDULED'
   group by last_kind`;
  const by:Record<string,number>={};let total=0;
  for(const r of rows){const o=r as Record<string,unknown>;const k=String(o.last_kind??"SCHEDULED");const n=Number(o.n??0);by[k]=(by[k]??0)+n;total+=n;}
  return{total,completed:by.COMPLETED??0,noShow:by.NO_SHOW??0,cancelled:by.CANCELLED??0,checkedIn:by.CHECKED_IN??0,scheduled:by.SCHEDULED??0};
 });
}
