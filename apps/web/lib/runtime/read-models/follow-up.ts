// Lote 11 (ADR-0300) — seguimiento: plan de cuidados, obligaciones y los contadores del gate de firma (Zero-Lost-Follow-Up). Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import{type HttpTenantContext}from"../../../../../packages/http-principal/src";
import{signatureBlockReason,type SignatureBlockReason}from"../../../../../packages/obligation-fold/src";
import{withTenantTx}from"../db";
// EPIC X/UI — Metas del plan de cuidados de UN paciente (vista Plan de cuidado). Por cada agregado CarePlan
// toma el evento base CAREPLAN_PROPOSED (categoría/meta) y su ESTADO por la última transición
// (PROPOSED/ACTIVATED/RESUMED->ACTIVE, ON_HOLD, ACHIEVED, CANCELLED). RLS-scoped.
export type CarePlanGoal=Readonly<{carePlanId:string;category:string;goal:string;status:"PROPOSED"|"ACTIVE"|"ON_HOLD"|"ACHIEVED"|"CANCELLED";recordedAt:string}>;
const CAREPLAN_STATUS:Record<string,"PROPOSED"|"ACTIVE"|"ON_HOLD"|"ACHIEVED"|"CANCELLED">={PROPOSED:"PROPOSED",ACTIVATED:"ACTIVE",RESUMED:"ACTIVE",HELD:"ON_HOLD",ACHIEVED:"ACHIEVED",CANCELLED:"CANCELLED"};
export async function carePlanGoals(ctx:HttpTenantContext,patientId:string):Promise<CarePlanGoal[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'category' as category, a.payload->>'goal' as goal, a.occurred_at as recorded_at,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='CarePlan' and a.payload->>'kind'='PROPOSED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at asc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   carePlanId:String(o.aggregate_id),category:String(o.category??"OTHER"),goal:String(o.goal??""),
   status:CAREPLAN_STATUS[String(o.last_kind??"PROPOSED")]??"PROPOSED",
   recordedAt:o.recorded_at?new Date(String(o.recorded_at)).toISOString():""};});
 }) as Promise<CarePlanGoal[]>;
}
// EPIC BA/UI — Obligaciones de seguimiento de UN paciente (vista Seguimiento › Tareas de seguimiento). Por cada
// agregado ClinicalObligation toma el evento base OBLIGATION_CREATED (tarea/fecha límite) y su ESTADO por la
// última transición (CREATED->OPEN, STARTED->IN_PROGRESS, COMPLETED, CANCELLED). RLS-scoped.
export type FollowUpTask=Readonly<{obligationId:string;task:string;dueAt:string;status:"OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";priority:string;blocksSignature:SignatureBlockReason|null}>;
const OBLIGATION_STATUS:Record<string,"OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED">={CREATED:"OPEN",STARTED:"IN_PROGRESS",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED"};
export async function patientObligations(ctx:HttpTenantContext,patientId:string):Promise<FollowUpTask[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'obligationKind' as task, a.payload->>'dueAt' as due_at, a.payload->>'priority' as priority,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalObligation' and a.payload->>'kind'='CREATED' and a.payload->>'patientId'=${patientId}
   order by a.payload->>'dueAt' asc`;
  const asOf=new Date().toISOString();
  return rows.map(r=>{const o=r as Record<string,unknown>;
   const status=OBLIGATION_STATUS[String(o.last_kind??"CREATED")]??"OPEN";const dueAt=o.due_at?String(o.due_at):"";const priority=o.priority==null?"ROUTINE":String(o.priority);
   return{obligationId:String(o.aggregate_id),task:String(o.task??""),dueAt,status,priority,blocksSignature:signatureBlockReason({state:status,priority,dueAt},asOf)??null};});
 }) as Promise<FollowUpTask[]>;
}
// EPIC D — Gate Zero Lost Follow-Up: obligaciones críticas (URGENT) del paciente sin resolver.
// Auditoría 2026-09-19 (L-01) — GATE REAL de obligaciones. Antes contaba filas de `clinical_inbox`, tabla en la que ningún
// código inserta (el rol de la app solo tiene SELECT): devolvía SIEMPRE 0 y el médico podía firmar con cualquier seguimiento
// crítico abierto. Ahora se deriva de la ÚNICA fuente de verdad, el stream de eventos de ClinicalObligation, y el criterio es
// la función pura `signatureBlockReason` (URGENTE o VENCIDA, sin resolver). La hora de referencia es la del SERVIDOR.
export type BlockingObligation=Readonly<{obligationId:string;reason:SignatureBlockReason;priority:string;dueAt:string}>;
export async function blockingObligations(ctx:HttpTenantContext,patientId:string,asOfIso:string=new Date().toISOString()):Promise<BlockingObligation[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'dueAt' as due_at, a.payload->>'priority' as priority,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalObligation' and a.payload->>'kind'='CREATED' and a.payload->>'patientId'=${patientId}`;
  const out:BlockingObligation[]=[];
  for(const r of rows){const o=r as Record<string,unknown>;
   const state=OBLIGATION_STATUS[String(o.last_kind??"CREATED")]??"OPEN"; // kind desconocido => OPEN (fail-closed: sigue contando)
   const dueAt=o.due_at==null?"":String(o.due_at);const priority=o.priority==null?"ROUTINE":String(o.priority);
   const reason=signatureBlockReason({state,priority,dueAt},asOfIso);
   if(reason)out.push({obligationId:String(o.aggregate_id),reason,priority,dueAt});}
  return out;
 }) as Promise<BlockingObligation[]>;
}
export async function countUnresolvedCriticalObligations(ctx:HttpTenantContext,patientId:string):Promise<number>{
 return(await blockingObligations(ctx,patientId)).length;
}
// EPIC G — Cierre del loop Zero Lost Follow-Up: resultados diagnósticos CRÍTICOS del paciente que no se han CERRADO.
// Auditoría 2026-09-19 (L-01/C-20): antes solo contaban los que ya estaban en ACTIONED, de modo que el caso MÁS peligroso
// —un crítico recién RECIBIDO o solo VERIFICADO, que nadie ha atendido— no bloqueaba la firma, aunque la propia UI promete
// "bloquea la firma hasta cerrarse". Ahora cuenta todo crítico (por valor o por Δ) sin evento CLOSED.
export async function countOpenCriticalResults(ctx:HttpTenantContext,patientId:string):Promise<number>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select count(distinct r.aggregate_id)::int n
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult'
     and r.payload->>'kind'='RECEIVED' and r.payload->>'patientId'=${patientId} and r.payload->>'critical'='true'
     and not exists(
      select 1 from clinical_events c
      where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and c.payload->>'kind' in ('CLOSED','CORRECTED'))`; // C-02: un crítico corregido deja de bloquear; si la corrección sigue siendo crítica, bloquea el nuevo
  return Number(rows[0]?.n??0);
 }) as Promise<number>;
}
// EPIC AN + Zero Lost Follow-Up: cuenta signos vitales CRÍTICOS del paciente
// que están en estado RECORDED o AMENDED (no corregidos) y no han sido abordados
// (no existe obligación creada para ese vital). Bloquea firma del encuentro.
export async function countOpenCriticalVitals(ctx:HttpTenantContext,patientId:string):Promise<number>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select count(distinct r.aggregate_id)::int n
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='VitalSign'
     and r.payload->>'kind' in ('RECORDED','AMENDED')
     and r.payload->>'patientId'=${patientId} and r.payload->>'critical'='true'
     and not exists(
      select 1 from clinical_events c
      where c.tenant_id=${ctx.tenantId} and c.aggregate_type='ClinicalObligation'
        and c.payload->>'sourceVitalId'=r.aggregate_id::text and c.payload->>'kind'='CREATED')`;
  return Number(rows[0]?.n??0);
 }) as Promise<number>;
}
