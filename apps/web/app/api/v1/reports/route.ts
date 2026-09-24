import{NextResponse}from"next/server";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{listPatients,registrySummary,reportAggregates,claimsIncome,resultsSummary,encounterAnalytics,medicationsPrescribed,appointmentsByType,appointmentOutcomes,HBA1C_CONTROL_THRESHOLD}from"../../../../lib/clinical-runtime";
import{CLINIC_TZ,periodOf}from"../../../../lib/clinic-time";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
// EPIC AD/UI — GET /api/v1/reports -> tablero analítico del consultorio (vista Reportes).
// Compone métricas REALES desde el event stream (registros clínica-wide, RLS-scoped): pacientes atendidos
// (padrón), ingresos (facturas pagadas), diagnósticos principales (CIE-10), órdenes totales y POR TIPO,
// procedimientos más realizados, resultados registrados, vacunas aplicadas, tendencia de consultas por día
// (encuentros), medicamentos más prescritos (recetas reales), tipos de consulta (desde la agenda) e
// indicadores de calidad deterministas (expedientes cerrados, asistencia, inasistencia, HbA1c en control),
// cada uno con su meta y marcado como no computable si no hay denominador. Determinista, sin escritura.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const ORDER_TYPE_LBL:Record<string,string>={LAB:"Laboratorio",IMAGING:"Imagenología",PROCEDURE:"Procedimiento",REFERRAL:"Interconsulta",PATHOLOGY:"Patología"};
const APPT_TYPE_LBL:Record<string,string>={CONSULTA_GENERAL:"Consulta general",CONTROL:"Control",PRIMERA_VEZ:"Primera vez",PROCEDIMIENTO:"Procedimiento",VACUNACION:"Vacunación",RESULTADOS:"Revisión de resultados",URGENCIA:"Urgencia",SIN_TIPO:"Sin especificar"};
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"record:export",purpose:"TREATMENT"});
  // Auditoría R06-20: este tablero traía CINCO registros completos del tenant y reducía en Node los ingresos, los
  // porcentajes y los tops. Ahora cada cifra se calcula en la base y cada consulta devuelve una salida de tamaño fijo.
  const[patients,facturacion,problemas,ordenes,resultados,vacunas,agregados,encAnalytics,rxRows,apptRows,apptOut]=await Promise.all([
   listPatients(ctx,{limit:1}), // solo se necesita el total
   claimsIncome(ctx,periodOf(null),CLINIC_TZ),
   registrySummary(ctx,{aggregateType:"ClinicalProblem",baseKind:"ADDED"}),
   registrySummary(ctx,{aggregateType:"ClinicalOrder",baseKind:"CREATED",groupField:"orderType"}),
   resultsSummary(ctx),
   registrySummary(ctx,{aggregateType:"Immunization",baseKind:"DUE"}),
   reportAggregates(ctx),
   encounterAnalytics(ctx),
   medicationsPrescribed(ctx),
   appointmentsByType(ctx),
   appointmentOutcomes(ctx),
  ]);
  const income=facturacion.incomeAllTime;
  // Diagnósticos principales por CIE-10 (top 5), agrupados en la base.
  const totalDx=problemas.total||1;
  const topDiagnoses=agregados.topDiagnoses.map(e=>({code:e.code,description:e.description,count:e.count,pct:Math.round(e.count/totalDx*100)}));
  // Órdenes y estudios POR TIPO — donut del tablero.
  const ordTotal=ordenes.total;
  const ordersByType=Object.entries(ordenes.byGroup).sort((a,b)=>b[1]-a[1])
   .map(([t,n])=>({type:t,label:ORDER_TYPE_LBL[t]??"Otro",count:n,pct:ordTotal?Math.round(n/ordTotal*100):0}));
  // Procedimientos más realizados (órdenes tipo PROCEDURE, agrupadas por descripción) — top 5.
  const procTotalN=agregados.proceduresTotal||1;
  const topProcedures=agregados.topProcedures.map(x=>({detail:x.detail,count:x.count,pct:Math.round(x.count/procTotalN*100)}));
  // Tendencia de consultas por día (encuentros abiertos) — serie del tablero, ya ordenada por fecha asc.
  const maxDay=encAnalytics.byDay.reduce((m,d)=>Math.max(m,d.count),0)||1;
  const encountersByDay=encAnalytics.byDay.map(d=>({date:d.date,count:d.count,pct:Math.round(d.count/maxDay*100)}));
  // Medicamentos más prescritos (recetas reales) — top 5 por frecuencia.
  const rxTotal=rxRows.reduce((s,r)=>s+r.count,0);
  const topMedications=rxRows.slice(0,5).map(r=>({drugCode:r.drugCode,count:r.count,pct:rxTotal?Math.round(r.count/rxTotal*100):0}));
  // Tipos de consulta (desde la agenda) — conteo real por apptType, con etiqueta legible y porcentaje.
  const apptTotal=apptRows.reduce((s,a)=>s+a.count,0);
  const appointmentsByTypeOut=apptRows.map(a=>({type:a.apptType,label:APPT_TYPE_LBL[a.apptType]??"Otro",count:a.count,pct:apptTotal?Math.round(a.count/apptTotal*100):0}));
  // Indicadores de CALIDAD deterministas — cada uno computado del event stream real, con su meta clínica y
  // dirección (mayor/menor es mejor). Si no hay denominador, el indicador NO se inventa: computable=false.
  // HbA1c en control: proporción de resultados de HbA1c por debajo de 7% (calidad del control glucémico del lab).
  const a1cTotal=agregados.hba1cTotal,a1cInControl=agregados.hba1cInControl;
  type QI={key:string;label:string;numerator:number;denominator:number;pct:number;target:number;direction:"higher"|"lower";met:boolean;computable:boolean;note:string};
  const mkQI=(key:string,label:string,num:number,den:number,target:number,direction:"higher"|"lower",note:string):QI=>{
   const computable=den>0;const pct=computable?Math.round(num/den*100):0;
   const met=computable&&(direction==="higher"?pct>=target:pct<=target);
   return{key,label,numerator:num,denominator:den,pct,target,direction,met,computable,note};
  };
  const qualityIndicators:QI[]=[
   mkQI("closed_records","Expedientes cerrados (notas firmadas)",encAnalytics.signed,encAnalytics.total,90,"higher","Consultas con nota clínica firmada respecto al total de consultas abiertas."),
   mkQI("attendance","Asistencia efectiva",apptOut.completed,apptOut.total,80,"higher","Citas completadas respecto al total de citas agendadas."),
   mkQI("no_show","Inasistencia (no-show)",apptOut.noShow,apptOut.total,10,"lower","Citas marcadas como inasistencia respecto al total de citas agendadas."),
   mkQI("glycemic_control",`HbA1c en control (<${HBA1C_CONTROL_THRESHOLD}%)`,a1cInControl,a1cTotal,70,"higher","Resultados de HbA1c por debajo de 7% respecto al total de HbA1c registradas."),
  ];
  return NextResponse.json({
   patientsAttended:patients.total, // total del tenant (S-08: listPatients pagina; el conteo no depende de la página)
   income,
   diagnosesTotal:problemas.total,
   topDiagnoses,
   ordersTotal:ordTotal,
   ordersByType,
   topProcedures,
   resultsTotal:resultados.total,
   immunizationsApplied:vacunas.byStatus["ADMINISTERED"]??0,
   encountersTotal:encAnalytics.total,
   encountersSigned:encAnalytics.signed,
   encountersByDay,
   prescriptionsTotal:rxTotal,
   topMedications,
   appointmentsTotal:apptTotal,
   appointmentsByType:appointmentsByTypeOut,
   qualityIndicators,
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
