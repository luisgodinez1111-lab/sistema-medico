import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{cha2ds2vasc}from"../../../../../../../../packages/stroke-risk/src";
import{patientDemographics,activeProblemCodes}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BQ — GET /api/v1/patients/:id/cha2ds2vasc (riesgo de ictus en FA -> indicación de anticoagulación)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function ageYears(birthDate:string):number{
 const b=new Date(birthDate),a=new Date();let y=a.getUTCFullYear()-b.getUTCFullYear();
 if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;
}
const has=(codes:string[],...prefixes:string[])=>codes.some(c=>{const u=c.trim().toUpperCase();return prefixes.some(p=>u.startsWith(p));});
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (demographics unavailable)");
  const codes=await activeProblemCodes(tctx,patientId);
  const r=cha2ds2vasc({
   ageYears:ageYears(demo.birthDate),
   female:demo.sexAtBirth==="FEMALE",
   chf:has(codes,"I50"),
   hypertension:has(codes,"I10"),
   diabetes:has(codes,"E10","E11"),
   strokeHistory:has(codes,"I63","G45","I64"),
   vascularDisease:has(codes,"I25","I21","I73"),
  });
  if(!r)throw new ClinicalError("VALIDATION_ERROR","No computable");
  // La FA no valvular es el contexto de aplicación del score.
  const atrialFibrillation=has(codes,"I48");
  return NextResponse.json({patientId,applicable:atrialFibrillation,score:r.score,risk:r.risk,annualStrokeRiskPct:r.annualStrokeRiskPct,recommendation:r.recommendation,components:r.components,note:atrialFibrillation?undefined:"Sin FA activa registrada: el score aplica a fibrilación auricular no valvular"},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
