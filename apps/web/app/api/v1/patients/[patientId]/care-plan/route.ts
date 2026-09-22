import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{problemRegistry,carePlanGoals,activeMedicationDrugCodes,activeAllergySubstances,latestResultValueForAnalyte,patientVitals,type VitalPoint}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC X/UI — GET /api/v1/patients/:id/care-plan  (vista Plan de cuidado, snapshot compuesto)
// Compone el contexto REAL del paciente: problemas asociados (con descripción y estado), conteos
// (problemas/medicamentos/alergias), metas del plan (CarePlan) y métricas clave (HbA1c, TA, Peso, IMC).
// Determinista, sin escritura, RLS-scoped.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const PROB_ES:Record<string,string>={ACTIVE:"Activo",CHRONIC:"En seguimiento",RESOLVED:"Resuelto",INACTIVE:"Inactivo"};
const GOAL_ES:Record<string,string>={PROPOSED:"Propuesta",ACTIVE:"Activa",ON_HOLD:"En pausa",ACHIEVED:"Lograda",CANCELLED:"Cancelada"};
function latestOf(points:VitalPoint[],type:string):string|null{const p=points.find(x=>x.vitalType===type);return p?p.value:null;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"careplan:read",purpose:"TREATMENT"});
  const[allProblems,goals,meds,allergies,hba1c,vitals]=await Promise.all([
   problemRegistry(tctx),
   carePlanGoals(tctx,patientId),
   activeMedicationDrugCodes(tctx,patientId),
   activeAllergySubstances(tctx,patientId),
   latestResultValueForAnalyte(tctx,patientId,"HBA1C"),
   patientVitals(tctx,patientId),
  ]);
  const problems=allProblems.filter(p=>p.patientId===patientId).map(p=>({code:p.code,description:p.description,status:p.status,statusLabel:PROB_ES[p.status]??"Activo"}));
  const activeProblems=problems.filter(p=>p.status==="ACTIVE"||p.status==="CHRONIC").length;
  const points=vitals as VitalPoint[];
  const bp=latestOf(points,"BP"),weight=latestOf(points,"WEIGHT"),height=latestOf(points,"HEIGHT");
  const imc=weight&&height&&Number(height)>0?String(Math.round(Number(weight)/Math.pow(Number(height)/100,2)*10)/10):null;
  return NextResponse.json({
   counts:{problems:activeProblems,medications:meds.length,allergies:allergies.length},
   problems,
   goals:goals.map(g=>({category:g.category,goal:g.goal,status:g.status,statusLabel:GOAL_ES[g.status]??"Propuesta"})),
   metrics:{hba1c:hba1c??null,bp:bp??null,weight:weight??null,imc:imc??null},
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
