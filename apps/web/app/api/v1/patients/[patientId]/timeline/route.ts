import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{readPatientTimeline,clampLimit}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC N — GET /api/v1/patients/:id/timeline  (vista longitudinal, metadatos sin PHI)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  // Auditoría S-08: paginación por cursor (?limit=1..500, por defecto 100; ?cursor= del nextCursor anterior).
  const u=new URL(req.url);
  const page=await readPatientTimeline(tctx,patientId,{limit:clampLimit(u.searchParams.get("limit")),cursor:u.searchParams.get("cursor")});
  return NextResponse.json({patientId,items:page.items,nextCursor:page.nextCursor},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
