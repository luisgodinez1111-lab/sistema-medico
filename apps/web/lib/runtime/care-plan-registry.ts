// EPIC E/UI (Lote E) — Registro POBLACIONAL de planes de cuidado de TODA la clínica (vista Plan de cuidado › «Toda la
// clínica»). Una fila por plan (agregado CarePlan): categoría, objetivo, paciente y ESTADO por la última transición
// (PROPOSED / ACTIVATED·RESUMED→ACTIVE / HELD→ON_HOLD / ACHIEVED / CANCELLED). Conteos (activos/en pausa/logrados/
// pacientes) calculados EN LA BASE. Une el nombre del paciente. RLS-scoped.
//
// Módulo propio por el mismo criterio que separó vitals-registry / lab-facts: `registries.ts` no debe pasar de 300
// líneas (R01-001). La «fecha de propuesta» es el hecho clínico (`occurred_at`), como en los demás registros.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{withTenantTx}from"./connection";
import{type RegistryQuery,porPaciente,nombreDePaciente,ultimaTransicion,despuesDelCursor,paginaOrdenada}from"./read-model-joins";
import{type Page,armarPagina,limiteDe,decodeCursor}from"./pagination";
export type CarePlanRow=Readonly<{carePlanId:string;patientId:string;patientName:string;category:string;goal:string;status:"PROPOSED"|"ACTIVE"|"ON_HOLD"|"ACHIEVED"|"CANCELLED";proposedAt:string}>;
const CP_STATUS:Record<string,CarePlanRow["status"]>={PROPOSED:"PROPOSED",ACTIVATED:"ACTIVE",RESUMED:"ACTIVE",HELD:"ON_HOLD",ACHIEVED:"ACHIEVED",CANCELLED:"CANCELLED"};
export async function carePlanRegistry(ctx:HttpTenantContext,q?:RegistryQuery):Promise<Page<CarePlanRow>&{total:number;activeCount:number;onHoldCount:number;achievedCount:number;patientsCount:number}>{
 const limit=limiteDe(q),after=decodeCursor(q?.cursor,2);
 return withTenantTx(ctx,async tx=>{
  // Conteos por ESTADO (última transición) y pacientes distintos, calculados en la base sobre todo el registro.
  const sum=await tx`
   select count(*)::int as total,
     count(*) filter (where lk.kind in ('ACTIVATED','RESUMED'))::int as active,
     count(*) filter (where lk.kind='HELD')::int as on_hold,
     count(*) filter (where lk.kind='ACHIEVED')::int as achieved,
     count(distinct a.payload->>'patientId')::int as patients
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId)}
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='CarePlan' and a.payload->>'kind'='PROPOSED' ${porPaciente(tx,q)}`;
  const s=(sum as Array<Record<string,unknown>>)[0]??{};
  const rows=await tx`
   select a.occurred_at as cursor_at, a.aggregate_id, a.payload->>'patientId' as pid,
     a.payload->>'category' as category, a.payload->>'goal' as goal, a.occurred_at as proposed_at,
     lk.kind as last_kind, pn.name as patient_name
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId)}
   ${nombreDePaciente(tx,ctx.tenantId)}
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='CarePlan' and a.payload->>'kind'='PROPOSED'
     ${porPaciente(tx,q)}
     ${despuesDelCursor(tx,after)}
   ${paginaOrdenada(tx,limit)}`;
  const page=armarPagina(rows,limit,r=>{const o=r as Record<string,unknown>;return{
   carePlanId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   category:String(o.category??""),goal:String(o.goal??""),
   status:CP_STATUS[String(o.last_kind??"PROPOSED")]??"PROPOSED",
   proposedAt:o.proposed_at?new Date(String(o.proposed_at)).toISOString():""};});
  return{...page,total:Number(s.total??0),activeCount:Number(s.active??0),onHoldCount:Number(s.on_hold??0),achievedCount:Number(s.achieved??0),patientsCount:Number(s.patients??0)};
 });
}
