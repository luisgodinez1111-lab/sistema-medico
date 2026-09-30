// Analítica agregada del tenant (reportes). Auditoría R01-001: extraído del god-module `clinical-runtime.ts`.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{withTenantTx}from"./connection";
import{normalizeLabValue}from"../../../../packages/lab-reference/src";
import{A1C_DIABETIC_TARGET_PCT}from"../../../../packages/glycemic/src";
import{RESULT_LIFECYCLE_KINDS}from"../../../../packages/result-fold/src";
import{transicionesPorAgregado,resultSuperseded,type ReportWindow,enVentana}from"./read-model-joins";
import{RESULT_ABNORMAL_STATUSES}from"./results-registry";
export type{ReportWindow};



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

/**
 * Recuentos del tablero de RESULTADOS. Va aparte del resumen genérico porque su indicador «Hallazgos» no es un estado del
 * ciclo de vida: combina el flag `critical` con el `status` del resultado (HIGH/LOW/CRITICAL/ABNORMAL/PANIC). Dos recuentos
 * marginales no dan el conjunto, así que se cuenta con `filter` en la misma pasada, con la MISMA regla que la lista
 * (`resultEstado` y RESULT_ABNORMAL_STATUSES de results-registry.ts).
 * SQL-2 (porte): el estado es la última transición de CICLO DE VIDA (RESULT_LIFECYCLE_KINDS; antes un resultado cerrado y
 * corregido leía CORRECTED y no contaba en ningún estado) y los indicadores cuentan solo resultados VIGENTES: uno
 * reemplazado por una corrección no es un hallazgo, un seguimiento ni una revisión pendiente —lo es su corrección, que ya
 * cuenta—. `total` sigue contando toda fila no anulada, igual que la lista.
 */
export type ResultsSummary=Readonly<{total:number;abnormal:number;enSeguimiento:number;pendientes:number}>;
export async function resultsSummary(ctx:HttpTenantContext,w?:ReportWindow):Promise<ResultsSummary>{
 return withTenantTx(ctx,async tx=>{
  const vigente=tx`not ${resultSuperseded(tx,ctx.tenantId,tx`a.aggregate_id`)}`;
  const rows=await tx`
   select count(*)::int as total,
     count(*) filter (where (a.payload->>'critical'='true'
                         or upper(coalesce(a.payload->>'status',''))=any(${RESULT_ABNORMAL_STATUSES as unknown as string[]})) and ${vigente})::int as abnormal,
     count(*) filter (where coalesce(lk.kind,'RECEIVED')='ACTIONED' and ${vigente})::int as en_seguimiento,
     count(*) filter (where coalesce(lk.kind,'RECEIVED')='RECEIVED' and ${vigente})::int as pendientes
   from clinical_events a
   left join ${transicionesPorAgregado(tx,ctx.tenantId,"DiagnosticResult",RESULT_LIFECYCLE_KINDS)} lk
     on lk.aggregate_id=a.aggregate_id and lk.rn=1
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='DiagnosticResult' and a.payload->>'kind'='RECEIVED' ${enVentana(tx,w)}
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
export type ClaimsIncome=Readonly<{issued:number;incomeThisMonth:number;incomeAllTime:number;pendingCount:number;
 pendingAmount:number;cancellations:number;
 /** R2B-021: facturas cuyo importe no tiene forma de número (eventos anteriores a la validación de la puerta). No entran
  * en las sumas y se cuentan aquí: un importe ilegible no puede desaparecer en silencio de una suma de dinero. */
 malformedAmounts:number}>;
const CLAIM_PENDING=["DRAFTED","CODED","SUBMITTED"] as const;
export async function claimsIncome(ctx:HttpTenantContext,month:string,timeZone:string,w?:ReportWindow):Promise<ClaimsIncome>{
 return withTenantTx(ctx,async tx=>{
  // Auditoría R02b (R2B-021, lote 18): el importe era texto libre en el cuerpo de la factura, así que un `amount` no
  // numérico hacía que este `::numeric` LANZARA y el tablero de facturación entero devolviera 500 —una fila mala tumbaba
  // seis indicadores—. Desde el lote 18 la puerta valida el formato, pero los eventos ya escritos no se pueden reescribir
  // (log append-only): el importe se castea solo si TIENE forma de número y, si no, se cuenta aparte en vez de ignorarse.
  // Un importe ilegible no puede desaparecer en silencio de una suma de dinero.
  const MONTO_SQL=tx`(a.payload->>'amount' ~ '^-?[0-9]{1,12}(\.[0-9]{1,2})?$')`;
  const rows=await tx`
   select count(*)::int as issued,
     coalesce(sum(case when lk.kind='PAID' and ${MONTO_SQL} then (a.payload->>'amount')::numeric else 0 end),0) as income_all,
     coalesce(sum(case when lk.kind='PAID' and ${MONTO_SQL} and to_char(pg.paid_at at time zone ${timeZone},'YYYY-MM')=${month}
                       then (a.payload->>'amount')::numeric else 0 end),0) as income_month,
     count(*) filter (where coalesce(lk.kind,'DRAFTED')=any(${CLAIM_PENDING as unknown as string[]}))::int as pending_count,
     coalesce(sum(case when coalesce(lk.kind,'DRAFTED')=any(${CLAIM_PENDING as unknown as string[]}) and ${MONTO_SQL}
                       then (a.payload->>'amount')::numeric else 0 end),0) as pending_amount,
     count(*) filter (where lk.kind='VOIDED')::int as cancellations,
     count(*) filter (where not ${MONTO_SQL})::int as malformed_amounts
   from clinical_events a
   left join ${transicionesPorAgregado(tx,ctx.tenantId,"Claim")} lk on lk.aggregate_id=a.aggregate_id and lk.rn=1
   left join (select aggregate_id, max(occurred_at) as paid_at from clinical_events
              where tenant_id=${ctx.tenantId} and aggregate_type='Claim' and payload->>'kind'='PAID'
              group by aggregate_id) pg on pg.aggregate_id=a.aggregate_id
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Claim' and a.payload->>'kind'='DRAFTED' ${enVentana(tx,w)}`;
  const o=(rows[0]??{}) as Record<string,unknown>;
  const dos=(v:unknown)=>Math.round(Number(v??0)*100)/100;
  return{issued:Number(o.issued??0),incomeThisMonth:dos(o.income_month),incomeAllTime:dos(o.income_all),
   pendingCount:Number(o.pending_count??0),pendingAmount:dos(o.pending_amount),cancellations:Number(o.cancellations??0),
   malformedAmounts:Number(o.malformed_amounts??0)};
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
 /** HbA1c VIGENTES con valor interpretable en % (el denominador del indicador). */
 hba1cTotal:number;
 hba1cInControl:number;
 /** SQL-3 (porte): HbA1c vigentes cuyo valor no se puede interpretar como % («<5.0», «pendiente», implausible). No entran
  * en el denominador y se DECLARAN: antes salían en silencio y la nota decía «el total». */
 hba1cExcluded:number;
 /** Revisión del porte (d424bdc): HbA1c del periodo reemplazadas por una corrección FECHADA FUERA de él. No son vigentes
  * en el periodo (la corrección cuenta en el suyo), así que no entran en el denominador; se declaran aparte. Antes el
  * periodo las perdía en silencio: ni denominador, ni `excluded`, ni nota. Sin ventana es siempre 0. */
 hba1cCorrectedOutsideWindow:number;
}>;
/** Umbral de control glucémico del indicador de calidad: la meta del diabético de packages/glycemic (fuente única, D10). */
export const HBA1C_CONTROL_THRESHOLD=A1C_DIABETIC_TARGET_PCT;
export async function reportAggregates(ctx:HttpTenantContext,w?:ReportWindow):Promise<ReportAggregates>{
 return withTenantTx(ctx,async tx=>{
  // Top de diagnósticos: el código manda y la descripción se toma de la fila más reciente de ese código.
  const dx=await tx`
   select a.payload->>'code' as code,
          (array_agg(a.payload->>'description' order by a.occurred_at desc))[1] as description,
          count(*)::int as n
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalProblem' and a.payload->>'kind'='ADDED' ${enVentana(tx,w)}
     and coalesce(a.payload->>'code','')<>''
   group by 1 order by 3 desc, 1 asc limit 5`;
  const proc=await tx`
   select a.payload->>'detail' as detail, count(*)::int as n,
          sum(count(*)) over ()::int as total
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalOrder' and a.payload->>'kind'='CREATED' ${enVentana(tx,w)}
     and a.payload->>'orderType'='PROCEDURE' and coalesce(a.payload->>'detail','')<>''
   group by 1 order by 2 desc, 1 asc`;
  // HbA1c (hallazgo D10, porte): solo las VIGENTES —ni anuladas (R03-10) ni reemplazadas por una corrección (C-02)— y con
  // el valor CANÓNICO en % que guardó la recepción, el mismo que usa la evaluación por paciente. Antes se limpiaba el texto
  // recibido con una expresión regular: «6,5» se leía 65 y 48 mmol/mol (IFCC) se leía 48 %, y el original corregido seguía
  // contando. El canónico se castea solo si TIENE forma de número (log append-only: puede haber basura, como en claimsIncome).
  // Los eventos sin canónico (anteriores a C-01, o no numéricos) se devuelven crudos y se normalizan abajo con la MISMA
  // función que la recepción; no hay una segunda regla de normalización.
  // Revisión del porte (d424bdc): el periodo lee el valor VIGENTE en él. Un original del periodo reemplazado por una
  // corrección fechada FUERA sale del denominador (su corrección cuenta en su propio periodo) y se DECLARA en
  // `corregidas_fuera`; uno reemplazado DENTRO no se declara porque su corrección ya cuenta aquí.
  const a1c=await tx`
   select count(*) filter (where not h.reemplazada and h.cv is not null)::int as total,
     count(*) filter (where not h.reemplazada and h.cv < ${A1C_DIABETIC_TARGET_PCT})::int as en_control,
     coalesce(array_agg(h.raw) filter (where not h.reemplazada and h.cv is null),'{}') as sin_canonico,
     count(*) filter (where h.reemplazada and not h.reemplazada_en_ventana)::int as corregidas_fuera
   from (select a.payload->>'value' as raw,
           case when a.payload->>'canonicalValue' ~ '^-?[0-9]+([.][0-9]+)?([eE][-+]?[0-9]+)?$' then (a.payload->>'canonicalValue')::numeric end as cv,
           ${resultSuperseded(tx,ctx.tenantId,tx`a.aggregate_id`)} as reemplazada,
           ${resultSuperseded(tx,ctx.tenantId,tx`a.aggregate_id`,w)} as reemplazada_en_ventana
         from clinical_events a
         where a.tenant_id=${ctx.tenantId} and a.aggregate_type='DiagnosticResult' and a.payload->>'kind'='RECEIVED'
           and upper(a.payload->>'analyte')='HBA1C' ${enVentana(tx,w)}
           and not exists(select 1 from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=a.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR')) h`;
  const oa1c=(a1c[0]??{}) as Record<string,unknown>;
  let a1cTotal=Number(oa1c.total??0),a1cEnControl=Number(oa1c.en_control??0),a1cExcluidas=0;
  for(const raw of (oa1c.sin_canonico as unknown[]|null)??[]){
   const n=normalizeLabValue("HBA1C",String(raw??""));
   if(!n.ok){a1cExcluidas++;continue;}
   a1cTotal++;if(n.canonicalValue<A1C_DIABETIC_TARGET_PCT)a1cEnControl++;
  }
  const filasProc=proc.map(r=>r as Record<string,unknown>);
  return{
   topDiagnoses:dx.map(r=>{const o=r as Record<string,unknown>;
    return{code:String(o.code??""),description:String(o.description??""),count:Number(o.n??0)};}),
   topProcedures:filasProc.slice(0,5).map(o=>({detail:String(o.detail??""),count:Number(o.n??0)})),
   proceduresTotal:Number(filasProc[0]?.total??0),
   hba1cTotal:a1cTotal,
   hba1cInControl:a1cEnControl,
   hba1cExcluded:a1cExcluidas,
   hba1cCorrectedOutsideWindow:Number(oa1c.corregidas_fuera??0),
  };
 });
}

// EPIC S-REPORTES — Tendencia de consultas por día del tablero. Cuenta encuentros por el evento base
// ENCOUNTER_OPENED (kind OPENED) agrupados por la FECHA (día) en que ocurrieron, y el total de consultas
// firmadas (ENCOUNTER_SIGNED) para el indicador de expedientes cerrados. Determinista, RLS-scoped, sin PHI.
// Auditoría R04-010: `patientsAttended` del tablero venía del TOTAL de pacientes del tenant, así que ignoraba el rango de
// fechas y, peor, estaba mal etiquetado: «pacientes atendidos» no es «pacientes registrados». Un consultorio con 800
// pacientes en el padrón y 40 consultas en marzo veía 800. Ahora se cuentan los pacientes DISTINTOS con un encuentro
// abierto en la ventana, que es lo que la etiqueta dice.
export type EncounterAnalytics=Readonly<{total:number;signed:number;patientsAttended:number;byDay:ReadonlyArray<{date:string;count:number}>}>;
export async function encounterAnalytics(ctx:HttpTenantContext,w?:ReportWindow):Promise<EncounterAnalytics>{
 return withTenantTx(ctx,async tx=>{
  const dayRows=await tx`
   select to_char(a.occurred_at,'YYYY-MM-DD') as day, count(*)::int as n
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Encounter' and a.payload->>'kind'='OPENED' ${enVentana(tx,w)}
   group by day order by day asc`;
  const attended=await tx`
   select count(distinct a.payload->>'patientId')::int as n from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Encounter' and a.payload->>'kind'='OPENED'
     and a.payload->>'patientId' is not null ${enVentana(tx,w)}`;
  const signedRows=await tx`
   select count(*)::int as n from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='Encounter' and a.payload->>'kind'='SIGNED'`;
  const byDay=dayRows.map(r=>{const o=r as Record<string,unknown>;return{date:String(o.day??""),count:Number(o.n??0)};});
  const total=byDay.reduce((s,d)=>s+d.count,0);
  const signed=Number((signedRows[0] as Record<string,unknown>|undefined)?.n??0);
  const patientsAttended=Number((attended[0] as {n?:unknown}|undefined)?.n??0);
  return{total,signed,patientsAttended,byDay};
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
