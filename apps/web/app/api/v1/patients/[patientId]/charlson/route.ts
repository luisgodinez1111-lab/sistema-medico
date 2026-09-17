import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{charlson}from"../../../../../../../../packages/comorbidity/src";
import{patientDemographics,activeProblemCodes}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC CD — GET /api/v1/patients/:id/charlson (índice de comorbilidad de Charlson desde la lista de problemas + edad)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function ageYears(bd:string):number{const b=new Date(bd),a=new Date();let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;}
const has=(codes:string[],...p:string[])=>codes.some(c=>{const u=c.trim().toUpperCase();return p.some(x=>u.startsWith(x));});
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (demographics unavailable)");
  const codes=await activeProblemCodes(tctx,patientId);
  const r=charlson(ageYears(demo.birthDate),{
   mi:has(codes,"I21"),
   chf:has(codes,"I50"),
   pvd:has(codes,"I73"),
   cerebrovascular:has(codes,"I63","G45","I64"),
   copd:has(codes,"J44"),
   diabetes:has(codes,"E10","E11"),
   diabetesComplications:has(codes,"E11.2","E11.3","E11.4","E10.2","E10.3","E10.4"),
   renal:has(codes,"N18"),
  });
  if(!r)throw new ClinicalError("VALIDATION_ERROR","No computable");
  return NextResponse.json({patientId,score:r.score,ageScore:r.ageScore,comorbidityScore:r.comorbidityScore,risk:r.risk,estimated10yrSurvivalPct:r.estimated10yrSurvivalPct,components:r.components},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
