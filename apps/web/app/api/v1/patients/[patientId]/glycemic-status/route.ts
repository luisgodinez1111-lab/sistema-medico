import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{glycemicAssessment}from"../../../../../../../../packages/glycemic/src";
import{latestResultValueForAnalyte,activeProblemCodes}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BP — GET /api/v1/patients/:id/glycemic-status (HbA1c -> eAG + control; marco diabético vs tamizaje)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const a1cRaw=await latestResultValueForAnalyte(tctx,patientId,"HBA1C");
  if(a1cRaw===undefined)return NextResponse.json({patientId,computable:false,reason:"Sin HbA1c registrada"},{status:200});
  const a1c=Number(a1cRaw);
  if(!Number.isFinite(a1c))return NextResponse.json({patientId,computable:false,reason:"HbA1c no numérica"},{status:200});
  // Diabético conocido si tiene un problema activo E10/E11 (CIE-10): cambia el marco a metas de tratamiento.
  const problems=await activeProblemCodes(tctx,patientId);
  const diabetic=problems.some(c=>{const u=c.trim().toUpperCase();return u.startsWith("E10")||u.startsWith("E11");});
  const r=glycemicAssessment(a1c,diabetic);
  if(!r)return NextResponse.json({patientId,computable:false,reason:"HbA1c inválida"},{status:200});
  return NextResponse.json({patientId,computable:true,knownDiabetic:diabetic,a1c:r.a1c,estimatedAvgGlucose:r.eag,frame:r.frame,category:r.category,label:r.label},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
