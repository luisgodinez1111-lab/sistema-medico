import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{gatherClinicalIntelligence}from"../../../../../../lib/clinical-intelligence-summary";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
import{assertRouteIds}from"../../../../../../lib/http/endpoint";
// EPIC BS — GET /api/v1/patients/:id/clinical-intelligence
// Resumen de inteligencia clínica DETERMINISTA: hallazgos priorizados por severidad (sin PHI cruda).
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  assertRouteIds({patientId}); // D8: id con formato inválido -> 404, sin tocar la base
  const r=await gatherClinicalIntelligence(tctx,patientId);
  if(!r.registered)throw new ClinicalError("NOT_FOUND","Patient not registered");
  return NextResponse.json({patientId,summary:r.summary,findings:r.findings},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
