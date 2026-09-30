import{NextResponse}from"next/server";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{listPatients,registrySummary,reportAggregates,claimsIncome,resultsSummary,encounterAnalytics,medicationsPrescribed,appointmentsByType,appointmentOutcomes,HBA1C_CONTROL_THRESHOLD}from"../../../../lib/clinical-runtime";
import type{ReportWindow}from"../../../../lib/runtime/analytics";
import{CLINIC_TZ,periodOf,dayWindow}from"../../../../lib/clinic-time";
import{ClinicalError}from"../../../../../../packages/runtime-errors/src";
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
  // Auditoría R04-010: RANGO DE FECHAS. `?from=YYYY-MM-DD&to=YYYY-MM-DD` acota el tablero; sin parámetros, toda la
  // historia (comportamiento anterior). La ventana se aplica sobre `occurred_at`, la fecha del HECHO clínico, nunca sobre
  // `recorded_at`: un resultado de ayer capturado hoy pertenece a ayer para cualquier indicador, y mezclar las dos fechas
  // produce números que no cuadran con el expediente. `to` es EXCLUSIVO y se toma el día completo, para que «to=2026-03-31»
  // incluya el 31 y no lo corte a medianoche.
  const sp=new URL(req.url).searchParams;
  const dia=(v:string|null):string|undefined=>v&&/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)?v:undefined;
  const desde=dia(sp.get("from")),hasta=dia(sp.get("to"));
  if(sp.get("from")&&!desde)throw new ClinicalError("VALIDATION_ERROR","El parámetro «from» debe ser una fecha YYYY-MM-DD.",{param:"from"});
  if(sp.get("to")&&!hasta)throw new ClinicalError("VALIDATION_ERROR","El parámetro «to» debe ser una fecha YYYY-MM-DD.",{param:"to"});
  if(desde&&hasta&&hasta<desde)throw new ClinicalError("VALIDATION_ERROR","El rango pedido termina antes de empezar.",{from:desde,to:hasta});
  const ventana:ReportWindow={
   ...(desde?{fromIso:dayWindow(desde).fromIso}:{}),
   ...(hasta?{toIso:dayWindow(hasta).toIso}:{}),
  };
  // Auditoría R06-20: este tablero traía CINCO registros completos del tenant y reducía en Node los ingresos, los
  // porcentajes y los tops. Ahora cada cifra se calcula en la base y cada consulta devuelve una salida de tamaño fijo.
  const[patients,facturacion,problemas,ordenes,resultados,vacunas,agregados,encAnalytics,rxRows,apptRows,apptOut]=await Promise.all([
   listPatients(ctx,{limit:1}), // solo se necesita el total
   claimsIncome(ctx,periodOf(null),CLINIC_TZ,ventana),
   registrySummary(ctx,{aggregateType:"ClinicalProblem",baseKind:"ADDED"},ventana),
   registrySummary(ctx,{aggregateType:"ClinicalOrder",baseKind:"CREATED",groupField:"orderType"},ventana),
   resultsSummary(ctx,ventana),
   registrySummary(ctx,{aggregateType:"Immunization",baseKind:"DUE"},ventana),
   reportAggregates(ctx,ventana),
   encounterAnalytics(ctx,ventana),
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
  // HbA1c en control: proporción de HbA1c VIGENTES por debajo de la meta del diabético (HBA1C_CONTROL_THRESHOLD, la de
  // packages/glycemic), con el valor canónico en % (hallazgo D10). SQL-3: las vigentes con valor no interpretable no entran
  // en el denominador, pero se DECLARAN (`excluded` y la nota); antes salían en silencio y la nota decía «el total».
  // Revisión del porte (d424bdc): tampoco se pierden en silencio las del periodo reemplazadas por una corrección fechada
  // fuera de él; `excluded` es el total que no entra en el denominador y la nota dice por qué, motivo a motivo.
  const a1cTotal=agregados.hba1cTotal,a1cInControl=agregados.hba1cInControl,a1cExcluded=agregados.hba1cExcluded;
  const a1cCorrectedOut=agregados.hba1cCorrectedOutsideWindow;
  type QI={key:string;label:string;numerator:number;denominator:number;excluded:number;pct:number;target:number;direction:"higher"|"lower";met:boolean;computable:boolean;note:string};
  const mkQI=(key:string,label:string,num:number,den:number,target:number,direction:"higher"|"lower",note:string,excluded=0):QI=>{
   const computable=den>0;const pct=computable?Math.round(num/den*100):0;
   const met=computable&&(direction==="higher"?pct>=target:pct<=target);
   return{key,label,numerator:num,denominator:den,excluded,pct,target,direction,met,computable,note};
  };
  const qualityIndicators:QI[]=[
   mkQI("closed_records","Expedientes cerrados (notas firmadas)",encAnalytics.signed,encAnalytics.total,90,"higher","Consultas con nota clínica firmada respecto al total de consultas abiertas."),
   mkQI("attendance","Asistencia efectiva",apptOut.completed,apptOut.total,80,"higher","Citas completadas respecto al total de citas agendadas."),
   mkQI("no_show","Inasistencia (no-show)",apptOut.noShow,apptOut.total,10,"lower","Citas marcadas como inasistencia respecto al total de citas agendadas."),
   mkQI("glycemic_control",`HbA1c en control (<${HBA1C_CONTROL_THRESHOLD}%)`,a1cInControl,a1cTotal,70,"higher",
    `Resultados vigentes de HbA1c por debajo de ${HBA1C_CONTROL_THRESHOLD}% respecto a las HbA1c vigentes con valor numérico interpretable.`
    +(a1cExcluded>0?` No se cuentan ${a1cExcluded} con valor no interpretable (revíselas en Resultados).`:"")
    +(a1cCorrectedOut>0?` No se cuentan ${a1cCorrectedOut} reemplazadas por una corrección fechada fuera del periodo (la corrección cuenta en el periodo de su fecha).`:""),
    a1cExcluded+a1cCorrectedOut),
  ];
  return NextResponse.json({
   reportWindow:{from:desde??null,to:hasta??null},
   // R04-010: «atendidos» son los pacientes DISTINTOS con un encuentro en la ventana, no el padrón del tenant. El total
   // registrado se sigue publicando aparte, con su nombre correcto, para no perder el dato.
   patientsAttended:encAnalytics.patientsAttended,
   patientsRegistered:patients.total, // total del tenant (S-08: listPatients pagina; el conteo no depende de la página)
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
