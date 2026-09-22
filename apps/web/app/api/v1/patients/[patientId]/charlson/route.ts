import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{charlsonFromIcd10,CHARLSON_LABELS_ES}from"../../../../../../../../packages/comorbidity/src";
import{patientDemographics,activeProblemCodes}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC CD — GET /api/v1/patients/:id/charlson (índice de comorbilidad de Charlson desde la lista de problemas + edad)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function ageYears(bd:string):number{const b=new Date(bd),a=new Date();let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (demographics unavailable)");
  const codes=await activeProblemCodes(tctx,patientId);
  // Auditoría C-08: mapeo CIE-10 -> 17 condiciones (Quan 2005) en el paquete, no aquí (una sola implementación).
  const r=charlsonFromIcd10(ageYears(demo.birthDate),codes);
  if(!r)throw new ClinicalError("VALIDATION_ERROR","No computable");
  return NextResponse.json({patientId,score:r.score,ageScore:r.ageScore,comorbidityScore:r.comorbidityScore,risk:r.risk,estimated10yrSurvivalPct:r.estimated10yrSurvivalPct,components:r.components,
   present:r.present.map(k=>({key:k,label:CHARLSON_LABELS_ES[k]})),
   algorithm:{id:"CHARLSON-1987/QUAN-2005",note:"17 categorías con pesos originales; depende de que la lista de problemas esté codificada en CIE-10"},
   coverageNote:"El índice solo ve lo que está en la lista de problemas del paciente con código CIE-10; una comorbilidad no registrada no puntúa."},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
