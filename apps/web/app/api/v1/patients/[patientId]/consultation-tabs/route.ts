import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{resolveDrug}from"../../../../../../../../packages/drug-catalog/src";
import{resultsRegistry,resultEstado,ordersRegistry,activeMedicationDrugCodes,carePlanGoals,patientDocuments,patientObligations,type VitalPoint}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom,pathIds}from"../../../../../../lib/http-command";
// EPIC K/UI — GET /api/v1/patients/:id/consultation-tabs  (vista Consulta, pestañas por paciente)
// Compone en un solo snapshot los datos por paciente de las pestañas Resultados/Órdenes/Medicamentos/Plan de
// cuidados/Documentos/Seguimiento, reutilizando los readers ya probados. Determinista, sin escritura, RLS-scoped.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const OTYPE:Record<string,string>={LAB:"Laboratorio",IMAGING:"Imagenología",PATHOLOGY:"Patología",PROCEDURE:"Procedimiento",REFERRAL:"Interconsulta"};
const DOC_ES:Record<string,string>={PROGRESS_NOTE:"Nota médica",DISCHARGE_SUMMARY:"Alta",REFERRAL:"Interconsulta",PROCEDURE_NOTE:"Procedimiento",OTHER:"Otro"};
const GOAL_ES:Record<string,string>={PROPOSED:"Propuesta",ACTIVE:"Activa",ON_HOLD:"En pausa",ACHIEVED:"Lograda",CANCELLED:"Cancelada"};
const OBL_ES:Record<string,string>={OPEN:"Pendiente",IN_PROGRESS:"En progreso",COMPLETED:"Completada",CANCELLED:"Cancelada"};
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await pathIds(ctx.params);
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const[results0,orders0,medCodes,goals,docs,obls]=await Promise.all([
   resultsRegistry(tctx,{patientId}), // R06-20: el filtro por paciente viaja en el SQL (antes se leían los de toda la clínica)
   ordersRegistry(tctx,{patientId}),
   activeMedicationDrugCodes(tctx,patientId),
   carePlanGoals(tctx,patientId),
   patientDocuments(tctx,patientId),
   patientObligations(tctx,patientId),
  ]);
  // SQL-2 (porte): el estado-UI sale de la misma regla que la vista Resultados (`resultEstado`, declara «Corregido»).
  const results=results0.items.map(r=>({analyte:r.analyte,value:r.value,estado:resultEstado(r),critical:r.critical,receivedAt:r.receivedAt}));
  const orders=orders0.items.map(o=>({typeLabel:OTYPE[o.orderType]??"Otro",detail:o.detail,status:o.status,createdAt:o.createdAt}));
  const medications=[...new Set(medCodes.map(c=>{const dd=resolveDrug(c);return dd?dd.ingredient:c;}))];
  return NextResponse.json({
   results,orders,medications,
   planGoals:goals.map(g=>({goal:g.goal,statusLabel:GOAL_ES[g.status]??"Propuesta"})),
   documents:docs.map(d=>({title:d.title,typeLabel:DOC_ES[d.docType]??"Otro",createdAt:d.createdAt})),
   obligations:obls.map(o=>({task:o.task,dueAt:o.dueAt,statusLabel:OBL_ES[o.status]??"Pendiente",done:o.status==="COMPLETED"})),
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
