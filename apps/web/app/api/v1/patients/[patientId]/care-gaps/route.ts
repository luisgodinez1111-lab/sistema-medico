import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{computeCareGaps}from"../../../../../../../../packages/care-gaps/src";
import{readPatientTimeline}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC AA — GET /api/v1/patients/:id/care-gaps  (worklist clínico basado en reglas, metadatos sin PHI)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  // Las brechas se calculan sobre TODOS los agregados del paciente: se recorren las páginas hasta agotar (S-08).
  const items:Awaited<ReturnType<typeof readPatientTimeline>>["items"][number][]=[];let cursor:string|null=null;
  do{const page=await readPatientTimeline(tctx,patientId,{limit:500,cursor});items.push(...page.items);cursor=page.nextCursor;}while(cursor);
  const gaps=computeCareGaps(items);
  return NextResponse.json({patientId,gaps},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
