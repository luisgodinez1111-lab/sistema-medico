import{NextResponse}from"next/server";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{listPatients,claimsRegistry,problemRegistry,ordersRegistry,resultsRegistry,immunizationRegistry,encounterAnalytics,medicationsPrescribed}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
// EPIC AD/UI — GET /api/v1/reports -> tablero analítico del consultorio (vista Reportes).
// Compone métricas REALES desde el event stream (registros clínica-wide, RLS-scoped): pacientes atendidos
// (padrón), ingresos (facturas pagadas), diagnósticos principales (CIE-10), órdenes totales y POR TIPO,
// procedimientos más realizados, resultados registrados, vacunas aplicadas, tendencia de consultas por día
// (encuentros) y medicamentos más prescritos (recetas reales). Determinista, sin escritura.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const ORDER_TYPE_LBL:Record<string,string>={LAB:"Laboratorio",IMAGING:"Imagenología",PROCEDURE:"Procedimiento",REFERRAL:"Interconsulta",PATHOLOGY:"Patología"};
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"record:export",purpose:"TREATMENT"});
  const[patients,claimRows,problemRows,orderRows,resultRows,immRows,encAnalytics,rxRows]=await Promise.all([
   listPatients(ctx),
   claimsRegistry(ctx),
   problemRegistry(ctx),
   ordersRegistry(ctx),
   resultsRegistry(ctx),
   immunizationRegistry(ctx),
   encounterAnalytics(ctx),
   medicationsPrescribed(ctx),
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
  return NextResponse.json({
   patientsAttended:patients.length,
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
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
