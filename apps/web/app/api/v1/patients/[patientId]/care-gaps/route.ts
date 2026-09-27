import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{computeCareGaps,computePreventiveGaps}from"../../../../../../../../packages/care-gaps/src";
import{forecastImmunizations,forecastSummary}from"../../../../../../../../packages/immunization-schedule/src";
import{ageInYears}from"../../../../../../../../packages/prescription-safety/src";
import{readPatientTimeline,patientDemographics,activeProblemCodes,patientVitals,administeredVaccines,latestAnalyteReading}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
import{assertRouteIds}from"../../../../../../lib/http/endpoint";
// EPIC AA — GET /api/v1/patients/:id/care-gaps  (worklist clínico basado en reglas, metadatos sin PHI)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  assertRouteIds({patientId}); // D8: id con formato inválido -> 404, sin tocar la base
  // Las brechas se calculan sobre TODOS los agregados del paciente: se recorren las páginas hasta agotar (S-08).
  const items:Awaited<ReturnType<typeof readPatientTimeline>>["items"][number][]=[];let cursor:string|null=null;
  do{const page=await readPatientTimeline(tctx,patientId,{limit:500,cursor});items.push(...page.items);cursor=page.nextCursor;}while(cursor);
  const gaps=computeCareGaps(items);
  // Auditoría C-20: brechas de cuidado PREVENTIVO (lo que el paciente debería tener por condición y edad y no tiene).
  const asOf=new Date().toISOString();
  const[demo,codes,vitals,vaccines,...labs]=await Promise.all([patientDemographics(tctx,patientId),activeProblemCodes(tctx,patientId),patientVitals(tctx,patientId,50),administeredVaccines(tctx,patientId),
   ...["HBA1C","CREATININE","LDL","UACR","GLUCOSE"].map(a=>latestAnalyteReading(tctx,patientId,a))]);
  const lastAt:Record<string,string|undefined>={};
  ["HBA1C","CREATININE","LDL","UACR","GLUCOSE"].forEach((a,i)=>{lastAt[a]=labs[i]?.occurredAt;});
  const lastBp=vitals.find(v=>v.vitalType==="BP");lastAt["BP"]=lastBp?.at;
  const ageYears=demo?.birthDate?ageInYears(demo.birthDate,asOf):undefined;
  const overdueVaccines=demo?.birthDate?forecastSummary(forecastImmunizations(demo.birthDate,vaccines,asOf)).overdue:0;
  const preventive=demo?.birthDate?computePreventiveGaps({ageYears,asOf,activeProblemCodes:codes,lastAt,overdueVaccines}):[];
  return NextResponse.json({patientId,gaps,preventive,note:demo?.birthDate?undefined:"Paciente sin fecha de nacimiento registrada: brechas preventivas no evaluadas"},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
