import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{stageBloodPressure,parseBp}from"../../../../../../../../packages/bp-staging/src";
import{latestVitalsByType}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
import{assertRouteIds}from"../../../../../../lib/http/endpoint";
// EPIC BT — GET /api/v1/patients/:id/bp-stage (estadificación ACC/AHA 2017 de la última presión arterial)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  assertRouteIds({patientId}); // D8: id con formato inválido -> 404, sin tocar la base
  const vitals=await latestVitalsByType(tctx,patientId);
  const bp=vitals["BP"];
  if(bp===undefined)return NextResponse.json({patientId,computable:false,reason:"Sin presión arterial registrada"},{status:200});
  const parsed=parseBp(bp);
  if(!parsed)return NextResponse.json({patientId,computable:false,reason:"Formato de presión no reconocido (esperado S/D)"},{status:200});
  const r=stageBloodPressure(parsed.systolic,parsed.diastolic);
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  return NextResponse.json({patientId,computable:true,systolic:r.systolic,diastolic:r.diastolic,stage:r.stage,label:r.label,actionNote:r.actionNote},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
