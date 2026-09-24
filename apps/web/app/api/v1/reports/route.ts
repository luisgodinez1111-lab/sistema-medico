import{NextResponse}from"next/server";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{listPatients,claimsRegistry,problemRegistry,ordersRegistry,resultsRegistry,immunizationRegistry,encounterAnalytics,medicationsPrescribed,appointmentsByType,appointmentOutcomes}from"../../../../lib/clinical-runtime";
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
  const[patients,claimRows,problemRows,orderRows,resultRows,immRows,encAnalytics,rxRows,apptRows,apptOut]=await Promise.all([
   listPatients(ctx,{limit:1}), // solo se necesita el total
   claimsRegistry(ctx),
   problemRegistry(ctx),
   ordersRegistry(ctx),
   resultsRegistry(ctx),
   immunizationRegistry(ctx),
   encounterAnalytics(ctx),
   medicationsPrescribed(ctx),
   appointmentsByType(ctx),
   appointmentOutcomes(ctx),
  ]);
  const income=Math.round(claimRows.filter(c=>c.status==="PAID").reduce((s,c)=>{const n=parseFloat(String(c.amount).replace(/[^0-9.]/g,""));return s+(Number.isFinite(n)?n:0);},0)*100)/100;
  // Diagnósticos principales por CIE-10 (top 5).
  const byCode=new Map<string,{code:string;description:string;count:number}>();
  for(const p of problemRows){const k=p.code;const e=byCode.get(k)??{code:p.code,description:p.description,count:0};e.count++;byCode.set(k,e);}
  const totalDx=problemRows.length||1;
  const topDiagnoses=[...byCode.values()].sort((a,b)=>b.count-a.count).slice(0,5).map(e=>({code:e.code,description:e.description,count:e.count,pct:Math.round(e.count/totalDx*100)}));
  // Órdenes y estudios POR TIPO (real, del registro de órdenes) — donut del tablero.
  const ordTotal=orderRows.length;
  const byType=new Map<string,number>();
  for(const o of orderRows)byType.set(o.orderType,(byType.get(o.orderType)??0)+1);
  const ordersByType=[...byType.entries()].sort((a,b)=>b[1]-a[1]).map(([t,n])=>({type:t,label:ORDER_TYPE_LBL[t]??"Otro",count:n,pct:ordTotal?Math.round(n/ordTotal*100):0}));
  // Procedimientos más realizados (órdenes tipo PROCEDURE, agrupadas por descripción) — top 5.
  const byProc=new Map<string,number>();
  for(const o of orderRows)if(o.orderType==="PROCEDURE"&&o.detail)byProc.set(o.detail,(byProc.get(o.detail)??0)+1);
  const procTotalN=[...byProc.values()].reduce((a,b)=>a+b,0)||1;
  const topProcedures=[...byProc.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([detail,n])=>({detail,count:n,pct:Math.round(n/procTotalN*100)}));
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
  const a1cRows=resultRows.filter(r=>String(r.analyte).toUpperCase()==="HBA1C");
  const a1cInControl=a1cRows.filter(r=>{const v=parseFloat(String(r.value).replace(/[^0-9.]/g,""));return Number.isFinite(v)&&v<7;}).length;
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
   mkQI("glycemic_control","HbA1c en control (<7%)",a1cInControl,a1cRows.length,70,"higher","Resultados de HbA1c por debajo de 7% respecto al total de HbA1c registradas."),
  ];
  return NextResponse.json({
   patientsAttended:patients.total, // total del tenant (S-08: listPatients pagina; el conteo no depende de la página)
   income,
   diagnosesTotal:problemRows.length,
   topDiagnoses,
   ordersTotal:ordTotal,
   ordersByType,
   topProcedures,
   resultsTotal:resultRows.length,
   immunizationsApplied:immRows.filter(i=>i.status==="COMPLETE").length,
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
