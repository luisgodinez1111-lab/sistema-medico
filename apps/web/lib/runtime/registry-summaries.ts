// Resúmenes GENÉRICOS por registro de clínica: recuentos por estado, por grupo y pacientes distintos, calculados en la
// base con salida de tamaño fijo (auditoría R06-20). Salieron de `analytics.ts` cuando el guardián de god-module avisó —por
// cuarta vez en esta remediación— de que ese fichero pasaba de 300 líneas. La separación es real: aquí vive el contador
// genérico que sirve a los seis tableros; en `analytics.ts`, los agregados propios del tablero de REPORTES.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{withTenantTx}from"./connection";
import{transicionesPorAgregado,type ReportWindow,enVentana,nombreDePaciente}from"./read-model-joins";

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
export async function registrySummary(ctx:HttpTenantContext,spec:RegistrySummarySpec,w?:ReportWindow):Promise<RegistrySummary>{
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
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type=${spec.aggregateType} and a.payload->>'kind'=${spec.baseKind} ${enVentana(tx,w)}
   group by 1,2`;
  // Los pacientes distintos NO se pueden sumar entre grupos ni entre estados (uno puede aparecer en varios), así que se
  // cuentan con su propio `count(distinct)`: en total y por estado. Aproximarlos habría sido publicar un número inventado.
  const distintos=await tx`
   select count(distinct a.payload->>'patientId')::int as n
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type=${spec.aggregateType} and a.payload->>'kind'=${spec.baseKind} ${enVentana(tx,w)}`;
  const porEstado=await tx`
   select coalesce(lk.kind,${spec.baseKind}) as estado, count(distinct a.payload->>'patientId')::int as pacientes
   from clinical_events a
   left join ${transicionesPorAgregado(tx,ctx.tenantId,spec.aggregateType,spec.lifecycleKinds)} lk
     on lk.aggregate_id=a.aggregate_id and lk.rn=1
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type=${spec.aggregateType} and a.payload->>'kind'=${spec.baseKind} ${enVentana(tx,w)}
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
export async function topPatientsOfRegistry(ctx:HttpTenantContext,spec:Pick<RegistrySummarySpec,"aggregateType"|"baseKind">,n=5,w?:ReportWindow):Promise<ReadonlyArray<TopPatientRow>>{
 return withTenantTx(ctx,async tx=>{
  // El nombre se resuelve FUERA de la agregación: dentro de un `group by` no se puede correlacionar por `a.payload`
  // («subquery uses ungrouped column»). Se agrupa primero, se corta a las n filas y solo entonces se busca el nombre, con
  // la MISMA regla de nombre vigente que los registros (`nombreDePaciente`, hallazgo D2) sobre la expresión `g.pid`.
  const rows=await tx`
   select g.pid as pid, g.n as n, pn.name as name
   from (
     select a.payload->>'patientId' as pid, count(*)::int as n
     from clinical_events a
     where a.tenant_id=${ctx.tenantId} and a.aggregate_type=${spec.aggregateType} and a.payload->>'kind'=${spec.baseKind} ${enVentana(tx,w)}
       and a.payload->>'patientId' is not null
     group by 1 order by 2 desc, 1 asc limit ${n}
   ) g
   ${nombreDePaciente(tx,ctx.tenantId,tx`g.pid`)}
   order by g.n desc, g.pid asc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;
   return{patientId:String(o.pid??""),name:String(o.name??"Paciente"),count:Number(o.n??0)};});
 });
}
