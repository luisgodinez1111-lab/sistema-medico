// Read-models del CONSULTORIO (no del expediente): ajustes del consultorio y obligaciones regulatorias.
//
// Auditoría R01-001 / R06-20: salieron de `registries.ts` cuando el guardián de god-module avisó —por tercera vez en esta
// remediación— de que ese fichero pasaba de 300 líneas. Y la separación es real, no un reparto para callar al guardián:
// `registries.ts` son tableros clínicos de toda la clínica, con paciente, estado derivado de la última transición y
// paginación; esto son dos lecturas del consultorio, sin PHI y sin paginar (una es un singleton por tenant y la otra, un
// listado de obligaciones del despacho que se ordena por fecha límite).
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{withTenantTx}from"./connection";

// EPIC AC/UI — Obligaciones REGULATORIAS del consultorio (vista Obligaciones). Lista los agregados
// RegulatoryObligation (evento CREATED con nombre/categoría/periodicidad/fecha límite). El ESTADO se COMPUTA
// de la fecha límite vs hoy (Vigente si no tiene fecha; Vencida si pasó; Próxima si <=30 días; Al día si no). RLS-scoped.
export type RegulatoryObligationRow=Readonly<{obligationId:string;name:string;category:string;periodicity:string;
 dueDate:string|null;createdAt:string;
 /** R2B-024: estado del ciclo (abierta, cumplida, exenta) y la evidencia con la que se declaró cumplida. */
 lifecycleState:"OPEN"|"COMPLIED"|"WAIVED";evidenceRef:string|null;compliedAt:string|null}>;
/**
 * Auditoría R02b (R2B-024, lote 20) — LA FECHA VIGENTE ES LA DE LA ÚLTIMA RENOVACIÓN, no la del alta.
 *
 * Esta consulta leía SOLO el evento `CREATED`, así que una obligación renovada seguía mostrando su fecha límite original: el
 * tablero la habría dejado como «Vencida» para siempre aunque el consultorio la hubiera cumplido y renovado. Lo destapó la
 * prueba en vivo del ciclo nuevo, no una lectura del código.
 *
 * Ahora la fila se arma con el alta MÁS la última renovación y el último cumplimiento. El estado del ciclo viaja con ella
 * porque «al día» y «cumplida» son cosas distintas: la primera la calcula la fecha, la segunda la declaró una persona.
 */
export async function regulatoryObligations(ctx:HttpTenantContext):Promise<RegulatoryObligationRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   with ultimo as (
    select aggregate_id, payload->>'kind' as kind, payload->>'dueDate' as due_date,
           payload->>'evidenceRef' as evidence_ref, occurred_at,
           row_number() over (partition by aggregate_id, payload->>'kind' order by sequence desc) as rn
    from clinical_events
    where tenant_id=${ctx.tenantId} and aggregate_type='RegulatoryObligation'
   ), estado as (
    select aggregate_id, payload->>'kind' as kind,
           row_number() over (partition by aggregate_id order by sequence desc) as rn
    from clinical_events
    where tenant_id=${ctx.tenantId} and aggregate_type='RegulatoryObligation'
   )
   select a.aggregate_id, a.payload->>'name' as name, a.payload->>'category' as category,
     a.payload->>'periodicity' as periodicity,
     coalesce(r.due_date, a.payload->>'dueDate') as due_date,
     a.occurred_at as created_at, c.evidence_ref, c.occurred_at as complied_at, e.kind as last_kind
   from clinical_events a
   left join ultimo r on r.aggregate_id=a.aggregate_id and r.kind='RENEWED' and r.rn=1
   left join ultimo c on c.aggregate_id=a.aggregate_id and c.kind='COMPLIED' and c.rn=1
   left join estado e on e.aggregate_id=a.aggregate_id and e.rn=1
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='RegulatoryObligation' and a.payload->>'kind'='CREATED'
   order by coalesce(r.due_date, a.payload->>'dueDate') asc nulls last`;
  return rows.map(r=>{const o=r as Record<string,unknown>;
   const last=String(o.last_kind??"CREATED");
   // El estado del ciclo se deriva del ÚLTIMO evento: renovar devuelve la obligación a abierta, y por eso `RENEWED` es OPEN.
   const lifecycleState=last==="COMPLIED"?"COMPLIED":last==="WAIVED"?"WAIVED":"OPEN";
   return{
   obligationId:String(o.aggregate_id),name:String(o.name??""),category:String(o.category??"Otros"),
   periodicity:String(o.periodicity??""),dueDate:o.due_date?String(o.due_date):null,
   createdAt:o.created_at?new Date(String(o.created_at)).toISOString():"",
   lifecycleState:lifecycleState as "OPEN"|"COMPLIED"|"WAIVED",
   evidenceRef:o.evidence_ref?String(o.evidence_ref):null,
   compliedAt:o.complied_at?new Date(String(o.complied_at)).toISOString():null};});
 });
}
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
 });
}
