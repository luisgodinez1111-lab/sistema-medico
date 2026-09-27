// Lote 11 (ADR-0300) — agenda del consultorio. Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import{type HttpTenantContext}from"../../../../../packages/http-principal/src";
import{withTenantTx}from"../db";
// EPIC CM — Agenda del día: citas cuyo startAt cae en [fromIso, toIso), con estado (última transición)
// y nombre del paciente. RLS-scoped. Comparación por string ISO (orden lexicográfico correcto).
export type AgendaAppt=Readonly<{appointmentId:string;patientId:string;patientName:string;startAt:string;endAt:string|null;reason:string;consultorio:string|null;apptType:string|null;status:string;version:number}>;
export async function agendaForDate(ctx:HttpTenantContext,fromIso:string,toIso:string):Promise<AgendaAppt[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'startAt' as start_at, a.payload->>'endAt' as end_at,
     a.payload->>'reason' as reason, a.payload->>'consultorio' as consultorio, a.payload->>'apptType' as appt_type,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as status,
     (select count(*)::int from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=a.aggregate_id) as version,
     (select p.payload->>'name' from clinical_events p where p.tenant_id=${ctx.tenantId} and p.aggregate_type='Patient' and p.payload->>'kind'='REGISTERED' and p.aggregate_id=(a.payload->>'patientId')::uuid limit 1) as patient_name
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Appointment' and a.payload->>'kind'='SCHEDULED'
     and a.payload->>'startAt' >= ${fromIso} and a.payload->>'startAt' < ${toIso}
   order by a.payload->>'startAt' asc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   appointmentId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   startAt:String(o.start_at??""),endAt:o.end_at?String(o.end_at):null,reason:String(o.reason??""),
   consultorio:o.consultorio?String(o.consultorio):null,apptType:o.appt_type?String(o.appt_type):null,status:String(o.status??"SCHEDULED"),version:Number(o.version??1)};});
 }) as Promise<AgendaAppt[]>;
}
