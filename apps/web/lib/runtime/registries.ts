// Read-models de TODA la clínica (tableros por estado).
//
// Auditoría R02a-ENC-01: estas consultas seleccionaban la columna del hecho con el ALIAS de la columna de registro, es
// decir presentaban como «fecha de registro» la hora que declaró el CLIENTE. Son dos cosas distintas y el expediente
// necesita ambas: `occurred_at` es
// cuándo ocurrió el hecho clínico (lo dice quien lo captura) y `recorded_at` es cuándo lo registró el sistema (reloj del
// servidor, `DEFAULT now()` en 0001_core.sql). Un reloj de cliente desajustado podía fechar un registro en el pasado. No identifican un episodio concreto: son recuentos y
// listados por tenant. Auditoría R01-001: extraído del god-module `clinical-runtime.ts`.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{withTenantTx}from"./connection";
// Auditoría R06-20: las piezas de SQL compartidas (filtro por paciente y los LATERAL de transición, nombre y versión)
// viven en su propio módulo, con la medición que decidió el diseño. Salieron de aquí cuando el guardián de god-module
// avisó de que este fichero pasaba de 300 líneas: tenía razón, son dos responsabilidades.
import{type RegistryQuery,porPaciente,nombreDePaciente,ultimaTransicion,versionDelAgregado}from"./read-model-joins";
export type{RegistryQuery};

// EPIC CM — Agenda del día: citas cuyo startAt cae en [fromIso, toIso), con estado (última transición)
// y nombre del paciente. RLS-scoped. Auditoría R06-24: la ventana se compara casteando a timestamptz. Antes era una
// comparación LEXICOGRÁFICA del texto del jsonb, y solo es correcta si todo productor serializa `startAt` con el mismo
// ancho, la misma zona y los mismos milisegundos — nada lo garantizaba.
export type AgendaAppt=Readonly<{appointmentId:string;patientId:string;patientName:string;startAt:string;endAt:string|null;reason:string;consultorio:string|null;apptType:string|null;status:string;version:number}>;
export async function agendaForDate(ctx:HttpTenantContext,fromIso:string,toIso:string):Promise<AgendaAppt[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'startAt' as start_at, a.payload->>'endAt' as end_at,
     a.payload->>'reason' as reason, a.payload->>'consultorio' as consultorio, a.payload->>'apptType' as appt_type,
     lk.kind as status, vr.version as version, pn.name as patient_name
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId)}
   ${versionDelAgregado(tx,ctx.tenantId)}
   ${nombreDePaciente(tx,ctx.tenantId)}
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Appointment' and a.payload->>'kind'='SCHEDULED'
     and (a.payload->>'startAt')::timestamptz >= ${fromIso}::timestamptz and (a.payload->>'startAt')::timestamptz < ${toIso}::timestamptz
   order by a.payload->>'startAt' asc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   appointmentId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   startAt:String(o.start_at??""),endAt:o.end_at?String(o.end_at):null,reason:String(o.reason??""),
   consultorio:o.consultorio?String(o.consultorio):null,apptType:o.appt_type?String(o.appt_type):null,status:String(o.status??"SCHEDULED"),version:Number(o.version??1)};});
 });
}
// EPIC R/UI — Registro de alergias de TODA la clínica (vista Alergias). Por cada agregado Allergy toma el
// evento base ALLERGY_RECORDED (sustancia/gravedad/reacción/paciente/fecha/actor) y su ESTADO por la última
// transición (RECORDED/REACTIVATED->ACTIVE, REFUTED->REFUTED, INACTIVATED->INACTIVE). Une el nombre del
// paciente. RLS-scoped. El tipo del alérgeno y las gráficas se derivan en la capa de API/UI (classifyAllergen).
export type AllergyRow=Readonly<{allergyId:string;patientId:string;patientName:string;substance:string;reaction:string;severity:"MILD"|"MODERATE"|"SEVERE";status:"ACTIVE"|"REFUTED"|"INACTIVE";recordedAt:string;registeredBy:string}>;
const ALLERGY_STATUS:Record<string,"ACTIVE"|"REFUTED"|"INACTIVE">={RECORDED:"ACTIVE",REACTIVATED:"ACTIVE",REFUTED:"REFUTED",INACTIVATED:"INACTIVE"};
export async function allergyRegistry(ctx:HttpTenantContext,q?:RegistryQuery):Promise<AllergyRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'substance' as substance,
     a.payload->>'reaction' as reaction, a.payload->>'severity' as severity, a.recorded_at as recorded_at, a.actor_id as actor_id,
     lk.kind as last_kind, pn.name as patient_name
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId)}
   ${nombreDePaciente(tx,ctx.tenantId)}
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Allergy' and a.payload->>'kind'='RECORDED'
     ${porPaciente(tx,q)}
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;const sev=String(o.severity??"MILD");
   return{
    allergyId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
    substance:String(o.substance??""),reaction:String(o.reaction??""),
    severity:(sev==="SEVERE"||sev==="MODERATE"?sev:"MILD") as "MILD"|"MODERATE"|"SEVERE",
    status:ALLERGY_STATUS[String(o.last_kind??"RECORDED")]??"ACTIVE",
    recordedAt:o.recorded_at?new Date(String(o.recorded_at)).toISOString():"",registeredBy:String(o.actor_id??"")};});
 });
}
// EPIC Q/UI — Registro de problemas de TODA la clínica (vista Problemas). Por cada agregado ClinicalProblem
// toma el evento base PROBLEM_ADDED (código CIE-10/descripción/categoría/paciente/fecha) y su ESTADO por la
// última transición de CICLO DE VIDA (ADDED/REACTIVATED->ACTIVE, MARKED_CHRONIC->CHRONIC, RESOLVED->RESOLVED,
// ENTERED_IN_ERROR->INACTIVE; ignora EPISTEMIC/EVIDENCE que no cambian el estado). Une el nombre del paciente.
export type ProblemRow=Readonly<{problemId:string;patientId:string;patientName:string;code:string;description:string;category:string;status:"ACTIVE"|"CHRONIC"|"RESOLVED"|"INACTIVE";recordedAt:string;registeredBy:string}>;
const PROBLEM_STATUS:Record<string,"ACTIVE"|"CHRONIC"|"RESOLVED"|"INACTIVE">={ADDED:"ACTIVE",REACTIVATED:"ACTIVE",MARKED_CHRONIC:"CHRONIC",RESOLVED:"RESOLVED",ENTERED_IN_ERROR:"INACTIVE"};
export async function problemRegistry(ctx:HttpTenantContext,q?:RegistryQuery):Promise<ProblemRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'code' as code,
     a.payload->>'description' as description, a.payload->>'category' as category, a.recorded_at as recorded_at, a.actor_id as actor_id,
     lk.kind as last_kind, pn.name as patient_name
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId,Object.keys(PROBLEM_STATUS))}
   ${nombreDePaciente(tx,ctx.tenantId)}
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalProblem' and a.payload->>'kind'='ADDED'
     ${porPaciente(tx,q)}
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   problemId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   code:String(o.code??""),description:String(o.description??""),category:String(o.category??"Otros"),
   status:PROBLEM_STATUS[String(o.last_kind??"ADDED")]??"ACTIVE",
   recordedAt:o.recorded_at?new Date(String(o.recorded_at)).toISOString():"",registeredBy:String(o.actor_id??"")};});
 });
}
// EPIC V/UI — Registro de vacunas de TODA la clínica (vista Vacunas). Por cada agregado Immunization toma el
// evento base IMMUNIZATION_DUE (vacuna/dosis/paciente) y su ESTADO por la última transición (DUE->PENDING,
// ADMINISTERED->COMPLETE, REFUSED, ADVERSE_EVENT). Une el lote/sitio/fecha del evento ADMINISTERED (si existe)
// y el nombre del paciente. RLS-scoped.
export type ImmunizationRow=Readonly<{immunizationId:string;patientId:string;patientName:string;vaccine:string;dose:string;lot:string;site:string;status:"COMPLETE"|"PENDING"|"REFUSED"|"ADVERSE";appliedAt:string;registeredBy:string}>;
const IMM_STATUS:Record<string,"COMPLETE"|"PENDING"|"REFUSED"|"ADVERSE">={ADMINISTERED:"COMPLETE",DUE:"PENDING",REFUSED:"REFUSED",ADVERSE_EVENT:"ADVERSE"};
export async function immunizationRegistry(ctx:HttpTenantContext,q?:RegistryQuery):Promise<ImmunizationRow[]>{
 return withTenantTx(ctx,async tx=>{
  // R06-20: aquí estaba el caso extremo. El MISMO evento ADMINISTERED se buscaba CUATRO veces por fila —lote, sitio,
  // fecha y otra vez la fecha dentro del ORDER BY—, más la última transición y el nombre del paciente: seis subconsultas
  // correlacionadas por fila. Ahora el evento ADMINISTERED se resuelve una vez en su propia tabla derivada.
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'vaccineCode' as vaccine,
     a.payload->>'dose' as dose, a.occurred_at as due_at, a.actor_id as actor_id,
     lk.kind as last_kind, ad.lot as lot, ad.site as site, ad.applied_at as applied_at, pn.name as patient_name
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId)}
   left join lateral (
     select e.payload->>'lot' as lot, e.payload->>'site' as site, e.occurred_at as applied_at
     from clinical_events e
     where e.tenant_id=${ctx.tenantId} and e.aggregate_id=a.aggregate_id and e.payload->>'kind'='ADMINISTERED'
     order by e.sequence desc limit 1) ad on true
   ${nombreDePaciente(tx,ctx.tenantId)}
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Immunization' and a.payload->>'kind'='DUE'
     ${porPaciente(tx,q)}
   order by coalesce(ad.applied_at, a.occurred_at) desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;const applied=o.applied_at??o.due_at;return{
   immunizationId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   vaccine:String(o.vaccine??""),dose:String(o.dose??""),lot:String(o.lot??""),site:String(o.site??""),
   status:IMM_STATUS[String(o.last_kind??"DUE")]??"PENDING",
   appliedAt:applied?new Date(String(applied)).toISOString():"",registeredBy:String(o.actor_id??"")};});
 });
}
// EPIC Y/UI — Registro de facturación de TODA la clínica (vista Facturación). Por cada agregado Claim toma el
// evento base CLAIM_DRAFTED (monto/moneda/paciente/fecha) y su ESTADO por la última transición
// (DRAFTED/CODED/SUBMITTED->PENDING, PAID->PAID, REJECTED->REJECTED, VOIDED->VOID). Une el nombre del paciente. RLS-scoped.
// Auditoría L-09: `paidAt` (fecha del evento PAID) permite calcular los ingresos DEL PERIODO; antes se sumaba toda la historia.
export type ClaimRow=Readonly<{claimId:string;patientId:string;patientName:string;amount:string;currency:string;status:"PENDING"|"PAID"|"REJECTED"|"VOID";recordedAt:string;paidAt:string|null}>;
const CLAIM_STATUS:Record<string,"PENDING"|"PAID"|"REJECTED"|"VOID">={DRAFTED:"PENDING",CODED:"PENDING",SUBMITTED:"PENDING",PAID:"PAID",REJECTED:"REJECTED",VOIDED:"VOID"};
export async function claimsRegistry(ctx:HttpTenantContext,q?:RegistryQuery):Promise<ClaimRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'amount' as amount, a.payload->>'currency' as currency, a.recorded_at as recorded_at,
     lk.kind as last_kind, pg.paid_at as paid_at, pn.name as patient_name
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId)}
   left join lateral (
     select e.occurred_at as paid_at from clinical_events e
     where e.tenant_id=${ctx.tenantId} and e.aggregate_id=a.aggregate_id and e.payload->>'kind'='PAID'
     order by e.sequence desc limit 1) pg on true
   ${nombreDePaciente(tx,ctx.tenantId)}
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Claim' and a.payload->>'kind'='DRAFTED'
     ${porPaciente(tx,q)}
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   claimId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   amount:String(o.amount??"0"),currency:String(o.currency??"MXN"),
   status:CLAIM_STATUS[String(o.last_kind??"DRAFTED")]??"PENDING",
   recordedAt:o.recorded_at?new Date(String(o.recorded_at)).toISOString():"",
   paidAt:o.paid_at?new Date(String(o.paid_at)).toISOString():null};});
 });
}
// EPIC AQ/UI — Registro de resultados diagnósticos de TODA la clínica (vista Resultados). Por cada agregado
// DiagnosticResult toma el evento base RESULT_RECEIVED (analito/valor/critical/status/interpretación derivados)
// y su ESTADO por la última transición de ciclo de vida (RECEIVED/VERIFIED/ACTIONED/CLOSED). Une el nombre del
// paciente. El estado-UI (Hallazgos/Normal/En seguimiento/En revisión) se deriva. RLS-scoped.
export type ResultRow=Readonly<{resultId:string;patientId:string;patientName:string;analyte:string;value:string;critical:boolean;status:string;interpretation:string;lifecycle:"RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED";receivedAt:string}>;
const RES_LIFECYCLE:Record<string,"RECEIVED"|"VERIFIED"|"ACTIONED"|"CLOSED">={RECEIVED:"RECEIVED",VERIFIED:"VERIFIED",ACTIONED:"ACTIONED",CLOSED:"CLOSED"};
export async function resultsRegistry(ctx:HttpTenantContext,q?:RegistryQuery):Promise<ResultRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'analyte' as analyte, a.payload->>'value' as value,
     a.payload->>'critical' as critical, a.payload->>'status' as status, a.payload->>'interpretation' as interpretation, a.occurred_at as received_at,
     lk.kind as last_kind, pn.name as patient_name
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId)}
   ${nombreDePaciente(tx,ctx.tenantId)}
   -- R03-10: un resultado ANULADO (paciente equivocado, muestra mal identificada) no aparece en el registro clínico.
   -- El criterio es «anulado ALGUNA VEZ», no «su última transición es ENTERED_IN_ERROR»: una anotación posterior no
   -- resucita un resultado anulado. Antes era un NOT EXISTS correlacionado por fila; ahora es una anti-unión que se
   -- resuelve una vez, con la misma semántica.
   left join lateral (select 1 as anulado from clinical_events v
              where v.tenant_id=${ctx.tenantId} and v.aggregate_id=a.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR'
              limit 1) anul on true
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='DiagnosticResult' and a.payload->>'kind'='RECEIVED'
     ${porPaciente(tx,q)}
     and anul.anulado is null
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   resultId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   analyte:String(o.analyte??""),value:String(o.value??""),critical:String(o.critical)==="true",
   status:String(o.status??"NORMAL"),interpretation:String(o.interpretation??""),
   lifecycle:RES_LIFECYCLE[String(o.last_kind??"RECEIVED")]??"RECEIVED",
   receivedAt:o.received_at?new Date(String(o.received_at)).toISOString():""};});
 });
}
// EPIC E/UI — Registro de órdenes/solicitudes de estudio de TODA la clínica (Resultados › Solicitudes). Por cada
// agregado ClinicalOrder toma el evento base ORDER_CREATED (tipo/detalle/paciente) y su ESTADO por la última
// transición (CREATED->Solicitada, PLACED->Enviada, FULFILLED->Completada, CANCELLED->Cancelada). Une paciente. RLS-scoped.
export type OrderRow=Readonly<{orderId:string;patientId:string;patientName:string;orderType:string;detail:string;status:"Solicitada"|"Enviada"|"Completada"|"Cancelada";createdAt:string;version:number}>;
const ORDER_STATUS:Record<string,"Solicitada"|"Enviada"|"Completada"|"Cancelada">={CREATED:"Solicitada",PLACED:"Enviada",FULFILLED:"Completada",CANCELLED:"Cancelada"};
export async function ordersRegistry(ctx:HttpTenantContext,q?:RegistryQuery):Promise<OrderRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'patientId' as pid, a.payload->>'orderType' as order_type, a.payload->>'detail' as detail, a.occurred_at as created_at,
     lk.kind as last_kind, vr.version as version, pn.name as patient_name
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId)}
   ${versionDelAgregado(tx,ctx.tenantId)}
   ${nombreDePaciente(tx,ctx.tenantId)}
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalOrder' and a.payload->>'kind'='CREATED'
     ${porPaciente(tx,q)}
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   orderId:String(o.aggregate_id),patientId:String(o.pid??""),patientName:String(o.patient_name??"Paciente"),
   orderType:String(o.order_type??"LAB"),detail:String(o.detail??""),
   status:ORDER_STATUS[String(o.last_kind??"CREATED")]??"Solicitada",
   createdAt:o.created_at?new Date(String(o.created_at)).toISOString():"",version:Number(o.version??1)};});
 });
}
// EPIC AC/UI — Obligaciones REGULATORIAS del consultorio (vista Obligaciones). Lista los agregados
// RegulatoryObligation (evento CREATED con nombre/categoría/periodicidad/fecha límite). El ESTADO se COMPUTA
// de la fecha límite vs hoy (Vigente si no tiene fecha; Vencida si pasó; Próxima si <=30 días; Al día si no). RLS-scoped.
export type RegulatoryObligationRow=Readonly<{obligationId:string;name:string;category:string;periodicity:string;dueDate:string|null;createdAt:string}>;
export async function regulatoryObligations(ctx:HttpTenantContext):Promise<RegulatoryObligationRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'name' as name, a.payload->>'category' as category, a.payload->>'periodicity' as periodicity, a.payload->>'dueDate' as due_date, a.occurred_at as created_at
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='RegulatoryObligation' and a.payload->>'kind'='CREATED'
   order by a.payload->>'dueDate' asc nulls last`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   obligationId:String(o.aggregate_id),name:String(o.name??""),category:String(o.category??"Otros"),
   periodicity:String(o.periodicity??""),dueDate:o.due_date?String(o.due_date):null,
   createdAt:o.created_at?new Date(String(o.created_at)).toISOString():""};});
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

// Auditoría R02a-ORD-01 — ÓRDENES VENCIDAS: órdenes colocadas (ORDERED) cuyo vencimiento ya pasó y que no tienen
// resultado ni cancelación. Es la consulta que faltaba: sin ella, un estudio pedido y nunca resultado no aparecía en
// ninguna parte. Devuelve el retraso en horas para poder priorizar, y nunca PHI más allá del nombre del paciente (que la
// clínica ya ve en sus tableros).
export type OverdueOrderRow=Readonly<{orderId:string;patientId:string;patientName:string;orderType:string;detail:string;priority:string;dueAt:string;hoursOverdue:number}>;
export async function overdueOrders(ctx:HttpTenantContext,asOfIso:string=new Date().toISOString()):Promise<OverdueOrderRow[]>{
 return withTenantTx(ctx,async tx=>{
  // R06-20: esta consulta leía TODAS las órdenes creadas de la clínica —con cuatro subconsultas correlacionadas por
  // fila— y después filtraba en memoria las vencidas. El filtro (colocada y con vencimiento pasado) es exactamente
  // expresable en SQL, así que la base devuelve solo las vencidas. `priority` y `dueAt` se resuelven en UNA pasada por
  // agregado con `array_agg ... filter`, que conserva la semántica anterior: el último evento que TRAE ese campo (no el
  // último evento, que puede no traerlo). El casteo a timestamptz es seguro porque el escritor valida
  // `z.string().datetime()` y el valor derivado sale de `toISOString()` (misma garantía que usa R06-24).
  const rows=await tx`
   select a.aggregate_id,
     a.payload->>'patientId' as pid,
     a.payload->>'orderType' as order_type,
     a.payload->>'detail' as detail,
     attr.priority as priority, attr.due_at as due_at, pn.name as patient_name
   from clinical_events a
   ${ultimaTransicion(tx,ctx.tenantId)}
   left join lateral (
     select (array_agg(e.payload->>'priority' order by e.sequence desc) filter (where e.payload->>'priority' is not null))[1] as priority,
            (array_agg(e.payload->>'dueAt'    order by e.sequence desc) filter (where e.payload->>'dueAt'    is not null))[1] as due_at
     from clinical_events e
     where e.tenant_id=${ctx.tenantId} and e.aggregate_id=a.aggregate_id) attr on true
   ${nombreDePaciente(tx,ctx.tenantId)}
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalOrder' and a.payload->>'kind'='CREATED'
     and lk.kind='PLACED'
     and attr.due_at is not null and (attr.due_at)::timestamptz < ${asOfIso}::timestamptz`;
  const asOf=Date.parse(asOfIso);
  return rows
   .map(r=>({orderId:String(r["aggregate_id"]),patientId:String(r["pid"]??""),patientName:String(r["patient_name"]??""),
    orderType:String(r["order_type"]??""),detail:String(r["detail"]??""),priority:String(r["priority"]??"ROUTINE"),
    dueAt:new Date(String(r["due_at"])).toISOString(),
    hoursOverdue:Math.floor((asOf-Date.parse(String(r["due_at"])))/3_600_000)}))
   .sort((a,b)=>b.hoursOverdue-a.hoursOverdue);
 });
}
