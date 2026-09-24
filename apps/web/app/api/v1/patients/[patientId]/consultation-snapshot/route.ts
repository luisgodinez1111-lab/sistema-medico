import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{gatherConsultationSnapshot}from"../../../../../../lib/clinical-intelligence-summary";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC CF — GET /api/v1/patients/:id/consultation-snapshot
// Snapshot DETERMINISTA para el panel "Vista principal – Durante la consulta": demografía, valores
// clínicos actuales, problemas/alergias y hallazgos priorizados (sin IA generativa; R6 en pausa).
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const snap=await gatherConsultationSnapshot(tctx,patientId);
  if(!snap.registered)throw new ClinicalError("NOT_FOUND","Patient not registered");
  return NextResponse.json({patientId,...snap},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
