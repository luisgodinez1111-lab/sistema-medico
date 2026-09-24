import{bmiFromVitals}from"../../../../../../../../packages/anthropometrics/src";
import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{problemRegistry,carePlanGoals,activeMedicationDrugCodes,activeAllergySubstances,latestAnalyteReading,patientVitals,type VitalPoint}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom,pathIds}from"../../../../../../lib/http-command";
// EPIC X/UI — GET /api/v1/patients/:id/care-plan  (vista Plan de cuidado, snapshot compuesto)
// Compone el contexto REAL del paciente: problemas asociados (con descripción y estado), conteos
// (problemas/medicamentos/alergias), metas del plan (CarePlan) y métricas clave (HbA1c, TA, Peso, IMC).
// Determinista, sin escritura, RLS-scoped.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const PROB_ES:Record<string,string>={ACTIVE:"Activo",CHRONIC:"En seguimiento",RESOLVED:"Resuelto",INACTIVE:"Inactivo"};
const GOAL_ES:Record<string,string>={PROPOSED:"Propuesta",ACTIVE:"Activa",ON_HOLD:"En pausa",ACHIEVED:"Lograda",CANCELLED:"Cancelada"};
function latestOf(points:VitalPoint[],type:string):string|null{const p=points.find(x=>x.vitalType===type);return p?p.value:null;}
function latestUnitOf(points:VitalPoint[],type:string):string|undefined{return points.find(x=>x.vitalType===type)?.unit;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await pathIds(ctx.params);
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"careplan:read",purpose:"TREATMENT"});
  const[problems0,goals,meds,allergies,hba1c,vitals]=await Promise.all([
   problemRegistry(tctx,{patientId}), // R06-20: el filtro por paciente viaja en el SQL (antes se leía toda la clínica)
   carePlanGoals(tctx,patientId),
   activeMedicationDrugCodes(tctx,patientId),
   activeAllergySubstances(tctx,patientId),
   latestAnalyteReading(tctx,patientId,"HBA1C"),
   patientVitals(tctx,patientId),
  ]);
  const problems=problems0.items.map(p=>({code:p.code,description:p.description,status:p.status,statusLabel:PROB_ES[p.status]??"Activo"}));
  const activeProblems=problems.filter(p=>p.status==="ACTIVE"||p.status==="CHRONIC").length;
  const points=vitals as VitalPoint[];
  const bp=latestOf(points,"BP"),weight=latestOf(points,"WEIGHT"),height=latestOf(points,"HEIGHT"),heightUnit=latestUnitOf(points,"HEIGHT");
  const imc=(()=>{const b=bmiFromVitals({value:weight},{value:height,unit:heightUnit});return b?String(b.bmi):null;})(); // C-21: IMC único
  return NextResponse.json({
   counts:{problems:activeProblems,medications:meds.length,allergies:allergies.length},
   problems,
   goals:goals.map(g=>({category:g.category,goal:g.goal,status:g.status,statusLabel:GOAL_ES[g.status]??"Propuesta"})),
   // R03-10: la métrica de control glucémico del plan de cuidado con unidad y fecha (una HbA1c de hace dos años no
   // documenta el control actual, y el plan se construye sobre ella).
   metrics:{hba1c:hba1c?{value:hba1c.value,unit:hba1c.canonicalUnit??hba1c.unit,occurredAt:hba1c.occurredAt,ageDays:Math.floor((Date.now()-Date.parse(hba1c.occurredAt))/86_400_000)}:null,bp:bp??null,weight:weight??null,imc:imc??null},
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
