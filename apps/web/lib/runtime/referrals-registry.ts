// EPIC G/UI (Lote G) — Registro POBLACIONAL de interconsultas de TODA la clínica + directorio de destinatarios.
// Una fila por interconsulta (agregado Referral): especialidad, motivo, DESTINATARIO (médico/institución), prioridad,
// tipo, paciente y ESTADO por la última transición (REQUESTED / ACCEPTED / DECLINED / COMPLETED / CANCELLED). Conteos
// (abiertas/completadas/pacientes/destinatarios distintos) calculados EN LA BASE. Une el nombre del paciente. RLS-scoped.
//
// El «directorio» se auto-forma con los destinatarios ya usados (distintos), sin un agregado nuevo. Módulo propio para
// no engordar registries.ts (R01-001). Fecha = hecho clínico (`occurred_at`), como en los demás registros.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{withTenantTx}from"./connection";
import{type RegistryQuery,porPaciente,nombreDePaciente,ultimaTransicion,despuesDelCursor,paginaOrdenada}from"./read-model-joins";
import{type Page,armarPagina,limiteDe,decodeCursor}from"./pagination";
export type ReferralRow=Readonly<{referralId:string;patientId:string;patientName:string;specialty:string;reason:string;recipientName:string;recipientInstitution:string;priority:string;referralType:string;status:"REQUESTED"|"ACCEPTED"|"DECLINED"|"COMPLETED"|"CANCELLED";requestedAt:string}>;
const REF_STATUS:Record<string,ReferralRow["status"]>={REQUESTED:"REQUESTED",ACCEPTED:"ACCEPTED",DECLINED:"DECLINED",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED"};
export async function referralsRegistry(ctx:HttpTenantContext,q?:RegistryQuery):Promise<Page<ReferralRow>&{total:number;openCount:number;completedCount:number;patientsCount:number;recipientsCount:number}>{
 const limit=limiteDe(q),after=decodeCursor(q?.cursor,2);
 return withTenantTx(ctx,async tx=>{
  const sum=await tx`
   select count(*)::int as total,
     count(*) filter (where lk.kind in ('REQUESTED','ACCEPTED'))::int as open,
     count(*) filter (where lk.kind='COMPLETED')::int as completed,
     count(distinct a.payload->>'patientId')::int as patients,
     count(distinct nullif(a.payload->>'recipientName',''))::int as recipients
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId)}
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Referral' and a.payload->>'kind'='REQUESTED' ${porPaciente(tx,q)}`;
  const s=(sum as Array<Record<string,unknown>>)[0]??{};
  const rows=await tx`
   select a.occurred_at as cursor_at, a.aggregate_id, a.payload->>'patientId' as pid,
     a.payload->>'specialty' as specialty, a.payload->>'reason' as reason, a.payload->>'recipientName' as recipient_name,
     a.payload->>'recipientInstitution' as recipient_institution, a.payload->>'priority' as priority,
     a.payload->>'referralType' as referral_type, a.occurred_at as requested_at, lk.kind as last_kind, pn.name as patient_name
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId)}
   ${nombreDePaciente(tx,ctx.tenantId)}
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Referral' and a.payload->>'kind'='REQUESTED'
     ${porPaciente(tx,q)}
     ${despuesDelCursor(tx,after)}
   ${paginaOrdenada(tx,limit)}`;
  const page=armarPagina(rows,limit,r=>{const o=r as Record<string,unknown>;return{
   referralId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   specialty:String(o.specialty??""),reason:String(o.reason??""),recipientName:String(o.recipient_name??""),
   recipientInstitution:String(o.recipient_institution??""),priority:String(o.priority??""),referralType:String(o.referral_type??""),
   status:REF_STATUS[String(o.last_kind??"REQUESTED")]??"REQUESTED",
   requestedAt:o.requested_at?new Date(String(o.requested_at)).toISOString():""};});
  return{...page,total:Number(s.total??0),openCount:Number(s.open??0),completedCount:Number(s.completed??0),patientsCount:Number(s.patients??0),recipientsCount:Number(s.recipients??0)};
 });
}
