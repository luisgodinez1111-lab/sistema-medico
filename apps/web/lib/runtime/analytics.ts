// Analítica agregada del tenant (reportes). Auditoría R01-001: extraído del god-module `clinical-runtime.ts`.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{withTenantTx}from"./connection";
import{transicionesPorAgregado}from"./read-model-joins";

// ---------------------------------------------------------------------------------------------------------------------
// Auditoría 2026-09-19, anexo R06 (R06-20), segunda mitad: «sin paginación».
//
// Los seis tableros de clínica completa calculaban sus indicadores en Node sobre el conjunto ENTERO que les devolvía el
// registro: `items.length`, `items.filter(i=>i.status==="PENDING").length`, `new Set(items.map(i=>i.patientId)).size`…
// Para pintar «38 alergias, 12 pacientes» el servidor se traía las 38 filas completas, con sus joins, y las contaba en
// JavaScript. Por eso acotar la página sin más habría FALSEADO todos los indicadores: contarían solo la página. Las dos
// cosas van juntas, y ésta es la mitad que hace posible la otra: el recuento se calcula en la base, con salida de tamaño
// fijo, así que la página puede ir acotada sin que ningún KPI mienta.
//
// El estado de cada agregado es su última transición, resuelta con una TABLA DERIVADA porque el resumen sí recorre todo el
// conjunto (medido: 1 116 buffers frente a 72 389 con una subconsulta por fila). El campo de agrupación viaja como
// PARÁMETRO (`payload->>$n`), no interpolado: un resumen genérico no justifica abrir la puerta al SQL crudo.
// ---------------------------------------------------------------------------------------------------------------------
export type RegistrySummarySpec=Readonly<{
 aggregateType:string;              // p. ej. "Allergy"
 baseKind:string;                   // evento base que define una fila del registro: "RECORDED", "ADDED", "DUE"…
 lifecycleKinds?:readonly string[]; // transiciones que cambian el estado (sin esto, la última de todas)
 groupField?:string;                // campo del payload por el que agrupar: "category", "vaccineCode"…
 sumField?:string;                  // campo numérico a sumar por estado: "amount" (ingresos de facturación)
}>;
export type RegistrySummary=Readonly<{
 total:number;
 patients:number;
 byStatus:Readonly<Record<string,number>>;
 patientsByStatus:Readonly<Record<string,number>>;
 byGroup:Readonly<Record<string,number>>;
 /** Cruce estado × grupo. Sale GRATIS del mismo `group by`, y es lo que necesitan los tableros que agrupan solo un
  *  estado (vacunas aplicadas por vacuna, por ejemplo): contar el grupo entero daría otro número. */
 byGroupByStatus:Readonly<Record<string,Readonly<Record<string,number>>>>;
 sumByStatus:Readonly<Record<string,number>>;
}>;
/** Recuentos de un registro de clínica calculados EN LA BASE: total, por estado, por grupo y pacientes distintos. */
export async function registrySummary(ctx:HttpTenantContext,spec:RegistrySummarySpec):Promise<RegistrySummary>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select coalesce(lk.kind,${spec.baseKind}) as estado,
          coalesce(a.payload->>${spec.groupField??"kind"},'') as grupo,
          count(*)::int as n,
          count(distinct a.payload->>'patientId')::int as pacientes,
          coalesce(sum((a.payload->>${spec.sumField??"__sin_suma"})::numeric),0) as suma
   from clinical_events a
   left join ${transicionesPorAgregado(tx,ctx.tenantId,spec.aggregateType,spec.lifecycleKinds)} lk
     on lk.aggregate_id=a.aggregate_id and lk.rn=1
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type=${spec.aggregateType} and a.payload->>'kind'=${spec.baseKind}
   group by 1,2`;
  // Los pacientes distintos NO se pueden sumar entre grupos ni entre estados (uno puede aparecer en varios), así que se
  // cuentan con su propio `count(distinct)`: en total y por estado. Aproximarlos habría sido publicar un número inventado.
  const distintos=await tx`
   select count(distinct a.payload->>'patientId')::int as n
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type=${spec.aggregateType} and a.payload->>'kind'=${spec.baseKind}`;
  const porEstado=await tx`
   select coalesce(lk.kind,${spec.baseKind}) as estado, count(distinct a.payload->>'patientId')::int as pacientes
   from clinical_events a
   left join ${transicionesPorAgregado(tx,ctx.tenantId,spec.aggregateType,spec.lifecycleKinds)} lk
     on lk.aggregate_id=a.aggregate_id and lk.rn=1
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type=${spec.aggregateType} and a.payload->>'kind'=${spec.baseKind}
   group by 1`;
  const byStatus:Record<string,number>={},byGroup:Record<string,number>={},sumByStatus:Record<string,number>={};
  const byGroupByStatus:Record<string,Record<string,number>>={};
  const pacientesPorEstado=new Map<string,number>();
  let total=0;
  for(const r of rows){
   const o=r as Record<string,unknown>;
   const estado=String(o.estado??""),grupo=String(o.grupo??""),n=Number(o.n??0);
   total+=n;
   byStatus[estado]=(byStatus[estado]??0)+n;
   if(grupo){byGroup[grupo]=(byGroup[grupo]??0)+n;const porEstadoGrupo=byGroupByStatus[estado]??{};porEstadoGrupo[grupo]=(porEstadoGrupo[grupo]??0)+n;byGroupByStatus[estado]=porEstadoGrupo;}
   sumByStatus[estado]=Math.round(((sumByStatus[estado]??0)+Number(o.suma??0))*100)/100;
  }
  for(const r of porEstado){
   const o=r as Record<string,unknown>;
   pacientesPorEstado.set(String(o.estado??""),Number(o.pacientes??0));
  }
  return{total,patients:Number((distintos[0] as {n?:unknown}|undefined)?.n??0),byStatus,
   patientsByStatus:Object.fromEntries(pacientesPorEstado),byGroup,byGroupByStatus,sumByStatus};
 });
}
/**
 * Pacientes con más filas en un registro, con su nombre: el «top 5» de los tableros. En SQL, porque calcularlo en Node
 * exigía traerse el registro completo —era uno de los recuentos de R06-20— y el resultado son cinco filas.
 */
export type TopPatientRow=Readonly<{patientId:string;name:string;count:number}>;
export async function topPatientsOfRegistry(ctx:HttpTenantContext,spec:Pick<RegistrySummarySpec,"aggregateType"|"baseKind">,n=5):Promise<ReadonlyArray<TopPatientRow>>{
 return withTenantTx(ctx,async tx=>{
  // El nombre se resuelve FUERA de la agregación: dentro de un `group by` no se puede correlacionar por `a.payload`
  // («subquery uses ungrouped column»). Se agrupa primero, se corta a las n filas y solo entonces se busca el nombre.
  const rows=await tx`
   select g.pid as pid, g.n as n, pn.name as name
   from (
     select a.payload->>'patientId' as pid, count(*)::int as n
     from clinical_events a
     where a.tenant_id=${ctx.tenantId} and a.aggregate_type=${spec.aggregateType} and a.payload->>'kind'=${spec.baseKind}
       and a.payload->>'patientId' is not null
     group by 1 order by 2 desc, 1 asc limit ${n}
   ) g
   left join lateral (
     select pt.payload->>'name' as name from clinical_events pt
     where pt.tenant_id=${ctx.tenantId} and pt.aggregate_id=g.pid::uuid and pt.payload->>'kind'='REGISTERED'
     limit 1) pn on true
   order by g.n desc, g.pid asc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;
   return{patientId:String(o.pid??""),name:String(o.name??"Paciente"),count:Number(o.n??0)};});
 });
}

/**
 * Recuentos del tablero de RESULTADOS. Va aparte del resumen genérico porque su indicador «Hallazgos» no es un estado del
 * ciclo de vida: combina el flag `critical` con el `status` del resultado (HIGH/LOW/CRITICAL/ABNORMAL/PANIC). Dos recuentos
 * marginales no dan el conjunto, así que se cuenta con `filter` en la misma pasada, con la MISMA regla que la lista.
 */
export type ResultsSummary=Readonly<{total:number;abnormal:number;enSeguimiento:number;pendientes:number}>;
export const RESULT_ABNORMAL_STATUSES=["HIGH","LOW","CRITICAL","ABNORMAL","PANIC"] as const;
export async function resultsSummary(ctx:HttpTenantContext):Promise<ResultsSummary>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select count(*)::int as total,
     count(*) filter (where a.payload->>'critical'='true'
                         or upper(coalesce(a.payload->>'status',''))=any(${RESULT_ABNORMAL_STATUSES as unknown as string[]}))::int as abnormal,
     count(*) filter (where coalesce(lk.kind,'RECEIVED')='ACTIONED')::int as en_seguimiento,
     count(*) filter (where coalesce(lk.kind,'RECEIVED')='RECEIVED')::int as pendientes
   from clinical_events a
   left join ${transicionesPorAgregado(tx,ctx.tenantId,"DiagnosticResult")} lk
     on lk.aggregate_id=a.aggregate_id and lk.rn=1
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='DiagnosticResult' and a.payload->>'kind'='RECEIVED'
     -- Mismo criterio que el registro: un resultado anulado no cuenta (R03-10).
     and not exists(select 1 from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=a.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR')`;
  const o=(rows[0]??{}) as Record<string,unknown>;
  return{total:Number(o.total??0),abnormal:Number(o.abnormal??0),enSeguimiento:Number(o.en_seguimiento??0),pendientes:Number(o.pendientes??0)};
 });
}

/**
 * Indicadores de FACTURACIÓN, sumados en la base. Antes se traían todas las facturas del tenant y se sumaban en Node
 * (auditoría R06-20; el periodo de ingresos ya venía de L-09). `month` es 'YYYY-MM' en la zona declarada por el llamador.
 */
export type ClaimsIncome=Readonly<{issued:number;incomeThisMonth:number;incomeAllTime:number;pendingCount:number;pendingAmount:number;cancellations:number}>;
const CLAIM_PENDING=["DRAFTED","CODED","SUBMITTED"] as const;
export async function claimsIncome(ctx:HttpTenantContext,month:string,timeZone:string):Promise<ClaimsIncome>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select count(*)::int as issued,
     coalesce(sum(case when lk.kind='PAID' then (a.payload->>'amount')::numeric else 0 end),0) as income_all,
     coalesce(sum(case when lk.kind='PAID' and to_char(pg.paid_at at time zone ${timeZone},'YYYY-MM')=${month}
                       then (a.payload->>'amount')::numeric else 0 end),0) as income_month,
     count(*) filter (where coalesce(lk.kind,'DRAFTED')=any(${CLAIM_PENDING as unknown as string[]}))::int as pending_count,
     coalesce(sum(case when coalesce(lk.kind,'DRAFTED')=any(${CLAIM_PENDING as unknown as string[]})
                       then (a.payload->>'amount')::numeric else 0 end),0) as pending_amount,
     count(*) filter (where lk.kind='VOIDED')::int as cancellations
   from clinical_events a
   left join ${transicionesPorAgregado(tx,ctx.tenantId,"Claim")} lk on lk.aggregate_id=a.aggregate_id and lk.rn=1
   left join (select aggregate_id, max(occurred_at) as paid_at from clinical_events
              where tenant_id=${ctx.tenantId} and aggregate_type='Claim' and payload->>'kind'='PAID'
              group by aggregate_id) pg on pg.aggregate_id=a.aggregate_id
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Claim' and a.payload->>'kind'='DRAFTED'`;
  const o=(rows[0]??{}) as Record<string,unknown>;
  const dos=(v:unknown)=>Math.round(Number(v??0)*100)/100;
  return{issued:Number(o.issued??0),incomeThisMonth:dos(o.income_month),incomeAllTime:dos(o.income_all),
   pendingCount:Number(o.pending_count??0),pendingAmount:dos(o.pending_amount),cancellations:Number(o.cancellations??0)};
 });
}

/**
 * Agregados del TABLERO DE REPORTES que no son un simple recuento por estado: top de diagnósticos con su descripción, top
 * de procedimientos y el control glucémico. Antes el tablero se construía trayendo CINCO registros completos del tenant
 * —facturas, problemas, órdenes, resultados y vacunas— y reduciéndolos en Node; los ingresos, los porcentajes y los tops
 * salían de esas listas (auditoría R06-20). Aquí cada cifra se calcula en la base y la salida es de tamaño fijo.
 */
export type CodeCount=Readonly<{code:string;description:string;count:number}>;
export type DetailCount=Readonly<{detail:string;count:number}>;
export type ReportAggregates=Readonly<{
 topDiagnoses:ReadonlyArray<CodeCount>;
 topProcedures:ReadonlyArray<DetailCount>;
 proceduresTotal:number;
 hba1cTotal:number;
 hba1cInControl:number;
}>;
/** Umbral de control glucémico del indicador de calidad: HbA1c por debajo de 7 %. */
export const HBA1C_CONTROL_THRESHOLD=7;
export async function reportAggregates(ctx:HttpTenantContext):Promise<ReportAggregates>{
 return withTenantTx(ctx,async tx=>{
  // Top de diagnósticos: el código manda y la descripción se toma de la fila más reciente de ese código.
  const dx=await tx`
   select a.payload->>'code' as code,
          (array_agg(a.payload->>'description' order by a.occurred_at desc))[1] as description,
          count(*)::int as n
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalProblem' and a.payload->>'kind'='ADDED'
     and coalesce(a.payload->>'code','')<>''
   group by 1 order by 3 desc, 1 asc limit 5`;
  const proc=await tx`
   select a.payload->>'detail' as detail, count(*)::int as n,
          sum(count(*)) over ()::int as total
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalOrder' and a.payload->>'kind'='CREATED'
     and a.payload->>'orderType'='PROCEDURE' and coalesce(a.payload->>'detail','')<>''
   group by 1 order by 2 desc, 1 asc`;
  // HbA1c: total y cuántas por debajo del umbral. El valor es texto en el payload; se limpia igual que en la lista.
  const a1c=await tx`
   select count(*)::int as total,
     count(*) filter (where nullif(regexp_replace(a.payload->>'value','[^0-9.]','','g'),'')::numeric < ${HBA1C_CONTROL_THRESHOLD})::int as en_control
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='DiagnosticResult' and a.payload->>'kind'='RECEIVED'
     and upper(a.payload->>'analyte')='HBA1C'
     and not exists(select 1 from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=a.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR')`;
  const oa1c=(a1c[0]??{}) as Record<string,unknown>;
  const filasProc=proc.map(r=>r as Record<string,unknown>);
  return{
   topDiagnoses:dx.map(r=>{const o=r as Record<string,unknown>;
    return{code:String(o.code??""),description:String(o.description??""),count:Number(o.n??0)};}),
   topProcedures:filasProc.slice(0,5).map(o=>({detail:String(o.detail??""),count:Number(o.n??0)})),
   proceduresTotal:Number(filasProc[0]?.total??0),
   hba1cTotal:Number(oa1c.total??0),
   hba1cInControl:Number(oa1c.en_control??0),
  };
 });
}

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
